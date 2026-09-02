import assert from "node:assert/strict";
import { test } from "node:test";
import {
  facebookPermalink,
  findCollisions,
  identityIssues,
  inspectLink,
  isRemixDraft,
  mixAdvice,
  remixCaption,
  withDefaultUtm,
} from "../src/lib/posterpal/briefing.ts";

test("facebook permalink is the official Page post URL", () => {
  assert.equal(facebookPermalink("123_456"), "https://www.facebook.com/123_456");
  assert.equal(facebookPermalink("practice_x"), null);
  assert.equal(facebookPermalink(null), null);
});

test("inspectLink flags shop hosts without UTM", () => {
  const merch = inspectLink("https://mystore.etsy.com/listing/1");
  assert.equal(merch?.looksMerch, true);
  assert.equal(merch?.hasUtm, false);
  assert.match(merch?.warning ?? "", /UTM/);
  const tagged = inspectLink("https://shop.example/p?utm_source=facebook");
  assert.equal(tagged?.hasUtm, true);
});

test("collisions fire across Pages, not within one Page", () => {
  const caption = "Saturday story hour is back at 10:30. Picture books on the river rug.";
  const hits = findCollisions([
    { pageId: "a", pageName: "A", message: caption },
    { pageId: "b", pageName: "B", message: caption },
    { pageId: "a", pageName: "A", message: caption },
  ]);
  assert.ok(hits.length >= 1);
  assert.equal(hits[0].pageA === hits[0].pageB, false);
});

test("mix advice is conservative when the fleet is empty", () => {
  assert.match(mixAdvice({ Text: 0, Photo: 0, Reel: 0 }), /Not enough/);
});

test("withDefaultUtm upgrades http and adds source", () => {
  const u = new URL(withDefaultUtm("http://shop.example/p"));
  assert.equal(u.protocol, "https:");
  assert.equal(u.searchParams.get("utm_source"), "facebook");
});

test("remixCaption prefixes once and stays Jaccard-visible", () => {
  const orig = "Saturday story hour is back at 10:30. Picture books on the river rug.";
  const once = remixCaption(orig);
  assert.equal(isRemixDraft(once), true);
  assert.equal(remixCaption(once), once);
  assert.match(once, /story hour/);
});

test("identityIssues flags missing voice and duplicate names", () => {
  const gaps = identityIssues(
    [
      { id: "a", name: "Twin", is_practice: false, brand_voice: null, category: "Shop" },
      { id: "b", name: "Twin", is_practice: false, brand_voice: "Warm.", category: "Shop" },
    ],
    {
      a: { uniqueness: 40, merchCount: 0, lastPublishedAt: null, nextScheduledAt: null },
      b: { uniqueness: 90, merchCount: 1, lastPublishedAt: new Date().toISOString(), nextScheduledAt: null },
    },
  );
  const a = gaps.find((g) => g.pageId === "a");
  assert.ok(a);
  assert.ok(a.issues.some((i) => /voice/i.test(i)));
  assert.ok(a.issues.some((i) => /Duplicate/i.test(i)));
  assert.ok(a.issues.some((i) => /overlap/i.test(i)));
});
