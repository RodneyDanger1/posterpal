import { n as validateReel, t as runPolicyChecklist } from "./policy-BrE_WUcI.mjs";
import { r as getSql } from "./db-BDeUOKCw.mjs";
import { a as buildAuthorizeUrl, c as encryptSecret, d as unixSeconds, i as REQUIRED_SCOPES, l as facebookScheduleWindow, n as GRAPH_VERSION, o as buildFeedPublishPayload, r as GraphRequestError, s as decryptSecret, u as graphFetch } from "./crypto-DpPosqIC.mjs";
import { randomBytes, randomUUID } from "node:crypto";
//#region node_modules/.nitro/vite/services/ssr/assets/ops-omSMy2j5.js
var MODEL = "grok-4.5";
function aiAvailable() {
	return Boolean(process.env.XAI_API_KEY);
}
async function chat(system, user, maxTokens = 700) {
	const apiKey = process.env.XAI_API_KEY;
	if (!apiKey) throw new Error("AI is not available in this environment");
	const res = await fetch("https://api.x.ai/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model: MODEL,
			temperature: .7,
			max_tokens: maxTokens,
			messages: [{
				role: "system",
				content: system
			}, {
				role: "user",
				content: user
			}]
		})
	});
	if (!res.ok) {
		const t = await res.text();
		throw new Error(`xAI API error ${res.status}: ${t.slice(0, 200)}`);
	}
	return (await res.json()).choices?.[0]?.message?.content?.trim() ?? "";
}
async function generateCaptionVariants(input) {
	const voice = input.brandVoice || "Warm, specific, human. No corporate filler. No emoji spam.";
	const merch = input.merchCta ? `If natural, weave this merch CTA: ${input.merchCta}` : "Do not invent products.";
	const raw = await chat(`You write Facebook Page captions for "${input.pageName}". Voice: ${voice}.
Return ONLY valid JSON: {"storytelling":"...","cta":"...","question":"..."}.
Each caption 40–90 words. No hashtag dumps (max 3). Never auto-promise engagement.`, `Brief:\n${input.brief}\n\n${merch}\nWrite three variants: storytelling, direct CTA, and a genuine question.`, 900);
	const json = extractJson(raw);
	return {
		storytelling: String(json.storytelling ?? raw),
		cta: String(json.cta ?? ""),
		question: String(json.question ?? "")
	};
}
async function suggestHashtags(input) {
	const json = extractJson(await chat(`Suggest 6 relevant Facebook hashtags for the Page "${input.pageName}". Return JSON {"tags":["#foo"]}. No banned or spam tags.`, input.caption.slice(0, 800), 200));
	return (Array.isArray(json.tags) ? json.tags.map(String) : []).filter((t) => t.startsWith("#")).slice(0, 8);
}
async function analyzeContent(content) {
	const json = extractJson(await chat(`Analyze this Facebook comment or caption. Return JSON:
{"sentiment":"positive|neutral|negative|question","topics":[],"riskFlags":[],"suggestedHashtags":[]}.
riskFlags are policy risks (hate, spam, scams), not style notes.`, content.slice(0, 2e3), 300));
	const sent = String(json.sentiment ?? "neutral");
	return {
		sentiment: sent === "positive" || sent === "negative" || sent === "question" ? sent : "neutral",
		topics: Array.isArray(json.topics) ? json.topics.map(String).slice(0, 8) : [],
		riskFlags: Array.isArray(json.riskFlags) ? json.riskFlags.map(String).slice(0, 8) : [],
		suggestedHashtags: Array.isArray(json.suggestedHashtags) ? json.suggestedHashtags.map(String).slice(0, 6) : []
	};
}
async function draftReplies(input) {
	const voice = input.brandVoice || "Helpful, specific, never sycophantic. Human must send — do not sound automated.";
	const json = extractJson(await chat(`You draft Facebook comment REPLIES for "${input.pageName}". Voice: ${voice}.
A human will click Send — never imply the reply was auto-sent.
Return JSON {"drafts":["...","...","..."]} — exactly 3 short replies (1–3 sentences).`, input.comment.slice(0, 1500), 400));
	const drafts = Array.isArray(json.drafts) ? json.drafts.map(String) : [];
	while (drafts.length < 3) drafts.push("Thanks for writing in — let me look into that and get back to you.");
	return drafts.slice(0, 3);
}
function extractJson(raw) {
	const start = raw.indexOf("{");
	const end = raw.lastIndexOf("}");
	if (start < 0 || end <= start) return {};
	try {
		return JSON.parse(raw.slice(start, end + 1));
	} catch {
		return {};
	}
}
function localSentiment(text) {
	const t = text.toLowerCase();
	if (/\?|how |when |where |do you|can you|is there/.test(t)) return "question";
	if (/\b(love|amazing|great|thanks|awesome|perfect|beautiful)\b/.test(t)) return "positive";
	if (/\b(hate|scam|worst|terrible|refund|angry|horrible|never)\b/.test(t)) return "negative";
	return "neutral";
}
async function getSetting(userId, key) {
	const row = (await (await getSql())`
    select value_plain, value_enc from app_settings where user_id = ${userId} and key = ${key}
  `)[0];
	if (!row) return null;
	if (row.value_enc) return decryptSecret(row.value_enc);
	return row.value_plain;
}
async function setSetting(userId, key, value, encrypted) {
	await (await getSql())`
    insert into app_settings (user_id, key, value_enc, value_plain, updated_at)
    values (${userId}, ${key}, ${encrypted && value ? encryptSecret(value) : null}, ${encrypted ? null : value}, now())
    on conflict (user_id, key) do update set
      value_enc = excluded.value_enc,
      value_plain = excluded.value_plain,
      updated_at = now()
  `;
}
async function loadSettings(userId, origin) {
	const [facebookAppId, facebookSecret, theme, defaultPageId, cadenceWarn, cadenceBlock, setupComplete] = await Promise.all([
		getSetting(userId, "facebook_app_id"),
		getSetting(userId, "facebook_app_secret"),
		getSetting(userId, "theme"),
		getSetting(userId, "default_page_id"),
		getSetting(userId, "cadence_warn"),
		getSetting(userId, "cadence_block"),
		getSetting(userId, "setup_complete")
	]);
	return {
		facebookAppId: facebookAppId ?? "",
		hasFacebookSecret: Boolean(facebookSecret),
		hasAiKey: Boolean(process.env.XAI_API_KEY),
		theme: theme === "dark" ? "dark" : "light",
		defaultPageId,
		cadenceWarn: Number(cadenceWarn ?? 8) || 8,
		cadenceBlock: Number(cadenceBlock ?? 20) || 20,
		setupComplete: setupComplete === "1",
		oauthRedirectUri: `${origin.replace(/\/$/, "")}/api/facebook/callback`
	};
}
function asBool(v) {
	return v === true || v === "t" || v === "true" || v === 1 || v === "1";
}
function mapPage(r) {
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
		has_token: asBool(r.has_token)
	};
}
function mapPost(r) {
	return {
		id: String(r.id),
		user_id: String(r.user_id),
		page_id: String(r.page_id),
		facebook_post_id: r.facebook_post_id == null ? null : String(r.facebook_post_id),
		message: r.message == null ? null : String(r.message),
		link: r.link == null ? null : String(r.link),
		first_comment: r.first_comment == null ? null : String(r.first_comment),
		media_type: r.media_type ?? "Text",
		status: r.status ?? "LocalDraft",
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
		page_name: r.page_name == null ? void 0 : String(r.page_name)
	};
}
async function listPages$1(userId) {
	return (await (await getSql())`
    select p.*, (p.access_token_enc is not null) as has_token
    from pages p
    where p.user_id = ${userId} and p.is_active = true
    order by p.name
  `).map(mapPage);
}
async function getPage(userId, pageId) {
	const rows = await (await getSql())`
    select p.*, (p.access_token_enc is not null) as has_token
    from pages p
    where p.user_id = ${userId} and p.id = ${pageId}
  `;
	return rows[0] ? mapPage(rows[0]) : null;
}
async function getPageToken(userId, pageId) {
	const rows = await (await getSql())`
    select access_token_enc from pages where user_id = ${userId} and id = ${pageId}
  `;
	return decryptSecret(rows[0]?.access_token_enc);
}
async function listPosts$1(userId, opts = {}) {
	const sql = await getSql();
	const limit = opts.limit ?? 80;
	if (opts.pageId && opts.status) return (await sql`
      select po.*, pa.name as page_name
      from posts po join pages pa on pa.id = po.page_id
      where po.user_id = ${userId} and po.page_id = ${opts.pageId} and po.status = ${opts.status}
      order by coalesce(po.scheduled_publish_time, po.published_time, po.created_at) desc
      limit ${limit}
    `).map(mapPost);
	if (opts.pageId) return (await sql`
      select po.*, pa.name as page_name
      from posts po join pages pa on pa.id = po.page_id
      where po.user_id = ${userId} and po.page_id = ${opts.pageId}
      order by coalesce(po.scheduled_publish_time, po.published_time, po.created_at) desc
      limit ${limit}
    `).map(mapPost);
	if (opts.status) return (await sql`
      select po.*, pa.name as page_name
      from posts po join pages pa on pa.id = po.page_id
      where po.user_id = ${userId} and po.status = ${opts.status}
      order by coalesce(po.scheduled_publish_time, po.published_time, po.created_at) desc
      limit ${limit}
    `).map(mapPost);
	return (await sql`
    select po.*, pa.name as page_name
    from posts po join pages pa on pa.id = po.page_id
    where po.user_id = ${userId}
    order by coalesce(po.scheduled_publish_time, po.published_time, po.created_at) desc
    limit ${limit}
  `).map(mapPost);
}
async function getPost(userId, postId) {
	const rows = await (await getSql())`
    select po.*, pa.name as page_name
    from posts po join pages pa on pa.id = po.page_id
    where po.user_id = ${userId} and po.id = ${postId}
  `;
	return rows[0] ? mapPost(rows[0]) : null;
}
async function listContent(userId, postId) {
	return await (await getSql())`
    select id, post_id, file_name, mime_type, media_kind, file_size, width, height,
           duration_ms, alt_text, data_url, sort_order, created_with_ai
    from content_items
    where user_id = ${userId} and post_id = ${postId}
    order by sort_order
  `;
}
async function cadenceForPage(userId, pageId) {
	const sql = await getSql();
	const pages = await sql`
    select cadence_warn_per_24h, cadence_block_per_24h from pages
    where user_id = ${userId} and id = ${pageId}
  `;
	const warnAt = Number(pages[0]?.cadence_warn_per_24h ?? 8);
	const blockAt = Number(pages[0]?.cadence_block_per_24h ?? 20);
	const counts = await sql`
    select count(*)::int as n from posts
    where user_id = ${userId} and page_id = ${pageId}
      and status in ('Published','Publishing','FacebookScheduled','LocalScheduled')
      and coalesce(published_time, scheduled_publish_time, created_at) > now() - interval '24 hours'
  `;
	const postedLast24h = Number(counts[0]?.n ?? 0);
	return {
		postedLast24h,
		warnAt,
		blockAt,
		level: postedLast24h >= blockAt ? "block" : postedLast24h >= warnAt ? "warn" : "ok"
	};
}
async function listComments(userId, filter, pageId) {
	const sql = await getSql();
	if (pageId && filter === "needs") return (await sql`
      select c.*, po.message as post_message, pa.name as page_name
      from comments c
      join posts po on po.id = c.post_id
      join pages pa on pa.id = po.page_id
      where c.user_id = ${userId} and c.is_from_page = false
        and po.page_id = ${pageId} and c.needs_reply = true and c.is_hidden = false
      order by c.created_at desc limit 120
    `).map(mapComment);
	if (pageId && filter === "hidden") return (await sql`
      select c.*, po.message as post_message, pa.name as page_name
      from comments c
      join posts po on po.id = c.post_id
      join pages pa on pa.id = po.page_id
      where c.user_id = ${userId} and po.page_id = ${pageId} and c.is_hidden = true
      order by c.created_at desc limit 120
    `).map(mapComment);
	if (pageId) return (await sql`
      select c.*, po.message as post_message, pa.name as page_name
      from comments c
      join posts po on po.id = c.post_id
      join pages pa on pa.id = po.page_id
      where c.user_id = ${userId} and po.page_id = ${pageId} and c.is_from_page = false
      order by c.created_at desc limit 120
    `).map(mapComment);
	if (filter === "needs") return (await sql`
      select c.*, po.message as post_message, pa.name as page_name
      from comments c
      join posts po on po.id = c.post_id
      join pages pa on pa.id = po.page_id
      where c.user_id = ${userId} and c.is_from_page = false
        and c.needs_reply = true and c.is_hidden = false
      order by c.created_at desc limit 120
    `).map(mapComment);
	if (filter === "hidden") return (await sql`
      select c.*, po.message as post_message, pa.name as page_name
      from comments c
      join posts po on po.id = c.post_id
      join pages pa on pa.id = po.page_id
      where c.user_id = ${userId} and c.is_hidden = true
      order by c.created_at desc limit 120
    `).map(mapComment);
	return (await sql`
    select c.*, po.message as post_message, pa.name as page_name
    from comments c
    join posts po on po.id = c.post_id
    join pages pa on pa.id = po.page_id
    where c.user_id = ${userId} and c.is_from_page = false
    order by c.created_at desc limit 120
  `).map(mapComment);
}
function mapComment(r) {
	return {
		id: String(r.id),
		facebook_comment_id: r.facebook_comment_id == null ? null : String(r.facebook_comment_id),
		post_id: String(r.post_id),
		message: String(r.message),
		author_name: r.author_name == null ? null : String(r.author_name),
		author_id: r.author_id == null ? null : String(r.author_id),
		sentiment: r.sentiment ?? null,
		needs_reply: asBool(r.needs_reply),
		reply_drafts_json: r.reply_drafts_json == null ? null : String(r.reply_drafts_json),
		is_hidden: asBool(r.is_hidden),
		is_from_page: asBool(r.is_from_page),
		created_at: String(r.created_at),
		post_message: r.post_message == null ? null : String(r.post_message),
		page_name: r.page_name == null ? void 0 : String(r.page_name)
	};
}
async function listMerch(userId, pageId) {
	const sql = await getSql();
	if (pageId) return sql`
      select id, page_id, title, url, platform, utm_template, cta_override, created_at
      from merchandise_links where user_id = ${userId} and page_id = ${pageId}
      order by created_at desc
    `;
	return sql`
    select id, page_id, title, url, platform, utm_template, cta_override, created_at
    from merchandise_links where user_id = ${userId}
    order by created_at desc
  `;
}
async function listVault(userId) {
	return (await (await getSql())`
    select id, name, expires_at, data_access_expires_at, scopes, last_validated_at,
           is_valid, created_at, (long_lived_token_enc is not null) as has_token
    from token_vault where user_id = ${userId} order by created_at desc
  `).map((r) => ({
		id: String(r.id),
		name: String(r.name),
		expires_at: r.expires_at == null ? null : String(r.expires_at),
		data_access_expires_at: r.data_access_expires_at == null ? null : String(r.data_access_expires_at),
		scopes: r.scopes == null ? null : String(r.scopes),
		last_validated_at: r.last_validated_at == null ? null : String(r.last_validated_at),
		is_valid: asBool(r.is_valid),
		created_at: String(r.created_at),
		has_token: asBool(r.has_token)
	}));
}
async function latestQuota(userId) {
	return (await (await getSql())`
    select id, page_id, source_header, call_count_pct, estimated_regain_minutes, captured_at
    from quota_snapshots where user_id = ${userId}
    order by captured_at desc limit 1
  `)[0] ?? null;
}
async function recordQuota(userId, pageId, quota) {
	await (await getSql())`
    insert into quota_snapshots (id, user_id, page_id, source_header, call_count_pct, estimated_regain_minutes)
    values (${randomUUID()}, ${userId}, ${pageId}, ${quota.sourceHeader}, ${quota.callCountPct}, ${quota.estimatedRegainMinutes})
  `;
}
async function recordLog(input) {
	await (await getSql())`
    insert into scheduler_logs (id, user_id, post_id, status, error_message, graph_error_code, http_status_code, duration_ms, request_path)
    values (
      ${randomUUID()}, ${input.userId}, ${input.postId ?? null}, ${input.status},
      ${input.error ?? null}, ${input.graphCode ?? null}, ${input.http ?? null},
      ${input.durationMs ?? null}, ${input.path ?? null}
    )
  `;
}
async function listLogs(userId, limit = 40) {
	return (await getSql())`
    select id, post_id, attempt_time, status, error_message, graph_error_code, http_status_code, duration_ms, request_path
    from scheduler_logs where user_id = ${userId}
    order by attempt_time desc limit ${limit}
  `;
}
async function inboxCount(userId) {
	const rows = await (await getSql())`
    select count(*)::int as n from comments
    where user_id = ${userId} and needs_reply = true and is_hidden = false and is_from_page = false
  `;
	return Number(rows[0]?.n ?? 0);
}
async function searchAll(userId, q) {
	const sql = await getSql();
	const like = `%${q.replace(/%/g, "")}%`;
	return {
		pages: await sql`
    select id, name from pages where user_id = ${userId} and name ilike ${like} limit 8
  `,
		posts: await sql`
    select id, message, status from posts
    where user_id = ${userId} and message ilike ${like}
    order by created_at desc limit 10
  `,
		comments: await sql`
    select id, message, author_name from comments
    where user_id = ${userId} and message ilike ${like}
    order by created_at desc limit 8
  `
	};
}
async function saveAndDispatch(userId, input) {
	const page = await getPage(userId, input.pageId);
	if (!page) throw new Error("Page not found");
	if (page.is_read_only && input.mode !== "local-draft") throw new Error("This Page is analyze-only (no CREATE_CONTENT). Save a local draft instead.");
	const cadence = await cadenceForPage(userId, input.pageId);
	if (input.mode !== "local-draft" && cadence.level === "block") throw new Error(`Cadence hard cap: ${cadence.postedLast24h} posts in 24h (cap ${cadence.blockAt}). Wait before publishing.`);
	if (input.mediaType === "Reel" && input.media?.[0]) {
		const reelErr = validateReel(input.media[0]);
		if (reelErr) throw new Error(reelErr);
	}
	const sql = await getSql();
	const id = randomUUID();
	let status = "LocalDraft";
	let scheduled = input.scheduledAt ?? null;
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
	for (const [i, m] of (input.media ?? []).entries()) await sql`
      insert into content_items (
        id, user_id, post_id, file_name, mime_type, media_kind, file_size, width, height,
        duration_ms, alt_text, data_url, sort_order, created_with_ai
      ) values (
        ${randomUUID()}, ${userId}, ${id}, ${m.fileName}, ${m.mimeType ?? null},
        ${input.mediaType === "Text" ? "Photo" : input.mediaType},
        ${m.dataUrl ? Math.round(m.dataUrl.length * 3 / 4) : null},
        ${m.width ?? null}, ${m.height ?? null}, ${m.durationMs ?? null},
        ${m.altText ?? null}, ${m.dataUrl ?? null}, ${i}, ${Boolean(m.createdWithAi)}
      )
    `;
	if (input.mode === "local-draft") {
		await recordLog({
			userId,
			postId: id,
			status: "saved_local_draft",
			path: "local"
		});
		return {
			id,
			status: "LocalDraft",
			warning: cadence.level === "warn" ? cadenceMessage(cadence) : null
		};
	}
	if (input.mode === "schedule") {
		const when = scheduled ? new Date(scheduled) : null;
		const windowNote = when ? facebookScheduleWindow(when) : "Pick a time.";
		if (windowNote) {
			await recordLog({
				userId,
				postId: id,
				status: "local_schedule",
				error: windowNote,
				path: "local-scheduler"
			});
			return {
				id,
				status: "LocalScheduled",
				warning: windowNote + (cadence.level === "warn" ? ` ${cadenceMessage(cadence)}` : "")
			};
		}
		const result = await attemptGraphPublish(userId, id, "schedule");
		return {
			id,
			status: result.status,
			warning: result.warning ?? (cadence.level === "warn" ? cadenceMessage(cadence) : null)
		};
	}
	if (input.mode === "fb-draft") {
		const result = await attemptGraphPublish(userId, id, "fb-draft");
		return {
			id,
			status: result.status,
			warning: result.warning
		};
	}
	const result = await attemptGraphPublish(userId, id, "now");
	return {
		id,
		status: result.status,
		warning: result.warning ?? (cadence.level === "warn" ? cadenceMessage(cadence) : null)
	};
}
function cadenceMessage(c) {
	return `Cadence warning: ${c.postedLast24h} posts in the last 24h (warn at ${c.warnAt}).`;
}
async function attemptGraphPublish(userId, postId, mode) {
	const sql = await getSql();
	const started = Date.now();
	const post = (await sql`
    select * from posts where user_id = ${userId} and id = ${postId}
  `)[0];
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
			await recordLog({
				userId,
				postId,
				status: "practice_published",
				path: "practice",
				durationMs: Date.now() - started
			});
			return {
				status: "Published",
				warning: "Practice Page — published locally, not sent to Graph."
			};
		}
		if (mode === "schedule") {
			await sql`update posts set status = 'LocalScheduled', updated_at = now() where id = ${postId} and user_id = ${userId}`;
			return {
				status: "LocalScheduled",
				warning: "Practice Page — kept on the local scheduler."
			};
		}
		await sql`update posts set status = 'LocalDraft', updated_at = now() where id = ${postId} and user_id = ${userId}`;
		return {
			status: "LocalDraft",
			warning: "Practice Page — Facebook drafts are not available. Saved locally."
		};
	}
	const appId = await getSetting(userId, "facebook_app_id") ?? "";
	const appSecret = await getSetting(userId, "facebook_app_secret") ?? "";
	const token = await getPageToken(userId, pageId);
	if (!appId || !appSecret || !token) {
		await failPost(userId, postId, "Missing Facebook App credentials or Page token. Reconnect in Settings.", started, "auth");
		return {
			status: "Failed",
			warning: "Reconnect Facebook to publish."
		};
	}
	try {
		const fbPageId = page.facebook_page_id;
		const message = String(post.message ?? "");
		const link = post.link ? String(post.link) : void 0;
		const scheduledUnix = mode === "schedule" && post.scheduled_publish_time ? unixSeconds(new Date(String(post.scheduled_publish_time))) : void 0;
		const payload = buildFeedPublishPayload({
			message,
			link,
			mode,
			scheduledUnix
		});
		if (String(post.media_type) === "Reel" && media[0]?.data_url) await publishReel({
			token,
			appSecret,
			fbPageId,
			media: media[0],
			payload,
			mode,
			scheduledUnix
		});
		else if (String(post.media_type) === "Photo" && media[0]) await graphFetch({
			path: `/${fbPageId}/photos`,
			method: "POST",
			token,
			appSecret,
			form: {
				url: media[0].data_url?.startsWith("http") ? media[0].data_url : void 0,
				caption: message,
				published: payload.published,
				scheduled_publish_time: payload.scheduled_publish_time,
				unpublished_content_type: payload.unpublished_content_type
			}
		});
		else if (String(post.media_type) === "Carousel" && media.length > 0) {
			const ids = [];
			for (const item of media) {
				const uploaded = await graphFetch({
					path: `/${fbPageId}/photos`,
					method: "POST",
					token,
					appSecret,
					form: {
						url: item.data_url?.startsWith("http") ? item.data_url : void 0,
						published: false
					}
				});
				if (uploaded.data.id) ids.push(uploaded.data.id);
			}
			const form = {
				message,
				published: payload.published,
				scheduled_publish_time: payload.scheduled_publish_time,
				unpublished_content_type: payload.unpublished_content_type
			};
			ids.forEach((id, i) => {
				form[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id });
			});
			await graphFetch({
				path: `/${fbPageId}/feed`,
				method: "POST",
				token,
				appSecret,
				form
			});
		} else if (String(post.media_type) === "Video" && media[0]) await graphFetch({
			path: `/${fbPageId}/videos`,
			method: "POST",
			token,
			appSecret,
			form: {
				description: message,
				file_url: media[0].data_url?.startsWith("http") ? media[0].data_url : void 0,
				published: payload.published,
				scheduled_publish_time: payload.scheduled_publish_time
			}
		});
		else if (String(post.media_type) === "Story") {
			if (media[0] && (media[0].media_kind === "Video" || media[0].mime_type?.startsWith("video"))) {
				const start = await graphFetch({
					path: `/${fbPageId}/video_stories`,
					method: "POST",
					token,
					appSecret,
					form: { upload_phase: "start" }
				});
				if (start.data.video_id) await graphFetch({
					path: `/${fbPageId}/video_stories`,
					method: "POST",
					token,
					appSecret,
					form: {
						upload_phase: "finish",
						video_id: start.data.video_id
					}
				});
			} else {
				const photo = await graphFetch({
					path: `/${fbPageId}/photos`,
					method: "POST",
					token,
					appSecret,
					form: {
						url: media[0]?.data_url ?? void 0,
						published: false
					}
				});
				await graphFetch({
					path: `/${fbPageId}/photo_stories`,
					method: "POST",
					token,
					appSecret,
					form: { photo_id: photo.data.id }
				});
			}
		} else await graphFetch({
			path: `/${fbPageId}/feed`,
			method: "POST",
			token,
			appSecret,
			form: { ...payload }
		});
		const nextStatus = mode === "now" ? "Published" : mode === "schedule" ? "FacebookScheduled" : "FacebookDraft";
		await sql`
      update posts set
        status = ${nextStatus},
        published_time = ${mode === "now" ? (/* @__PURE__ */ new Date()).toISOString() : null},
        updated_at = now(),
        error_message = null
      where id = ${postId} and user_id = ${userId}
    `;
		await recordLog({
			userId,
			postId,
			status: `graph_${mode}`,
			path: `/${fbPageId}/feed`,
			durationMs: Date.now() - started
		});
		return {
			status: nextStatus,
			warning: null
		};
	} catch (err) {
		const mapped = err instanceof GraphRequestError ? err.mapped : null;
		if (err instanceof GraphRequestError && err.quota) await recordQuota(userId, pageId, err.quota);
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
				durationMs: Date.now() - started
			});
			return {
				status: "LocalScheduled",
				warning: mapped.message + " Saved on the local scheduler."
			};
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
				durationMs: Date.now() - started
			});
			return {
				status: "LocalDraft",
				warning: "Facebook draft not supported on this Page. Saved locally."
			};
		}
		await failPost(userId, postId, mapped?.message ?? String(err), started, mapped ? String(mapped.code) : "graph", mapped?.code);
		if (mapped?.kind === "token") await sql`update token_vault set is_valid = false where user_id = ${userId}`;
		return {
			status: "Failed",
			warning: mapped?.message ?? String(err)
		};
	}
}
async function publishReel(opts) {
	const videoId = (await graphFetch({
		path: `/${opts.fbPageId}/video_reels`,
		method: "POST",
		token: opts.token,
		appSecret: opts.appSecret,
		form: { upload_phase: "start" }
	})).data.video_id;
	if (!videoId) throw new Error("Reels start did not return video_id");
	const videoState = opts.mode === "now" ? "PUBLISHED" : opts.mode === "schedule" ? "SCHEDULED" : "DRAFT";
	await graphFetch({
		path: `/${opts.fbPageId}/video_reels`,
		method: "POST",
		token: opts.token,
		appSecret: opts.appSecret,
		form: {
			upload_phase: "finish",
			video_id: videoId,
			video_state: videoState,
			scheduled_publish_time: opts.scheduledUnix
		}
	});
}
async function failPost(userId, postId, message, started, path, graphCode) {
	await (await getSql())`
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
		durationMs: Date.now() - started
	});
}
async function tickScheduler(userId) {
	const sql = await getSql();
	const due = await sql`
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
	const dueGraph = await sql`
    select id, scheduled_publish_time from posts
    where user_id = ${userId}
      and status = 'LocalScheduled'
      and scheduled_publish_time is not null
      and scheduled_publish_time > now()
      and scheduled_publish_time < now() + interval '30 days'
      and scheduled_publish_time > now() + interval '10 minutes'
    limit 8
  `;
	for (const row of dueGraph) if (!facebookScheduleWindow(new Date(row.scheduled_publish_time))) {
		await attemptGraphPublish(userId, row.id, "schedule");
		n += 1;
	}
	return n;
}
async function policyForComposer(userId, pageId, message, opts) {
	const recent = await (await getSql())`
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
			engagement: r.reactions_count + r.comments_count + r.shares_count
		}))
	});
}
async function seedPracticeWorkspace(userId) {
	const sql = await getSql();
	const existing = await sql`
    select count(*)::int as n from pages where user_id = ${userId}
  `;
	if (Number(existing[0]?.n ?? 0) > 0) return;
	const nsb = "page-nsb";
	const ww = "page-ww";
	const now = /* @__PURE__ */ new Date();
	const iso = (d) => d.toISOString();
	const hoursAgo = (h) => iso(/* @__PURE__ */ new Date(now.getTime() - h * 36e5));
	const hoursAhead = (h) => iso(new Date(now.getTime() + h * 36e5));
	await sql`
    insert into pages (
      id, user_id, facebook_page_id, name, category, fan_count, tasks_json,
      is_active, is_read_only, is_practice, brand_voice, cadence_warn_per_24h, cadence_block_per_24h
    ) values
    (
      ${nsb}, ${userId}, null, ${"North Shore Books"}, ${"Bookstore"}, ${2847},
      ${JSON.stringify([
		"ANALYZE",
		"ADVERTISE",
		"MODERATE",
		"CREATE_CONTENT",
		"MANAGE"
	])},
      true, false, true,
      ${"Warm independent bookstore on the Mississippi. Specific, bookish, never salesy. Talk like a well-read neighbor in Winona."},
      8, 20
    ),
    (
      ${ww}, ${userId}, null, ${"Winona Weekend"}, ${"Local events"}, ${1204},
      ${JSON.stringify([
		"ANALYZE",
		"CREATE_CONTENT",
		"MODERATE"
	])},
      true, false, true,
      ${"Upbeat local events desk. Short, useful, time-and-place first. No FOMO theatrics."},
      8, 20
    )
  `;
	const posts = [
		{
			id: "p-story",
			page: nsb,
			message: "Saturday story hour is back at 10:30. Picture books on the river rug, cider for grown-ups, and a quiet corner if you just need a chair and a hardcover. Bring a neighbor.",
			status: "Published",
			media: "Photo",
			published: hoursAgo(30),
			reactions: 86,
			comments: 12,
			shares: 9,
			views: 1420
		},
		{
			id: "p-arrivals",
			page: nsb,
			message: "New arrivals from Minnesota authors landed this morning — Louise Erdrich reprints, a slim Winona history, and the cookbook that made our staff fight over the galley. Come browse before they walk.",
			status: "Published",
			media: "Carousel",
			published: hoursAgo(78),
			reactions: 54,
			comments: 7,
			shares: 4,
			views: 980
		},
		{
			id: "p-staff",
			page: nsb,
			message: "Staff pick Tuesday: a novel that starts on a train and ends in a kitchen you will want to stand in. Ask Maya at the desk — she will put it in your hands.",
			status: "LocalScheduled",
			media: "Text",
			scheduled: hoursAhead(18),
			reactions: 0,
			comments: 0,
			shares: 0,
			variant: "Storytelling"
		},
		{
			id: "p-hours",
			page: nsb,
			message: "Holiday hours draft — open 10–6 through Christmas Eve, closed Christmas Day, back December 26. Need a photo of the front window display.",
			status: "LocalDraft",
			media: "Text",
			reactions: 0,
			comments: 0,
			shares: 0
		},
		{
			id: "p-fail",
			page: nsb,
			message: "Flash sale on totes — 20% off this weekend only. Grab one with your next stack.",
			status: "Failed",
			media: "Photo",
			reactions: 0,
			comments: 0,
			shares: 0,
			error: "Graph 100: unpublished_content_type is not available on this Page. Saved as a local draft instead."
		},
		{
			id: "p-farmers",
			page: ww,
			message: "Saturday market on 2nd Street, 8–noon. Live fiddle at 9, leftover bread at 11. Street parking fills by 8:15 — bike if you can.",
			status: "Published",
			media: "Photo",
			published: hoursAgo(20),
			reactions: 41,
			comments: 6,
			shares: 11,
			views: 760
		},
		{
			id: "p-show",
			page: ww,
			message: "Thursday at the winery: two local bands, doors 7, music 8. Tickets at the door, cash or card. If you are bringing a dog, keep them on the lawn side.",
			status: "FacebookScheduled",
			media: "Text",
			scheduled: hoursAhead(52),
			reactions: 0,
			comments: 0,
			shares: 0
		},
		{
			id: "p-cta",
			page: nsb,
			message: "Need a gift that actually gets opened? Our Winona tote is restocked — heavy canvas, one pocket, no logo scream. In store or via the shop link.",
			status: "Published",
			media: "Photo",
			published: hoursAgo(120),
			reactions: 33,
			comments: 5,
			shares: 2,
			views: 610,
			link: "https://northshorebooks.example/tote",
			variant: "Direct CTA"
		}
	];
	for (const p of posts) {
		const score = p.reactions + p.comments * 2 + p.shares * 3 + (p.views ?? 0) * .01;
		await sql`
      insert into posts (
        id, user_id, page_id, message, link, media_type, status,
        scheduled_publish_time, published_time, created_by_this_app, ai_variant_label,
        engagement_score, reactions_count, comments_count, shares_count, media_view_unique,
        error_message, created_at, updated_at
      ) values (
        ${p.id}, ${userId}, ${p.page}, ${p.message}, ${p.link ?? null}, ${p.media}, ${p.status},
        ${p.scheduled ?? null}, ${p.published ?? null}, true, ${p.variant ?? null},
        ${score}, ${p.reactions}, ${p.comments}, ${p.shares}, ${p.views ?? null},
        ${p.error ?? null}, ${p.published ?? p.scheduled ?? hoursAgo(2)}, now()
      )
    `;
	}
	await sql`
    insert into content_items (id, user_id, post_id, file_name, mime_type, media_kind, width, height, alt_text, sort_order)
    values
      (${randomUUID()}, ${userId}, ${"p-story"}, ${"story-hour.jpg"}, ${"image/jpeg"}, ${"Photo"}, 1200, 900, ${"Children sitting on a river-blue rug during story hour"}, 0),
      (${randomUUID()}, ${userId}, ${"p-arrivals"}, ${"stack-1.jpg"}, ${"image/jpeg"}, ${"Photo"}, 1000, 1000, ${"Stack of new Minnesota titles"}, 0),
      (${randomUUID()}, ${userId}, ${"p-arrivals"}, ${"stack-2.jpg"}, ${"image/jpeg"}, ${"Photo"}, 1000, 1000, ${"Cookbook galley on oak table"}, 1),
      (${randomUUID()}, ${userId}, ${"p-farmers"}, ${"market.jpg"}, ${"image/jpeg"}, ${"Photo"}, 1600, 900, ${"Second Street market stalls on a clear Saturday"}, 0),
      (${randomUUID()}, ${userId}, ${"p-cta"}, ${"tote.jpg"}, ${"image/jpeg"}, ${"Photo"}, 1000, 1000, ${"Heavy canvas tote on the shop counter"}, 0)
  `;
	await sql`
    insert into merchandise_links (id, user_id, page_id, title, url, platform, utm_template, cta_override)
    values
      (${randomUUID()}, ${userId}, ${nsb}, ${"Winona canvas tote"}, ${"https://northshorebooks.example/tote"}, ${"Shopify"}, ${"utm_source=facebook&utm_medium=page&utm_campaign={slug}"}, ${"Get the tote"}),
      (${randomUUID()}, ${userId}, ${nsb}, ${"Staff-pick subscription"}, ${"https://northshorebooks.example/club"}, ${"Own store"}, ${"utm_source=facebook&utm_medium=page"}, ${"Join the club"})
  `;
	for (const c of [
		{
			post: "p-story",
			author: "Priya N.",
			msg: "What time is story hour again — is it every Saturday?",
			hours: 28,
			needs: true
		},
		{
			post: "p-story",
			author: "Mark T.",
			msg: "We came last week and it was lovely. Thank you for the cider.",
			hours: 26,
			needs: false
		},
		{
			post: "p-arrivals",
			author: "Elena R.",
			msg: "Do you have the new Louise Erdrich, or is it already gone?",
			hours: 70,
			needs: true
		},
		{
			post: "p-cta",
			author: "Sam K.",
			msg: "Is the tote machine-washable? Need one that survives the river path.",
			hours: 100,
			needs: true
		},
		{
			post: "p-farmers",
			author: "Jordan P.",
			msg: "Will there be the honey stall this week?",
			hours: 18,
			needs: true
		},
		{
			post: "p-arrivals",
			author: "spam-bot",
			msg: "MAKE $5000 A DAY click this sketchy link!!!",
			hours: 71,
			needs: false,
			hidden: true
		}
	]) {
		const drafts = c.needs ? JSON.stringify([
			`Hi ${c.author.split(" ")[0]}, thanks for asking — I'll confirm and reply with the details.`,
			`Great question. Stop by the desk or reply here and we'll sort it out.`,
			`Appreciate you writing in. Let me check stock/hours and get right back to you.`
		]) : null;
		await sql`
      insert into comments (
        id, user_id, post_id, message, author_name, sentiment, needs_reply, reply_drafts_json, is_hidden, created_at
      ) values (
        ${randomUUID()}, ${userId}, ${c.post}, ${c.msg}, ${c.author},
        ${localSentiment(c.msg)}, ${c.needs}, ${drafts}, ${Boolean(c.hidden)},
        ${hoursAgo(c.hours)}
      )
    `;
	}
	await sql`
    insert into quota_snapshots (id, user_id, page_id, source_header, call_count_pct, estimated_regain_minutes)
    values (${randomUUID()}, ${userId}, ${nsb}, ${"X-Business-Use-Case-Usage (practice)"}, ${12}, ${0})
  `;
}
function originFromRequest() {
	if (typeof process !== "undefined" && process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL.replace(/\/$/, "");
	return "";
}
async function bootstrapApp(userId) {
	const host = process.env.VITE_PUBLIC_HOSTNAME;
	const settings = await loadSettings(userId, host ? `https://${host}` : originFromRequest() || "https://localhost");
	const pages = await listPages$1(userId);
	const recentPosts = await listPosts$1(userId, { limit: 12 });
	const dueSoon = (await listPosts$1(userId, { limit: 40 })).filter((p) => p.status === "LocalScheduled" || p.status === "FacebookScheduled");
	const quota = await latestQuota(userId);
	const inbox = await inboxCount(userId);
	try {
		await tickScheduler(userId);
	} catch {}
	return {
		pages,
		recentPosts,
		dueSoon: dueSoon.slice(0, 8),
		inboxCount: inbox,
		quota,
		settings
	};
}
async function getSettings(userId) {
	const host = process.env.VITE_PUBLIC_HOSTNAME;
	return loadSettings(userId, host ? `https://${host}` : originFromRequest() || "http://localhost:8080");
}
async function saveFacebookApp(userId, data) {
	await setSetting(userId, "facebook_app_id", data.appId.trim(), false);
	if (data.appSecret.trim()) await setSetting(userId, "facebook_app_secret", data.appSecret.trim(), true);
	return { ok: true };
}
async function savePrefs(userId, data) {
	if (data.theme) await setSetting(userId, "theme", data.theme, false);
	if (data.defaultPageId !== void 0) await setSetting(userId, "default_page_id", data.defaultPageId, false);
	if (data.cadenceWarn) await setSetting(userId, "cadence_warn", String(data.cadenceWarn), false);
	if (data.cadenceBlock) await setSetting(userId, "cadence_block", String(data.cadenceBlock), false);
	if (data.cadenceWarn || data.cadenceBlock) await (await getSql())`
      update pages set
        cadence_warn_per_24h = coalesce(${data.cadenceWarn ?? null}, cadence_warn_per_24h),
        cadence_block_per_24h = coalesce(${data.cadenceBlock ?? null}, cadence_block_per_24h)
      where user_id = ${userId}
    `;
	return { ok: true };
}
async function completeSetup(userId) {
	await setSetting(userId, "setup_complete", "1", false);
	return { ok: true };
}
async function startPractice(userId) {
	await seedPracticeWorkspace(userId);
	await setSetting(userId, "setup_complete", "1", false);
	return { ok: true };
}
async function beginFacebookOAuth(userId, redirectUri) {
	const appId = await getSetting(userId, "facebook_app_id");
	if (!appId) throw new Error("Enter your Facebook App ID first.");
	const state = randomBytes(24).toString("hex");
	await (await getSql())`
    insert into oauth_states (state, user_id, expires_at)
    values (${state}, ${userId}, now() + interval '15 minutes')
  `;
	return {
		url: buildAuthorizeUrl({
			clientId: appId,
			redirectUri,
			state
		}),
		state,
		version: GRAPH_VERSION,
		scopes: [...REQUIRED_SCOPES]
	};
}
var listPages = listPages$1;
var listPosts = listPosts$1;
async function getPostBundle(userId, postId) {
	const post = await getPost(userId, postId);
	if (!post) return null;
	return {
		post,
		media: await listContent(userId, postId)
	};
}
var cadence = cadenceForPage;
async function policy(userId, data) {
	return policyForComposer(userId, data.pageId, data.message, data);
}
async function compose(userId, data) {
	return saveAndDispatch(userId, data);
}
async function reschedule(userId, data) {
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
	await recordLog({
		userId,
		postId: data.postId,
		status: "rescheduled",
		error: windowNote,
		path: "calendar"
	});
	return {
		status: nextStatus,
		warning: windowNote
	};
}
async function cancelPost(userId, postId) {
	const sql = await getSql();
	const post = await getPost(userId, postId);
	if (!post) throw new Error("Post not found");
	if (post.facebook_post_id && post.created_by_this_app && !post.facebook_post_id.startsWith("practice_")) try {
		const token = await getPageToken(userId, post.page_id);
		const secret = await getSetting(userId, "facebook_app_secret");
		if (token && secret) await graphFetch({
			path: `/${post.facebook_post_id}`,
			method: "DELETE",
			token,
			appSecret: secret
		});
	} catch (e) {
		await recordLog({
			userId,
			postId,
			status: "delete_failed",
			error: e instanceof Error ? e.message : String(e)
		});
	}
	await sql`update posts set status = 'Cancelled', updated_at = now() where id = ${postId} and user_id = ${userId}`;
	return { ok: true };
}
async function comments(userId, filter, pageId) {
	return listComments(userId, filter, pageId);
}
async function hideComment(userId, data) {
	await (await getSql())`
    update comments set is_hidden = ${data.hidden}, needs_reply = false
    where id = ${data.commentId} and user_id = ${userId}
  `;
	return { ok: true };
}
async function sendReply(userId, data) {
	const message = data.message.trim();
	if (!message) throw new Error("Reply is empty");
	const sql = await getSql();
	const comment = (await sql`
    select id, facebook_comment_id, post_id from comments
    where id = ${data.commentId} and user_id = ${userId}
  `)[0];
	if (!comment) throw new Error("Comment not found");
	const post = await getPost(userId, comment.post_id);
	if (post && comment.facebook_comment_id && !comment.facebook_comment_id.startsWith("practice")) {
		const token = await getPageToken(userId, post.page_id);
		const secret = await getSetting(userId, "facebook_app_secret");
		if (token && secret) try {
			await graphFetch({
				path: `/${comment.facebook_comment_id}/comments`,
				method: "POST",
				token,
				appSecret: secret,
				form: { message }
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
	await recordLog({
		userId,
		postId: comment.post_id,
		status: "reply_sent",
		path: "inbox"
	});
	return { ok: true };
}
async function generateReplyDrafts(userId, commentId) {
	const sql = await getSql();
	const row = (await sql`
    select message, post_id from comments where id = ${commentId} and user_id = ${userId}
  `)[0];
	if (!row) throw new Error("Comment not found");
	const post = await getPost(userId, row.post_id);
	const page = post ? await getPage(userId, post.page_id) : null;
	let drafts;
	if (aiAvailable()) drafts = await draftReplies({
		comment: row.message,
		brandVoice: page?.brand_voice,
		pageName: page?.name ?? "Page"
	});
	else drafts = [
		"Thanks for writing in — we saw this and will follow up with the details.",
		"Appreciate the question. Stop by the desk or reply here and we'll sort it out.",
		"Good catch. Let me confirm and get back to you."
	];
	await sql`
    update comments set reply_drafts_json = ${JSON.stringify(drafts)}, sentiment = ${localSentiment(row.message)}
    where id = ${commentId} and user_id = ${userId}
  `;
	return {
		drafts,
		ai: aiAvailable()
	};
}
var merch = listMerch;
async function saveMerch(userId, data) {
	await (await getSql())`
    insert into merchandise_links (id, user_id, page_id, title, url, platform, utm_template, cta_override)
    values (${randomUUID()}, ${userId}, ${data.pageId}, ${data.title}, ${data.url}, ${data.platform ?? null}, ${data.utm ?? null}, ${data.cta ?? null})
  `;
	return { ok: true };
}
async function deleteMerch(userId, id) {
	await (await getSql())`delete from merchandise_links where id = ${id} and user_id = ${userId}`;
	return { ok: true };
}
var vault = listVault;
var logs = listLogs;
async function search(userId, q) {
	return searchAll(userId, q.trim());
}
async function analytics(userId, data) {
	const sql = await getSql();
	const days = data.days === 7 || data.days === 90 ? data.days : 28;
	const window = days === 7 ? "7 days" : days === 90 ? "90 days" : "28 days";
	const raw = data.pageId ? await sql`
        select id, message, published_time, created_at, reactions_count, comments_count,
               shares_count, media_view_unique, ai_variant_label, variant_group_id
        from posts
        where user_id = ${userId} and page_id = ${data.pageId}
          and status = 'Published'
          and coalesce(published_time, created_at) > now() - ${window}::interval
        order by coalesce(published_time, created_at)
      ` : await sql`
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
		days
	};
}
async function mediaLibrary(userId, pageId) {
	const sql = await getSql();
	return pageId ? await sql`
        select ci.id, ci.file_name, ci.media_kind, ci.alt_text, ci.data_url, pa.name as page_name, ci.mime_type
        from content_items ci
        join posts po on po.id = ci.post_id
        join pages pa on pa.id = po.page_id
        where ci.user_id = ${userId} and po.page_id = ${pageId}
        order by ci.created_at desc
        limit 80
      ` : await sql`
        select ci.id, ci.file_name, ci.media_kind, ci.alt_text, ci.data_url, pa.name as page_name, ci.mime_type
        from content_items ci
        join posts po on po.id = ci.post_id
        join pages pa on pa.id = po.page_id
        where ci.user_id = ${userId}
        order by ci.created_at desc
        limit 80
      `;
}
async function generateVariants(userId, data) {
	const page = await getPage(userId, data.pageId);
	if (!page) throw new Error("Page not found");
	if (!aiAvailable()) return {
		ai: false,
		storytelling: `${data.brief.trim()}\n\nA quiet afternoon in the shop. Come by if you want to talk about it.`,
		cta: `${data.brief.trim()}\n\nDetails on the Page — tap through when you're ready.`,
		question: `${data.brief.trim()}\n\nWhat would you add? Tell us in the comments.`
	};
	return {
		ai: true,
		...await generateCaptionVariants({
			brief: data.brief,
			brandVoice: page.brand_voice,
			pageName: page.name,
			merchCta: data.merchCta
		})
	};
}
async function hashtags(userId, data) {
	const page = await getPage(userId, data.pageId);
	if (!aiAvailable()) return {
		tags: data.caption.toLowerCase().split(/\W+/).filter((w) => w.length > 4).slice(0, 4).map((w) => `#${w}`),
		ai: false
	};
	return {
		tags: await suggestHashtags({
			caption: data.caption,
			brandVoice: page?.brand_voice,
			pageName: page?.name ?? "Page"
		}),
		ai: true
	};
}
async function analyze(content) {
	if (!aiAvailable()) return {
		sentiment: localSentiment(content),
		topics: [],
		riskFlags: [],
		suggestedHashtags: [],
		ai: false
	};
	return {
		...await analyzeContent(content),
		ai: true
	};
}
async function updatePageVoice(userId, data) {
	await (await getSql())`
    update pages set brand_voice = ${data.brandVoice}, updated_at = now()
    where id = ${data.pageId} and user_id = ${userId}
  `;
	return { ok: true };
}
async function exportCsv(userId, data) {
	return "id,published,message,reactions,comments,shares,media_views,variant\n" + (await analytics(userId, data)).rows.map((r) => {
		const msg = String(r.message ?? "").replaceAll("\"", "\"\"");
		return [
			r.id,
			r.published_time ?? r.created_at,
			`"${msg}"`,
			r.reactions_count,
			r.comments_count,
			r.shares_count,
			r.media_view_unique ?? "",
			r.ai_variant_label ?? ""
		].join(",");
	}).join("\n");
}
async function tick(userId) {
	return { ran: await tickScheduler(userId) };
}
async function calendar(userId, pageId) {
	const sql = await getSql();
	return (pageId ? await sql`
        select po.id, po.page_id, pa.name as page_name, po.message, po.status, po.media_type,
               po.scheduled_publish_time, po.published_time, po.created_at,
               po.reactions_count, po.comments_count, po.engagement_score
        from posts po join pages pa on pa.id = po.page_id
        where po.user_id = ${userId} and po.page_id = ${pageId} and po.status not in ('Cancelled')
        order by coalesce(po.scheduled_publish_time, po.published_time, po.created_at)
      ` : await sql`
        select po.id, po.page_id, pa.name as page_name, po.message, po.status, po.media_type,
               po.scheduled_publish_time, po.published_time, po.created_at,
               po.reactions_count, po.comments_count, po.engagement_score
        from posts po join pages pa on pa.id = po.page_id
        where po.user_id = ${userId} and po.status not in ('Cancelled')
        order by coalesce(po.scheduled_publish_time, po.published_time, po.created_at)
      `).map((r) => ({
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
		engagement_score: r.engagement_score == null ? 0 : Number(r.engagement_score)
	}));
}
//#endregion
export { analytics, analyze, beginFacebookOAuth, bootstrapApp, cadence, calendar, cancelPost, comments, completeSetup, compose, deleteMerch, exportCsv, generateReplyDrafts, generateVariants, getPostBundle, getSettings, hashtags, hideComment, listPages, listPosts, logs, mediaLibrary, merch, policy, reschedule, saveFacebookApp, saveMerch, savePrefs, search, sendReply, startPractice, tick, updatePageVoice, vault };
