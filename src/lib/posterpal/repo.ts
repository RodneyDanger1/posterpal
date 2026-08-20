import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import { decryptSecret, encryptSecret } from "./crypto";
import type {
  CadenceResult,
  CommentRow,
  ContentItemRow,
  MerchRow,
  PageRow,
  PostRow,
  QuotaRow,
  SchedulerLogRow,
  SettingsBag,
  VaultRow,
} from "./types";

export async function getSetting(userId: string, key: string): Promise<string | null> {
  const sql = await getSql();
  const rows = await sql<{ value_plain: string | null; value_enc: string | null }>`
    select value_plain, value_enc from app_settings where user_id = ${userId} and key = ${key}
  `;
  const row = rows[0];
  if (!row) return null;
  if (row.value_enc) return decryptSecret(row.value_enc);
  return row.value_plain;
}

export async function setSetting(
  userId: string,
  key: string,
  value: string | null,
  encrypted: boolean,
): Promise<void> {
  const sql = await getSql();
  const valueEnc = encrypted && value ? encryptSecret(value) : null;
  const valuePlain = encrypted ? null : value;
  await sql`
    insert into app_settings (user_id, key, value_enc, value_plain, updated_at)
    values (${userId}, ${key}, ${valueEnc}, ${valuePlain}, now())
    on conflict (user_id, key) do update set
      value_enc = excluded.value_enc,
      value_plain = excluded.value_plain,
      updated_at = now()
  `;
}

export async function loadSettings(userId: string, origin: string): Promise<SettingsBag> {
  const sql = await getSql();
  const [
    facebookAppId,
    facebookSecret,
    theme,
    defaultPageId,
    cadenceWarn,
    cadenceBlock,
    setupComplete,
    openaiKey,
    googleKey,
    deepseekKey,
    falKey,
    defaultTextProvider,
    defaultImageProvider,
    facebookLastError,
    facebookLastRedirect,
    facebookLastOk,
  ] = await Promise.all([
    getSetting(userId, "facebook_app_id"),
    getSetting(userId, "facebook_app_secret"),
    getSetting(userId, "theme"),
    getSetting(userId, "default_page_id"),
    getSetting(userId, "cadence_warn"),
    getSetting(userId, "cadence_block"),
    getSetting(userId, "setup_complete"),
    getSetting(userId, "openai_api_key"),
    getSetting(userId, "google_api_key"),
    getSetting(userId, "deepseek_api_key"),
    getSetting(userId, "fal_api_key"),
    getSetting(userId, "default_text_provider"),
    getSetting(userId, "default_image_provider"),
    getSetting(userId, "facebook_last_error"),
    getSetting(userId, "facebook_last_redirect"),
    getSetting(userId, "facebook_last_connect_ok"),
  ]);
  const grok = Boolean(process.env.XAI_API_KEY);
  const live = await sql<{ n: number }>`
    select count(*)::int as n from pages
    where user_id = ${userId} and is_practice = false and facebook_page_id is not null
  `;
  return {
    facebookAppId: facebookAppId ?? "",
    hasFacebookSecret: Boolean(facebookSecret),
    hasAiKey: grok,
    theme: theme === "dark" ? "dark" : "light",
    defaultPageId,
    cadenceWarn: Number(cadenceWarn ?? 8) || 8,
    cadenceBlock: Number(cadenceBlock ?? 20) || 20,
    setupComplete: setupComplete === "1",
    oauthRedirectUri: `${origin.replace(/\/$/, "")}/api/facebook/callback`,
    providers: {
      grok,
      openai: Boolean(openaiKey),
      gemini: Boolean(googleKey),
      deepseek: Boolean(deepseekKey),
      flux: Boolean(falKey),
    },
    defaultTextProvider: defaultTextProvider || (grok ? "grok" : openaiKey ? "openai" : googleKey ? "gemini" : deepseekKey ? "deepseek" : "grok"),
    defaultImageProvider: defaultImageProvider || (grok ? "grok" : googleKey ? "gemini" : openaiKey ? "openai" : falKey ? "flux" : "grok"),
    facebookLastError: facebookLastOk === "1" ? null : facebookLastError,
    facebookLastRedirect: facebookLastRedirect,
    facebookConnected: facebookLastOk === "1" || Number(live[0]?.n ?? 0) > 0,
    livePageCount: Number(live[0]?.n ?? 0),
  };
}

