import type { ContentAnalysis, Sentiment } from "./types";

const MODEL = "grok-4.5";

export function aiAvailable(): boolean {
  return Boolean(process.env.XAI_API_KEY);
}

async function chat(system: string, user: string, maxTokens = 700): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("AI is not available in this environment");
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.7,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`xAI API error ${res.status}: ${t.slice(0, 200)}`);
  }
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return body.choices?.[0]?.message?.content?.trim() ?? "";
}

export async function generateCaptionVariants(input: {
  brief: string;
  brandVoice?: string | null;
  pageName: string;
  merchCta?: string | null;
}): Promise<{ storytelling: string; cta: string; question: string }> {
  const voice = input.brandVoice || "Warm, specific, human. No corporate filler. No emoji spam.";
  const merch = input.merchCta ? `If natural, weave this merch CTA: ${input.merchCta}` : "Do not invent products.";
  const raw = await chat(
    `You write Facebook Page captions for "${input.pageName}". Voice: ${voice}.
Return ONLY valid JSON: {"storytelling":"...","cta":"...","question":"..."}.
Each caption 40–90 words. No hashtag dumps (max 3). Never auto-promise engagement.`,
    `Brief:\n${input.brief}\n\n${merch}\nWrite three variants: storytelling, direct CTA, and a genuine question.`,
    900,
  );
  const json = extractJson(raw);
  return {
    storytelling: String(json.storytelling ?? raw),
    cta: String(json.cta ?? ""),
    question: String(json.question ?? ""),
  };
}

export async function suggestHashtags(input: {
  caption: string;
  brandVoice?: string | null;
  pageName: string;
}): Promise<string[]> {
  const raw = await chat(
    `Suggest 6 relevant Facebook hashtags for the Page "${input.pageName}". Return JSON {"tags":["#foo"]}. No banned or spam tags.`,
    input.caption.slice(0, 800),
    200,
  );
  const json = extractJson(raw);
  const tags = Array.isArray(json.tags) ? json.tags.map(String) : [];
  return tags.filter((t) => t.startsWith("#")).slice(0, 8);
}

export async function analyzeContent(content: string): Promise<ContentAnalysis> {
  const raw = await chat(
    `Analyze this Facebook comment or caption. Return JSON:
{"sentiment":"positive|neutral|negative|question","topics":[],"riskFlags":[],"suggestedHashtags":[]}.
riskFlags are policy risks (hate, spam, scams), not style notes.`,
    content.slice(0, 2000),
    300,
  );
  const json = extractJson(raw);
  const sent = String(json.sentiment ?? "neutral");
  const sentiment: Sentiment =
    sent === "positive" || sent === "negative" || sent === "question" ? sent : "neutral";
  return {
    sentiment,
    topics: Array.isArray(json.topics) ? json.topics.map(String).slice(0, 8) : [],
    riskFlags: Array.isArray(json.riskFlags) ? json.riskFlags.map(String).slice(0, 8) : [],
    suggestedHashtags: Array.isArray(json.suggestedHashtags)
      ? json.suggestedHashtags.map(String).slice(0, 6)
      : [],
  };
}

export async function draftReplies(input: {
  comment: string;
  brandVoice?: string | null;
  pageName: string;
}): Promise<string[]> {
  const voice = input.brandVoice || "Helpful, specific, never sycophantic. Human must send — do not sound automated.";
  const raw = await chat(
    `You draft Facebook comment REPLIES for "${input.pageName}". Voice: ${voice}.
A human will click Send — never imply the reply was auto-sent.
Return JSON {"drafts":["...","...","..."]} — exactly 3 short replies (1–3 sentences).`,
    input.comment.slice(0, 1500),
    400,
  );
  const json = extractJson(raw);
  const drafts = Array.isArray(json.drafts) ? json.drafts.map(String) : [];
  while (drafts.length < 3) drafts.push("Thanks for writing in — let me look into that and get back to you.");
  return drafts.slice(0, 3);
}

function extractJson(raw: string): Record<string, unknown> {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return {};
  try {
    return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function localSentiment(text: string): Sentiment {
  const t = text.toLowerCase();
  if (/\?|how |when |where |do you|can you|is there/.test(t)) return "question";
  if (/\b(love|amazing|great|thanks|awesome|perfect|beautiful)\b/.test(t)) return "positive";
  if (/\b(hate|scam|worst|terrible|refund|angry|horrible|never)\b/.test(t)) return "negative";
  return "neutral";
}

/** One user-initiated image. Uses grok-imagine-image (cheaper). Never called in a loop. */
export async function generateImage(prompt: string): Promise<{ dataUrl: string; fileName: string } | { error: string }> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { error: "Image generation needs the platform xAI key. Captions still work locally." };
  const clean = prompt.replace(/\s+/g, " ").trim().slice(0, 700);
  if (clean.length < 8) return { error: "Describe the image in a bit more detail." };
  const res = await fetch("https://api.x.ai/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-imagine-image",
      prompt: `Facebook Page photo, photoreal, no logos, no watermarks, no text overlay. ${clean}`,
      n: 1,
      response_format: "b64_json",
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    return { error: `Imagine API ${res.status}: ${t.slice(0, 180)}` };
  }
  const body = (await res.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  const first = body.data?.[0];
  if (first?.b64_json) {
    return { dataUrl: `data:image/png;base64,${first.b64_json}`, fileName: "imagine.png" };
  }
  if (first?.url) {
    return { dataUrl: first.url, fileName: "imagine.png" };
  }
  return { error: "Imagine returned no image." };
}
