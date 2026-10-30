import type { ContentAnalysis, Sentiment } from "./types";
import {
  imageSpec,
  textSpec,
  vendorImageOptions,
  type ImageProviderId,
  type TextProviderId,
} from "./providers";
import { joinBaseUrl, resolveProviderBaseUrl } from "./network-guard";
import { buildCaptionSystemPrompt, type PromptStyleId } from "./prompt-craft";

/** A user-supplied OpenAI-compatible endpoint. Validated by network-guard. */
export type CustomEndpoint = { baseUrl: string; model: string };

export function aiAvailable(): boolean {
  return Boolean(process.env.XAI_API_KEY);
}

async function requireSafeEndpoint(endpoint: CustomEndpoint | null | undefined, label: string): Promise<CustomEndpoint> {
  if (!endpoint?.baseUrl || !endpoint.model) {
    throw new Error(`${label}: set the base URL and model in Settings first.`);
  }
  const safe = await resolveProviderBaseUrl(endpoint.baseUrl);
  if (!safe.ok) throw new Error(`${label}: ${safe.reason}`);
  return { baseUrl: safe.baseUrl, model: endpoint.model.trim() };
}

async function chatCustom(
  endpoint: CustomEndpoint | null | undefined,
  apiKey: string | null | undefined,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  const safe = await requireSafeEndpoint(endpoint, "Custom text provider");
  const res = await fetch(joinBaseUrl(safe.baseUrl, "chat/completions"), {
    method: "POST",
    redirect: "error",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey?.trim() ? { Authorization: `Bearer ${apiKey.trim()}` } : {}),
    },
    body: JSON.stringify({
      model: safe.model,
      temperature: 0.7,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(textSpec("custom").timeoutMs),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Custom provider ${res.status}: ${text.slice(0, 220)}`);
  try {
    const body = JSON.parse(text) as { choices?: { message?: { content?: string } }[] };
    return body.choices?.[0]?.message?.content?.trim() ?? "";
  } catch {
    throw new Error("Custom provider returned invalid JSON.");
  }
}

async function chat(system: string, user: string, maxTokens = 700): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Grok isn't configured on this desk. Open Settings, paste an OpenAI / Gemini / DeepSeek key, and pick that caption model.",
    );
  }
  const spec = textSpec("grok");
  let last = "Grok request failed.";
  // Model list comes from the verified catalog; a retired model falls through to
  // the next one instead of failing the whole caption request.
  for (const model of spec.models) {
    try {
      return await chatOpenAiCompat({
        url: "https://api.x.ai/v1/chat/completions",
        apiKey,
        model,
        system,
        user,
        maxTokens,
        timeoutMs: spec.timeoutMs,
      });
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(last);
}

async function chatOpenAiCompat(opts: {
  url: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  timeoutMs?: number;
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
    signal: AbortSignal.timeout(opts.timeoutMs ?? 45_000),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${opts.model} error ${res.status}: ${t.slice(0, 220)}`);
  }
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return body.choices?.[0]?.message?.content?.trim() ?? "";
}

async function chatGemini(apiKey: string, system: string, user: string, maxTokens: number): Promise<string> {
  const spec = textSpec("gemini");
  const models = spec.models;
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
        signal: AbortSignal.timeout(spec.timeoutMs),
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
  /** Required when provider === "custom". */
  custom?: CustomEndpoint | null;
}): Promise<string> {
  const maxTokens = opts.maxTokens ?? 700;
  if (opts.provider === "custom") {
    return chatCustom(opts.custom, opts.apiKey, opts.system, opts.user, maxTokens);
  }
  if (opts.provider === "grok") return chat(opts.system, opts.user, maxTokens);
  if (!opts.apiKey) throw new Error(`Add your ${opts.provider} API key in Settings.`);
  if (opts.provider === "openai") {
    const spec = textSpec("openai");
    return chatOpenAiModels(
      "https://api.openai.com/v1/chat/completions",
      opts.apiKey,
      spec.models,
      spec.timeoutMs,
      { system: opts.system, user: opts.user, maxTokens },
    );
  }
  if (opts.provider === "deepseek") {
    const spec = textSpec("deepseek");
    return chatOpenAiModels(
      "https://api.deepseek.com/chat/completions",
      opts.apiKey,
      spec.models,
      spec.timeoutMs,
      { system: opts.system, user: opts.user, maxTokens },
    );
  }
  if (opts.provider === "gemini") {
    return chatGemini(opts.apiKey, opts.system, opts.user, maxTokens);
  }
  throw new Error("Unknown text provider");
}