function asBool(v: unknown): boolean {
  return v === true || v === "t" || v === "true" || v === 1 || v === "1";
}

function mapPage(r: Record<string, unknown>): PageRow {
  return {
    id: String(r.id),
    user_id: String(r.user_id),
    facebook_page_id: r.facebook_page_id == null ? null : String(r.facebook_page_id),
    name: String(r.name),
    category: r.category == null ? null : String(r.category),
    fan_count: Number(r.fan_count ?? 0),
    tasks_json: r.tasks_json == null ? null : String(r.tasks_json),
    is_active: asBool(r.is_active),
    is_read_only: asBool(r.is_read_only),
    is_practice: asBool(r.is_practice),
    ai_provider: r.ai_provider == null ? null : String(r.ai_provider),
    ai_model: r.ai_model == null ? null : String(r.ai_model),
    brand_voice: r.brand_voice == null ? null : String(r.brand_voice),
    cadence_warn_per_24h: Number(r.cadence_warn_per_24h ?? 8),
    cadence_block_per_24h: Number(r.cadence_block_per_24h ?? 20),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    has_token: asBool(r.has_token),
  };
}

function mapPost(r: Record<string, unknown>): PostRow {
  return {
    id: String(r.id),
    user_id: String(r.user_id),
    page_id: String(r.page_id),
    facebook_post_id: r.facebook_post_id == null ? null : String(r.facebook_post_id),
    message: r.message == null ? null : String(r.message),
    link: r.link == null ? null : String(r.link),
    first_comment: r.first_comment == null ? null : String(r.first_comment),
    media_type: (r.media_type as PostRow["media_type"]) ?? "Text",
    status: (r.status as PostRow["status"]) ?? "LocalDraft",
    scheduled_publish_time: r.scheduled_publish_time == null ? null : String(r.scheduled_publish_time),
    published_time: r.published_time == null ? null : String(r.published_time),
    created_by_this_app: asBool(r.created_by_this_app),
    ai_variant_label: r.ai_variant_label == null ? null : String(r.ai_variant_label),
    variant_group_id: r.variant_group_id == null ? null : String(r.variant_group_id),
    engagement_score: r.engagement_score == null ? null : Number(r.engagement_score),
    reactions_count: Number(r.reactions_count ?? 0),
    comments_count: Number(r.comments_count ?? 0),
    shares_count: Number(r.shares_count ?? 0),
    media_view_unique: r.media_view_unique == null ? null : Number(r.media_view_unique),
    last_insights_at: r.last_insights_at == null ? null : String(r.last_insights_at),
    error_message: r.error_message == null ? null : String(r.error_message),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    page_name: r.page_name == null ? undefined : String(r.page_name),
  };
}

export async function listPages(userId: string): Promise<PageRow[]> {
  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`
    select p.*, (p.access_token_enc is not null) as has_token
    from pages p
    where p.user_id = ${userId} and p.is_active = true
    order by p.name
  `;
  return rows.map(mapPage);
}

export async function getPage(userId: string, pageId: string): Promise<PageRow | null> {
  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`
    select p.*, (p.access_token_enc is not null) as has_token
    from pages p
    where p.user_id = ${userId} and p.id = ${pageId}
  `;
  return rows[0] ? mapPage(rows[0]) : null;
}

export async function getPageToken(userId: string, pageId: string): Promise<string | null> {
  const sql = await getSql();
  const rows = await sql<{ access_token_enc: string | null }>`
    select access_token_enc from pages where user_id = ${userId} and id = ${pageId}
  `;
  return decryptSecret(rows[0]?.access_token_enc);
}

