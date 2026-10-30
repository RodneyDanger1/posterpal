import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";

import { sanitizeDataUrl, sanitizeImage } from "../src/lib/posterpal/image-sanitize.ts";
import { assertMimeMatchesBytes, sniffMime } from "../src/lib/posterpal/mime-sniff.ts";
import { fuzzyFilter, fuzzyScore } from "../src/lib/posterpal/fuzzy.ts";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

test("metadata scrub removes EXIF/GPS and keeps dimensions", async () => {
  const jpeg = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#336699" } })
    .jpeg()
    .withMetadata({ exif: { IFD0: { Make: "TestCam", Model: "X100" } } })
    .toBuffer();
  const dirty = await sharp(jpeg).metadata();
  assert.ok(dirty.exif && dirty.exif.byteLength > 0, "fixture must carry EXIF");

  const clean = await sanitizeImage(jpeg, "image/jpeg");
  assert.equal(clean.ok, true);
  if (!clean.ok) return;
  assert.equal(clean.width, 40);
  assert.equal(clean.height, 30);
  assert.equal(clean.stripped, true);
  const meta = await sharp(clean.bytes).metadata();
  assert.equal(meta.exif, undefined, "EXIF must be gone");
  assert.equal(meta.orientation, undefined, "orientation must be baked in, not stored");
  assert.equal(clean.mime, "image/jpeg");
});

test("alpha images stay PNG and keep transparency", async () => {
  const png = await sharp({
    create: { width: 20, height: 20, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.4 } },
  })
    .png()
    .toBuffer();
  const clean = await sanitizeImage(png, "image/png");
  assert.equal(clean.ok, true);
  if (!clean.ok) return;
  assert.equal(clean.mime, "image/png");
  const meta = await sharp(clean.bytes).metadata();
  assert.equal(meta.hasAlpha, true);
});

test("sanitizer refuses non-images, empty and broken bytes", async () => {
  assert.equal((await sanitizeImage(Buffer.from("hello"), "text/plain")).ok, false);
  assert.equal((await sanitizeImage(Buffer.alloc(0), "image/png")).ok, false);
  assert.equal((await sanitizeImage(Buffer.from("not an image"), "image/png")).ok, false);
});

test("sanitizeDataUrl round-trips a data URL without EXIF", async () => {
  const jpeg = await sharp({ create: { width: 16, height: 16, channels: 3, background: "#abcdef" } })
    .jpeg()
    .withMetadata({ exif: { IFD0: { Make: "TestCam" } } })
    .toBuffer();
  const dataUrl = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  const cleaned = await sanitizeDataUrl(dataUrl, "image/jpeg");
  assert.match(cleaned, /^data:image\/jpeg;base64,/);
  const bytes = Buffer.from(cleaned.split(",")[1], "base64");
  const meta = await sharp(bytes).metadata();
  assert.equal(meta.exif, undefined);
});

test("magic-byte sniffing detects real containers", () => {
  assert.equal(sniffMime(PNG_MAGIC), "image/png");
  assert.equal(sniffMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(sniffMime(Buffer.from("RIFFxxxxWEBPVP8 ", "binary")), "image/webp");
  assert.equal(sniffMime(Buffer.from("....ftypqt  ", "binary")), "video/quicktime");
  assert.equal(sniffMime(Buffer.from("not a media file")), null);
});

test("claimed MIME must match the actual bytes", () => {
  assert.equal(assertMimeMatchesBytes(PNG_MAGIC, "image/png").ok, true);
  assert.equal(assertMimeMatchesBytes(PNG_MAGIC, "image/jpeg").ok, true, "image family is accepted");
  assert.equal(assertMimeMatchesBytes(PNG_MAGIC, "video/mp4").ok, false, "image bytes cannot be a video");
  assert.equal(assertMimeMatchesBytes(Buffer.from("junk"), "image/png").ok, false, "unknown bytes cannot be an image");
  assert.equal(assertMimeMatchesBytes(Buffer.from("junk"), "video/mp4").ok, true, "exotic video containers allowed");
  assert.equal(assertMimeMatchesBytes(PNG_MAGIC, "").ok, false);
});

test("fuzzy search ranks prefix and word-start matches first", () => {
  const scorePrefix = fuzzyScore("north", "North Shore Books");
  const scoreMid = fuzzyScore("shore", "North Shore Books");
  const scoreNone = fuzzyScore("zzz", "North Shore Books");
  assert.ok(scorePrefix > scoreMid);
  assert.equal(scoreNone, 0);
  assert.equal(fuzzyScore("", "anything"), 1);
});

test("fuzzyFilter keeps order of ties and filters non-matches", () => {
  const rows = [
    { name: "North Shore Books", category: "Bookstore" },
    { name: "Prairie Ticket Desk", category: "Events" },
    { name: "Levee Dog Walks", category: "Pets" },
  ];
  const books = fuzzyFilter(rows, "book", (r) => [r.name, r.category]);
  assert.equal(books.length, 1);
  assert.equal(books[0].name, "North Shore Books");
  assert.deepEqual(fuzzyFilter(rows, "", (r) => [r.name]), rows);
  assert.deepEqual(fuzzyFilter(rows, "zzz", (r) => [r.name]), []);
});
