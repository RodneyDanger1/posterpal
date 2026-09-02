import assert from "node:assert/strict";
import { test } from "node:test";
import { IMAGE_PROVIDERS, TEXT_PROVIDERS } from "../src/lib/posterpal/providers.ts";

test("every caption model is distinct and DeepSeek is captions-only", () => {
  const ids = TEXT_PROVIDERS.map((p) => p.id);
  assert.deepEqual(ids, ["grok", "openai", "gemini", "deepseek"]);
  assert.equal(
    IMAGE_PROVIDERS.some((p) => p.id === "deepseek"),
    false,
  );
  assert.ok(IMAGE_PROVIDERS.some((p) => p.id === "flux"));
});

test("BYO models declare which setting stores the key", () => {
  for (const p of [...TEXT_PROVIDERS, ...IMAGE_PROVIDERS]) {
    if (p.needsKey) assert.ok(p.settingKey, p.id);
    else assert.equal(p.settingKey, null);
  }
});
