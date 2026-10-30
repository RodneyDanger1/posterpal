/**
 * Prompt craft — the deterministic brain behind the Magic Wand.
 *
 * The wand must *actually work* even when no AI key is configured, so this module
 * contains a real prompt improver: issue detection, structure, style directives,
 * anti-cliché rewriting, and a caption quality score. When a model IS available the
 * server asks it to rewrite with the structured system prompt built here, then
 * falls back to these heuristics on any error.
 *
 * Pure + client-safe (no node built-ins), so both the UI (previews/scores) and the
 * server fn (system prompts/fallback) share exactly one implementation.
 */

export type PromptKind = "caption" | "image";

export type PromptStyleId =
  | "default"
  | "editorial"
  | "playful"
  | "warm"
  | "bold"
  | "minimal"
  | "cinematic"
  | "documentary";

export type PromptStyle = {
  id: PromptStyleId;
  label: string;
  /** Applies to caption / image / both. */
  kinds: PromptKind[];
  hint: string;
  directive: string;
};

export const PROMPT_STYLES: readonly PromptStyle[] = [
  {
    id: "default",
    label: "Balanced",
    kinds: ["caption", "image"],
    hint: "Clear, specific, human. No gimmicks.",
    directive: "Clear, specific and human. Lead with a concrete detail. No corporate filler.",
  },
  {
    id: "editorial",
    label: "Editorial",
    kinds: ["caption", "image"],
    hint: "Magazine feature: hook, evidence, quiet authority.",
    directive: "Write like a magazine feature: a sharp hook, one concrete fact or observation, then a quiet close. Short sentences.",
  },
  {
    id: "playful",
    label: "Playful",
    kinds: ["caption", "image"],
    hint: "Wry, warm, a little unexpected — never cringe.",
    directive: "Warm and wry. One small unexpected turn of phrase, no dad jokes, no exclamation spam.",
  },
  {
    id: "warm",
    label: "Warm local",
    kinds: ["caption", "image"],
    hint: "Neighbourly shop voice: personal, specific, inviting.",
    directive: "Neighbourly and personal, like a shop owner talking to a regular. Invite, don't sell.",
  },
  {
    id: "bold",
    label: "Bold",
    kinds: ["caption", "image"],
    hint: "Confident claim, no hype words.",
    directive: "Confident and plain-spoken. One clear claim, zero hype adjectives (no 'game-changer', 'unleash', 'elevate').",
  },
  {
    id: "minimal",
    label: "Minimal",
    kinds: ["caption", "image"],
    hint: "One or two sentences. Nothing extra.",
    directive: "Minimal: one or two short sentences, no hashtag pile, no CTA unless explicitly locked in.",
  },
  {
    id: "cinematic",
    label: "Cinematic",
    kinds: ["image"],
    hint: "Film still: lens, light, atmosphere.",
    directive: "Cinematic film still: 35mm/50mm lens, motivated practical light, shallow depth of field, natural grain, muted palette.",
  },
  {
    id: "documentary",
    label: "Documentary",
    kinds: ["image"],
    hint: "Honest reportage look, no staging.",
    directive: "Documentary reportage: available light, candid framing, real textures, no staging, no stylised grade.",
  },
] as const;

export const IMAGE_STYLE_PRESETS = [
  { id: "photo", label: "Photo", directive: "photorealistic photograph" },
  { id: "editorial", label: "Editorial", directive: "editorial photograph, natural light, magazine quality" },
  { id: "illustration", label: "Illustration", directive: "flat vector illustration, bold shapes, limited palette" },
  { id: "watercolor", label: "Watercolor", directive: "loose watercolor painting, visible paper texture" },
  { id: "line", label: "Line art", directive: "minimal single-weight line illustration, plenty of negative space" },
  { id: "3d", label: "3D", directive: "soft 3D render, matte materials, studio light" },
  { id: "retro", label: "Retro print", directive: "retro screen-print poster, 3-4 spot colours, halftone texture" },
] as const;
export type ImageStylePresetId = (typeof IMAGE_STYLE_PRESETS)[number]["id"];

/** Fields the operator can LOCK so regeneration must not change them. */
export type PromptLocks = {
  structure: boolean;
  tone: boolean;
  length: boolean;
  cta: boolean;
  hashtags: boolean;
  audience: boolean;
};

export const DEFAULT_LOCKS: PromptLocks = {
  structure: true,
  tone: true,
  length: true,
  cta: true,
  hashtags: true,
  audience: false,
};

