import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

/** Same formula as src/lib/posterpal/graph.ts appSecretProof. */
function appSecretProof(accessToken, appSecret) {
  return createHmac("sha256", appSecret).update(accessToken).digest("hex");
}

test("appsecret_proof matches HMAC-SHA256 hex of the token keyed by the app secret", () => {
  const rfc = createHmac("sha256", "key").update("The quick brown fox jumps over the lazy dog").digest("hex");
  assert.equal(rfc, "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8");
  assert.equal(appSecretProof("The quick brown fox jumps over the lazy dog", "key"), rfc);
  assert.match(appSecretProof("EAATestToken", "app-secret"), /^[0-9a-f]{64}$/);
});
