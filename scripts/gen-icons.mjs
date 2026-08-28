/**
 * One-time PWA icon generation from public/favicon.svg. Re-run after changing
 * the brand mark: `node scripts/gen-icons.mjs`. Outputs the manifest icons.
 */
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const svg = readFileSync(join(process.cwd(), "public", "favicon.svg"));
const out = join(process.cwd(), "public");

for (const size of [192, 512]) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(join(out, `icon-${size}.png`));
}
// Apple touch icon (180, flattened — iOS ignores alpha)
await sharp(svg, { density: 384 })
  .resize(180, 180)
  .flatten({ background: "#1877F2" })
  .png()
  .toFile(join(out, "icon-180.png"));
// Maskable 512 — glyph padded into the ~80% safe zone on a solid bg
const inner = await sharp(svg, { density: 384 }).resize(410, 410).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#1877F2" } })
  .composite([{ input: inner, gravity: "center" }])
  .png()
  .toFile(join(out, "icon-maskable-512.png"));

console.log("icons generated");
