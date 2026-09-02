/** Pure fleet-ops helpers. No I/O. Safe on client or server. */

import { isRemixDraft, jaccard, REMIX_MARK, tokenize } from "./policy";

export { isRemixDraft, REMIX_MARK };

export type CaptionHit = { pageId: string; pageName: string; message: string; postId?: string };

export type Collision = {
  pageA: string;
  pageB: string;
  score: number;
  excerpt: string;
};

export type LinkInspect = {
  ok: boolean;
  host: string;
  hasUtm: boolean;
  isHttps: boolean;
  looksMerch: boolean;
  warning: string | null;
};

const MERCH_HOST =
  /\b(etsy|shopify|amazon|gumroad|printful|square\.site|bigcartel|storenvy)\b/i;

/** Official Page post permalink. Opening facebook.com in the operator's browser is not scraping. */
export function facebookPermalink(facebookPostId: string | null | undefined): string | null {
  if (!facebookPostId || facebookPostId.startsWith("practice_")) return null;
  return `https://www.facebook.com/${facebookPostId}`;
}

export function inspectLink(raw: string): LinkInspect | null {
  const v = raw.trim();
  if (!v) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
  } catch {
    return {
      ok: false,
      host: "",
      hasUtm: false,
      isHttps: false,
      looksMerch: false,
      warning: "That is not a URL Facebook can attach.",
    };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, host: url.host, hasUtm: false, isHttps: false, looksMerch: false, warning: "Use http:// or https://." };
  }
  const hasUtm = [...url.searchParams.keys()].some((k) => k.toLowerCase().startsWith("utm_"));
  const looksMerch = MERCH_HOST.test(url.host) || /shop|store|cart|product/i.test(url.pathname);
  let warning: string | null = null;
  if (url.protocol !== "https:") warning = "Facebook prefers https links. http previews often fail.";
  else if (looksMerch && !hasUtm) warning = "Shop link with no UTM. Add utm_source=facebook so analytics can credit the Page.";
  else if (looksMerch) warning = "Shop link — add #ad or Paid partnership in the caption if you earn from this.";
  return { ok: true, host: url.host, hasUtm, isHttps: url.protocol === "https:", looksMerch, warning };
}

/** Identical copy across Pages is the inauthentic-behavior pattern Meta suspends fleets for. */
export function findCollisions(hits: CaptionHit[], threshold = 0.72): Collision[] {
  const out: Collision[] = [];
  const seenPair = new Set<string>();
  for (let i = 0; i < hits.length; i += 1) {
    const a = hits[i]!;
    const ta = tokenize(a.message);
    if (ta.length < 4) continue;
    for (let j = i + 1; j < hits.length; j += 1) {
      const b = hits[j]!;
      if (a.pageId === b.pageId) continue;
      const pair = a.pageId < b.pageId ? `${a.pageId}:${b.pageId}` : `${b.pageId}:${a.pageId}`;
      if (seenPair.has(pair)) continue;
      const score = jaccard(ta, tokenize(b.message));
      if (score < threshold) continue;
      seenPair.add(pair);
      out.push({
        pageA: a.pageName,
        pageB: b.pageName,
        score,
        excerpt: a.message.slice(0, 120),
      });
      if (out.length >= 8) return out.sort((x, y) => y.score - x.score);
    }
  }
  return out.sort((x, y) => y.score - x.score);
}

export function daysSince(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now - t) / 86_400_000));
}

/** Attach default Facebook UTMs and upgrade http→https when the URL is otherwise valid. */
export function withDefaultUtm(raw: string): string {
  const v = raw.trim();
  if (!v) return v;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (u.protocol === "http:") u.protocol = "https:";
    if (![...u.searchParams.keys()].some((k) => k.toLowerCase().startsWith("utm_"))) {
      u.searchParams.set("utm_source", "facebook");
      u.searchParams.set("utm_medium", "social");
      u.searchParams.set("utm_campaign", "page");
    }
    return u.toString();
  } catch {
    return v;
  }
}

export function mixAdvice(mix: Record<string, number>): string {
  const photo = Number(mix.Photo ?? 0) + Number(mix.Carousel ?? 0);
  const video = Number(mix.Video ?? 0) + Number(mix.Reel ?? 0);
  const text = Number(mix.Text ?? 0);
  const total = photo + video + text + Number(mix.Story ?? 0);
  if (total < 3) return "Not enough published posts yet to judge mix. Ship a Photo, a caption, and a Reel on different days.";
  if (photo === 0) return "No photo posts in the mix. Feed stills still outperform text-only on most local Pages.";
  if (video === 0 && total >= 8) return "No Reels/video. One 9:16 still-as-Reel a week is enough — do not spray identical Reels across Pages.";
  if (text > photo + video) return "Caption-only is crowding the mix. Pair offers with a still.";
  return "Mix looks usable. Keep each Page’s stills and captions unique.";
}

export function remixCaption(message: string | null | undefined): string {
  const m = (message ?? "").trim();
  if (!m) return m;
  if (isRemixDraft(m)) return m;
  return `${REMIX_MARK}\n\n${m}`;
}

export type IdentityIssue = {
  pageId: string;
  name: string;
  isPractice: boolean;
  uniqueness: number;
  issues: string[];
};

export function identityIssues(
  pages: Array<{
    id: string;
    name: string;
    is_practice: boolean;
    brand_voice: string | null;
    category: string | null;
  }>,
  metrics: Record<
    string,
    {
      uniqueness: number;
      merchCount: number;
      lastPublishedAt: string | null;
      nextScheduledAt: string | null;
    }
  > = {},
): IdentityIssue[] {
  const names = pages.map((p) => p.name.trim().toLowerCase());
  const out: IdentityIssue[] = [];
  for (const p of pages) {
    const m = metrics[p.id];
    const issues: string[] = [];
    if (!p.brand_voice?.trim()) issues.push("No brand voice");
    if (!p.category?.trim()) issues.push("No category");
    if (!p.is_practice && (m?.merchCount ?? 0) === 0) issues.push("No merch links");
    if ((m?.uniqueness ?? 100) < 55) issues.push(`Caption overlap ${m?.uniqueness ?? 0}`);
    if (!p.is_practice && !m?.lastPublishedAt && !m?.nextScheduledAt) issues.push("Never published, nothing queued");
    const dup = names.filter((n) => n === p.name.trim().toLowerCase()).length > 1;
    if (dup) issues.push("Duplicate Page name");
    if (issues.length) {
      out.push({
        pageId: p.id,
        name: p.name,
        isPractice: p.is_practice,
        uniqueness: m?.uniqueness ?? 100,
        issues,
      });
    }
  }
  return out;
}
