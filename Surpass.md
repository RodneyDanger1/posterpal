# Surpass.md — PosterPal transformation bible

> **Read this entire file before writing code.** It is the handoff for any AI agent (or human) who will transform PosterPal from a working personal Facebook Pages desk into the best self-hosted Facebook Page CRM a solo operator can run.

---

## 0. Instructions for the next AI agent (read first)

You are continuing **PosterPal**, a personal CRM for **unlimited Facebook Pages** the operator administers. The original spec asked for a Windows 10/11 WPF (.NET 9) app named “BookBoss”. That name is **illegal on Meta** (see §12). The live product is a **TanStack Start web desk** that implements the same Graph v26.0 rules. A Windows kernel lives in [`desktop/`](desktop/) and is not the preview.

### How to use this file

1. Read **§0, §1, §8, §12, §17** before any edit. Those are the laws.
2. Use **§3** as the code map. Do not invent a parallel architecture.
3. Use **§7** as the roadmap. Do **Phase 0 (bugs)** before new features. Reliability is the moat.
4. Use **§4–§6** when choosing *what* to build. Do not copy Buffer. Do not become a 12-network SaaS.
5. Use **§9–§10** when the operator asks to self-host or ship an APK.
6. Use **§17** when changing the Agent tab — research is Profile → Plan → Search → Notes → Draft → Human send. Never scrape Facebook. Never auto-publish.
7. After every change: typecheck, keep the preview on `:8080`, never silent-fail Graph work.

### Non-negotiables (do not “improve” these away)

| Law | Meaning |
| --- | --- |
| Official Graph API **v26.0** over HTTPS only | No scraping, Selenium, cookie reuse, unofficial login, or “unofficial” Graph wrappers. |
| Human-in-the-loop comments | AI may **draft**. A human clicks **Send**. Never auto-reply, auto-like, auto-follow, auto-share. |
| No fake engagement | Never buy/sell likes, comments, follows, accounts, or admin roles. Never generate fake engagement. |
| Cadence guard | Warn at >8 posts/24h per Page (default). Hard-block at a configurable cap (default 20). Identical high-frequency posts are a spam risk. |
| Failures are never silent | Graph errors → `Failed` + `scheduler_logs` row + toast. Never swallow. |
| Tokens encrypted at rest | AES-256-GCM in web (`crypto.ts`). DPAPI in Windows. Zero secrets in source. |
| Practice mode stays | Operator can work without Facebook. Live Graph is optional. |
| Product name is **PosterPal** | Meta rejects Book / Face / FB / Facebook / Meta in app display names. |
| Single-operator desk | No Google/X/email login gate. `VITE_AUTH_ENABLED=false`. One operator identity. |
| Preview contract | Keep `/workspace/startup.sh` starting the app on `0.0.0.0:8080`. Do not delete Grok PWA / preview-host-bridge. |

### What “surpass competitors” actually means

Do **not** try to beat Hootsuite/Sprout at 12 networks, ads, and seats. That is a different product and a different company.

Beat them at the job this operator hired: **run unlimited Facebook Pages, compose/schedule/moderate/analyze, then monetize through better content ops**, on a machine they own, without paying per-channel, without banned automation.

The win condition is: a Winona bookstore / weekend-events operator can connect a Dev-Mode Facebook app, publish a photo, schedule a Reel, answer a buying-intent comment, and see which post sold the tote — faster and safer than Meta Business Suite, Buffer, Publer, or Postiz.

### Definition of done for any future turn

- `npm run typecheck` clean.
- `npm run build` succeeds.
- Preview still serves.
- New Graph paths log failures.
- No TODOs, no `NotImplementedException`, no stub handlers on the vertical slice you touched.
- You did **not** add auto-likes, auto-comments, scrapers, or Group spam tools.

---

## 1. What this application is

**PosterPal** is a personal Facebook Pages desk.

It is **not** a social network. It is **not** an engagement bot. It is **not** a multi-network agency SaaS.

It is a **content-ops CRM** for one human who administers one or many Facebook Pages (bookstores, events, merch, local brands). The operator:

1. Composes captions + media (text, photo, carousel, video, Reel, Story).
2. Runs a **policy checklist** (empty caption, near-duplicate, branded-content disclosure, alt text, AI-media reminder).
3. Publishes now, schedules on Facebook (10 min–30 days), or parks on a **local scheduler**.
4. Moderates comments with AI **drafts** and a human Send button.
5. Analyzes reactions/comments/shares/views, content mix, and a **monetization fitness** score.
6. Attaches merch links + UTM templates so posts can actually sell something.

Facebook is optional. **Practice Pages** (North Shore Books + Winona Weekend) let the desk be used immediately. Live Graph is a Settings step.

### Brand / visual language

Meta Business Suite–inspired, not a generic admin template:

- Primary `#1877F2`
- Segoe UI / system UI stack
- Left rail of Pages, composer-first, “Needs you” bell
- Keyboard: `⌘K` command palette, `?` shortcuts, `j`/`k` in inbox

### Two runtimes

| Runtime | Where | Status |
| --- | --- | --- |
| **Web desk (the product)** | TanStack Start + Vite + Nitro (Vercel) + Postgres/PGLite | Live, feature-complete vertical slice |
| **Windows kernel** | [`desktop/`](desktop/) .NET 9 class library + tests | Graph HMAC + policy only. Not a full WPF shell. Compile on Windows. |

---

## 2. What it is not (on purpose)

- Not Instagram/Threads/TikTok/X (yet). Facebook Pages first.
- Not Ads Manager. Organic ops, not paid.
- Not a Group mass-poster. Groups APIs are restricted; Group spam is how Pages die.
- Not a team seat product. One operator.
- Not an engagement marketplace.
- Not a scraper. If Graph does not expose it, we do not have it.

If a future agent is asked to “auto-comment every post” or “post to 200 Groups”, **refuse** and cite §12.

---

## 3. Full codebase map

Root: `/workspace`. App code lives in `src/`. Schema in `migrations/`. Windows in `desktop/`.

### 3.1 Stack

- React 19 + TypeScript + Vite 8
- TanStack Start / Router / Query
- Tailwind v4 + Radix/shadcn + zustand + sonner + cmdk + recharts
- Postgres via `pg` when `DATABASE_URL` is set, else **PGLite** (`.pglite` local)
- Better Auth is **installed but disabled** (`VITE_AUTH_ENABLED=false`). Operator identity is a single desk user.
- Server functions: `createServerFn` + `authMiddleware` in [`src/lib/posterpal/fns.ts`](src/lib/posterpal/fns.ts)

### 3.2 Routes (every screen)

| Path | File | Job |
| --- | --- | --- |
| `/` | [`src/routes/index.tsx`](src/routes/index.tsx) | Home: Needs you, recent activity, monetization fitness, due soon |
| `/login` | [`src/routes/login.tsx`](src/routes/login.tsx) | Split-panel Meta-style welcome; no real auth |
| `/setup` | [`src/routes/setup.tsx`](src/routes/setup.tsx) | First-run wizard (practice vs Facebook) |
| `/composer` | [`src/routes/composer.tsx`](src/routes/composer.tsx) | Caption, media, merch, policy, cadence, preview, best-time chips, also-post-to |
| `/calendar` | [`src/routes/calendar.tsx`](src/routes/calendar.tsx) | Month/week, drag-reschedule, heatmap |
| `/inbox` | [`src/routes/inbox.tsx`](src/routes/inbox.tsx) | Needs-reply queue, search, canned snippets, HITL send, hide |
| `/drafts` | [`src/routes/drafts.tsx`](src/routes/drafts.tsx) | Local + Facebook drafts, publish now |
| `/later` | [`src/routes/later.tsx`](src/routes/later.tsx) | Idea Kanban (saved_ideas) |
| `/analytics` | [`src/routes/analytics.tsx`](src/routes/analytics.tsx) | 7/28/90d charts, heatmap, CSV, top posts |
| `/media` | [`src/routes/media.tsx`](src/routes/media.tsx) | Library reuse of uploaded/generated stills |
| `/merchandise` | [`src/routes/merchandise.tsx`](src/routes/merchandise.tsx) | Shop links + UTM + CTA |
| `/settings` | [`src/routes/settings.tsx`](src/routes/settings.tsx) | App ID/Secret, cadence, voice, AI keys, theme |
| `/vault` | [`src/routes/vault.tsx`](src/routes/vault.tsx) | Token vault, expiry, scheduler logs |
| `/agent` | [`src/routes/agent.tsx`](src/routes/agent.tsx) | Research desk — drafts only, never publishes |
| `/pair` | [`src/routes/pair.tsx`](src/routes/pair.tsx) | Device pairing code for phone/second browser |
| `/api/facebook/start` | [`src/routes/api/facebook/start.ts`](src/routes/api/facebook/start.ts) | OAuth start |
| `/api/facebook/callback` | [`src/routes/api/facebook/callback.ts`](src/routes/api/facebook/callback.ts) | OAuth loopback |
| `/api/sync/pair` | [`src/routes/api/sync/pair.ts`](src/routes/api/sync/pair.ts) | Pairing redeem |
| `/api/sync/snapshot` | [`src/routes/api/sync/snapshot.ts`](src/routes/api/sync/snapshot.ts) | Device snapshot (partially wired) |
| `/api/auth/$` | [`src/routes/api/auth/$.ts`](src/routes/api/auth/$.ts) | Better Auth mount (disabled) |

