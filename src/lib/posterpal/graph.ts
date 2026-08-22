import { createHmac } from "node:crypto";
import {
  GRAPH_BASE,
  GRAPH_VERSION,
  OAUTH_DIALOG,
  REQUIRED_SCOPES,
  RUPLOAD_BASE,
} from "./constants";

export {
  GRAPH_BASE,
  GRAPH_VERSION,
  OAUTH_DIALOG,
  REQUIRED_SCOPES,
  RUPLOAD_BASE,
};

export function appSecretProof(accessToken: string, appSecret: string): string {
  return createHmac("sha256", appSecret).update(accessToken).digest("hex");
}

export function buildAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    state: opts.state,
    response_type: "code",
    display: "popup",
    auth_type: "rerequest",
    scope: REQUIRED_SCOPES.join(","),
  });
  return `${OAUTH_DIALOG}?${params.toString()}`;
}

export type GraphErrorMapped = {
  code: number;
  subcode?: number;
  message: string;
  kind:
    | "token"
    | "permission"
    | "rate_limit"
    | "abusive"
    | "invalid_param"
    | "unknown_schedule"
    | "server"
    | "other";
  retryable: boolean;
};

export function mapGraphError(input: {
  httpStatus: number;
  code?: number;
  errorSubcode?: number;
  message?: string;
}): GraphErrorMapped {
  const code = input.code ?? 0;
  const message = input.message ?? `Graph error ${input.httpStatus}`;
  if (code === 190) return { code, message, kind: "token", retryable: false };
  if (code === 200) return { code, message, kind: "permission", retryable: false };
  if (code === 4 || code === 17 || code === 32 || code === 613 || code === 80001) {
    return { code, message, kind: "rate_limit", retryable: true };
  }
  if (code === 368) return { code, message, kind: "abusive", retryable: false };
  if (code === 100) return { code, message, kind: "invalid_param", retryable: false };
  if (code === 1 && /schedul/i.test(message)) {
    return { code, message, kind: "unknown_schedule", retryable: false };
  }
  if (input.httpStatus >= 500 || input.httpStatus === 429) {
    return { code, message, kind: "server", retryable: true };
  }
  return { code, message, kind: "other", retryable: false };
}

export type QuotaParse = {
  sourceHeader: string;
  callCountPct: number | null;
  estimatedRegainMinutes: number | null;
};

export function parseUsageHeaders(headers: Headers): QuotaParse | null {
  const buc = headers.get("x-business-use-case-usage") ?? headers.get("X-Business-Use-Case-Usage");
  const app = headers.get("x-app-usage") ?? headers.get("X-App-Usage");
  const raw = buc ?? app;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    let callCountPct: number | null = null;
    let estimatedRegainMinutes: number | null = null;
    const inspect = (obj: unknown) => {
      if (!obj || typeof obj !== "object") return;
      const rec = obj as Record<string, unknown>;
      const call = rec.call_count ?? rec.callCount;
      if (typeof call === "number") callCountPct = call;
      const eta = rec.estimated_time_to_regain_access ?? rec.estimatedTimeToRegainAccess;
      if (typeof eta === "number") estimatedRegainMinutes = eta;
    };
    if (Array.isArray(parsed)) parsed.forEach(inspect);
    else if (parsed && typeof parsed === "object") {
      for (const v of Object.values(parsed as Record<string, unknown>)) {
        if (Array.isArray(v)) v.forEach(inspect);
        else inspect(v);
      }
      inspect(parsed);
    }
    return {
      sourceHeader: buc ? "X-Business-Use-Case-Usage" : "X-App-Usage",
      callCountPct,
      estimatedRegainMinutes,
    };
  } catch {
    return { sourceHeader: raw.slice(0, 180), callCountPct: null, estimatedRegainMinutes: null };
  }
}

export type PublishMode = "now" | "schedule" | "fb-draft";

export type FeedPublishFields = {
  message?: string;
  link?: string;
  published: boolean;
  scheduled_publish_time?: number;
  unpublished_content_type?: "DRAFT";
};

export function buildFeedPublishPayload(opts: {
  message: string;
  link?: string | null;
  mode: PublishMode;
  scheduledUnix?: number | null;
}): FeedPublishFields {
  const fields: FeedPublishFields = { message: opts.message, published: true };
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
  // Official Pages API: an unpublished draft is published=false with NO schedule.
  // unpublished_content_type=DRAFT is not the documented path and often returns Graph 100.
  fields.published = false;
  return fields;
}

