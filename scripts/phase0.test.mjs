import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildFeedPublishPayload,
  facebookScheduleWindow,
  graphOperatorMessage,
  mapGraphError,
  retryDelayMs,
} from "../src/lib/posterpal/graph.ts";
import { monetizationFitness } from "../src/lib/posterpal/operator.ts";
import { carouselPartialWarning } from "../src/lib/posterpal/carousel.ts";
import { facebookAppNameIssues } from "../src/lib/posterpal/facebook-names.ts";
import { mapBulkCsvRows, parseCsv } from "../src/lib/posterpal/csv.ts";
import { parseRssItems } from "../src/lib/posterpal/rss.ts";

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
  for (const code of [4, 17, 32, 613, 80001, 80004, 341]) {
    const m = mapGraphError({ httpStatus: 400, code });
    assert.equal(m.kind, "rate_limit", `code ${code}`);
    assert.equal(m.retryable, true, `code ${code}`);
    assert.ok(m.operatorHint.length > 10);
  }
});

test("mapGraphError: 506 duplicate and 1609005 link scrape are not retried", () => {
  const dup = mapGraphError({ httpStatus: 400, code: 506, message: "Duplicate status message" });
  assert.equal(dup.kind, "duplicate");
  assert.equal(dup.retryable, false);
  assert.match(dup.operatorHint, /Rewrite/);
  const link = mapGraphError({ httpStatus: 400, code: 1609005 });
  assert.equal(link.retryable, false);
  assert.match(link.operatorHint, /shop URL/);
});

test("mapGraphError: permission and token hints tell the operator what to click", () => {
  const perm = mapGraphError({ httpStatus: 403, code: 10 });
  assert.equal(perm.kind, "permission");
  assert.match(perm.operatorHint, /Connect/);
  const proof = mapGraphError({ httpStatus: 400, code: 104 });
  assert.match(proof.operatorHint, /App Secret/);
  const msg = graphOperatorMessage(mapGraphError({ httpStatus: 400, code: 190, fbtraceId: "abc" }));
  assert.match(msg, /Reconnect Facebook/);
  assert.match(msg, /fbtrace abc/);
});

