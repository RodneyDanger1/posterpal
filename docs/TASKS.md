# PosterPal task ledger — 2026-10-29

Status legend: **DONE** (evidence) · **PARTIAL** · **BLOCKED** (needs credentials/decision) · **TODO**

## A. Repo + analysis
| # | Task | Status | Evidence |
|---|---|---|---|
| A1 | Clone `RodneyDanger1/posterpal` | **DONE** | 505 files, HEAD `87f7032` |
| A2 | Inventory every module and surface | **DONE** | `docs/ANALYSIS.md` §1 |
| A3 | Establish baseline gates before changes | **DONE** | tsc 0, eslint 0 errors/10 warnings, 121 tests, build OK |
| A4 | Stub sweep for incomplete code | **DONE** | 65 marker hits, all HTML placeholders / doc examples / test doubles; 0 production TODO/FIXME |
| A5 | Identify verified gaps | **DONE** | `docs/ANALYSIS.md` §4 |

## B. Meta / Facebook setup (goal 1)
| # | Task | Status | Evidence |
|---|---|---|---|
| B1 | Research Platform Terms + Developer Policies for AI/scraping | **DONE** | `docs/META-SETUP.md` §7 with official URLs |
| B2 | Document Meta Business app creation for Riley Christensen | **DONE** | `docs/META-SETUP.md` §2 |
| B3 | Document all-Pages import + permissions | **DONE** | `docs/META-SETUP.md` §3–4 |
| B4 | Groups posting reality (no compliant API) | **DONE** | `docs/META-SETUP.md` §6 |
| B5 | Connect the real app + import real Pages | **BLOCKED** | needs App ID/Secret + OAuth click |
| B6 | Live Graph rehearsal (publish/reply/schedule on a real Page) | **BLOCKED** | needs B5 |
| B7 | App Review for non-role users | **TODO** | not needed for personal Development Mode |

## C. Code completion (goal 1)
| # | Task | Status | Evidence |
|---|---|---|---|
| C1 | Fourthwall Platform Open API client | **DONE** | `src/lib/commerce/fourthwall.ts`; 28 unit tests |
| C2 | Commerce schema (connections/products/orders/webhooks/clicks/print exports) | **DONE** | `migrations/0012_commerce.sql`; applied by PGLite at dev boot (health `db: up`) |
| C3 | Encrypted credential storage | **DONE** | `store.ts` uses existing AES-GCM `crypto.ts`; only `has_credentials` leaves server |
| C4 | Product sync + order sync | **DONE** | `store.syncProducts/syncOrders` (paginated, upsert) |
| C5 | Create design product from AI still (5-step pipeline) | **DONE** | `fns.createFourthwallProductFn` + `fourthwall.createDesignProductFromImage` |
| C6 | Signed webhook ingestion with idempotency | **DONE** | `routes/api/commerce/fourthwall/webhook.ts` |
| C7 | On-site buy link w/ attribution + click log | **DONE** | `routes/api/commerce/fourthwall/checkout.ts` (303, logs click) |
| C8 | `/commerce` UI | **DONE** | browser: 200, 0 console errors, screenshot `screenshots/agent-commerce.png` |
| C9 | Facebook Messenger webhook + HITL replies | **DONE** | `messenger.ts`, `messenger-fns.ts`, `routes/api/facebook/messenger.ts`, `/messenger` UI |
| C10 | 24-hour messaging window enforced server-side | **DONE** | unit test `messagingWindow`; server fn refuses outside window |
| C11 | Print-ready asset pipeline (DPI/upscale/sRGB/quantise) | **DONE** | `print-assets.ts`; 12 tests incl. ≤6-colour assertion |
| C12 | Quiet-hour timezone fix | **DONE** | `operator.hourInAudienceZone`; 6 tests |
| C13 | "Duplicate next week" policy-block fix | **DONE** | `clonePost({remix:true})`; `remixCaption` test |
| C14 | `sharp` → runtime dependency | **DONE** | `package.json` + lock synced |
| C15 | Media storage on disk instead of data URLs | **DONE (2nd pass)** | `media-files.ts` + `/api/media/{id}` + `0014_media_files.sql`; 10 tests; Docker `media` volume; legacy inline rows still read |
| C16 | Full `npm run verify` incl. Playwright e2e | **DONE** | **26 passed (2.4m)** incl. new `commerce`/`messenger` specs; canary includes `/commerce` + `/messenger` |
| C17 | Needs-you integration for commerce + Messenger | **DONE** | `devices.needsYou` new kinds; `personaForNeed` mapping; `types.NeedsItem` widened |
| C18 | Commerce credential-overwrite defect (self-review) | **DONE** | blank credentials keep the stored secret; half-filled errors; covered by e2e |
| C19 | UI polish: loading/retry states, variant buy links, print presets, live thread refresh, Ctrl+Enter reply | **DONE** | `/commerce` + `/messenger`; 390px + 1440px Chromium: no overflow, 0 errors |

