/**
 * Image sanitisation for publishing (server-only).
 *
 * WHAT THIS DOES: decodes and re-encodes uploaded/generated images through sharp,
 * which drops EXIF, GPS, XMP, ICC profiles and container metadata, applies EXIF
 * orientation, converts to sRGB and recompresses cleanly. That protects the
 * operator (no GPS coordinates / camera serial in a public post) and avoids
 * malformed uploads — it does not degrade quality (auto-orient + sRGB + 4:4:4).
 *
 * WHAT THIS DELIBERATELY DOES NOT DO: remove visible watermarks or SynthID.
 *   - SynthID is embedded in the pixels themselves; it cannot be "stripped" without
 *     destroying the image, and Google's terms prohibit attempting to remove it.
 *   - Visible watermarks are a licence condition of many generators; removing them
 *     to hide AI origin violates those terms.
 *   - Meta's manipulated-media policy expects disclosure of photorealistic AI
 *     content. Hiding provenance to evade it risks the Page/account.
 * The desk instead flags AI media (`createdWithAi`) and keeps a human in the loop.
 */
import sharp from "sharp";

export const SANITIZE_MAX_BYTES = 25 * 1024 * 1024;

const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);

export type SanitizeResult =
  | {
      ok: true;
      bytes: Buffer;
      mime: string;
      width: number;
      height: number;
      /** True when metadata was present or the bytes were re-encoded. */
      stripped: boolean;
      byteSize: number;
    }
  | { ok: false; reason: string };

export function isSanitizableImage(mime: string | null | undefined): boolean {
  return IMAGE_MIMES.has((mime ?? "").toLowerCase());
}

/**
 * Re-encode an image without metadata. PNG keeps alpha; JPEG/WebP become PNG only
 * when alpha is present, otherwise keep a high-quality JPEG.
 */
export async function sanitizeImage(bytes: Buffer, mime: string): Promise<SanitizeResult> {
  const m = mime.toLowerCase();
  if (!IMAGE_MIMES.has(m)) return { ok: false, reason: `Not a sanitizable image type: ${mime}` };
  if (bytes.byteLength === 0) return { ok: false, reason: "Empty image." };
  if (bytes.byteLength > SANITIZE_MAX_BYTES) return { ok: false, reason: "Image exceeds the 25 MB cap." };

  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(bytes, { failOn: "error" }).metadata();
  } catch (e) {
    return { ok: false, reason: `Could not decode image: ${e instanceof Error ? e.message : "unknown"}` };
  }
  if (!meta.width || !meta.height) return { ok: false, reason: "Image has no readable dimensions." };

  const hadMetadata = Boolean(
    (meta.exif && meta.exif.byteLength > 0) ||
      (meta.icc && meta.icc.byteLength > 0) ||
      meta.orientation !== undefined ||
      meta.xmp !== undefined,
  );
  const wantAlpha = Boolean(meta.hasAlpha);
  const outMime = wantAlpha ? "image/png" : "image/jpeg";

  let pipeline = sharp(bytes, { failOn: "error" }).rotate(); // apply EXIF orientation, then drop it
  pipeline = pipeline.toColourspace("srgb");
  // Deliberately no .withMetadata(): sharp drops EXIF/XMP/ICC by default.
  pipeline = wantAlpha
    ? pipeline.png({ compressionLevel: 9, palette: false })
    : pipeline.jpeg({ quality: 92, chromaSubsampling: "4:4:4", mozjpeg: true });

  try {
    const out = await pipeline.toBuffer({ resolveWithObject: true });
    return {
      ok: true,
      bytes: out.data,
      mime: outMime,
      width: out.info.width,
      height: out.info.height,
      stripped: hadMetadata || outMime !== m,
      byteSize: out.data.byteLength,
    };
  } catch (e) {
    return { ok: false, reason: `Re-encode failed: ${e instanceof Error ? e.message : "unknown"}` };
  }
}

/** Parse a data URL image, scrub metadata, and rebuild a data URL (or original on failure). */
export async function sanitizeDataUrl(dataUrl: string, mime: string): Promise<string> {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m) return dataUrl;
  const realMime = (m[1] ?? mime).toLowerCase();
  if (!IMAGE_MIMES.has(realMime)) return dataUrl;
  const isB64 = Boolean(m[2]);
  const raw = isB64 ? Buffer.from(m[3] ?? "", "base64") : Buffer.from(decodeURIComponent(m[3] ?? ""), "utf8");
  const clean = await sanitizeImage(raw, realMime);
  if (!clean.ok) return dataUrl; // never block a publish because the scrub failed
  return `data:${clean.mime};base64,${clean.bytes.toString("base64")}`;
}
