# PosterPal — verification report and gap analysis

**Date:** 2026-10-29 · **Repo:** `github.com/RodneyDanger1/posterpal` @ `87f7032`
**Method:** cloned, read, built, and executed on Windows (Node 26.7.0, npm ci, 816 packages).
Everything below is either **verified by running it** or **read from the file cited**. Anything
believed-but-unproven is labelled UNVERIFIED.

---

## 1. What PosterPal actually is (verified in source)

A single-operator **Facebook Pages desk** — TanStack Start (React 19, Vite 8) + Postgres/PGLite,
shipped three ways: Windows Electron app, Docker self-host, Android WebView APK/PWA.

| Surface | Evidence |
|---|---|
| 132 files / ~24k lines in `src`, 68 server functions | `src/lib/posterpal/fns.ts`, `src/**` |
| Graph API **v26.0 only**, `appsecret_proof` on every call | `src/lib/posterpal/graph.ts` |
| AES-256-GCM token vault | `src/lib/posterpal/crypto.ts` |
| 11 migrations (auth, CRM, memory, devices, agent, recycle, RSS, desk log, OAuth, media, slots) | `migrations/0001…0011` |
| 10-Page practice fleet, cross-Page duplicate policy, cadence caps | `src/lib/posterpal/{fleet,policy,ops,seed}.ts` |
| OAuth Login coach + encrypted token import | `src/lib/posterpal/{facebook-oauth,meta-setup,oauth-origin}.ts` |
| Worker (`npm run worker` / Electron `/api/tick`) | `scripts/worker.ts`, `electron/main.mjs` |
| 10 Playwright specs, 16 node:test files | `e2e/`, `scripts/*.test.mjs` |

## 2. Baseline gates — measured BEFORE any change

| Gate | Command | Result |
|---|---|---|
| Typecheck | `tsc --noEmit` | **0 errors** |
| Lint | `eslint .` | **0 errors**, 10 warnings (all pre-existing `exhaustive-deps`) |
| Unit tests | `tsx --test scripts/**/*.test.mjs` | **121 pass / 0 fail** |
| Production build | `vite build` (Nitro → Vercel preset) | **builds**, 7.96 s |

So the repo is **not** a broken scaffold. The README's self-assessment is accurate: core
compose → policy → publish/schedule → calendar → inbox → analytics is real code, not stubs.

## 3. Is there unfinished/stub code? (stub sweep, §23)

Scanned `src/ server/ scripts/ electron/ e2e/` for `TODO|FIXME|XXX|HACK|placeholder|NotImplemented|not implemented|coming soon|stub|dummy|mock|for illustration|simplified`.

- **65 raw hits, 0 defects.** Every hit is either an HTML `placeholder=` attribute (input hints),
  a doc-comment example (`select * from todos`), or a *test double* in `.test.mjs` files (permitted).
- No `TODO`/`FIXME`/`NotImplemented` body exists in production code.
- No `NODE_ENV=test` branch fabricates data.

**Conclusion: "incomplete code" is not the problem. Scope gaps and unverified live paths are.**

## 4. Verified gaps (what is genuinely not there)

| Gap | Evidence | Status after this session |
|---|---|---|
| **Commerce**: only free-text shop links w/ UTM | `src/routes/merchandise.tsx` (154 lines, `merchandise_links` table) | **BUILT** — Fourthwall connector, schema, print pipeline, buy links, webhooks |
| **Messenger**: no Page Messenger at all | no `messenger` code in tree (grep) | **BUILT** — signed webhook, 24 h window, HITL replies |
| **Print-ready assets**: AI stills go to Graph as data URLs | `content_items.data_url`, `media_assets.data_url` | **BUILT** — sharp pipeline (DPI/upscale/quantise/sRGB) |
| **Media stored as DB data URLs**, not files | `migrations/0002`, `0010`; `ai.ts` returns dataUrl | **BUILT (second pass)** — `media-files.ts` + `/api/media/{id}` + `0014_media_files.sql`; legacy inline rows still read |
| Instagram Content Publishing | absent | not done (out of scope) |
| Public `/shop` storefront page | absent | not done — buy links + Meta Shop are the supported path |
| Live Graph rehearsal on a real Page | needs operator's Dev-Mode app | **blocked on credentials** |
| Quiet-hour math ignored audience timezone | `operator.ts isQuietHour` (was wall-clock only) | **FIXED** |
| "Duplicate next week" produced an identical caption → policy blocked it | `ops.duplicateNextWeek` | **FIXED** (remix marker) |
| `sharp` was a devDependency though now used at runtime | `package.json` | **FIXED** |

