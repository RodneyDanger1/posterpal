import type { ContentAnalysis, Sentiment } from "./types";
import type { ImageProviderId, TextProviderId } from "./providers";

const MODEL = "grok-4.5";

export function aiAvailable(): boolean {
  return Boolean(process.env.XAI_API_KEY);
}

async function chat(system: string, user: string, maxTokens = 700): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("AI is not available in this environment");
  return chatOpenAiCompat({
    url: "https://api.x.ai/v1/chat/completions",
    apiKey,
    model: MODEL,
    system,
    user,
    maxTokens,
  });
}

async function chatOpenAiCompat(opts: {
  url: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  extra?: Record<string, unknown>;
}): Promise<string> {
  const res = await fetch(opts.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      temperature: 0.7,
      max_tokens: opts.maxTokens,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      ...opts.extra,
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`LLM error ${res.status}: ${t.slice(0, 220)}`);
  }
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return body.choices?.[0]?.message?.content?.trim() ?? "";
}

async function chatGemini(apiKey: string, system: string, user: string, maxTokens: number): Promise<string> {
  const models = ["gemini-2.5-flash", "gemini-2.0-flash"];
  let last = "Gemini request failed";
  for (const model of models) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens },
        }),
        signal: AbortSignal.timeout(25_000),
      },
    );
    const t = await res.text();
    if (!res.ok) {
      last = `Gemini ${res.status}: ${t.slice(0, 220)}`;
      if (res.status === 401 || res.status === 403) break;
      continue;
    }
    try {
      const body = JSON.parse(t) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
      if (text) return text;
      last = "Gemini returned no text.";
    } catch {
      last = "Gemini returned invalid JSON.";
    }
  }
  throw new Error(last);
}

export async function chatWithProvider(opts: {
  provider: TextProviderId;
  apiKey?: string | null;
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const maxTokens = opts.maxTokens ?? 700;
  if (opts.provider === "grok") return chat(opts.system, opts.user, maxTokens);
  if (!opts.apiKey) throw new Error(`Add your ${opts.provider} API key in Settings.`);
  if (opts.provider === "openai") {
    try {
      return await chatOpenAiCompat({
        url: "https://api.openai.com/v1/chat/completions",
        apiKey: opts.apiKey,
        model: "gpt-4.1-mini",
        system: opts.system,
        user: opts.user,
        maxTokens,
      });
    } catch {
      return chatOpenAiCompat({
        url: "https://api.openai.com/v1/chat/completions",
        apiKey: opts.apiKey,
        model: "gpt-4o-mini",
        system: opts.system,
        user: opts.user,
        maxTokens,
      });
    }
  }
  if (opts.provider === "deepseek") {
    try {
      return await chatOpenAiCompat({
        url: "https://api.deepseek.com/chat/completions",
        apiKey: opts.apiKey,
        model: "deepseek-v4-flash",
        system: opts.system,
        user: opts.user,
        maxTokens,
      });
    } catch {
      return chatOpenAiCompat({
        url: "https://api.deepseek.com/chat/completions",
        apiKey: opts.apiKey,
        model: "deepseek-chat",
        system: opts.system,
        user: opts.user,
        maxTokens,
      });
    }
  }
  if (opts.provider === "gemini") {
    return chatGemini(opts.apiKey, opts.system, opts.user, maxTokens);
  }
  throw new Error("Unknown text provider");
}

export async function generateCaptionVariants(input: {
  brief: string;
  brandVoice?: string | null;
  pageName: string;
  merchCta?: string | null;
  provider?: TextProviderId;
  apiKey?: string | null;
}): Promise<{ storytelling: string; cta: string; question: string }> {
  const voice = input.brandVoice || "Warm, specific, human. No corporate filler. No emoji spam.";
  const merch = input.merchCta ? `If natural, weave this merch CTA: ${input.merchCta}` : "Do not invent products.";
  const provider = input.provider ?? "grok";
  const raw = await chatWithProvider({
    provider,
    apiKey: input.apiKey,
    maxTokens: 900,
    system: `You write Facebook Page captions for "${input.pageName}". Voice: ${voice}.
Return ONLY valid JSON: {"storytelling":"...","cta":"...","question":"..."}.
Each caption 40–90 words. No hashtag dumps (max 3). Never auto-promise engagement.
Do not mention AI, ChatGPT, Grok, or that a model drafted this. A human will edit and click Publish.
Do not claim a generated still is a documentary photo of a real event.`,
    user: `Brief:\n${input.brief}\n\n${merch}\nWrite three variants: storytelling, direct CTA, and a genuine question.`,
  });
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
  provider?: TextProviderId;
  apiKey?: string | null;
}): Promise<string[]> {
  const raw = await chatWithProvider({
    provider: input.provider ?? "grok",
    apiKey: input.apiKey,
    maxTokens: 200,
    system: `Suggest 6 relevant Facebook hashtags for the Page "${input.pageName}". Return JSON {"tags":["#foo"]}. No banned or spam tags.`,
    user: input.caption.slice(0, 800),
  });
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
  return generateImageWithProvider({ provider: "grok", prompt });
}

