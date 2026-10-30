/**
 * Facebook Page Messenger — webhook ingestion + human-in-the-loop replies.
 *
 * Compliance boundaries baked into this module (Meta Developer Policies §5 and
 * the Messenger Platform docs, read 2026-10-29):
 *   - The standard messaging window is 24 hours from the person's last message
 *     (up to 7 days only for a Click-to-Messenger ad thread). Outside it we REFUSE
 *     to send rather than reaching for a Message Tag — tags may not carry
 *     promotional content, and this desk does not send marketing messages.
 *   - Every outbound message is triggered by a human clicking Send. Nothing in
 *     this file is scheduled, looped, or fired by a webhook.
 *   - No message is ever prefilled with content the person did not write.
 *   - App secret proof (HMAC-SHA256) is attached to every Graph call.
 */
import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { decryptSecret } from "./crypto";

/**
 * Lazy DB access. Importing `@/lib/db` at module scope boots PGLite (a Vite-only
 * `import.meta.glob` at startup), which would make the pure signature/window
 * helpers untestable under plain Node. Deferring keeps this module importable.
 */
async function db() {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

export const MESSENGER_GRAPH_VERSION = "v26.0";
export const MESSENGER_WINDOW_HOURS = 24;
export const MESSENGER_MAX_TEXT = 2000;

export const MESSENGER_RULES = [
  "You can only reply inside the 24-hour standard messaging window. PosterPal refuses to send outside it.",
  "Every reply is a human click. Nothing here auto-replies, auto-likes, or messages people first.",
  "Message Tags may not be used for promotions, deals, or product announcements — this desk never uses them.",
  "Opt-outs are honoured by stopping replies on that thread; the operator marks the thread handled.",
  "The Page must keep accurate customer-support contact info in its About section.",
] as const;

export type MessengerEvent = {
  kind: "message" | "postback" | "delivery" | "read" | "other";
  pageId: string;
  psid: string;
  mid: string | null;
  text: string | null;
  attachments: Array<{ type: string; url: string | null }>;
  isEcho: boolean;
  timestamp: number | null;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/**
 * Parse a Messenger webhook body into flat events.
 * Returns [] for malformed payloads instead of throwing — Meta retries on 5xx,
 * and a payload we cannot read will never become readable.
 */
export function parseMessengerWebhook(payload: unknown): MessengerEvent[] {
  const root = asRecord(payload);
  const entries = Array.isArray(root?.entry) ? root!.entry : [];
  const events: MessengerEvent[] = [];
  for (const rawEntry of entries) {
    const entry = asRecord(rawEntry);
    const pageId = entry && typeof entry.id === "string" ? entry.id : "";
    const messaging = Array.isArray(entry?.messaging) ? entry!.messaging : [];
    for (const rawEvent of messaging) {
      const ev = asRecord(rawEvent);
      if (!ev) continue;
      const sender = asRecord(ev.sender);
      const recipient = asRecord(ev.recipient);
      const message = asRecord(ev.message);
      const postback = asRecord(ev.postback);
      const timestamp = typeof ev.timestamp === "number" ? ev.timestamp : null;
      const senderId = typeof sender?.id === "string" ? sender.id : "";
      const recipientId = typeof recipient?.id === "string" ? recipient.id : "";
      const base = {
        pageId: pageId || recipientId,
        timestamp,
        mid: typeof message?.mid === "string" ? message.mid : null,
        text: typeof message?.text === "string" ? message.text : null,
        attachments: parseAttachments(message?.attachments),
        isEcho: message?.is_echo === true,
      };

      if (message) {
        // Inbound: page is the recipient and the PSID is the sender.
        // Echo: the Page sent it, so the PSID is the recipient.
        const psid = base.isEcho ? recipientId : senderId;
        if (!psid) continue;
        events.push({ kind: "message", ...base, psid });
        continue;
      }
      if (postback) {
        const psid = senderId || recipientId;
        if (!psid) continue;
        events.push({
          kind: "postback",
          ...base,
          psid,
          text: typeof postback.title === "string" ? `[postback] ${postback.title}` : "[postback]",
        });
        continue;
      }
      if (ev.delivery) {
        events.push({ kind: "delivery", ...base, psid: recipientId || senderId });
        continue;
      }
      if (ev.read) {
        events.push({ kind: "read", ...base, psid: senderId || recipientId });
        continue;
      }
      events.push({ kind: "other", ...base, psid: senderId || recipientId });
    }
  }
  return events.filter((e) => e.pageId && e.psid);
}

function parseAttachments(raw: unknown): Array<{ type: string; url: string | null }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ type: string; url: string | null }> = [];
  for (const item of raw) {
    const rec = asRecord(item);
    if (!rec) continue;
    const type = typeof rec.type === "string" ? rec.type : "unknown";
    const payload = asRecord(rec.payload);
    const url = payload && typeof payload.url === "string" ? payload.url : null;
    out.push({ type, url });
  }
  return out;
}

