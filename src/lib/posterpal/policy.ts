import type { PolicyFlag, PolicyResult } from "./types";

const STOP = new Set([
  "the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "with", "at",
  "is", "it", "this", "that", "we", "our", "you", "your", "are", "be", "as",
]);

/** LocalDraft marker so a recycled/cloned caption is never sent identical. */
export const REMIX_MARK = "REWRITE this in this Page's voice before sending — identical copy is a spam risk.";

export function isRemixDraft(message: string | null | undefined): boolean {
  return (message ?? "").trimStart().startsWith(REMIX_MARK);
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .split(/[^a-z0-9#]+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
}

export function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

const DISCLOSURE_RE =
  /(?:^|\s)(#ad\b|#sponsored\b)|\b(paid partnership(?: with)?|sponsored by|gifted|ambassador)\b/i;
const MERCH_HINT_RE =
  /\b(shop|buy|store|etsy|amazon|merch|tee|hoodie|printful|shopify|gumroad)\b/i;

/** Meta Reels Publishing API: 30 API-published posts / rolling 24h on POST /{page}/video_reels. */
export const REEL_API_CAP_24H = 30;
export const REEL_API_WARN_24H = 25;

export function reelCapLevel(count: number): "ok" | "warn" | "block" {
  if (count >= REEL_API_CAP_24H) return "block";
  if (count >= REEL_API_WARN_24H) return "warn";
  return "ok";
}

export function runPolicyChecklist(input: {
  message: string;
  link?: string | null;
  merchUrl?: string | null;
  hasImages: boolean;
  missingAlt: boolean;
  createdWithAi: boolean;
  recentMessages: Array<{ id: string; message: string; engagement?: number }>;
  /** Captions from OTHER Pages this operator runs. Identical copy across a
   * 10-Page fleet is the inauthentic-behavior pattern Meta suspends Pages for. */
  otherPageMessages?: Array<{ id: string; message: string; pageName: string }>;
  reelLast24h?: number;
}): PolicyResult {
  const flags: PolicyFlag[] = [];
  const caption = input.message.trim();
  const tokens = tokenize(caption);

  if (!caption) {
    flags.push({
      id: "empty-caption",
      severity: "block",
      title: "Empty caption",
      detail: "Write a caption before publishing. Empty feed posts look unfinished and underperform.",
    });
  }

  if (isRemixDraft(caption)) {
    flags.push({
      id: "remix-required",
      severity: "block",
      title: "Rewrite required",
      detail: "This is a recycle or clone draft. Rewrite it in this Page's voice, then send. Identical copy is a spam risk.",
    });
  }

  const similar = input.recentMessages
    .map((p) => ({
      id: p.id,
      message: p.message,
      score: jaccard(tokens, tokenize(p.message)),
      engagement: p.engagement ?? 0,
    }))
    .filter((p) => p.score >= 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const duplicateScore = similar[0]?.score ?? 0;
  if (duplicateScore >= 0.82) {
    flags.push({
      id: "duplicate",
      severity: "block",
      title: "Near-duplicate caption",
      detail: `This is ${(duplicateScore * 100).toFixed(0)}% similar to a recent post. High-frequency identical posts are a spam risk.`,
    });
  } else if (duplicateScore >= 0.55) {
    flags.push({
      id: "similar",
      severity: "warn",
      title: "Similar to a recent post",
      detail: `Closest match is ${(duplicateScore * 100).toFixed(0)}% similar. Consider a fresh angle.`,
    });
  }

  const otherHits = (input.otherPageMessages ?? [])
    .map((p) => ({
      id: p.id,
      pageName: p.pageName,
      message: p.message,
      score: jaccard(tokens, tokenize(p.message)),
    }))
    .filter((p) => p.score >= 0.55)
    .sort((a, b) => b.score - a.score);
  const cross = otherHits[0];
  if (cross && cross.score >= 0.82) {
    flags.push({
      id: "cross-page-duplicate",
      severity: "block",
      title: "Same caption as another Page",
      detail: `This is ${(cross.score * 100).toFixed(0)}% similar to a post on ${cross.pageName}. Unique Pages that share copy look like a spam network — Meta treats that as inauthentic behavior. Rewrite in this Page's voice.`,
    });
  } else if (cross) {
    flags.push({
      id: "cross-page-similar",
      severity: "warn",
      title: `Close to a ${cross.pageName} post`,
      detail: `${(cross.score * 100).toFixed(0)}% similar. Unique Pages need unique captions — change the angle before sending.`,
    });
  }

  const merchPresent = Boolean(input.merchUrl) || MERCH_HINT_RE.test(caption) || MERCH_HINT_RE.test(input.link ?? "");
  if (merchPresent && !DISCLOSURE_RE.test(caption)) {
    flags.push({
      id: "branded-content",
      severity: "warn",
      title: "Missing branded-content disclosure",
      detail: "A merchandise or shop link is present. Add #ad, “Paid partnership”, or Facebook branded-content tags if this is commercial.",
    });
  }

  if (input.hasImages && input.missingAlt) {
    flags.push({
      id: "alt-text",
      severity: "warn",
      title: "Missing alt text",
      detail: "Add alt text so screen-reader users and Graph photo uploads stay accessible.",
    });
  }

  if (input.createdWithAi) {
    flags.push({
      id: "ai-media",
      severity: "info",
      title: "AI still — operator reminder",
      detail: "This file was generated. Meta may auto-label realistic AI images. Do not present it as a documentary photo of a real event. This reminder stays on the desk — it is not added to the caption.",
    });
  }

  if (input.reelLast24h != null) {
    const reelLevel = reelCapLevel(input.reelLast24h);
    if (reelLevel === "block") {
      flags.push({
        id: "reel-cap",
        severity: "block",
        title: "Reels API 24h cap",
        detail: `${input.reelLast24h} Reels already count against Meta’s 30-per-24h moving window on POST /{page}/video_reels. Wait before publishing or Graph-scheduling another.`,
      });
    } else if (reelLevel === "warn") {
      flags.push({
        id: "reel-cap",
        severity: "warn",
        title: "Approaching Reels API cap",
        detail: `${input.reelLast24h} of 30 API Reels in 24h. Meta enforces this on publish, including scheduled Reels.`,
      });
    }
  }

  const canPublish = !flags.some((f) => f.severity === "block");
  return { flags, canPublish, duplicateScore, similar };
}

export function cadenceLevel(
  postedLast24h: number,
  warnAt: number,
  blockAt: number,
): "ok" | "warn" | "block" {
  if (postedLast24h >= blockAt) return "block";
  if (postedLast24h >= warnAt) return "warn";
  return "ok";
}

export function validateReel(meta: {
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
}): string | null {
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const sec = (meta.durationMs ?? 0) / 1000;
  if (w > 0 && h > 0) {
    const ratio = w / h;
    if (Math.abs(ratio - 9 / 16) > 0.08) {
      return `Reels must be 9:16. This file is ${w}×${h}.`;
    }
    if (w < 540 || h < 960) {
      return `Reels need at least 540×960. This file is ${w}×${h}.`;
    }
  }
  if (sec > 0 && (sec < 3 || sec > 90)) {
    return `Reels must be 3–90 seconds. This file is ${sec.toFixed(1)}s.`;
  }
  return null;
}
