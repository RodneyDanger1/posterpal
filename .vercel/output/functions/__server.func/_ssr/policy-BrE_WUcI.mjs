//#region node_modules/.nitro/vite/services/ssr/assets/policy-BrE_WUcI.js
var STOP = /* @__PURE__ */ new Set([
	"the",
	"a",
	"an",
	"and",
	"or",
	"to",
	"of",
	"in",
	"on",
	"for",
	"with",
	"at",
	"is",
	"it",
	"this",
	"that",
	"we",
	"our",
	"you",
	"your",
	"are",
	"be",
	"as"
]);
function tokenize(text) {
	return text.toLowerCase().replace(/https?:\/\/\S+/g, " ").split(/[^a-z0-9#]+/).filter((w) => w.length > 1 && !STOP.has(w));
}
function jaccard(a, b) {
	if (a.length === 0 && b.length === 0) return 1;
	const A = new Set(a);
	const B = new Set(b);
	let inter = 0;
	for (const t of A) if (B.has(t)) inter += 1;
	const union = A.size + B.size - inter;
	return union === 0 ? 0 : inter / union;
}
var DISCLOSURE_RE = /\b(paid partnership|paid partnership with|#ad\b|#sponsored|sponsored by|gifted|ambassador)\b/i;
var MERCH_HINT_RE = /\b(shop|buy|store|etsy|amazon|merch|tee|hoodie|printful|shopify|gumroad)\b/i;
function runPolicyChecklist(input) {
	const flags = [];
	const caption = input.message.trim();
	const tokens = tokenize(caption);
	if (!caption) flags.push({
		id: "empty-caption",
		severity: "block",
		title: "Empty caption",
		detail: "Write a caption before publishing. Empty feed posts look unfinished and underperform."
	});
	const similar = input.recentMessages.map((p) => ({
		id: p.id,
		message: p.message,
		score: jaccard(tokens, tokenize(p.message)),
		engagement: p.engagement ?? 0
	})).filter((p) => p.score >= .35).sort((a, b) => b.score - a.score).slice(0, 5);
	const duplicateScore = similar[0]?.score ?? 0;
	if (duplicateScore >= .82) flags.push({
		id: "duplicate",
		severity: "block",
		title: "Near-duplicate caption",
		detail: `This is ${(duplicateScore * 100).toFixed(0)}% similar to a recent post. High-frequency identical posts are a spam risk.`
	});
	else if (duplicateScore >= .55) flags.push({
		id: "similar",
		severity: "warn",
		title: "Similar to a recent post",
		detail: `Closest match is ${(duplicateScore * 100).toFixed(0)}% similar. Consider a fresh angle.`
	});
	if ((Boolean(input.merchUrl) || MERCH_HINT_RE.test(caption) || MERCH_HINT_RE.test(input.link ?? "")) && !DISCLOSURE_RE.test(caption)) flags.push({
		id: "branded-content",
		severity: "warn",
		title: "Missing branded-content disclosure",
		detail: "A merchandise or shop link is present. Add #ad, “Paid partnership”, or Facebook branded-content tags if this is commercial."
	});
	if (input.hasImages && input.missingAlt) flags.push({
		id: "alt-text",
		severity: "warn",
		title: "Missing alt text",
		detail: "Add alt text so screen-reader users and Graph photo uploads stay accessible."
	});
	if (input.createdWithAi) flags.push({
		id: "ai-media",
		severity: "info",
		title: "AI-media disclosure reminder",
		detail: "This media was generated with AI. Meta may require an AI-content label — disclose if the image or video is synthetic."
	});
	return {
		flags,
		canPublish: !flags.some((f) => f.severity === "block"),
		duplicateScore,
		similar
	};
}
function validateReel(meta) {
	const w = meta.width ?? 0;
	const h = meta.height ?? 0;
	const sec = (meta.durationMs ?? 0) / 1e3;
	if (w > 0 && h > 0) {
		const ratio = w / h;
		if (Math.abs(ratio - 9 / 16) > .08) return `Reels must be 9:16. This file is ${w}×${h}.`;
		if (w < 540 || h < 960) return `Reels need at least 540×960. This file is ${w}×${h}.`;
	}
	if (sec > 0 && (sec < 3 || sec > 60)) return `Reels must be 3–60 seconds. This file is ${sec.toFixed(1)}s.`;
	return null;
}
//#endregion
export { validateReel as n, runPolicyChecklist as t };
