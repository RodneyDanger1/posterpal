import assert from "node:assert/strict";
import { test } from "node:test";
import {
  IMAGE_PROVIDERS,
  PROVIDERS_VERIFIED_AT,
  PROVIDER_SETTING_KEYS,
  TEXT_PROVIDERS,
  imageSpec,
  textSpec,
  vendorImageOptions,
} from "../src/lib/posterpal/providers.ts";

test("every caption model is distinct and DeepSeek is captions-only", () => {
  const ids = TEXT_PROVIDERS.map((p) => p.id);
  assert.deepEqual(ids, ["grok", "openai", "gemini", "deepseek", "custom"]);
  assert.equal(
    IMAGE_PROVIDERS.some((p) => p.id === "deepseek"),
    false,
  );
  assert.ok(IMAGE_PROVIDERS.some((p) => p.id === "flux"));
  assert.ok(IMAGE_PROVIDERS.some((p) => p.id === "custom"), "custom image endpoint");
});

test("BYO models declare which setting stores the key", () => {
  for (const p of [...TEXT_PROVIDERS, ...IMAGE_PROVIDERS]) {
    if (p.needsKey) assert.ok(p.settingKey, p.id);
    else assert.equal(p.settingKey, null);
  }
});

// ── Catalog integrity (model IDs verified against official docs 2026-10-29) ──

test("verified-at date is pinned", () => {
  assert.equal(PROVIDERS_VERIFIED_AT, "2026-10-29");
});

test("every provider spec is fully described", () => {
  for (const p of TEXT_PROVIDERS) {
    assert.ok(p.label.length > 0, `${p.id} label`);
    assert.ok(p.hint.length > 20, `${p.id} hint`);
    assert.ok(p.models.length >= 1, `${p.id} models`);
    assert.ok(p.timeoutMs >= 5_000 && p.timeoutMs <= 180_000, `${p.id} timeout`);
  }
  for (const p of IMAGE_PROVIDERS) {
    assert.ok(p.models.length >= 1, `${p.id} models`);
    assert.ok(p.aspectRatios.length >= 1, `${p.id} aspect ratios`);
    assert.ok(
      p.aspectRatios.every((r) => /^\d+(\.\d+)?:\d+(\.\d+)?$/.test(r)),
      `${p.id} ratio format`,
    );
    assert.ok(p.timeoutMs >= 10_000 && p.timeoutMs <= 180_000, `${p.id} timeout`);
    assert.ok(["b64_json", "url", "inline"].includes(p.returns), `${p.id} returns`);
  }
});

test("primary model IDs match the verified vendor docs", () => {
  assert.equal(textSpec("grok").models[0], "grok-4.7"); // xAI models page
  assert.equal(imageSpec("grok").models[0], "grok-imagine-image-2.0"); // xAI image guide
  assert.equal(textSpec("deepseek").models[0], "deepseek-flash"); // DeepSeek quick start
  assert.equal(imageSpec("gemini").models[0], "gemini-nano-banana-2.1"); // Google image guide
  assert.equal(imageSpec("openai").models[0], "gpt-image-2.5-flare"); // OpenAI image guide
});

test("setting keys map to the provider that owns them", () => {
  for (const [settingKey, providerId] of Object.entries(PROVIDER_SETTING_KEYS)) {
    const spec = [...TEXT_PROVIDERS, ...IMAGE_PROVIDERS].find((p) => p.id === providerId);
    assert.ok(spec, `${settingKey} -> unknown provider`);
    assert.equal(spec.settingKey, settingKey);
  }
});

test("unknown provider ids throw instead of silently defaulting", () => {
  assert.throws(() => textSpec("nope"), /Unknown text provider/);
  assert.throws(() => imageSpec("nope"), /Unknown image provider/);
});

test("vendorImageOptions defaults and rejects unsupported values", () => {
  const fallback = vendorImageOptions(imageSpec("grok"));
  assert.equal(fallback.aspectRatio, "1:1");
  assert.equal(fallback.resolution, "1k");

  const openai = vendorImageOptions(imageSpec("openai"), { aspectRatio: "21:9", size: "999x999" });
  assert.equal(openai.aspectRatio, "1:1");
  assert.equal(openai.size, "1024x1024");

  const supported = vendorImageOptions(imageSpec("openai"), { aspectRatio: "16:9", size: "1536x1024" });
  assert.equal(supported.aspectRatio, "16:9");
  assert.equal(supported.size, "1536x1024");
});

test("Flux image_size preset follows the aspect preset", () => {
  assert.equal(vendorImageOptions(imageSpec("flux"), { aspectRatio: "16:9" }).fluxSize, "landscape_4_3");
  assert.equal(vendorImageOptions(imageSpec("flux"), { aspectRatio: "9:16" }).fluxSize, "portrait_4_3");
  assert.equal(vendorImageOptions(imageSpec("flux"), { aspectRatio: "1:1" }).fluxSize, "square_hd");
});