Shell: [`src/components/app-shell.tsx`](src/components/app-shell.tsx) (rail, Needs bell, inspector, shortcuts, 60s `tickFn`).

### 3.3 Domain library — `src/lib/posterpal/`

This is the product. UI is thin. **Fix and extend here first.**

| File | Responsibility |
| --- | --- |
| [`constants.ts`](src/lib/posterpal/constants.ts) | `GRAPH_VERSION = v26.0`, scopes, loopback `http://127.0.0.1:55443/callback/` |
| [`types.ts`](src/lib/posterpal/types.ts) | All row types, `ComposerInput`, `NeedsItem`, analytics, agent |
| [`crypto.ts`](src/lib/posterpal/crypto.ts) | AES-256-GCM encrypt/decrypt, token redaction |
| [`graph.ts`](src/lib/posterpal/graph.ts) | `appSecretProof` HMAC-SHA256, `graphFetch`, `graphMultipart`, `ruploadBinary`, `graphCollect`, error map, schedule window, feed payload |
| [`policy.ts`](src/lib/posterpal/policy.ts) | Jaccard duplicate, branded-content `#ad`, cadence level, Reel 9:16 / 3–60s / 540×960 |
| [`publish.ts`](src/lib/posterpal/publish.ts) | `saveAndDispatch`, `attemptGraphPublish` (feed/photo/carousel/video/reel/story), `tickScheduler`, `policyForComposer` |
| [`ops.ts`](src/lib/posterpal/ops.ts) | Facade used by every server fn: compose, clone, reschedule (correct Graph update), inbox, analytics, agent, merch, sync, tick |
| [`fns.ts`](src/lib/posterpal/fns.ts) | All `createServerFn` exports (auth-gated) |
| [`repo.ts`](src/lib/posterpal/repo.ts) | SQL: pages, posts, comments, merch, vault, cadence, logs, search |
| [`facebook-oauth.ts`](src/lib/posterpal/facebook-oauth.ts) | Callback, pasted token, `/me/accounts` import, vault refresh |
| [`sync.ts`](src/lib/posterpal/sync.ts) | Pull published posts, comments, insights |
| [`reschedule.ts`](src/lib/posterpal/reschedule.ts) | **Legacy / buggy** — POSTs a new Graph object. Prefer `ops.reschedule`. |
| [`seed.ts`](src/lib/posterpal/seed.ts) | Practice Pages, demo posts/comments, `ensureMemory`, `ensureOverduePractice` |
| [`operator.ts`](src/lib/posterpal/operator.ts) | Heatmap, `topSlots`, quiet hours, monetization fitness, UTM, caption stats |
| [`desk.ts`](src/lib/posterpal/desk.ts) | Overlapping helpers with `operator.ts` (consolidate someday) |
| [`ai.ts`](src/lib/posterpal/ai.ts) | Grok (`XAI_API_KEY`), OpenAI, Gemini, DeepSeek, Flux/fal image |
| [`providers.ts`](src/lib/posterpal/providers.ts) | Provider IDs and labels |
| [`agent.ts`](src/lib/posterpal/agent.ts) | Research agent. Refuses publish/auto-reply prompts. Drafts only. |
| [`devices.ts`](src/lib/posterpal/devices.ts) | Pairing codes, device tokens, Needs-you aggregation |
| [`memory.ts`](src/lib/posterpal/memory.ts) | Later ideas + caption snippets |
| [`page-id.ts`](src/lib/posterpal/page-id.ts) | Resolve Page; **falls back to first Page alphabetically** (dangerous on writes) |
| [`facebook-names.ts`](src/lib/posterpal/facebook-names.ts) | Live checker: illegal Meta display names |
| [`facebook-domains.ts`](src/lib/posterpal/facebook-domains.ts) | App Domains / Site URL / Redirect URI hints |
| [`oauth-origin.ts`](src/lib/posterpal/oauth-origin.ts) | Public origin + redirect candidates |
| [`connect-client.ts`](src/lib/posterpal/connect-client.ts) | Popup OAuth helper |
| [`inbox-extra.ts`](src/lib/posterpal/inbox-extra.ts) | Mark comment handled |

### 3.4 Server functions (complete list)

From [`fns.ts`](src/lib/posterpal/fns.ts):

`bootstrapApp`, `getSettingsFn`, `saveFacebookApp`, `saveAiKeysFn`, `savePrefs`, `completeSetup`, `startPractice`, `beginFacebookOAuth`, `listPagesFn`, `listPostsFn`, `getPostBundle`, `cadenceFn`, `policyFn`, `composeFn`, `publishNowFn`, `rescheduleFn`, `cancelPostFn`, `commentsFn`, `hideCommentFn`, `sendReplyFn`, `markCommentHandledFn`, `generateReplyDraftsFn`, `merchFn`, `saveMerchFn`, `deleteMerchFn`, `vaultFn`, `logsFn`, `searchFn`, `analyticsFn`, `mediaLibraryFn`, `generateVariantsFn`, `hashtagsFn`, `analyzeFn`, `updatePageVoiceFn`, `exportCsvFn`, `tickFn`, `syncNowFn`, `calendarFn`, `ideasFn`, `saveIdeaFn`, `deleteIdeaFn`, `moveIdeaFn`, `snippetsFn`, `saveSnippetFn`, `deleteSnippetFn`, `imaginePhotoFn`, `needsYouFn`, `createPairingFn`, `listDevicesFn`, `revokeDeviceFn`, `runAgentFn`, `listAgentRunsFn`, `facebookStatusFn`, `importFacebookTokenFn`, `clonePostFn`.

### 3.5 Graph / publish primitives

[`graph.ts`](src/lib/posterpal/graph.ts):

- `appSecretProof(token, secret)` — HMAC-SHA256 hex. Tested in [`scripts/hmac.test.mjs`](scripts/hmac.test.mjs) and [`desktop/PosterPal.Tests`](desktop/PosterPal.Tests).
- `buildAuthorizeUrl` — Facebook Login dialog.
- `mapGraphError` — 190 re-auth, 4/17/32/613/80001 backoff, 100 invalid_param, permission, unknown_schedule.
- `facebookScheduleWindow` — 10 minutes–30 days.
- `graphFetch` / `graphMultipart` / `ruploadBinary` — all attach `appsecret_proof`.
- `graphCollect` — paging (exists; **not used** on `/me/accounts` — 25-Page silent cap).

[`publish.ts`](src/lib/posterpal/publish.ts) pipelines:

- Text → `POST /{page-id}/feed`
- Photo → `POST /{page-id}/photos`
- Carousel → unpublished photos + `attached_media` feed
- Video → resumable `/{page-id}/videos`
- Reel → `/{page-id}/video_reels` + rupload
- Story → photo/video story endpoints
- Modes: `now` | `schedule` (Graph unpublished + `scheduled_publish_time`) | `local-draft` | `fb-draft` (`published=false`, no time)

### 3.6 Policy engine

[`policy.ts`](src/lib/posterpal/policy.ts) `runPolicyChecklist`:

| Flag | Severity | Trigger |
| --- | --- | --- |
| empty-caption | block | blank message |
| duplicate | block | Jaccard ≥ 0.82 vs last 30 |
| similar | warn | Jaccard ≥ 0.55 |
| branded-content | warn | merch/shop language without `#ad` / paid partnership |
| alt-text | warn | images missing alt |
| ai-media | info | `created_with_ai` — reminder, **not** injected into caption |

Cadence: [`repo.cadenceForPage`](src/lib/posterpal/repo.ts) + `cadenceLevel`. Default warn 8 / block 20 per Page per 24h.

Reel: 9:16, 3–60 seconds, min 540×960.

### 3.7 Schema (migrations)

| File | Tables |
| --- | --- |
| [`0001_auth.sql`](migrations/0001_auth.sql) | Better Auth (do not edit) |
| [`0002_bookboss.sql`](migrations/0002_bookboss.sql) | `app_settings`, `token_vault`, `pages`, `posts`, `content_items`, `merchandise_links`, `comments`, `scheduler_logs`, `quota_snapshots`, `oauth_states` |
| [`0003_memory.sql`](migrations/0003_memory.sql) | `saved_ideas`, `caption_snippets` |
| [`0004_devices.sql`](migrations/0004_devices.sql) | `pairing_codes`, `devices` |
| [`0005_agent.sql`](migrations/0005_agent.sql) | `agent_runs` |

**Post statuses:** `LocalDraft`, `FacebookDraft`, `LocalScheduled`, `FacebookScheduled`, `Publishing`, `Published`, `Failed`, `Cancelled`.

Every app table is scoped by `user_id`.

### 3.8 UI components that matter

