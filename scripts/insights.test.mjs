import assert from "node:assert/strict";
import { test } from "node:test";

import { fetchPostMediaViews } from "../src/lib/posterpal/insights.ts";
import { GraphRequestError } from "../src/lib/posterpal/graph.ts";

// Page Insights metrics get deprecated over time, and an invalid metric fails the
// WHOLE Graph request. The sync path therefore asks for views separately, most
// specific metric first, and returns null (never a fabricated 0) if none work.

function withFetch(t, impl) {
  const real = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return impl(String(url));
  };
  t.after(() => {
    globalThis.fetch = real;
  });
  return calls;
}

test("fetchPostMediaViews falls back to the narrower metric when the combined request is invalid", async (t) => {
  const calls = withFetch(t, (url) => {
    if (url.includes("post_total_media_view")) {
      return new Response(
        JSON.stringify({ error: { message: "Invalid metric", code: 100 } }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({ insights: { data: [{ name: "post_media_view", values: [{ value: 42 }] }] } }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  });
  const views = await fetchPostMediaViews("123_456", "EAAtoken", "secret");
  assert.equal(views, 42);
  assert.equal(calls.length, 2);
  // Every call still carries appsecret_proof.
  assert.ok(calls.every((u) => u.includes("appsecret_proof=")));
});

test("fetchPostMediaViews returns null when no metric is available", async (t) => {
  withFetch(
    t,
    () =>
      new Response(JSON.stringify({ error: { message: "Invalid metric", code: 100 } }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
  );
  assert.equal(await fetchPostMediaViews("123_456", "EAAtoken", "secret"), null);
});

test("fetchPostMediaViews returns null when the successful response has no number", async (t) => {
  withFetch(
    t,
    () =>
      new Response(JSON.stringify({ insights: { data: [{ name: "post_media_view", values: [] }] } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  assert.equal(await fetchPostMediaViews("123_456", "EAAtoken", "secret"), null);
});

test("token errors still propagate so the vault can mark re-auth", async (t) => {
  withFetch(
    t,
    () =>
      new Response(JSON.stringify({ error: { message: "Session expired", code: 190 } }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
  );
  await assert.rejects(
    () => fetchPostMediaViews("123_456", "EAAtoken", "secret"),
    (e) => e instanceof GraphRequestError && e.mapped.kind === "token",
  );
});
