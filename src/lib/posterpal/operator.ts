/** Pure operator-desk helpers. No I/O — safe to call from UI or server. */

export const LATER_COLUMNS = [
  { id: "inbox", label: "Inbox", hint: "Unsorted ideas. Park it here first." },
  { id: "photo-needed", label: "Photo needed", hint: "Caption is ready; still needs a still, Reel, or carousel." },
  { id: "caption-ready", label: "Caption ready", hint: "Ready to open in Composer and run policy." },
  { id: "offer-this-week", label: "Offer this week", hint: "Merch / event / CTA you intend to ship in the next 7 days." },
] as const;

export type LaterColumnId = (typeof LATER_COLUMNS)[number]["id"];

export function laterColumnOf(notes: string | null | undefined): LaterColumnId {
  const n = (notes ?? "").trim();
  if (n === "photo-needed" || n === "caption-ready" || n === "offer-this-week") return n;
  return "inbox";
}

/** Comments that sound like a purchase, booking, or product question. */
const BUYING_INTENT_RE =
  /\b(how much|price|cost|where (can|do) i (buy|get|order)|link|shop|order|available|in stock|shipping|size|merch|buy|purchase|etsy|shopify|discount|coupon|do you (sell|have|ship)|want one|i'll take|sold out|restock|checkout|washable)\b/i;

export function isBuyingIntent(text: string): boolean {
  return BUYING_INTENT_RE.test(text);
}

/** Facebook 2026 creator advice: reply in the first hour while the post is still "fresh". */
export function inGoldenHour(iso: string | null | undefined, now = Date.now()): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const age = now - t;
  return age >= 0 && age <= 60 * 60 * 1000;
}

export type HeatCell = { day: number; hour: number; score: number; n: number };

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function dayLabel(day: number): string {
  return DAY_LABELS[day] ?? "";
}

export function hourHeatmap(
  rows: Array<{
    published_time?: string | null;
    created_at?: string;
    reactions_count?: number | null;
    comments_count?: number | null;
    shares_count?: number | null;
  }>,
): HeatCell[] {
  const cells = new Map<string, HeatCell>();
  for (const r of rows) {
    const iso = r.published_time ?? r.created_at;
    if (!iso) continue;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) continue;
    const day = d.getDay();
    const hour = d.getHours();
    const key = `${day}:${hour}`;
    const score =
      Number(r.reactions_count ?? 0) + Number(r.comments_count ?? 0) * 2 + Number(r.shares_count ?? 0);
    const prev = cells.get(key) ?? { day, hour, score: 0, n: 0 };
    prev.score += score;
    prev.n += 1;
    cells.set(key, prev);
  }
  return [...cells.values()];
}

export function bestHourSlot(cells: HeatCell[]): HeatCell | null {
  if (cells.length === 0) return null;
  return [...cells].sort((a, b) => b.score / Math.max(1, b.n) - a.score / Math.max(1, a.n))[0] ?? null;
}

/** Next local datetime-local value for a day/hour, at least 15 minutes from now. */
export function nextDatetimeLocal(day: number, hour: number, now = new Date()): string {
  const d = new Date(now);
  d.setSeconds(0, 0);
  d.setMinutes(0);
  const delta = (day - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + delta);
  d.setHours(hour);
  if (d.getTime() < now.getTime() + 15 * 60_000) d.setDate(d.getDate() + 7);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Sprout 2026 fallback when this Page has no history: Tue/Wed 12–8pm local. */
export function suggestedIndustrySlot(now = new Date()): string {
  const d = new Date(now);
  const day = d.getDay();
  const targetDay = day === 2 || day === 3 ? day : day < 2 ? 2 : 3;
  return nextDatetimeLocal(targetDay, 13, now);
}

export function applyUtm(url: string, template?: string | null, slug = "post"): string {
  const raw = url.trim();
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    const parts = (template || "utm_source=facebook&utm_medium=social&utm_campaign={slug}").split("&");
    for (const part of parts) {
      const [k, v] = part.split("=");
      if (k) u.searchParams.set(k.trim(), (v ?? "").replaceAll("{slug}", slug).trim());
    }
    return u.toString();
  } catch {
    return raw;
  }
}

export type MixCounts = Record<string, number>;

export function contentMix(
  rows: Array<{ media_type?: string | null }>,
): { counts: MixCounts; diversity: number; total: number } {
  const counts: MixCounts = { Text: 0, Photo: 0, Carousel: 0, Video: 0, Reel: 0, Story: 0 };
  for (const r of rows) {
    const k = r.media_type ?? "Text";
    counts[k] = (counts[k] ?? 0) + 1;
  }
  const total = rows.length;
  const diversity = Object.values(counts).filter((n) => n > 0).length;
  return { counts, diversity, total };
}

export function shopLinkShare(rows: Array<{ link?: string | null; message?: string | null }>): {
  withLink: number;
  total: number;
} {
  let withLink = 0;
  for (const r of rows) {
    const blob = `${r.link ?? ""} ${r.message ?? ""}`;
    if (/https?:\/\//i.test(blob) && /\b(shop|store|etsy|amazon|merch|utm_|checkout)\b/i.test(blob)) {
      withLink += 1;
    } else if (r.link) {
      withLink += 1;
    }
  }
  return { withLink, total: rows.length };
}

export type FitnessInput = {
  fanCount: number;
  merchCount: number;
  mixDiversity: number;
  inboxCount: number;
  failedCount: number;
  vaultExpiresAt: string | null;
  postedLast24h: number;
  cadenceWarn: number;
};

export type FitnessItem = { id: string; ok: boolean; label: string; detail: string };