## D. Commerce / Fourthwall (goal 2, part 1)
| # | Task | Status | Evidence |
|---|---|---|---|
| D1 | Answer "keep buyer on my site" definitively | **DONE** | `docs/COMMERCE-FOURTHWALL.md` §1 — checkout is Fourthwall's; MoR model |
| D2 | Research Facebook Shops end-to-end | **DONE** | `docs/COMMERCE-FOURTHWALL.md` §4 |
| D3 | Product creation connector | **DONE** | see C5 |
| D4 | Printify connector | **DROPPED (your call)** | spec deemed bad; also spends your balance |
| D5 | Printful connector | **NOT BUILT** | official docs login-gated → endpoints unverifiable this session |
| D6 | Fourthwall webhook registration (live) | **BLOCKED** | needs Fourthwall account |
| D7 | First real product + sample order | **BLOCKED** | needs D6 + credentials |

## E. AI image/product pipeline (goal 2, part 2)
| # | Task | Status | Evidence |
|---|---|---|---|
| E1 | Vectorisation reality check | **DONE** | `docs/AI-IMAGEGEN-PIPELINE.md` §1 — Fourthwall rejects vectors |
| E2 | DPI/pixel math per product class | **DONE** | `print-specs.ts` + doc table |
| E3 | Cleanup/upscale/quantise automation | **DONE** | `print-assets.ts`, tests |
| E4 | AI-tell QC checklist + product ideas | **DONE** | `docs/AI-IMAGEGEN-PIPELINE.md` §4, §7 |
| E5 | ArtCraft MCP integration | **BLOCKED** | no ArtCraft MCP mounted in this session; plan in doc §5 |
| E6 | Auto-generate → publish pipeline | **TODO** | after E5; keep human mockup approval |

## F. Business (goal 2, part 3)
| # | Task | Status | Evidence |
|---|---|---|---|
| F1 | Niche-Page portfolio + Groups design | **DONE** | `docs/BUSINESS-PLAN.md` §2 |
| F2 | Supplier model truth + 30-candidate register | **DONE** | `docs/BUSINESS-PLAN.md` §5 (terms marked UNVERIFIED where appropriate) |
| F3 | Unit economics model | **DONE** | `docs/BUSINESS-PLAN.md` §4 (assumptions labelled) |
| F4 | 90-day plan + KPIs + risks | **DONE** | `docs/BUSINESS-PLAN.md` §8–10 |
| F5 | 20–50 vetted suppliers with samples | **TODO** | needs sample orders + line sheets; framework given |
| F6 | Business plan document/PDF | **DONE** | `docs/BUSINESS-PLAN.md` |

## G. Diagrams (PlantUML)
| # | Diagram | Status |
|---|---|---|
| G1 | System architecture | **DONE** → `docs/diagrams/architecture.png` |
| G2 | Meta OAuth + publish sequence | **DONE** → `docs/diagrams/meta-connect.png` |
| G3 | Commerce order/handoff flow | **DONE** → `docs/diagrams/commerce-flow.png` |
| G4 | AI image → product pipeline | **DONE** → `docs/diagrams/image-pipeline.png` |
| G5 | Niche Page network business model | **DONE** → `docs/diagrams/business-network.png` |
