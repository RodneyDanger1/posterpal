import assert from "node:assert/strict";
import { test } from "node:test";
import { hashDeviceToken, mintDeviceToken } from "../src/lib/posterpal/device-token.ts";
import { isAllowedDocsUrl } from "../src/lib/posterpal/facebook-docs.ts";

test("device tokens are ppd_ prefixed and hash stably", () => {
  const a = mintDeviceToken();
  const b = mintDeviceToken();
  assert.match(a, /^ppd_[0-9a-f]{64}$/);
  assert.notEqual(a, b);
  assert.equal(hashDeviceToken(a), hashDeviceToken(a));
  assert.notEqual(hashDeviceToken(a), hashDeviceToken(b));
});

test("paired-device bearer is distinct from Facebook.com scraping", () => {
  assert.equal(isAllowedDocsUrl("https://developers.facebook.com/docs/facebook-login"), true);
  assert.equal(isAllowedDocsUrl("https://www.facebook.com/"), false);
});
