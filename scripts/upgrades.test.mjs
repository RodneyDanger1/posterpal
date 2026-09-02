import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDeskSnapshot, formatDeskSystemContext, snapshotLooksLikeOpsBrief } from "../src/lib/posterpal/desk-context.ts";
import { hopsFromDesk, rankHops, wantsFailedFix, wantsInboxDrafts, wantsCalendar, wantsMemory, wantsConnect } from "../src/lib/posterpal/agent-hops.ts";
import { looksLikeAppId } from "../src/lib/posterpal/meta-setup.ts";
import { isBrowsableUrl, urlsFromBrief } from "../src/lib/posterpal/research.ts";
import { parsePersona, personaForNeed, pickPersona, skillsForRun } from "../src/lib/posterpal/agent-skills.ts";
import { formatHappening, happeningScopeLabel } from "../src/lib/posterpal/desk-context.ts";
import { hourHeatmap, isIanaTimeZone, suggestedIndustrySlot, zonedDayHour } from "../src/lib/posterpal/operator.ts";
import { DEFAULT_SLOTS, scheduleWhenForPage, nextPostingSlot } from "../src/lib/posterpal/slots.ts";

test("formatDeskSystemContext is honest about idle worker and empty needs", () => {
  const text = formatDeskSystemContext({
    health: {
      status: "ok",
      db: "up",
      workerFresh: false,
      schedulerFresh: true,
      workerLastTick: null,
      schedulerLastTick: "2026-09-01T12:00:00.000Z",
    },
    needs: [{ title: "Overdue: Saturday story hour", kind: "overdue", urgency: "now" }],
    logs: [{ scope: "tick.rss", message: "Feed timed out" }],
    cadence: { postedLast24h: 3, warnAt: 8, blockAt: 20, level: "ok" },
    dueSoon: 1,
  });
  assert.match(text, /Server & Desk Context/);
  assert.match(text, /DB: up/);
  assert.match(text, /Background worker: Idle\/Pending/);
  assert.match(text, /Overdue: Saturday story hour/);
  assert.match(text, /Cadence this Page: 3 in 24h/);
  assert.doesNotMatch(text, /facebook\.com/);
});

test("zonedDayHour uses the audience zone, not the host clock", () => {
  // 2026-09-01 18:00 UTC = Tuesday 1pm America/Chicago (CDT, UTC-5)
  const chicago = zonedDayHour("2026-09-01T18:00:00.000Z", "America/Chicago");
  assert.equal(chicago?.day, 2);
  assert.equal(chicago?.hour, 13);
  const utc = zonedDayHour("2026-09-01T18:00:00.000Z", "UTC");
  assert.equal(utc?.day, 2);
  assert.equal(utc?.hour, 18);
  assert.equal(isIanaTimeZone("America/Chicago"), true);
  assert.equal(isIanaTimeZone("Not/AZone"), false);
});

test("hourHeatmap buckets in the given time zone", () => {
  const cells = hourHeatmap(
    [{ published_time: "2026-09-01T18:00:00.000Z", reactions_count: 4, comments_count: 1, shares_count: 0 }],
    "America/Chicago",
  );
  assert.equal(cells.length, 1);
  assert.equal(cells[0].day, 2);
  assert.equal(cells[0].hour, 13);
  assert.equal(cells[0].score, 6);
});

