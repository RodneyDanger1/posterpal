import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";

import {
  inspectImage,
  maxPrintSize,
  prepareForPrint,
  requiredPixels,
  specFor,
} from "../src/lib/commerce/print-assets.ts";

async function png(width, height, opts = {}) {
  return sharp({
    create: { width, height, channels: opts.alpha ? 4 : 3, background: opts.background ?? "#3366cc" },
  })
    .png()
    .toBuffer();
}

test("requiredPixels is inches × DPI, rounded up", () => {
  assert.deepEqual(requiredPixels(10, 12, 150), { width: 1500, height: 1800 });
  assert.deepEqual(requiredPixels(3.5, 3.5, 300), { width: 1050, height: 1050 });
  assert.throws(() => requiredPixels(0, 12, 150), /positive inch/);
  assert.throws(() => requiredPixels(10, 12, 5000), /DPI/);
});

test("specFor uses Fourthwall's published DPI per method", () => {
  assert.equal(specFor("DTG").dpi, 150);
  assert.equal(specFor("DTFX").dpi, 150);
  assert.equal(specFor("EMBROIDERY").dpi, 150);
  assert.equal(specFor("EMBROIDERY").maxColors, 6);
  assert.equal(specFor("STICKERS").dpi, 300);
  assert.equal(specFor("SUBLIMATION").dpi, 300);
  assert.throws(() => specFor("KNITTING"), /Unknown print method/);
});

test("inspectImage reports real dimensions, format and alpha", async () => {
  const info = await inspectImage(await png(600, 800, { alpha: true }));
  assert.equal(info.width, 600);
  assert.equal(info.height, 800);
  assert.equal(info.format, "png");
  assert.equal(info.hasAlpha, true);
  await assert.rejects(() => inspectImage(Buffer.alloc(0)), /empty/);
  await assert.rejects(() => inspectImage(Buffer.from("not an image")), /Could not read/);
});

test("maxPrintSize answers 'how big can this print' honestly", () => {
  assert.deepEqual(maxPrintSize(3000, 3600, 300), { widthIn: 10, heightIn: 12 });
  assert.deepEqual(maxPrintSize(1500, 1800, 150), { widthIn: 10, heightIn: 12 });
});

test("prepareForPrint: a large source passes and is resized DOWN to the exact target", async () => {
  const src = await png(3000, 3600);
  const { report, bytes } = await prepareForPrint({ bytes: src, method: "DTG", printWidthIn: 10, printHeightIn: 12 });
  assert.equal(report.verdict, "pass");
  assert.equal(report.meetsResolution, true);
  assert.equal(report.targetWidth, 1500);
  assert.equal(report.targetHeight, 1800);
  assert.equal(report.outputWidth, 1500);
  assert.equal(report.outputHeight, 1800);
  assert.ok(bytes && bytes.byteLength > 0);
  const meta = await sharp(bytes).metadata();
  assert.equal(meta.format, "png");
  assert.equal(meta.width, 1500);
  assert.equal(meta.density, 150, "DPI metadata must be written for print");
});

test("prepareForPrint: a 3.75× shortfall is upscaled with a warning, never silently claimed as native", async () => {
  const src = await png(400, 500);
  const { report, bytes } = await prepareForPrint({ bytes: src, method: "DTG", printWidthIn: 10, printHeightIn: 12 });
  assert.equal(report.verdict, "upscaled");
  assert.equal(report.meetsResolution, false);
  assert.ok(report.scale >= 3.7 && report.scale <= 3.8);
  assert.ok(report.warnings.some((w) => /Upscaling/.test(w)));
  assert.ok(bytes && bytes.byteLength > 0);
});

test("prepareForPrint: below ~9× the source is REJECTED instead of printing mush", async () => {
  const src = await png(160, 180);
  const { report, bytes } = await prepareForPrint({ bytes: src, method: "DTG", printWidthIn: 10, printHeightIn: 12 });
  assert.equal(report.verdict, "rejected");
  assert.equal(bytes, null);
  assert.ok(report.warnings.some((w) => /cannot add real detail/.test(w)));
});

test("prepareForPrint: hard goods require 300 DPI (sticker at 3×3in needs 900×900)", async () => {
  const src = await png(1000, 1000);
  const { report } = await prepareForPrint({ bytes: src, method: "STICKERS", printWidthIn: 3, printHeightIn: 3 });
  assert.equal(report.dpi, 300);
  assert.equal(report.targetWidth, 900);
  assert.equal(report.targetHeight, 900);
  assert.equal(report.verdict, "pass");
});

test("prepareForPrint: JPG output flattens transparency and stays PNG when alpha is wanted", async () => {
  const src = await png(1200, 1200, { alpha: true });
  const jpg = await prepareForPrint({
    bytes: src,
    method: "SUBLIMATION",
    printWidthIn: 4,
    printHeightIn: 4,
    format: "jpg",
  });
  assert.ok(jpg.bytes);
  const jpgMeta = await sharp(jpg.bytes).metadata();
  assert.equal(jpgMeta.format, "jpeg");
  assert.ok(jpg.report.warnings.some((w) => /flattened onto white/.test(w)));

  const pngOut = await prepareForPrint({ bytes: src, method: "DTG", printWidthIn: 8, printHeightIn: 8 });
  assert.ok(pngOut.bytes);
  const pngMeta = await sharp(pngOut.bytes).metadata();
  assert.equal(pngMeta.format, "png");
  assert.equal(pngMeta.hasAlpha, true);
});

test("prepareForPrint: embroidery is palette-limited to 6 colours", async () => {
  // A smooth gradient has far more than 6 distinct colours before palette limiting.
  const width = 1200;
  const height = 900;
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 3;
      raw[i] = Math.floor((x / width) * 255);
      raw[i + 1] = Math.floor((y / height) * 255);
      raw[i + 2] = Math.floor(((x + y) / (width + height)) * 255);
    }
  }
  const src = await sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
  const { report, bytes } = await prepareForPrint({
    bytes: src,
    method: "EMBROIDERY",
    printWidthIn: 8,
    printHeightIn: 6,
  });
  assert.ok(bytes, "embroidery export must produce bytes at the right size");
  assert.equal(report.method, "EMBROIDERY");
  assert.equal(report.verdict, "pass");
  const decoded = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
  const colors = new Set();
  const stride = decoded.info.channels;
  for (let i = 0; i + 2 < decoded.data.length; i += stride) {
    colors.add(`${decoded.data[i]},${decoded.data[i + 1]},${decoded.data[i + 2]}`);
  }
  assert.ok(colors.size <= 6, `expected <= 6 thread colours, got ${colors.size}`);
  assert.ok(colors.size >= 2, "palette limiting must not collapse the artwork to one colour");
});

test("prepareForPrint: aspect mismatch is reported, not silently stretched", async () => {
  const src = await png(2000, 1000); // 2:1
  const { report } = await prepareForPrint({ bytes: src, method: "DTG", printWidthIn: 10, printHeightIn: 10 });
  assert.ok(report.warnings.some((w) => /aspect/i.test(w)));
  // fit: inside -> width reaches 1500, height stays proportional (750)
  assert.equal(report.outputWidth, 1500);
  assert.equal(report.outputHeight, 750);
  assert.equal(report.meetsResolution, false);
});
