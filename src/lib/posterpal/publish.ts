import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import {
  buildFeedPublishPayload,
  bytesFromRemoteUrl,
  decodeDataUrl,
  facebookScheduleWindow,
  GraphRequestError,
  graphFetch,
  graphMultipart,
  graphObjectId,
  ruploadBinary,
  unixSeconds,
  type PublishMode,
} from "./graph";
import { cadenceForPage, getPage, getPageToken, getSetting, recordLog, recordQuota } from "./repo";
import { runPolicyChecklist, validateReel } from "./policy";
import { listContent } from "./repo";
import type { ComposerInput, ContentItemRow } from "./types";

export async function saveAndDispatch(userId: string, input: ComposerInput) {
  const page = await getPage(userId, input.pageId);
  if (!page) throw new Error("Page not found");
  if (page.is_read_only && input.mode !== "local-draft") {
    throw new Error("This Page is analyze-only (no CREATE_CONTENT). Save a local draft instead.");
  }

  const cadence = await cadenceForPage(userId, input.pageId);
  if (input.mode !== "local-draft" && cadence.level === "block") {
    throw new Error(
      `Cadence hard cap: ${cadence.postedLast24h} posts in 24h (cap ${cadence.blockAt}). Wait before publishing.`,
    );
  }

  if (input.mediaType === "Reel" && input.media?.[0]) {
    const reelErr = validateReel(input.media[0]);
    if (reelErr) throw new Error(reelErr);
  }

  if (input.mode !== "local-draft") {
    const policy = await policyForComposer(userId, input.pageId, input.message, {
      link: input.link,
      merchUrl: input.merchUrl,
      hasImages: (input.media?.length ?? 0) > 0,
      missingAlt: (input.media ?? []).some((m) => !m.altText?.trim()),
      createdWithAi: (input.media ?? []).some((m) => Boolean(m.createdWithAi)),
    });
    if (!policy.canPublish) {
      const block = policy.flags.find((f) => f.severity === "block");
      throw new Error(block?.detail ?? "Policy checklist blocked this publish.");
    }
  }

  const sql = await getSql();
  const id = randomUUID();
  let status: string = "LocalDraft";
  const scheduled: string | null = input.scheduledAt ?? null;
  if (input.mode === "now") status = "Publishing";
  else if (input.mode === "schedule") status = "LocalScheduled";
  else if (input.mode === "fb-draft") status = "LocalDraft";

  await sql`
    insert into posts (
      id, user_id, page_id, message, link, first_comment, media_type, status,
      scheduled_publish_time, created_by_this_app, ai_variant_label, variant_group_id
    ) values (
      ${id}, ${userId}, ${input.pageId}, ${input.message}, ${input.link ?? null},
      ${input.firstComment ?? null}, ${input.mediaType}, ${status}, ${scheduled},
      true, ${input.variantLabel ?? null}, ${input.variantGroupId ?? null}
    )
  `;

  for (const [i, m] of (input.media ?? []).entries()) {
    await sql`
      insert into content_items (
        id, user_id, post_id, file_name, mime_type, media_kind, file_size, width, height,
        duration_ms, alt_text, data_url, sort_order, created_with_ai
      ) values (
        ${randomUUID()}, ${userId}, ${id}, ${m.fileName}, ${m.mimeType ?? null},
        ${input.mediaType === "Text" ? "Photo" : input.mediaType},
        ${m.dataUrl ? Math.round((m.dataUrl.length * 3) / 4) : null},
        ${m.width ?? null}, ${m.height ?? null}, ${m.durationMs ?? null},
        ${m.altText ?? null}, ${m.dataUrl ?? null}, ${i}, ${Boolean(m.createdWithAi)}
      )
    `;
  }

  if (input.mode === "local-draft") {
    await recordLog({ userId, postId: id, status: "saved_local_draft", path: "local" });
    return { id, status: "LocalDraft", warning: cadence.level === "warn" ? cadenceMessage(cadence) : null };
  }

  if (input.mode === "schedule") {
    if (input.mediaType === "Story") {
      await recordLog({
        userId,
        postId: id,
        status: "story_local_schedule",
        error: "Stories cannot be scheduled on Graph.",
        path: "local-scheduler",
      });
      return {
        id,
        status: "LocalScheduled",
        warning:
          "Stories expire in 24h and Graph has no schedule for them. Kept on the local scheduler — it publishes when this desk is open and the time hits.",
      };
    }
    const when = scheduled ? new Date(scheduled) : null;
    const windowNote = when ? facebookScheduleWindow(when) : "Pick a time.";
    if (windowNote) {
      await recordLog({ userId, postId: id, status: "local_schedule", error: windowNote, path: "local-scheduler" });
      return {
        id,
        status: "LocalScheduled",
        warning: windowNote + (cadence.level === "warn" ? ` ${cadenceMessage(cadence)}` : ""),
      };
    }
    const result = await attemptGraphPublish(userId, id, "schedule");
    return { id, status: result.status, warning: result.warning ?? (cadence.level === "warn" ? cadenceMessage(cadence) : null) };
  }

  if (input.mode === "fb-draft") {
    if (input.mediaType === "Story") {
      await sql`update posts set status = 'LocalDraft', updated_at = now() where id = ${id} and user_id = ${userId}`;
      return {
        id,
        status: "LocalDraft",
        warning: "Stories have no unpublished Facebook draft. Saved locally.",
      };
    }
    const result = await attemptGraphPublish(userId, id, "fb-draft");
    return { id, status: result.status, warning: result.warning };
  }

  const result = await attemptGraphPublish(userId, id, "now");
  return { id, status: result.status, warning: result.warning ?? (cadence.level === "warn" ? cadenceMessage(cadence) : null) };
}