test("retryDelayMs stays bounded and uses header regain as a small bump", () => {
  const d = retryDelayMs(0, { sourceHeader: "X-App-Usage", callCountPct: 100, estimatedRegainMinutes: 5 });
  assert.ok(d >= 400);
  assert.ok(d <= 20_000);
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

test("facebookScheduleWindow: Reels cap at 29 days", () => {
  const now = new Date("2026-08-21T12:00:00Z");
  assert.equal(facebookScheduleWindow(new Date("2026-09-19T12:00:00Z"), now, "Reel"), null);
  assert.match(facebookScheduleWindow(new Date("2026-09-20T12:01:00Z"), now, "Reel") ?? "", /29 days/);
  assert.equal(facebookScheduleWindow(new Date("2026-09-20T12:00:00Z"), now, "Photo"), null);
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

test("carouselPartialWarning: no dropped slides means no warning (#15)", () => {
  assert.equal(carouselPartialWarning(5, []), null);
});

test("carouselPartialWarning: dropped slides are named, never silent (#15)", () => {
  const w = carouselPartialWarning(5, ["stack-1.jpg", "stack-2.jpg"]);
  assert.ok(w, "must warn when slides were dropped");
  assert.match(w, /3 of 5 slides/);
  assert.match(w, /stack-1\.jpg/);
  assert.match(w, /stack-2\.jpg/);
});

test("carouselPartialWarning: all dropped still reports the numbers", () => {
  const w = carouselPartialWarning(2, ["a.jpg", "b.jpg"]);
  assert.ok(w);
  assert.match(w, /0 of 2 slides/);
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

test("parseCsv: quoted commas, escaped quotes, CRLF, and blank-line skipping", () => {
  const text = [
    "caption,when,page",
    '"Staff pick, a novel on a train", 2026-09-01 16:00, North Shore Books',
    '"Say ""hi"" to the neighbors", , Winona Weekend',
    "",
    "Plain row without quotes",
  ].join(String.fromCharCode(13, 10));
  const rows = parseCsv(text);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[0], ["caption", "when", "page"]);
  assert.equal(rows[1][0], "Staff pick, a novel on a train");
  assert.equal(rows[2][0], 'Say "hi" to the neighbors');
  assert.deepEqual(rows[3], ["Plain row without quotes"]);
});

test("mapBulkCsvRows respects named headers in any order", () => {
  const mapped = mapBulkCsvRows(
    parseCsv("page,caption,when\nNorth Shore Books,Story hour,2026-09-01 16:00"),
  );
  assert.equal(mapped.length, 1);
  assert.equal(mapped[0].message, "Story hour");
  assert.equal(mapped[0].pageId, "North Shore Books");
  assert.equal(mapped[0].when, "2026-09-01 16:00");
});

test("facebook docs fetcher only allows official developer hosts", async () => {
  const { isAllowedDocsUrl, stripHtmlToText, fetchOfficialGuide } = await import(
    "../src/lib/posterpal/facebook-docs.ts"
  );
  assert.equal(isAllowedDocsUrl("https://developers.facebook.com/docs/development/create-an-app"), true);
  assert.equal(isAllowedDocsUrl("https://developers.meta.com/docs/"), true);
  assert.equal(isAllowedDocsUrl("https://www.facebook.com/pages/creation/"), false);
  assert.equal(isAllowedDocsUrl("https://m.facebook.com/"), false);
  assert.equal(isAllowedDocsUrl("http://developers.facebook.com/docs"), false);
  const text = stripHtmlToText(
    "<html><head><title>Create an App</title></head><body><script>evil()</script><article><p>Use Development Mode.</p></article></body></html>",
  );
  assert.match(text, /Create an App/);
  assert.match(text, /Development Mode/);
  assert.doesNotMatch(text, /evil/);
  const blocked = await fetchOfficialGuide("https://www.facebook.com/");
  assert.equal(blocked.error, "url_not_allowed");
});

test("cross-page duplicate: identical captions across Pages are a block", async () => {
  const { runPolicyChecklist } = await import("../src/lib/posterpal/policy.ts");
  const r = runPolicyChecklist({
    message: "Saturday story hour is back at 10:30 on the river rug with cider.",
    hasImages: false,
    missingAlt: false,
    createdWithAi: false,
    recentMessages: [],
    otherPageMessages: [
      {
        id: "x",
        pageName: "Winona Weekend",
        message: "Saturday story hour is back at 10:30 on the river rug with cider.",
      },
    ],
  });
  assert.equal(r.canPublish, false);
  assert.ok(r.flags.some((f) => f.id === "cross-page-duplicate"));
});

test("uniquenessScore: identical fleet captions score 0; distinct score 100", async () => {
  const { uniquenessScore } = await import("../src/lib/posterpal/fleet.ts");
  const { jaccard, tokenize } = await import("../src/lib/posterpal/policy.ts");
  const { PRACTICE_FLEET, FLEET_SIZE } = await import("../src/lib/posterpal/fleet.ts");
  assert.equal(FLEET_SIZE, 10);
  assert.equal(new Set(PRACTICE_FLEET.map((p) => p.name)).size, 10);
  const zero = uniquenessScore(
    ["Saturday story hour is back at the river rug"],
    ["Saturday story hour is back at the river rug"],
    jaccard,
    tokenize,
  );
  assert.equal(zero, 0);
  const full = uniquenessScore(
    ["Thursday kit: pork, squash, cider pan sauce. Pickup 4–6."],
    ["Open-studio Saturday 10–2. River glaze just came out of the kiln."],
    jaccard,
    tokenize,
  );
  assert.ok(full >= 70, `expected high uniqueness, got ${full}`);
});

test("parseRssItems: titles, CDATA, HTML stripping, and atom links", () => {
  const xml = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item><title>Plain &amp; simple</title><link>https://example.com/a</link><pubDate>Tue, 01 Sep 2026 16:00:00 GMT</pubDate></item>
  <item><title><![CDATA[CDATA <b>bold</b> title]]></title><description>text</description></item>
</channel></rss>`;
  const items = parseRssItems(xml);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, "Plain & simple");
  assert.equal(items[0].link, "https://example.com/a");
  assert.equal(items[0].pubDate, "Tue, 01 Sep 2026 16:00:00 GMT");
  assert.equal(items[1].title, "CDATA bold title");

  const atom = `<feed><entry><title>Atom entry</title><link href="https://example.com/b"/></entry></feed>`;
  assert.equal(parseRssItems(atom)[0].title, "Atom entry");
});
