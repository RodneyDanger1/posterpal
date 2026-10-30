/**
 * Print-ready asset pipeline (server-only, sharp).
 *
 * The rules are not invented — they are Fourthwall's published requirements
 * (help.fourthwall.com → Design File Guidelines and Templates for Merchandise,
 * fetched 2026-10-29):
 *
 *   - Accepted upload formats: JPG and PNG only. PDF / SVG / AI / EPS / PSD /
 *     TIFF are REJECTED by the product designer. There is no vector upload path.
 *   - Colour: sRGB. Do not convert to CMYK yourself.
 *   - Resolution: at least 150 DPI at print size for apparel; 300 DPI for
 *     posters, stickers, mugs, phone cases and other hard goods.
 *   - pixels = print size in inches × DPI.
 *   - Embroidery: max 6 thread colours.
 *
 * So "vectorize the AI image" is the wrong goal for Fourthwall. The correct goal
 * is: exact pixel dimensions at the required DPI, sRGB, clean edges, no invented
 * detail, PNG with real alpha for garments. This module does that and refuses to
 * silently upscale garbage.
 */
import sharp from "sharp";
import { CommerceError } from "./types";
import { requiredPixels, specFor, type PrintMethod, type PrintReport, type PrintVerdict } from "./print-specs";

export { PRINT_METHODS, PRINT_SPECS, requiredPixels, specFor, maxPrintSize } from "./print-specs";
export type { PrintMethod, PrintSpec, PrintVerdict, PrintReport } from "./print-specs";

const MAX_INPUT_BYTES = 40 * 1024 * 1024;
const MAX_UPSCALE = 4;
const SOFT_UPSCALE = 2;


export type ImageInfo = {
  width: number;
  height: number;
  format: string | null;
  hasAlpha: boolean;
  channels: number | null;
  density: number | null;
};

export async function inspectImage(bytes: Buffer): Promise<ImageInfo> {
  if (!bytes || bytes.byteLength === 0) throw new CommerceError("fourthwall", "Image file is empty.");
  if (bytes.byteLength > MAX_INPUT_BYTES) {
    throw new CommerceError("fourthwall", "Image is larger than the 40MB safety cap.");
  }
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(bytes, { failOn: "error" }).metadata();
  } catch (e) {
    throw new CommerceError(
      "fourthwall",
      `Could not read the image: ${e instanceof Error ? e.message : "unknown format"}`,
    );
  }
  if (!meta.width || !meta.height) throw new CommerceError("fourthwall", "Image has no readable pixel dimensions.");
  const hasAlpha = Boolean(meta.hasAlpha);
  return {
    width: meta.width,
    height: meta.height,
    format: meta.format ?? null,
    hasAlpha,
    channels: typeof meta.channels === "number" ? meta.channels : null,
    density: typeof meta.density === "number" ? meta.density : null,
  };
}

/**
 * Palette reduction that actually honours an exact colour budget.
 *
 * libvips/sharp quantisation floors a palette at 16 entries (bitsPerSample 4),
 * which is too many for embroidery's 6-thread limit. This maps every pixel to one
 * of k centroids (deterministic k-means, seeded from the image) and pushes fully
 * transparent pixels onto centroid 0, so the encoded PNG cannot exceed k colours.
 */