function cadenceMessage(c: { postedLast24h: number; warnAt: number }) {
  return `Cadence warning: ${c.postedLast24h} posts in the last 24h (warn at ${c.warnAt}).`;
}

async function resolveCommentTarget(graphId: string, token: string, appSecret: string): Promise<string> {
  try {
    const meta = await graphFetch<{ id?: string; post_id?: string }>({
      path: `/${graphId}`,
      token,
      appSecret,
      query: { fields: "id,post_id" },
    });
    return meta.data.post_id || meta.data.id || graphId;
  } catch {
    return graphId;
  }
}

export async function publishExisting(userId: string, postId: string, mode: PublishMode = "now") {
  const sql = await getSql();
  const posts = await sql<{ id: string; page_id: string; status: string }>`
    select id, page_id, status from posts where user_id = ${userId} and id = ${postId}
  `;
  const row = posts[0];
  if (!row) throw new Error("Post not found");
  const cadence = await cadenceForPage(userId, row.page_id);
  if (cadence.level === "block") {
    throw new Error(
      `Cadence hard cap: ${cadence.postedLast24h} posts in 24h (cap ${cadence.blockAt}). Wait before publishing.`,
    );
  }
  await sql`update posts set status = 'Publishing', updated_at = now() where id = ${postId} and user_id = ${userId}`;
  return attemptGraphPublish(userId, postId, mode);
}

type MediaSource =
  | { kind: "http"; url: string }
  | { kind: "bytes"; bytes: Uint8Array; mime: string; fileName: string };

async function resolveMedia(item: ContentItemRow): Promise<MediaSource | null> {
  const raw = item.data_url?.trim() ?? "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return { kind: "http", url: raw };
  if (raw.startsWith("data:")) {
    const decoded = decodeDataUrl(raw);
    if (!decoded) return null;
    return {
      kind: "bytes",
      bytes: decoded.bytes,
      mime: item.mime_type || decoded.mime,
      fileName: item.file_name || `media.${decoded.ext}`,
    };
  }
  return null;
}

async function resolveBytes(item: ContentItemRow): Promise<{ bytes: Uint8Array; mime: string; fileName: string } | null> {
  const src = await resolveMedia(item);
  if (!src) return null;
  if (src.kind === "bytes") return src;
  const remote = await bytesFromRemoteUrl(src.url);
  return { bytes: remote.bytes, mime: item.mime_type || remote.mime, fileName: item.file_name || `media.${remote.ext}` };
}