test("scheduleWhenForPage is at least 15 minutes out", () => {
  const now = new Date("2026-09-01T12:00:00"); // Tuesday after the 10am default
  const when = scheduleWhenForPage(null, now);
  assert.match(when, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  const next = nextPostingSlot(DEFAULT_SLOTS, now);
  assert.ok(next);
  assert.equal(next.getDay(), 3); // Wednesday 11am
  assert.equal(next.getHours(), 11);
});

test("formatDeskSnapshot covers queue, vault, fails, and never invents Graph", () => {
  const text = formatDeskSnapshot({
    generatedAt: "2026-09-01T12:00:00.000Z",
    health: {
      status: "ok",
      db: "up",
      workerFresh: false,
      schedulerFresh: true,
      workerLastTick: null,
      schedulerLastTick: "2026-09-01T11:59:00.000Z",
    },
    pages: { total: 10, live: 1, practice: 9, readOnly: 0, selectedName: "North Shore Books", selectedPractice: false },
    queue: {
      localDraft: 3,
      localScheduled: 2,
      facebookScheduled: 1,
      publishing: 0,
      failed: 1,
      overdue: 1,
      published24h: 4,
    },
    inbox: { needsReply: 2 },
    vault: { valid: 1, invalid: 0, alarm: "soon", expiresAt: "2026-09-08T00:00:00.000Z" },
    quota: { callCountPct: 42, regainMinutes: 0, source: "X-Business-Use-Case-Usage", capturedAt: "2026-09-01T11:50:00.000Z" },
    cadence: { postedLast24h: 3, warnAt: 8, blockAt: 20, level: "ok", reelLast24h: 1, reelLevel: "ok" },
    needs: [{ title: "Overdue — desk was closed", kind: "overdue", urgency: "now", pageName: "North Shore Books", detail: "Saturday story hour" }],
    failed: [{ id: "post-1", pageName: "North Shore Books", error: "Graph 190 — Reconnect Facebook in Settings.", when: "2026-09-01T11:00:00.000Z", message: "Saturday story hour is back." }],
    scheduler: [{ status: "failed", error: "Graph 190", path: "/feed", code: 190, when: "2026-09-01T11:00:00.000Z" }],
    logs: [{ level: "error", scope: "graph.publish", message: "Session expired" }],
    lastSync: "2026-09-01T11:58:00.000Z",
    facebookLastError: null,
    merchCount: 2,
    rssFeeds: 1,
    devices: 1,
    waitingComments: [
      {
        id: "c1",
        author: "Maya",
        message: "How much is the river tote?",
        pageName: "North Shore Books",
        pageId: "p1",
        buyingIntent: true,
      },
    ],
    overduePosts: [],
    ideas: [{ id: "idea-1", title: "River rug photo", body: "Kids on the river rug", column: "photo-needed", pageName: "North Shore Books" }],
    snippets: [{ label: "Hours block", body: "Open 10–6 Tuesday through Saturday." }],
    recentRuns: [{ prompt: "Map this Page", persona: "research", when: "2026-09-01T11:00:00.000Z" }],
    week: [{ label: "1", weekday: "Tue", scheduled: 1, published: 0, isToday: true }],
    collisions: [],
    stills: 2,
    slots: [{ day: 2, hour: 10 }],
    voice: "Warm, local, no corporate filler.",
  });
  assert.match(text, /DESK OPS/);
  assert.match(text, /LocalDraft 3/);
  assert.match(text, /Graph 190/);
  assert.match(text, /North Shore Books/);
  assert.match(text, /you draft only/i);
  assert.match(text, /river tote/);
  assert.match(text, /Later \(parked/);
  assert.match(text, /River rug photo/);
  assert.match(text, /Previous Agent runs/);
  assert.doesNotMatch(text, /access_token|appsecret/i);
});

test("wantsInboxDrafts and hopsFromDesk stay HITL", () => {
  assert.equal(wantsInboxDrafts("Draft inbox replies for waiting comments"), true);
  assert.equal(wantsInboxDrafts("farmers market hours"), false);
  assert.equal(wantsFailedFix("Fix failed publishes on this desk"), true);
  assert.equal(wantsFailedFix("farmers market hours"), false);
  const hops = hopsFromDesk({
    snap: {
      generatedAt: "2026-09-01T12:00:00.000Z",
      health: null,
      pages: { total: 1, live: 1, practice: 0, readOnly: 0, selectedName: "North Shore", selectedPractice: false },
      queue: {
        localDraft: 0,
        localScheduled: 0,
        facebookScheduled: 0,
        publishing: 0,
        failed: 2,
        overdue: 1,
        published24h: 0,
      },
      inbox: { needsReply: 3 },
      vault: { valid: 1, invalid: 0, alarm: "soon", expiresAt: null },
      quota: { callCountPct: null, regainMinutes: null, source: null, capturedAt: null },
      cadence: null,
      needs: [],
      failed: [{ id: "post-fail", pageName: "North Shore", error: "Graph 190", when: "2026-09-01T11:00:00.000Z", message: "Tote restock" }],
      scheduler: [],
      logs: [],
      lastSync: null,
      facebookLastError: null,
      merchCount: 0,
      rssFeeds: 0,
      devices: 0,
      waitingComments: [],
      overduePosts: [],
      ideas: [{ id: "idea-1", title: "River rug", body: "Need a photo of Saturday story hour", column: "photo-needed", pageName: "North Shore" }],
      snippets: [],
      recentRuns: [],
      week: [],
      collisions: [],
      stills: 0,
      slots: [],
      voice: null,
    },
    pageId: "p1",
    storytelling: "Saturday story hour is back.",
  });
  assert.ok(hops.some((h) => h.kind === "failed" && h.postId === "post-fail"));
  assert.ok(hops.some((h) => h.kind === "failed" && String(h.href).includes("tab=failed")));
  assert.ok(hops.some((h) => h.kind === "inbox"));
  assert.ok(hops.some((h) => h.kind === "vault"));
  assert.ok(hops.some((h) => h.kind === "schedule" && h.caption));
  assert.ok(hops.some((h) => h.ideaId === "idea-1"));
  assert.ok(!hops.some((h) => /publish now/i.test(h.label)));
});

test("pickPersona and skillsForRun stay HITL-named", () => {
  assert.equal(pickPersona("What's happening on this desk?"), "ops");
  assert.equal(pickPersona("Draft inbox replies for waiting comments"), "inbox");
  assert.equal(pickPersona("Fix failed publishes"), "rewrite");
  assert.equal(pickPersona("Write a tote restock with #ad"), "shop");
  assert.equal(pickPersona("Plan this week's posting slots"), "calendar");
  assert.equal(pickPersona("Recall parked Later ideas and recent Agent runs"), "memory");
  assert.equal(pickPersona("Help me connect this desk to my Meta developer app"), "connect");
  assert.equal(wantsConnect("paste the App ID and Facebook Login"), true);
  assert.equal(looksLikeAppId("123456789012345"), true);
  assert.equal(looksLikeAppId("PosterPal"), false);
  assert.equal(isBrowsableUrl("https://developers.facebook.com/docs/graph-api"), true);
  assert.equal(isBrowsableUrl("https://www.facebook.com/some-page"), false);
  assert.equal(urlsFromBrief("see https://www.winonadailynews.com/local/hours").length, 1);
  assert.equal(wantsMemory("Recall parked Later ideas"), true);
  assert.equal(pickPersona("farmers market hours this weekend"), "research");
  assert.equal(parsePersona("calendar"), "calendar");
  assert.equal(parsePersona("nope"), null);
  assert.equal(personaForNeed("comment"), "inbox");
  assert.equal(personaForNeed("failed"), "rewrite");
  assert.equal(wantsCalendar("Plan this week's posting slots"), true);
  const skills = skillsForRun({
    persona: "ops",
    brief: "Diagnose this desk",
    hasCaptions: true,
    draftedInbox: false,
    rewroteFailed: false,
    snap: { vault: { alarm: "soon" }, cadence: { level: "warn", reelLevel: "ok" }, quota: { callCountPct: 81 } },
  });
  assert.ok(skills.includes("diagnose-desk"));
  assert.ok(skills.includes("draft-captions"));
  assert.ok(skills.includes("vault-watch"));
  assert.ok(skills.includes("cadence-watch"));
  assert.ok(skills.includes("quota-watch"));
  assert.ok(!skills.includes("draft-inbox"));
  const cal = skillsForRun({
    persona: "calendar",
    brief: "Plan this week's posting slots",
    hasCaptions: false,
    draftedInbox: false,
    rewroteFailed: false,
    snap: { queue: { overdue: 2 } },
  });
  assert.ok(cal.includes("week-plan"));
});

test("rankHops puts inbox hops first for the inbox persona", () => {
  const ranked = rankHops("inbox", [
    { id: "cal", kind: "calendar", label: "Open Calendar", href: "/calendar" },
    { id: "in", kind: "inbox", label: "Open inbox", href: "/inbox" },
    { id: "comp", kind: "composer", label: "Open Composer", href: "/composer" },
  ]);
  assert.equal(ranked[0].kind, "inbox");
  assert.equal(ranked[1].kind, "composer");
});

test("formatHappening uses operator-facing scope names", () => {
  assert.equal(happeningScopeLabel("agent.run"), "Agent");
  assert.match(
    formatHappening({ level: "info", scope: "tick.done", message: "scheduler published 0; Graph sync skipped" }),
    /Ticker/,
  );
});

test("snapshotLooksLikeOpsBrief catches diagnose and what's happening", () => {
  assert.equal(snapshotLooksLikeOpsBrief("Diagnose this desk"), true);
  assert.equal(snapshotLooksLikeOpsBrief("What's happening on this desk?"), true);
  assert.equal(snapshotLooksLikeOpsBrief("farmers market hours this weekend"), false);
});

test("suggestedIndustrySlot is Wednesday 11am", () => {
  const now = new Date("2026-09-01T08:00:00"); // Tuesday morning, 11am is still ahead
  const slot = suggestedIndustrySlot(now);
  assert.match(slot, /T11:00$/);
});