export function quantizeToPalette(data: Buffer, channels: number, k: number): Buffer {
  if (channels < 3 || k < 1) return Buffer.from(data);
  const out = Buffer.from(data);
  const pixels = Math.floor(data.length / channels);
  const step = Math.max(1, Math.floor(pixels / 50_000));

  const sample: number[] = [];
  for (let n = 0; n < pixels; n += step) {
    const p = n * channels;
    const alpha = channels >= 4 ? data[p + 3]! : 255;
    if (alpha > 128) sample.push(p);
  }
  if (sample.length === 0) return out;

  const centroids: Array<[number, number, number]> = [];
  const first = sample[0]!;
  centroids.push([data[first]!, data[first + 1]!, data[first + 2]!]);
  while (centroids.length < k) {
    let bestPixel = -1;
    let bestScore = -1;
    for (const p of sample) {
      const r = data[p]!;
      const g = data[p + 1]!;
      const b = data[p + 2]!;
      let nearest = Infinity;
      for (const c of centroids) {
        const d = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2;
        if (d < nearest) nearest = d;
      }
      if (nearest > bestScore) {
        bestScore = nearest;
        bestPixel = p;
      }
    }
    if (bestPixel < 0) break;
    centroids.push([data[bestPixel]!, data[bestPixel + 1]!, data[bestPixel + 2]!]);
  }
  if (centroids.length === 0) return out;

  for (let iter = 0; iter < 10; iter += 1) {
    const sums = centroids.map(() => [0, 0, 0, 0]);
    for (const p of sample) {
      const r = data[p]!;
      const g = data[p + 1]!;
      const b = data[p + 2]!;
      let best = 0;
      let nearest = Infinity;
      for (let c = 0; c < centroids.length; c += 1) {
        const cc = centroids[c]!;
        const d = (r - cc[0]) ** 2 + (g - cc[1]) ** 2 + (b - cc[2]) ** 2;
        if (d < nearest) {
          nearest = d;
          best = c;
        }
      }
      const acc = sums[best]!;
      acc[0] += r;
      acc[1] += g;
      acc[2] += b;
      acc[3] += 1;
    }
    for (let c = 0; c < centroids.length; c += 1) {
      const acc = sums[c]!;
      const count = acc[3]!;
      if (count > 0) centroids[c] = [Math.round(acc[0]! / count), Math.round(acc[1]! / count), Math.round(acc[2]! / count)];
    }
  }

  const fallback = centroids[0]!;
  for (let n = 0; n < pixels; n += 1) {
    const p = n * channels;
    const alpha = channels >= 4 ? data[p + 3]! : 255;
    if (alpha <= 128) {
      out[p] = fallback[0];
      out[p + 1] = fallback[1];
      out[p + 2] = fallback[2];
      if (channels >= 4) out[p + 3] = 0;
      continue;
    }
    const r = data[p]!;
    const g = data[p + 1]!;
    const b = data[p + 2]!;
    let best = 0;
    let nearest = Infinity;
    for (let c = 0; c < centroids.length; c += 1) {
      const cc = centroids[c]!;
      const d = (r - cc[0]) ** 2 + (g - cc[1]) ** 2 + (b - cc[2]) ** 2;
      if (d < nearest) {
        nearest = d;
        best = c;
      }
    }
    const cc = centroids[best]!;
    out[p] = cc[0];
    out[p + 1] = cc[1];
    out[p + 2] = cc[2];
  }
  return out;
}

/**
 * Produce a print-ready file for a Fourthwall product.
 *
 * - Meets the pixel target → resized down to exact target (no fake detail).
 * - Below target by ≤2× → Lanczos3 upscale + light sharpen, verdict "upscaled".
 * - Below target by 2–4× → same, with a loud warning.
 * - Below target by >4× → verdict "rejected", no bytes returned. Sending a blurry
 *   file to print is worse than refusing it.
 */