export function monetizationFitness(input: FitnessInput): { score: number; items: FitnessItem[] } {
  const items: FitnessItem[] = [];
  const vaultMs = input.vaultExpiresAt ? new Date(input.vaultExpiresAt).getTime() - Date.now() : null;
  const vaultOk = vaultMs == null || vaultMs > 7 * 86_400_000;

  items.push({
    id: "fans",
    ok: input.fanCount >= 100,
    label: "Insights unlocked",
    detail:
      input.fanCount >= 100
        ? `${input.fanCount.toLocaleString()} likes — Page Insights edge is available.`
        : `${input.fanCount.toLocaleString()} likes. Graph Insights need ~100. Grow the Page; don't scrape fake reach.`,
  });
  items.push({
    id: "merch",
    ok: input.merchCount > 0,
    label: "Shop link on file",
    detail:
      input.merchCount > 0
        ? `${input.merchCount} product link${input.merchCount === 1 ? "" : "s"} ready for Composer + first comment.`
        : "Add a merch URL so offers can carry UTM without stuffing the caption.",
  });
  items.push({
    id: "mix",
    ok: input.mixDiversity >= 3,
    label: "Content mix",
    detail:
      input.mixDiversity >= 3
        ? `${input.mixDiversity} formats in the recent window.`
        : "Mix Reels, photos, and text. One format stalls reach and monetization eligibility.",
  });
  items.push({
    id: "inbox",
    ok: input.inboxCount < 8,
    label: "Inbox under control",
    detail:
      input.inboxCount === 0
        ? "Inbox zero."
        : `${input.inboxCount} waiting. Reply in the first hour — Meta treats freshness as a ranking signal.`,
  });
  items.push({
    id: "failed",
    ok: input.failedCount === 0,
    label: "Publish queue clean",
    detail:
      input.failedCount === 0
        ? "No failed Graph publishes."
        : `${input.failedCount} failed. Retry from Drafts — the original media is still on the row.`,
  });
  items.push({
    id: "vault",
    ok: vaultOk,
    label: "Token healthy",
    detail:
      vaultMs == null
        ? "No live token yet — practice mode is fine."
        : vaultOk
          ? "User token is more than 7 days from expiry."
          : "Token expires within 7 days. Reconnect in Settings before Graph 190.",
  });
  items.push({
    id: "cadence",
    ok: input.postedLast24h < input.cadenceWarn,
    label: "Cadence",
    detail: `${input.postedLast24h} in 24h (warn ${input.cadenceWarn}). High-frequency identical posts look like spam.`,
  });

  const score = Math.round((items.filter((i) => i.ok).length / items.length) * 100);
  return { score, items };
}

export function vaultAlarm(expiresAt: string | null | undefined): "ok" | "soon" | "expired" | "none" {
  if (!expiresAt) return "none";
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(ms)) return "none";
  if (ms <= 0) return "expired";
  if (ms <= 7 * 86_400_000) return "soon";
  return "ok";
}

export function captionStats(text: string): {
  chars: number;
  words: number;
  level: "empty" | "ok" | "feed" | "long" | "over";
} {
  const chars = [...text].length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const level =
    chars === 0 ? "empty" : chars <= 80 ? "ok" : chars <= 500 ? "feed" : chars <= 63_206 ? "long" : "over";
  return { chars, words, level };
}

export function captionHint(level: ReturnType<typeof captionStats>["level"]): string {
  if (level === "empty") return "Write a caption.";
  if (level === "ok") return "Fits the news-feed preview (~80 characters).";
  if (level === "feed") return "Fine for a post. Keep the first 80 characters doing the work.";
  if (level === "long") return "Graph allows this. Most people will not read past the fold.";
  return "Over Facebook's 63,206-character limit.";
}

export function isQuietHour(localDatetime: string): boolean {
  const m = /T(\d{2})/.exec(localDatetime);
  if (!m) return false;
  const h = Number(m[1]);
  return h >= 23 || h < 6;
}

export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function countHashtags(text: string): number {
  return (text.match(/(^|\s)#[\p{L}\p{N}_]+/gu) ?? []).length;
}

/** Keep the first `keep` hashtags; strip the rest. Policy default is 3. */
export function trimHashtags(text: string, keep = 3): string {
  let n = 0;
  return text
    .replace(/(^|\s)(#[\p{L}\p{N}_]+)/gu, (_m, sp: string, tag: string) => {
      n += 1;
      return n <= keep ? `${sp}${tag}` : sp;
    })
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export function hasCallToAction(text: string): boolean {
  return /\?|https?:\/\/|\b(shop|buy|order|comment|tell me|drop a|which one|grab|today only|link in|dm me|tap|click)\b/i.test(
    text,
  );
}

export function isOverdue(iso: string | null | undefined, now = Date.now()): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t < now;
}

export function nextEmptyDay(occupiedIsoDates: string[], now = new Date()): Date {
  const taken = new Set(
    occupiedIsoDates.map((iso) => {
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }),
  );
  const d = new Date(now);
  d.setHours(10, 0, 0, 0);
  if (d.getTime() < now.getTime() + 15 * 60_000) d.setDate(d.getDate() + 1);
  for (let i = 0; i < 60; i += 1) {
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!taken.has(key)) return d;
    d.setDate(d.getDate() + 1);
  }
  return d;
}

export function inferMediaKind(mime: string | null | undefined, fallback: "Photo" | "Video" = "Photo"): "Photo" | "Video" | "Reel" {
  const m = String(mime ?? "").toLowerCase();
  if (m.startsWith("video/")) return "Video";
  if (m.startsWith("image/")) return "Photo";
  return fallback;
}