- [`facebook-preview.tsx`](src/components/facebook-preview.tsx) — live Feed chrome (avatar, caption, media, Like/Comment/Share)
- [`post-inspector.tsx`](src/components/post-inspector.tsx) — dialog: media, comments, clone-to-other-Pages
- [`needs-you.tsx`](src/components/needs-you.tsx) / [`needs-bell.tsx`](src/components/needs-bell.tsx)
- [`command-palette.tsx`](src/components/command-palette.tsx)
- [`shortcut-help.tsx`](src/components/shortcut-help.tsx)
- [`status-badge.tsx`](src/components/status-badge.tsx)
- [`guard.tsx`](src/components/guard.tsx) — setup gate
- [`src/lib/store.ts`](src/lib/store.ts) — zustand: selected Page, theme, composer prefill. Inspector is a **separate** non-persisted store (`useInspectorStore`) so persist-merge cannot drop the open action.

### 3.9 Windows kernel

[`desktop/PosterPal.Core`](desktop/PosterPal.Core):

- `Graph/AppSecretProof.cs` — same HMAC as JS
- `Policy/PolicyChecklist.cs` — same Jaccard / cadence ideas

[`desktop/PosterPal.Tests`](desktop/PosterPal.Tests) + [`desktop/build.ps1`](desktop/build.ps1). This is **not** a full WPF CRM. Do not pretend it is. Expanding it is Phase 6, after the web desk is production-solid.

### 3.10 Scripts / tests

- [`scripts/hmac.test.mjs`](scripts/hmac.test.mjs) — Graph proof vector
- [`scripts/silent-bugs.test.mjs`](scripts/silent-bugs.test.mjs)
- [`scripts/phase0.test.mjs`](scripts/phase0.test.mjs) — §8 regressions: graph error map, schedule window, feed payload shapes, per-Page fitness
- [`scripts/worker.ts`](scripts/worker.ts) — Phase 1 background worker (`npm run worker`; tickScheduler + syncFromGraph + refreshVaultTokens every 60s; requires `DATABASE_URL`)
- [`scripts/browser-smoke.mjs`](scripts/browser-smoke.mjs) — Playwright load + screenshot → `/workspace/screenshots/`
- [`scripts/migrate.mjs`](scripts/migrate.mjs)
- [`scripts/qa-desk.mjs`](scripts/qa-desk.mjs)
- `npm test` — tsx test runner on `scripts/**/*.test.mjs` (Windows-safe; 66 tests, 59 pass — the 7 fails are pre-existing grok-pwa platform tests)
- `npm run typecheck` / `npm run build`

### 3.11 Docs already in-repo

- [`README.md`](README.md) — one-page architecture
- [`SETUP.md`](SETUP.md) — Facebook App, scopes, Graph facts
- This file — strategy + agent handoff

---

## 4. Competitive landscape (2026)

Researched against live products and GitHub, not vibes.

### 4.1 Closed-source / SaaS (what operators actually compare us to)

| Product | Positioning | Facebook Pages | Killer features | Price shape | Weak vs us |
| --- | --- | --- | --- | --- | --- |
| **Meta Business Suite** | Official, free | Native, best Reels/Stories | Unified inbox, IG cross-post, native schedule, bulk video, insights | Free | Ugly UX for power users, 30–75 day cap, no merch CRM, no local drafts when Graph is down, no policy duplicate guard, one-composer-at-a-time, no self-host |
| **Buffer** | Simple scheduler | Pages + Groups (limited) | Queue, Start Page, streaks, 12 networks | Free 3 channels / 10 posts; then **$6+/channel/mo** | Per-channel tax kills “unlimited Pages”. Thin Facebook inbox. No cadence/spam guard. |
| **Publer** | Value Facebook specialist | Pages, some Groups workaround | Bulk CSV (500), recycle, RSS, first comment, watermarks, Reels/Stories | Generous free; cheap paid | Cloud-only, weaker analytics, recycle can become spam, no HITL policy desk |
| **Later** | Visual / IG-first | Pages yes | Visual calendar, Linkin.bio | Mid | Facebook is second-class |
| **Metricool** | Analytics + ads + web | Pages yes | Competitor reports, ads + organic, best free analytics | From ~$25 | Publishing is secondary. No merch ops. Cloud. |
| **Hootsuite / Perch** | Enterprise | Yes | Listening, approvals, seats | ~$99/user | Overkill, expensive, Facebook depth is generic |
| **Sprout Social** | Brand reputation | Yes | Listening, care, reports | ~$79/seat | Same |
| **Agorapulse** | Mid-market inbox | Yes | Unified inbox + reports | ~$79/user | Cloud, per-seat |
| **Planable** | Approvals | Yes | Client review workflows | Mid | We are one operator — skip |
| **SocialBee** | Categories / recycle | Yes | Evergreen categories | Mid | Recycle without duplicate Jaccard = Meta spam risk |
| **Nuelink** | Agency multi-Page | Yes | Many Pages, ads | Mid | Cloud |
| **PostEverywhere / IndiePost** | AI agent schedulers | Mixed | Agent CLI, unlimited accounts marketing | Low–mid | Dangerous if they auto-send; we must not copy the “agent posts for you” pitch |

### 4.2 Open-source / self-host (GitHub)