export async function listPosts(
  userId: string,
  opts: { pageId?: string; status?: string; limit?: number } = {},
): Promise<PostRow[]> {
  const sql = await getSql();
  const limit = opts.limit ?? 80;
  if (opts.pageId && opts.status) {
    const rows = await sql<Record<string, unknown>>`
      select po.*, pa.name as page_name
      from posts po join pages pa on pa.id = po.page_id
      where po.user_id = ${userId} and po.page_id = ${opts.pageId} and po.status = ${opts.status}
      order by coalesce(po.scheduled_publish_time, po.published_time, po.created_at) desc
      limit ${limit}
    `;
    return rows.map(mapPost);
  }
  if (opts.pageId) {
    const rows = await sql<Record<string, unknown>>`
      select po.*, pa.name as page_name
      from posts po join pages pa on pa.id = po.page_id
      where po.user_id = ${userId} and po.page_id = ${opts.pageId}
      order by coalesce(po.scheduled_publish_time, po.published_time, po.created_at) desc
      limit ${limit}
    `;
    return rows.map(mapPost);
  }
  if (opts.status) {
    const rows = await sql<Record<string, unknown>>`
      select po.*, pa.name as page_name
      from posts po join pages pa on pa.id = po.page_id
      where po.user_id = ${userId} and po.status = ${opts.status}
      order by coalesce(po.scheduled_publish_time, po.published_time, po.created_at) desc
      limit ${limit}
    `;
    return rows.map(mapPost);
  }
  const rows = await sql<Record<string, unknown>>`
    select po.*, pa.name as page_name
    from posts po join pages pa on pa.id = po.page_id
    where po.user_id = ${userId}
    order by coalesce(po.scheduled_publish_time, po.published_time, po.created_at) desc
    limit ${limit}
  `;
  return rows.map(mapPost);
}

export async function getPost(userId: string, postId: string): Promise<PostRow | null> {
  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`
    select po.*, pa.name as page_name
    from posts po join pages pa on pa.id = po.page_id
    where po.user_id = ${userId} and po.id = ${postId}
  `;
  return rows[0] ? mapPost(rows[0]) : null;
}

export async function listContent(userId: string, postId: string): Promise<ContentItemRow[]> {
  const sql = await getSql();
  const rows = await sql<ContentItemRow>`
    select id, post_id, file_name, mime_type, media_kind, file_size, width, height,
           duration_ms, alt_text, data_url, sort_order, created_with_ai
    from content_items
    where user_id = ${userId} and post_id = ${postId}
    order by sort_order
  `;
  return rows;
}

export async function cadenceForPage(userId: string, pageId: string): Promise<CadenceResult> {
  const sql = await getSql();
  const pages = await sql<{ cadence_warn_per_24h: number; cadence_block_per_24h: number }>`
    select cadence_warn_per_24h, cadence_block_per_24h from pages
    where user_id = ${userId} and id = ${pageId}
  `;
  const warnAt = Number(pages[0]?.cadence_warn_per_24h ?? 8);
  const blockAt = Number(pages[0]?.cadence_block_per_24h ?? 20);
  const counts = await sql<{ n: number }>`
    select count(*)::int as n from posts
    where user_id = ${userId} and page_id = ${pageId}
      and status in ('Published','Publishing','FacebookScheduled','LocalScheduled')
      and coalesce(published_time, created_at) > now() - interval '24 hours'
      and coalesce(published_time, created_at) <= now()
  `;
  const postedLast24h = Number(counts[0]?.n ?? 0);
  const level = postedLast24h >= blockAt ? "block" : postedLast24h >= warnAt ? "warn" : "ok";
  return { postedLast24h, warnAt, blockAt, level };
}

