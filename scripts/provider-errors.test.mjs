import assert from "node:assert/strict";
import { test } from "node:test";

import {
  platformKeyEnvName,
  providerBadResponse,
  providerFailure,
  providerKeyMissing,
  providerLabel,
  ProviderRequestError,
} from "../src/lib/posterpal/provider-errors.ts";

test("provider failures are named by kind with the provider label and HTTP status", () => {
  const auth = providerFailure("deepseek", { status: 401, body: '{"error":{"message":"Authentication Fails"}}' });
  assert.ok(auth instanceof ProviderRequestError);
  assert.equal(auth.kind, "auth");
  assert.equal(auth.provider, "deepseek");
  assert.equal(auth.status, 401);
  assert.equal(auth.code, "deepseek.auth");
  assert.match(auth.message, /^DeepSeek rejected the API key \(HTTP 401\)/);
  assert.match(auth.message, /DEEPSEEK_API_KEY/, "must tell the operator which server env key to fix");
  assert.doesNotMatch(auth.message, /Authentication Fails/, "raw vendor body is not the operator message");

  const rate = providerFailure("openai", { status: 429, body: "slow down" });
  assert.equal(rate.kind, "rate_limit");
  assert.match(rate.message, /OpenAI rate-limited the request \(HTTP 429\)/);

  const model = providerFailure("deepseek", { status: 400, body: '{"error":{"message":"Model Not Exist"}}' });
  assert.equal(model.kind, "model");
  assert.match(model.message, /DeepSeek rejected the model or request shape \(HTTP 400\): Model Not Exist/);

  const server = providerFailure("gemini", { status: 503, body: "unavailable" });
  assert.equal(server.kind, "server");

  const network = providerFailure("deepseek", { network: true });
  assert.equal(network.kind, "network");
  assert.equal(network.status, null);
  assert.match(network.message, /could not be reached from this server/);

  const timeout = providerFailure("grok", { timedOut: true });
  assert.equal(timeout.kind, "timeout");
  assert.match(timeout.message, /timed out/);

  const bad = providerBadResponse("custom");
  assert.equal(bad.kind, "bad_response");
  assert.equal(bad.code, "custom.bad_response");
});

test("a missing key is a named refusal that names the env var or Settings", () => {
  const deepseek = providerKeyMissing("deepseek");
  assert.equal(deepseek.kind, "auth");
  assert.match(deepseek.message, /DeepSeek is not configured on this desk/);
  assert.match(deepseek.message, /DEEPSEEK_API_KEY/);

  const openai = providerKeyMissing("openai");
  assert.match(openai.message, /OpenAI is not configured/);
  assert.match(openai.message, /paste the key in Settings/);
  assert.equal(openai.status, null);
});

test("provider error bodies cannot leak a bearer token or API key into a log line", () => {
  const leaked = providerFailure("deepseek", {
    status: 500,
    body: 'upstream said Authorization: Bearer sk-abcdef1234567890 {"message":"boom"}',
  });
  assert.doesNotMatch(leaked.message, /sk-abcdef1234567890/);
  assert.doesNotMatch(leaked.message, /Bearer sk-/);
  assert.match(leaked.message, /\[redacted\]/);
});

test("the platform-key env names are exactly the ones the deployment sets", () => {
  assert.equal(platformKeyEnvName("deepseek"), "DEEPSEEK_API_KEY");
  assert.equal(platformKeyEnvName("grok"), "XAI_API_KEY");
  assert.equal(platformKeyEnvName("openai"), null, "OpenAI is BYO-key only");
  assert.equal(providerLabel("deepseek"), "DeepSeek");
  assert.equal(providerLabel("flux"), "Flux");
});