/** `X-Hub-Signature-256: sha256=<hex hmac>` over the exact raw body. */
export function verifyMetaSignature(
  rawBody: Buffer | Uint8Array,
  header: string | null | undefined,
  appSecret: string,
): boolean {
  if (!header || !appSecret) return false;
  const value = header.trim();
  if (!value.startsWith("sha256=")) return false;
  const provided = Buffer.from(value.slice("sha256=".length), "hex");
  if (provided.length === 0) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
  const expected = createHmac("sha256", appSecret).update(body).digest();
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

export function appSecretProof(appSecret: string, accessToken: string): string {
  return createHmac("sha256", appSecret).update(accessToken).digest("hex");
}

/** 24h window math, in the person's thread. */
export function messagingWindow(
  lastInboundAt: string | Date | null | undefined,
  now = Date.now(),
): { open: boolean; expiresAt: string | null; hoursLeft: number | null } {
  if (!lastInboundAt) return { open: false, expiresAt: null, hoursLeft: null };
  const then = lastInboundAt instanceof Date ? lastInboundAt.getTime() : Date.parse(lastInboundAt);
  if (!Number.isFinite(then)) return { open: false, expiresAt: null, hoursLeft: null };
  const expires = then + MESSENGER_WINDOW_HOURS * 3600_000;
  const msLeft = expires - now;
  return {
    open: msLeft > 0,
    expiresAt: new Date(expires).toISOString(),
    hoursLeft: Math.round((msLeft / 3600_000) * 10) / 10,
  };
}

export function validateReplyText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Write a reply before sending.");
  if (trimmed.length > MESSENGER_MAX_TEXT) {
    throw new Error(`Messenger text messages are limited to ${MESSENGER_MAX_TEXT} characters.`);
  }
  return trimmed;
}