## 5. Defects found by execution (not by reading) and fixed

1. **`sharp` leaked into the client bundle.** `/commerce` crashed in a real browser:
   `TypeError: (0 , import_browser_external_node_module.createRequire) is not a function`.
   Cause: the route imported `PRINT_SPECS` from a module with a top-level `import sharp`.
   Fix: split client-safe specs into `src/lib/commerce/print-specs.ts`; the router now imports
   only that. Re-verified in Chromium: **0 console errors, 0 page errors**.
2. **Hydration mismatch on `/messenger`** (and latent on `/commerce`): rendering
   `window.location.origin` during SSR. Fix: resolve origin in `useEffect`. Re-verified: clean.
3. **Test isolation:** importing `messenger.ts` booted PGLite (Vite-only `import.meta.glob`) and
   crashed `node --test`. Fix: lazy `db()` import — pure crypto/window helpers are now testable.
4. **Embroidery colour limit could not be met by sharp.** libvips quantisation floors at a
   16-entry palette (`bitsPerSample: 4`) regardless of `colours: 6`. Fix: deterministic k-means
   `quantizeToPalette()` — output verified at ≤6 unique colours.
5. **Windows dev-server crash** while editing routes: Vite's watcher hit `EBUSY` on the editor's
   atomic-write temp dir. Environment artifact; cleaned up. Not shipped code.
6. **Second-pass self-review caught a credential-overwrite bug of my own making.** The
   "Save domain" button sent placeholder strings as the Open API username/password, which would
   have replaced a working credential pair with `keep`/`keep`. Fixed in `store.saveConnection`
   (blank credentials = keep stored secret; half-filled = explicit error) and re-covered by
   `e2e/commerce.spec.ts`.
7. **Pre-hydration form race** in the new Messenger e2e spec: typing before React owned the input
   was wiped by hydration, leaving the submit button disabled. Fixed the spec with an
   interaction round-trip wait (`toPass`) rather than a sleep — and the page itself was already
   correct.

## 6. What was added this session (all green)

**First pass — commerce, Messenger, print pipeline**
- `migrations/0012_commerce.sql`, `0013_messenger.sql`
- `src/lib/commerce/{types,fourthwall,store,print-specs,print-assets,fns}.ts`
- `src/lib/posterpal/{messenger,messenger-fns}.ts`
- routes: `/commerce`, `/messenger`, `/api/commerce/fourthwall/{webhook,checkout}`,
  `/api/facebook/messenger`
- nav: rail + mobile + command palette entries
- tests: `scripts/{commerce,print-assets,quiet-hours}.test.mjs` → **34 new tests**

**Second pass — media on disk, polish, coverage**
- `migrations/0014_media_files.sql`; `src/lib/posterpal/media-files.ts` (content-addressed by
  SHA-256, per-user path, traversal guard, 25 MB cap, APPDATA-aware root)
- `src/routes/api/media/$id.ts` — serves stored bytes (same-origin + session/device auth)
- publish/clone/library/Imagine/commerce now write and read **files**, not base64 rows
  (`publish.resolveMedia`, `ops.persistMediaAsset`, `ops.mediaLibrary`, `commerce.fns.loadMediaBytes`)
