/** Pure posting-slot and week-planner helpers. Safe on client or server. */

export type PostingSlot = { day: number; hour: number };

/** Tue 10am, Wed 11am, Thu 10am — 2026 Pages research: Tue–Thu 9am–1pm local,
 *  Wednesday ~11am is the strongest single slot. Consistency 3×/week beats a Saturday burst. */
export const DEFAULT_SLOTS: PostingSlot[] = [
  { day: 2, hour: 10 },
  { day: 3, hour: 11 },
  { day: 4, hour: 10 },
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function parseSlots(raw: string | null | undefined): PostingSlot[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: PostingSlot[] = [];
    const seen = new Set<string>();
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const day = Number((item as PostingSlot).day);
      const hour = Number((item as PostingSlot).hour);
      if (!Number.isInteger(day) || day < 0 || day > 6) continue;
      if (!Number.isInteger(hour) || hour < 0 || hour > 23) continue;
      const key = `${day}:${hour}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ day, hour });
    }
    return out.sort((a, b) => a.day - b.day || a.hour - b.hour);
  } catch {
    return [];
  }
}

export function slotsOrDefault(raw: string | null | undefined): PostingSlot[] {
  const parsed = parseSlots(raw);
  return parsed.length ? parsed : DEFAULT_SLOTS;
}

export function serializeSlots(slots: PostingSlot[]): string {
  return JSON.stringify(parseSlots(JSON.stringify(slots)));
}

export function slotLabel(slot: PostingSlot): string {
  const h = slot.hour % 12 || 12;
  const ampm = slot.hour < 12 ? "am" : "pm";
  return `${DAY_NAMES[slot.day] ?? "?"} ${h}${ampm}`;
}

function slotDate(slot: PostingSlot, from: Date): Date {
  const d = new Date(from);
  d.setSeconds(0, 0);
  d.setMinutes(0);
  const delta = (slot.day - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + delta);
  d.setHours(slot.hour);
  return d;
}

/** Next slot at least 15 minutes from now, wrapping a week if needed. */
export function nextPostingSlot(slots: PostingSlot[], now = new Date()): Date | null {
  const list = slots.length ? slots : DEFAULT_SLOTS;
  const floor = now.getTime() + 15 * 60_000;
  let best: Date | null = null;
  for (const slot of list) {
    let d = slotDate(slot, now);
    if (d.getTime() < floor) d = new Date(d.getTime() + 7 * 86_400_000);
    if (!best || d.getTime() < best.getTime()) best = d;
  }
  return best;
}

export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Next Page slot as a datetime-local value (Composer schedule prefill). */
export function scheduleWhenForPage(slotsJson?: string | null, now = new Date()): string {
  const next = nextPostingSlot(slotsOrDefault(slotsJson), now);
  return next ? toLocalInput(next) : toLocalInput(new Date(now.getTime() + 24 * 60 * 60 * 1000));
}

export type WeekCell = {
  iso: string;
  label: string;
  weekday: string;
  scheduled: number;
  published: number;
  isToday: boolean;
};

export function buildWeekStrip(
  posts: Array<{
    scheduled_publish_time?: string | null;
    published_time?: string | null;
    created_at?: string;
    status?: string;
  }>,
  now = new Date(),
): WeekCell[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const cells: WeekCell[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    cells.push({
      iso: key,
      label: String(d.getDate()),
      weekday: DAY_NAMES[d.getDay()] ?? "",
      scheduled: 0,
      published: 0,
      isToday: i === 0,
    });
  }
  const index = new Map(cells.map((c) => [c.iso, c]));
  for (const p of posts) {
    const iso = p.scheduled_publish_time ?? p.published_time ?? p.created_at;
    if (!iso) continue;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const cell = index.get(key);
    if (!cell) continue;
    if (p.status === "Published") cell.published += 1;
    else if (p.status === "LocalScheduled" || p.status === "FacebookScheduled" || p.status === "Publishing") {
      cell.scheduled += 1;
    }
  }
  return cells;
}

export function plusDaysIso(iso: string, days: number): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const n = new Date();
    n.setDate(n.getDate() + days);
    return n.toISOString();
  }
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function parseOgTags(html: string): { title: string | null; description: string | null; image: string | null } {
  const prop = (name: string) => {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`,
      "i",
    );
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["']`,
      "i",
    );
    return re.exec(html)?.[1] ?? re2.exec(html)?.[1] ?? null;
  };
  const titleTag = /<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1] ?? null;
  return {
    title: decode(prop("og:title") ?? prop("twitter:title") ?? titleTag),
    description: decode(prop("og:description") ?? prop("twitter:description") ?? prop("description")),
    image: decode(prop("og:image") ?? prop("twitter:image")),
  };
}

function decode(v: string | null): string | null {
  if (!v) return null;
  return v
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
    .slice(0, 280);
}

export function unfurlHostBlocked(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) return true;
  if (h === "0.0.0.0" || h === "::1") return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const [a, b] = h.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && (b ?? 0) >= 16 && (b ?? 0) <= 31) return true;
    if (a === 169 && b === 254) return true;
  }
  if (/(^|\.)facebook\.com$|(^|\.)fb\.com$|(^|\.)fbcdn\.net$|(^|\.)instagram\.com$|(^|\.)meta\.com$/.test(h)) {
    return true;
  }
  return false;
}
