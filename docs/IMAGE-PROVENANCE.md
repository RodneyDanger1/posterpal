# Image provenance: what PosterPal strips, and what it refuses to strip

## Short answer

| Request | Verdict | Why |
|---|---|---|
| Strip EXIF / GPS / XMP / camera metadata before posting | **Yes — implemented** | Privacy win, no quality loss (re-encode with orientation baked in, sRGB, 4:4:4). `sanitizeImage()` runs on AI stills and uploads before they are stored/published. |
| Strip **visible generator watermarks** | **No** | Removing a visible watermark is a licence breach for most generators and deliberately hides AI origin. Not shipped. |
| Remove **SynthID** (Google's invisible watermark) | **No, and not technically possible this way** | SynthID is embedded in the pixel values by the generator, not in a metadata block. Re-encoding does not remove it; attempting to defeat it violates Google's terms. |
| Hide AI provenance to avoid Meta enforcement | **No** | Meta's manipulated-media policy expects disclosure of photorealistic AI content. Evading detection risks the Page and the personal account. |

## What PosterPal does instead

1. **Metadata scrub (`src/lib/posterpal/image-sanitize.ts`)** — every image that goes through
   publish/AI-still storage is decoded and re-encoded through sharp. EXIF, GPS, XMP, ICC and
   container metadata are dropped; EXIF orientation is applied first so the image never rotates.
   PNG keeps alpha; JPEG goes out at quality 92 / 4:4:4. Sanitisation failure never blocks a
   publish — the original bytes are kept and the failure is not hidden.
2. **AI media is labelled** — generated stills carry `createdWithAi` and the composer shows the AI
   badge. The operator clicks Publish (HITL), so the story of where the image came from is theirs.
3. **Disclosure is a copy decision, not a metadata trick** — when an image is photorealistic AI,
   add a plain line like "AI-generated image" to the caption. That is what keeps the Page on the
   right side of Meta's policy; stripping provenance is what gets Pages actioned.

## Free/open-source tools that do the legitimate half

- `sharp` (Apache-2.0, already a dependency) — metadata stripping, orientation, sRGB, re-encode.
- `mat2` (GPL-3, CLI) — removes metadata from files; same category, external tool.
- `exiftool` (Perl, GPL) — inspection and removal of metadata.
- `c2patool` (Apache-2.0/MIT, C2PA) — **read/verify** Content Credentials; it is not a "remove
  SynthID" tool. PosterPal does not install a provenance-defeating pipeline.

If you want a **provenance-preserving** workflow later (keep C2PA, add a "Made with AI" credit),
that is a legitimate follow-up: store the manifest and surface it in the composer's AI badge.