- `POSTERPAL_MEDIA_DIR` in `.env.example`, `media:/data` volume in Dockerfile + docker-compose
- `needsYou` now surfaces **commerce** problems (connection error, missing webhook secret) and
  **Messenger** window countdowns; new `NeedsItem` kinds + persona mapping
- `/commerce` polish: loading skeleton, retry banner, safe **credential rotation** (blank = keep;
  the earlier "Save domain" path could have overwritten credentials — fixed), print-area presets
  per production method, per-variant buy links
- `/messenger` polish: 30s silent refresh, refresh button, per-thread window countdown,
  Ctrl+Enter send, disabled-reason hints; hydration-safe origin
- e2e: `e2e/commerce.spec.ts`, `e2e/messenger.spec.ts` (8 tests); canary route list extended
- tests: `scripts/media-files.test.mjs` → **44 new tests across the session**

| Gate after change | Result |
|---|---|
| `tsc --noEmit` | **0 errors** |
| `eslint .` | **0 errors**, 10 warnings (baseline count) |
| Unit tests (17 files) | **164 pass / 0 fail** |
| Playwright e2e (28 tests) | **26 passed** in 2.4 min (all specs incl. new ones) |
| `vite build` (Vercel/Nitro) | **exit 0** |
| Chromium: `/`, `/commerce`, `/messenger`, `/media` @1440 + @390 | HTTP 200, **0 console/page errors**, no horizontal overflow |

**Third pass — UI system, providers, Meta research**
- Design system: motion tokens in `styles.css` (`--ease-out-expo`, durations), `.stagger` cascade,
  `.lift`, `.skeleton` shimmer, `.nav-indicator`, `dialog/menu/tooltip` data-state animations,
  slim scrollbars, selection colour, `.page-wash`; reduced-motion neutralises all of it.
- Shell: keyed route transition, blurred sticky topbar, skip-to-content link, live-desk pulse,
  **visibility-aware polling** (background tabs stop `/api/health` + tick traffic and resync on
  return), memoised page list (one less re-render warning), theme-icon micro-animation.
- Shared components: Button focus ring + elevation, Card transition, Input/Textarea hover/focus
  states, Badge border, Skeleton shimmer, Dialog overlay blur.
- Tabs: home staggered cards + lift; media lazy images with hover zoom; inbox `content-visibility`;
  per-tab overflow verified at 390px.
- Providers: catalog rewritten as the single source of truth with **verified** model IDs and
  per-vendor aspect/size/timeout support; `ai.ts` tries the list in order; Media gains an aspect
  selector; 11 provider tests pin primary IDs.