/** Send one human-authored reply through the Send API. Never called on a schedule. */
export async function sendMessengerMessage(input: {
  pageId: string;
  pageAccessToken: string;
  appSecret: string;
  psid: string;
  text: string;
}): Promise<{ messageId: string | null }> {
  const text = validateReplyText(input.text);
  const body = {
    recipient: { id: input.psid },
    messaging_type: "RESPONSE",
    message: { text },
  };
  const url =
    `https://graph.facebook.com/${MESSENGER_GRAPH_VERSION}/${encodeURIComponent(input.pageId)}/messages` +
    `?access_token=${encodeURIComponent(input.pageAccessToken)}` +
    `&appsecret_proof=${appSecretProof(input.appSecret, input.pageAccessToken)}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    throw new Error(`Messenger Send API unreachable: ${e instanceof Error ? e.message : "network failure"}`);
  }
  const raw = await res.text();
  if (!res.ok) {
    let detail = raw.slice(0, 220);
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string; code?: number; error_subcode?: number } };
      if (parsed.error?.message) {
        detail = `Graph ${parsed.error.code ?? res.status}: ${parsed.error.message}`;
      }
    } catch {
      // keep the truncated body
    }
    throw new Error(`Messenger Send API rejected the reply — ${detail}`);
  }
  try {
    const parsed = JSON.parse(raw) as { message_id?: string };
    return { messageId: parsed.message_id ?? null };
  } catch {
    return { messageId: null };
  }
}

// ─── Persistence ──────────────────────────────────────────────────────────────

export type MessengerThreadRow = {
  id: string;
  page_id: string;
  page_name: string;
  psid: string;
  display_name: string | null;
  last_inbound_at: string | null;
  last_message_at: string | null;
  needs_reply: boolean;
  window_hours_left: number | null;
};

export type MessengerMessageRow = {
  id: string;
  direction: "inbound" | "outbound";
  body: string | null;
  attachments: Array<{ type: string; url: string | null }>;
  sent_at: string | null;
  is_echo: boolean;
};

/** Resolve the desk Page row for a Facebook Page id (used by the webhook). */
export async function pageForFacebookId(
  facebookPageId: string,
): Promise<{ id: string; userId: string } | null> {
  const sql = await db();
  const rows = await sql<{ id: string; user_id: string }>`
    select id, user_id from pages where facebook_page_id = ${facebookPageId} limit 1
  `;
  const r = rows[0];
  return r ? { id: String(r.id), userId: String(r.user_id) } : null;
}

/** Every configured app secret, so an inbound webhook can be authenticated without a session. */
export async function listAppSecrets(): Promise<Array<{ userId: string; secret: string }>> {
  const sql = await db();
  const rows = await sql<{ user_id: string; value_enc: string | null }>`
    select user_id, value_enc from app_settings
    where key = 'facebook_app_secret' and value_enc is not null
  `;
  const out: Array<{ userId: string; secret: string }> = [];
  for (const r of rows) {
    const secret = decryptSecret(r.value_enc);
    if (secret) out.push({ userId: String(r.user_id), secret });
  }
  return out;
}

export async function getMessengerVerifyToken(): Promise<string | null> {
  const sql = await db();
  const rows = await sql<{ value_plain: string | null }>`
    select value_plain from app_settings where key = 'messenger_verify_token' limit 1
  `;
  const v = rows[0]?.value_plain?.trim();
  return v ? v : null;
}

export async function saveMessengerVerifyToken(userId: string, token: string): Promise<void> {
  const value = token.trim();
  if (value.length < 8) throw new Error("Verify token must be at least 8 characters.");
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error("Verify token may only contain letters, numbers, underscores, and hyphens.");
  }
  const sql = await db();
  await sql`
    insert into app_settings (user_id, key, value_plain, updated_at)
    values (${userId}, 'messenger_verify_token', ${value}, now())
    on conflict (user_id, key) do update set value_plain = excluded.value_plain, updated_at = now()
  `;
}

/** Record an inbound event. Idempotent on the Meta message id. */
export async function recordInbound(input: {
  userId: string;
  pageDbId: string;
  psid: string;
  mid: string | null;
  text: string | null;
  attachments: Array<{ type: string; url: string | null }>;
  sentAt: Date | null;
  isEcho: boolean;
}): Promise<{ threadId: string; duplicate: boolean }> {
  const sql = await db();
  const threadId = randomUUID();
  const inserted = await sql<{ id: string }>`
    insert into messenger_threads (id, user_id, page_id, psid, last_inbound_at, last_message_at, needs_reply)
    values (${threadId}, ${input.userId}, ${input.pageDbId}, ${input.psid},
            ${input.isEcho ? null : input.sentAt?.toISOString() ?? null},
            ${input.sentAt?.toISOString() ?? null}, ${!input.isEcho})
    on conflict (page_id, psid) do update set
      last_inbound_at = case when ${input.isEcho} then messenger_threads.last_inbound_at
                             else excluded.last_inbound_at end,
      last_message_at = excluded.last_message_at,
      needs_reply = case when ${input.isEcho} then messenger_threads.needs_reply else true end
    returning id
  `;
  const resolvedThreadId = String(inserted[0]?.id ?? threadId);
  const mid = input.mid;
  if (mid) {
    const dupe = await sql<{ id: string }>`
      insert into messenger_messages (id, user_id, thread_id, mid, direction, body, attachments_json, sent_at, is_echo)
      values (${randomUUID()}, ${input.userId}, ${resolvedThreadId}, ${mid},
              ${input.isEcho ? "outbound" : "inbound"}, ${input.text},
              ${JSON.stringify(input.attachments)}, ${input.sentAt?.toISOString() ?? null}, ${input.isEcho})
      on conflict (mid) where mid is not null do nothing
      returning id
    `;
    return { threadId: resolvedThreadId, duplicate: dupe.length === 0 };
  }
  await sql`
    insert into messenger_messages (id, user_id, thread_id, mid, direction, body, attachments_json, sent_at, is_echo)
    values (${randomUUID()}, ${input.userId}, ${resolvedThreadId}, null,
            ${input.isEcho ? "outbound" : "inbound"}, ${input.text},
            ${JSON.stringify(input.attachments)}, ${input.sentAt?.toISOString() ?? null}, ${input.isEcho})
  `;
  return { threadId: resolvedThreadId, duplicate: false };
}

export async function recordOutbound(input: {
  userId: string;
  threadId: string;
  mid: string | null;
  body: string;
}): Promise<void> {
  const sql = await db();
  await sql`
    insert into messenger_messages (id, user_id, thread_id, mid, direction, body, attachments_json, sent_at, is_echo)
    values (${randomUUID()}, ${input.userId}, ${input.threadId}, ${input.mid}, 'outbound',
            ${input.body}, '[]', now(), true)
  `;
  await sql`
    update messenger_threads
    set last_message_at = now(), needs_reply = false
    where id = ${input.threadId} and user_id = ${input.userId}
  `;
}

export async function listThreads(userId: string): Promise<MessengerThreadRow[]> {
  const sql = await db();
  const rows = await sql<Record<string, unknown>>`
    select t.id, t.page_id, t.psid, t.display_name, t.last_inbound_at, t.last_message_at, t.needs_reply,
           p.name as page_name
    from messenger_threads t
    join pages p on p.id = t.page_id
    where t.user_id = ${userId}
    order by t.last_message_at desc nulls last
    limit 100
  `;
  return rows.map((r) => ({
    id: String(r.id),
    page_id: String(r.page_id),
    page_name: String(r.page_name ?? ""),
    psid: String(r.psid),
    display_name: r.display_name == null ? null : String(r.display_name),
    last_inbound_at: r.last_inbound_at == null ? null : String(r.last_inbound_at),
    last_message_at: r.last_message_at == null ? null : String(r.last_message_at),
    needs_reply: Boolean(r.needs_reply),
    window_hours_left: messagingWindow(r.last_inbound_at == null ? null : String(r.last_inbound_at)).hoursLeft,
  }));
}

export async function listMessages(userId: string, threadId: string): Promise<MessengerMessageRow[]> {
  const sql = await db();
  const rows = await sql<Record<string, unknown>>`
    select id, direction, body, attachments_json, sent_at, is_echo
    from messenger_messages
    where user_id = ${userId} and thread_id = ${threadId}
    order by created_at asc
    limit 300
  `;
  return rows.map((r) => ({
    id: String(r.id),
    direction: String(r.direction) === "outbound" ? "outbound" : "inbound",
    body: r.body == null ? null : String(r.body),
    attachments: (() => {
      try {
        const parsed = JSON.parse(String(r.attachments_json ?? "[]")) as unknown;
        return Array.isArray(parsed) ? (parsed as Array<{ type: string; url: string | null }>) : [];
      } catch {
        return [];
      }
    })(),
    sent_at: r.sent_at == null ? null : String(r.sent_at),
    is_echo: Boolean(r.is_echo),
  }));
}

/** Load everything needed to send one reply: thread, Page row, decrypted Page token + app secret. */
export async function replyContext(
  userId: string,
  threadId: string,
): Promise<{
  thread: MessengerThreadRow;
  facebookPageId: string | null;
  pageAccessToken: string | null;
  appSecret: string | null;
}> {
  const sql = await db();
  const threads = await listThreads(userId);
  const thread = threads.find((t) => t.id === threadId);
  if (!thread) throw new Error("Messenger thread not found.");
  const rows = await sql<{
    facebook_page_id: string | null;
    access_token_enc: string | null;
  }>`
    select facebook_page_id, access_token_enc from pages
    where id = ${thread.page_id} and user_id = ${userId} limit 1
  `;
  const secretRows = await sql<{ value_enc: string | null }>`
    select value_enc from app_settings
    where user_id = ${userId} and key = 'facebook_app_secret' limit 1
  `;
  const pageAccessToken = decryptSecret(rows[0]?.access_token_enc ?? null);
  const appSecret = decryptSecret(secretRows[0]?.value_enc ?? null);
  return {
    thread,
    facebookPageId: rows[0]?.facebook_page_id ?? null,
    pageAccessToken,
    appSecret,
  };
}
