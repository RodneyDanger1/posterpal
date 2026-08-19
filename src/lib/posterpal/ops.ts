import { randomBytes, randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import { analyzeContent, aiAvailable, draftReplies, generateCaptionVariants, generateImage, localSentiment, suggestHashtags } from "./ai";
import { GRAPH_VERSION, REQUIRED_SCOPES } from "./constants";
import { buildAuthorizeUrl, facebookScheduleWindow, graphFetch, GraphRequestError } from "./graph";
import {
  cadenceForPage,
  getPage,
  getPageToken,
  getPost,
  getSetting,
  inboxCount,
  latestQuota,
  listComments,
  listContent,
  listLogs,
  listMerch,
  listPages as listPagesRepo,
  listPosts as listPostsRepo,
  listVault,
  loadSettings,
  recordLog,
  searchAll,
  setSetting,
} from "./repo";
import { policyForComposer, publishExisting, saveAndDispatch, tickScheduler } from "./publish";
import { ensureMemory, seedPracticeWorkspace } from "./seed";
import { syncFromGraph } from "./sync";
import { deleteIdea, deleteSnippet, listIdeas, listSnippets, saveIdea, saveSnippet } from "./memory";
import type { AnalyticsPoint, ComposerInput, MediaLibraryItem, SyncResult } from "./types";

function originFromRequest(): string {
  if (typeof process !== "undefined" && process.env.BETTER_AUTH_URL) {
    return process.env.BETTER_AUTH_URL.replace(/\/$/, "");
  }
  if (typeof process !== "undefined" && process.env.VITE_PUBLIC_HOSTNAME) {
    return `https://${process.env.VITE_PUBLIC_HOSTNAME}`.replace(/\/$/, "");
  }
  return "";
}

export async function bootstrapApp(userId: string) {
  const host = process.env.VITE_PUBLIC_HOSTNAME;
  const origin = host ? `https://${host}` : originFromRequest() || "https://localhost";
  let pages = await listPagesRepo(userId);
  if (pages.length === 0) {
    await seedPracticeWorkspace(userId);
    await setSetting(userId, "setup_complete", "1", false);
    pages = await listPagesRepo(userId);
  } else {
    await ensureMemory(userId);
  }
  const settings = await loadSettings(userId, origin);
  const recentPosts = await listPostsRepo(userId, { limit: 12 });
  const dueSoon = (await listPostsRepo(userId, { limit: 40 })).filter(
    (p) => p.status === "LocalScheduled" || p.status === "FacebookScheduled",
  );
  const quota = await latestQuota(userId);
  const inbox = await inboxCount(userId);
  try {
    await tickScheduler(userId);
  } catch {
    /* scheduler must not break the shell */
  }
  return {
    pages,
    recentPosts,
    dueSoon: dueSoon.slice(0, 8),
    inboxCount: inbox,
    quota,
    settings,
  };
}

export async function getSettings(userId: string) {
  const host = process.env.VITE_PUBLIC_HOSTNAME;
  const origin = host ? `https://${host}` : originFromRequest() || "http://localhost:8080";
  return loadSettings(userId, origin);
}

export async function saveFacebookApp(userId: string, data: { appId: string; appSecret: string }) {
  await setSetting(userId, "facebook_app_id", data.appId.trim(), false);
  if (data.appSecret.trim()) {
    await setSetting(userId, "facebook_app_secret", data.appSecret.trim(), true);
  }
  return { ok: true as const };
}

export async function savePrefs(
  userId: string,
  data: { theme?: "light" | "dark"; defaultPageId?: string | null; cadenceWarn?: number; cadenceBlock?: number },
) {
  if (data.theme) await setSetting(userId, "theme", data.theme, false);
  if (data.defaultPageId !== undefined) {
    await setSetting(userId, "default_page_id", data.defaultPageId, false);
  }
  if (data.cadenceWarn !== undefined) await setSetting(userId, "cadence_warn", String(data.cadenceWarn), false);
  if (data.cadenceBlock !== undefined) await setSetting(userId, "cadence_block", String(data.cadenceBlock), false);
  if (data.cadenceWarn !== undefined || data.cadenceBlock !== undefined) {
    const sql = await getSql();
    await sql`
      update pages set
        cadence_warn_per_24h = coalesce(${data.cadenceWarn ?? null}, cadence_warn_per_24h),
        cadence_block_per_24h = coalesce(${data.cadenceBlock ?? null}, cadence_block_per_24h)
      where user_id = ${userId}
    `;
  }
  return { ok: true as const };
}

export async function completeSetup(userId: string) {
  await setSetting(userId, "setup_complete", "1", false);
  return { ok: true as const };
}

export async function startPractice(userId: string) {
  await seedPracticeWorkspace(userId);
  await setSetting(userId, "setup_complete", "1", false);
  return { ok: true as const };
}

export async function beginFacebookOAuth(userId: string, redirectUri: string) {
  const appId = await getSetting(userId, "facebook_app_id");
  if (!appId) throw new Error("Enter your Facebook App ID first.");
  const state = randomBytes(24).toString("hex");
  const sql = await getSql();
  await sql`
    insert into oauth_states (state, user_id, expires_at)
    values (${state}, ${userId}, now() + interval '15 minutes')
  `;
  const url = buildAuthorizeUrl({ clientId: appId, redirectUri, state });
  return { url, state, version: GRAPH_VERSION, scopes: [...REQUIRED_SCOPES] };
}

export const listPages = listPagesRepo;
export const listPosts = listPostsRepo;

export async function getPostBundle(userId: string, postId: string) {
  const post = await getPost(userId, postId);
  if (!post) return null;
  const media = await listContent(userId, postId);
  return { post, media };
}

export const cadence = cadenceForPage;

export async function policy(
  userId: string,
  data: {
    pageId: string;
    message: string;
    link?: string | null;
    merchUrl?: string | null;
    hasImages: boolean;
    missingAlt: boolean;
    createdWithAi: boolean;
  },
) {
  return policyForComposer(userId, data.pageId, data.message, data);
}

export async function compose(userId: string, data: ComposerInput) {
  return saveAndDispatch(userId, data);
}

export async function publishNow(userId: string, postId: string) {
  return publishExisting(userId, postId, "now");
}

export async function reschedule(userId: string, data: { postId: string; scheduledAt: string }) {
  const sql = await getSql();
  const post = await getPost(userId, data.postId);
  if (!post) throw new Error("Post not found");
  const when = new Date(data.scheduledAt);
  const windowNote = facebookScheduleWindow(when);
  const nextStatus = windowNote || post.status === "LocalDraft" ? "LocalScheduled" : post.status;
  await sql`
    update posts set scheduled_publish_time = ${data.scheduledAt}, status = ${nextStatus}, updated_at = now()
    where id = ${data.postId} and user_id = ${userId}
  `;
  await recordLog({ userId, postId: data.postId, status: "rescheduled", error: windowNote, path: "calendar" });
  return { status: nextStatus, warning: windowNote };
}

export async function cancelPost(userId: string, postId: string) {
  const sql = await getSql();
  const post = await getPost(userId, postId);
  if (!post) throw new Error("Post not found");
  if (post.facebook_post_id && post.created_by_this_app && !post.facebook_post_id.startsWith("practice_")) {
    try {
      const token = await getPageToken(userId, post.page_id);
      const secret = await getSetting(userId, "facebook_app_secret");
      if (token && secret) {
        await graphFetch({ path: `/${post.facebook_post_id}`, method: "DELETE", token, appSecret: secret });
      }
    } catch (e) {
      await recordLog({
        userId,
        postId,
        status: "delete_failed",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  await sql`update posts set status = 'Cancelled', updated_at = now() where id = ${postId} and user_id = ${userId}`;
  return { ok: true as const };
}

export async function comments(userId: string, filter: "needs" | "hidden" | "all", pageId?: string) {
  return listComments(userId, filter, pageId);
}

export async function hideComment(userId: string, data: { commentId: string; hidden: boolean }) {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    facebook_comment_id: string | null;
    post_id: string;
    needs_reply: boolean;
  }>`
    select id, facebook_comment_id, post_id, needs_reply from comments
    where id = ${data.commentId} and user_id = ${userId}
  `;
  const comment = rows[0];
  if (!comment) throw new Error("Comment not found");
  const post = await getPost(userId, comment.post_id);
  if (
    post &&
    comment.facebook_comment_id &&
    !comment.facebook_comment_id.startsWith("practice")
  ) {
    const token = await getPageToken(userId, post.page_id);
    const secret = await getSetting(userId, "facebook_app_secret");
    if (token && secret) {
      try {
        await graphFetch({
          path: `/${comment.facebook_comment_id}`,
          method: "POST",
          token,
          appSecret: secret,
          form: { is_hidden: data.hidden },
        });
      } catch (e) {
        if (e instanceof GraphRequestError) throw new Error(e.mapped.message);
        throw e;
      }
    }
  }
  await sql`
    update comments set
      is_hidden = ${data.hidden},
      needs_reply = ${data.hidden ? false : comment.needs_reply}
    where id = ${data.commentId} and user_id = ${userId}
  `;
  return { ok: true as const };
}

export async function sendReply(userId: string, data: { commentId: string; message: string }) {
  const message = data.message.trim();
  if (!message) throw new Error("Reply is empty");
  const sql = await getSql();
  const rows = await sql<{ id: string; facebook_comment_id: string | null; post_id: string }>`
    select id, facebook_comment_id, post_id from comments
    where id = ${data.commentId} and user_id = ${userId}
  `;
  const comment = rows[0];
  if (!comment) throw new Error("Comment not found");
  const post = await getPost(userId, comment.post_id);
  if (post && comment.facebook_comment_id && !comment.facebook_comment_id.startsWith("practice")) {
    const token = await getPageToken(userId, post.page_id);
    const secret = await getSetting(userId, "facebook_app_secret");
    if (token && secret) {
      try {
        await graphFetch({
          path: `/${comment.facebook_comment_id}/comments`,
          method: "POST",
          token,
          appSecret: secret,
          form: { message },
        });
      } catch (e) {
        if (e instanceof GraphRequestError) throw new Error(e.mapped.message);
        throw e;
      }
    }
  }
  await sql`
    insert into comments (id, user_id, post_id, message, author_name, sentiment, needs_reply, is_from_page)
    values (${randomUUID()}, ${userId}, ${comment.post_id}, ${message}, ${"Page"}, ${"neutral"}, false, true)
  `;
  await sql`update comments set needs_reply = false where id = ${data.commentId} and user_id = ${userId}`;
  await recordLog({ userId, postId: comment.post_id, status: "reply_sent", path: "inbox" });
  return { ok: true as const };
}

export async function generateReplyDrafts(userId: string, commentId: string) {
  const sql = await getSql();
  const rows = await sql<{ message: string; post_id: string }>`
    select message, post_id from comments where id = ${commentId} and user_id = ${userId}
  `;
  const row = rows[0];
  if (!row) throw new Error("Comment not found");
  const post = await getPost(userId, row.post_id);
  const page = post ? await getPage(userId, post.page_id) : null;
  let drafts: string[];
  if (aiAvailable()) {
    drafts = await draftReplies({
      comment: row.message,
      brandVoice: page?.brand_voice,
      pageName: page?.name ?? "Page",
    });
  } else {
    drafts = [
      "Thanks for writing in — we saw this and will follow up with the details.",
      "Appreciate the question. Stop by the desk or reply here and we'll sort it out.",
      "Good catch. Let me confirm and get back to you.",
    ];
  }
  await sql`
    update comments set reply_drafts_json = ${JSON.stringify(drafts)}, sentiment = ${localSentiment(row.message)}
    where id = ${commentId} and user_id = ${userId}
  `;
  return { drafts, ai: aiAvailable() };
}

export const merch = listMerch;

export async function saveMerch(
  userId: string,
  data: { pageId: string; title: string; url: string; platform?: string; utm?: string; cta?: string },
) {
  const sql = await getSql();
  await sql`
    insert into merchandise_links (id, user_id, page_id, title, url, platform, utm_template, cta_override)
    values (${randomUUID()}, ${userId}, ${data.pageId}, ${data.title}, ${data.url}, ${data.platform ?? null}, ${data.utm ?? null}, ${data.cta ?? null})
  `;
  return { ok: true as const };
}

export async function deleteMerch(userId: string, id: string) {
  const sql = await getSql();
  await sql`delete from merchandise_links where id = ${id} and user_id = ${userId}`;
  return { ok: true as const };
}

export const vault = listVault;
export const logs = listLogs;

export async function search(userId: string, q: string) {
  return searchAll(userId, q.trim());
}

export async function analytics(userId: string, data: { pageId?: string; days: number }) {
  const sql = await getSql();
  const days = data.days === 7 || data.days === 90 ? data.days : 28;
  const window = days === 7 ? "7 days" : days === 90 ? "90 days" : "28 days";
  const raw = data.pageId
    ? await sql<AnalyticsPoint>`
        select id, message, published_time, created_at, reactions_count, comments_count,
               shares_count, media_view_unique, ai_variant_label, variant_group_id
        from posts
        where user_id = ${userId} and page_id = ${data.pageId}
          and status = 'Published'
          and coalesce(published_time, created_at) > now() - ${window}::interval
        order by coalesce(published_time, created_at)
      `
    : await sql<AnalyticsPoint>`
        select id, message, published_time, created_at, reactions_count, comments_count,
               shares_count, media_view_unique, ai_variant_label, variant_group_id
        from posts
        where user_id = ${userId}
          and status = 'Published'
          and coalesce(published_time, created_at) > now() - ${window}::interval
        order by coalesce(published_time, created_at)
      `;
  const page = data.pageId ? await getPage(userId, data.pageId) : null;
  return {
    rows: raw,
    insightsLocked: page ? page.fan_count < 100 : false,
    fanCount: page?.fan_count ?? null,
    days,
  };
}

export async function mediaLibrary(userId: string, pageId?: string): Promise<MediaLibraryItem[]> {
  const sql = await getSql();
  const rows = pageId
    ? await sql<MediaLibraryItem>`
        select ci.id, ci.file_name, ci.media_kind, ci.alt_text, ci.data_url, pa.name as page_name, ci.mime_type
        from content_items ci
        join posts po on po.id = ci.post_id
        join pages pa on pa.id = po.page_id
        where ci.user_id = ${userId} and po.page_id = ${pageId}
        order by ci.created_at desc
        limit 80
      `
    : await sql<MediaLibraryItem>`
        select ci.id, ci.file_name, ci.media_kind, ci.alt_text, ci.data_url, pa.name as page_name, ci.mime_type
        from content_items ci
        join posts po on po.id = ci.post_id
        join pages pa on pa.id = po.page_id
        where ci.user_id = ${userId}
        order by ci.created_at desc
        limit 80
      `;
  return rows;
}

export async function generateVariants(
  userId: string,
  data: { pageId: string; brief: string; merchCta?: string | null },
) {
  const page = await getPage(userId, data.pageId);
  if (!page) throw new Error("Page not found");
  if (!aiAvailable()) {
    return {
      ai: false as const,
      storytelling: `${data.brief.trim()}\n\nA quiet afternoon in the shop. Come by if you want to talk about it.`,
      cta: `${data.brief.trim()}\n\nDetails on the Page — tap through when you're ready.`,
      question: `${data.brief.trim()}\n\nWhat would you add? Tell us in the comments.`,
    };
  }
  const v = await generateCaptionVariants({
    brief: data.brief,
    brandVoice: page.brand_voice,
    pageName: page.name,
    merchCta: data.merchCta,
  });
  return { ai: true as const, ...v };
}

export async function hashtags(userId: string, data: { pageId: string; caption: string }) {
  const page = await getPage(userId, data.pageId);
  if (!aiAvailable()) {
    const words = data.caption.toLowerCase().split(/\W+/).filter((w) => w.length > 4).slice(0, 4);
    return { tags: words.map((w) => `#${w}`), ai: false as const };
  }
  const tags = await suggestHashtags({
    caption: data.caption,
    brandVoice: page?.brand_voice,
    pageName: page?.name ?? "Page",
  });
  return { tags, ai: true as const };
}

export async function analyze(content: string) {
  if (!aiAvailable()) {
    return {
      sentiment: localSentiment(content),
      topics: [] as string[],
      riskFlags: [] as string[],
      suggestedHashtags: [] as string[],
      ai: false as const,
    };
  }
  const a = await analyzeContent(content);
  return { ...a, ai: true as const };
}

export async function updatePageVoice(userId: string, data: { pageId: string; brandVoice: string }) {
  const sql = await getSql();
  await sql`
    update pages set brand_voice = ${data.brandVoice}, updated_at = now()
    where id = ${data.pageId} and user_id = ${userId}
  `;
  return { ok: true as const };
}

export async function exportCsv(userId: string, data: { pageId?: string; days: number }) {
  const pack = await analytics(userId, data);
  const header = "id,published,message,reactions,comments,shares,media_views,variant\n";
  const lines = pack.rows.map((r) => {
    const msg = String(r.message ?? "").replaceAll('"', '""');
    return [
      r.id,
      r.published_time ?? r.created_at,
      `"${msg}"`,
      r.reactions_count,
      r.comments_count,
      r.shares_count,
      r.media_view_unique ?? "",
      r.ai_variant_label ?? "",
    ].join(",");
  });
  return header + lines.join("\n");
}

export async function tick(userId: string) {
  const ran = await tickScheduler(userId);
  const last = await getSetting(userId, "last_graph_sync");
  const stale = !last || Date.now() - new Date(last).getTime() > 120_000;
  let sync: SyncResult | null = null;
  if (stale) {
    const pages = await listPagesRepo(userId);
    if (pages.some((p) => !p.is_practice && p.facebook_page_id && p.has_token)) {
      try {
        sync = await syncFromGraph(userId);
        await setSetting(userId, "last_graph_sync", new Date().toISOString(), false);
      } catch {
        /* background sync must not break the tick */
      }
    }
  }
  return { ran, sync };
}

export async function syncNow(userId: string): Promise<SyncResult> {
  const result = await syncFromGraph(userId);
  await setSetting(userId, "last_graph_sync", new Date().toISOString(), false);
  return result;
}

export async function calendar(userId: string, pageId?: string) {
  const sql = await getSql();
  const rows = pageId
    ? await sql<Record<string, string | number | null>>`
        select po.id, po.page_id, pa.name as page_name, po.message, po.status, po.media_type,
               po.scheduled_publish_time, po.published_time, po.created_at,
               po.reactions_count, po.comments_count, po.engagement_score
        from posts po join pages pa on pa.id = po.page_id
        where po.user_id = ${userId} and po.page_id = ${pageId} and po.status not in ('Cancelled')
        order by coalesce(po.scheduled_publish_time, po.published_time, po.created_at)
      `
    : await sql<Record<string, string | number | null>>`
        select po.id, po.page_id, pa.name as page_name, po.message, po.status, po.media_type,
               po.scheduled_publish_time, po.published_time, po.created_at,
               po.reactions_count, po.comments_count, po.engagement_score
        from posts po join pages pa on pa.id = po.page_id
        where po.user_id = ${userId} and po.status not in ('Cancelled')
        order by coalesce(po.scheduled_publish_time, po.published_time, po.created_at)
      `;
  return rows.map((r) => ({
    id: String(r.id),
    page_id: String(r.page_id),
    page_name: String(r.page_name),
    message: r.message == null ? null : String(r.message),
    status: String(r.status),
    media_type: String(r.media_type),
    scheduled_publish_time: r.scheduled_publish_time == null ? null : String(r.scheduled_publish_time),
    published_time: r.published_time == null ? null : String(r.published_time),
    created_at: String(r.created_at),
    reactions_count: Number(r.reactions_count ?? 0),
    comments_count: Number(r.comments_count ?? 0),
    engagement_score: r.engagement_score == null ? 0 : Number(r.engagement_score),
  }));
}

export const ideas = listIdeas;
export const snippets = listSnippets;
export const rememberIdea = saveIdea;
export const forgetIdea = deleteIdea;
export const rememberSnippet = saveSnippet;
export const forgetSnippet = deleteSnippet;

export async function imaginePhoto(prompt: string) {
  return generateImage(prompt);
}

