import type { PolicyFlag, PolicyResult } from "./types";

const STOP = new Set([
  "the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "with", "at",
  "is", "it", "this", "that", "we", "our", "you", "your", "are", "be", "as",
]);

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

export function runPolicyChecklist(input: {
  message: string;
  link?: string | null;
  merchUrl?: string | null;
  hasImages: boolean;
  missingAlt: boolean;
  createdWithAi: boolean;
  recentMessages: Array<{ id: string; message: string; engagement?: number }>;
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
  if (sec > 0 && (sec < 3 || sec > 60)) {
    return `Reels must be 3–60 seconds. This file is ${sec.toFixed(1)}s.`;
  }
  return null;
}
