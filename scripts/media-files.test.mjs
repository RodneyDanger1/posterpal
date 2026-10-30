import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  MEDIA_MAX_BYTES,
  contentTypeFor,
  deleteMediaBytes,
  isSafeStorageKey,
  mediaDataUrl,
  mediaRootDir,
  mediaStorageAvailable,
  mediaUrlFor,
  readMediaBytes,
  saveMediaBytes,
  storeDataUrl,
} from "../src/lib/posterpal/media-files.ts";

const dir = mkdtempSync(join(tmpdir(), "posterpal-media-"));
process.env.POSTERPAL_MEDIA_DIR = dir;

test.after(() => {
  rmSync(dir, { recursive: true, force: true });
});

const PNG_BYTES = Buffer.from("89504e470d0a1a0a", "hex");

test("saveMediaBytes writes a content-addressed file and reads it back", async () => {
  const res = await saveMediaBytes({
    userId: "dev-user",
    fileName: "still.png",
    mimeType: "image/png",
    bytes: PNG_BYTES,
  });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.match(res.media.storageKey, /^dev-user\/[0-9a-f]{2}\/[0-9a-f]{64}\.png$/);
  assert.equal(res.media.byteSize, PNG_BYTES.byteLength);
  assert.equal(res.media.mime, "image/png");
  assert.ok(existsSync(join(dir, res.media.storageKey)));
  const read = await readMediaBytes(res.media.storageKey);
  assert.ok(read);
  assert.deepEqual(read, PNG_BYTES);
});

test("identical bytes are stored once (content-addressed dedupe)", async () => {
  const a = await saveMediaBytes({ userId: "dev-user", fileName: "a.png", mimeType: "image/png", bytes: PNG_BYTES });
  const b = await saveMediaBytes({ userId: "dev-user", fileName: "b.png", mimeType: "image/png", bytes: PNG_BYTES });
  assert.ok(a.ok && b.ok);
  if (!a.ok || !b.ok) return;
  assert.equal(a.media.storageKey, b.media.storageKey);
});

test("empty, oversized, and invalid-user writes are refused with a reason", async () => {
  const empty = await saveMediaBytes({ userId: "dev-user", fileName: "x.png", bytes: Buffer.alloc(0) });
  assert.equal(empty.ok, false);
  const oversized = await saveMediaBytes({
    userId: "dev-user",
    fileName: "big.mp4",
    mimeType: "video/mp4",
    bytes: Buffer.alloc(MEDIA_MAX_BYTES + 1),
  });
  assert.equal(oversized.ok, false);
  if (!oversized.ok) assert.match(oversized.reason, /caps stored media/);
  const badUser = await saveMediaBytes({ userId: "../etc", fileName: "x.png", bytes: PNG_BYTES });
  assert.equal(badUser.ok, false);
});

test("readMediaBytes refuses path traversal and missing keys without throwing", async () => {
  assert.equal(await readMediaBytes("../../etc/passwd"), null);
  assert.equal(await readMediaBytes("dev-user/zz/not-there.png"), null);
  assert.equal(await readMediaBytes(null), null);
  assert.equal(await readMediaBytes(""), null);
});

test("isSafeStorageKey accepts stored keys and rejects escapes", async () => {
  const res = await saveMediaBytes({ userId: "dev-user", fileName: "ok.png", mimeType: "image/png", bytes: PNG_BYTES });
  assert.ok(res.ok);
  if (!res.ok) return;
  assert.equal(isSafeStorageKey(res.media.storageKey), true);
  assert.equal(isSafeStorageKey("../escape.png"), false);
  assert.equal(isSafeStorageKey("/etc/passwd"), false);
});

test("storeDataUrl persists inline bytes and mediaDataUrl round-trips them", async () => {
  const dataUrl = `data:image/png;base64,${PNG_BYTES.toString("base64")}`;
  const res = await storeDataUrl({ userId: "dev-user", fileName: "inline.png", dataUrl });
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.media.mime, "image/png");
  const back = await mediaDataUrl(res.media.storageKey, res.media.mime);
  assert.equal(back, dataUrl);
  // Non-data URLs are not stored.
  const remote = await storeDataUrl({ userId: "dev-user", fileName: "x.png", dataUrl: "https://example.com/x.png" });
  assert.equal(remote.ok, false);
});

test("deleteMediaBytes is idempotent and removes the file", async () => {
  const res = await saveMediaBytes({
    userId: "dev-user",
    fileName: "gone.png",
    mimeType: "image/png",
    bytes: Buffer.from("unique-content-for-delete"),
  });
  assert.ok(res.ok);
  if (!res.ok) return;
  await deleteMediaBytes(res.media.storageKey);
  assert.equal(await readMediaBytes(res.media.storageKey), null);
  await deleteMediaBytes(res.media.storageKey); // second time must not throw
});

test("contentTypeFor normalises mime by header or extension", () => {
  assert.equal(contentTypeFor("a.png"), "image/png");
  assert.equal(contentTypeFor("a.JPG"), "image/jpeg");
  assert.equal(contentTypeFor("a.mp4"), "video/mp4");
  assert.equal(contentTypeFor("a.bin", "image/webp"), "image/webp");
  assert.equal(contentTypeFor("a.bin"), "application/octet-stream");
});

test("media storage availability probe and url helper", async () => {
  assert.equal(await mediaStorageAvailable(), true);
  assert.equal(mediaUrlFor("abc/def"), "/api/media/abc%2Fdef");
  assert.equal(mediaRootDir(), dir);
});

test("without POSTERPAL_MEDIA_DIR the desktop data dir wins over cwd", () => {
  const saved = process.env.POSTERPAL_MEDIA_DIR;
  const savedAppData = process.env.APPDATA;
  const fakeAppData = mkdtempSync(join(tmpdir(), "posterpal-appdata-"));
  try {
    delete process.env.POSTERPAL_MEDIA_DIR;
    process.env.APPDATA = fakeAppData;
    assert.equal(mediaRootDir(), join(fakeAppData, "PosterPal", "media"));
    delete process.env.APPDATA;
    assert.equal(mediaRootDir(), join(process.cwd(), ".posterpal-media"));
  } finally {
    rmSync(fakeAppData, { recursive: true, force: true });
    if (saved === undefined) delete process.env.POSTERPAL_MEDIA_DIR;
    else process.env.POSTERPAL_MEDIA_DIR = saved;
    if (savedAppData === undefined) delete process.env.APPDATA;
    else process.env.APPDATA = savedAppData;
  }
});