export async function attemptGraphPublish(
  userId: string,
  postId: string,
  mode: PublishMode,
): Promise<{ status: string; warning: string | null }> {
  const sql = await getSql();
  const started = Date.now();
  const posts = await sql<Record<string, unknown>>`
    select * from posts where user_id = ${userId} and id = ${postId}
  `;
  const post = posts[0];
  if (!post) throw new Error("Post not found");
  const pageId = String(post.page_id);
  const page = await getPage(userId, pageId);
  const media = await listContent(userId, postId);

  if (page?.is_practice || !page?.facebook_page_id) {
    if (mode === "now") {
      await sql`
        update posts set status = 'Published', published_time = now(), updated_at = now(),
          facebook_post_id = ${"practice_" + postId.slice(0, 8)}
        where id = ${postId} and user_id = ${userId}
      `;
      await recordLog({ userId, postId, status: "practice_published", path: "practice", durationMs: Date.now() - started });
      return { status: "Published", warning: "Practice Page — published locally, not sent to Graph." };
    }
    if (mode === "schedule") {
      await sql`update posts set status = 'LocalScheduled', updated_at = now() where id = ${postId} and user_id = ${userId}`;
      return { status: "LocalScheduled", warning: "Practice Page — kept on the local scheduler." };
    }
    await sql`update posts set status = 'LocalDraft', updated_at = now() where id = ${postId} and user_id = ${userId}`;
    return { status: "LocalDraft", warning: "Practice Page — Facebook drafts are not available. Saved locally." };
  }

  const appId = (await getSetting(userId, "facebook_app_id")) ?? "";
  const appSecret = (await getSetting(userId, "facebook_app_secret")) ?? "";
  const token = await getPageToken(userId, pageId);
  if (!appId || !appSecret || !token) {
    await failPost(userId, postId, "Missing Facebook App credentials or Page token. Reconnect in Settings.", started, "auth");
    return { status: "Failed", warning: "Reconnect Facebook to publish." };
  }

  try {
    const fbPageId = page.facebook_page_id;
    const message = String(post.message ?? "");
    const link = post.link ? String(post.link) : undefined;
    const scheduledUnix =
      mode === "schedule" && post.scheduled_publish_time
        ? unixSeconds(new Date(String(post.scheduled_publish_time)))
        : undefined;
    const payload = buildFeedPublishPayload({ message, link, mode, scheduledUnix });
    const mediaType = String(post.media_type);
    const ctx = { token, appSecret, fbPageId, message, payload, mode, scheduledUnix };

    let graphId: string | undefined;
    if (mediaType === "Reel") {
      graphId = await publishReel({ ...ctx, item: media[0] });
    } else if (mediaType === "Photo") {
      graphId = await publishPhoto({ ...ctx, item: media[0] });
    } else if (mediaType === "Carousel") {
      graphId = await publishCarousel({ ...ctx, items: media });
    } else if (mediaType === "Video") {
      graphId = await publishVideo({ ...ctx, item: media[0] });
    } else if (mediaType === "Story") {
      graphId = await publishStory({ ...ctx, item: media[0] });
    } else {
      const res = await graphFetch<{ id?: string }>({
        path: `/${fbPageId}/feed`,
        method: "POST",
        token,
        appSecret,
        form: { ...payload },
      });
      graphId = graphObjectId(res.data);
    }

    const nextStatus =
      mode === "now" ? "Published" : mode === "schedule" ? "FacebookScheduled" : "FacebookDraft";
    await sql`
      update posts set
        status = ${nextStatus},
        facebook_post_id = ${graphId ?? null},
        published_time = ${mode === "now" ? new Date().toISOString() : null},
        updated_at = now(),
        error_message = null
      where id = ${postId} and user_id = ${userId}
    `;
    await recordLog({
      userId,
      postId,
      status: `graph_${mode}`,
      path: `/${fbPageId}/feed`,
      durationMs: Date.now() - started,
    });

    const firstComment = String(post.first_comment ?? "").trim();
    if (firstComment && graphId && mode === "now") {
      try {
        const target = await resolveCommentTarget(graphId, token, appSecret);
        await graphFetch({
          path: `/${target}/comments`,
          method: "POST",
          token,
          appSecret,
          form: { message: firstComment },
        });
        await recordLog({ userId, postId, status: "first_comment_posted", path: `/${target}/comments` });
      } catch (e) {
        await recordLog({
          userId,
          postId,
          status: "first_comment_failed",
          error: e instanceof Error ? e.message : String(e),
          path: "first_comment",
        });
      }
    }

    return { status: nextStatus, warning: null };
  } catch (err) {
    const mapped = err instanceof GraphRequestError ? err.mapped : null;
    if (err instanceof GraphRequestError && err.quota) {
      await recordQuota(userId, pageId, err.quota);
    }
    if (mapped?.kind === "unknown_schedule" || mapped?.kind === "invalid_param") {
      await sql`
        update posts set status = 'LocalScheduled', error_message = ${mapped.message}, updated_at = now()
        where id = ${postId} and user_id = ${userId}
      `;
      await recordLog({
        userId,
        postId,
        status: "fallback_local_schedule",
        error: mapped.message,
        graphCode: mapped.code,
        durationMs: Date.now() - started,
      });
      return { status: "LocalScheduled", warning: mapped.message + " Saved on the local scheduler." };
    }
    if (mode === "fb-draft") {
      await sql`
        update posts set status = 'LocalDraft', error_message = ${mapped?.message ?? String(err)}, updated_at = now()
        where id = ${postId} and user_id = ${userId}
      `;
      await recordLog({
        userId,
        postId,
        status: "fb_draft_fallback",
        error: mapped?.message ?? String(err),
        graphCode: mapped?.code ?? null,
        durationMs: Date.now() - started,
      });
      return { status: "LocalDraft", warning: "Facebook draft not supported on this Page. Saved locally." };
    }
    await failPost(userId, postId, mapped?.message ?? String(err), started, mapped ? String(mapped.code) : "graph", mapped?.code);
    if (mapped?.kind === "token") {
      await sql`update token_vault set is_valid = false where user_id = ${userId}`;
    }
    return { status: "Failed", warning: mapped?.message ?? String(err) };
  }
}

