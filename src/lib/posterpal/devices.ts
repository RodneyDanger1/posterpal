import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";
import { inGoldenHour, isBuyingIntent, vaultAlarm } from "./operator";
import { cadenceForPage, inboxCount, latestQuota, listMerch, listPages, listPosts, listVault, loadSettings } from "./repo";
import type { DeviceRow, NeedsItem, PairingTicket } from "./types";

export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function mintDeviceToken(): string {
  return `ppd_${randomBytes(32).toString("hex")}`;
}

export async function createPairingCode(userId: string): Promise<PairingTicket> {
  const sql = await getSql();
  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  await sql`delete from pairing_codes where user_id = ${userId} and (used_at is not null or expires_at < now())`;
  await sql`
    insert into pairing_codes (code, user_id, expires_at)
    values (${code}, ${userId}, ${expiresAt})
  `;
  return { code, expiresAt };
}

export async function redeemPairingCode(data: {
  code: string;
  deviceName: string;
  platform: string;
}): Promise<{ token: string; deviceId: string; operator: string }> {
  const sql = await getSql();
  const code = data.code.replace(/\s+/g, "").trim();
  if (!/^\d{6}$/.test(code)) throw new Error("Pairing code is 6 digits.");
  const rows = await sql<{ user_id: string; expires_at: string; used_at: string | null }>`
    select user_id, expires_at, used_at from pairing_codes where code = ${code}
  `;
  const row = rows[0];
  if (!row) throw new Error("That code is not valid. Generate a new one from Settings → Devices.");
  if (row.used_at) throw new Error("That code was already used. Generate a new one.");
  if (new Date(row.expires_at).getTime() < Date.now()) throw new Error("That code expired. Generate a new one.");

  const token = mintDeviceToken();
  const deviceId = randomUUID();
  const name = (data.deviceName || "Phone").trim().slice(0, 80) || "Phone";
  const platform = ["android", "windows", "web", "ios"].includes(data.platform) ? data.platform : "web";

  await sql`
    insert into devices (id, user_id, name, platform, token_hash, last_seen_at)
    values (${deviceId}, ${row.user_id}, ${name}, ${platform}, ${hashDeviceToken(token)}, now())
  `;
  await sql`update pairing_codes set used_at = now() where code = ${code}`;
  return { token, deviceId, operator: "Operator" };
}

export async function listDevices(userId: string): Promise<DeviceRow[]> {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    name: string;
    platform: string;
    last_seen_at: string | null;
    created_at: string;
    revoked_at: string | null;
  }>`
    select id, name, platform, last_seen_at, created_at, revoked_at
    from devices where user_id = ${userId}
    order by created_at desc
  `;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    platform: r.platform,
    last_seen_at: r.last_seen_at,
    created_at: r.created_at,
    is_revoked: Boolean(r.revoked_at),
  }));
}

export async function revokeDevice(userId: string, deviceId: string) {
  const sql = await getSql();
  await sql`
    update devices set revoked_at = now()
    where id = ${deviceId} and user_id = ${userId} and revoked_at is null
  `;
  return { ok: true as const };
}

export async function resolveDeviceToken(token: string): Promise<{ userId: string; deviceId: string } | null> {
  if (!token.startsWith("ppd_")) return null;
  const sql = await getSql();
  const rows = await sql<{ id: string; user_id: string }>`
    select id, user_id from devices
    where token_hash = ${hashDeviceToken(token)} and revoked_at is null
  `;
  const row = rows[0];
  if (!row) return null;
  await sql`update devices set last_seen_at = now() where id = ${row.id}`;
  return { userId: row.user_id, deviceId: row.id };
}

