import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildFeedPublishPayload,
  facebookScheduleWindow,
  mapGraphError,
} from "../src/lib/posterpal/graph.ts";
import { monetizationFitness } from "../src/lib/posterpal/operator.ts";
import { facebookAppNameIssues } from "../src/lib/posterpal/facebook-names.ts";

// Regression tests for Surpass.md §8 (audit 2026-08-21) — the publish/reliability paths.

test("mapGraphError: 190 is a re-auth token error, never retried", () => {
  const m = mapGraphError({ httpStatus: 400, code: 190, message: "Session expired" });
  assert.equal(m.kind, "token");
  assert.equal(m.retryable, false);
});

test("mapGraphError: Graph 100 is invalid_param (publish-now must fail, not silently schedule)", () => {
  const m = mapGraphError({ httpStatus: 400, code: 100, message: "Invalid parameter" });
  assert.equal(m.kind, "invalid_param");
  assert.equal(m.retryable, false);
});

test("mapGraphError: code 1 with scheduling in the message is unknown_schedule", () => {
  const m = mapGraphError({ httpStatus: 400, code: 1, message: "Scheduling is not available for this Page" });
  assert.equal(m.kind, "unknown_schedule");
});

test("mapGraphError: rate-limit codes are retryable", () => {
  for (const code of [4, 17, 32, 613, 80001]) {
    const m = mapGraphError({ httpStatus: 400, code });
    assert.equal(m.kind, "rate_limit", `code ${code}`);
    assert.equal(m.retryable, true, `code ${code}`);
  }
});

test("mapGraphError: 5xx is a retryable server error", () => {
  const m = mapGraphError({ httpStatus: 503, message: "down" });
  assert.equal(m.kind, "server");
  assert.equal(m.retryable, true);
});

test("facebookScheduleWindow: inside 10m–30d is null (Graph accepts it)", () => {
  const now = new Date("2026-08-21T12:00:00Z");
  assert.equal(facebookScheduleWindow(new Date("2026-08-21T12:12:00Z"), now), null);
  assert.equal(facebookScheduleWindow(new Date("2026-09-19T12:00:00Z"), now), null);
});

test("facebookScheduleWindow: sooner than 10 minutes stays local", () => {
  const now = new Date("2026-08-21T12:00:00Z");
  assert.match(facebookScheduleWindow(new Date("2026-08-21T12:05:00Z"), now) ?? "", /10 minutes/);
});

test("facebookScheduleWindow: beyond 30 days stays local", () => {
  const now = new Date("2026-08-21T12:00:00Z");
  assert.match(facebookScheduleWindow(new Date("2026-09-25T12:00:00Z"), now) ?? "", /30 days/);
});

test("buildFeedPublishPayload: publish-now sends published=true and no schedule", () => {
  const p = buildFeedPublishPayload({ message: "hi", mode: "now" });
  assert.equal(p.published, true);
  assert.equal(p.scheduled_publish_time, undefined);
});

test("buildFeedPublishPayload: schedule sends published=false with unix time", () => {
  const p = buildFeedPublishPayload({ message: "hi", mode: "schedule", scheduledUnix: 1_752_000_000 });
  assert.equal(p.published, false);
  assert.equal(p.scheduled_publish_time, 1_752_000_000);
});

test("buildFeedPublishPayload: fb-draft has published=false and NO schedule (bug #16 regression)", () => {
  const p = buildFeedPublishPayload({ message: "hi", mode: "fb-draft", scheduledUnix: 1_752_000_000 });
  assert.equal(p.published, false);
  assert.equal(p.scheduled_publish_time, undefined);
});

test("monetizationFitness: per-Page inputs drive the score, not desk-wide", () => {
  const base = {
    fanCount: 2847,
    merchCount: 2,
    mixDiversity: 3,
    inboxCount: 2,
    failedCount: 1,
    vaultExpiresAt: null,
    postedLast24h: 3,
    cadenceWarn: 8,
  };
  const desk = monetizationFitness(base);
  const clean = monetizationFitness({ ...base, failedCount: 0, inboxCount: 0 });
  assert.ok(clean.score > desk.score, "a clean queue must score higher than one with failures");
  const gap = monetizationFitness({ ...base, merchCount: 0, mixDiversity: 1 });
  assert.ok(gap.score < desk.score, "missing merch and a one-format mix must score lower");
  assert.ok(desk.items.some((i) => i.id === "failed" && !i.ok), "failed item must be a gap");
});

test("facebookAppNameIssues: BookBoss is rejected (Meta reads Book as a Facebook reference)", () => {
  const issues = facebookAppNameIssues("BookBoss");
  assert.ok(issues.some((i) => /Book/i.test(i)), issues.join("; "));
  assert.equal(facebookAppNameIssues("BookBoss").length > 0, true);
});

test("facebookAppNameIssues: PosterPal and the safe suggestions are allowed", () => {
  for (const n of ["PosterPal", "PageDesk", "ShoreDesk", "DeskPages", "WinonaDesk"]) {
    assert.deepEqual(facebookAppNameIssues(n), [], n);
  }
});

test("facebookAppNameIssues: Facebook/FB/Meta/Instagram/WhatsApp/Oculus are rejected", () => {
  for (const n of ["Facebook", "FB", "Meta", "InstaBook", "WhatsApp", "Oculus"]) {
    assert.ok(facebookAppNameIssues(n).length > 0, n);
  }
});

test("facebookAppNameIssues: Notebook and MyBook are not Book-readings", () => {
  assert.deepEqual(facebookAppNameIssues("Notebook"), []);
  assert.deepEqual(facebookAppNameIssues("MyBook"), []);
  // Face at a word START is a Facebook reading (conservative): FaceID, FaceTime…
  assert.ok(facebookAppNameIssues("FaceID").length > 0);
});