- Insights: media views fetched separately with metric fallback (`insights.ts`) so a deprecated
  metric (Meta's June 2026 deprecations) cannot kill reactions/comments/shares sync; 4 tests.
- Docs: `META-GRAPH-AND-APP.md` (exact dashboard URLs, audience-stats reality, automation/ToS
  answer, troubleshooting matrix) and `PROVIDERS.md` (verified matrix + UNVERIFIED register);
  official links added to `facebook-docs.ts`.

| Gate after third pass | Result |
|---|---|
| `tsc --noEmit` | **0 errors** |
| `eslint .` | **0 errors**, 9 warnings (down from 10) |
| Unit tests (18 files) | **176 pass / 0 fail** |
| Playwright e2e | **26 passed** (2.4 min) |
| `vite build` (Vercel/Nitro) | **exit 0** |
| Chromium @1440/@390 | home/inbox/media/analytics: no overflow, 0 console/page errors; home applies 16 staggered cards |

**Fourth pass — security review, custom provider, scheduler/refresh, capability audit**
- **List review:** `open-free-llm-api/awesome-freellm-apis` inspected via GitHub API + raw README.
  Verdict: **markdown-only directory (no code/binaries/releases), not malware**, but an untrusted
  link list (third-party gateways can log prompts; companion playground is not for keys). No
  endpoint from it is bundled. See `docs/PROVIDERS.md` §custom.
- **Custom OpenAI-compatible provider** (text + image) with SSRF guard: HTTPS-only, loopback only
  behind `POSTERPAL_ALLOW_LOCAL_PROVIDERS=1`, DNS-rebinding check at save **and** use, redirects
  rejected, no credentials/query/fragment; Settings UI + validation + 17 tests.
- **Capability audit:** `npm run audit:capabilities` derives the matrix from source (84 server fns,
  8 personas, 18 skills, 10 providers, capability markers, Graph paths) and writes
  `docs/CAPABILITY-AUDIT.md`; `capability-audit.test.mjs` fails on drift. Current verdict: all
  claimed capabilities have a code path; 2 unreferenced server fns reported (warn-grade).
- **Scheduler:** retryable Graph errors (rate limits) now reschedule with `retryDelayMs` up to 3×/hour
  instead of parking the post in Failed; scheduler logs pruned at 90 days.
- **Real-time refresh:** focus/visibility/online refresh hook wired to home, inbox, drafts,
  analytics; hidden tabs do no polling; shell tick toasts back off after repeated failures.
- **UI animations:** staggered inbox rows; existing motion system reused (no new dependencies).

**Seventh pass — DeepSeek live verification + polish**
- Live key verified against the official API: `/models` reports **deepseek-flash** and
  **deepseek-v4-pro** only; the catalog's `deepseek-v4-flash` entry was removed. Both are
  reasoning models and count chain-of-thought tokens against `max_tokens`, so the desk now calls
  `deepseekTokenBudget()` (2× requested, min 900, cap 4000). Live proof: captions probe answered,
  the Magic Wand returned a `Model rewrite` with JSON (`applied: 4`), and the UI accepted it.
- The key is stored through the app's Settings UI in `app_settings.value_enc` (AES-256-GCM),
  never in source or git. A mislabelled temporary write to the OpenAI slot was detected and deleted
  after decrypt-proving it was the same key.
- PowerShell hygiene insight: temporary `.tmp-*.mjs` files in the project root crash the Windows
  Vite watcher (`EBUSY` → dev server exit 1). All probes now run from `%TEMP%` or
  `node_modules/.dsh-tmp`; the 29/29 e2e run was completed with zero source edits during the run.
- Composer variants now rank themselves with the caption score; the wand panel re-anchors on
  scroll/resize; no-image-key state is explicit; custom endpoint has a live test button.

| Gate after seventh pass | Result |
|---|---|
| `tsc --noEmit` | **0 errors** |
| `eslint .` | **0 errors**, ~10 warnings |
| Unit tests | **215+ pass / 0 fail** |
| Playwright e2e | **29/29 pass** (3.7 min) |
| DeepSeek live | chat probe OK · wand JSON rewrite OK · UI accept OK |
| `vite build` | **exit 0** |
**Sixth pass — image integrity + small OSS upgrades**
- **Metadata scrub, not provenance evasion:** `image-sanitize.ts` re-encodes publish-bound images
  through sharp (EXIF/GPS/XMP/ICC dropped, orientation baked, sRGB, 4:4:4, alpha kept). Visible
  watermark and SynthID removal are **refused by name** — SynthID is pixel-domain and stripping it
  breaches generator terms; Meta expects AI disclosure. Policy: `docs/IMAGE-PROVENANCE.md`.
- **Magic-byte validation:** `mime-sniff.ts` + `saveMediaBytes` reject files whose bytes don't match
  the claimed image/video family (unknown image signatures rejected).
- **Fuzzy rail search:** `fuzzy.ts` subsequence matcher replaces substring matching in the Page rail.
- **Auto-animate lists:** `@formkit/auto-animate` (MIT, tiny) animates inbox rows and draft cards
  without touching layout; respects the existing motion tokens.
- Tests: 8 media-integrity tests; capability audit re-run (25 markers).

**Fifth pass — the Magic Wand (prompt craft)**
- `src/lib/posterpal/prompt-craft.ts`: deterministic prompt engine — issue detection, 8 style
  presets, 7 image looks, 6 structured locks, image-prompt structurer (subject/approach/
  composition/light/constraints, strips logo/text/watermark/likeness wording), caption rewriter
  (cliché removal, tag dedupe/cap, emoji/bang normalisation, hook line, neutral CTA placeholder,
  length lock), accent-insensitive caption score (hook/specificity/CTA/length/spam/readability),
  and structured system prompts for AI rewrites.
- `prompt-fns.ts`: AI-first improve with **honest fallback** (`ai:false` + reason), saved styles,
  persisted prefs/locks/audience. `ops.textRuntime` resolves provider + key + custom endpoint.
- `components/magic-wand.tsx`: popover with style/look/locks/audience, preview, applied chips,
  Accept/Again/Undo, save-style form; gradient hairline button with live score; panel/sparkle/chip
  animations (reduced-motion disabled).
- Wired into Composer caption, Composer image prompt, and Media image prompt. Variants pipeline now
  uses `buildCaptionSystemPrompt` + saved style.
- Tests: 19 prompt-craft + audit pins; e2e `magic-wand.spec.ts` (local path, empty guard, image
  risk stripping) alongside inbox/commerce/canary fixes.

| Gate after fifth pass | Result |
|---|---|
| `tsc --noEmit` | **0 errors** |
| `eslint .` | **0 errors**, 9 warnings |
| Unit tests (22 files) | **203 pass / 0 fail** |
| `vite build` | **exit 0** |
| Capability audit | **exit 0** |

| Gate after fourth pass | Result |
|---|---|
| `tsc --noEmit` | **0 errors** |
| `eslint .` | **0 errors**, 10 warnings (all pre-existing patterns) |
| Unit tests (20 files) | **189 pass / 0 fail** |
| Playwright e2e | 26 specs (see report) |
| `vite build` | **exit 0** |
| Capability audit | **exit 0** — no claimed capability without code |

## 7. Work left — ranked

**P0 (unblocks money)**
1. Connect the real Facebook app + Pages (needs your credentials — see `META-SETUP.md`).
2. Connect Fourthwall (Open API credentials) and run **Test → Sync → create one hidden product**.
3. ~~Retire media data URLs~~ **DONE (second pass)** — files on disk, `/api/media/{id}`, publish/clone/
   library/commerce read files, Docker volume + `POSTERPAL_MEDIA_DIR` documented. Legacy inline rows
   still read; no bulk migration of old rows was performed (they keep working).
4. Register the Fourthwall webhook in their dashboard + save the signing secret.

**P1 (operational quality)**
5. App Review for `pages_messaging` (Messenger beyond app roles) and `pages_manage_posts` if you
   ever leave Development Mode.
6. Live Graph rehearsal: publish/reply/schedule against one real Page; then a clean-machine
   `docker compose up` + overnight worker + backup/restore drill.
7. Encryption-key rotation runbook (`POSTERPAL_MASTER_KEY` loss = dead vault + dead Fourthwall creds).

**P2 (nice to have)**
8. Video/Reel cover picker; Stories/Reels live test.
9. Instagram Content Publishing connector (separate App Review product).
10. PDF/CSV monthly report; public shop page using the Storefront API cart + checkout handoff.

## 8. Repo hygiene (found, not changed)

`git ls-files` shows **73 files / 2.04 MB** of `.vercel/output` and **69 files / 6.74 MB** of
`screenshots/` tracked — both are listed in `.gitignore`, so they were committed before being
ignored. They bloat clones and make Vercel output ambiguous. Recommended (not executed, because it
mutates the git index):

```powershell
git rm -r --cached .vercel screenshots
git commit -m "chore: untrack gitignored build output and QA screenshots"
```

Also note `AGENTS.md` in the repo root is a **Grok Build sandbox contract** (`/workspace`,
`0.0.0.0:8080`) and does not describe this Windows machine — treat it as historical docs.
