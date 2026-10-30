import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

// DeepSeek is supplied as a PLATFORM key on the self-host stack (VPS env), not
// typed into the browser. These pin the wiring rules:
//   - the catalog uses the official OpenAI-compatible base and deepseek-flash
//   - DEEPSEEK_API_KEY alone makes the desk AI-capable (hasAiKey/selectable)
//   - an operator key still wins over the platform key
//   - no key at all is a NAMED refusal, never a silent empty caption
const savedDeepseek = process.env.DEEPSEEK_API_KEY;
const savedXai = process.env.XAI_API_KEY;
delete process.env.DEEPSEEK_API_KEY;
delete process.env.XAI_API_KEY;

const ai = await import("../src/lib/posterpal/ai.ts");
const { TEXT_PROVIDERS } = await import("../src/lib/posterpal/providers.ts");

const AI_SOURCE = readFileSync(fileURLToPath(new URL("../src/lib/posterpal/ai.ts", import.meta.url)), "utf8");

test("DeepSeek uses the official OpenAI-compatible base + deepseek-flash model", () => {
  const spec = TEXT_PROVIDERS.find((p) => p.id === "deepseek");
  assert.ok(spec, "DeepSeek must stay in the verified provider catalog");
  assert.equal(spec.models[0], "deepseek-flash", "deepseek-flash is the documented primary model");
  assert.equal(spec.settingKey, "deepseek_api_key");
  assert.match(AI_SOURCE, /https:\/\/api\.deepseek\.com\/chat\/completions/, "chat path must be the official base + /chat/completions");
  assert.doesNotMatch(AI_SOURCE, /api\.deepseek\.com\/v1/, "must not invent a /v1 prefix the docs do not use");
});

test("a platform DeepSeek env key enables AI without a per-user key", () => {
  process.env.DEEPSEEK_API_KEY = "sk-test-platform-only";
  try {
    assert.equal(ai.platformTextApiKey("deepseek"), "sk-test-platform-only");
    assert.equal(ai.grokAvailable(), false, "xAI key is absent");
    assert.equal(ai.aiAvailable(), true, "DeepSeek alone must make the desk AI-capable");
    assert.equal(ai.resolveTextApiKey("deepseek", null), "sk-test-platform-only");
    assert.equal(ai.resolveTextApiKey("deepseek", "  sk-operator-saved  "), "sk-operator-saved");
    assert.equal(ai.resolveTextApiKey("openai", null), null, "OpenAI stays BYO-key only");
  } finally {
    delete process.env.DEEPSEEK_API_KEY;
  }
});

test("without any key the DeepSeek call is a named refusal that names the env var", async () => {
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.XAI_API_KEY;
  await assert.rejects(
    ai.chatWithProvider({ provider: "deepseek", system: "Reply with pong.", user: "ping", maxTokens: 8 }),
    (error) => {
      assert.equal(error.name, "ProviderRequestError");
      assert.equal(error.kind, "auth");
      assert.equal(error.provider, "deepseek");
      assert.match(error.message, /DeepSeek is not configured on this desk/);
      assert.match(error.message, /DEEPSEEK_API_KEY/);
      return true;
    },
  );
});

test("DeepSeek reasoning headroom is preserved: bounded, >=900, capped at 4000", () => {
  // b87e7b7: deepseek-flash bills reasoning tokens against max_tokens; the desk
  // adds headroom so JSON rewrites are not truncated to empty content.
  assert.equal(ai.deepseekTokenBudget(16), 900, "tiny probes still get a usable floor");
  assert.equal(ai.deepseekTokenBudget(900), 2200);
  assert.equal(ai.deepseekTokenBudget(3000), 4000);
  assert.equal(ai.deepseekTokenBudget(0), 900);
  for (const n of [0, 16, 500, 900, 2000, 9000]) {
    const budget = ai.deepseekTokenBudget(n);
    assert.ok(budget >= 900 && budget <= 4000, `budget ${budget} out of bounds for ${n}`);
  }
});

test("aiAvailable tracks only the platform keys it knows about", () => {
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.XAI_API_KEY;
  assert.equal(ai.aiAvailable(), false);
  process.env.XAI_API_KEY = "xai-test-only";
  try {
    assert.equal(ai.grokAvailable(), true);
    assert.equal(ai.aiAvailable(), true);
  } finally {
    if (savedXai === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = savedXai;
    if (savedDeepseek === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = savedDeepseek;
  }
});