type PublishCtx = {
  token: string;
  appSecret: string;
  fbPageId: string;
  message: string;
  payload: ReturnType<typeof buildFeedPublishPayload>;
  mode: PublishMode;
  scheduledUnix?: number;
};

async function publishPhoto(ctx: PublishCtx & { item?: ContentItemRow }): Promise<string | undefined> {
  if (!ctx.item) throw new Error("Photo post is missing an image. Drop a file in Composer or save a draft.");
  const src = await resolveMedia(ctx.item);
  if (!src) throw new Error("This photo has no file or https URL to upload.");
  const fields: Record<string, string | number | boolean | undefined> = {
    caption: ctx.message,
    published: ctx.payload.published,
    scheduled_publish_time: ctx.payload.scheduled_publish_time,
    alt_text_custom: ctx.item.alt_text || undefined,
  };
  if (src.kind === "http") {
    const res = await graphFetch<{ id?: string; post_id?: string }>({
      path: `/${ctx.fbPageId}/photos`,
      method: "POST",
      token: ctx.token,
      appSecret: ctx.appSecret,
      form: { ...fields, url: src.url },
    });
    return graphObjectId(res.data);
  }
  const res = await graphMultipart<{ id?: string; post_id?: string }>({
    path: `/${ctx.fbPageId}/photos`,
    token: ctx.token,
    appSecret: ctx.appSecret,
    fields,
    file: { fieldName: "source", bytes: src.bytes, fileName: src.fileName, mime: src.mime },
  });
  return graphObjectId(res.data);
}

async function publishCarousel(ctx: PublishCtx & { items: ContentItemRow[] }): Promise<string | undefined> {
  if (ctx.items.length === 0) throw new Error("Carousel needs at least one image.");
  const ids: string[] = [];
  for (const item of ctx.items) {
    const src = await resolveMedia(item);
    if (!src) continue;
    if (src.kind === "http") {
      const uploaded = await graphFetch<{ id?: string }>({
        path: `/${ctx.fbPageId}/photos`,
        method: "POST",
        token: ctx.token,
        appSecret: ctx.appSecret,
        form: { url: src.url, published: false, alt_text_custom: item.alt_text || undefined },
      });
      if (uploaded.data.id) ids.push(uploaded.data.id);
    } else {
      const uploaded = await graphMultipart<{ id?: string }>({
        path: `/${ctx.fbPageId}/photos`,
        token: ctx.token,
        appSecret: ctx.appSecret,
        fields: { published: false, alt_text_custom: item.alt_text || undefined },
        file: { fieldName: "source", bytes: src.bytes, fileName: src.fileName, mime: src.mime },
      });
      if (uploaded.data.id) ids.push(uploaded.data.id);
    }
  }
  if (ids.length === 0) throw new Error("Could not upload any carousel images.");
  const form: Record<string, string | number | boolean | undefined> = {
    message: ctx.message,
    published: ctx.payload.published,
    scheduled_publish_time: ctx.payload.scheduled_publish_time,
  };
  ids.forEach((id, i) => {
    form[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id });
  });
  const res = await graphFetch<{ id?: string }>({
    path: `/${ctx.fbPageId}/feed`,
    method: "POST",
    token: ctx.token,
    appSecret: ctx.appSecret,
    form,
  });
  return graphObjectId(res.data);
}

