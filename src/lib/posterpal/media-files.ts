/**
 * Media file storage (server-only).
 *
 * Why this exists: the desk used to store every photo/video as a base64 `data:`
 * URL inside Postgres — ~1.33× the bytes, inside row bodies, re-sent in JSON on
 * every media-library render. A few Imagine stills and a video would bloat the
 * DB and slow the desk down.
 *
 * Now: bytes live on disk under `POSTERPAL_MEDIA_DIR` (default
 * `<cwd>/.posterpal-media`), content-addressed by SHA-256 so identical files are
 * stored once. The DB keeps a relative `file_path` and the metadata; the
 * `/api/media/{id}` route serves the bytes.
 *
 * Degradation is explicit: when the media directory is not writable (a read-only
 * serverless filesystem), callers fall back to the legacy inline data URL and log
 * it. Nothing silently claims a file exists when it does not.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { decodeDataUrl } from "./graph";

/** Hard cap per file. Graph itself refuses >6 MB for photos in most paths; this is
 *  the desk-side guard so a 200 MB "video" cannot fill the disk by accident. */
export const MEDIA_MAX_BYTES = 25 * 1024 * 1024;

const USER_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

export type SavedMedia = {
  storageKey: string;
  byteSize: number;
  sha256: string;
  mime: string;
};

export type SaveResult = { ok: true; media: SavedMedia } | { ok: false; reason: string };

/**
 * Root directory for media. Read per call so tests and Docker env changes apply.
 *
 * Priority:
 *   1. POSTERPAL_MEDIA_DIR (Docker sets /data/media, tests set a temp dir)
 *   2. %APPDATA%\PosterPal\media on Windows — the same place the EXE already keeps
 *      its PGLite DB and master key. `cwd` under Program Files is often read-only.
 *   3. <cwd>/.posterpal-media (dev on other platforms)
 */
export function mediaRootDir(): string {
  const configured = process.env.POSTERPAL_MEDIA_DIR?.trim();
  if (configured) return resolve(configured);
  const appData = process.env.APPDATA?.trim();
  if (appData) return resolve(appData, "PosterPal", "media");
  return resolve(process.cwd(), ".posterpal-media");
}

export function contentTypeFor(fileName: string, mimeType?: string | null): string {
  const mime = (mimeType ?? "").trim().toLowerCase();
  if (mime) return mime.startsWith("image/") || mime.startsWith("video/") ? mime : "application/octet-stream";
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "mp4") return "video/mp4";
  if (ext === "mov") return "video/quicktime";
  if (ext === "webm") return "video/webm";
  return "application/octet-stream";
}

function extFor(mime: string, fileName: string): string {
  const byMime = EXT_BY_MIME[mime];
  if (byMime) return byMime;
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : "bin";
}

/** True when the media dir can be created and written to. */
export async function mediaStorageAvailable(): Promise<boolean> {
  try {
    const root = mediaRootDir();
    await mkdir(root, { recursive: true });
    const probe = join(root, `.probe-${process.pid}-${Date.now()}`);
    await writeFile(probe, "ok");
    await unlink(probe);
    return true;
  } catch {
    return false;
  }
}

/** Content-addressed, per-user path: `<userId>/<sha[0..2]>/<sha>.<ext>`. */
export async function saveMediaBytes(input: {
  userId: string;
  fileName: string;
  mimeType?: string | null;
  bytes: Uint8Array | Buffer;
}): Promise<SaveResult> {
  const userId = input.userId.trim();
  if (!USER_ID_RE.test(userId)) return { ok: false, reason: "Invalid user id for media storage." };
  const bytes = Buffer.isBuffer(input.bytes) ? input.bytes : Buffer.from(input.bytes);
  if (bytes.byteLength === 0) return { ok: false, reason: "Refusing to store an empty file." };
  if (bytes.byteLength > MEDIA_MAX_BYTES) {
    return {
      ok: false,
      reason: `File is ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB — the desk caps stored media at ${
        MEDIA_MAX_BYTES / 1024 / 1024
      } MB.`,
    };
  }
  const mime = contentTypeFor(input.fileName, input.mimeType);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const ext = extFor(mime, input.fileName);
  const storageKey = `${userId}/${sha256.slice(0, 2)}/${sha256}.${ext}`;
  const absolute = resolve(mediaRootDir(), storageKey);
  try {
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, bytes, { flag: "wx" }).catch((e: NodeJS.ErrnoException) => {
      // Another write of the identical content already landed — that's success.
      if (e?.code !== "EEXIST") throw e;
    });
    return { ok: true, media: { storageKey, byteSize: bytes.byteLength, sha256, mime } };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Could not write the media file." };
  }
}

/** Read bytes for a stored key. Returns null for missing/invalid paths — never throws. */
export async function readMediaBytes(storageKey: string | null | undefined): Promise<Buffer | null> {
  const key = (storageKey ?? "").trim();
  if (!key || key.includes("\0")) return null;
  const root = mediaRootDir();
  const absolute = resolve(root, key);
  if (absolute !== root && !absolute.startsWith(root + sep)) return null; // path traversal
  try {
    return await readFile(absolute);
  } catch {
    return null;
  }
}

export async function deleteMediaBytes(storageKey: string | null | undefined): Promise<void> {
  const key = (storageKey ?? "").trim();
  if (!key) return;
  const root = mediaRootDir();
  const absolute = resolve(root, key);
  if (absolute !== root && !absolute.startsWith(root + sep)) return;
  try {
    await unlink(absolute);
  } catch {
    // already gone — deletion is idempotent
  }
}

/** True when this storage key looks like a path inside the media root (for UI/tests). */
export function isSafeStorageKey(storageKey: string): boolean {
  const key = storageKey.trim();
  if (!key || key.includes("\0") || key.startsWith("/") || key.startsWith("\\")) return false;
  const absolute = resolve(mediaRootDir(), key);
  const root = mediaRootDir();
  return absolute === root || absolute.startsWith(root + sep);
}

/**
 * Best-effort: turn a legacy data URL into stored bytes.
 * Returns null for http(s) URLs (those are fetched by the publish path) or junk.
 */
export async function storeDataUrl(input: {
  userId: string;
  fileName: string;
  mimeType?: string | null;
  dataUrl: string | null | undefined;
}): Promise<SaveResult> {
  const raw = input.dataUrl?.trim() ?? "";
  if (!raw.startsWith("data:")) return { ok: false, reason: "Not a data URL." };
  const decoded = decodeDataUrl(raw);
  if (!decoded) return { ok: false, reason: "Could not decode the data URL." };
  return saveMediaBytes({
    userId: input.userId,
    fileName: input.fileName,
    mimeType: input.mimeType || decoded.mime,
    bytes: decoded.bytes,
  });
}

/** Build a data URL from stored bytes — used where a client still needs inline content. */
export async function mediaDataUrl(storageKey: string | null | undefined, mime: string): Promise<string | null> {
  const bytes = await readMediaBytes(storageKey);
  if (!bytes) return null;
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

export function mediaUrlFor(id: string): string {
  return `/api/media/${encodeURIComponent(id)}`;
}