export async function prepareForPrint(input: {
  bytes: Buffer;
  method: PrintMethod;
  printWidthIn: number;
  printHeightIn: number;
  format?: "png" | "jpg";
  /** Defaults to spec.wantsAlpha ? "png" : "jpg". */
}): Promise<{ report: PrintReport; bytes: Buffer | null; mime: string | null }> {
  const spec = specFor(input.method);
  const target = requiredPixels(input.printWidthIn, input.printHeightIn, spec.dpi);
  const info = await inspectImage(input.bytes);
  const warnings: string[] = [];

  const srcAspect = info.width / info.height;
  const targetAspect = target.width / target.height;
  const aspectDrift = Math.abs(srcAspect - targetAspect) / targetAspect;
  if (aspectDrift > 0.02) {
    warnings.push(
      `Source aspect ${srcAspect.toFixed(3)} does not match the requested print area ${targetAspect.toFixed(3)}. ` +
        "The image is fitted (not cropped), so the shorter axis will print below the requested size.",
    );
  }

  const scale = Math.max(target.width / info.width, target.height / info.height);
  const baseReport: PrintReport = {
    method: input.method,
    printWidthIn: input.printWidthIn,
    printHeightIn: input.printHeightIn,
    dpi: spec.dpi,
    targetWidth: target.width,
    targetHeight: target.height,
    sourceWidth: info.width,
    sourceHeight: info.height,
    sourceFormat: info.format,
    sourceHasAlpha: info.hasAlpha,
    outputWidth: null,
    outputHeight: null,
    scale: Math.round(scale * 1000) / 1000,
    verdict: "pass",
    warnings,
    meetsResolution: scale <= 1.0001,
  };

  if (spec.maxColors !== null && warnings.length === 0) {
    warnings.push(`This method allows only ${spec.maxColors} colours — the export is palette-limited.`);
  }
  if (!spec.wantsAlpha && info.hasAlpha) {
    warnings.push("Source has transparency; it will be flattened onto white for this print method.");
  }

  if (scale > MAX_UPSCALE) {
    return {
      report: {
        ...baseReport,
        verdict: "rejected",
        warnings: [
          ...warnings,
          `Source is ${info.width}×${info.height}px. At ${spec.dpi} DPI this print size needs ` +
            `${target.width}×${target.height}px, a ${scale.toFixed(1)}× upscale. That cannot add real detail — ` +
            "regenerate the artwork at a larger size instead of upscaling this file.",
        ],
      },
      bytes: null,
      mime: null,
    };
  }

  if (scale > SOFT_UPSCALE) {
    warnings.push(
      `Upscaling ${scale.toFixed(1)}× with Lanczos3 + light sharpen. Expect soft edges — regenerate at a larger ` +
        "resolution for hero products.",
    );
  }

  const outFormat = input.format ?? (spec.wantsAlpha ? "png" : "jpg");
  let pipeline = sharp(input.bytes, { failOn: "error" }).resize({
    width: target.width,
    height: target.height,
    fit: "inside",
    kernel: "lanczos3",
    withoutEnlargement: false,
  });
  if (scale > 1.0001) {
    pipeline = pipeline.sharpen({ sigma: 0.7, m1: 0.4, m2: 1.6 });
  }
  pipeline = pipeline.toColourspace("srgb");
  if (spec.maxColors !== null) {
    // Exact colour budget (embroidery): quantise before encoding so the palette
    // cannot exceed the thread count.
    const raw = await pipeline.raw().toBuffer({ resolveWithObject: true });
    const quantized = quantizeToPalette(raw.data, raw.info.channels, spec.maxColors);
    pipeline = sharp(quantized, {
      raw: { width: raw.info.width, height: raw.info.height, channels: raw.info.channels },
    });
  }
  if (outFormat === "jpg") {
    pipeline = pipeline.flatten({ background: "#ffffff" }).jpeg({
      quality: 92,
      chromaSubsampling: "4:4:4",
      mozjpeg: true,
    });
  } else {
    pipeline = pipeline.png({
      compressionLevel: 9,
      palette: spec.maxColors !== null,
      ...(spec.maxColors !== null ? { colours: spec.maxColors } : {}),
    });
  }
  pipeline = pipeline.withMetadata({ density: spec.dpi });

  let outWidth: number;
  let outHeight: number;
  let bytes: Buffer;
  try {
    const result = await pipeline.toBuffer({ resolveWithObject: true });
    bytes = result.data;
    outWidth = result.info.width;
    outHeight = result.info.height;
  } catch (e) {
    throw new CommerceError(
      "fourthwall",
      `Image processing failed: ${e instanceof Error ? e.message : "unknown error"}`,
    );
  }

  const ratio = outWidth / outHeight;
  if (Math.abs(ratio - targetAspect) / targetAspect > 0.02) {
    warnings.push(
      `Exported ${outWidth}×${outHeight}px (fitted to the print area). One axis is below ` +
        `${spec.dpi} DPI for the requested size because of the aspect mismatch.`,
    );
  }

  const meetsResolution = outWidth >= target.width * 0.98 || outHeight >= target.height * 0.98;
  const verdict: PrintVerdict = scale <= 1.0001 ? "pass" : "upscaled";

  return {
    report: {
      ...baseReport,
      outputWidth: outWidth,
      outputHeight: outHeight,
      verdict,
      warnings,
      meetsResolution: meetsResolution && scale <= 1.0001,
    },
    bytes,
    mime: outFormat === "jpg" ? "image/jpeg" : "image/png",
  };
}
