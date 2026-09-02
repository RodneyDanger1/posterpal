import assert from "node:assert/strict";
import { test } from "node:test";
import { cadenceLevel, REMIX_MARK, reelCapLevel, runPolicyChecklist, validateReel } from "../src/lib/posterpal/policy.ts";
import { publishToast } from "../src/lib/posterpal/operator.ts";

test("cadenceLevel blocks at the cap, warns below it", () => {
  assert.equal(cadenceLevel(7, 8, 20), "ok");
  assert.equal(cadenceLevel(8, 8, 20), "warn");
  assert.equal(cadenceLevel(20, 8, 20), "block");
  assert.equal(cadenceLevel(0, 8, 20), "ok");
});

test("#ad and #sponsored count as branded-content disclosure", () => {
  const base = {
    link: "https://shop.example/tote",
    merchUrl: "https://shop.example/tote",
    hasImages: false,
    missingAlt: false,
    createdWithAi: false,
    recentMessages: [],
  };
  const missing = runPolicyChecklist({ ...base, message: "Grab the tote today." });
  assert.equal(
    missing.flags.some((f) => f.id === "branded-content"),
    true,
    "shop link without disclosure should warn",
  );
  const withHash = runPolicyChecklist({ ...base, message: "Grab the tote today. #ad" });
  assert.equal(
    withHash.flags.some((f) => f.id === "branded-content"),
    false,
    "#ad at the end must satisfy disclosure",
  );
  const leading = runPolicyChecklist({ ...base, message: "#sponsored restock is live." });
  assert.equal(
    leading.flags.some((f) => f.id === "branded-content"),
    false,
    "#sponsored at the start must satisfy disclosure",
  );
});

test("remix marker blocks publish until rewritten", () => {
  const r = runPolicyChecklist({
    message: `${REMIX_MARK}\n\nSaturday story hour is back at 10:30.`,
    hasImages: false,
    missingAlt: false,
    createdWithAi: false,
    recentMessages: [],
  });
  assert.equal(r.canPublish, false);
  assert.ok(r.flags.some((f) => f.id === "remix-required"));
});

test("duplicate captions block", () => {
  const recent = [{ id: "1", message: "Saturday story hour is back at 10:30. Picture books on the river rug." }];
  const dup = runPolicyChecklist({
    message: "Saturday story hour is back at 10:30. Picture books on the river rug.",
    hasImages: false,
    missingAlt: false,
    createdWithAi: false,
    recentMessages: recent,
  });
  assert.equal(dup.canPublish, false);
  assert.ok(dup.flags.some((f) => f.severity === "block"));
});

test("validateReel rejects landscape and out-of-range clips", () => {
  assert.match(validateReel({ width: 1920, height: 1080, durationMs: 8000 }) ?? "", /9:16/);
  assert.match(validateReel({ width: 1080, height: 1920, durationMs: 1500 }) ?? "", /3–90/);
  assert.equal(validateReel({ width: 1080, height: 1920, durationMs: 15000 }), null);
  assert.equal(validateReel({ width: 1080, height: 1920, durationMs: 90_000 }), null);
  assert.match(validateReel({ width: 1080, height: 1920, durationMs: 91_000 }) ?? "", /3–90/);
});

test("reelCapLevel blocks at Meta's 30/24h API window", () => {
  assert.equal(reelCapLevel(0), "ok");
  assert.equal(reelCapLevel(24), "ok");
  assert.equal(reelCapLevel(25), "warn");
  assert.equal(reelCapLevel(30), "block");
  const blocked = runPolicyChecklist({
    message: "River walk after rain.",
    hasImages: false,
    missingAlt: false,
    createdWithAi: false,
    recentMessages: [],
    reelLast24h: 30,
  });
  assert.equal(blocked.canPublish, false);
  assert.ok(blocked.flags.some((f) => f.id === "reel-cap" && f.severity === "block"));
});

test("Failed publishes are never reported as success toasts", () => {
  assert.equal(publishToast("Failed", "Graph 100").ok, false);
  assert.equal(publishToast("Published").ok, true);
  assert.equal(publishToast("LocalScheduled", "outside window").ok, true);
  assert.match(publishToast("Failed", "no token").text, /Failed/);
});
