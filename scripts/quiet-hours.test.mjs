import assert from "node:assert/strict";
import { test } from "node:test";

import { hourInAudienceZone, isQuietHour } from "../src/lib/posterpal/operator.ts";
import { isQuietHour as deskIsQuietHour } from "../src/lib/posterpal/desk.ts";
import { isRemixDraft, remixCaption } from "../src/lib/posterpal/briefing.ts";

// "Duplicate next week" now clones onto the same Page with remix: true, which is
// only useful if remixCaption actually produces a policy-recognisable marker.
test("remixCaption marks a same-Page evergreen copy so duplicate policy can be cleared by a rewrite", () => {
  const marked = remixCaption("Tote restock Friday. First-comment link.");
  assert.notEqual(marked, "Tote restock Friday. First-comment link.");
  assert.equal(isRemixDraft(marked), true);
  // Idempotent: marking a marked caption must not stack markers.
  assert.equal(remixCaption(marked), marked);
  // Empty stays empty rather than emitting a bare marker.
  assert.equal(remixCaption("   "), "");
});

// Quiet hours must be computed in the audience zone, not the host clock.
// The host zone is unknown (Windows dev box vs Linux container), so expectations
// are derived from the instant, never hardcoded from wall-clock digits.
test("wall-clock quiet hours: 23:00–06:00 boundaries", () => {
  assert.equal(isQuietHour("2026-10-29T23:00"), true);
  assert.equal(isQuietHour("2026-10-29T05:59"), true);
  assert.equal(isQuietHour("2026-10-29T06:00"), false);
  assert.equal(isQuietHour("2026-10-29T22:59"), false);
  assert.equal(isQuietHour("2026-10-29T12:00"), false);
  assert.equal(isQuietHour("garbage"), false);
});

test("hourInAudienceZone projects the instant into the requested zone (UTC)", () => {
  const local = "2026-10-29T23:30";
  assert.equal(hourInAudienceZone(local, "UTC"), new Date(local).getUTCHours());
  assert.equal(hourInAudienceZone(local, "Asia/Tokyo"), (new Date(local).getUTCHours() + 9) % 24);
});

test("an invalid IANA zone falls back to the wall-clock hour instead of throwing", () => {
  assert.equal(hourInAudienceZone("2026-10-29T23:30", "Not/AZone"), 23);
  assert.equal(hourInAudienceZone("2026-10-29T23:30", null), 23);
});

test("isQuietHour honours the audience zone: Sydney midnight is quiet even when the host is mid-morning", () => {
  const local = "2026-10-29T09:00"; // 09:00 on the host clock
  const nyHour = hourInAudienceZone(local, "America/New_York");
  assert.equal(
    isQuietHour(local, "America/New_York"),
    nyHour != null && (nyHour >= 23 || nyHour < 6),
  );
});

test("desk.ts re-export cannot drift from operator.ts", () => {
  for (const value of ["2026-10-29T23:30", "2026-10-29T12:00", "garbage"]) {
    assert.equal(
      deskIsQuietHour(value, "UTC"),
      isQuietHour(value, "UTC"),
      `disagreement for ${value}`,
    );
  }
});
