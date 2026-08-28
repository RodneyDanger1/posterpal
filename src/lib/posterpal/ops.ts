import { randomBytes, randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import { analyzeContent, aiAvailable, draftReplies, generateCaptionVariants, generateImageWithProvider, localSentiment, suggestHashtags } from "./ai";
import { GRAPH_VERSION, REQUIRED_SCOPES } from "./constants";
import { buildAuthorizeUrl, facebookScheduleWindow, graphFetch, GraphRequestError, unixSeconds } from "./graph";
import {
  cadenceForPage,
  getPage,
  getPageToken,
  getPost,
  getSetting,
  inboxCount,
  latestQuota,
  listComments,
  listCommentsForPost,
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
import { policyForComposer, publishExisting, saveAndDispatch, tickScheduler, attemptGraphPublish } from "./publish";
import { ensureMemory, ensureOverduePractice, seedPracticeWorkspace } from "./seed";
import { syncFromGraph } from "./sync";
import { refreshVaultTokens } from "./facebook-oauth";
import { deleteIdea, deleteSnippet, listIdeas, listSnippets, saveIdea, saveSnippet, updateIdea } from "./memory";
import type { ImageProviderId, TextProviderId } from "./providers";
import type { AnalyticsPoint, ComposerInput, MediaLibraryItem, NeedsItem, PageMetrics, SyncResult } from "./types";
import {
  createPairingCode as mintPairing,
  listDevices as listPairedDevices,
  needsYou,
  redeemPairingCode,
  revokeDevice as revokePairedDevice,
} from "./devices";

async function resolvePageId(userId: string, pageId?: string | null): Promise<string | undefined> {
  if (pageId) {
    const page = await getPage(userId, pageId);
    if (page) return page.id;
  }
  const pages = await listPagesRepo(userId);
  return pages[0]?.id;
}

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
    await ensureOverduePractice(userId);
  }
  const settings = await loadSettings(userId, origin);
  const recentPosts = await listPostsRepo(userId, { limit: 12 });
  const dueSoon = (await listPostsRepo(userId, { limit: 40 })).filter(
    (p) => p.status === "LocalScheduled" || p.status === "FacebookScheduled",
  );
  const quota = await latestQuota(userId);
  const inbox = await inboxCount(userId);
  let failedCount = 0;
  let merchCount = 0;
  let vaultExpiresAt: string | null = null;
  const mix = { Text: 0, Photo: 0, Carousel: 0, Video: 0, Reel: 0, Story: 0 };
  let pageMetrics: Record<string, PageMetrics> = {};
  try {
    const sql = await getSql();
    const failed = await sql<{ n: number }>`
      select count(*)::int as n from posts where user_id = ${userId} and status = 'Failed'
    `;
    failedCount = Number(failed[0]?.n ?? 0);
    const merchRows = await sql<{ n: number }>`
      select count(*)::int as n from merchandise_links where user_id = ${userId}
    `;
    merchCount = Number(merchRows[0]?.n ?? 0);
    const vault = await sql<{ expires_at: string | null }>`
      select expires_at from token_vault where user_id = ${userId} order by created_at desc limit 1
    `;
    vaultExpiresAt = vault[0]?.expires_at ?? null;
    const mixRows = await sql<{ media_type: string; n: number }>`
      select media_type, count(*)::int as n from posts
      where user_id = ${userId} and status = 'Published'
      group by media_type
    `;
    for (const row of mixRows) {
      const k = row.media_type as keyof typeof mix;
      if (k in mix) mix[k] = Number(row.n ?? 0);
    }
    // Per-Page metrics so the fitness card is honest about which Page it labels.
    pageMetrics = await buildPageMetrics(userId);
  } catch {
    /* desk extras must not break the shell */
  }
  try {
    await refreshVaultTokens(userId);
  } catch {
    /* token refresh must not break the shell */
  }
  try {
    await tickScheduler(userId);
  } catch (e) {
    try {
      await recordLog({
        userId,
        status: "scheduler_tick_failed",
        error: e instanceof Error ? e.message : String(e),
        path: "bootstrap",
      });
    } catch {
      /* log must not break the shell */
    }
  }
  return {
    pages,
    recentPosts,
    dueSoon: dueSoon.slice(0, 8),
    inboxCount: inbox,
    quota,
    settings,
    failedCount,
    merchCount,
    vaultExpiresAt,
    mix,
    pageMetrics,
    needs: await needsYouSafe(userId),
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

export async function saveAiKeys(
  userId: string,
  data: {
    openai?: string;
    google?: string;
    deepseek?: string;
    fal?: string;
    defaultTextProvider?: string;
    defaultImageProvider?: string;
  },
) {
  if (data.openai?.trim()) await setSetting(userId, "openai_api_key", data.openai.trim(), true);
  if (data.google?.trim()) await setSetting(userId, "google_api_key", data.google.trim(), true);
  if (data.deepseek?.trim()) await setSetting(userId, "deepseek_api_key", data.deepseek.trim(), true);
  if (data.fal?.trim()) await setSetting(userId, "fal_api_key", data.fal.trim(), true);
  if (data.defaultTextProvider) await setSetting(userId, "default_text_provider", data.defaultTextProvider, false);
  if (data.defaultImageProvider) await setSetting(userId, "default_image_provider", data.defaultImageProvider, false);
  return { ok: true as const };
}

async function providerKey(userId: string, provider: string): Promise<string | null> {
  if (provider === "openai") return getSetting(userId, "openai_api_key");
  if (provider === "gemini") return getSetting(userId, "google_api_key");
  if (provider === "deepseek") return getSetting(userId, "deepseek_api_key");
  if (provider === "flux") return getSetting(userId, "fal_api_key");
  return null;
}

export async function savePrefs(
  userId: string,
  data: { theme?: "light" | "dark"; defaultPageId?: string | null; cadenceWarn?: number; cadenceBlock?: number },
) {
  if (data.theme) await setSetting(userId, "theme", data.theme, false);
  if (data.defaultPageId !== undefined) {
    await setSetting(userId, "default_page_id", data.defaultPageId, false);
  }
  if (data.cadenceWarn !== undefined) {
    const warn = Math.max(1, Number(data.cadenceWarn) || 8);
    await setSetting(userId, "cadence_warn", String(warn), false);
    data = { ...data, cadenceWarn: warn };
  }
  if (data.cadenceBlock !== undefined) {
    const block = Math.max(1, Number(data.cadenceBlock) || 20);
    await setSetting(userId, "cadence_block", String(block), false);
    data = { ...data, cadenceBlock: block };
  }
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
  const secret = await getSetting(userId, "facebook_app_secret");
  if (!secret) throw new Error("Enter your Facebook App Secret and click Save credentials first.");
  await setSetting(userId, "facebook_last_redirect", redirectUri, false);
  await setSetting(userId, "facebook_last_error", null, false);
  const state = randomBytes(24).toString("hex");
  const sql = await getSql();
  await sql`
    insert into oauth_states (state, user_id, expires_at)
    values (${state}, ${userId}, now() + interval '15 minutes')
  `;
  const url = buildAuthorizeUrl({ clientId: appId, redirectUri, state });
  return { url, state, version: GRAPH_VERSION, scopes: [...REQUIRED_SCOPES], redirectUri };
}

export async function facebookConnectStatus(userId: string) {
  const settings = await getSettings(userId);
  if (settings.facebookConnected) {
    return {
      ok: true as const,
      message: settings.livePageCount
        ? `Connected. ${settings.livePageCount} live Page${settings.livePageCount === 1 ? "" : "s"} imported.`
        : "Facebook user token saved. No Pages with CREATE_CONTENT came back from /me/accounts.",
      lastError: null as string | null,
      livePageCount: settings.livePageCount,
    };
  }
  return {
    ok: false as const,
    message: settings.facebookLastError || "Not connected yet.",
    lastError: settings.facebookLastError,
    livePageCount: settings.livePageCount,
  };
}

export async function importPastedToken(userId: string, token: string) {
  const { importPastedUserToken } = await import("./facebook-oauth");
  return importPastedUserToken(userId, token);
}

export const listPages = listPagesRepo;
export async function listPosts(
  userId: string,
  opts: { pageId?: string; status?: string; limit?: number } = {},
) {
  const pageId = opts.pageId ? await resolvePageId(userId, opts.pageId) : undefined;
  return listPostsRepo(userId, { ...opts, pageId });
}

export async function getPostBundle(userId: string, postId: string) {
  const post = await getPost(userId, postId);
  if (!post) return null;
  const media = await listContent(userId, postId);
  const comments = await listCommentsForPost(userId, postId);
  return { post, media, comments };
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
  const extraIds = (data.alsoPageIds ?? []).filter((id) => id && id !== data.pageId);
  const { alsoPageIds: _ignored, ...primaryInput } = data;
  const primary = await saveAndDispatch(userId, primaryInput);
  const extras: Array<{ id: string; status: string; pageId: string; warning: string | null }> = [];
  const failures: string[] = [];
  for (const pageId of extraIds) {
    const page = await getPage(userId, pageId);
    try {
      const result = await saveAndDispatch(userId, { ...primaryInput, pageId });
      extras.push({ id: result.id, status: result.status, pageId, warning: result.warning });
    } catch (e) {
      failures.push(`${page?.name ?? pageId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const extraNote = extras.length
    ? ` Also ${primaryInput.mode === "local-draft" ? "saved" : "queued"} on ${extras.length} other Page${extras.length === 1 ? "" : "s"}.`
    : "";
  const failNote = failures.length ? ` Extra Pages failed — ${failures.join("; ")}` : "";
  const warning = `${primary.warning ?? ""}${extraNote}${failNote}`.trim() || null;
  return { ...primary, extraCount: extras.length, extraIds: extras.map((e) => e.id), warning };
}

export async function clonePost(
  userId: string,
  data: {
    postId: string;
    pageIds: string[];
    mode?: "local-draft" | "schedule";
    scheduledAt?: string | null;
  },
) {
  const post = await getPost(userId, data.postId);
  if (!post) throw new Error("Post not found");
  const media = await listContent(userId, data.postId);
  const pageIds = [...new Set(data.pageIds.filter(Boolean))];
  if (pageIds.length === 0) throw new Error("Pick at least one Page to clone onto.");
  const results: Array<{ id: string; status: string; pageId: string }> = [];
  const failures: string[] = [];
  for (const pageId of pageIds) {
    const page = await getPage(userId, pageId);
    try {
      const result = await saveAndDispatch(userId, {
        pageId,
        message: post.message ?? "",
        link: post.link,
        firstComment: post.first_comment,
        mediaType: post.media_type,
        mode: data.mode ?? "local-draft",
        scheduledAt: data.scheduledAt ?? null,
        media: media.map((m) => ({
          fileName: m.file_name,
          mimeType: m.mime_type ?? undefined,
          dataUrl: m.data_url ?? undefined,
          width: m.width ?? undefined,
          height: m.height ?? undefined,
          durationMs: m.duration_ms ?? undefined,
          altText: m.alt_text ?? undefined,
          createdWithAi: m.created_with_ai,
        })),
      });
      results.push({ id: result.id, status: result.status, pageId });
    } catch (e) {
      failures.push(`${page?.name ?? pageId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (results.length === 0) {
    throw new Error(failures[0] ?? "Could not clone this post.");
  }
  return {
    cloned: results.length,
    results,
    warning: failures.length ? failures.join("; ") : null,
  };
}

export async function publishNow(userId: string, postId: string) {
  return publishExisting(userId, postId, "now");
}

/** Resolve a CSV row's page reference to a real page id: exact id match or
 * case-insensitive name match. Returns null when the reference doesn't resolve. */
async function resolvePageRef(userId: string, ref: string): Promise<string | null> {
  const sql = await getSql();
  const rows = await sql<{ id: string }>`
    select id from pages
    where user_id = ${userId}
      and (id = ${ref} or lower(name) = lower(${ref}))
    limit 1
  `;
  return rows[0]?.id ?? null;
}

/** Bulk CSV scheduling: every row goes through the SAME saveAndDispatch path as
 * the composer, so policy + cadence are enforced server-side per row. Rows with
 * a `when` become LocalScheduled; rows without become local drafts. A `pageId`
 * column accepts either a page id or a case-insensitive page name. */
export async function bulkSchedule(
  userId: string,
  rows: Array<{ message: string; when?: string | null; pageId?: string | null }>,
  defaultPageId: string,
) {
  const results: Array<{ ok: boolean; caption: string; status?: string; error?: string }> = [];
  for (const row of rows) {
    const caption = (row.message ?? "").trim();
    if (!caption) {
      results.push({ ok: false, caption: "", error: "Empty caption row." });
      continue;
    }
    try {
      const when = row.when?.trim() || null;
      let scheduledAt: string | null = null;
      if (when) {
        const t = new Date(when);
        if (Number.isNaN(t.getTime())) {
          results.push({
            ok: false,
            caption,
            error: `Unparseable date "${when}" — use YYYY-MM-DD HH:MM.`,
          });
          continue;
        }
        scheduledAt = t.toISOString();
      }
      let pageId = defaultPageId;
      if (row.pageId?.trim()) {
        const resolved = await resolvePageRef(userId, row.pageId.trim());
        if (!resolved) {
          results.push({ ok: false, caption, error: `Unknown Page "${row.pageId.trim()}".` });
          continue;
        }
        pageId = resolved;
      }
      const result = await saveAndDispatch(userId, {
        pageId,
        message: caption,
        mediaType: "Text",
        mode: scheduledAt ? "schedule" : "local-draft",
        scheduledAt,
      });
      results.push({
        ok: true,
        caption,
        status: result.status,
        ...(result.warning ? { error: result.warning } : {}),
      });
    } catch (e) {
      results.push({ ok: false, caption, error: e instanceof Error ? e.message : String(e) });
    }
  }
  const ok = results.filter((r) => r.ok).length;
  const failed = results.length - ok;
  return {
    ok,
    failed,
    total: results.length,
    results,
    warning: failed
      ? `${failed} of ${results.length} row${results.length === 1 ? "" : "s"} failed — see details.`
      : null,
  };
}

/** RSS auto-post (HITL): for every Page with an rss_feed_url, fetch the newest
 * items and draft ones not already on the desk. Drafts only — a human approves
 * and schedules. Returns the number of new drafts. */
export async function rssDrafts(userId: string): Promise<number> {
  const sql = await getSql();
  const feeds = await sql<{ page_id: string; rss_feed_url: string }>`
    select id as page_id, rss_feed_url from pages
    where user_id = ${userId} and rss_feed_url is not null and rss_feed_url <> ''
  `;
  if (feeds.length === 0) return 0;
  const { fetchFeedItems } = await import("./rss");
  let drafted = 0;
  for (const feed of feeds) {
    let items;
    try {
      items = await fetchFeedItems(feed.rss_feed_url);
    } catch (e) {
      await recordLog({
        userId,
        postId: "",
        status: "rss_fetch_failed",
        error: e instanceof Error ? e.message : String(e),
        path: "rss",
      });
      continue;
    }
    for (const item of items) {
      const message = item.link ? `${item.title}\n${item.link}` : item.title;
      const dup = await sql<{ n: number }>`
        select count(*)::int as n from posts
        where user_id = ${userId} and page_id = ${feed.page_id} and message = ${message}
      `;
      if ((dup[0]?.n ?? 0) > 0) continue;
      await sql`
        insert into posts (id, user_id, page_id, message, media_type, status, created_by_this_app)
        values (${randomUUID()}, ${userId}, ${feed.page_id}, ${message}, 'Text', 'LocalDraft', true)
      `;
      drafted += 1;
      await recordLog({
        userId,
        postId: "",
        status: "rss_drafted",
        error: `Feed draft: ${item.title.slice(0, 80)}`,
        path: "rss",
      });
    }
  }
  return drafted;
}

export async function saveRssFeed(userId: string, data: { pageId: string; feedUrl: string }) {
  const sql = await getSql();
  await sql`
    update pages set rss_feed_url = ${data.feedUrl.trim() || null}
    where id = ${data.pageId} and user_id = ${userId}
  `;
  return { ok: true };
}

export async function reschedule(userId: string, data: { postId: string; scheduledAt: string }) {
  const sql = await getSql();
  const post = await getPost(userId, data.postId);
  if (!post) throw new Error("Post not found");
  if (post.status === "Published") {
    throw new Error("Published posts cannot be rescheduled. Duplicate into Composer if you need a new slot.");
  }
  const when = new Date(data.scheduledAt);
  if (Number.isNaN(when.getTime())) throw new Error("Pick a valid date and time.");
  const windowNote = facebookScheduleWindow(when);
  const page = await getPage(userId, post.page_id);
  const liveGraph =
    Boolean(page?.facebook_page_id) &&
    !page?.is_practice &&
    Boolean(post.facebook_post_id) &&
    !String(post.facebook_post_id).startsWith("practice_");
  const token = await getPageToken(userId, post.page_id);
  const secret = await getSetting(userId, "facebook_app_secret");

  if (liveGraph && token && secret) {
    if (!windowNote) {
      try {
        await graphFetch({
          path: `/${post.facebook_post_id}`,
          method: "POST",
          token,
          appSecret: secret,
          form: { scheduled_publish_time: unixSeconds(when) },
        });
        await sql`
          update posts set
            scheduled_publish_time = ${data.scheduledAt},
            status = 'FacebookScheduled',
            error_message = null,
            updated_at = now()
          where id = ${data.postId} and user_id = ${userId}
        `;
        await recordLog({ userId, postId: data.postId, status: "graph_reschedule", path: `/${post.facebook_post_id}` });
        return { status: "FacebookScheduled" as const, warning: null as string | null };
      } catch (e) {
        const msg = e instanceof GraphRequestError ? e.mapped.message : e instanceof Error ? e.message : String(e);
        await recordLog({
          userId,
          postId: data.postId,
          status: "graph_reschedule_failed",
          error: msg,
          path: `/${post.facebook_post_id}`,
        });
        await sql`
          update posts set scheduled_publish_time = ${data.scheduledAt}, status = 'LocalScheduled', error_message = ${msg}, updated_at = now()
          where id = ${data.postId} and user_id = ${userId}
        `;
        return {
          status: "LocalScheduled" as const,
          warning: `${msg} Saved on the local scheduler. Facebook may still have the original slot — cancel from Drafts if you see a duplicate.`,
        };
      }
    }
    try {
      await graphFetch({
        path: `/${post.facebook_post_id}`,
        method: "DELETE",
        token,
        appSecret: secret,
      });
    } catch (e) {
      await recordLog({
        userId,
        postId: data.postId,
        status: "graph_unschedule_failed",
        error: e instanceof Error ? e.message : String(e),
      });
    }
    await sql`
      update posts set
        scheduled_publish_time = ${data.scheduledAt},
        status = 'LocalScheduled',
        facebook_post_id = null,
        updated_at = now()
      where id = ${data.postId} and user_id = ${userId}
    `;
    await recordLog({ userId, postId: data.postId, status: "rescheduled_local", error: windowNote, path: "calendar" });
    return {
      status: "LocalScheduled" as const,
      warning: `${windowNote} Cancelled the Facebook slot and kept it on the local scheduler.`,
    };
  }

  const nextStatus =
    windowNote ||
    post.status === "LocalDraft" ||
    post.status === "FacebookDraft" ||
    post.status === "Failed" ||
    post.status === "Publishing"
      ? "LocalScheduled"
      : post.status;
  await sql`
    update posts set scheduled_publish_time = ${data.scheduledAt}, status = ${nextStatus}, updated_at = now()
    where id = ${data.postId} and user_id = ${userId}
  `;

  if (!windowNote && page && !page.is_practice && page.facebook_page_id && token && secret && post.media_type !== "Story") {
    const result = await attemptGraphPublish(userId, data.postId, "schedule");
    return { status: result.status, warning: result.warning };
  }

  await recordLog({ userId, postId: data.postId, status: "rescheduled", error: windowNote, path: "calendar" });
  return { status: nextStatus, warning: windowNote };
}

export async function cancelPost(userId: string, postId: string) {
  const sql = await getSql();
  const post = await getPost(userId, postId);
  if (!post) throw new Error("Post not found");
  if (post.status === "Published") {
    throw new Error("Cannot cancel a published post from this desk. Hide or delete it on Facebook if you must.");
  }
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
  if (pageId) {
    const page = await getPage(userId, pageId);
    if (!page) return [];
    return listComments(userId, filter, page.id);
  }
  return listComments(userId, filter);
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
    if (!token || !secret) {
      throw new Error("Reconnect Facebook to hide this comment on Graph. App Secret and a Page token are required.");
    }
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
    if (!token || !secret) {
      throw new Error("Reconnect Facebook to reply on Graph. App Secret and a Page token are required.");
    }
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
  await sql`
    insert into comments (id, user_id, post_id, message, author_name, sentiment, needs_reply, is_from_page)
    values (${randomUUID()}, ${userId}, ${comment.post_id}, ${message}, ${"Page"}, ${"neutral"}, false, true)
  `;
  await sql`update comments set needs_reply = false where id = ${data.commentId} and user_id = ${userId}`;
  await recordLog({ userId, postId: comment.post_id, status: "reply_sent", path: "inbox" });
  return { ok: true as const };
}

export async function markCommentHandled(userId: string, commentId: string) {
  const sql = await getSql();
  const rows = await sql<{ id: string }>`
    select id from comments where id = ${commentId} and user_id = ${userId}
  `;
  if (!rows[0]) throw new Error("Comment not found");
  await sql`update comments set needs_reply = false where id = ${commentId} and user_id = ${userId}`;
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
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const pageId = await resolvePageId(userId, data.pageId);
  const raw = pageId
    ? await sql<AnalyticsPoint>`
        select id, message, published_time, created_at, reactions_count, comments_count,
               shares_count, media_view_unique, ai_variant_label, variant_group_id, media_type, link
        from posts
        where user_id = ${userId} and page_id = ${pageId}
          and status = 'Published'
          and coalesce(published_time, created_at) > ${since}
        order by coalesce(published_time, created_at)
      `
    : await sql<AnalyticsPoint>`
        select id, message, published_time, created_at, reactions_count, comments_count,
               shares_count, media_view_unique, ai_variant_label, variant_group_id, media_type, link
        from posts
        where user_id = ${userId}
          and status = 'Published'
          and coalesce(published_time, created_at) > ${since}
        order by coalesce(published_time, created_at)
      `;
  const page = pageId ? await getPage(userId, pageId) : null;
  return {
    rows: raw,
    insightsLocked: page ? page.fan_count < 100 : false,
    fanCount: page?.fan_count ?? null,
    days,
  };
}

export async function mediaLibrary(userId: string, pageId?: string): Promise<MediaLibraryItem[]> {
  const sql = await getSql();
  const id = await resolvePageId(userId, pageId);
  const rows = id
    ? await sql<MediaLibraryItem>`
        select ci.id, ci.file_name, ci.media_kind, ci.alt_text, ci.data_url, pa.name as page_name, ci.mime_type, ci.created_with_ai
        from content_items ci
        join posts po on po.id = ci.post_id
        join pages pa on pa.id = po.page_id
        where ci.user_id = ${userId} and po.page_id = ${id}
        order by ci.created_at desc
        limit 80
      `
    : await sql<MediaLibraryItem>`
        select ci.id, ci.file_name, ci.media_kind, ci.alt_text, ci.data_url, pa.name as page_name, ci.mime_type, ci.created_with_ai
        from content_items ci
        join posts po on po.id = ci.post_id
        join pages pa on pa.id = po.page_id
        where ci.user_id = ${userId}
        order by ci.created_at desc
        limit 80
      `;
  return rows.map((r) => ({
    ...r,
    created_with_ai:
      r.created_with_ai === true ||
      (r as { created_with_ai?: unknown }).created_with_ai === "t" ||
      (r as { created_with_ai?: unknown }).created_with_ai === 1 ||
      (r as { created_with_ai?: unknown }).created_with_ai === "1",
  }));
}

export async function generateVariants(
  userId: string,
  data: { pageId: string; brief: string; merchCta?: string | null; provider?: string },
) {
  const page = await getPage(userId, data.pageId);
  if (!page) throw new Error("Page not found");
  const settings = await getSettings(userId);
  const provider = (data.provider || settings.defaultTextProvider || "grok") as TextProviderId;
  const canGrok = aiAvailable();
  const key = await providerKey(userId, provider);
  const hasProvider = provider === "grok" ? canGrok : Boolean(key);
  if (!hasProvider) {
    return {
      ai: false as const,
      provider,
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
    provider,
    apiKey: key,
  });
  return { ai: true as const, provider, ...v };
}

export async function hashtags(userId: string, data: { pageId: string; caption: string; provider?: string }) {
  const page = await getPage(userId, data.pageId);
  const settings = await getSettings(userId);
  const provider = (data.provider || settings.defaultTextProvider || "grok") as TextProviderId;
  const key = await providerKey(userId, provider);
  const can = provider === "grok" ? aiAvailable() : Boolean(key);
  if (!can) {
    const words = data.caption.toLowerCase().split(/\W+/).filter((w) => w.length > 4).slice(0, 4);
    return { tags: words.map((w) => `#${w}`), ai: false as const, provider };
  }
  const tags = await suggestHashtags({
    caption: data.caption,
    brandVoice: page?.brand_voice,
    pageName: page?.name ?? "Page",
    provider,
    apiKey: key,
  });
  return { tags, ai: true as const, provider };
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
  try {
    await refreshVaultTokens(userId);
  } catch {
    /* keep ticking */
  }
  let ran = 0;
  try {
    ran = await tickScheduler(userId);
  } catch (e) {
    await recordLog({
      userId,
      status: "scheduler_tick_failed",
      error: e instanceof Error ? e.message : String(e),
      path: "tick",
    });
  }
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
  const id = await resolvePageId(userId, pageId);
  const rows = id
    ? await sql<Record<string, string | number | null>>`
        select po.id, po.page_id, pa.name as page_name, po.message, po.status, po.media_type,
               po.scheduled_publish_time, po.published_time, po.created_at,
               po.reactions_count, po.comments_count, po.engagement_score
        from posts po join pages pa on pa.id = po.page_id
        where po.user_id = ${userId} and po.page_id = ${id} and po.status not in ('Cancelled')
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
export const moveIdea = updateIdea;
export const rememberSnippet = saveSnippet;
export const forgetSnippet = deleteSnippet;

export async function imaginePhoto(userId: string, prompt: string, provider?: string) {
  const settings = await getSettings(userId);
  const chosen = (provider || settings.defaultImageProvider || "grok") as ImageProviderId;
  const key = await providerKey(userId, chosen);
  return generateImageWithProvider({ provider: chosen, prompt, apiKey: key });
}

async function needsYouSafe(userId: string): Promise<NeedsItem[]> {
  try {
    return await needsYou(userId);
  } catch {
    return [];
  }
}

export const listNeeds = needsYouSafe;
export const createPairingCode = mintPairing;
export const listDevices = listPairedDevices;
export const revokeDevice = revokePairedDevice;
export const pairDevice = redeemPairingCode;

export async function runAgent(
  userId: string,
  data: { pageId: string; prompt: string; provider?: string; mapPage?: boolean },
) {
  const { runDeskAgent } = await import("./agent");
  return runDeskAgent(userId, data);
}

export async function pageResearchProfile(userId: string, pageId: string) {
  const { loadPageProfile } = await import("./agent");
  return loadPageProfile(userId, pageId);
}

export async function listAgentRuns(userId: string, pageId?: string) {
  const sql = await getSql();
  const rows = pageId
    ? await sql<{
        id: string;
        prompt: string;
        summary: string | null;
        drafts_json: string | null;
        sources_json: string | null;
        image_prompt: string | null;
        created_at: string;
      }>`
        select id, prompt, summary, drafts_json, sources_json, image_prompt, created_at from agent_runs
        where user_id = ${userId} and page_id = ${pageId}
        order by created_at desc limit 12
      `
    : await sql<{
        id: string;
        prompt: string;
        summary: string | null;
        drafts_json: string | null;
        sources_json: string | null;
        image_prompt: string | null;
        created_at: string;
      }>`
        select id, prompt, summary, drafts_json, sources_json, image_prompt, created_at from agent_runs
        where user_id = ${userId}
        order by created_at desc limit 12
      `;
  return rows;
}

/** Per-Page aggregates so the monetization fitness card is honest about which Page it labels. */
export async function buildPageMetrics(userId: string): Promise<Record<string, PageMetrics>> {
  const sql = await getSql();
  const pageMetrics: Record<string, PageMetrics> = {};
  const mixByPage = await sql<{ page_id: string; media_type: string; n: number }>`
    select page_id, media_type, count(*)::int as n from posts
    where user_id = ${userId} and status = 'Published'
    group by page_id, media_type
  `;
  for (const row of mixByPage) {
    const m = (pageMetrics[row.page_id] ??= emptyPageMetrics());
    if (row.media_type in m.mix) m.mix[row.media_type as keyof typeof m.mix] = Number(row.n ?? 0);
  }
  const failedByPage = await sql<{ page_id: string; n: number }>`
    select page_id, count(*)::int as n from posts
    where user_id = ${userId} and status = 'Failed'
    group by page_id
  `;
  for (const row of failedByPage) (pageMetrics[row.page_id] ??= emptyPageMetrics()).failedCount = Number(row.n ?? 0);
  const merchByPage = await sql<{ page_id: string; n: number }>`
    select page_id, count(*)::int as n from merchandise_links where user_id = ${userId} group by page_id
  `;
  for (const row of merchByPage) (pageMetrics[row.page_id] ??= emptyPageMetrics()).merchCount = Number(row.n ?? 0);
  const inboxByPage = await sql<{ page_id: string; n: number }>`
    select po.page_id, count(*)::int as n
    from comments c join posts po on po.id = c.post_id
    where c.user_id = ${userId} and c.needs_reply = true and c.is_hidden = false
    group by po.page_id
  `;
  for (const row of inboxByPage) (pageMetrics[row.page_id] ??= emptyPageMetrics()).inboxCount = Number(row.n ?? 0);
  const cadenceByPage = await sql<{ page_id: string; n: number }>`
    select page_id, count(*)::int as n from posts
    where user_id = ${userId}
      and (
        (
          status = 'Published'
          and coalesce(published_time, created_at) > now() - interval '24 hours'
          and coalesce(published_time, created_at) <= now()
        )
        or (
          status = 'Publishing'
          and updated_at > now() - interval '24 hours'
        )
        or (
          status in ('FacebookScheduled', 'LocalScheduled')
          and scheduled_publish_time is not null
          and scheduled_publish_time > now() - interval '24 hours'
          and scheduled_publish_time <= now() + interval '24 hours'
        )
      )
    group by page_id
  `;
  for (const row of cadenceByPage) (pageMetrics[row.page_id] ??= emptyPageMetrics()).postedLast24h = Number(row.n ?? 0);
  for (const key of Object.keys(pageMetrics)) {
    const m = pageMetrics[key];
    m.mixDiversity = Object.values(m.mix).filter((n) => n > 0).length;
  }
  return pageMetrics;
}

function emptyPageMetrics(): PageMetrics {
  return { mix: { Text: 0, Photo: 0, Carousel: 0, Video: 0, Reel: 0, Story: 0 }, mixDiversity: 0, failedCount: 0, merchCount: 0, inboxCount: 0, postedLast24h: 0 };
}

