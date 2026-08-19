import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";
//#region node_modules/.nitro/vite/services/ssr/assets/crypto-DpPosqIC.js
var GRAPH_VERSION = "v26.0";
var GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
var OAUTH_DIALOG = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;
var REQUIRED_SCOPES = [
	"pages_show_list",
	"pages_read_engagement",
	"pages_manage_posts",
	"pages_manage_engagement",
	"pages_read_user_content",
	"pages_manage_metadata",
	"read_insights",
	"publish_video"
];
function appSecretProof(accessToken, appSecret) {
	return createHmac("sha256", appSecret).update(accessToken).digest("hex");
}
function buildAuthorizeUrl(opts) {
	return `${OAUTH_DIALOG}?${new URLSearchParams({
		client_id: opts.clientId,
		redirect_uri: opts.redirectUri,
		state: opts.state,
		response_type: "code",
		scope: REQUIRED_SCOPES.join(",")
	}).toString()}`;
}
function mapGraphError(input) {
	const code = input.code ?? 0;
	const message = input.message ?? `Graph error ${input.httpStatus}`;
	if (code === 190) return {
		code,
		message,
		kind: "token",
		retryable: false
	};
	if (code === 200) return {
		code,
		message,
		kind: "permission",
		retryable: false
	};
	if (code === 4 || code === 17 || code === 32 || code === 613 || code === 80001) return {
		code,
		message,
		kind: "rate_limit",
		retryable: true
	};
	if (code === 368) return {
		code,
		message,
		kind: "abusive",
		retryable: false
	};
	if (code === 100) return {
		code,
		message,
		kind: "invalid_param",
		retryable: false
	};
	if (code === 1 && /schedul/i.test(message)) return {
		code,
		message,
		kind: "unknown_schedule",
		retryable: false
	};
	if (input.httpStatus >= 500 || input.httpStatus === 429) return {
		code,
		message,
		kind: "server",
		retryable: true
	};
	return {
		code,
		message,
		kind: "other",
		retryable: false
	};
}
function parseUsageHeaders(headers) {
	const buc = headers.get("x-business-use-case-usage") ?? headers.get("X-Business-Use-Case-Usage");
	const app = headers.get("x-app-usage") ?? headers.get("X-App-Usage");
	const raw = buc ?? app;
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw);
		let callCountPct = null;
		let estimatedRegainMinutes = null;
		const inspect = (obj) => {
			if (!obj || typeof obj !== "object") return;
			const rec = obj;
			const call = rec.call_count ?? rec.callCount;
			if (typeof call === "number") callCountPct = call;
			const eta = rec.estimated_time_to_regain_access ?? rec.estimatedTimeToRegainAccess;
			if (typeof eta === "number") estimatedRegainMinutes = eta;
		};
		if (Array.isArray(parsed)) parsed.forEach(inspect);
		else if (parsed && typeof parsed === "object") {
			for (const v of Object.values(parsed)) if (Array.isArray(v)) v.forEach(inspect);
			else inspect(v);
			inspect(parsed);
		}
		return {
			sourceHeader: buc ? "X-Business-Use-Case-Usage" : "X-App-Usage",
			callCountPct,
			estimatedRegainMinutes
		};
	} catch {
		return {
			sourceHeader: raw.slice(0, 180),
			callCountPct: null,
			estimatedRegainMinutes: null
		};
	}
}
function buildFeedPublishPayload(opts) {
	const fields = {
		message: opts.message,
		published: true
	};
	if (opts.link) fields.link = opts.link;
	if (opts.mode === "now") {
		fields.published = true;
		return fields;
	}
	if (opts.mode === "schedule") {
		fields.published = false;
		if (opts.scheduledUnix) fields.scheduled_publish_time = opts.scheduledUnix;
		return fields;
	}
	fields.published = false;
	fields.unpublished_content_type = "DRAFT";
	return fields;
}
function facebookScheduleWindow(when, now = /* @__PURE__ */ new Date()) {
	const min = now.getTime() + 6e5;
	const max = now.getTime() + 2592e6;
	const t = when.getTime();
	if (t < min) return "Facebook only accepts schedules 10 minutes or more in the future. This will stay on the local scheduler.";
	if (t > max) return "Facebook only accepts schedules within 30 days. This will stay on the local scheduler.";
	return null;
}
var GraphRequestError = class extends Error {
	mapped;
	quota;
	constructor(mapped, quota) {
		super(mapped.message);
		this.name = "GraphRequestError";
		this.mapped = mapped;
		this.quota = quota;
	}
};
async function sleep(ms) {
	await new Promise((r) => setTimeout(r, ms));
}
async function graphFetch(opts) {
	const proof = appSecretProof(opts.token, opts.appSecret);
	const url = new URL(opts.path.startsWith("http") ? opts.path : `${GRAPH_BASE}${opts.path.startsWith("/") ? "" : "/"}${opts.path}`);
	url.searchParams.set("access_token", opts.token);
	url.searchParams.set("appsecret_proof", proof);
	if (opts.query) {
		for (const [k, v] of Object.entries(opts.query)) if (v !== void 0) url.searchParams.set(k, String(v));
	}
	let body;
	const headers = { ...opts.headers ?? {} };
	if (opts.form) {
		const fd = new URLSearchParams();
		for (const [k, v] of Object.entries(opts.form)) if (v !== void 0) fd.set(k, String(v));
		body = fd;
		headers["content-type"] ??= "application/x-www-form-urlencoded";
	} else if (opts.body !== void 0 && opts.body !== null) body = opts.body;
	const method = opts.method ?? (body ? "POST" : "GET");
	let lastError = null;
	for (let attempt = 0; attempt < 5; attempt += 1) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 1e5);
		const onAbort = () => controller.abort();
		opts.signal?.addEventListener("abort", onAbort);
		try {
			const res = await fetch(url, {
				method,
				headers,
				body,
				signal: controller.signal
			});
			const quota = parseUsageHeaders(res.headers);
			const text = await res.text();
			let json = {};
			try {
				json = text ? JSON.parse(text) : {};
			} catch {
				json = { error: {
					message: text.slice(0, 400),
					code: res.status
				} };
			}
			if (!res.ok || json.error) {
				const mapped = mapGraphError({
					httpStatus: res.status,
					code: json.error?.code,
					errorSubcode: json.error?.error_subcode,
					message: json.error?.message
				});
				const err = new GraphRequestError(mapped, quota);
				if (mapped.retryable && attempt < 4) {
					lastError = err;
					await sleep(400 * 2 ** attempt);
					continue;
				}
				throw err;
			}
			return {
				data: json,
				quota,
				status: res.status
			};
		} catch (e) {
			if (e instanceof GraphRequestError) throw e;
			if (attempt < 4) {
				await sleep(400 * 2 ** attempt);
				continue;
			}
			throw lastError ?? e;
		} finally {
			clearTimeout(timer);
			opts.signal?.removeEventListener("abort", onAbort);
		}
	}
	throw lastError ?? /* @__PURE__ */ new Error("Graph request failed");
}
function unixSeconds(d) {
	return Math.floor(d.getTime() / 1e3);
}
function keyBytes() {
	const material = process.env.BETTER_AUTH_SECRET || process.env.GROK_AUTH_CLIENT_SECRET || "bookboss-preview-entropy-not-a-secret";
	return createHash("sha256").update(material).update("bookboss.dpapi.standin").digest();
}
/** AES-256-GCM stand-in for DPAPI CurrentUser. Tokens never leave ciphertext in the DB. */
function encryptSecret(plain) {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", keyBytes(), iv);
	const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
	const tag = cipher.getAuthTag();
	return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}
function decryptSecret(payload) {
	if (!payload) return null;
	const parts = payload.split(".");
	if (parts.length !== 4 || parts[0] !== "v1") return null;
	try {
		const iv = Buffer.from(parts[1], "base64url");
		const tag = Buffer.from(parts[2], "base64url");
		const data = Buffer.from(parts[3], "base64url");
		const decipher = createDecipheriv("aes-256-gcm", keyBytes(), iv);
		decipher.setAuthTag(tag);
		return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
	} catch {
		return null;
	}
}
//#endregion
export { buildAuthorizeUrl as a, encryptSecret as c, unixSeconds as d, REQUIRED_SCOPES as i, facebookScheduleWindow as l, GRAPH_VERSION as n, buildFeedPublishPayload as o, GraphRequestError as r, decryptSecret as s, GRAPH_BASE as t, graphFetch as u };
