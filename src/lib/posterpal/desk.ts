/** Pure operator helpers. Safe for client or server. */

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

/** Next Tue/Wed 1pm local, at least 15 minutes from now. */
export function nextGoodSlot(now = new Date()): string {
  const d = new Date(now);
  d.setSeconds(0, 0);
  d.setMinutes(0);
  const day = d.getDay();
  const targetDay = day === 2 || day === 3 ? day : day < 2 ? 2 : 3;
  const delta = (targetDay - day + 7) % 7;
  d.setDate(d.getDate() + delta);
  d.setHours(13);
  if (d.getTime() < now.getTime() + 15 * 60_000) d.setDate(d.getDate() + (targetDay === 2 ? 1 : 6));
  if (d.getTime() < now.getTime() + 15 * 60_000) d.setDate(d.getDate() + 7);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function inGoldenHour(iso: string | null | undefined, now = Date.now()): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const age = now - t;
  return age >= 0 && age <= 60 * 60 * 1000;
}

const BUYING_RE =
  /\b(how much|price|cost|where (can|do) i (buy|get|order)|link|shop|order|available|in stock|shipping|size|merch|buy|purchase|do you (sell|have|ship)|washable|restock)\b/i;

export function isBuyingIntent(text: string): boolean {
  return BUYING_RE.test(text);
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

export function extractHashtags(text: string): string[] {
  const tags = text.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

/** Question, link, or a verb that asks the reader to do something. */
export function hasCallToAction(text: string): boolean {
  return /\?|https?:\/\/|\b(shop|buy|order|comment|tell me|drop a|which one|grab|today only|link in|dm me|tap|click)\b/i.test(
    text,
  );
}

export function isStaleComment(iso: string | null | undefined, now = Date.now(), hours = 24): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return now - t >= hours * 60 * 60 * 1000;
}

export function hourKey(isoOrLocal: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2})/.exec(isoOrLocal);
  if (m) return `${m[1]}T${m[2]}`;
  const d = new Date(isoOrLocal);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}`;
}

export function tokenExpiringSoon(iso: string | null | undefined, now = Date.now(), days = 7): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const left = t - now;
  return left > 0 && left <= days * 24 * 60 * 60 * 1000;
}

export function isOverdue(iso: string | null | undefined, now = Date.now()): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t < now;
}