/** Try each model in order; the last error is surfaced with the model name. */
async function chatOpenAiModels(
  url: string,
  apiKey: string,
  models: readonly string[],
  timeoutMs: number,
  input: { system: string; user: string; maxTokens: number },
): Promise<string> {
  let last = "Request failed.";
  for (const model of models) {
    try {
      return await chatOpenAiCompat({
        url,
        apiKey,
        model,
        system: input.system,
        user: input.user,
        maxTokens: input.maxTokens,
        timeoutMs,
      });
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(last);
}

export async function generateCaptionVariants(input: {
  brief: string;
  brandVoice?: string | null;
  pageName: string;
  merchCta?: string | null;
  provider?: TextProviderId;
  apiKey?: string | null;
  custom?: CustomEndpoint | null;
  style?: PromptStyleId;
  customDirective?: string | null;
}): Promise<{ storytelling: string; cta: string; question: string }> {
  const provider = input.provider ?? "grok";
  const merch = input.merchCta ? `If natural, weave this merch CTA: ${input.merchCta}` : "Do not invent products.";
  const raw = await chatWithProvider({
    provider,
    apiKey: input.apiKey,
    custom: input.custom,
    maxTokens: 900,
    system: buildCaptionSystemPrompt({
      pageName: input.pageName,
      brandVoice: input.brandVoice,
      merchCta: input.merchCta,
      style: input.style,
      customDirective: input.customDirective ?? undefined,
    }),
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
  custom?: CustomEndpoint | null;
}): Promise<string[]> {
  const raw = await chatWithProvider({
    provider: input.provider ?? "grok",
    apiKey: input.apiKey,
    custom: input.custom,
    maxTokens: 200,
    system: `Suggest 6 relevant Facebook hashtags for the Page "${input.pageName}". Return JSON {"tags":["#foo"]}. No banned or spam tags.`,
    user: input.caption.slice(0, 800),
  });
  const json = extractJson(raw);
  const tags = Array.isArray(json.tags) ? json.tags.map(String) : [];
  return tags.filter((t) => t.startsWith("#")).slice(0, 8);
}

export async function analyzeContent(
  content: string,
  opts?: { provider?: TextProviderId; apiKey?: string | null; custom?: CustomEndpoint | null },
): Promise<ContentAnalysis> {
  const raw = await chatWithProvider({
    provider: opts?.provider ?? "grok",
    apiKey: opts?.apiKey,
    custom: opts?.custom,
    maxTokens: 300,
    system: `Analyze this Facebook comment or caption. Return JSON:
{"sentiment":"positive|neutral|negative|question","topics":[],"riskFlags":[],"suggestedHashtags":[]}.
riskFlags are policy risks (hate, spam, scams), not style notes.`,
    user: content.slice(0, 2000),
  });
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
  provider?: TextProviderId;
  apiKey?: string | null;
  custom?: CustomEndpoint | null;
}): Promise<string[]> {
  const voice = input.brandVoice || "Helpful, specific, never sycophantic. Human must send — do not sound automated.";
  const raw = await chatWithProvider({
    provider: input.provider ?? "grok",
    apiKey: input.apiKey,
    custom: input.custom,
    maxTokens: 400,
    system: `You draft Facebook comment REPLIES for "${input.pageName}". Voice: ${voice}.
A human will click Send — never imply the reply was auto-sent.
Return JSON {"drafts":["...","...","..."]} — exactly 3 short replies (1–3 sentences).`,
    user: input.comment.slice(0, 1500),
  });
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

/** One user-initiated image. Never called in a loop; Settings/Media can probe it. */
export async function generateImage(prompt: string): Promise<{ dataUrl: string; fileName: string } | { error: string }> {
  return generateImageWithProvider({ provider: "grok", prompt });
}

export async function generateImageWithProvider(input: {
  provider: ImageProviderId;
  prompt: string;
  apiKey?: string | null;
  /** UI aspect preset ("1:1", "16:9", …) — mapped per vendor by the catalog. */
  aspectRatio?: string | null;
  /** Vendor size string where supported (OpenAI "1536x1024"). */
  size?: string | null;
  /** Required when provider === "custom". */
  custom?: CustomEndpoint | null;
}): Promise<{ dataUrl: string; fileName: string } | { error: string }> {
  const clean = input.prompt.replace(/\s+/g, " ").trim().slice(0, 700);
  if (clean.length < 8) return { error: "Describe the image in a bit more detail." };
  const prompt = `Facebook Page photo, photoreal, no logos, no text overlay. ${clean}`;
  const spec = imageSpec(input.provider);
  const vendor = vendorImageOptions(spec, { aspectRatio: input.aspectRatio, size: input.size });
  try {
    if (input.provider === "custom") return imageCustom(input.custom, input.apiKey, prompt);
    if (input.provider === "grok") return grokImage(spec, prompt, vendor);
    if (!input.apiKey) return { error: `Add your ${input.provider} API key in Settings.` };
    if (input.provider === "openai") return openaiImage(input.apiKey, spec, prompt, vendor);
    if (input.provider === "gemini") return geminiImage(input.apiKey, spec, prompt);
    if (input.provider === "flux") return fluxImage(input.apiKey, spec, prompt, vendor);
    return { error: "Unknown image provider." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Image generation failed." };
  }
}

type ImageVendorOptions = ReturnType<typeof vendorImageOptions>;

async function grokImage(
  spec: ReturnType<typeof imageSpec>,
  prompt: string,
  vendor: ImageVendorOptions,
): Promise<{ dataUrl: string; fileName: string } | { error: string }> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { error: "Image generation needs the platform xAI key. Captions still work locally." };
  let last = "Imagine API failed.";
  for (const model of spec.models) {
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
        aspect_ratio: vendor.aspectRatio,
        // 2.0 accepts resolution=1k|2k; older models ignore unknown params.
        ...(model.endsWith("-2.0") ? { resolution: vendor.resolution ?? "1k" } : {}),
      }),
      signal: AbortSignal.timeout(spec.timeoutMs),
    });
    if (!res.ok) {
      const t = await res.text();
      last = `${model} ${res.status}: ${t.slice(0, 180)}`;
      // Auth/permission errors will not fix themselves on the next model.
      if (res.status === 401 || res.status === 403) break;
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
  spec: ReturnType<typeof imageSpec>,
  prompt: string,
  vendor: ImageVendorOptions,
): Promise<{ dataUrl: string; fileName: string } | { error: string }> {
  let last = "OpenAI Images failed.";
  for (const model of spec.models) {
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
        size: vendor.size ?? "1024x1024",
        quality: "auto",
        output_format: "png",
      }),
      signal: AbortSignal.timeout(spec.timeoutMs),
    });
    const t = await res.text();
    if (!res.ok) {
      last = `${model} ${res.status}: ${t.slice(0, 220)}`;
      if (res.status === 401 || res.status === 403) break;
      continue;
    }
    try {
      const body = JSON.parse(t) as { data?: Array<{ b64_json?: string; url?: string }> };
      return packOpenAiImage(body, "openai.png");
    } catch {
      last = `${model} returned invalid JSON.`;
    }
  }
  return { error: last };
}