export function facebookScheduleWindow(when: Date, now = new Date()): string | null {
  const min = now.getTime() + 10 * 60 * 1000;
  const max = now.getTime() + 30 * 24 * 60 * 60 * 1000;
  const t = when.getTime();
  if (t < min) return "Facebook only accepts schedules 10 minutes or more in the future. This will stay on the local scheduler.";
  if (t > max) return "Facebook only accepts schedules within 30 days. This will stay on the local scheduler.";
  return null;
}

type GraphJson = {
  error?: { message?: string; code?: number; error_subcode?: number; type?: string };
  id?: string;
  post_id?: string;
  video_id?: string;
  upload_url?: string;
  [key: string]: unknown;
};

export class GraphRequestError extends Error {
  readonly mapped: GraphErrorMapped;
  readonly quota: QuotaParse | null;
  constructor(mapped: GraphErrorMapped, quota: QuotaParse | null) {
    super(mapped.message);
    this.name = "GraphRequestError";
    this.mapped = mapped;
    this.quota = quota;
  }
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

function graphUrl(path: string, token: string, appSecret: string, query?: Record<string, string | number | boolean | undefined>) {
  const url = new URL(path.startsWith("http") ? path : `${GRAPH_BASE}${path.startsWith("/") ? "" : "/"}${path}`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("appsecret_proof", appSecretProof(token, appSecret));
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return url;
}

async function parseGraphResponse(res: Response): Promise<{ json: GraphJson; quota: QuotaParse | null }> {
  const quota = parseUsageHeaders(res.headers);
  const text = await res.text();
  let json: GraphJson = {};
  try {
    json = text ? (JSON.parse(text) as GraphJson) : {};
  } catch {
    json = { error: { message: text.slice(0, 400), code: res.status } };
  }
  if (!res.ok || json.error) {
    const mapped = mapGraphError({
      httpStatus: res.status,
      code: json.error?.code,
      errorSubcode: json.error?.error_subcode,
      message: json.error?.message,
    });
    throw new GraphRequestError(mapped, quota);
  }
  return { json, quota };
}

export async function graphFetch<T = GraphJson>(opts: {
  path: string;
  method?: string;
  token: string;
  appSecret: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: BodyInit | null;
  headers?: Record<string, string>;
  form?: Record<string, string | number | boolean | undefined>;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<{ data: T; quota: QuotaParse | null; status: number }> {
  const url = graphUrl(opts.path, opts.token, opts.appSecret, opts.query);

  let body: BodyInit | undefined;
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.form) {
    const fd = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.form)) {
      if (v !== undefined) fd.set(k, String(v));
    }
    body = fd;
    headers["content-type"] ??= "application/x-www-form-urlencoded";
  } else if (opts.body !== undefined && opts.body !== null) {
    body = opts.body;
  }

  const method = opts.method ?? (body ? "POST" : "GET");
  let lastError: GraphRequestError | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (opts.signal?.aborted) {
      throw lastError ?? new Error("Graph request aborted");
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 100_000);
    const onAbort = () => controller.abort();
    opts.signal?.addEventListener("abort", onAbort);
    try {
      const res = await fetch(url, { method, headers, body, signal: controller.signal });
      try {
        const parsed = await parseGraphResponse(res);
        return { data: parsed.json as T, quota: parsed.quota, status: res.status };
      } catch (e) {
        if (e instanceof GraphRequestError && e.mapped.retryable && attempt < 4 && !opts.signal?.aborted) {
          lastError = e;
          await sleep(400 * 2 ** attempt);
          continue;
        }
        throw e;
      }
    } catch (e) {
      if (e instanceof GraphRequestError) throw e;
      if (opts.signal?.aborted) throw e;
      // Timeouts after a POST can already have created the Graph object — do not retry publishes.
      if (method !== "GET") throw e;
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
  throw lastError ?? new Error("Graph request failed");
}

/** Multipart POST — used to upload local photo/video bytes (`source` field). */
export async function graphMultipart<T = GraphJson>(opts: {
  path: string;
  token: string;
  appSecret: string;
  fields: Record<string, string | number | boolean | undefined>;
  file: { fieldName: string; bytes: Uint8Array; fileName: string; mime: string };
  timeoutMs?: number;
}): Promise<{ data: T; quota: QuotaParse | null; status: number }> {
  const url = graphUrl(opts.path, opts.token, opts.appSecret);
  const form = new FormData();
  for (const [k, v] of Object.entries(opts.fields)) {
    if (v !== undefined) form.append(k, String(v));
  }
  const copy = new Uint8Array(opts.file.bytes.byteLength);
  copy.set(opts.file.bytes);
  form.append(opts.file.fieldName, new Blob([copy], { type: opts.file.mime }), opts.file.fileName);

  let lastError: GraphRequestError | null = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 180_000);
    try {
      const res = await fetch(url, { method: "POST", body: form, signal: controller.signal });
      try {
        const parsed = await parseGraphResponse(res);
        return { data: parsed.json as T, quota: parsed.quota, status: res.status };
      } catch (e) {
        if (e instanceof GraphRequestError && e.mapped.retryable && attempt < 3) {
          lastError = e;
          await sleep(400 * 2 ** attempt);
          continue;
        }
        throw e;
      }
    } catch (e) {
      if (e instanceof GraphRequestError) throw e;
      throw lastError ?? e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new Error("Graph multipart upload failed");
}

/** Binary upload to rupload.facebook.com (Reels / video stories). */
export async function ruploadBinary(opts: {
  uploadUrl: string;
  token: string;
  bytes: Uint8Array;
  mime?: string;
}): Promise<void> {
  const copy = new Uint8Array(opts.bytes.byteLength);
  copy.set(opts.bytes);
  const res = await fetch(opts.uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${opts.token}`,
      offset: "0",
      file_size: String(opts.bytes.byteLength),
      "Content-Type": opts.mime || "application/octet-stream",
    },
    body: copy,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new GraphRequestError(
      mapGraphError({ httpStatus: res.status, message: text.slice(0, 400) || "rupload failed" }),
      parseUsageHeaders(res.headers),
    );
  }
}

export type DecodedDataUrl = { mime: string; bytes: Uint8Array; ext: string };

export function decodeDataUrl(dataUrl: string): DecodedDataUrl | null {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/i.exec(dataUrl.trim());
  if (!m) return null;
  const mime = m[1] || "application/octet-stream";
  const isB64 = Boolean(m[2]);
  const payload = m[3] ?? "";
  const buf = isB64 ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload));
  const ext = mime.includes("png")
    ? "png"
    : mime.includes("jpeg") || mime.includes("jpg")
      ? "jpg"
      : mime.includes("gif")
        ? "gif"
        : mime.includes("webp")
          ? "webp"
          : mime.includes("mp4")
            ? "mp4"
            : mime.includes("quicktime") || mime.includes("mov")
              ? "mov"
              : mime.includes("webm")
                ? "webm"
                : "bin";
  return { mime, bytes: new Uint8Array(buf), ext };
}

export async function bytesFromRemoteUrl(url: string): Promise<{ mime: string; bytes: Uint8Array; ext: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch media URL (${res.status})`);
  const mime = res.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = mime.includes("mp4") ? "mp4" : mime.includes("png") ? "png" : mime.includes("jpeg") ? "jpg" : "bin";
  return { mime, bytes: new Uint8Array(buf), ext };
}

export function graphObjectId(data: { id?: string; post_id?: string; video_id?: string }): string | undefined {
  return data.post_id || data.id || data.video_id;
}

export function unixSeconds(d: Date): number {
  return Math.floor(d.getTime() / 1000);
}

/** Follow Graph paging.cursors.after so /me/accounts is not silently capped at 25. */
export async function graphCollect<T = Record<string, unknown>>(opts: {
  path: string;
  token: string;
  appSecret: string;
  query?: Record<string, string | number | boolean | undefined>;
  maxPages?: number;
}): Promise<T[]> {
  const items: T[] = [];
  let after: string | undefined;
  const maxPages = opts.maxPages ?? 20;
  for (let i = 0; i < maxPages; i += 1) {
    const res = await graphFetch<{
      data?: T[];
      paging?: { cursors?: { after?: string }; next?: string };
    }>({
      path: opts.path,
      token: opts.token,
      appSecret: opts.appSecret,
      query: { limit: 100, ...opts.query, ...(after ? { after } : {}) },
    });
    items.push(...(res.data.data ?? []));
    after = res.data.paging?.cursors?.after;
    if (!after || !res.data.paging?.next) break;
  }
  return items;
}

