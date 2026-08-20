/** Catalog of BYO image/text models. Keys live encrypted in app_settings. */

export const TEXT_PROVIDERS = [
  {
    id: "grok",
    label: "Grok (xAI)",
    hint: "Default. Uses the platform xAI key when present. grok-4.5 for captions.",
    needsKey: false,
    settingKey: null,
  },
  {
    id: "openai",
    label: "OpenAI",
    hint: "Your OpenAI key. Captions via gpt-4.1-mini. Images via gpt-image-1 / gpt-image-1.5.",
    needsKey: true,
    settingKey: "openai_api_key",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    hint: "AI Studio key. Captions via gemini-2.5-flash. Images via Nano Banana (gemini-2.5-flash-image).",
    needsKey: true,
    settingKey: "google_api_key",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    hint: "Cheap captions via deepseek-v4-flash. DeepSeek has no image model — use Flux or Gemini for stills.",
    needsKey: true,
    settingKey: "deepseek_api_key",
  },
] as const;

export const IMAGE_PROVIDERS = [
  {
    id: "grok",
    label: "Grok Imagine",
    hint: "grok-imagine-image-2.0. Platform xAI key. Consumer Grok stills may carry a visible watermark; Flux does not.",
    needsKey: false,
    settingKey: null,
  },
  {
    id: "openai",
    label: "OpenAI Images",
    hint: "gpt-image-1 family. Org verification may be required. Returns PNG.",
    needsKey: true,
    settingKey: "openai_api_key",
  },
  {
    id: "gemini",
    label: "Gemini Nano Banana",
    hint: "gemini-2.5-flash-image (Nano Banana). SynthID watermarked. Good free-tier stills.",
    needsKey: true,
    settingKey: "google_api_key",
  },
  {
    id: "flux",
    label: "Flux Schnell (fal)",
    hint: "Fast stills via fal.ai. Commercial. No Grok-style visible watermark. Paste a fal key. Best default for Page photos.",
    needsKey: true,
    settingKey: "fal_api_key",
  },
] as const;

export type TextProviderId = (typeof TEXT_PROVIDERS)[number]["id"];
export type ImageProviderId = (typeof IMAGE_PROVIDERS)[number]["id"];

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
} as const;