async function urlToDataUrl(url: string, fallbackMime = "image/png"): Promise<string> {
  const img = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!img.ok) throw new Error(`Could not download image (${img.status})`);
  const buf = Buffer.from(await img.arrayBuffer());
  const mime = img.headers.get("content-type")?.split(";")[0]?.trim() || fallbackMime;
  return `data:${mime};base64,${buf.toString("base64")}`;
}

async function packOpenAiImage(
  body: { data?: Array<{ b64_json?: string; url?: string }> },
  fileName: string,
): Promise<{ dataUrl: string; fileName: string } | { error: string }> {
  const first = body.data?.[0];
  if (first?.b64_json) {
    return { dataUrl: `data:image/png;base64,${first.b64_json}`, fileName };
  }
  if (first?.url) {
    try {
      return { dataUrl: await urlToDataUrl(first.url), fileName };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Could not download image bytes." };
    }
  }
  return { error: "Image API returned no image." };
}

async function geminiImage(
  apiKey: string,
  spec: ReturnType<typeof imageSpec>,
  prompt: string,
): Promise<{ dataUrl: string; fileName: string } | { error: string }> {
  let last = "Gemini image failed.";
  for (const model of spec.models) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
        signal: AbortSignal.timeout(spec.timeoutMs),
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
  spec: ReturnType<typeof imageSpec>,
  prompt: string,
  vendor: ImageVendorOptions,
): Promise<{ dataUrl: string; fileName: string } | { error: string }> {
  const url = `https://fal.run/${spec.models[0] ?? "fal-ai/flux/schnell"}`;
  const payload = {
    prompt,
    image_size: vendor.fluxSize,
    num_images: 1,
    enable_safety_checker: true,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(spec.timeoutMs),
  });
  const t = await res.text();
  if (!res.ok) {
    // fal also accepts Bearer
    if (res.status === 401 || res.status === 403) {
      const retry = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ prompt, image_size: vendor.fluxSize, num_images: 1 }),
        signal: AbortSignal.timeout(spec.timeoutMs),
      });
      const t2 = await retry.text();
      if (!retry.ok) return { error: `Flux ${retry.status}: ${t2.slice(0, 180)}` };
      return await packFal(t2);
    }
    return { error: `Flux ${res.status}: ${t.slice(0, 180)}` };
  }
  return packFal(t);
}

async function imageCustom(
  endpoint: CustomEndpoint | null | undefined,
  apiKey: string | null | undefined,
  prompt: string,
): Promise<{ dataUrl: string; fileName: string } | { error: string }> {
  const safe = await requireSafeEndpoint(endpoint, "Custom image provider");
  const url = joinBaseUrl(safe.baseUrl, "images/generations");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey?.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;
  const call = (payload: Record<string, unknown>) =>
    fetch(url, {
      method: "POST",
      redirect: "error",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(imageSpec("custom").timeoutMs),
    });
  const base = { model: safe.model, prompt, n: 1 };
  let res = await call(base);
  let text = await res.text();
  // Some gateways reject unknown params; retry with the common OpenAI shape.
  if (!res.ok && (res.status === 400 || res.status === 422) && /response_format|size|unknown/i.test(text)) {
    res = await call({ ...base, response_format: "b64_json", size: "1024x1024" });
    text = await res.text();
  }
  if (!res.ok) return { error: `Custom image provider ${res.status}: ${text.slice(0, 220)}` };
  try {
    return packOpenAiImage(JSON.parse(text) as { data?: Array<{ b64_json?: string; url?: string }> }, "custom.png");
  } catch {
    return { error: "Custom image provider returned invalid JSON." };
  }
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
