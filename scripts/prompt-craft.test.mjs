import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_LOCKS,
  IMAGE_STYLE_PRESETS,
  LOCK_LABELS,
  PROMPT_STYLES,
  buildCaptionSystemPrompt,
  buildImproverSystemPrompt,
  detectPromptIssues,
  extractCta,
  heuristicImprove,
  improveCaptionHeuristic,
  improveImagePromptHeuristic,
  scoreCaption,
} from "../src/lib/posterpal/prompt-craft.ts";

// The Magic Wand must work without an AI key. These tests pin the deterministic
// improver: structure, clichés, tags, CTA, locks, and the quality score.

test("style presets are unique and cover both prompt kinds", () => {
  const ids = PROMPT_STYLES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(PROMPT_STYLES.some((s) => s.kinds.includes("caption")));
  assert.ok(PROMPT_STYLES.some((s) => s.kinds.includes("image")));
  assert.ok(IMAGE_STYLE_PRESETS.length >= 6);
  assert.equal(LOCK_LABELS.length, 6);
});

test("issue detection catches image risks and caption clichés", () => {
  const img = detectPromptIssues("a tee with our logo, add text saying TRAIL, watermark please", { kind: "image" });
  assert.ok(img.some((i) => i.message.includes("prints often mangle")));
  assert.ok(img.some((i) => i.message.includes("logos")));
  assert.ok(img.some((i) => i.message.includes("watermark")));

  const cap = detectPromptIssues("We are excited to elevate your game-changer offer!", { kind: "caption" });
  assert.ok(cap.some((i) => i.id === "cliche"));
  assert.ok(cap.some((i) => i.id === "no-cta"));
  assert.ok(detectPromptIssues("", { kind: "caption" })[0].id === "empty");
});

test("image improver builds a structured, print-safe prompt", () => {
  const out = improveImagePromptHeuristic("a canvas tote bag with our logo, moody", {
    kind: "image",
    imageStyle: "editorial",
    style: "cinematic",
  });
  assert.match(out.text, /Subject:/);
  assert.match(out.text, /Composition:/);
  assert.match(out.text, /no text, no lettering, no logos, no watermark/i);
  assert.ok(!/our logo/i.test(out.text), "logo wording stripped");
  assert.match(out.text, /editorial photograph/i);
  assert.equal(out.ai, false);
  assert.ok(out.applied.length >= 1);
});

test("image improver without structure lock returns one tight sentence", () => {
  const out = improveImagePromptHeuristic("trail at sunrise", {
    kind: "image",
    locks: { ...DEFAULT_LOCKS, structure: false },
  });
  assert.ok(!out.text.includes("\nSubject:"));
  assert.match(out.text, /trail at sunrise/i);
  assert.match(out.text, /no text/i);
});

test("caption improver removes clichés and normalises punctuation", () => {
  const out = improveCaptionHeuristic("we are excited to unleash our new game-changer tote!!!", { kind: "caption" });
  assert.ok(!/unleash|game-changer/i.test(out.text));
  assert.ok(!/!!!/.test(out.text));
  assert.match(out.text, /Details on the Page\./, "neutral CTA added when none existed");
  assert.ok(out.applied.some((a) => /cliché/i.test(a)));
});

test("caption improver caps hashtags only when the hashtag lock is off", () => {
  const many = "New tote #shop #canvas #gift #local #winona #style";
  const free = improveCaptionHeuristic(many, { kind: "caption", locks: { ...DEFAULT_LOCKS, hashtags: false } });
  assert.ok((free.text.match(/#/g) ?? []).length <= 3);
  const locked = improveCaptionHeuristic(many, { kind: "caption", locks: { ...DEFAULT_LOCKS, hashtags: true } });
  assert.ok((locked.text.match(/#/g) ?? []).length >= 4, "locked tags preserved");
});

test("caption improver keeps the operator's CTA wording when locked", () => {
  const src = "Restock Friday. Tap the link to shop the tote.";
  const out = improveCaptionHeuristic(src, { kind: "caption", locks: { ...DEFAULT_LOCKS, cta: true } });
  assert.ok(out.notes.some((n) => /Kept your CTA/i.test(n)));
  assert.match(out.text, /Tap the link to shop the tote\./i);
});

test("caption improver respects the length lock", () => {
  const src = "Short note.";
  const out = improveCaptionHeuristic(src, { kind: "caption", locks: { ...DEFAULT_LOCKS, length: true, cta: false } });
  assert.ok(out.text.split(/\s+/).length <= 12);
});

test("heuristicImprove routes by kind", () => {
  const cap = heuristicImprove("hello", { kind: "caption" });
  const img = heuristicImprove("hello", { kind: "image" });
  assert.match(img.text, /Subject:/);
  assert.doesNotMatch(cap.text, /Subject:/);
});

test("scoreCaption rewards specificity and CTA over vague filler", () => {
  const vague = scoreCaption("New stuff available now.");
  const strong = scoreCaption("The Winona canvas tote is back Friday — 40 made, $32. Tap the link to grab one.");
  assert.ok(strong.score > vague.score, `${strong.score} > ${vague.score}`);
  assert.ok(vague.notes.length > 0, `vague notes: ${vague.notes.join(" | ")}`);
  assert.ok(strong.parts.cta > 0, "strong caption should have CTA points");
});

test("extractCta finds a trailing call to action", () => {
  assert.equal(extractCta("Doors 7pm. Tap the link to reserve."), "Tap the link to reserve.");
  assert.equal(extractCta("Just a plain caption here."), null);
});

test("caption system prompt carries style, anti-cliché list and page voice", () => {
  const p = buildCaptionSystemPrompt({ pageName: "North Shore Books", style: "editorial", brandVoice: "warm" });
  assert.match(p, /North Shore Books/);
  assert.match(p, /magazine feature/i);
  assert.match(p, /Never use/);
  assert.match(p, /hook in the first 80 characters/i);
});

test("improver system prompt states locks explicitly", () => {
  const p = buildImproverSystemPrompt({
    kind: "caption",
    locks: { ...DEFAULT_LOCKS, cta: true, hashtags: true },
    style: "minimal",
  });
  assert.match(p, /Do NOT change the existing CTA wording/);
  assert.match(p, /Do not add or remove hashtags/);
  assert.match(p, /Minimal/);
  assert.match(p, /Return ONLY JSON/);
});

test("image improver system prompt forbids text/logos and likeness", () => {
  const p = buildImproverSystemPrompt({ kind: "image", style: "cinematic" });
  assert.match(p, /text, lettering, logos, watermarks/);
  assert.match(p, /celebrity likeness/);
  assert.match(p, /under 120 words/i);
});
