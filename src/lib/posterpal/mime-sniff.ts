/**
 * Magic-byte media sniffing (no dependencies).
 *
 * Browsers and clients can claim any MIME type; the desk trusts `mimeType` today.
 * This verifies the bytes actually look like the claimed image/video before they
 * are stored or sent to Graph. Unknown containers (e.g. exotic video codecs) are
 * allowed through only for video where the extension is known — never for images.
 */

export type SniffResult = { ok: true; mime: string } | { ok: false; reason: string };

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];
const GIF = [0x47, 0x49, 0x46, 0x38];
const WEBP_RIFF = [0x52, 0x49, 0x46, 0x46];
const WEBP_TAG = [0x57, 0x45, 0x42, 0x50];

function starts(bytes: Uint8Array, sig: number[]): boolean {
  if (bytes.byteLength < sig.length) return false;
  return sig.every((b, i) => bytes[i] === b);
}

/** Detect the real container type from the first bytes. */
export function sniffMime(bytes: Uint8Array): string | null {
  if (starts(bytes, PNG)) return "image/png";
  if (starts(bytes, JPEG)) return "image/jpeg";
  if (starts(bytes, GIF)) return "image/gif";
  if (starts(bytes, WEBP_RIFF) && bytes.byteLength > 11 && starts(bytes.subarray(8), WEBP_TAG)) return "image/webp";
  // ISO BMFF (mp4/mov): ....ftyp<brand>
  if (bytes.byteLength >= 12) {
    const tag = String.fromCharCode(...Array.from(bytes.subarray(4, 8)));
    if (tag === "ftyp") {
      const brand = String.fromCharCode(...Array.from(bytes.subarray(8, 12)));
      if (brand.startsWith("qt")) return "video/quicktime";
      return "video/mp4";
    }
  }
  // Matroska/WebM
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "video/webm";
  return null;
}

const IMAGE_ALLOWED = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const VIDEO_ALLOWED = ["video/mp4", "video/quicktime", "video/webm"];

/** Assert the claimed MIME matches the actual bytes. */
export function assertMimeMatchesBytes(bytes: Uint8Array, claimed: string | null | undefined): SniffResult {
  const real = sniffMime(bytes);
  const claim = (claimed ?? "").toLowerCase().split(";")[0]!.trim();
  if (!claim) return { ok: false, reason: "Missing MIME type." };
  if (!real) {
    if (VIDEO_ALLOWED.includes(claim)) return { ok: true, mime: claim }; // exotic video containers are allowed
    return { ok: false, reason: `File does not look like ${claim} (unknown signature).` };
  }
  const sameFamily =
    (IMAGE_ALLOWED.includes(claim) && real.startsWith("image/")) ||
    (VIDEO_ALLOWED.includes(claim) && real.startsWith("video/"));
  if (!sameFamily) return { ok: false, reason: `File signature is ${real}, not ${claim}.` };
  return { ok: true, mime: real };
}
