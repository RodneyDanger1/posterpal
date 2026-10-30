/**
 * Provider catalog — the single source of truth for BYO AI models.
 *
 * VERIFIED against official docs on 2026-10-29:
 *   xAI      https://docs.x.ai/developers/models.md
 *            https://docs.x.ai/developers/model-capabilities/images/generation.md
 *   Gemini   https://ai.google.dev/gemini-api/docs/image-generation
 *   DeepSeek https://api-docs.deepseek.com/
 *   OpenAI   https://developers.openai.com/api/docs/guides/image-generation.md
 *
 * Model IDs change. When a vendor retires one, the request fails with 404/400 and
 * the next model in `models` is tried, so the desk degrades instead of dying. The
 * Settings and Media probes hit the API and report the real error.
 *
 * UNVERIFIED (kept, labelled): OpenAI *text* model IDs (the image page does not
 * list them), Flux/fal watermark claims, and gemini-nano-banana-2.1's request shape
 * through generateContent (the docs illustrate it via the Interactions API; the
 * code tries it after the known-generateContent models and falls through on error).
 */

export const PROVIDERS_VERIFIED_AT = "2026-10-29";

export type TextProvider = {
  id: "grok" | "openai" | "gemini" | "deepseek" | "custom";
  label: string;
  hint: string;
  needsKey: boolean;
  settingKey: string | null;
  /** Tried in order; first success wins. */
  models: readonly string[];
  timeoutMs: number;
};

export type ImageProvider = {
  id: "grok" | "openai" | "gemini" | "flux" | "custom";
  label: string;
  hint: string;
  needsKey: boolean;
  settingKey: string | null;
  models: readonly string[];
  timeoutMs: number;
  /** Aspect ratios the provider accepts; first is the safe default. */
  aspectRatios: readonly string[];
  /** Requested output sizes, where the vendor takes an explicit size string. */
  sizes: readonly string[];
  /** True when the provider documents transparent backgrounds. */
  supportsTransparency: boolean;
  /** Where the bytes come from. */
  returns: "b64_json" | "url" | "inline";
};

export const TEXT_PROVIDERS: readonly TextProvider[] = [
  {
    id: "grok",
    label: "Grok (xAI)",
    hint: "Default. Platform xAI key. grok-4.7 latest; falls back to 4.6 → 4.5 on retirement.",
    needsKey: false,
    settingKey: null,
    models: ["grok-4.7", "grok-4.6", "grok-4.5"],
    timeoutMs: 45_000,
  },
  {
    id: "openai",
    label: "OpenAI",
    hint: "Your OpenAI key. Captions via gpt-4.1-mini → gpt-4o-mini. Model IDs UNVERIFIED for text (image docs only).",
    needsKey: true,
    settingKey: "openai_api_key",
    models: ["gpt-4.1-mini", "gpt-4o-mini"],
    timeoutMs: 60_000,
  },
  {
    id: "gemini",
    label: "Google Gemini",
    hint: "AI Studio key. Captions via gemini-2.5-flash → gemini-2.0-flash. Images: Nano Banana family (SynthID watermark).",
    needsKey: true,
    settingKey: "google_api_key",
    models: ["gemini-2.5-flash", "gemini-2.0-flash"],
    timeoutMs: 60_000,
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    hint: "Cheap captions via deepseek-flash (V4.1 Flash). No image model — use Grok, Gemini, OpenAI or Flux for stills.",
    needsKey: true,
    settingKey: "deepseek_api_key",
    models: ["deepseek-flash", "deepseek-v4-pro", "deepseek-v4-flash"],
    timeoutMs: 60_000,
  },
  {
    id: "custom",
    label: "Custom endpoint (OpenAI-compatible)",
    hint:
      "Bring your own endpoint — Groq, OpenRouter, Cerebras, Mistral, a local Ollama/LM Studio, etc. HTTPS only; private/loopback hosts are refused unless POSTERPAL_ALLOW_LOCAL_PROVIDERS=1. Captions are sent to that provider.",
    needsKey: true,
    settingKey: "custom_api_key",
    models: ["custom"],
    timeoutMs: 90_000,
  },
] as const;

