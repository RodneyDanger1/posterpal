import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildWeekStrip,
  DEFAULT_SLOTS,
  nextPostingSlot,
  parseOgTags,
  parseSlots,
  plusDaysIso,
  slotLabel,
  unfurlHostBlocked,
} from "../src/lib/posterpal/slots.ts";

test("parseSlots ignores junk and sorts", () => {
  const slots = parseSlots(JSON.stringify([{ day: 3, hour: 13 }, { day: 2, hour: 13 }, { day: 99, hour: 1 }]));
  assert.deepEqual(slots, [
    { day: 2, hour: 13 },
    { day: 3, hour: 13 },
  ]);
  assert.equal(parseSlots("nope").length, 0);
});

test("nextPostingSlot is at least 15 minutes out", () => {
  const now = new Date("2026-09-01T12:00:00"); // Tuesday
  const next = nextPostingSlot(DEFAULT_SLOTS, now);
  assert.ok(next);
  assert.ok(next.getTime() >= now.getTime() + 15 * 60_000);
});

test("slotLabel is short and local", () => {
  assert.equal(slotLabel({ day: 2, hour: 10 }), "Tue 10am");
  assert.equal(slotLabel({ day: 3, hour: 11 }), "Wed 11am");
  assert.equal(slotLabel({ day: 4, hour: 10 }), "Thu 10am");
});

test("DEFAULT_SLOTS are midweek mornings (2026 Pages windows)", () => {
  assert.deepEqual(DEFAULT_SLOTS, [
    { day: 2, hour: 10 },
    { day: 3, hour: 11 },
    { day: 4, hour: 10 },
  ]);
});

test("buildWeekStrip counts scheduled vs published on the right day", () => {
  const now = new Date("2026-09-01T08:00:00");
  const week = buildWeekStrip(
    [
      { status: "LocalScheduled", scheduled_publish_time: "2026-09-01T13:00:00" },
      { status: "Published", published_time: "2026-09-02T10:00:00" },
    ],
    now,
  );
  assert.equal(week.length, 7);
  assert.equal(week[0].isToday, true);
  assert.equal(week[0].scheduled, 1);
  assert.equal(week[1].published, 1);
});

test("plusDaysIso adds a week", () => {
  const next = plusDaysIso("2026-09-01T13:00:00.000Z", 7);
  assert.equal(new Date(next).getUTCDate(), 8);
});

test("unfurl blocks facebook.com and loopback, allows shops", () => {
  assert.equal(unfurlHostBlocked("www.facebook.com"), true);
  assert.equal(unfurlHostBlocked("127.0.0.1"), true);
  assert.equal(unfurlHostBlocked("192.168.1.1"), true);
  assert.equal(unfurlHostBlocked("myshop.etsy.com"), false);
});

test("parseOgTags reads property= content=", () => {
  const html = `<html><head><meta property="og:title" content="River tote" /><meta name="og:description" content="Washable." /></head></html>`;
  const og = parseOgTags(html);
  assert.equal(og.title, "River tote");
});
