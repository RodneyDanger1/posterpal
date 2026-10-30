import assert from "node:assert/strict";
import { test } from "node:test";

import { audit } from "./capability-audit.mjs";

// Capability census pin: fails when a claimed capability loses its code path, a
// provider loses its handler, an agent skill is advertised but never gated, or a
// secret-shaped string appears in source.
const result = audit();

test("audit finds the expected surface (derived, not typed by hand)", () => {
  assert.ok(result.counts.serverFns >= 70, `server fns: ${result.counts.serverFns}`);
  assert.ok(result.counts.personas >= 8, `personas: ${result.counts.personas}`);
  assert.ok(result.counts.skills >= 6, `skills: ${result.counts.skills}`);
  assert.equal(result.counts.textProviders, 5);
  assert.equal(result.counts.imageProviders, 5);
});

test("no advertised provider, persona or skill is unimplemented", () => {
  assert.deepEqual(result.agent.personasMissing, []);
  assert.deepEqual(result.agent.skillsUnhandled, []);
  assert.deepEqual(result.providers.textMissing, []);
  assert.deepEqual(result.providers.imageMissing, []);
  assert.equal(result.agent.agentRunnerPresent, true);
  assert.equal(result.agent.hitlRefusalPresent, true);
});

test("every claimed product capability has a code marker", () => {
  const missing = result.capabilities.filter((c) => !c.present).map((c) => c.name);
  assert.deepEqual(missing, []);
  assert.ok(result.counts.capabilitiesTotal >= 15);
});

test("custom provider endpoint is SSRF-guarded", () => {
  assert.equal(result.providers.customGuard, true);
  assert.equal(result.providers.ssrfGuardModule, true);
});

test("no hard failures in the audit", () => {
  assert.deepEqual(result.failures, []);
});