export const IMAGE_PROVIDERS: readonly ImageProvider[] = [
  {
    id: "grok",
    label: "Grok Imagine",
    hint: "grok-imagine-image-2.0 ($0.04/img, aspect ratio + 1k/2k). Platform xAI key. Falls back to the older Imagine models.",
    needsKey: false,
    settingKey: null,
    models: ["grok-imagine-image-2.0", "grok-imagine-image", "grok-imagine-image-quality"],
    timeoutMs: 90_000,
    aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16"],
    sizes: [],
    supportsTransparency: false,
    returns: "b64_json",
  },
  {
    id: "openai",
    label: "OpenAI Images",
    hint: "gpt-image-2.5-flare / sunburst. Org verification may be required. Slow prompts can take up to 2 min.",
    needsKey: true,
    settingKey: "openai_api_key",
    models: ["gpt-image-2.5-flare", "gpt-image-2.5-sunburst", "gpt-image-1"],
    timeoutMs: 120_000,
    aspectRatios: ["1:1", "3:2", "2:3", "16:9", "9:16"],
    sizes: ["1024x1024", "1536x1024", "1024x1536"],
    supportsTransparency: true,
    returns: "b64_json",
  },
  {
    id: "gemini",
    label: "Gemini Nano Banana",
    hint: "gemini-nano-banana-2.1 recommended by Google; falls back to 3.1 Flash Image and Nano Banana. All outputs carry SynthID.",
    needsKey: true,
    settingKey: "google_api_key",
    models: [
      "gemini-nano-banana-2.1",
      "gemini-3.1-flash-image",
      "gemini-3.1-flash-lite-image",
      "gemini-2.5-flash-image",
    ],
    timeoutMs: 90_000,
    aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16"],
    sizes: [],
    supportsTransparency: false,
    returns: "inline",
  },
  {
    id: "flux",
    label: "Flux Schnell (fal)",
    hint: "Fast commercial stills via fal.ai. Paste a fal key. Watermark policy is fal's — verify before selling print artwork.",
    needsKey: true,
    settingKey: "fal_api_key",
    models: ["fal-ai/flux/schnell"],
    timeoutMs: 60_000,
    aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16"],
    sizes: ["square_hd", "portrait_4_3", "landscape_4_3"],
    supportsTransparency: false,
    returns: "url",
  },
  {
    id: "custom",
    label: "Custom endpoint (OpenAI-compatible)",
    hint:
      "Any OpenAI-compatible /images/generations endpoint you trust. It receives the image prompt; 3rd-party gateways may log it. HTTPS only.",
    needsKey: true,
    settingKey: "custom_api_key",
    models: ["custom"],
    timeoutMs: 120_000,
    aspectRatios: ["1:1", "3:2", "2:3", "16:9", "9:16"],
    sizes: [],
    supportsTransparency: false,
    returns: "b64_json",
  },
] as const;

export type TextProviderId = TextProvider["id"];
export type ImageProviderId = ImageProvider["id"];

export type ProviderAvailability = {
  grok: boolean;
  openai: boolean;
  gemini: boolean;
  deepseek: boolean;
  flux: boolean;
};

export const PROVIDER_SETTING_KEYS = {
  openai_api_key: "openai",
  google_api_key: "gemini",
  deepseek_api_key: "deepseek",
  fal_api_key: "flux",
  custom_api_key: "custom",
} as const;

/** Throwing lookup: an unknown id is a programming error, not a silent default. */
export function textSpec(id: string): TextProvider {
  const spec = TEXT_PROVIDERS.find((p) => p.id === id);
  if (!spec) throw new Error(`Unknown text provider "${id}".`);
  return spec;
}

export function imageSpec(id: string): ImageProvider {
  const spec = IMAGE_PROVIDERS.find((p) => p.id === id);
  if (!spec) throw new Error(`Unknown image provider "${id}".`);
  return spec;
}

/**
 * Map the desk's UI aspect choice onto the vendor's own parameter. Kept pure so
 * the mapping is unit-tested instead of living inside three fetch calls.
 */
export function vendorImageOptions(
  spec: ImageProvider,
  requested?: { aspectRatio?: string | null; size?: string | null },
): {
  aspectRatio: string;
  size: string | null;
  resolution: string | null;
  fluxSize: string;
} {
  const aspectRaw = (requested?.aspectRatio ?? "").trim();
  const aspectRatio = spec.aspectRatios.includes(aspectRaw) ? aspectRaw : spec.aspectRatios[0] ?? "1:1";
  let size: string | null = null;
  if (spec.sizes.length > 0) {
    const wanted = (requested?.size ?? "").trim();
    size = spec.sizes.includes(wanted) ? wanted : spec.sizes[0] ?? null;
  }
  // Grok accepts resolution=1k|2k; 1k is the documented default.
  const resolution = spec.id === "grok" ? (aspectRatio === "1:1" ? "1k" : "1k") : null;
  const fluxSize =
    aspectRatio === "16:9" || aspectRatio === "4:3"
      ? "landscape_4_3"
      : aspectRatio === "9:16" || aspectRatio === "3:4"
        ? "portrait_4_3"
        : "square_hd";
  return { aspectRatio, size, resolution, fluxSize };
}