export async function generateImageWithProvider(input: {
  provider: ImageProviderId;
  prompt: string;
  apiKey?: string | null;
}): Promise<{ dataUrl: string; fileName: string } | { error: string }> {
  const clean = input.prompt.replace(/\s+/g, " ").trim().slice(0, 700);
  if (clean.length < 8) return { error: "Describe the image in a bit more detail." };
  const prompt = `Facebook Page photo, photoreal, no logos, no text overlay. ${clean}`;
  try {
    if (input.provider === "grok") return grokImage(prompt);
    if (!input.apiKey) return { error: `Add your ${input.provider} API key in Settings.` };
    if (input.provider === "openai") return openaiImage(input.apiKey, prompt);
    if (input.provider === "gemini") return geminiImage(input.apiKey, prompt);
    if (input.provider === "flux") return fluxImage(input.apiKey, prompt);
    return { error: "Unknown image provider." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Image generation failed." };
  }
}

async function grokImage(prompt: string): Promise<{ dataUrl: string; fileName: string } | { error: string }> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { error: "Image generation needs the platform xAI key. Captions still work locally." };
  const models = ["grok-imagine-image-2.0", "grok-imagine-image"];
  let last = "Imagine API failed.";
  for (const model of models) {
    const res = await fetch("https://api.x.ai/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
        response_format: "b64_json",
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      const t = await res.text();
      last = `Imagine API ${res.status}: ${t.slice(0, 180)}`;
      continue;
    }
    const body = (await res.json()) as {
      data?: Array<{ b64_json?: string; url?: string }>;
    };
    return packOpenAiImage(body, "imagine.png");
  }
  return { error: last };
}

async function openaiImage(
  apiKey: string,
  prompt: string,
): Promise<{ dataUrl: string; fileName: string } | { error: string }> {
  const models = ["gpt-image-1-mini", "gpt-image-1", "gpt-image-1.5"];
  let last = "OpenAI Images failed.";
  for (const model of models) {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
        size: "1024x1024",
      }),
      signal: AbortSignal.timeout(60_000),
    });
    const t = await res.text();
    if (!res.ok) {
      last = `OpenAI Images ${res.status}: ${t.slice(0, 220)}`;
      if (res.status === 401 || res.status === 403) break;
      continue;
    }
    try {
      const body = JSON.parse(t) as { data?: Array<{ b64_json?: string; url?: string }> };
      return packOpenAiImage(body, "openai.png");
    } catch {
      last = "OpenAI returned invalid JSON.";
    }
  }
  return { error: last };
}

function packOpenAiImage(
  body: { data?: Array<{ b64_json?: string; url?: string }> },
  fileName: string,
): { dataUrl: string; fileName: string } | { error: string } {
  const first = body.data?.[0];
  if (first?.b64_json) {
    return { dataUrl: `data:image/png;base64,${first.b64_json}`, fileName };
  }
  if (first?.url) {
    return { dataUrl: first.url, fileName };
  }
  return { error: "Image API returned no image." };
}

async function geminiImage(
  apiKey: string,
  prompt: string,
): Promise<{ dataUrl: string; fileName: string } | { error: string }> {
  const models = ["gemini-2.5-flash-image", "gemini-3.1-flash-image", "gemini-2.5-flash-image-preview"];
  let last = "Gemini image failed.";
  for (const model of models) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
        signal: AbortSignal.timeout(60_000),
      },
    );
    const t = await res.text();
    if (!res.ok) {
      last = `Gemini image ${res.status}: ${t.slice(0, 220)}`;
      if (res.status === 401 || res.status === 403) break;
      continue;
    }
    const packed = extractGeminiInline(t);
    if ("dataUrl" in packed) return packed;
    last = packed.error;
  }
  return { error: last };
}

function extractGeminiInline(raw: string): { dataUrl: string; fileName: string } | { error: string } {
  try {
    const body = JSON.parse(raw) as {
      candidates?: {
        content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string }; inline_data?: { mime_type?: string; data?: string } }> };
      }[];
    };
    for (const part of body.candidates?.[0]?.content?.parts ?? []) {
      const inline = part.inlineData ?? part.inline_data;
      const data = inline?.data;
      const mime =
        (inline && "mimeType" in inline ? inline.mimeType : undefined) ??
        (inline && "mime_type" in inline ? inline.mime_type : undefined) ??
        "image/png";
      if (data) {
        return { dataUrl: `data:${mime};base64,${data}`, fileName: "nano-banana.png" };
      }
    }
    return { error: "Gemini returned no image bytes." };
  } catch {
    return { error: "Gemini returned invalid JSON." };
  }
}

async function fluxImage(
  apiKey: string,
  prompt: string,
): Promise<{ dataUrl: string; fileName: string } | { error: string }> {
  const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify({
      prompt,
      image_size: "square_hd",
      num_images: 1,
      enable_safety_checker: true,
    }),
    signal: AbortSignal.timeout(45_000),
  });
  const t = await res.text();
  if (!res.ok) {
    // fal also accepts Bearer
    if (res.status === 401 || res.status === 403) {
      const retry = await fetch("https://fal.run/fal-ai/flux/schnell", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt,
          image_size: "square_hd",
          num_images: 1,
        }),
        signal: AbortSignal.timeout(45_000),
      });
      const t2 = await retry.text();
      if (!retry.ok) return { error: `Flux ${retry.status}: ${t2.slice(0, 180)}` };
      return await packFal(t2);
    }
    return { error: `Flux ${res.status}: ${t.slice(0, 180)}` };
  }
  return packFal(t);
}

async function packFal(raw: string): Promise<{ dataUrl: string; fileName: string } | { error: string }> {
  try {
    const body = JSON.parse(raw) as {
      images?: Array<{ url?: string; content_type?: string }>;
    };
    const url = body.images?.[0]?.url;
    if (!url) return { error: "Flux returned no image URL." };
    const img = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!img.ok) return { error: `Could not download Flux image (${img.status}).` };
    const buf = Buffer.from(await img.arrayBuffer());
    const mime = body.images?.[0]?.content_type || img.headers.get("content-type") || "image/jpeg";
    return { dataUrl: `data:${mime};base64,${buf.toString("base64")}`, fileName: "flux.jpg" };
  } catch {
    return { error: "Flux returned invalid JSON." };
  }
}