| Repo | Stars (order of mag.) | Facebook | Notes |
| --- | --- | --- | --- |
| **[Postiz](https://github.com/gitroomhq/postiz-app)** | ~35k | Weak / not the headline (X, Bluesky, Mastodon, Discord first) | Next+Nest, Temporal, AGPL, Docker, AI agentic. Closest “self-host Buffer”. **Facebook Pages are not the product.** |
| **[Shoutrrr](https://github.com/coollabsio/shoutrrr)** (Coolify) | hundreds | **Yes** — Pages OAuth, ≤10 images or 1 video, likes/comments/shares/impressions | Laravel+React, Docker one-container, Apache-2. Composer + calendar + queue. **No Facebook inbox, no HITL comments, no cadence, no merch.** |
| **[Social-auto-engine / SocialBlast](https://github.com/Freespirits/social-auto-engine)** | smaller | Deep Graph (20 methods): posts, comments, hide, DMs, insights | Python FastAPI + MCP for Claude. Approval queue by default. Opt-in **direct writes** (publish/reply/DM) — policy-risky if flags are on. Scales “100 pages”. |
| Unofficial “Facebook Auto Pilot”, FS Poster, MultiGroupPoster | various | Groups / walls | **Do not copy.** These are the tools Meta bans Pages for using. |

### 4.3 What the market actually rewards in 2026

1. **It posts when I asked, once.** Duplicate Graph objects and silent failures destroy trust.
2. **Reels + first comment + Stories** — Feed text is table stakes.
3. **Bulk / recycle / RSS** — Publer’s wedge.
4. **Inbox that is faster than Business Suite** — Agorapulse/Sprout wedge.
5. **Analytics that recommend the next post** — Metricool wedge.
6. **Self-host / data ownership** — Postiz/Shoutrrr wedge.
7. **AI that drafts but does not auto-send** — operators are scared of inauthentic-engagement strikes.
8. **Unlimited Pages without a per-channel tax** — Buffer’s wound.

PosterPal already aims at 1, 6, 7, 8. The holes are 2 (reliability), 3, 4 (polish), 5 (insights → action).

---

## 5. Gap analysis — what we lack vs what we uniquely have

### 5.1 They have it; we do not (or we have a stub)

| Capability | Who has it | Our state | Priority to close |
| --- | --- | --- | --- |
| **Bulletproof publish/reschedule** | Meta, Buffer, Publer | Several silent bugs (§8) | **P0 — do first** |
| Recurring slots / posting queue | Buffer, SocialBee, Shoutrrr | Local scheduler is one-shot | P2 |
| Bulk CSV / 100s of posts | Publer, Meta (video) | One-at-a-time composer | P2 |
| Evergreen recycle | Publer, SocialBee | Duplicate Jaccard would *block* naive recycle — we need “remix recycle” | P3 |
| RSS → Page | Publer | None | P3 (optional) |
| First-comment on **Graph-scheduled** posts | Publer, Meta | Only when `mode === "now"` | **P0** |
| Instagram + FB from one composer | Meta, Buffer, Later | Facebook only | P4 (same Meta app, official IG Content Publishing) |
| Native mobile apps | Meta, Buffer | PWA + incomplete pairing | P3 |
| Docker one-command self-host | Postiz, Shoutrrr | `npm run dev` / Vercel | **P1** |
| Reports PDF / competitor Pages | Metricool, Sprout | CSV + heatmap only | P3 |
| Approval workflow | Planable, SocialBlast | Solo operator — skip | Never (unless multi-user is requested) |
| Watermarks | Publer | None | P3 (nice) |
| Video thumbnail picker / cover | Meta, Publer | None | P2 |
| Link-in-bio | Buffer Start Page, Later | Merch list only | P3 as “Shop block” |
| Messenger / Page DMs | Meta, SocialBlast | Comments only | P4 (Messaging API is a different review) |
| Ads + organic | Metricool | Out of scope | Never unless asked |
| Facebook Groups mass post | MultiGroupPoster | Intentionally absent | **Never** |
| `/me/accounts` paging | everyone | `graphCollect` unused — **25 Page cap** | **P0** |
| Best-time in **local TZ** | Later, Buffer | Heatmap exists; quiet-hour filter added; still UTC-ish seeds | P1 |
| A/B caption variants with winner | Buffer experiments | Three AI variants labeled, no auto-pick | P2 (human picks) |
| Media CDN / not data-URLs in Postgres | everyone serious | `content_items.data_url` in DB | P1 (disk/S3) |
| Real background worker | Postiz Temporal, Shoutrrr Octane | Browser `setInterval(tickFn, 60000)` — **desk must stay open** | **P1** |
| Device pairing that actually auths | — | Token stored, not sent on API calls | P1 |
| Windows EXE full UI | original spec | Kernel only | P6 |

### 5.2 We have it; they usually do not

These are the moat. **Do not dilute them.**

| Moat | Why it wins |
| --- | --- |
| **Policy checklist + Jaccard duplicate block** | Protects monetization from “inauthentic / spam” strikes. Recycle tools will get operators banned; we prevent it. |
| **Per-Page cadence warn/block** | Buffer will happily let you spam 40 posts. We will not. |
| **HITL comments as a product feature** | Agent refuses “reply to all”. Send is always the human. Market is terrified of auto-comments in 2026. |
| **Merch + UTM + fitness score** | Buffer schedules. We try to **sell**. Unique for bookstore/merch Pages. |
| **Practice mode** | Zero Facebook friction. Demo and training without a Dev app. |
| **Unlimited Pages, $0/channel** | Buffer’s pricing is the enemy. |
| **`appsecret_proof` + AES vault + scheduler logs** | Serious Graph hygiene. Many OSS tools skip proof. |
| **Needs you** (overdue, failed, buying-intent comments, token expiry) | Meta Suite buries this. |
| **Clone to other Pages as drafts** | Multi-Page operators’ actual workflow. |
| **Live Facebook-shaped preview** | Composer shows the Feed, not a form. |
| **AI that will not publish** | `agentWouldRefuse` is a feature, not a limitation. |
| **Self-host path + no vendor lock-in** | Tokens stay on the operator’s machine. |

### 5.3 Honest product gaps (not competitor envy)

1. **The scheduler dies if the tab is closed.** This is the #1 reason a self-host would fail vs Buffer. Fix with a real worker (§7 P1).
2. **Media in Postgres as data URLs** will melt at a few hundred photos.
3. **Pairing/APK story is half-built.** Phone cannot reach `127.0.0.1` on the PC.
4. **Insights need 100+ likes.** We already document this; UX should degrade gracefully (post-level reactions still work).
5. **Stories/Reels** Graph support exists but is the least battle-tested path.
6. **Timezone** — container is UTC; operator is America/Chicago (Winona, MN). All “best time” UI must be local.

---

## 6. How to surpass the rest (strategy, not a feature dump)

### Positioning sentence

> PosterPal is the self-hosted Facebook Pages desk that will not get you banned: official Graph only, human Send, cadence and duplicate guards, and a merch-aware composer — unlimited Pages, no per-channel tax.

### Who we beat, and how

| Competitor | Do not copy | Beat them by |
| --- | --- | --- |
| Meta Business Suite | Their chrome, their 75-day cloud lock-in | Faster composer, local drafts when Graph is down, policy, merch, Needs you, keyboard, clone, practice |
| Buffer | 12 networks, Start Page | Unlimited Pages, Facebook-native (Reels constraints, first comment, HITL inbox), $0, policy |
| Publer | Naive recycle, Groups hacks | **Safe recycle**: only if Jaccard remix + cadence allow; first-class HITL; self-host |
| Postiz / Shoutrrr | Multi-network generic composer | Facebook depth they will never have (policy, cadence, merch, comments, Graph error map) |
| SocialBlast | Opt-in auto-write flags | We **never** ship a “direct write / auto reply” flag. Drafts only. |
| Metricool | Ads + competitor spy | Actionable heatmap → one-click schedule chip on **this** Page’s history |

### The three bets

1. **Trust.** Every post goes out once, on time, or sits in Needs you with a reason. No silent LocalScheduled black holes.
2. **Facebook-native craft.** Reels rules, first comment, Stories, branded-content, alt, AI-label reminder, 10m–30d window, 100+ likes insights caveat.
3. **Monetization ops.** Merch catalog, UTM, shop-in-first-comment, fitness score, buying-intent inbox. Content is for selling books/totes/tickets, not vanity likes.

Ignore: Ads Manager, 12 networks, client approvals, listening/sentiment of the public firehose, Group bombers.

---

## 7. Rational plan (phased)

Do not skip phases. A pretty Recycle button on a duplicating scheduler makes the product worse.

### Phase 0 — Stop losing posts (this week)

Fix the silent/logic bugs in **§8**. After this, a Dev-Mode Page can: OAuth → compose photo → schedule → calendar move → inbox reply → analytics sync, with no duplicate Graph objects and no vanished rows.

Ship tests for: HMAC (exists), cadence window, reschedule-updates-not-creates, scheduler claim (`WHERE status = 'LocalScheduled'`), Graph 100 on `now` → Failed.

### Phase 1 — A desk that runs when the browser is closed

This is how we become a real Buffer alternative.

1. **Worker process** — `node scripts/worker.mjs` (or a Nitro scheduled route) calling `tickScheduler` + `syncFromGraph` + `refreshVaultTokens` every 60s. `startup.sh` starts it. Docker `command` starts it. **Status: `scripts/worker.ts` exists** (`npm run worker`; runs via tsx, resolves the single operator id from `app_settings`, refuses to start without `DATABASE_URL` — PGLite is in-process). Startup.sh starts it when `DATABASE_URL` is set. Remaining: a real Postgres to run against + Docker wiring.
2. **Docker Compose** — `web` + `worker` + `postgres` (or PGLite volume for single-node). Caddy/nginx TLS. **Status: sketch in §9.5; not implemented.**
3. **Encryption key** — require `POSTERPAL_MASTER_KEY` (or `BETTER_AUTH_SECRET`) in production; refuse to boot with the preview fallback string. **Status: done** — `crypto.ts` throws at first encrypt/decrypt when `NODE_ENV=production` and only the preview fallback is present, and `POSTERPAL_MASTER_KEY` is now honored ahead of `BETTER_AUTH_SECRET`.
4. **Media on disk/S3** — store `content_items` as files (`data/media/{user}/{id}`) not megabyte data URLs.
5. **Timezone** — persist `settings.timezone` (default `America/Chicago`), use in heatmap, quiet hours, chips, calendar.
6. **Pairing actually auths** — send `Authorization: Bearer ppd_…` **or** stop claiming revoke works. Document same-origin vs device token.
7. **`graphCollect` on `/me/accounts`**. Never null `access_token_enc` on missing token.

Deliverable: `docker compose up` on a Windows/Linux PC, HTTPS via Caddy, Facebook App Domains = that hostname, posts go out at 6am while the operator sleeps.

### Phase 2 — Facebook-native depth Buffer will not match

1. First comment on Graph-scheduled posts (post after sync promotes to Published, or keep those on local scheduler).
2. Cover/thumbnail for video + Reel.
3. Recurring weekly slots (e.g. Sat 10:00 Winona Weekend) generating **new** captions each time or requiring a remix — never identical body (Jaccard).
4. Bulk CSV **import as LocalDrafts** (not blind Graph). Columns: page, caption, when, link, merch, media path. Policy runs per row; blocks stay drafts.
5. Variant A/B: schedule two captions to the same slot window on purpose, show winner in analytics (human launched both; we do not auto-pick).
6. Composer: replace-not-append media for Photo/Video/Reel; require ≥2 for Carousel; clear media on Text.
7. Inbox: deep-link from Needs you (`?comment=` + set Page). Sending lock. Buying-intent sort already exists — surface it as a filter chip.

### Phase 3 — Operator speed + mobile

1. **PWA already exists** (Grok plugin). Add a real install path on the self-hosted origin.
2. **Capacitor Android APK** wrapping the **HTTPS origin**, not localhost (§10).
3. Safe recycle: “reshare this winner” clones to LocalDraft with a forced caption rewrite (AI) and policy re-check.
4. Watermark toggle for merch photos.
5. Analytics: “schedule this winner’s hour” already sketched — make it the default CTA on the heatmap cell.
6. Shop block page (`/shop` public) as the Buffer Start Page analog — merch links with UTM. Optional.

### Phase 4 — Adjacent official Graph (only if asked)

- Instagram Graph **Business/Creator** accounts linked to a Page. Same Meta app, extra scopes, App Review if not role-users.
- Page Messenger (separate product, 24h window, no spam). HITL only.
- Do **not** add TikTok/X/LinkedIn until Facebook is boringly reliable.

### Phase 5 — Monetization intelligence

- Attribute clicks via UTM (`utm_source=posterpal&utm_medium=fb&utm_campaign={page}&utm_content={postId}`).
- “Which caption variant sold” — merch URL in first comment vs caption vs none.
- Fitness score per **selected Page** (today it is desk-wide — bug).
- Quiet “don’t post merch more than N/day” alongside cadence.

### Phase 6 — Windows EXE (original spec)

Only after Phase 1. Options:

- **A (recommended):** WebView2 shell around the local HTTPS desk. One codebase.
- **B:** Finish WPF against PosterPal.Core + SQLite + DPAPI as originally specified. Huge duplicate UI cost.

`desktop/build.ps1` already targets self-contained `win-x64`. Expand Core with the publish/policy/oauth that already exists in TS, or skip B.

### Explicitly out of scope forever unless the law changes

- Auto-like, auto-follow, auto-share, auto-comment, auto-DM
- Buying engagement
- Scraping / cookie login / Selenium
- Mass Group posting
- Selling Page admin roles
- “AI posts while you sleep” without a queued, policy-checked, already-approved draft (scheduling approved drafts is fine; generating **and** sending unsupervised is not)

---

## 8. Known bugs to fix first (audit 2026-08-21)

Ranked by user-visible damage. **Do these before Recycle buttons.**

### Status sweep 2026-08-21 (this session, after the last 36 commits)

Verified against the live tree AND the running app (`npm run dev` on `:8080`, practice Pages):

- **1–5 (Critical): all fixed in tree.** Graph-100 fallback is gated on `mode==="schedule"` + `/schedul/i` (`publish.ts`); `rescheduleFn` → `ops.reschedule` which PATCHes `scheduled_publish_time` / DELETE+local; token wipe uses `coalesce` (`facebook-oauth.ts`); `tickScheduler` claims with `WHERE status='LocalScheduled' RETURNING` and `graphFetch` never retries POST after timeout; writes (`compose`/`saveAndDispatch`) use the raw `pageId` and throw "Page not found".
- **6–10 (High): all fixed in tree.** Sync status CASE promotes `FacebookScheduled`/`LocalScheduled` → `Published` and fires the pending first comment on promotion (`sync.ts`); cadence counts posts *going out* in 24h (`repo.cadenceForPage`); video/Reel ids resolved to `post_id` post-publish + sync matches `{page}_{id}`; `/me/accounts` uses `graphCollect` (25-Page cap gone); composer has a `busy` guard + Ctrl+Enter handler.
- **11–21, 23–27, 29 (Medium): fixed in tree or acceptable as designed** (insights failure is per-post `continue`, stuck-`Publishing` fails after 2m, `Publishing` no longer a black hole, token refresh only stamps on 190, `publishExisting` runs policy, library reuse preserves `created_with_ai`, inbox has a `sending` lock, `tickFn` toasts errors, calendar sets `dataTransfer`, home/analytics have error states, settings have `.catch` + live-origin hints).
- **Fixed in this session:** #13 (Later cards no longer resurrect — `ensureMemory` seeds once via `memory_seeded_once`), #22 (Needs-you Inbox deep-links to `?comment=&page=` and selects the exact comment + Page), #30 (fitness is per-Page: `buildPageMetrics` in `ops.ts`, `HomeSnapshot.pageMetrics`).
- **Still open / by design:** #15 (carousel proceeds with the slides that uploaded — only all-fail throws), #28 (pairing token not yet sent on API calls — Phase 1), #14 (invalidated-on-190 is intentional), #24/#25 (extra files in Photo mode are UI-level; compose reports per-Page failures in the toast).
- **New fixes this session (not in the audit):** npm scripts were **broken on Windows** (`VITE_AUTH_ENABLED=…` env syntax → `cross-env` added); `npm test` found **0 tests on Windows** (quoted glob → unquoted + `tsx` runner); `scripts/worker.ts` (Phase 1 worker, refuses without `DATABASE_URL`); `crypto.ts` refuses the preview fallback key when `NODE_ENV=production`; analytics A/B "Leading variant" no longer renders an empty label.

Regression tests: `scripts/phase0.test.mjs` (graph error map, schedule window, feed payload shapes, per-Page fitness). `npm test` = 66 tests, 59 pass (the 7 fails are the pre-existing `grok-pwa-plugin.test.mjs` platform tests — §13.6).

### Critical

1. **Graph error 100 on Publish now → `LocalScheduled` with no time**  
   [`publish.ts`](src/lib/posterpal/publish.ts) treats `invalid_param` like a schedule miss. `tickScheduler` never retries (no `scheduled_publish_time`). Needs you never sees it. Post vanishes.  
   **Fix:** only fall back when `mode === "schedule"` **and** the message is about scheduling. Else `failPost`.

2. **Calendar reschedule creates a second Facebook post**  
   [`reschedule.ts`](src/lib/posterpal/reschedule.ts) POSTs a new Graph object. [`ops.reschedule`](src/lib/posterpal/ops.ts) already PATCHes `scheduled_publish_time` or DELETE+local. Wire `rescheduleFn` to `ops.reschedule`. Verify `fns.ts` if it was partially switched.

3. **Page token wiped to null** when `/me/accounts` omits `access_token`  
   [`facebook-oauth.ts`](src/lib/posterpal/facebook-oauth.ts). Next publish: “Reconnect Facebook”.  
   **Fix:** keep existing `access_token_enc` if Graph omitted it. Don’t flip `is_read_only` unless `tasks` is present.

4. **Duplicate Graph publishes**  
   Scheduler selects then updates without claiming (`WHERE status = 'LocalScheduled' RETURNING`). `graphFetch` retries POST after timeout. Two ticks → two posts.  
   **Fix:** atomic claim; never retry POST after abort/timeout.

5. **`composeFn` remaps missing `pageId` to first Page alphabetically**  
   [`page-id.ts`](src/lib/posterpal/page-id.ts). Caption for Winona Weekend goes out on North Shore Books.  
   **Fix:** writes **throw** “Page not found”. Reads may remap.

### High

6. Facebook-scheduled never becomes `Published` on sync (`FacebookScheduled` not in the status CASE). First comment never fires on Graph-schedule (`mode !== "now"`).
7. Cadence counts posts **created** in 24h, not **going out** in 24h — future schedules burn today’s cap.
8. Video/Reel ids (`video_id`) ≠ `/published_posts` id (`pageId_postId`) → duplicate desk rows, insights on the clone.
9. `/me/accounts` not paged — silent 25-Page cap. `graphCollect` exists unused.
10. Composer Ctrl+Enter double-submit; no `busy` guard.

### Medium (still real)

11. Insights error aborts the rest of that Page’s comment sync.
12. `Publishing` is a black hole if the process dies.
13. Deleted Later cards resurrect (`ensureMemory` reseeds when count=0).
14. Token refresh stamps `last_validated_at` on **failure** → 6h blindness.
15. Carousel drops failed slides and still “succeeds”.
16. `scheduled_publish_time` NaN → unpublished draft recorded as `FacebookScheduled`.
17. Firefox calendar drag needs `dataTransfer.setData`.
18. Home error = infinite skeleton (`!data`).
19. Analytics error shows zeros / previous Page.
20. Settings Facebook-domain help hydrates wrong origin.
21. Settings seed/save missing `.catch`; seed doesn’t reload rail.
22. Needs you Inbox button ignores comment id + Page.
23. Publish-now from Drafts/inspector skips policy.
24. Multi-page compose extras fail but form clears.
25. Extra files in Photo mode never posted.
26. Library reuse hardcodes `createdWithAi: false`.
27. Inbox Send no in-flight lock.
28. Pairing token unused.
29. `tickFn` failures swallowed in app-shell.
30. Monetization fitness is desk-wide, labeled as the selected Page.

When you fix one, add a regression test in `scripts/` or a small unit file next to the module. Do not “fix” by deleting logs.

---

## 9. Self-host permanently on a desktop PC

The operator is on **Windows 10/11** (Winona, MN). The Grok preview host is **not** a forever URL. Facebook Login is bound to **one** App Domains / Site URL / Redirect URI set.

### 9.1 Recommended architecture

```
[Windows PC, always on]
  Caddy (HTTPS, :443)  →  PosterPal node (Vite preview or `node .output/server/index.mjs`)
                       →  worker (tick + sync)
  Postgres (Docker) or PGLite volume
  data/media  (photos)
  .env  (secrets — never commit)
```

A phone / APK talks to `https://posterpal.yourdomain` (or a Tailscale/Cloudflare Tunnel hostname). It **cannot** use `127.0.0.1` on the PC.

### 9.2 Option A — Cloudflare Tunnel (easiest HTTPS, no router port-forward)

1. Install Node 22 LTS + Git.
2. Clone this repo.
3. Copy env:

```
DATABASE_URL=postgres://posterpal:posterpal@127.0.0.1:5432/posterpal
BETTER_AUTH_SECRET=<32+ random bytes>
POSTERPAL_MASTER_KEY=<same or another 32+ bytes>
XAI_API_KEY=<optional, for Grok captions>
# OpenAI / Gemini / DeepSeek / fal optional
VITE_AUTH_ENABLED=false
PORT=8080
HOST=0.0.0.0
```

4. `docker compose up -d postgres` (you will add this compose file in Phase 1) or install Postgres.
5. `npm ci && npm run build && node scripts/migrate.mjs`
6. Run web + worker as a **Windows service** (NSSM or Task Scheduler on logon).
7. Install `cloudflared`, create a tunnel to `http://127.0.0.1:8080`, pick a hostname `https://desk.example.com`.
8. In Facebook App:
   - App Domains: `desk.example.com`
   - Site URL: `https://desk.example.com/`
   - Valid OAuth Redirect URI: `https://desk.example.com/api/facebook/callback`
9. PosterPal Settings → paste App ID + App Secret → Connect.

Keep the PC from sleeping (Power Options → never sleep when plugged in).

### 9.3 Option B — LAN only (no public HTTPS)

Facebook **Web OAuth will not like a raw `192.168.x.x`**. Use:

- `http://127.0.0.1:8080` **on the PC browser only**, leave App Domains **empty**, Redirect URI `http://127.0.0.1:8080/api/facebook/callback` (localhost exception).
- Phone: use **pairing** against that origin only if you port-forward + HTTPS, **or** just use the PC.

This is fine for a single-machine desk. It is **not** an APK story.

### 9.4 Option C — Vercel / Grok publish

`npm run build` already emits Nitro `preset: "vercel"`. Platform injects `DATABASE_URL`. Then put **that** hostname in the Facebook App. Easiest public URL; tokens live in Neon, not on the PC. Encryption key must be stable across deploys or the vault becomes unreadable.

### 9.5 Docker Compose sketch (to implement in Phase 1)

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: posterpal
      POSTGRES_PASSWORD: posterpal
      POSTGRES_DB: posterpal
    volumes: [pgdata:/var/lib/postgresql/data]
  web:
    build: .
    env_file: .env
    ports: ["8080:8080"]
    depends_on: [db]
  worker:
    build: .
    command: node scripts/worker.mjs
    env_file: .env
    depends_on: [db]
volumes:
  pgdata:
```

Dockerfile: Node 22, `npm ci`, `npm run build`, `CMD node .output/server/index.mjs` (confirm Nitro output path after first production build).

### 9.6 Backup

- Postgres dump daily.
- `data/media`.
- **Do not backup App Secret in git.** Backup `.env` in a password manager.

If `BETTER_AUTH_SECRET` / master key changes, every `*_enc` column is garbage. Treat the key like DPAPI.

---

## 10. Android APK from GitHub

### Reality check

This app is a **server-rendered / server-function** TanStack Start app. A phone cannot run Graph with `appsecret_proof` using the App Secret in the APK (that would leak the secret). The APK must be a **client of the self-hosted HTTPS desk**.

```
Phone APK  --HTTPS-->  your PosterPal server  --appsecret_proof-->  graph.facebook.com
```

Never put App Secret, long-lived user tokens, or `POSTERPAL_MASTER_KEY` in the APK.

### Path A — PWA (do this first, 1 hour)

The repo already has Grok PWA chrome (`public/__grok/`, `grokPwaPlugin`). On the **self-hosted HTTPS origin**:

1. Open the desk in Chrome on Android.
2. Add to Home Screen.
3. It looks like an app. Facebook OAuth works because the origin is the same as App Domains.

This is the correct v1 “install on my phone”.

### Path B — Capacitor APK (real downloadable APK)

1. Self-host on HTTPS (Cloudflare Tunnel or VPS). Capacitor OAuth **does not work** with custom schemes for Facebook Login; it wants HTTPS App Links.
2. Add Capacitor:

```bash
npm i @capacitor/core @capacitor/cli @capacitor/android
npx cap init PosterPal com.posterpal.desk --web-dir dist
npx cap add android
```

3. **Do not** ship a disconnected static SPA that calls Graph. Point the WebView at `https://desk.example.com` (`server.url` in `capacitor.config.json`) **or** build a thin shell that only loads that origin.
4. Facebook Developer Console → Add Android platform:
   - Package name `com.posterpal.desk`
   - Key hashes from your release keystore (`keytool -exportcert | openssl sha1`)
   - Development key hash for debug
5. GitHub Actions (`windows-latest` or `ubuntu-latest` + Android SDK):

```yaml
# sketch
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with: { node-version: "22" }
- run: npm ci && npx cap sync android
- run: ./gradlew assembleRelease
  working-directory: android
- uses: actions/upload-artifact@v4
  with: { name: PosterPal.apk, path: android/app/build/outputs/apk/release/*.apk }
```

6. Operator downloads the artifact (or a GitHub Release), enables “Install unknown apps”, installs, opens, **logs into the same desk origin**, pastes nothing into the APK.
7. Pairing: Settings → Pair device → enter code. After Phase 1 the bearer token is actually sent.

### Path C — “offline APK with API keys on the phone”

**Do not.** Facebook App Secret on a phone is a leaked secret. Graph `appsecret_proof` requires it. Keep secrets on the PC/server.

### Sideloading notes

- Play Store is optional and painful (policy, Facebook login review). Sideload from GitHub Releases is enough for a personal desk.
- The APK will break if the tunnel hostname changes — same as Facebook App Domains.

---

## 11. What it needs to connect to Facebook

Follow [`SETUP.md`](SETUP.md). Condensed here so this file stands alone.

### 11.1 Create the Meta app

1. [developers.facebook.com](https://developers.facebook.com) → Create App.
2. Type that supports **Facebook Login**.
3. **Display name: PosterPal** (or PageDesk, ShoreDesk, DeskPages, WinonaDesk).  
   **Illegal:** Book, Face, FB, Facebook, Meta, Instagram, WhatsApp, Oculus, or anything that reads as a Facebook reference. BookBoss was rejected. The live checker is [`facebook-names.ts`](src/lib/posterpal/facebook-names.ts).
4. Add product **Facebook Login**.
5. Enable **Client OAuth Login** and **Web OAuth Login**.
6. Valid OAuth Redirect URIs (exact, with trailing path):
   - Web: `https://<your-host>/api/facebook/callback`
   - Local PC browser: `http://127.0.0.1:8080/api/facebook/callback` (if you run that origin)
   - Windows WPF kernel (if compiled): `http://127.0.0.1:55443/callback/` **exact**
7. App Domains: hostname only, no `https://`. Facebook **rejects `127.0.0.1` here** — leave empty for localhost.
8. Website Site URL: `https://<your-host>/`
9. **Keep Development Mode.** Add the operator as Admin, Developer, or Tester.
10. **App Review is not required** if only those role users use the desk. Going Live needs privacy policy, icon, purpose, and review for each permission used on users who are not role users.

### 11.2 Permissions (role users, no review)

```
pages_show_list
pages_read_engagement
pages_manage_posts
pages_manage_engagement
pages_read_user_content
pages_manage_metadata
read_insights
publish_video
```

Page tokens from `GET /v26.0/me/accounts`. Publish requires Page task **CREATE_CONTENT**. Analyze-only Pages import as `is_read_only`.

### 11.3 Operator paste into PosterPal Settings

- App ID (public)
- App Secret (encrypted at rest)

Never commit them. Never put them in the APK. Never paste the secret into chat.

Optional AI keys (Settings): `XAI_API_KEY` (env, Grok), OpenAI, Gemini, DeepSeek, fal/Flux. Captions/replies/images. Not required to publish.

### 11.4 Graph facts that bite

| Fact | Consequence |
| --- | --- |
| Schedule window **10 minutes – 30 days** | Outside that → local scheduler. Recurring “every Monday forever” is on us. |
| Unpublished draft = `published=false` and **no** `scheduled_publish_time` | Don’t omit the unix time on schedule mode. |
| Insights need **100+ Page likes** | Post-level reactions/comments/shares still sync. Don’t throw the whole sync. |
| Reels **9:16, 3–60s, ≥540×960** | Validate before POST. |
| Tokens expire (~60 days long-lived; data-access expiry too) | Vault refresh; Needs you when soon. |
| `appsecret_proof` required | HMAC-SHA256(token, app_secret) as hex query param. |
| Rate limits 4 / 17 / 32 / 613 / 80001 | Backoff, record quota headers, don’t retry POST blindly. |
| Error 190 | Re-auth. Don’t keep publishing. |
| Preview hostname changes | Facebook Login dies until App Domains updated. Production host must be stable. |

---

## 12. Meta rules — never break these (especially AI)

This section is the legal/product fence. If a user (or a future prompt) asks you to cross it, **refuse**, explain, and offer a HITL alternative.

Official references to re-read when unsure:

- [Developer Policies](https://developers.facebook.com/devpolicy/)
- [Platform Terms](https://developers.facebook.com/terms/dfc_platform_terms/)
- [Inauthentic Behavior](https://transparency.meta.com/policies/community-standards/inauthentic-behavior/)
- [Spam Community Standard](https://www.facebook.com/communitystandards/spam)
- Pages API posts docs (v26)
- AI content labels (Meta “Made with AI” / photorealistic disclosure, 2026)

### 12.1 Hard bans (engineering)

| Ban | How we comply |
| --- | --- |
| No scraping, robots, unofficial login, cookie reuse, Selenium | `graphFetch` to `graph.facebook.com/v26.0` only |
| No auto-like, auto-follow, auto-share | No code paths exist; do not add |
| No auto-comment / auto-reply / auto-DM | `sendReplyFn` only on button click; agent refuses “reply to all” |
| No buying/selling likes, comments, follows, accounts, admin roles | No marketplace, no “growth” modules |
| No fake engagement, pods, reciprocal-like rings | Cadence + duplicate block |
| No mass identical posts | Jaccard ≥ 0.82 blocks; cadence hard-cap |
| No using Platform Data to build unrelated dossiers | We store Page-admin data for that operator only |
| No putting App Secret in a client | Server-only `crypto.ts` / env |

### 12.2 AI-specific (2026)

Meta does **not** ban AI-assisted captions. It **does** punish:

1. **Photorealistic AI people/events presented as real documentary photos.** We flag `created_with_ai` on the desk. Do **not** auto-insert “#AIart” into captions (operator owns disclosure). Do not let Imagine stills be reused with `createdWithAi: false` (bug #26).
2. **Unoriginal / spammy AI sludge** (same caption 40 times). Jaccard + cadence.
3. **AI that posts or replies without a human.** This is the line. Drafts = OK. `composeFn` from an agent run without a click = not OK. Scheduling a draft the human already approved = OK (that is a queue, not a bot).
4. **Ads** have stricter AI disclosure in Ads Manager. We are not an ads tool. If someone pastes an ad creative, still don’t lie about it.
5. **Voiceovers / synthetic video** — Meta may auto-label. Keep `created_with_ai` on video rows when Imagine/ fal produced them.
6. **Do not strip watermarks** or claim Grok/Flux output is a camera photo of a real Winona event.

`agent.ts` system prompt already encodes this. Keep it. Extend `agentWouldRefuse` if new jailbreaks appear (`post this now`, `send all replies`, `go live without me`).

### 12.3 What *is* allowed (so you don’t over-refuse)

- Scheduling posts the operator wrote or edited, via Graph `scheduled_publish_time` or local tick.
- AI **caption variants**, hashtags (max 3), alt-text suggestions, reply **drafts**.
- Hiding a comment because the operator clicked Hide (`pages_manage_engagement`).
- Pulling comments and insights for Pages they admin.
- Cloning a post to another Page as a **draft** they still send.
- Practice mode with zero Graph.

### 12.4 App Review vs Development Mode

| Mode | Who can use the app | Review |
| --- | --- | --- |
| Development | Admins, Developers, Testers of the Meta app | Not required |
| Live | Any Facebook user | Required: privacy policy URL, icon, purpose, screencast per permission |

For a personal desk, **stay in Development Mode** and add the operator as Admin. That is the intended setup.

If they ever invite a second person who is not a role user, you must go through App Review. Until then, do not “go Live” for fun — Live without review **strips** unapproved permissions.

### 12.5 Inauthentic engagement — why cadence exists

In 2026, Page monetization is routinely suspended for “inauthentic engagement”: identical posts, engagement bait, sudden like spikes, bot comments. Our cadence (warn 8 / block 20) and duplicate Jaccard are **not** UX nannying. They are how this desk keeps Pages eligible for stars/in-stream ads.

If an operator asks to raise the hard cap to 200, warn them in UI copy, but do not remove the guard.

---

## 13. Other things (the forgotten list)

### 13.1 Naming

Never rename the Facebook App back to BookBoss. Never put “Facebook” in the app icon. Never use the Meta logo as our mark.

### 13.2 Encryption footgun

[`crypto.ts`](src/lib/posterpal/crypto.ts) falls back to `"posterpal-preview-entropy-not-a-secret"` when no env secret exists. Fine in this Grok preview. **Fatal in production** if two processes use different keys, or if the fallback is used on a public host. Phase 1 must refuse boot without a real key.

### 13.3 Auth is off on purpose

`VITE_AUTH_ENABLED=false`. Do not “fix” this by turning Google login on unless the operator asks for a multi-user desk. `authMiddleware` still runs and supplies a stable `userId` for the single operator.

### 13.4 Grok / preview chrome

Do not remove `PreviewHostBridge`, `grokPwaPlugin`, or `server/middleware/grok-pwa.ts`. Platform rules. Custom OG: `public/og.jpg` exists.

### 13.5 Duplicate helper files

`desk.ts` and `operator.ts` overlap (captionStats, quiet hours, golden hour). Prefer `operator.ts`. Consolidate; don’t fork a third.

`reschedule.ts` vs `ops.reschedule` — one must die.

### 13.6 Tests that already fail

`scripts/grok-pwa-plugin.test.mjs` has been a pre-existing platform test. Do not burn a day on it unless you touched that plugin. HMAC tests must stay green.

### 13.7 Timezone

Operator: America/Chicago. Sandbox: UTC. Never display raw UTC hours as “best time” chips. `topSlots` already drops quiet hours; still persist a TZ.

### 13.8 Media / Stories / Reels

Stories expire on Facebook in 24h — don’t treat them like Feed posts in analytics windows. Reels use rupload; large files as data URLs will OOM. Phase 1 file store.

### 13.9 Windows WPF original spec leftovers

`LOOPBACK_REDIRECT = http://127.0.0.1:55443/callback/` in constants. Keep it. If you revive WPF, do not pick a random port.

### 13.10 What “unlimited Pages” means

Unlimited **in our DB**. Facebook `/me/accounts` default page size is ~25 — we must `graphCollect`. Graph rate limits still apply (quota_snapshots). Cadence is per Page, not global.

### 13.11 Monetization without being skeezy

Allowed: merch URLs, UTM, `#ad`, first-comment shop link, fitness score, “this post needs a CTA”.

Not allowed: fake scarcity, fake testimonials, engagement bait (“like if you agree” farms), misleading AI product photos of real goods you don’t have.

### 13.12 When Graph is down

Local drafts + local scheduler must remain fully usable. Practice Pages prove the UI. Never block the composer on Facebook being connected.

---

## 14. Tips for the next AI agent

1. **Read the file you will edit.** Several bugs came from a second implementation (`reschedule.ts`) shadowing the correct one (`ops.reschedule`). Grep for callers.
2. **Do not overwrite whole files with empty `old_string`.** Use unique 1–2 line anchors. If you blow a file, `git checkout -- path`.
3. **Writes must not remap Page ids.** Reads can.
4. **Never empty-catch Graph.** `tickFn().catch(() => undefined)` in app-shell is a known sin.
5. **Policy on every Graph write**, including Drafts “Publish now” and inspector.
6. **Busy/in-flight locks** on Compose, Send, Hide, Clone.
7. **Keep practice seed from polluting cadence.** `ensureOverduePractice` must not insert 180 polaroids. Seed once; never re-seed deleted Later cards.
8. **Inspector store is separate** from persisted zustand. Don’t merge it back.
9. **Verify with Playwright** against `http://127.0.0.1:8080`, screenshots in `/workspace/screenshots/`. Click actual buttons; don’t trust curl 200.
10. **Typecheck + build** before you declare victory. Nitro/Vercel is the deploy target.
11. **If asked for auto-engagement**, refuse and point here.
12. **Small diffs.** Three similar lines beat a premature `utils/` god file. Don’t add a new framework.
13. **Facebook hostname is the production constraint.** If OAuth fails, it is almost always App Domains / Redirect URI mismatch, not our fetch wrapper.
14. **Prefer extending `ops.ts` + `fns.ts` + a route** over a new microservice.
15. **Worker before APK.** A phone hitting a desk that only ticks in an open laptop tab will miss every 6am slot.

---

## 15. Suggested first week (if you only do one sprint)

| Day | Work |
| --- | --- |
| 1 | §8 criticals 1–5 (error 100, reschedule, token wipe, scheduler claim, page-id throw) |
| 2 | §8 high 6–10 (sync status, first comment, cadence window, video id, graphCollect, Ctrl+Enter) |
| 3 | Tests for those paths + typecheck/build/Playwright compose→calendar→inbox |
| 4 | Phase 1 worker script + `startup.sh` starts it + encryption key required in non-preview |
| 5 | Docker Compose + a SELFHOST.md section in README (keep this file as strategy) |
| Later | Recurring slots, CSV drafts, Capacitor, IG — only after a real Page survives overnight |

If the operator says “make it surpass Buffer this weekend”, you still start at Day 1. A competitor comparison is not a license to skip the black-hole scheduler.

---

## 16. Quick “where is X?” index

| I want to… | Go here |
| --- | --- |
| Change how a post hits Graph | `src/lib/posterpal/publish.ts` |
| Change OAuth / Page import | `src/lib/posterpal/facebook-oauth.ts` |
| Change policy | `src/lib/posterpal/policy.ts` |
| Add a server endpoint | `ops.ts` then `fns.ts` then a route |
| Change composer UI | `src/routes/composer.tsx` + `facebook-preview.tsx` |
| Change inbox HITL | `src/routes/inbox.tsx` + `ops.sendReply` |
| Change Needs you | `src/lib/posterpal/devices.ts` + `needs-you.tsx` |
| Change fitness / heatmap | `src/lib/posterpal/operator.ts` |
| Change AI / agent refusals | `ai.ts`, `agent.ts`, `research.ts` |
| Change schema | new `migrations/0006_*.sql` — never edit 0001 |
| Change scopes / version | `constants.ts` |
| Windows HMAC | `desktop/PosterPal.Core/Graph/AppSecretProof.cs` |
| Facebook setup copy | `SETUP.md` + Settings UI |
| Deep research / Page topics | `src/lib/posterpal/research.ts` + `agent.ts` + `src/routes/agent.tsx` |

---

## 17. Desk research agent — how it works, how to extend it

This is the portion of the product an AI agent (you) must protect and grow. It lives on the **Agent** tab (`/agent`). It is a **research desk**, not a poster.

### 17.1 How serious research agents actually work (what we copied)

OpenAI Deep Research, Firecrawl Agent, Temporal research pipelines, and academic “deep research” tools all share the same loop. They do **not** dump a prompt into one chat completion and hope:

| Step | Industry pattern | PosterPal |
| --- | --- | --- |
| 1. Scope | Decompose the question; name the audience | **Page profile** from desk data: name, category, brand voice, merch, last captions, inferred locale (e.g. Winona, MN) |
| 2. Plan | 3–7 search queries, source types, success criteria | `planSearchQueries()` — brief + locale + year + topic + merch |
| 3. Retrieve | Web search / browse in parallel; citations | xAI `search_parameters.mode=on` + `tools: web_search`. **Excluded:** facebook.com, instagram.com, threads.net |
| 4. Note | Structured notes, verified vs unverified | `notes[]` with `confidence`, plus a prose `summary` |
| 5. Synthesize | Report with citations | 3 caption variants in Page voice (`generateCaptionVariants`) |
| 6. Human | Analyst reads the report | **HITL:** Open in Composer / Save to Later. Agent **refuses** publish/reply/like |

We do **not** run a 10-minute multi-hop browser agent. Spend: **one live-search call + one caption call**, user-initiated. That is enough for a Page operator and it does not burn the owner’s `XAI_API_KEY` on visitor page-loads.

### 17.2 What the Agent is allowed to know about “my Facebook Pages”

**Allowed (already in our DB, filled by Graph when the operator connected, or by practice seed):**

- Page name, category, brand voice, cadence caps
- Recent captions the desk already stored
- Merch titles/URLs the operator added
- Comments imported via Graph (`pages_read_user_content`) — do not use these as “web sources”; they are inbox data

**Forbidden:**

- Scraping facebook.com / m.facebook.com / Graph without a Page token
- Using Selenium or cookie reuse to “read the Page as a visitor”
- Inferring topics by crawling other people’s Pages
- Posting the research, auto-replying to comments found during research, or “going live” with an angle

Page **purpose** is inferred locally:

```
first sentence of brand_voice
+ category
+ top tokens from recent captions (stop-worded)
+ merch titles
+ “Content exists to serve that audience and, when honest, to sell — not to farm engagement.”
```

See `inferPagePurpose` / `extractTopics` / `inferLocale` in [`research.ts`](src/lib/posterpal/research.ts).

### 17.3 Code map (Agent)

| File | Job |
| --- | --- |
| [`src/lib/posterpal/research.ts`](src/lib/posterpal/research.ts) | Profile, query plan, JSON parse, user prompt, locale/topics. **No I/O except repo reads.** |
| [`src/lib/posterpal/agent.ts`](src/lib/posterpal/agent.ts) | Refuse regex, live search via xAI, persist `agent_runs`, caption variants |
| [`src/lib/posterpal/ai.ts`](src/lib/posterpal/ai.ts) | Grok/OpenAI/Gemini/DeepSeek chat; Imagine stills |
| [`src/routes/agent.tsx`](src/routes/agent.tsx) | Purpose card, topic chips, suggested briefs, Map this Page, notes, captions |
| [`src/lib/posterpal/fns.ts`](src/lib/posterpal/fns.ts) | `runAgentFn` (`mapPage?`), `pageProfileFn`, `listAgentRunsFn` |
| [`migrations/0005_agent.sql`](migrations/0005_agent.sql) | `agent_runs` — extra research fields packed into `drafts_json` |
| [`scripts/research.test.mjs`](scripts/research.test.mjs) | Query planner / JSON parse / locale |

`drafts_json` shape (backward compatible with old runs that only had captions):

```json
{
  "storytelling": "...",
  "cta": "...",
  "question": "...",
  "topics": ["river", "story"],
  "queries": ["farmers market hours Winona 2026"],
  "notes": [{"heading":"Hours","body":"...","url":"https://...","confidence":"verified"}],
  "pagePurpose": "..."
}
```

### 17.4 Live search API (xAI)

Try **both** shapes; Facebook-domain exclusions on both. First match that returns content wins.

```json
{
  "model": "grok-4.5",
  "search_parameters": {
    "mode": "on",
    "return_citations": true,
    "max_search_results": 8,
    "sources": [
      { "type": "web", "excluded_websites": ["facebook.com", "instagram.com", "threads.net"] },
      { "type": "news" }
    ]
  }
}
```

Fallback:

```json
{ "tools": [{ "type": "web_search", "filters": { "excluded_domains": ["facebook.com"] } }] }
```

If `XAI_API_KEY` is missing: still show the **query plan + Page purpose + unverified notes from desk topics**. Never fake citations. Toast: “Drafted without live search — verify facts.”

### 17.5 UI contract (Agent tab)

Must always show, when a Page is selected:

1. **This Page’s purpose** — one paragraph + locale
2. **Topic chips** — click fills a brief (`Research {topic} for {page}`)
3. **Suggested briefs** — from `suggestedBriefs(profile)`
4. **Map this Page** — `runAgentFn({ mapPage: true })` — no operator brief required
5. After a run: queries, topics, sourced notes (`verified` / `unverified`), summary, 3 captions, still prompt
6. Actions: Open in Composer, Generate still (flags `createdWithAi: true`), Save to Later
7. Refuse banner if the brief asked to auto-post/reply

Double-submit is locked (`runLock` ref). Imagine has its own busy flag so a still request cannot double-fire a research run.

### 17.6 Plan to deepen research (do in this order)

| # | Work | Why | Watch-outs |
| --- | --- | --- | --- |
| R1 | Keep HITL + refuse regex as tests grow | One jailbreak (“post this now”) and we become the bot Meta bans | Add phrases to `REFUSE_RE`, not exceptions |
| R2 | Persist a `page_topics` setting the operator can edit | Inferred tokens (“saturday” was a bug — we stop-word it) are noisy. Let them pin “story hour, river, local authors” | Store in `app_settings` per Page; profile should prefer pins over inferred |
| R3 | Second-pass **only when the operator clicks “Dig deeper”** | True deep research (browse 8 URLs, extract) costs more. Gate it. | Cap `max_search_results` at 8; no loops; one extra LLM call |
| R4 | Attach a winning **past caption** as a negative example (“don’t repeat this Jaccard twin”) | Uses policy.jaccard so research doesn’t propose near-duplicates | Pull last 30 messages; if Jaccard ≥ 0.55, tell the model to change the angle |
| R5 | Locale is a setting, not just regex | Winona is in the seed voice; live Pages may not say the city | `settings.timezone` + `settings.locale` in Phase 1 |
| R6 | Use imported Graph comments as **inbox intent**, not as web sources | “People keep asking about hours” is gold for a brief | Never quote a commenter’s name in a caption without need |
| R7 | Optional: xAI `from_date` last 14 days for “today’s angle” | Freshness | Don’t date-filter evergreen merch restocks |
| R8 | Never add an “auto-post best angle at 9am” toggle | That is unsupervised publishing | Queue as LocalDraft if they want a morning slot — human already approved the caption |

### 17.7 Tests an agent must not break

```
npm test   # includes scripts/research.test.mjs and hmac.test.mjs
npm run typecheck
```

Research tests cover: Winona locale, topic stop-words, distinct queries, purpose sentence, JSON notes parse.

### 17.8 Prompting tips for *this* agent (the human in Grok chat)

When the operator says “research my Pages”:

1. Select a Page (rail). Open **Agent**.
2. Click **Map this Page** first — that writes purpose + topics + 3 angles without a custom brief.
3. Click a topic chip or a suggested brief, then **Research & draft**.
4. Read notes. Anything `unverified` gets checked by the operator.
5. Open in Composer → policy checklist → they click Publish.

When *you* (coding agent) are asked to “make the agent smarter”: extend `research.ts` (profile/queries/notes) before adding LLM calls. A better query beats a longer prompt.

---

*PosterPal — compose, schedule, moderate, analyze, monetize. Official Graph v26.0. A human clicks Send.*