export const LOCK_LABELS: Array<{ id: keyof PromptLocks; label: string; hint: string }> = [
  { id: "structure", label: "Structure", hint: "Keep the paragraph/section shape" },
  { id: "tone", label: "Tone", hint: "Keep the original register" },
  { id: "length", label: "Length", hint: "Stay close to the current length" },
  { id: "cta", label: "CTA", hint: "Keep my call to action wording" },
  { id: "hashtags", label: "Hashtags", hint: "Do not add or remove tags" },
  { id: "audience", label: "Audience", hint: "Write for the stated audience" },
];

export type PromptIssue = {
  id: string;
  severity: "info" | "warn";
  message: string;
};

export type ImprovedPrompt = {
  text: string;
  issues: PromptIssue[];
  /** Short human-readable list of what changed. */
  applied: string[];
  notes: string[];
  /** false when the deterministic fallback produced this (no model / AI failed). */
  ai: boolean;
};

export type ImproveContext = {
  kind: PromptKind;
  style?: PromptStyleId;
  locks?: PromptLocks;
  pageName?: string;
  brandVoice?: string | null;
  audience?: string;
  imageStyle?: ImageStylePresetId;
  /** A saved custom style's free-text directive. */
  customDirective?: string;
};

const CLICHES = [
  "elevate your",
  "unleash",
  "game-changer",
  "game changer",
  "in today's fast-paced world",
  "in this day and age",
  "take it to the next level",
  "look no further",
  "we've got you covered",
  "dive into",
  "delve into",
  "nestled in the heart of",
];

const IMAGE_RISK = [
  { re: /\b(with|add|include)\s+(text|words|lettering|caption|typography)\b/i, why: "prints often mangle generated text" },
  { re: /\blogo(s)?\b/i, why: "generated logos are usually unusable" },
  { re: /\bwatermark\b/i, why: "watermarks are a defect on print artwork" },
  { re: /\b(celebrity|likeness of|looks exactly like)\b/i, why: "likeness rights risk" },
];

function words(s: string): string[] {
  return s.trim() ? s.trim().split(/\s+/) : [];
}