async function publishVideo(ctx: PublishCtx & { item?: ContentItemRow }): Promise<string | undefined> {
  if (!ctx.item) throw new Error("Video post is missing a file.");
  const src = await resolveMedia(ctx.item);
  if (!src) throw new Error("This video has no file or https URL to upload.");
  const fields: Record<string, string | number | boolean | undefined> = {
    description: ctx.message,
    published: ctx.payload.published,
    scheduled_publish_time: ctx.payload.scheduled_publish_time,
  };
  if (src.kind === "http") {
    const res = await graphFetch<{ id?: string }>({
      path: `/${ctx.fbPageId}/videos`,
      method: "POST",
      token: ctx.token,
      appSecret: ctx.appSecret,
      form: { ...fields, file_url: src.url },
    });
    return graphObjectId(res.data);
  }
  const res = await graphMultipart<{ id?: string }>({
    path: `/${ctx.fbPageId}/videos`,
    token: ctx.token,
    appSecret: ctx.appSecret,
    fields,
    file: { fieldName: "source", bytes: src.bytes, fileName: src.fileName, mime: src.mime },
  });
  return graphObjectId(res.data);
}

async function publishReel(ctx: PublishCtx & { item?: ContentItemRow }): Promise<string | undefined> {
  if (!ctx.item) throw new Error("Reel is missing a video file.");
  const file = await resolveBytes(ctx.item);
  if (!file) throw new Error("Reel needs a local video or a fetchable https URL.");
  const start = await graphFetch<{ video_id?: string; upload_url?: string }>({
    path: `/${ctx.fbPageId}/video_reels`,
    method: "POST",
    token: ctx.token,
    appSecret: ctx.appSecret,
    form: { upload_phase: "start" },
  });
  const videoId = start.data.video_id;
  const uploadUrl = start.data.upload_url;
  if (!videoId || !uploadUrl) throw new Error("Reels start did not return video_id/upload_url");
  await ruploadBinary({ uploadUrl, token: ctx.token, bytes: file.bytes, mime: file.mime });
  const videoState = ctx.mode === "now" ? "PUBLISHED" : ctx.mode === "schedule" ? "SCHEDULED" : "DRAFT";
  await graphFetch({
    path: `/${ctx.fbPageId}/video_reels`,
    method: "POST",
    token: ctx.token,
    appSecret: ctx.appSecret,
    form: {
      upload_phase: "finish",
      video_id: videoId,
      video_state: videoState,
      description: ctx.message || undefined,
      scheduled_publish_time: videoState === "SCHEDULED" ? ctx.scheduledUnix : undefined,
    },
  });
  return videoId;
}