export async function listComments(
  userId: string,
  filter: "needs" | "hidden" | "all",
  pageId?: string,
): Promise<CommentRow[]> {
  const sql = await getSql();
  if (pageId && filter === "needs") {
    const rows = await sql<Record<string, unknown>>`
      select c.*, po.message as post_message, pa.name as page_name
      from comments c
      join posts po on po.id = c.post_id
      join pages pa on pa.id = po.page_id
      where c.user_id = ${userId} and c.is_from_page = false
        and po.page_id = ${pageId} and c.needs_reply = true and c.is_hidden = false
      order by c.created_at desc limit 120
    `;
    return rows.map(mapComment);
  }
  if (pageId && filter === "hidden") {
    const rows = await sql<Record<string, unknown>>`
      select c.*, po.message as post_message, pa.name as page_name
      from comments c
      join posts po on po.id = c.post_id
      join pages pa on pa.id = po.page_id
      where c.user_id = ${userId} and po.page_id = ${pageId} and c.is_hidden = true
      order by c.created_at desc limit 120
    `;
    return rows.map(mapComment);
  }
  if (pageId) {
    const rows = await sql<Record<string, unknown>>`
      select c.*, po.message as post_message, pa.name as page_name
      from comments c
      join posts po on po.id = c.post_id
      join pages pa on pa.id = po.page_id
      where c.user_id = ${userId} and po.page_id = ${pageId} and c.is_from_page = false
      order by c.created_at desc limit 120
    `;
    return rows.map(mapComment);
  }
  if (filter === "needs") {
    const rows = await sql<Record<string, unknown>>`
      select c.*, po.message as post_message, pa.name as page_name
      from comments c
      join posts po on po.id = c.post_id
      join pages pa on pa.id = po.page_id
      where c.user_id = ${userId} and c.is_from_page = false
        and c.needs_reply = true and c.is_hidden = false
      order by c.created_at desc limit 120
    `;
    return rows.map(mapComment);
  }
  if (filter === "hidden") {
    const rows = await sql<Record<string, unknown>>`
      select c.*, po.message as post_message, pa.name as page_name
      from comments c
      join posts po on po.id = c.post_id
      join pages pa on pa.id = po.page_id
      where c.user_id = ${userId} and c.is_hidden = true
      order by c.created_at desc limit 120
    `;
    return rows.map(mapComment);
  }
  const rows = await sql<Record<string, unknown>>`
    select c.*, po.message as post_message, pa.name as page_name
    from comments c
    join posts po on po.id = c.post_id
    join pages pa on pa.id = po.page_id
    where c.user_id = ${userId} and c.is_from_page = false
    order by c.created_at desc limit 120
  `;
  return rows.map(mapComment);
}

function mapComment(r: Record<string, unknown>): CommentRow {
  return {
    id: String(r.id),
    facebook_comment_id: r.facebook_comment_id == null ? null : String(r.facebook_comment_id),
    post_id: String(r.post_id),
    message: String(r.message),
    author_name: r.author_name == null ? null : String(r.author_name),
    author_id: r.author_id == null ? null : String(r.author_id),
    sentiment: (r.sentiment as CommentRow["sentiment"]) ?? null,
    needs_reply: asBool(r.needs_reply),
    reply_drafts_json: r.reply_drafts_json == null ? null : String(r.reply_drafts_json),
    is_hidden: asBool(r.is_hidden),
    is_from_page: asBool(r.is_from_page),
    created_at: String(r.created_at),
    post_message: r.post_message == null ? null : String(r.post_message),
    page_name: r.page_name == null ? undefined : String(r.page_name),
  };
}

export async function listMerch(userId: string, pageId?: string): Promise<MerchRow[]> {
  const sql = await getSql();
  if (pageId) {
    return sql<MerchRow>`
      select id, page_id, title, url, platform, utm_template, cta_override, created_at
      from merchandise_links where user_id = ${userId} and page_id = ${pageId}
      order by created_at desc
    `;
  }
  return sql<MerchRow>`
    select id, page_id, title, url, platform, utm_template, cta_override, created_at
    from merchandise_links where user_id = ${userId}
    order by created_at desc
  `;
}