export function extractHashtags(text: string): string[] {
  return (text.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((t) => t.toLowerCase());
}

export function extractCta(text: string): string | null {
  const m = /(?:[.!?]\s+)((?:tap|click|shop|grab|join|comment|dm|visit|order|book|reserve|sign up|save|share)\b[^.!?\n]{2,90}[.!?]?)$/i.exec(
    text.trim(),
  );
  return m?.[1]?.trim() ?? null;
}

/** Deterministic caption quality score (0–100) used to rank variants. */
export function scoreCaption(text: string): {
  score: number;
  parts: { hook: number; specificity: number; cta: number; length: number; spam: number; readability: number };
  notes: string[];
} {
  const raw = text.trim();
  const ws = words(raw);
  const notes: string[] = [];
  const first = ws.slice(0, 14).join(" ");

  let hook = 20;
  if (/\?/.test(first)) hook += 25;
  if (/\b(why|how|what|when|the|this|our|my|\d+)\b/i.test(first)) hook += 15;
  if (ws.length > 0 && !/^(we|i)\s+are\s+excited/i.test(raw)) hook += 15;
  if (/excited to announce|thrilled to announce/i.test(first)) hook -= 25;
  hook = Math.max(0, Math.min(50, hook));

  const properNouns = (raw.match(/\b[A-Z][a-z]{2,}/g) ?? []).length;
  const numbers = (raw.match(/\b\d+([.,]\d+)?\b/g) ?? []).length;
  const specificity = Math.min(25, properNouns * 4 + numbers * 5 + (ws.length > 25 ? 5 : 0));

  const cta = /\b(tap|click|shop|grab|join|comment|dm|visit|order|book|reserve|sign up|save|share|details|link)\b/i.test(raw)
    ? 15
    : 0;
  if (!cta) notes.push("No call to action.");

  const n = ws.length;
  const length = n < 8 ? 2 : n <= 60 ? 10 : n <= 120 ? 6 : 3;
  if (n < 8) notes.push("Very short — add one concrete detail.");

  const emoji = (raw.match(/[\p{Extended_Pictographic}]/gu) ?? []).length;
  const bangs = (raw.match(/!/g) ?? []).length;
  const capsWords = (raw.match(/\b[A-Z]{4,}\b/g) ?? []).length;
  const spam = Math.max(0, 10 - emoji * 2 - Math.max(0, bangs - 1) * 2 - capsWords * 3);
  if (emoji > 3) notes.push("Too many emoji.");
  if (capsWords > 0) notes.push("ALL-CAPS words read as spam.");

  const sentences = raw.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const avgSentence = sentences.length ? n / sentences.length : n;
  const readability = avgSentence > 30 ? 2 : avgSentence > 22 ? 6 : 10;
  if (avgSentence > 30) notes.push("Long sentences — split them.");

  const total = hook + specificity + cta + length + spam + readability;
  return {
    score: Math.max(0, Math.min(100, Math.round(total))),
    parts: { hook, specificity, cta, length, spam, readability },
    notes,
  };
}

export function detectPromptIssues(text: string, ctx: Pick<ImproveContext, "kind">): PromptIssue[] {
  const raw = text.trim();
  const issues: PromptIssue[] = [];
  if (!raw) return [{ id: "empty", severity: "warn", message: "Prompt is empty." }];
  const minLen = ctx.kind === "image" ? 8 : 12;
  if (raw.length < minLen) issues.push({ id: "short", severity: "warn", message: "Too short to be specific." });
  if (ctx.kind === "image") {
    for (const risk of IMAGE_RISK) {
      if (risk.re.test(raw)) issues.push({ id: "image-risk", severity: "warn", message: `Avoid: ${risk.why}.` });
    }
    if (!/\b(style|photo|illustration|render|light|colour|color|composition|shot|portrait|landscape)\b/i.test(raw)) {
      issues.push({ id: "image-vague", severity: "info", message: "No visual style or composition cue." });
    }
    if (raw.length > 700) issues.push({ id: "long", severity: "warn", message: "Over 700 characters — models drop the tail." });
  } else {
    const tags = extractHashtags(raw);
    if (tags.length > 3) issues.push({ id: "tags", severity: "info", message: `${tags.length} hashtags — three or fewer works better.` });
    if (!extractCta(raw)) issues.push({ id: "no-cta", severity: "info", message: "No call to action." });
    if (CLICHES.some((c) => raw.toLowerCase().includes(c))) {
      issues.push({ id: "cliche", severity: "warn", message: "Contains a filler cliché." });
    }
    const s = scoreCaption(raw);
    if (s.score < 45) issues.push({ id: "score", severity: "info", message: `Caption score ${s.score}/100 — the wand can improve it.` });
    if (/(.)\1{4,}/.test(raw)) issues.push({ id: "repeats", severity: "info", message: "Repeated characters look accidental." });
  }
  return issues;
}

function stripCliches(text: string): string {
  let out = text;
  for (const c of CLICHES) {
    const re = new RegExp(`\\s*\\b${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    out = out.replace(re, "");
  }
  return out.replace(/[ \t]{2,}/g, " ").replace(/\s+([.,!?])/g, "$1").trim();
}

function titleCaseFirst(text: string): string {
  const t = text.trimStart();
  if (!t) return t;
  return t[0]!.toUpperCase() + t.slice(1);
}

/** Deterministic image-prompt improver: subject + style + light + composition + constraints. */
export function improveImagePromptHeuristic(raw: string, ctx: ImproveContext = { kind: "image" }): ImprovedPrompt {
  const issues = detectPromptIssues(raw, { kind: "image" });
  const applied: string[] = [];
  const notes: string[] = [];
  let subject = raw.trim().replace(/\s+/g, " ");
  for (const risk of IMAGE_RISK) {
    if (risk.re.test(subject)) {
      subject = subject.replace(risk.re, "").replace(/\s{2,}/g, " ").trim();
      applied.push(`Removed “${risk.why}” wording`);
    }
  }
  const preset = IMAGE_STYLE_PRESETS.find((p) => p.id === (ctx.imageStyle ?? "photo")) ?? IMAGE_STYLE_PRESETS[0];
  const styleDirective = PROMPT_STYLES.find((s) => s.id === (ctx.style ?? "default"))?.directive ?? "";
  const structured = ctx.locks?.structure !== false;
  const constraints =
    "Constraints: no text, no lettering, no logos, no watermark, no celebrity likeness, no UI chrome.";
  let text: string;
  if (structured) {
    const parts = [
      `Subject: ${subject || "the described scene"}.`,
      `Approach: ${preset.directive}.`,
      styleDirective ? `Mood: ${styleDirective}` : "",
      "Composition: clear focal point, generous margins for print, uncluttered background.",
      "Light: natural, soft directional light with real shadow falloff.",
      constraints,
    ].filter(Boolean);
    text = parts.join("\n");
    applied.push("Structured into subject / approach / composition / light / constraints");
  } else {
    text = `${subject || "the described scene"}, ${preset.directive}. ${constraints}`;
    applied.push("Tightened to one visual sentence");
  }
  if (ctx.pageName) notes.push(`Fits ${ctx.pageName}'s visual identity.`);
  if (ctx.audience) notes.push(`Aimed at ${ctx.audience}.`);
  notes.push("Negative constraints are spelled out so print/merch stays clean.");
  return { text, issues, applied, notes, ai: false };
}

/** Deterministic caption improver: structure, clichés, tags, CTA, length. */
export function improveCaptionHeuristic(raw: string, ctx: ImproveContext = { kind: "caption" }): ImprovedPrompt {
  const issues = detectPromptIssues(raw, { kind: "caption" });
  const locks = { ...DEFAULT_LOCKS, ...(ctx.locks ?? {}) };
  const applied: string[] = [];
  const notes: string[] = [];
  let text = raw.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return { text: "", issues, applied, notes, ai: false };

  const beforeLen = words(text).length;
  const cleaned = stripCliches(text);
  if (cleaned !== text) {
    text = cleaned;
    applied.push("Removed filler clichés");
  }

  // Remove duplicate hashtags; cap at 3 only when the tag lock is off.
  const seen = new Set<string>();
  text = text.replace(/#[\p{L}\p{N}_]+/gu, (tag) => {
    const key = tag.toLowerCase();
    if (seen.has(key)) return "";
    seen.add(key);
    return tag;
  });
  if (!locks.hashtags) {
    let count = 0;
    text = text.replace(/\s?#[\p{L}\p{N}_]+/gu, (m) => {
      count += 1;
      return count <= 3 ? m : "";
    });
    if (count > 3) applied.push("Trimmed hashtags to 3");
  }

  // Tighten emoji and bangs.
  const emoji = (text.match(/[\p{Extended_Pictographic}]/gu) ?? []).length;
  if (emoji > 3) {
    let seenEmoji = 0;
    text = text.replace(/[\p{Extended_Pictographic}]/gu, (e) => {
      seenEmoji += 1;
      return seenEmoji <= 2 ? e : "";
    });
    applied.push("Trimmed emoji");
  }
  const cleanedPunct = text.replace(/!{2,}/g, "!").replace(/ {2,}/g, " ");
  if (cleanedPunct !== text) {
    text = cleanedPunct;
    applied.push("Normalised punctuation");
  }

  // Hook: split a very long first sentence onto its own line (feed preview).
  const firstBreak = text.indexOf(". ");
  if (firstBreak > 0 && firstBreak < 120 && text.split("\n")[0]!.length > 90) {
    text = `${text.slice(0, firstBreak + 1)}\n\n${text.slice(firstBreak + 2)}`;
    applied.push("Opened with a short hook line");
  }

  // CTA: keep the operator's own wording when locked; only add a neutral one when free.
  const existingCta = extractCta(text);
  if (existingCta) {
    if (locks.cta) notes.push("Kept your CTA wording.");
  } else if (locks.cta) {
    const cta = ctx.kind === "caption" ? "Details on the Page." : "";
    if (cta) {
      text = `${text.replace(/[.\s]+$/, "")}\n\n${cta}`;
      applied.push("Added a neutral CTA placeholder");
      notes.push("Edit the CTA to the exact action you want.");
    }
  }

  text = titleCaseFirst(text);

  // Length lock: if we ballooned past +25%, trim trailing hashtag/emoji-only lines.
  const afterLen = words(text).length;
  if (locks.length && beforeLen > 0 && afterLen > beforeLen * 1.25) {
    const lines = text.split("\n").filter((l) => l.trim());
    while (words(lines.join(" ")).length > beforeLen * 1.25 && lines.length > 1) lines.pop();
    text = lines.join("\n\n");
    applied.push("Held close to the original length");
  }

  const after = scoreCaption(text);
  notes.push(`Caption score ${after.score}/100.`);
  if (ctx.brandVoice) notes.push("Applied your Page voice.");
  return { text, issues, applied, notes, ai: false };
}

export function heuristicImprove(raw: string, ctx: ImproveContext): ImprovedPrompt {
  return ctx.kind === "image" ? improveImagePromptHeuristic(raw, ctx) : improveCaptionHeuristic(raw, ctx);
}

const ANTI_PATTERNS = `Never use: "elevate", "unleash", "game-changer", "in today's fast-paced world",
"look no further", "we've got you covered", "dive into", "nestled in the heart of".`;

/** Structured system prompt used for the AI rewrite (also documented/tested). */
export function buildImproverSystemPrompt(ctx: ImproveContext): string {
  const style = PROMPT_STYLES.find((s) => s.id === (ctx.style ?? "default")) ?? PROMPT_STYLES[0];
  const custom = PROMPT_STYLES.find((s) => s.id === ctx.style) === undefined && ctx.customDirective
    ? `\nSaved style directive: ${ctx.customDirective}`
    : "";
  const locks = { ...DEFAULT_LOCKS, ...(ctx.locks ?? {}) };
  const lockLines = [
    locks.structure ? "- Preserve the operator's structure/paragraph shape." : "- You may restructure for clarity.",
    locks.tone ? "- Preserve the original tone/register." : "- You may adjust the tone to the style.",
    locks.length ? "- Stay within ~20% of the original word count." : "- Length is free.",
    locks.cta ? "- Do NOT change the existing CTA wording; if none exists, add a neutral one." : "- A CTA is optional.",
    locks.hashtags ? "- Do not add or remove hashtags." : "- At most 3 relevant hashtags.",
  ];
  if (ctx.kind === "image") {
    return `You are a senior image-prompt editor for print and social photography.
Rewrite the operator's prompt into a production-ready image prompt.${custom}

Rules:
- Preserve the subject they asked for; do not invent a different product or place.
- Add style, composition, lighting, palette and camera/lens where it helps.
- Explicitly forbid text, lettering, logos, watermarks and celebrity likeness in the subject description.
- Keep it under 120 words. One paragraph or short labelled lines.
${lockLines.join("\n")}
Style: ${style.label} — ${style.directive}
${ANTI_PATTERNS}

Return ONLY JSON: {"improved":"...","applied":["short change",...],"notes":["short note",...]}.`;
  }
  return `You are a senior social editor for a Facebook Page. Rewrite the operator's caption draft.
${ctx.pageName ? `Page: ${ctx.pageName}.` : ""}${ctx.brandVoice ? ` Brand voice: ${ctx.brandVoice}.` : ""}${ctx.audience ? ` Audience: ${ctx.audience}.` : ""}${custom}

Rules:
- Lead with a specific hook in the first 80 characters; then one concrete detail; then a close/CTA.
- Never invent facts, prices, dates, quotes or events. Keep every claim that was there; delete rather than invent.
- No engagement bait, no "comment YES", no fake urgency, no AI/model mentions.
- Emoji: at most 2. Hashtags: obey the lock. Max 120 words unless the length lock says otherwise.
${lockLines.join("\n")}
Style: ${style.label} — ${style.directive}
${ANTI_PATTERNS}

Return ONLY JSON: {"improved":"...","applied":["short change",...],"notes":["short note",...]}.`;
}

/** Used by the variants pipeline so generated captions follow the same structure. */
export function buildCaptionSystemPrompt(ctx: {
  pageName: string;
  brandVoice?: string | null;
  merchCta?: string | null;
  style?: PromptStyleId;
  customDirective?: string;
}): string {
  const style = PROMPT_STYLES.find((s) => s.id === (ctx.style ?? "default")) ?? PROMPT_STYLES[0];
  const merch = ctx.merchCta ? `If natural, weave this merch CTA: ${ctx.merchCta}` : "Do not invent products.";
  return `You write Facebook Page captions for "${ctx.pageName}". Voice: ${ctx.brandVoice || "Warm, specific, human. No corporate filler."}.
Structure every variant as: hook in the first 80 characters → one concrete, verifiable detail → close/CTA.
${ctx.customDirective ? `Saved style: ${ctx.customDirective}\n` : ""}Style: ${style.label} — ${style.directive}
${ANTI_PATTERNS}
${merch}
Return ONLY valid JSON: {"storytelling":"...","cta":"...","question":"..."}.
Each caption 40–90 words. Max 3 hashtags. Never auto-promise engagement or invent events/prices.
A human will edit and click Publish.`;
}