export async function needsYou(userId: string): Promise<NeedsItem[]> {
  const sql = await getSql();
  const items: NeedsItem[] = [];

  const overdue = await sql<{
    id: string;
    message: string | null;
    scheduled_publish_time: string | null;
    page_name: string;
  }>`
    select po.id, po.message, po.scheduled_publish_time, pa.name as page_name
    from posts po join pages pa on pa.id = po.page_id
    where po.user_id = ${userId}
      and po.status = 'LocalScheduled'
      and po.scheduled_publish_time is not null
      and po.scheduled_publish_time < now()
    order by po.scheduled_publish_time
    limit 8
  `;
  for (const p of overdue) {
    items.push({
      id: `overdue:${p.id}`,
      kind: "overdue",
      title: "Overdue — desk was closed",
      detail: (p.message ?? "(no caption)").slice(0, 140),
      href: "/drafts",
      pageName: p.page_name,
      urgency: "now",
      action: { type: "publish", id: p.id },
    });
  }

  const failed = await sql<{ id: string; message: string | null; error_message: string | null; page_name: string }>`
    select po.id, po.message, po.error_message, pa.name as page_name
    from posts po join pages pa on pa.id = po.page_id
    where po.user_id = ${userId} and po.status = 'Failed'
    order by po.updated_at desc
    limit 6
  `;
  for (const p of failed) {
    items.push({
      id: `failed:${p.id}`,
      kind: "failed",
      title: "Publish failed — media is still on this row",
      detail: (p.error_message || p.message || "Retry from Drafts.").slice(0, 160),
      href: "/drafts",
      pageName: p.page_name,
      urgency: "now",
      action: { type: "publish", id: p.id },
    });
  }

  const comments = await sql<{
    id: string;
    message: string;
    author_name: string | null;
    created_at: string;
    page_name: string;
  }>`
    select c.id, c.message, c.author_name, c.created_at, pa.name as page_name
    from comments c
    join posts po on po.id = c.post_id
    join pages pa on pa.id = po.page_id
    where c.user_id = ${userId} and c.needs_reply = true and c.is_hidden = false
    order by c.created_at desc
    limit 12
  `;
  const ranked = [...comments].sort((a, b) => {
    const score = (c: (typeof comments)[number]) =>
      (isBuyingIntent(c.message) ? 4 : 0) + (inGoldenHour(c.created_at) ? 3 : 0);
    return score(b) - score(a);
  });
  for (const c of ranked.slice(0, 8)) {
    const buy = isBuyingIntent(c.message);
    const gold = inGoldenHour(c.created_at);
    items.push({
      id: `comment:${c.id}`,
      kind: "comment",
      title: gold
        ? `${c.author_name ?? "Visitor"} · first hour`
        : buy
          ? `${c.author_name ?? "Visitor"} · buying intent`
          : `${c.author_name ?? "Visitor"} needs a reply`,
      detail: c.message.slice(0, 160),
      href: "/inbox",
      pageName: c.page_name,
      urgency: gold || buy ? "now" : "soon",
      action: { type: "open-inbox", id: c.id },
    });
  }

  const vault = await listVault(userId);
  for (const v of vault.filter((t) => t.is_valid)) {
    const alarm = vaultAlarm(v.expires_at);
    if (alarm === "expired" || alarm === "soon") {
      items.push({
        id: `token:${v.id}`,
        kind: "token",
        title: alarm === "expired" ? "Facebook token expired" : "Facebook token expires within 7 days",
        detail: "Reconnect in Settings before Graph 190 kills publishes.",
        href: "/settings",
        urgency: alarm === "expired" ? "now" : "soon",
      });
    }
  }

  const pages = await listPages(userId);
  for (const page of pages.slice(0, 12)) {
    const cad = await cadenceForPage(userId, page.id);
    if (cad.level === "block" || cad.level === "warn") {
      items.push({
        id: `cadence:${page.id}`,
        kind: "cadence",
        title: cad.level === "block" ? `${page.name} is at the hard cap` : `${page.name} is over the warn line`,
        detail: `${cad.postedLast24h} posts in 24h (warn ${cad.warnAt}, block ${cad.blockAt}). Identical high-frequency posts look like spam.`,
        href: "/composer",
        pageName: page.name,
        urgency: cad.level === "block" ? "now" : "info",
      });
    }
  }

  const rank = { now: 0, soon: 1, info: 2 };
  return items.sort((a, b) => rank[a.urgency] - rank[b.urgency]).slice(0, 16);
}

export async function snapshotForSync(userId: string, origin: string) {
  const [pages, posts, comments, merch, settings, needs, quota, inbox] = await Promise.all([
    listPages(userId),
    listPosts(userId, { limit: 80 }),
    (async () => {
      const { listComments } = await import("./repo");
      return listComments(userId, "needs");
    })(),
    listMerch(userId),
    loadSettings(userId, origin),
    needsYou(userId),
    latestQuota(userId),
    inboxCount(userId),
  ]);
  return {
    pages: pages.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      fan_count: p.fan_count,
      is_practice: p.is_practice,
      is_read_only: p.is_read_only,
      brand_voice: p.brand_voice,
    })),
    posts: posts.map((p) => ({
      id: p.id,
      page_id: p.page_id,
      page_name: p.page_name,
      message: p.message,
      status: p.status,
      media_type: p.media_type,
      scheduled_publish_time: p.scheduled_publish_time,
      published_time: p.published_time,
      reactions_count: p.reactions_count,
      comments_count: p.comments_count,
      shares_count: p.shares_count,
      error_message: p.error_message,
    })),
    comments: comments.map((c) => ({
      id: c.id,
      message: c.message,
      author_name: c.author_name,
      needs_reply: c.needs_reply,
      sentiment: c.sentiment,
      created_at: c.created_at,
      page_name: c.page_name,
      post_message: c.post_message,
      reply_drafts_json: c.reply_drafts_json,
    })),
    merch: merch.map((m) => ({
      id: m.id,
      page_id: m.page_id,
      title: m.title,
      url: m.url,
      platform: m.platform,
    })),
    needs,
    inboxCount: inbox,
    quota,
    settings: {
      theme: settings.theme,
      cadenceWarn: settings.cadenceWarn,
      cadenceBlock: settings.cadenceBlock,
      setupComplete: settings.setupComplete,
      hasFacebookSecret: settings.hasFacebookSecret,
      facebookAppId: settings.facebookAppId,
      providers: settings.providers,
    },
    generatedAt: new Date().toISOString(),
  };
}

export function jsonOk(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "Authorization, Content-Type",
      "access-control-allow-methods": "GET, POST, OPTIONS",
    },
  });
}

export function jsonErr(message: string, status = 400) {
  return jsonOk({ error: message }, status);
}

export function corsPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "Authorization, Content-Type",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-max-age": "86400",
    },
  });
}

export function bearerFrom(request: Request): string | null {
  const h = request.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(\S+)/i.exec(h);
  return m?.[1] ?? null;
}