export async function listVault(userId: string): Promise<VaultRow[]> {
  const sql = await getSql();
  const rows = await sql<Record<string, unknown>>`
    select id, name, expires_at, data_access_expires_at, scopes, last_validated_at,
           is_valid, created_at, (long_lived_token_enc is not null) as has_token
    from token_vault where user_id = ${userId} order by created_at desc
  `;
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    expires_at: r.expires_at == null ? null : String(r.expires_at),
    data_access_expires_at: r.data_access_expires_at == null ? null : String(r.data_access_expires_at),
    scopes: r.scopes == null ? null : String(r.scopes),
    last_validated_at: r.last_validated_at == null ? null : String(r.last_validated_at),
    is_valid: asBool(r.is_valid),
    created_at: String(r.created_at),
    has_token: asBool(r.has_token),
  }));
}

export async function latestQuota(userId: string): Promise<QuotaRow | null> {
  const sql = await getSql();
  const rows = await sql<QuotaRow>`
    select id, page_id, source_header, call_count_pct, estimated_regain_minutes, captured_at
    from quota_snapshots where user_id = ${userId}
    order by captured_at desc limit 1
  `;
  return rows[0] ?? null;
}

export async function recordQuota(
  userId: string,
  pageId: string | null,
  quota: { sourceHeader: string; callCountPct: number | null; estimatedRegainMinutes: number | null },
): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into quota_snapshots (id, user_id, page_id, source_header, call_count_pct, estimated_regain_minutes)
    values (${randomUUID()}, ${userId}, ${pageId}, ${quota.sourceHeader}, ${quota.callCountPct}, ${quota.estimatedRegainMinutes})
  `;
}

export async function recordLog(input: {
  userId: string;
  postId?: string | null;
  status: string;
  error?: string | null;
  graphCode?: number | null;
  http?: number | null;
  durationMs?: number | null;
  path?: string | null;
}): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into scheduler_logs (id, user_id, post_id, status, error_message, graph_error_code, http_status_code, duration_ms, request_path)
    values (
      ${randomUUID()}, ${input.userId}, ${input.postId ?? null}, ${input.status},
      ${input.error ?? null}, ${input.graphCode ?? null}, ${input.http ?? null},
      ${input.durationMs ?? null}, ${input.path ?? null}
    )
  `;
}

export async function listLogs(userId: string, limit = 40): Promise<SchedulerLogRow[]> {
  const sql = await getSql();
  return sql<SchedulerLogRow>`
    select id, post_id, attempt_time, status, error_message, graph_error_code, http_status_code, duration_ms, request_path
    from scheduler_logs where user_id = ${userId}
    order by attempt_time desc limit ${limit}
  `;
}

export async function inboxCount(userId: string): Promise<number> {
  const sql = await getSql();
  const rows = await sql<{ n: number }>`
    select count(*)::int as n from comments
    where user_id = ${userId} and needs_reply = true and is_hidden = false and is_from_page = false
  `;
  return Number(rows[0]?.n ?? 0);
}

export async function searchAll(userId: string, q: string) {
  const sql = await getSql();
  const like = `%${q.replace(/%/g, "")}%`;
  const pages = await sql<{ id: string; name: string }>`
    select id, name from pages where user_id = ${userId} and name ilike ${like} limit 8
  `;
  const posts = await sql<{ id: string; message: string | null; status: string }>`
    select id, message, status from posts
    where user_id = ${userId} and message ilike ${like}
    order by created_at desc limit 10
  `;
  const comments = await sql<{ id: string; message: string; author_name: string | null }>`
    select id, message, author_name from comments
    where user_id = ${userId} and message ilike ${like}
    order by created_at desc limit 8
  `;
  return { pages, posts, comments };
}
