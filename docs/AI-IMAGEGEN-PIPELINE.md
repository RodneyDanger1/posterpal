# AI images → print-ready merch (Fourthwall-first)

**Sources:** Fourthwall [design file guidelines](https://help.fourthwall.com/create-and-sell-products/best-practices/design-file-guidelines-and-templates-for-merchandise/) ·
[artwork best practices](https://help.fourthwall.com/create-and-sell-products/best-practices/artwork-best-practices) ·
Fourthwall design-product pipeline docs (see `COMMERCE-FOURTHWALL.md`).

---

## 1. The vector question — settle it now

You asked about getting AI rasters into vectors / what quality is needed. For Fourthwall:

> "Fourthwall accepts **raster image files only**. … Vector files and PDFs are not accepted, so you
> must convert any design in another format to PNG or JPG before uploading."

`SVG`, `AI`, `EPS`, `PDF`, `PSD`, `TIFF` are all **rejected** by the product designer.
So **vectorising is not a requirement for Fourthwall** — and for photographic/graphic AI art it can
make things *worse* (tracing artefacts, thousands of anchor points, colour banding).

**Where vectorisation still helps:** your own brand marks/logos/typography that you author once.
Author those in a vector tool, keep the master SVG, and export PNG at the right pixel size. Do not
run "Image Trace" on complex AI art and expect cleaner print output.

**What "clean enough to print" actually means:** correct pixel count at the print DPI, sRGB, genuine
transparency where the garment should show, and no upscaling beyond real detail. That's what the
built pipeline enforces.

## 2. The pipeline that now exists in PosterPal

`src/lib/commerce/print-specs.ts` (rules) + `src/lib/commerce/print-assets.ts` (sharp execution):

```
media asset (PNG/JPG bytes)
  → inspectImage()             real width/height/format/alpha
  → requiredPixels(in, dpi)    target = ceil(inches × DPI)
  → scale decision             ≤1× pass │ 1–2× upscale │ 2–4× upscale+warn │ >4× REJECT
  → sharp.resize(lanczos3)     fit:"inside" (never stretch)
  → sharpen(sigma .7)          only when upscaled
  → toColourspace("srgb")      never CMYK
  → quantizeToPalette(k)       embroidery only — true ≤6 colours (k-means, not libvips' 16 floor)
  → png (alpha) or jpeg 4:4:4  + withMetadata({density: dpi})
  → PrintReport {verdict, warnings, source/target/output px, scale}
```

Verified by tests (`scripts/print-assets.test.mjs`, 12 cases): large source → pass and downscale to
exact target; 3.75× shortfall → `upscaled` + warning; 9× → `rejected`, no bytes; sticker at 3×3 in
demands 900×900 @300 DPI; JPG flattens alpha, PNG keeps it; embroidery output **≤6 unique colours**
(measured); aspect mismatch is reported, never stretched; DPI metadata written (PNG `density: 150`).

## 3. DPI math per product class (memorise this)

`pixels = print size (inches) × DPI`

| Product / method | Required DPI | Example print area | Required pixels |
|---|---|---|---|
| DTG tee front | 150 | 10 × 12 in | 1500 × 1800 |
| DTFx hoodie front | 150 | 12 × 16 in | 1800 × 2400 |
| Mug / phone case (sublimation) | 300 | 4 × 4 in | 1200 × 1200 |
| All-over apparel | 150–300 | template-sized | use template overlay |
| Kiss-cut sticker | 300 | 3 × 3 in | 900 × 900 |
| Sticker sheet | 300 | 5.83 × 8.27 in | 1749 × 2481 |
| Embroidery | 150 | 4 × 4 in (or 10 × 6) | 600 × 600, ≤6 colours |
| Poster | 300 | 18 × 24 in | 5400 × 7200 |

Fourthwall product designer shows the exact print area per product/model — always check the overlay;
phone cases differ per model. Templates: overlay on canvas for most products; some downloadable
PSD/BMP (knitwear); enamel mug template only via support.

## 4. Generating images that survive print

**Prompt for print, not for feeds:**
- Flat/vector-look illustration, bold shapes, 3–6 colour palette, thick outlines, centred
  composition, generous margins (nothing within 5% of the edge), **no text** (type it in the
  designer where you can control it), transparent background if the garment colour should show.
- Avoid: soft bokeh, painterly detail at small scale, thin 1px lines, tiny text, gradients inside
  DTFx art, glow effects, photorealism on stickers.
- Size: generate the largest the model offers, then **downscale** to target. Downscaling is free
  quality; upscaling is not.

**AI tells that kill a print (QC checklist, human eyes required):**
- gibberish text/signage → crop it out or regenerate
- melted hands/faces/limbs → not acceptable on merch
- asymmetric eyes, extra fingers, malformed animals (common in nature/wildlife art)
- seam-unsafe elements for all-over prints
- stray edge pixels / ghosts when background was removed → use a real matte, check at 400% on a
  dark garment mockup
- colour banding in gradients (screen printing can't hold gradients anyway)

**Cleaning tools, cheapest → best:**
| Need | Tool | Note |
|---|---|---|
| Upscale 2–4× | PosterPal pipeline (sharp Lanczos3+sharpen) | built in, free, honest warnings |
| Upscale photographic detail | Real-ESRGAN / Upscayl (local, free), Topaz (paid) | better for photos, can hallucinate |
| Remove background | `rembg`/BiRefNet (local), ArtCraft suite, Photoshop | verify on dark mockups at 400% |
| Vectorise logos/flat marks | Illustrator Image Trace, Inkscape trace, `vectorizer.ai` (paid) | for your own marks only |
| Print file export | PosterPal pipeline | PNG/JPG at exact DPI, sRGB |
| Manual retouch | ArtCraft suite (downloaded) | see §6 |

## 5. ArtCraft suite — integration plan (not mounted in this session)

You have ArtCraft apps that can be MCP-driven. **In this session no ArtCraft MCP server was mounted**
(tool inventory shows only the Hostinger MCP), so I could not drive it and will not pretend to.
The integration contract to build next:

1. Expose each ArtCraft app as an MCP server (stdio or HTTP) with tools:
   `generate_image`, `edit_image`, `remove_background`, `upscale`, `vectorize`, `export_png`.
2. Register those MCP servers in this profile (`plugin_manager`/MCP bundle), then PosterPal can call
   them server-side the same way it calls `ai.ts` providers.
3. Replace the manual "generate still → download → upload to PosterPal" step with:
   `prompt → ArtCraft generate → BG remove → upscale → print-assets.prepareForPrint → Fourthwall`.
4. Keep the QC gate: an agent may propose, a human approves the mockup before `publishOnCreate`.

Until that exists: use ArtCraft manually, export PNG, upload via Media, and let the built pipeline
do the DPI/format work.

## 6. Cheap generation options (prices UNVERIFIED — check current pricing)

| Model | Strength | Notes |
|---|---|---|
| Grok Imagine (X Premium / API) | cheap stills, in-app edit tools | you mentioned in-house editing; verify outputs for artefacts |
| Gemini 2.5/3 Flash Image | good text adherence, cheap | PosterPal already supports it |
| GPT Image mini | follows prompts, transparent-ish | PosterPal supports it |
| FLUX (via fal) | strong illustration look | PosterPal supports it |
| Local SDXL/Flux | free after hardware | needs GPU; best for volume |

Budget approach: generate at the highest available resolution, downscale; spend money on
**upscaling only when needed** and on **sample orders** (order 1 of every new product before
listing). A $10–20/month subscription is enough for 30–60 stills; the real cost is your QC time.

## 7. Product ideas by method (Fourthwall catalog)

| Method | Products | Art style that works |
|---|---|---|
| DTG | tees, hoodies, kids tees | bold graphic, 3–6 colours, transparent PNG |
| DTFx | hoodies, crewnecks, totes | vivid solids, clean edges, no fine gradients |
| Sublimation | mugs, phone cases, all-over tees, leggings | all-over patterns, seamless tiles, bright colours |
| Stickers | kiss-cut, sheets, holographic | thick outlines, 0.25 in spacing, solid fills |
| Embroidery | caps, beanies, polos, patches | ≤6 colours, simple icons, no small text |
| Screen print (MOQ) | bulk tees for events | flat colours, no gradients |
| Knitwear | sweaters, blankets | needs BMP production template — **not** the AI pipeline |

Niche-page merch fits: trail/gear graphics (hiking), animal puns + species illustrations (animals),
planet/leaf motifs (science/nature education), state/city typography (travel), "collab" lockups
`Ridgeboundia × {Page}` for community drops.

## 8. Definition of a shippable product

1. Source ≥ required pixels for the print area (pipeline verdict `pass`).
2. sRGB, correct format, alpha as needed.
3. Human has viewed the mockup on the actual garment colour at 100% and 400%.
4. No AI tells, no stray background, no cut-off elements.
5. One sample ordered and inspected before the listing goes live.
6. Listing copy states print method and care; AI-generated artwork disclosure where required by the
   platform/community standards.