async function publishStory(ctx: PublishCtx & { item?: ContentItemRow }): Promise<string | undefined> {
  if (ctx.mode === "schedule" || ctx.mode === "fb-draft") {
    throw new Error("Stories cannot be scheduled or saved as Facebook drafts. Use Publish now or the local scheduler.");
  }
  if (!ctx.item) throw new Error("Story is missing media.");
  const isVideo =
    ctx.item.media_kind === "Video" ||
    ctx.item.media_kind === "Reel" ||
    Boolean(ctx.item.mime_type?.startsWith("video"));
  if (isVideo) {
    const file = await resolveBytes(ctx.item);
    if (!file) throw new Error("Story video needs a local file or fetchable https URL.");
    const start = await graphFetch<{ video_id?: string; upload_url?: string }>({
      path: `/${ctx.fbPageId}/video_stories`,
      method: "POST",
      token: ctx.token,
      appSecret: ctx.appSecret,
      form: { upload_phase: "start" },
    });
    if (!start.data.video_id || !start.data.upload_url) throw new Error("Story video start failed.");
    await ruploadBinary({
      uploadUrl: start.data.upload_url,
      token: ctx.token,
      bytes: file.bytes,
      mime: file.mime,
    });
    await graphFetch({
      path: `/${ctx.fbPageId}/video_stories`,
      method: "POST",
      token: ctx.token,
      appSecret: ctx.appSecret,
      form: { upload_phase: "finish", video_id: start.data.video_id },
    });
    return start.data.video_id;
  }
  const src = await resolveMedia(ctx.item);
  if (!src) throw new Error("Story photo has no file or URL.");
  let photoId: string | undefined;
  if (src.kind === "http") {
    const photo = await graphFetch<{ id?: string }>({
      path: `/${ctx.fbPageId}/photos`,
      method: "POST",
      token: ctx.token,
      appSecret: ctx.appSecret,
      form: { url: src.url, published: false },
    });
    photoId = photo.data.id;
  } else {
    const photo = await graphMultipart<{ id?: string }>({
      path: `/${ctx.fbPageId}/photos`,
      token: ctx.token,
      appSecret: ctx.appSecret,
      fields: { published: false },
      file: { fieldName: "source", bytes: src.bytes, fileName: src.fileName, mime: src.mime },
    });
    photoId = photo.data.id;
  }
  const story = await graphFetch<{ id?: string; post_id?: string }>({
    path: `/${ctx.fbPageId}/photo_stories`,
    method: "POST",
    token: ctx.token,
    appSecret: ctx.appSecret,
    form: { photo_id: photoId },
  });
  return graphObjectId(story.data) ?? photoId;
}

async function failPost(
  userId: string,
  postId: string,
  message: string,
  started: number,
  path: string,
  graphCode?: number,
) {
  const sql = await getSql();
  await sql`
    update posts set status = 'Failed', error_message = ${message}, updated_at = now()
    where id = ${postId} and user_id = ${userId}
  `;
  await recordLog({
    userId,
    postId,
    status: "failed",
    error: message,
    graphCode: graphCode ?? null,
    path,
    durationMs: Date.now() - started,
  });
}

export async function tickScheduler(userId: string): Promise<number> {
  const sql = await getSql();
  const due = await sql<{ id: string }>`
    select id from posts
    where user_id = ${userId}
      and status = 'LocalScheduled'
      and scheduled_publish_time is not null
      and scheduled_publish_time <= now()
    order by scheduled_publish_time
    limit 8
  `;
  let n = 0;
  for (const row of due) {
    await sql`update posts set status = 'Publishing', updated_at = now() where id = ${row.id}`;
    await attemptGraphPublish(userId, row.id, "now");
    n += 1;
  }
  const dueGraph = await sql<{ id: string; scheduled_publish_time: string }>`
    select id, scheduled_publish_time from posts
    where user_id = ${userId}
      and status = 'LocalScheduled'
      and scheduled_publish_time is not null
      and scheduled_publish_time > now()
      and scheduled_publish_time < now() + interval '30 days'
      and scheduled_publish_time > now() + interval '10 minutes'
    limit 8
  `;
  for (const row of dueGraph) {
    const note = facebookScheduleWindow(new Date(row.scheduled_publish_time));
    if (!note) {
      await attemptGraphPublish(userId, row.id, "schedule");
      n += 1;
    }
  }
  return n;
}

export async function policyForComposer(
  userId: string,
  pageId: string,
  message: string,
  opts: { link?: string | null; merchUrl?: string | null; hasImages: boolean; missingAlt: boolean; createdWithAi: boolean },
) {
  const sql = await getSql();
  const recent = await sql<{ id: string; message: string | null; reactions_count: number; comments_count: number; shares_count: number }>`
    select id, message, reactions_count, comments_count, shares_count
    from posts
    where user_id = ${userId} and page_id = ${pageId} and message is not null
    order by created_at desc
    limit 30
  `;
  return runPolicyChecklist({
    message,
    link: opts.link,
    merchUrl: opts.merchUrl,
    hasImages: opts.hasImages,
    missingAlt: opts.missingAlt,
    createdWithAi: opts.createdWithAi,
    recentMessages: recent.map((r) => ({
      id: r.id,
      message: r.message ?? "",
      engagement: r.reactions_count + r.comments_count + r.shares_count,
    })),
  });
}
