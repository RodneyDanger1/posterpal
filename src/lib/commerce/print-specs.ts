/**
 * Print specifications — CLIENT-SAFE (no sharp, no node built-ins).
 *
 * The rules are Fourthwall's published requirements (help.fourthwall.com → Design
 * File Guidelines and Templates for Merchandise, retrieved 2026-10-29):
 *   - Accepted upload formats: JPG and PNG only. PDF / SVG / AI / EPS / PSD / TIFF
 *     are REJECTED by the product designer. There is no vector upload path.
 *   - Colour: sRGB. Never convert to CMYK yourself.
 *   - Resolution: ≥150 DPI at print size for apparel; 300 DPI for posters,
 *     stickers, mugs, phone cases and other hard goods.
 *   - pixels = print size in inches × DPI.
 *   - Embroidery: maximum 6 thread colours.
 *
 * This module is imported by the /commerce UI and by the server-side pipeline, so
 * it must stay free of runtime dependencies that cannot ship to the browser.
 */
import { CommerceError } from "./types";

export const PRINT_METHODS = [
  "DTG",
  "DTFX",
  "SUBLIMATION",
  "STICKERS",
  "EMBROIDERY",
  "SCREEN_PRINT",
] as const;
export type PrintMethod = (typeof PRINT_METHODS)[number];

export type PrintSpec = {
  method: PrintMethod;
  label: string;
  /** DPI Fourthwall requires at print size. */
  dpi: number;
  /** True when the design normally needs a transparent background. */
  wantsAlpha: boolean;
  /** Palette limit, if the print method has one (embroidery thread colours). */
  maxColors: number | null;
  note: string;
};

export const PRINT_SPECS: Record<PrintMethod, PrintSpec> = {
  DTG: {
    method: "DTG",
    label: "DTG (direct-to-garment)",
    dpi: 150,
    wantsAlpha: true,
    maxColors: null,
    note: "PNG with transparency so the garment colour shows through. Avoid soft gradients and glow effects.",
  },
  DTFX: {
    method: "DTFX",
    label: "DTFx (direct-to-film)",
    dpi: 150,
    wantsAlpha: true,
    maxColors: null,
    note: "Solid colours and clean edges. No text under 1 mm / 4 pt. No small knockouts.",
  },
  SUBLIMATION: {
    method: "SUBLIMATION",
    label: "Sublimation (mugs, phone cases, all-over)",
    dpi: 300,
    wantsAlpha: false,
    maxColors: null,
    note: "Hard goods need 300 DPI at print size; all-over apparel can use 150. Colours print darker — design slightly brighter.",
  },
  STICKERS: {
    method: "STICKERS",
    label: "Stickers (kiss-cut / sheets)",
    dpi: 300,
    wantsAlpha: true,
    maxColors: null,
    note: "Seen up close — 300 DPI. Leave ≥ 0.25 in between separate elements for kiss-cut.",
  },
  EMBROIDERY: {
    method: "EMBROIDERY",
    label: "Embroidery",
    dpi: 150,
    wantsAlpha: true,
    maxColors: 6,
    note: "Maximum 6 thread colours. Simple shapes and thick strokes survive stitching.",
  },
  SCREEN_PRINT: {
    method: "SCREEN_PRINT",
    label: "Screen print (MOQ)",
    dpi: 150,
    wantsAlpha: false,
    maxColors: null,
    note: "No gradients. Flat, solid colours only.",
  },
};

export type PrintVerdict = "pass" | "upscaled" | "rejected";

export type PrintReport = {
  method: PrintMethod;
  printWidthIn: number;
  printHeightIn: number;
  dpi: number;
  targetWidth: number;
  targetHeight: number;
  sourceWidth: number | null;
  sourceHeight: number | null;
  sourceFormat: string | null;
  sourceHasAlpha: boolean;
  outputWidth: number | null;
  outputHeight: number | null;
  scale: number | null;
  verdict: PrintVerdict;
  warnings: string[];
  /** True when the pixel budget is met without upscaling. */
  meetsResolution: boolean;
};

export function requiredPixels(widthIn: number, heightIn: number, dpi: number): { width: number; height: number } {
  if (!Number.isFinite(widthIn) || widthIn <= 0 || !Number.isFinite(heightIn) || heightIn <= 0) {
    throw new CommerceError("fourthwall", "Print size must be two positive inch values.");
  }
  if (!Number.isFinite(dpi) || dpi < 72 || dpi > 1200) {
    throw new CommerceError("fourthwall", "DPI must be between 72 and 1200.");
  }
  return { width: Math.ceil(widthIn * dpi), height: Math.ceil(heightIn * dpi) };
}

export function specFor(method: string): PrintSpec {
  const spec = PRINT_SPECS[method as PrintMethod];
  if (!spec) throw new CommerceError("fourthwall", `Unknown print method "${method}".`);
  return spec;
}

/** Max printable size at a DPI for the source pixels — the honest answer to "how big can this print?" */
export function maxPrintSize(
  sourceWidth: number,
  sourceHeight: number,
  dpi: number,
): { widthIn: number; heightIn: number } {
  return {
    widthIn: Math.floor((sourceWidth / dpi) * 100) / 100,
    heightIn: Math.floor((sourceHeight / dpi) * 100) / 100,
  };
}
