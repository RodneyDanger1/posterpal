import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalOrigin, desktopLoopbackCallback, redirectCandidates } from "../src/lib/posterpal/oauth-origin.ts";

test("localhost and ::1 canonicalize to 127.0.0.1", () => {
  assert.equal(canonicalOrigin("http://localhost:8080"), "http://127.0.0.1:8080");
  assert.equal(canonicalOrigin("http://127.0.0.1:8080"), "http://127.0.0.1:8080");
});

test("desktop loopback callback is the URI Facebook must have", () => {
  assert.equal(desktopLoopbackCallback(), "http://127.0.0.1:8080/api/facebook/callback");
});

test("token exchange candidates include the stored redirect first", () => {
  const req = new Request("http://127.0.0.1:8080/api/facebook/callback?code=x");
  const list = redirectCandidates(req, "http://127.0.0.1:8080/api/facebook/callback");
  assert.equal(list[0], "http://127.0.0.1:8080/api/facebook/callback");
  assert.ok(list.includes("http://localhost:8080/api/facebook/callback"));
});
