# PosterPal architecture

**Last verified against the live tree:** 2026-09-01 (seventh pass: full-agency Agent health + offline diagnose, Graph-ahead CAS, recycle UUID, timezone heatmap, Reels 3–90s / 30-per-24h, RSS remix)  
**Root:** this repo (`posterpal/`)  
**Product surface:** TanStack Start web desk + Electron Windows shell + Capacitor Android WebView of the same desk.

This file is the **anatomy map for humans and coding agents**. Read it before editing. After you add a route, server function, migration, worker job, or runtime, **update this file in the same change** (see [Keeping this file current](#keeping-this-file-current)).

Companion docs:

| File | Role |
| --- | --- |
| [`README.md`](README.md) | What the product is, current status, how to run it |
| [`SETUP.md`](SETUP.md) | Facebook App, Graph facts, Docker self-host |
| [`Surpass.md`](Surpass.md) | Historical strategy bible (partially stale — trust this file + README for *what exists now*) |
| [`fullagencyplan.md`](fullagencyplan.md) | Desk-agent awareness plan (Phases 1–2 landed; Phase 3 recorded after this pass) |

---

## 0. How an agent should use this file

1. **Product laws** (§1) are not optional. Do not add auto-publish, auto-reply, scraping, or a second architecture.
2. **Change X → go here** (§16) is the fastest path to the right file.
3. **Domain library** `src/lib/posterpal/` is the product. UI in `src/routes/` is thin. Prefer extending `ops.ts` → `fns.ts` → a route over a new service.
4. Writes must **not** silently remap a missing Page id onto `pages[0]`. `saveAndDispatch` / `getPage` throw `"Page not found"`. `resolvePageId(userId)` with **no** id still remaps **reads** to `pages[0]`; a **stale provided** id returns `undefined` (does not remap).
5. After a change: `npm run typecheck`. Graph paths must log failures (`deskLog` / `scheduler_logs`). Never empty-catch Graph.
6. Preview / Electron bind **`0.0.0.0:8080`**. Do not delete Grok PWA chrome (`scripts/grok-pwa-*`, `server/middleware/grok-pwa.ts`, `PreviewHostBridge`).

---

## 1. What this is (and is not)

**PosterPal** is a **single-operator Facebook Pages content-ops CRM**. One human administers one or many Pages (bookstore, events, merch, local brands). Facebook is optional: **practice mode** seeds 10 unique Pages so the desk works with zero Graph.

It is **not** a social network, engagement bot, ads manager, Group mass-poster, or 12-network agency SaaS.

### Non-negotiable laws

| Law | Code location |
| --- | --- |
| Official Graph **v26.0** over HTTPS only | `src/lib/posterpal/constants.ts` `GRAPH_VERSION` |
| Human-in-the-loop: AI drafts, human Send | `sendReplyFn`, `agentWouldRefuse` in `agent.ts` |
| No auto-like / auto-comment / auto-follow / auto-share | No code paths. Do not add. |
| Cadence warn 8 / block 20 per Page (configurable) | `cadenceLevel` in `policy.ts` + `repo.cadenceForPage` — count is Published last 24h + Publishing last 24h + scheduled in **[-24h, +24h]** |
| Jaccard duplicate block (≥0.82) including **cross-Page** | `policy.ts` `runPolicyChecklist` — flags `duplicate` / `cross-page-duplicate`; remix drafts also `remix-required` |
| Failures never silent | `publish.ts`, `log.ts` `deskLog`, `scheduler_logs` |
| Tokens AES-256-GCM at rest | `crypto.ts`; Electron writes `%APPDATA%\PosterPal\master.key` |
| Product name **PosterPal** (never BookBoss / Face / FB / Meta) | `facebook-names.ts` |
| Practice mode stays usable with Graph down | `seed.ts`, `fleet.ts` |

---

## 2. Runtime topology

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Operator machine (Windows 10/11 typical)                                │
│                                                                         │
│  PosterPal.bat / npm run desktop / release/PosterPal.exe                │
│       │                                                                 │
│       ├─ electron/main.mjs                                              │
│       │     starts Nitro (or vite dev) on 0.0.0.0:8080                  │
│       │     60s local POST /api/tick (loopback/LAN only)                │
│       │     tray, LAN URLs, master.key                                  │
│       │                                                                 │
│       ├─ Web desk  (TanStack Start / Vite / Nitro)                      │
│       │     src/routes/*  →  src/lib/posterpal/fns.ts                   │
│       │                   →  ops.ts → publish | graph | repo | ai       │
│       │                                                                 │
│       ├─ DB                                                             │
│       │     DATABASE_URL set  →  Postgres (pg)                          │
│       │     unset             →  PGLite on disk (.posterpal-pglite or   │
│       │                          %APPDATA%\PosterPal\pglite)            │
│       │                                                                 │
│       └─ optional npm run worker                                        │
│             DATABASE_URL → in-process tick/recycle/rss/sync/vault       │
│             unset        → HTTP POST /api/tick (desk process must be up)│
└───────────────┬─────────────────────────────────────────────────────────┘
                │ HTTPS (self-host) or http://<lan-ip>:8080 (phone)
                ▼
┌───────────────────────────┐     appsecret_proof HMAC      ┌─────────────────┐
│ Android APK (Capacitor    │  ─never holds App Secret─►    │ graph.facebook  │
│ WebView of the desk)      │                               │ .com/v26.0      │
│ Facebook Login stays on PC│                               │ rupload.facebook│
└───────────────────────────┘                               └─────────────────┘

Docker self-host (optional):
  postgres:17  +  app (Nitro :8080)  +  worker (tsx scripts/worker.ts)
```

**Two runtimes, one product:**

| Runtime | Entry | Status |
| --- | --- | --- |
| **Web desk (the product)** | `npm run dev` / Electron / Docker | Live, full vertical slice |
| **`.NET 9` kernel** | `desktop/PosterPal.Core` | HMAC + Jaccard tests only. **Not a WPF app.** `desktop/build.ps1` does not produce `PosterPal.exe`. |

The Windows app you actually run is **Electron** (`electron/main.mjs`), not the `desktop/` folder.

---

## 3. Stack

| Layer | Choice | Where |
| --- | --- | --- |
| UI | React 19 + TypeScript (strict) | `src/` |
| Router / SSR | TanStack Start + Router + Query | `src/router.tsx`, `src/routes/` |
| Bundler | Vite 8; Nitro `vercel` on `npm run build`, `node-server` on `build:desk` / `build:selfhost` | `vite.config.ts` |
| CSS | Tailwind v4 + Radix/shadcn | `src/styles.css`, `src/components/ui/` |
| Client state | zustand (`useShellStore`) + a separate non-persisted inspector store | `src/lib/store.ts` |
| Forms / toasts / cmd | react-hook-form + zod, sonner, cmdk | — |
| Charts | recharts | `/analytics` |
| DB | `pg` when `DATABASE_URL` set, else `@electric-sql/pglite` | `src/lib/db.ts` |
| Auth | Better Auth, **off** in `npm run dev` (`VITE_AUTH_ENABLED=false`); **on** in Docker `build:selfhost` | `src/lib/auth/` |
| Graph | raw HTTPS `graph.facebook.com/v26.0` + `appsecret_proof` | `graph.ts` |
| AI | Grok (`XAI_API_KEY`) + BYO OpenAI / Gemini / DeepSeek / fal | `ai.ts`, `providers.ts` |
| Desktop | Electron 31 + electron-builder portable EXE | `electron/main.mjs`, `package.json` `"build"` |
| Android | Capacitor 6 WebView of the desk origin | `capacitor.config.json`, `android/` |
| Tests | `tsx --test scripts/**/*.test.mjs` + Playwright `e2e/` | `package.json` |

---

## 4. Directory anatomy

```
posterpal/
├── src/
│   ├── router.tsx                 getRouter() + AppErrorComponent
│   ├── routeTree.gen.ts           generated — do not hand-edit
│   ├── styles.css                 Tailwind v4 + base cursor:pointer
│   ├── components/                shell, composer chrome, Radix wrappers
│   ├── lib/
│   │   ├── auth/                  Better Auth (frozen server.ts)
│   │   ├── db.ts                  pg | PGLite, pgliteDataDir(), migrations
│   │   ├── store.ts               selected Page, theme, composer prefill
│   │   ├── error-component.tsx    router defaultErrorComponent
│   │   ├── utils.ts               cn(), formatFanCount
│   │   ├── preview-host-bridge.ts Grok preview postMessage (keep)
│   │   ├── multiplayer/           unused template leftover — ignore
│   │   └── posterpal/             ★ THE PRODUCT (see §5)
│   └── routes/                    every screen + API (see §6)
├── migrations/                    0001–0011 SQL, applied on boot / db:migrate
├── scripts/                       worker, tests, migrate, APK, PWA, backup
├── e2e/                           Playwright specs (serial, :8081, PGLITE_MEMORY=1)
├── electron/main.mjs              Windows shell
├── desktop/                       .NET 9 HMAC/policy kernel (not the EXE)
├── android/                       Capacitor project
├── mobile-www/index.html          APK boot page (picks LAN origin)
├── public/                        icons, PWA manifest, sw.js, og.jpg, get-app.html
├── server/                        Nitro middleware (Grok PWA, APK)
├── release/                       built PosterPal.exe + PosterPal.apk
├── docker-compose.yml             db + app + worker
├── Dockerfile                     multi-stage Node 22, build:selfhost
├── startup.sh                     Grok sandbox revive → :8080 (+ worker if DATABASE_URL)
├── PosterPal.bat                  Windows launcher → scripts/launch-windows.ps1
└── docs (this file, README, SETUP, Surpass, PLAN, AUDIT, fullagencyplan)
```

Do **not** invent parallel folders (`services/`, `api/`, a second Graph client).

---

## 5. Domain library — `src/lib/posterpal/`

This is the product. Fix and extend here first. UI imports server functions from `fns.ts`; `fns.ts` calls `ops.ts`; `ops.ts` calls the modules below.

### 5.1 Core loop (compose → Graph → store)

| File | Job | Key exports |
| --- | --- | --- |
| [`types.ts`](src/lib/posterpal/types.ts) | All row types, `ComposerInput`, `NeedsItem`, analytics, agent, `HomeSnapshot` | `MEDIA_TYPES`, `POST_STATUSES`, `PageRow`, `PostRow`, `ComposerInput` |
| [`constants.ts`](src/lib/posterpal/constants.ts) | Graph v26.0, scopes, Electron redirect `http://127.0.0.1:8080/api/facebook/callback`, legacy WPF loopback `:55443` | `GRAPH_VERSION`, `REQUIRED_SCOPES`, `ELECTRON_REDIRECT` |
| [`graph.ts`](src/lib/posterpal/graph.ts) | HMAC proof, OAuth URL, error map, schedule window, fetch/multipart/rupload, paging | `appSecretProof`, `graphFetch`, `graphMultipart`, `ruploadBinary`, `graphCollect`, `mapGraphError`, `facebookScheduleWindow` |
| [`publish.ts`](src/lib/posterpal/publish.ts) | Save + dispatch; feed/photo/carousel/video/reel/story; local scheduler claim; recycle | `saveAndDispatch`, `attemptGraphPublish`, `tickScheduler`, `recycleDuePosts`, `policyForComposer`, `publishExisting` |
| [`ops.ts`](src/lib/posterpal/ops.ts) | **Facade used by every server fn.** Private `resolvePageId` matches `page-id.ts`: stale provided id → `undefined` (list/analytics/media/calendar return **empty**, never `pages[0]`). Omitted id → `pages[0]` on analytics/media/calendar; `listPosts` omitted → all Pages. Writes must use `getPage`. `weekPlanner` feeds Home `week` only. | see §7 |
| [`fns.ts`](src/lib/posterpal/fns.ts) | All `createServerFn` exports, `authMiddleware`-gated | see §7 |
| [`fns-handled.ts`](src/lib/posterpal/fns-handled.ts) | **Dead file.** Duplicate `markCommentHandledFn`. Nothing imports it (grep is empty). Use `fns.ts` → `ops.markCommentHandled` → `inbox-extra.ts`. | — |
| [`repo.ts`](src/lib/posterpal/repo.ts) | SQL with `user_id` on every query. `getSetting` decrypts `value_enc` if set. `searchAll`: `ilike` pages 8 / posts 10 / comments 8; strips `%` from the needle. `inboxCount`: needs_reply, not hidden, not from Page. | `getSetting`, `setSetting`, `loadSettings`, `listPages`, `cadenceForPage`, `searchAll` |
| [`sync.ts`](src/lib/posterpal/sync.ts) | Pull published posts, comments, insights; promote scheduled → Published; fire pending first-comment | `syncFromGraph` |
| [`facebook-oauth.ts`](src/lib/posterpal/facebook-oauth.ts) | Callback, pasted token, `/me/accounts` import (paged), vault refresh | `handleFacebookCallback`, `importFacebookAccounts`, `refreshVaultTokens` |
| [`policy.ts`](src/lib/posterpal/policy.ts) | Jaccard, branded-content `#ad`, empty caption, alt, AI-media, **cross-Page** dupes, remix marker, Reels 3–90s + 30/24h API cap | `runPolicyChecklist`, `jaccard`, `REMIX_MARK`, `validateReel`, `reelCapLevel` |
| [`page-id.ts`](src/lib/posterpal/page-id.ts) | Canonical resolver. **Provided stale id → `undefined`. Omitted id → `pages[0]`.** Writes must use `getPage` and throw. | `resolvePageId` |
| [`reschedule.ts`](src/lib/posterpal/reschedule.ts) | Thin alias → `ops.reschedule` (the old POST-new-object path is dead) | `rescheduleExisting` |

### 5.2 Operator intelligence

| File | Job | Key exports |
| --- | --- | --- |
| [`operator.ts`](src/lib/posterpal/operator.ts) | Heatmap (optional IANA zone), slots, UTM, fitness, caption stats, Later columns. Fitness = 7 binary checks (fans≥100, merch>0, mix diversity≥3, inbox<8, failed=0, vault>7d, cadence under warn) → score `round(100 * ok/7)`. | `topSlots`, `hourHeatmap`, `zonedDayHour`, `monetizationFitness`, `vaultAlarm`, `LATER_COLUMNS`, `isQuietHour` |
| [`desk.ts`](src/lib/posterpal/desk.ts) | Overlaps `operator.ts` (caption stats, quiet hours, buying intent, golden hour). Prefer `operator.ts` for new work; do not fork a third file. | `isBuyingIntent`, `isQuietHour`, `tokenExpiringSoon` |
| [`briefing.ts`](src/lib/posterpal/briefing.ts) | Permalink, link inspect, caption collisions, remix caption, identity issues | `findCollisions`, `remixCaption`, `identityIssues` |
| [`fleet.ts`](src/lib/posterpal/fleet.ts) | 10 practice identities + uniqueness score | `PRACTICE_FLEET` (length 10), `uniquenessScore` |
| [`slots.ts`](src/lib/posterpal/slots.ts) | Per-Page posting slots `{day, hour}` JSON | `parseSlots`, `DEFAULT_SLOTS` (Tue 10am, Wed 11am, Thu 10am), `scheduleWhenForPage` |
| [`csv.ts`](src/lib/posterpal/csv.ts) | Bulk CSV parse → rows | `parseCsv`, `mapBulkCsvRows` |
| [`rss.ts`](src/lib/posterpal/rss.ts) | RSS 2.0 / Atom scan (no XML lib). `fetchFeedItems` newest **5**, 10s abort, throws on HTTP error (never silent empty). | `parseRssItems`, `fetchFeedItems` |
| [`carousel.ts`](src/lib/posterpal/carousel.ts) | Partial-slide warning copy | `carouselPartialWarning` |

### 5.3 AI / research agent

| File | Job | Key exports |
| --- | --- | --- |
| [`ai.ts`](src/lib/posterpal/ai.ts) | Chat timeout **40s**, temp 0.7, default 700 tokens (variants 900, hashtags 200, analyze 300, replies 400). Image: Grok Imagine **45s**, OpenAI **60s** 1024², Gemini **60s**, Flux schnell **45s**. Models: Grok `grok-4.5`; OpenAI `gpt-4.1-mini` → `gpt-4o-mini`; DeepSeek `deepseek-v4-flash` → `deepseek-chat`; Gemini `gemini-2.5-flash` → `gemini-2.0-flash`. | `chatWithProvider`, `generateCaptionVariants`, `draftReplies`, `generateImageWithProvider`, `localSentiment` |
| [`providers.ts`](src/lib/posterpal/providers.ts) | Provider ids, labels, which setting key holds the BYO secret | `TEXT_PROVIDERS`, `IMAGE_PROVIDERS` |
| [`desk-context.ts`](src/lib/posterpal/desk-context.ts) | Pure health + **full desk snapshot** formatter (no DB, no secrets). | `formatDeskSystemContext`, `formatDeskSnapshot`, `snapshotLooksLikeOpsBrief` |
| [`desk-snapshot.ts`](src/lib/posterpal/desk-snapshot.ts) | Server read of every operator surface for the Agent: queue, vault, inbox, quota, cadence, fails, scheduler log, tick stamps. | `buildDeskSnapshot` |
| [`agent-skills.ts`](src/lib/posterpal/agent-skills.ts) | Personas (research/ops/inbox/shop/rewrite) + named skills. Pure. | `pickPersona`, `skillsForRun`, `PERSONAS` |
| [`agent-hops.ts`](src/lib/posterpal/agent-hops.ts) | Pure HITL hops (Composer/schedule/Later/inbox/failed/vault/calendar/merch). No publish. | `hopsFromDesk`, `wantsInboxDrafts` |
| [`agent.ts`](src/lib/posterpal/agent.ts) | Research desk. Snapshot + hops + inbox reply drafts (stored on comments, human Send) + policy flags on Story caption. | `runDeskAgent`, `agentWouldRefuse`, `loadPageProfile` |
| [`research.ts`](src/lib/posterpal/research.ts) | Profile from **desk data only** (comment that says “SQLite” is stale — it is Postgres/PGLite). `inferLocale`: hardcoded Winona/Minnesota else `in City`. Topic stopwords include weekday names so “saturday” is not a topic. `planSearchQueries` 3–5 queries, current year. **No I/O except repo reads.** | `buildPageProfile`, `planSearchQueries`, `inferLocale`, `extractTopics`, `suggestedBriefs` |

Agent loop (HITL, never publishes):

```
Page profile (desk data) → planSearchQueries → xAI live search
  (excludes facebook.com / instagram.com / threads.net)
  → notes[] + summary → generateCaptionVariants
  → persist agent_runs → UI: Open in Composer / Schedule in Composer / Save to Later
```

`runDeskAgent` injects (best-effort, both live-model and grok-no-key paths) the **full DESK OPS snapshot** from `buildDeskSnapshot` / `formatDeskSnapshot` (queue, vault, inbox, fails, quota, cadence, logs). Compact health-only formatting remains in `formatDeskSystemContext`.

```
Server & Desk Context:
- Server status: ${health.status} (DB: ${health.db})
- In-tab ticker / background worker: Active|Idle (last tick)
- Active desk items: N (first 3 Needs-you titles)
- Cadence this Page: n in 24h
- Recent logs: scope:message | …
```

Diagnose Server persists that block in `summary` (no fake citations). The Agent header has a `deskHealthFn` pill + Vault-shaped card. Diagnose is a canned brief into the same loop, not a separate diagnostic API.

Personas (`agent-skills.ts`): research, ops, inbox, shop, rewrite, calendar, memory. Skills name what the run did (`research-web`, `draft-inbox`, `vault-watch`, `recall-later`…). `pickPersona` / `personaForNeed` choose voice; `rankHops` reorders HITL hops. DESK OPS now includes Later ideas, snippets, previous runs, week strip, collisions, library stills, and Page voice/slots. A human still clicks Send.

`drafts_json` shape (backward compatible with caption-only runs):

```json
{
  "storytelling": "…", "cta": "…", "question": "…",
  "topics": ["river"], "queries": ["farmers market hours Winona 2026"],
  "notes": [{"heading":"Hours","body":"…","url":"https://…","confidence":"verified"}],
  "pagePurpose": "…",
  "persona": "research",
  "skills": ["research-web", "draft-captions"]
}
```

### 5.4 Auth of Facebook, devices, crypto, logs

| File | Job | Key exports |
| --- | --- | --- |
| [`crypto.ts`](src/lib/posterpal/crypto.ts) | AES-256-GCM. Key material: `POSTERPAL_MASTER_KEY` \|\| `BETTER_AUTH_SECRET` \|\| `GROK_AUTH_CLIENT_SECRET` \|\| preview string. Production **throws** if only the preview string is present. `decryptSecret` returns `null` on any failure (rotated key = dead vault). | `encryptSecret`, `decryptSecret`, `redact` |
| [`devices.ts`](src/lib/posterpal/devices.ts) | Pairing codes, device tokens (`ppd_…`), Needs-you aggregation, snapshot | `createPairingCode`, `resolveDeviceToken`, `needsYou`, `snapshotForSync` |
| [`device-token.ts`](src/lib/posterpal/device-token.ts) | Hash + mint `ppd_` tokens | `hashDeviceToken`, `mintDeviceToken` |
| [`log.ts`](src/lib/posterpal/log.ts) | Structured desk log + health stamps | `deskLog`, `listDeskLogs` (optional scope prefix), `readDeskHealth`, `stampTick` |
| [`agent-skills.ts`](src/lib/posterpal/agent-skills.ts) | Personas + named skills | `PERSONAS`, `pickPersona`, `skillsForRun`, `personaForNeed` |
| [`agent-hops.ts`](src/lib/posterpal/agent-hops.ts) | HITL hops (no Send) | `hopsFromDesk`, `rankHops`, `wantsInboxDrafts` |
| [`memory.ts`](src/lib/posterpal/memory.ts) | Later ideas + caption snippets | `listIdeas`, `saveIdea`, `listSnippets` |
| [`seed.ts`](src/lib/posterpal/seed.ts) | Practice Pages, demo posts, `ensureMemory`, fleet expand | `seedPracticeWorkspace`, `expandPracticeFleet` |
| [`connect-client.ts`](src/lib/posterpal/connect-client.ts) | Popup / system-browser OAuth. Polls `facebookStatusFn` every **800ms** for **180s** because `postMessage` dies across COOP and Electron’s system browser. Phone LAN origin is rejected (`shouldConnectFacebookHere`). | `connectFacebookPopup`, `facebookCallbackUri` |
| [`oauth-origin.ts`](src/lib/posterpal/oauth-origin.ts) | Canonicalize `localhost` → `127.0.0.1` (Facebook treats them as different URIs). Public origin from `VITE_PUBLIC_HOSTNAME` or `X-Forwarded-*`. | `canonicalOrigin`, `publicOrigin`, `resolveOAuthRedirect`, `desktopLoopbackCallback` |
| [`facebook-names.ts`](src/lib/posterpal/facebook-names.ts) | Illegal Meta display names | `facebookAppNameIssues` |
| [`facebook-domains.ts`](src/lib/posterpal/facebook-domains.ts) | App Domains / Site URL / Redirect URI hints | `facebookDomainHints` |
| [`facebook-docs.ts`](src/lib/posterpal/facebook-docs.ts) | Official guide URLs + **6** `CONNECT_STEPS` (Create app → Login → Domains → Role user → Create Pages on facebook.com → paste ID/Secret). `fetchOfficialGuide` 8s abort; host allowlist. | `OFFICIAL_GUIDES`, `CONNECT_STEPS`, `fetchOfficialGuide` |
| [`lan.ts`](src/lib/posterpal/lan.ts) | LAN origins, loopback/private IP, local-only tick gate | `listLanOrigins`, `isLocalTickCaller`, `clientIp` |
| [`runtime-client.ts`](src/lib/posterpal/runtime-client.ts) | Client: phone WebView vs PC, whether Facebook Connect is allowed here | `isPhoneWebView`, `shouldConnectFacebookHere` |
| [`inbox-extra.ts`](src/lib/posterpal/inbox-extra.ts) | Mark comment handled | used via `ops.markCommentHandled` |

### 5.5 How a post actually ships (control flow)

UI never talks to Graph. Composer calls `composeFn` → `ops.compose` → `saveAndDispatch`.

```
ops.compose
  extraIds = alsoPageIds minus primary
  primary = saveAndDispatch(primaryInput)          // may hit Graph
  for each extra: saveAndDispatch({
    ...primary, pageId: extra, mode: "local-draft",
    message: remixCaption(primary.message)         // REMIX_MARK prefix
  })
  extra failures are deskLog-warned; they do not fail the primary

clonePost: other Pages → remixCaption; cloning onto the SAME page keeps the original caption.
```

Composer **default mode is `local-draft`**. Ctrl+S always calls `mode: "local-draft"` even if Publish now is selected.

`saveAndDispatch` (`publish.ts`) is the gate:

```ts
const page = await getPage(userId, input.pageId);
if (!page) throw new Error("Page not found");           // no pages[0] remap
if (page.is_read_only && input.mode !== "local-draft")
  throw new Error("This Page is analyze-only…");
if (input.mode !== "local-draft" && cadence.level === "block") throw …; // local-draft still allowed
if (input.mediaType === "Reel") validateReel(…) || throw;
if (input.mode !== "local-draft") {
  const policy = await policyForComposer(…);
  if (!policy.canPublish) throw new Error(block.detail);
}
```

Then insert `posts` + `content_items` (`data_url` is the file bytes as a data URL — this is the scale risk). Composer `ingestFiles` **drops files > 6MB** client-side (toast: compress or paste an https URL; `publish.resolveMedia` can fetch `http(s)` for Graph `url=`). Photo mode keeps extras in the array but toasts to switch to Carousel; Graph Photo pipeline only uploads `media[0]`. Initial status: `now`→`Publishing`, `schedule`→`LocalScheduled`, drafts→`LocalDraft`.

`restoreCancelled` → `LocalDraft`. `duplicateNextWeek` clones onto the **same** Page, `mode: "schedule"`, `+7 days` (or +7 from now if that slot is <15 min away), **same caption** — `runPolicyChecklist` will usually **block** Jaccard 1.0 against the original Published row. `deletePublishedPost` / `cancelPost` Graph-DELETE only when `created_by_this_app` and the id is not `practice_`.

`ops.reschedule` **PATCHes** Graph (`POST /{facebook_post_id}` with `scheduled_publish_time`) or DELETE+local if outside the 10m–30d window. It never POSTs a second feed object. If the Graph PATCH fails it falls back to `LocalScheduled` and **warns that Facebook may still hold the original slot**.

Bulk CSV (`csv.ts` + `ops.bulkSchedule`): columns `caption|message`, `when|date`, `page|pageid` (or positional 0/1/2). `when` present → `mode: "schedule"` else `local-draft`. Always `mediaType: "Text"`. Page column is UUID **or** case-insensitive name via `resolvePageRef` (`id = ref OR lower(name) = lower(ref)`). Unknown Page → per-row error, not a throw. Policy + cadence still run per row through `saveAndDispatch`.

---

## 6. Routes (every screen and API)

Shell: [`src/components/app-shell.tsx`](src/components/app-shell.tsx) — left rail (`NAV` is the IA source of truth: Pages, Composer, Later, Drafts, Calendar, Inbox, Agent, Analytics, Media, Merchandise, Connect, Vault, Settings). Needs bell, inspector, command palette, 60s `tickFn`, 30s `/api/health` pulse. **`/pair` and `/setup` are not in the rail.**

Document shell: [`src/routes/__root.tsx`](src/routes/__root.tsx) — `PreviewHostBridge`, `ServiceWorkerManager`, `ClientLogCatcher`, `AuthProvider`, toaster.

Most desk pages wrap [`Guard`](src/components/guard.tsx): if auth is on and there is no user, redirect `/login`. **Guard does not check setup.** `/setup` is reached from Home when `pages.length === 0 && !setupComplete`. In practice `bootstrapApp` **auto-seeds the 10-Page practice fleet** and sets `setup_complete=1` on first load, so the wizard is optional — not a hard gate. `/pair` is standalone (no Guard) so a phone can redeem a code without the rail.

### 6.1 Pages

| Path | File | Job |
| --- | --- | --- |
| `/` | `src/routes/index.tsx` | Fleet home: Needs you, cadence, uniqueness, due soon, collisions |
| `/login` | `src/routes/login.tsx` | Auth-off → `/`. Auth-on: email/password. Signup **only** while `"user"` count is 0; `firstRunFn` **fails closed** (`hasUsers=true` on error) so a DB blip does not reopen signup. |
| `/setup` | `src/routes/setup.tsx` | **No Guard.** 4 steps: (1) I have an App ID / Connect coach / Skip → 10 practice Pages (`startPractice` + `startFleetPracticeFn`), (2) save App ID/Secret, (3) Connect popup or practice, (4) `completeSetup` → `/`. |
| `/composer` | `src/routes/composer.tsx` | Caption, media (6MB, Photo extras toast Carousel), merch, first comment, policy, cadence, Feed preview, best-time chips, also-draft-to remix, recycle-after-days. Modes: now / schedule / local-draft / fb-draft. `busy` lock. Ctrl+Enter sends selected mode. |
| `/calendar` | `src/routes/calendar.tsx` | This Page / All Pages. Month/Week/Heatmap buttons (`#cal-view-*`, `aria-pressed`). Drag scheduled/drafts/failed only. Drop time default **10:00**; empty-day new post **13:00**. |
| `/inbox` | `src/routes/inbox.tsx` | Filters needs / hidden / all / buying-intent. `j`/`k` select, **E** handled. Send → `POST /{commentId}/comments`. Hide → `POST is_hidden`. Practice ids skip Graph. Hide also clears `needs_reply`. Sending lock. Snippets from `caption_snippets`. |
| `/drafts` | `src/routes/drafts.tsx` | `ViewTabs`: Drafts (`LocalDraft`+`FacebookDraft`) / Scheduled (`LocalScheduled`+`FacebookScheduled`+`Publishing`) / Failed. j/k, Enter inspector. Restore Cancelled → LocalDraft. |
| `/later` | `src/routes/later.tsx` | Idea Kanban (`saved_ideas`). Columns from `operator.LATER_COLUMNS`: `inbox` / `photo-needed` / `caption-ready` / `offer-this-week` (stored in `notes`). Never posts. |
| `/analytics` | `src/routes/analytics.tsx` | Days coerced to **7 \| 28 \| 90**. Heatmap. A/B card only if `variant_group_id` + `ai_variant_label` (ranked by avg reactions; human reuses caption — no auto-pick). CSV `id,published,message,reactions,comments,shares,media_views,variant`. Insights locked at `fan_count < 100`. Sync views = `post_total_media_view` then `post_media_view`. |
| `/media` | `src/routes/media.tsx` | Library for selected Page. Imagine prompt ≥ **8** chars → `imaginePhotoFn` → persist asset + prefill Composer (Photo, `createdWithAi`, alt=prompt). **Reuse in Composer** needs `data_url`. Filter by name/alt/page. |
| `/merchandise` | `src/routes/merchandise.tsx` | Per-Page shop links. Default UTM `utm_source=facebook&utm_medium=social&utm_campaign={slug}`. **Use in Composer** runs `applyUtm`. Policy will warn branded-content if a merch URL is present. |
| `/settings` | `src/routes/settings.tsx` | App ID/Secret, Connect, **per-Page** cadence + brand voice (`updatePageCadenceFn` / `updatePageVoiceFn`), BYO AI keys + probe, theme, **audience time zone** (`savePrefs.timezone` → `SettingsBag.timezone` → heatmap/chips), hide-practice (only bites once a live Page exists), devices/pairing, RSS URL, posting slots. Seed copy is the 10-Page practice fleet. |
| `/vault` | `src/routes/vault.tsx` | Token vault, scheduler_logs, desk_logs, **Desk health** card: DB + in-tab ticker vs background worker (copy mentions PosterPal.exe 60s tick and optional `npm run worker`). |
| `/agent` | `src/routes/agent.tsx` | Research desk. Diagnose Server (brief), Map this Page, Open in Composer, **Schedule in Composer**, Save to Later, header health pill + Desk health card. |
| `/pair` | `src/routes/pair.tsx` | No Guard. 6-digit code + device name (default Phone). POST `/api/sync/pair` → `setDeviceToken` (`localStorage posterpal-device-token`) → `/`. Command palette “Phone / APK pairing” goes to **Settings**, not this route. |
| `/connect` | `src/routes/connect.tsx` | `ConnectCoach`: 6 local-only checkboxes (`CONNECT_STEPS`, not persisted), fetch first allowed official guide (developers.facebook.com / developers.meta.com, 1h cache, 4k text), Save credentials, Connect popup, Graph Explorer paste. Success: hide practice, N live Pages. |

### 6.2 HTTP API (not server-fns)

| Path | File | Job |
| --- | --- | --- |
| `/api/facebook/start` | `src/routes/api/facebook/start.ts` | OAuth start |
| `/api/facebook/callback` | `src/routes/api/facebook/callback.ts` | OAuth loopback (must match Facebook Redirect URI byte-for-byte) |
| `/api/sync/pair` | `src/routes/api/sync/pair.ts` | Pairing redeem |
| `/api/sync/snapshot` | `src/routes/api/sync/snapshot.ts` | Device snapshot |
| `/api/sync/action` | `src/routes/api/sync/action.ts` | Device write-through. Bearer `ppd_`. Actions: `compose` (full `ComposerInput` — **`mode:"now"` publishes**), `reply`, `hide`, `handled`. CORS preflight. |
| `/api/auth/$` | `src/routes/api/auth/$.ts` | Better Auth mount |
| `/api/health` | `src/routes/api/health.ts` | `{status, live, db, workerFresh, …}` — 200 if DB up, 503 else. No auth. |
| `/api/tick` | `src/routes/api/tick.ts` | Local-only scheduler tick for Electron **and** the PGLite worker HTTP fallback. Calls `ops.tick` (vault + scheduler + stale sync + recycle + RSS). 403 from public internet (`isLocalTickCaller` uses **Host**, not `X-Forwarded-For`). |
| `/api/apk` | `server/middleware/apk.ts` (Nitro, not a TanStack route) | Serves the sideload APK for `get-app.html`. |

There is **no** `/api/health/live` vs `/ready` split — one endpoint covers both.

`GET /api/health` JSON is exactly `readDeskHealth()`:

```ts
{
  live: true,                    // process is up
  db: "up" | "down",             // select 1
  workerLastTick: string | null, // app_settings
  schedulerLastTick: string | null,
  workerFresh: boolean,          // last tick < 3 minutes
  schedulerFresh: boolean,
  status: db === "up" ? "ok" : "degraded",
}
```

HTTP 200 if `db === "up"`, else 503. No auth. CORS `*`. `deskHealthFn` is the same object scoped to the signed-in user.

---

## 7. Server functions (`fns.ts` → `ops.ts`)

Pattern: `createServerFn({ method }).middleware([authMiddleware]).validator(...).handler` → `ops.*`.

`authMiddleware` (`src/lib/auth/middleware.ts`) resolves `context.userId` via `requireUserId` (`verify.server.ts`). Order **matters**:

1. `Authorization: Bearer ppd_…` → `resolveDeviceToken` → `devices.user_id`. Invalid `ppd_` **always** 401, even when auth is off.
2. Else if `!authConfigured` (`VITE_AUTH_ENABLED === "false"`) → `"dev-user"`.
3. Else session cookie or session bearer → user id.
4. Else `UnauthorizedError` 401 (`message === "Unauthorized"`). **No silent fallback** when the login wall is on.

`authConfigured` is `!authDisabled && (emailAndPasswordEnabled || grok client present)`. Email/password is hardcoded `true` in `email-password.ts` but only **enforced** when `VITE_AUTH_ENABLED` is not `"false"`.

Public (no auth middleware): `firstRunFn` (does an operator account exist?).

### Complete `fns.ts` catalog

**Bootstrap / settings**

`bootstrapApp`, `firstRunFn`, `getSettingsFn`, `lanOriginsFn`, `saveFacebookApp`, `saveAiKeysFn`, `savePrefs`, `completeSetup`, `startPractice`, `startFleetPracticeFn`

**Facebook identity**

`beginFacebookOAuth`, `facebookStatusFn`, `importFacebookTokenFn`, `facebookGuideFn`

**Pages / posts**

`listPagesFn`, `listPostsFn`, `getPostBundle`, `cadenceFn`, `policyFn`, `composeFn`, `publishNowFn`, `rescheduleFn`, `cancelPostFn`, `deletePublishedFn`, `clonePostFn`, `restoreCancelledFn`, `duplicateNextWeekFn`, `savePostingSlotsFn`

**Bulk / RSS / recycle (wired through compose + worker)**

`bulkScheduleFn`, `saveRssFeedFn` — recycle is a field on `ComposerInput.recycleAfterDays`; worker calls `recycleDuePosts`

**Inbox**

`commentsFn`, `hideCommentFn`, `sendReplyFn`, `markCommentHandledFn`, `generateReplyDraftsFn`

**Merch / vault / search / analytics / media**

`merchFn`, `saveMerchFn`, `deleteMerchFn`, `vaultFn`, `logsFn`, `searchFn`, `analyticsFn`, `mediaLibraryFn`, `exportCsvFn`, `exportQueueFn`, `unfurlLinkFn`

**AI**

`generateVariantsFn`, `hashtagsFn`, `analyzeFn`, `imaginePhotoFn`, `probeTextFn`, `probeImageFn`

**Page identity**

`updatePageVoiceFn`, `updatePageCadenceFn`

**Scheduler / sync**

`tickFn`, `syncNowFn`, `calendarFn`

**Later / snippets**

`ideasFn`, `saveIdeaFn`, `deleteIdeaFn`, `moveIdeaFn`, `snippetsFn`, `saveSnippetFn`, `deleteSnippetFn`

**Needs / devices**

`needsYouFn`, `createPairingFn`, `listDevicesFn`, `revokeDeviceFn`

**Agent / observability**

`runAgentFn` (optional `persona`), `pageProfileFn`, `listAgentRunsFn`, `deskLogsFn` (`limit` / `scope` prefix), `deskHealthFn`, `deskSnapshotFn`, `reportClientErrorFn`

Happenings (home, Agent, Vault) read `desk_logs` via `deskLogsFn` / snapshot `logs`. Compose, publishNow, clone, inbox reply, syncNow, Agent runs, and the worker stamp those rows.

When adding a capability: implement in the right module → expose on `ops.ts` → wrap in `fns.ts` → call from a route. Do not call `repo.ts` from React.

### 7.1 Server contract (auth, scoping, silent paths)

**`livePage` in `fns.ts`** uses **`page-id.ts`**: provided stale id → `undefined`; omitted → `undefined` (does not remap). Then some `ops.*` call the **ops private resolver** which remaps omitted/stale to `pages[0]`:

| Server fn | After `livePage` | Effective scope |
| --- | --- | --- |
| `composeFn` / `publishNowFn` / `rescheduleFn` / clones | **no** `livePage` | `getPage` / post id + `user_id`; miss **throws** |
| `listPostsFn` | livePage | omitted → **all Pages**; stale → undefined → ops `listPosts` only remaps if `pageId` still set (it isn’t) → all Pages |
| `commentsFn` | livePage | omitted/stale → all Pages’ comments |
| `analyticsFn` / `mediaLibraryFn` / `calendarFn` | livePage then ops remap | omitted/stale → **`pages[0]`**, not “all” (calendar has explicit `allPages`) |
| `exportQueueFn` | livePage | omitted/stale → `listPostsRepo` all Pages, then filter statuses |

**Unauthenticated HTTP:** `firstRunFn` (user count), `GET /api/health`, `GET/HEAD /api/apk`, Facebook callback (state), OPTIONS CORS on sync. Everything else: `authMiddleware` (session / `ppd_` / `dev-user`).

**Encrypted vs plain (`setSetting`):** App Secret and BYO AI keys → `value_enc`. App ID, theme, cadence defaults, hide_practice, providers → `value_plain`. **`saveFacebookApp` with blank secret does not clear** the stored secret. **`saveAiKeys` ignores empty strings** — keys cannot be deleted from Settings, only replaced. Desk-wide `cadence_warn`/`cadence_block` stay in `app_settings`; per-Page columns update only when a `pageId` is sent (`savePrefs` or `updatePageCadenceFn`).

**Graph writes that skip the policy engine:** `sendReply`, `hideComment`, `cancelPost`/`deletePublishedPost` (DELETE), scheduled `first_comment` on sync, `/me/accounts` import. Policy runs on `saveAndDispatch` (except `local-draft`) and `publishExisting` (including Drafts retry). `publishExisting` passes `merchUrl: null`, so inspector Publish now may **miss** the branded-content merch flag.

**AI fallbacks (no key):** `generateVariants` returns three templated captions `ai:false`. `hashtags` takes first 4 words length>4 as `#tags`. `analyze` uses `localSentiment` only. `generateReplyDrafts` stores three canned strings in `reply_drafts_json`.

**`unfurlLink`:** `_userId` unused (auth still required). UA `PosterPal/1.0 (link preview)`, `redirect: follow` (**does not re-check host after redirects**), **no `res.ok` check**, 4s, full body then slice 120k, OG `image` must be `https://`. Non-HTML → `{title: hostname}` not throw.

**`tickScheduler` / Graph-ahead `attemptGraphPublish`:** **no second policy pass**. Policy ran at compose time; the worker will ship the stored caption even if Jaccard twins appeared later.

**Cancel vs delete:** `cancelPost` Graph DELETE failure is logged and the row is still `Cancelled` (Facebook may keep the slot). `deletePublishedPost` Graph DELETE **throws** and does **not** update local status.

**`cadenceFn`:** `livePage(id) ?? data.pageId` — a stale id falls through to SQL on a missing Page (counts 0, default caps), not `pages[0]`.

**`GET /api/health`:** `readDeskHealth()` with **no user** — last tick stamps are whichever `app_settings` row it finds first (single-operator assumption). `/api/tick` uses `POSTERPAL_USER_ID` or `select distinct user_id from app_settings limit 1`.

**Ownership gaps:** `saveMerch` / `saveIdea` / `saveSnippet` / `imaginePhoto` `pageId` and `savePrefs.default_page_id` are **not** checked against `pages.user_id` (FK may still reject merch). `deleteMerch` / idea delete missing id → `{ok:true}`.

**`facebookGuideFn`:** authenticated; URL still must pass `isAllowedDocsUrl` (developers.facebook.com / developers.meta.com).

**`reportClientErrorFn`:** any signed-in client can insert `desk_logs` (scope default `client`).

**`persistUserToken`:** `GET /debug_token` with app token `{appId}|{appSecret}` is best-effort. Then `UPDATE token_vault SET is_valid=false WHERE user_id=? AND is_valid=true` (all rows) + insert.

Insights loop: Graph **token** errors rethrow (abort rest of that Page); other errors `continue`.

---

## 8. Graph publish pipeline

HMAC on every Graph URL (`graph.ts`). Mirrored in `desktop/PosterPal.Core/Graph/AppSecretProof.cs` and `scripts/hmac.test.mjs`:

```ts
export function appSecretProof(accessToken: string, appSecret: string): string {
  return createHmac("sha256", appSecret).update(accessToken).digest("hex");
}
```

[`publish.ts`](src/lib/posterpal/publish.ts) `attemptGraphPublish`:

| Media | Graph (all with `appsecret_proof`) | Bytes vs URL |
| --- | --- | --- |
| Text | `POST /{page-id}/feed` | n/a |
| Photo | `POST /{page-id}/photos` | `url=` if http(s); else multipart field `source` + `alt_text_custom` |
| Carousel | each slide `POST /photos` `published:false`, then `POST /feed` with `attached_media[i]={media_fbid}` | per-slide url or source; **dropped slides named in warning** |
| Video | `POST /{page-id}/videos` (**not** resumable; rupload is Reels/story video only) | `file_url=` or multipart `source`; caption field is **`description`** |
| Reel | `POST /video_reels` `upload_phase=start` → `ruploadBinary` (`Authorization: OAuth {token}`, `offset:0`, `file_size`) → `finish` with `video_state` `PUBLISHED` / `SCHEDULED` / `DRAFT` | **always bytes** (`resolveBytes`) |
| Story photo | unpublished `/photos` then `POST /photo_stories` `{photo_id}` | url or source |
| Story video | `/video_stories` start / rupload / finish | bytes only |

`buildAuthorizeUrl`: `response_type=code`, `display=popup`, `auth_type=rerequest` (re-prompt declined scopes), `scope` = `REQUIRED_SCOPES` joined by comma.

**.NET kernel drift:** `PosterPal.Core` `PublishPayloadBuilder.Draft` still sets `UnpublishedContentType = "DRAFT"`. Live JS **must not** send that field (Graph 100). Do not port the C# draft builder into TypeScript.

Modes (`ComposerInput.mode`):

| Mode | Behavior |
| --- | --- |
| `now` | Publish immediately |
| `schedule` | Graph unpublished + `scheduled_publish_time` if inside **10 min–30 days**; else `LocalScheduled` |
| `local-draft` | Desk only |
| `fb-draft` | `published=false`, no time |

Post statuses (`types.ts` `POST_STATUSES`):  
`LocalDraft` → `FacebookDraft` → `LocalScheduled` → `FacebookScheduled` → `Publishing` → `Published` | `Failed` | `Cancelled`

**Practice Pages never hit Graph.** `attemptGraphPublish` short-circuits: `now` → `Published` with `facebook_post_id = "practice_" + slice`; `schedule` stays `LocalScheduled`; `fb-draft` stays `LocalDraft`.

**Stories:** Graph has no schedule and no unpublished draft. `saveAndDispatch` keeps Stories on the local scheduler / local draft.

**Carousel:** a failed slide is **dropped**; the rest still post. Warning via `carouselPartialWarning` — the row is not `Failed`.

**Video/Reel ids:** after upload, `GET /{graphId}?fields=id,post_id` and prefer `post_id` so sync can match `{pageId}_{id}`.

**`first_comment`:** posted immediately only when `mode === "now"`. Scheduled posts wait for `syncFromGraph` to see the row in `/published_posts` (status was `FacebookScheduled` or `LocalScheduled`, `created_by_this_app`, pending comment). A failed first-comment **does not** fail the post.

**Error fallbacks** (`attemptGraphPublish` catch):

- `schedule` + (`unknown_schedule` **or** `invalid_param` whose message matches `/schedul/i`) → stay `LocalScheduled` (the old Graph-100-on-Publish-now bug is gated; Publish now does **not** take this path).
- `fb-draft` any Graph error → `LocalDraft`.
- else `Failed`. Graph 190 also sets `token_vault.is_valid = false`.

**`tickScheduler` (honesty — this is the local queue, not Buffer):**

1. `Publishing` with `updated_at` older than **2 minutes** → `Failed` (“Publish interrupted. Retry from Drafts”).
2. `LocalScheduled` more than **10 minutes overdue** and empty `error_message` → stamp “Overdue — desk was closed…” (**does not auto-fire late**). Needs you surfaces it.
3. Due in the **last 10 minutes**, limit **8**: `UPDATE … SET status='Publishing' WHERE status='LocalScheduled' RETURNING id`, then `attemptGraphPublish(..., "now")`. Lost race → skip.
4. Future local slots in `(now+10m, now+30d)`, limit 8: if inside Graph window, push to Facebook as `FacebookScheduled`. **This path does not CAS-claim `Publishing`.** If Electron `/api/tick` and the browser `tickFn` overlap, two Graph schedule objects can be created. The due-now path is safe (UPDATE … RETURNING).

**Graph retries (`graphFetch`):** up to 5 attempts, backoff `400 * 2^attempt` ms, timeout 100s. Retries `GraphRequestError` when `mapped.retryable` (rate_limit / server), **including POST**. Network/timeout retries **GET only** — a timed-out POST may already have created the object. `graphMultipart` similar (4 attempts, 180s). `ruploadBinary` **no retry**.

Graph error map (`mapGraphError`): 190 token (not retryable); 200 permission; 4/17/32/613/80001 rate_limit (retryable); 368 abusive; 100 invalid_param; code 1 + `/schedul/i` unknown_schedule; HTTP ≥500 or 429 server (retryable). Quota headers → `quota_snapshots`.

---

## 9. Policy engine

[`policy.ts`](src/lib/posterpal/policy.ts) `runPolicyChecklist` — **server-enforced** (also run from UI for live flags).

| Flag id | Severity | Trigger |
| --- | --- | --- |
| `empty-caption` | block | blank trimmed message |
| `remix-required` | block | caption starts with `REMIX_MARK` (clone / recycle / also-draft-on) |
| `duplicate` | block | Jaccard ≥ **0.82** vs last 30 captions **this Page** |
| `similar` | warn | ≥ **0.55** and < 0.82 (similar list starts at 0.35 for the inspector) |
| `cross-page-duplicate` | block | ≥ 0.82 vs other Pages (inauthentic-behavior / fleet spam) |
| `cross-page-similar` | warn | ≥ 0.55 vs another Page |
| `branded-content` | warn | merch URL **or** shop-ish caption/link (`shop\|buy\|etsy\|amazon\|merch\|…`) without `#ad` / `#sponsored` / paid partnership / gifted / ambassador |
| `alt-text` | warn | `hasImages && missingAlt` |
| `ai-media` | info | `createdWithAi` — desk reminder only, **never** injected into the caption |

`canPublish = !flags.some(f => f.severity === "block")`. `policyForComposer` loads:

- last 30 **same-Page** captions in `{Published, FacebookScheduled, LocalScheduled, Publishing, FacebookDraft}` — **not** `LocalDraft` (so a remix draft sitting in Drafts does not Jaccard-block itself)
- last 80 **other-Page** captions **including** `LocalDraft`

**Local drafts skip policy** in `saveAndDispatch` (so remix copies can be saved); Publish now / schedule / fb-draft run it. `publishExisting` (Drafts retry) **does** run policy.

Home also runs `briefing.findCollisions` (default Jaccard **0.72**) across the last 80 captions including LocalDrafts — that is the fleet “uniqueness” strip, separate from the publish block.

Cadence (`repo.cadenceForPage`): page columns default warn **8** / block **20**. Count is **not** `created_at`:

- `Published` with `coalesce(published_time, created_at)` in the last 24h
- `Publishing` updated in the last 24h
- `FacebookScheduled` / `LocalScheduled` whose `scheduled_publish_time` is in **[-24h, +24h]**

A slot tomorrow morning still burns today’s cap. Warn does not throw; block throws in `saveAndDispatch` / `publishExisting`.

Remix: `briefing.remixCaption` prefixes

```
REWRITE this in this Page's voice before sending — identical copy is a spam risk.
```

(`policy.REMIX_MARK`). Recycle / clone / `alsoPageIds` all go through this. The operator must rewrite before Send.

Reel (`validateReel`): if dims present, `|w/h − 9/16| > 0.08` fails; min **540×960**; if duration present, **3–90s** (Meta Reels Publishing API, Jul 2026). Desk also enforces Meta’s **30 API Reels / rolling 24h** (`reelCapLevel`, warn 25).

---

## 10. Schema (`migrations/`)

Never edit `0001_auth.sql`. Add `000N_*.sql`. Applied by `scripts/migrate.mjs` (and on Docker boot, and `npm run build`).

| File | Tables / columns |
| --- | --- |
| `0001_auth.sql` | Better Auth (`user`, session, account, verification) |
| `0002_bookboss.sql` | `app_settings`, `token_vault`, `pages`, `posts`, `content_items`, `merchandise_links`, `comments`, `scheduler_logs`, `quota_snapshots`, `oauth_states` |
| `0003_memory.sql` | `saved_ideas`, `caption_snippets` |
| `0004_devices.sql` | `pairing_codes`, `devices` |
| `0005_agent.sql` | `agent_runs` |
| `0006_recycle.sql` | `posts.recycle_after_days` |
| `0007_rss.sql` | `pages.rss_feed_url` |
| `0008_desk_log.sql` | `desk_logs` (14-day prune in `deskLog`) |
| `0009_oauth_redirect.sql` | `oauth_states.redirect_uri` |
| `0010_media_assets.sql` | `media_assets` (stills not yet attached to a post) |
| `0011_page_picture_slots.sql` | `pages.picture_url`, `pages.posting_slots_json` |

App tables are scoped by `user_id`. Exception: `desk_logs.user_id` is **nullable** (process-wide errors with no operator).

`app_settings` keys actually **read** by `loadSettings`: `facebook_app_id`, `facebook_app_secret`, `theme`, `default_page_id`, `cadence_warn` / `cadence_block` (desk-wide defaults; per-Page caps live on `pages`), `setup_complete`, `openai_api_key`, `google_api_key`, `deepseek_api_key`, `fal_api_key`, `default_text_provider`, `default_image_provider`, `facebook_last_error`, `facebook_last_redirect`, `facebook_last_connect_ok`, `hide_practice`.

Also written but **not** in `SettingsBag` / `loadSettings`: `worker_last_tick`, `scheduler_last_tick`, `last_graph_sync`, `memory_seeded_once`, `facebook_last_connect_at`. `timezone` **is** on the bag and drives heatmap/chips. `hasAiKey` on the bag is **only** `Boolean(XAI_API_KEY)` — BYO keys are `providers.openai|gemini|deepseek|flux`.

`listPages` hides practice rows only when `hide_practice !== "0"` **and** at least one live Page exists. Connect sets `hide_practice=1`.

---

## 11. Worker

[`scripts/worker.ts`](scripts/worker.ts) — `npm run worker`

Every `POSTERPAL_WORKER_INTERVAL_MS` (default 60s), or `--once`:

1. `tickScheduler` — fire due `LocalScheduled`, fail stuck `Publishing`
2. `recycleDuePosts` — Published posts older than `recycle_after_days` → **LocalDraft** remix (human still sends)
3. `ops.rssDrafts` — new RSS items → LocalDraft (never auto-publish)
4. `syncFromGraph` — posts, comments, insights
5. `refreshVaultTokens` — long-lived user token
6. `stampTick(userId, "worker_last_tick")` + `deskLog` on any FAILED

**PGLite:** a second process cannot see the web process’s WASM DB. The worker does **not** refuse to start without `DATABASE_URL` — it becomes an **HTTP ticker** against `POST /api/tick` on the local desk. That route runs **`ops.tick`**, so recycle/RSS/vault/sync still happen **if the desk process is up**. Docker always sets `DATABASE_URL` and runs `oneTick` in-process.

**`ops.tick` (browser 60s `tickFn` + Electron `/api/tick` + PGLite worker):**

1. `refreshVaultTokens`
2. `tickScheduler`
3. `syncFromGraph` only if `last_graph_sync` is older than **120s** and a live Page has a token
4. `recycleDuePosts`
5. `rssDrafts`
6. `stampTick(userId, "scheduler_last_tick")`

Electron also POSTs `/api/tick` every 60s while the EXE is running (window may be hidden to tray), so LocalScheduled still fires without Docker **as long as PosterPal.exe is running**. If the EXE is quit, overdue slots wait for a human (10-minute rule above).

---

## 12. Auth model

| Mode | How | When |
| --- | --- | --- |
| Personal desk | `VITE_AUTH_ENABLED=false` → `dev-user` | `npm run dev`, Electron default, `npm run build` / `build:desk` |
| Self-host wall | `VITE_AUTH_ENABLED=true` (baked by `build:selfhost`) | Docker image |
| Device | `Authorization: Bearer ppd_…` | Phone after Settings → Pair. Checked **before** the auth-off shortcut, so pairing works on the personal desk too. |

Email/password is enabled in code (`emailAndPasswordEnabled = true` in `src/lib/auth/email-password.ts`) but only **takes effect when auth is on**. Do **not** rewrite `src/lib/auth/server.ts` (frozen Grok template). Rate limits in `server.ts`:

```
window 60s / max 100           // global
/sign-in/email  60s / max 5
/sign-up/email  3600s / max 10
```

IP from `x-forwarded-for` / `x-real-ip` / `cf-connecting-ip`. First operator: `bootstrap.ts` seeds `POSTERPAL_ADMIN_EMAIL` / `POSTERPAL_ADMIN_PASSWORD` when `"user"` is empty. After that, `login.tsx` hides signup (`firstRunFn.hasUsers`).

Pairing (`devices.ts`): 6-digit code, 10 minutes, one-shot. `mintDeviceToken()` → `ppd_` + 32 random bytes; only the SHA-256 hash is stored (`device-token.ts`).

Grok broker (`GROK_AUTH_*`) is optional federated Google/X. Standalone self-host uses email/password.

---

## 13. UI components that matter

| File | Job |
| --- | --- |
| `app-shell.tsx` | Rail (`NAV` labels include **Token vault**), search, sync, 60s `tickFn`, 30s `/api/health` chip = **`db === "up"` only** (“Desk live” ≠ worker freshness). Inbox badge = needs-reply count; Drafts badge = Failed count. |
| `facebook-preview.tsx` | Composer Feed mock: relative time / Draft / Just now; up to 4 images; first-comment box; decorative Like/Comment/Share. |
| `post-inspector.tsx` | Global dialog (`useInspectorStore`). Actions: restore Cancelled; duplicate next week; reshare remix on same Page; clone remix drafts to other Pages; Open in Composer; Publish now (Failed/drafts); inbox; copy; Facebook permalink; Graph DELETE if `created_by_this_app`; cancel. Remix marker warned. |
| `needs-you.tsx` / `needs-bell.tsx` | Overdue, failed, buying-intent, token expiry, cadence |
| `command-palette.tsx` | Ctrl/⌘+K. Go-list includes pair→**Settings**, next-good-slot prefill, buying-intent inbox, failed drafts, identity planner. Search `searchFn` after 2 chars / 180ms. |
| `shortcut-help.tsx` | `?` — Ctrl+Enter send, Ctrl+S draft, Esc clear, N new, J/K inbox, E handled |
| `status-badge.tsx` | Post status chips |
| `guard.tsx` | Login wall only (`!user` → `/login`). Does **not** gate setup. |
| `fleet-pulse.tsx` | Per-Page cadence / uniqueness / slots |
| `identity-planner.tsx` | Home card. Gaps from `identityIssues`: no voice/category/merch, uniqueness &lt; **55**, never published (live), duplicate names. |
| `connect-coach.tsx` | OAuth walkthrough |
| `bulk-scheduler.tsx` | Composer **Bulk schedule**. Paste or `.csv`. Same `saveAndDispatch` path. Empty `when` → local draft. Per-row ✓/✗. |
| `page-switcher.tsx` / `page-avatar.tsx` / `page-header.tsx` | Rail + headers |
| `mobile-nav.tsx` | Phone bottom nav |
| `week-strip.tsx` | Home week planner, not Calendar. |
| `view-tabs.tsx` | Drafts tabs (`drafts` / `queued` / `failed`). Calendar uses its own Month/Week/Heatmap buttons (`aria-pressed`, `#cal-view-*`). |
| `facebook-name-help.tsx` / `facebook-domain-help.tsx` | Meta naming + domain copy |
| `client-log-catcher.tsx` | Window errors → `reportClientErrorFn` |
| `service-worker-manager.tsx` | PWA shell cache |
| `preview-host-bridge.tsx` | Grok preview; noop outside iframe — **keep** |
| `src/components/ui/*` | Radix wrappers (button, dialog, tabs, …) |

Client store (`src/lib/store.ts`): persist name `posterpal-shell`, **only** `theme` + `selectedPageId`. Composer prefill is in-memory. **Inspector (`useInspectorStore`) is a separate non-persisted store** so persist-merge cannot drop the open action. localStorage is iframe-safe (third-party cookie block → in-memory fallback).

---

## 14. Desktop, Android, PWA

### Electron (`electron/main.mjs`)

- Binds `0.0.0.0:8080` so a phone on Wi‑Fi can reach the PC.
- Packaged: `spawn(process.execPath, [built])` with `ELECTRON_RUN_AS_NODE=1` running `.output/server/index.mjs`.
- Dev / unpackaged: `npm run dev`. Override with `POSTERPAL_DEV=1`.
- Waits on `GET /api/health` (up to 180s) before opening the window.
- Writes `POSTERPAL_MASTER_KEY` to `%APPDATA%\PosterPal\master.key` (32 hex bytes if missing).
- PGLite dir: `%APPDATA%\PosterPal\pglite`.
- 60s `POST /api/tick`. Close-to-tray (`win.hide()` unless `app.quitting`).
- Facebook Login and `developers.facebook.com` open in the **system browser** (`setWindowOpenHandler` + `shell.openExternal`) so Meta sees a real UA/cookies, not Electron.
- Tries `netsh advfirewall` for TCP 8080. Tray copies LAN URLs + `get-app.html`.
- Default `VITE_AUTH_ENABLED: "false"` in `deskEnv()`.

Launch: `PosterPal.bat` → `scripts/launch-windows.ps1` (also starts a hidden `npm run worker`). Tray rebuilds every 30s: Open, browser, copy LAN + get-app URL, Quit (sets `app.quitting` — **stops the phone from reaching :8080**). `window-all-closed` does **not** quit. Single-instance lock. Portable EXE: `npm run desktop:build` → `release/PosterPal.exe`.

### Android (`capacitor.config.json`, `android/`)

APK is a **WebView of the desk**. Never put App Secret or master key in the APK.

- Boot: `mobile-www/index.html` / `public/get-app.html`
- Build: `npm run mobile:apk` (`cap sync` + `scripts/patch-android.mjs` + `scripts/assemble-apk.mjs`)
- Sideload from `http://<pc-lan-ip>:8080/get-app.html` which hits **`GET /api/apk`** (`server/middleware/apk.ts`). Search order: Electron `resources/apk/PosterPal.apk`, `apk/`, `release/PosterPal.apk`, debug `app-debug.apk`. 404 JSON if none exist.
- Pairing: Settings → Pair device → `ppd_` bearer

### PWA

`public/manifest.webmanifest`, `public/sw.js`, Grok install chrome under `public/__grok/`. Service worker caches **app shell only**, never tokens.

### `.NET` kernel (`desktop/`) — not the product you run

- `AppSecretProof.Compute` — HMAC-SHA256 hex, same as JS
- `GraphConstants` — v26.0, loopback `:55443` (WPF leftover, **not** Electron `:8080`)
- `OAuthUrlBuilder` — **missing** `display=popup` and `auth_type=rerequest` that JS sends
- `PublishPayloadBuilder.Draft` still sets `unpublished_content_type=DRAFT` — **do not copy into TS**
- `GraphErrorMapper.Kind` — same code table as `mapGraphError`
- `Policy/PolicyChecklist.cs` — empty-caption, Jaccard 0.82/0.55, merch `#ad` warn, alt, AI info. **No cadence, no remix-required, no cross-page.** Tests lock the stale DRAFT payload and `:55443` redirect.
- `desktop/build.ps1` — class library tests, **no EXE**

---

## 15. Scripts, tests, CI, Docker

### npm scripts (`package.json`)

| Script | What |
| --- | --- |
| `dev` | Vite `:8080`, auth **off** (`cross-env VITE_AUTH_ENABLED=false`) |
| `build` | Vite + Vercel Nitro + migrate, auth off |
| `build:auth` | same as `build` but `VITE_AUTH_ENABLED=true` |
| `build:selfhost` | `NITRO_PRESET=node-server`, auth **on** (Docker) |
| `build:desk` | node-server + `prepare-desktop.mjs`, auth off (Electron) |
| `build:dev` | `vite build --mode development` |
| `preview` | Vite preview `:8080` |
| `desktop` / `desktop:build` | Electron / portable EXE (`release/PosterPal.exe`) |
| `e2e:ui` | Playwright UI mode |
| `worker` | `tsx scripts/worker.ts` |
| `db:migrate` | `node scripts/migrate.mjs` |
| `test` | `tsx --test scripts/**/*.test.mjs` |
| `e2e` | Playwright (`e2e/`, port 8081, `PGLITE_MEMORY=1`) |
| `verify` | typecheck + lint + test + e2e |
| `mobile:sync` / `mobile:apk` | Capacitor + assemble |
| `lint` / `format` | eslint / prettier |

### Test files (`scripts/*.test.mjs`)

| File | Guards |
| --- | --- |
| `hmac.test.mjs` | Graph `appsecret_proof` vector (also mirrored in .NET tests) |
| `phase0.test.mjs` | error map, schedule window, feed payload, per-Page fitness, FB name rules, carousel warning |
| `silent-bugs.test.mjs` | cadenceLevel, `#ad`/`#sponsored`, remix-required block, duplicate block, Reel geometry, Failed toast is not success |
| `db-pglite.test.mjs` | disk dir, `PGLITE_MEMORY=1` |
| `research.test.mjs` | query planner, locale, stop-words |
| `briefing.test.mjs` | collisions / remix |
| `slots.test.mjs` | posting slots parse |
| `devices-auth.test.mjs` | `ppd_` token |
| `oauth-origin.test.mjs` | redirect candidates |
| `providers.test.mjs` | provider catalog |
| `brand-check.test.mjs` + `brand-check.mjs` | no illegal Meta names in chrome |
| `grok-pwa-plugin.test.mjs` | PWA injector |

E2E: `e2e/smoke.spec.ts`, `composer`, `calendar`, `inbox`, `drafts`, `later`, `analytics`, `agent`, `connect`, `fleet`. Serial (`workers: 1`). Known flake surface: some Radix tabs historically; calendar/drafts moved toward native tabs.

### Other scripts

| Script | What it actually does |
| --- | --- |
| `migrate.mjs` | Postgres only. No `DATABASE_URL` → skip exit 0. Else `_migrations` + one transaction per SQL file. **Not exported from `db.ts`.** |
| `backup.sh` | `pg_dump \| gzip`, keep 14, `--restore`. **Does not backup PGLite.** |
| `prepare-desktop.mjs` | Copies `pglite.wasm` / `initdb.wasm` / `pglite.data` into `.output/server/_libs` (Nitro omits them). |
| `assemble-apk.mjs` | `assembleDebug` → **`release/PosterPal.apk`** (comment in file still says `public/apk/` — ignore it). |
| `patch-android.mjs` | `usesCleartextTraffic` + `network_security_config` with **global** cleartext (`base-config`), not RFC1918-only. |
| `launch-windows.ps1` | `npm ci` if needed, firewall 8080, **starts `npm run worker` hidden**, then Electron. Close-to-tray is Electron itself. |
| `grok-pwa-plugin.mjs` | Vite PWA/OG injector; keep. |

### CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml): typecheck → lint → unit → Playwright Chromium → `build:selfhost`, then Docker image build.

### Docker

- `Dockerfile`: Node 22 Alpine, `npm run build:selfhost`, migrate then `node .output/server/index.mjs`
- `docker-compose.yml`: `postgres:17-alpine` + `app` + `worker` (`npx tsx scripts/worker.ts`), healthcheck hits `/api/health`

Env template: [`.env.example`](.env.example).

---

## 16. “I want to change X” index

| Change | Go here |
| --- | --- |
| How a post hits Graph | `publish.ts` |
| OAuth / Page import | `facebook-oauth.ts`, `src/routes/api/facebook/*` |
| Policy / cadence / Jaccard | `policy.ts`, `repo.cadenceForPage` |
| New server endpoint | `ops.ts` → `fns.ts` → route |
| Composer UI | `src/routes/composer.tsx` + `facebook-preview.tsx` |
| Inbox HITL | `src/routes/inbox.tsx` + `ops.sendReply` |
| Needs you | `devices.ts` `needsYou` + `needs-you.tsx` |
| Fitness / heatmap / UTM | `operator.ts` |
| AI / agent refusals | `ai.ts`, `agent.ts`, `research.ts` |
| Agent UI | `src/routes/agent.tsx` |
| Schema | new `migrations/00NN_*.sql` — never edit 0001 |
| Scopes / Graph version | `constants.ts` |
| Worker jobs | `scripts/worker.ts` + `ops.tick` |
| Bulk CSV | `csv.ts` + `ops.bulkSchedule` + `bulk-scheduler.tsx` |
| RSS drafts | `rss.ts` + `ops.rssDrafts` |
| Recycle | `publish.recycleDuePosts` + `ComposerInput.recycleAfterDays` |
| Needs you kinds | `devices.needsYou` |
| Encryption | `crypto.ts` |
| Auth wall | `email-password.ts` (toggle), `login.tsx` (forms), **not** `server.ts` |
| Device pairing | `devices.ts`, `verify.server.ts` (`ppd_`) |
| Windows EXE | `electron/main.mjs` |
| APK | `capacitor.config.json`, `scripts/assemble-apk.mjs`, `mobile-www/` |
| Practice fleet | `fleet.ts` + `seed.ts` |
| Facebook setup copy | `SETUP.md` + `facebook-docs.ts` + Connect / Settings UI |
| .NET HMAC | `desktop/PosterPal.Core/Graph/AppSecretProof.cs` |

---

## 17. Data flow (happy path)

```
Composer submit
  → policyFn (live UI flags, 250ms debounce on the page)
  → composeFn → ops.compose → saveAndDispatch
       ├─ alsoPageIds?  LocalDrafts with remixCaption (never identical live posts)
       ├─ mode now      status Publishing → attemptGraphPublish → Published
       ├─ mode schedule in 10m–30d window? Graph FacebookScheduled
       │                 else LocalScheduled (including all Stories)
       └─ drafts        LocalDraft / FacebookDraft (Story fb-draft stays local)
  → Graph error → Failed + scheduler_logs + toast + deskLog
  → tick (browser 60s tickFn / Electron POST /api/tick / worker)
       LocalScheduled due in last 10 min → CAS claim → attemptGraphPublish now
       LocalScheduled >10 min overdue → Needs you, no auto-fire
  → syncFromGraph
       skip practice / missing facebook_page_id
       GET /{page}/published_posts limit 40, comments 25
       match facebook_post_id or trailing id after `_`
       promote LocalDraft/Failed/Publishing/FacebookScheduled/LocalScheduled → Published
       pending first_comment if wasScheduled && created_by_this_app
       insights last 30 posts: post_total_media_view then post_media_view
       upsertComment: needs_reply only on INSERT (!fromPage && !hidden); updates never un-handle
       Pull from Facebook therefore does not resurrect Mark handled / E
```

Connect (popup; preview iframe never navigates to facebook.com):

```
Connect click → window.open /api/facebook/start?redirect_uri=…
  → requireUserId
  → beginFacebookOAuth:
       canonicalOrigin(localhost→127.0.0.1)
       oauth_states row: state (24 random bytes hex), user_id, expires 15 min, redirect_uri
       302 to facebook.com/v26.0/dialog/oauth (popup + rerequest)
  → Facebook redirects /api/facebook/callback?code&state
  → handleFacebookCallback:
       consume state (delete row)
       exchangeCode POST {GRAPH_BASE}/oauth/access_token (**no** appsecret_proof) for each redirect candidate until one matches byte-for-byte
       persistUserToken: fb_exchange_token long-lived (~60d); keep short if exchange fails
       debug_token; encrypt user + long-lived; invalidate prior vault rows
       importFacebookAccounts (graphCollect /me/accounts)
       facebook_last_connect_ok=1; HTML “Connected. Imported N Pages.” + postMessage to opener
  Fallback: Settings → paste Graph Explorer user token (length ≥ 20) → same persist path
```

`authMiddleware` also runs `assertSameSiteRequest` (`isolation.server.ts`): scripted cross-site / sibling `*.grok.me` fetches get **403**. Allowed: same-origin, missing `Sec-Fetch-Site` (server-to-server), top-level GET navigations (OAuth callback). Together with `__Host-` cookies.

Probe buttons (Settings): `probeTextFn` sends “ping” (16 tokens); `ok` if `/pong/i` **or any non-empty reply**. `probeImageFn` generates “solid navy square…” via `imaginePhoto` (the still is persisted). `updatePageVoice` / `updatePageCadence` are silent no-ops on a stale Page UUID (no “Page not found”).

`refreshVaultTokens`: skip if `last_validated_at` < 6h; re-exchange if expiring in <21 days or already expired; Graph 190 invalidates the vault (intentional — do not “fix”).

### 17.1 Needs you (`devices.needsYou`)

Max 16 items, sorted `now` → `soon` → `info`:

| kind | Source | Action |
| --- | --- | --- |
| `overdue` | `LocalScheduled` with `scheduled_publish_time < now` (limit 8) | publish from Drafts |
| `failed` | `status = Failed` (limit 6) | retry; media still on the row |
| `comment` | `needs_reply && !hidden`, ranked `isBuyingIntent` (+4) / `inGoldenHour` first hour (+3) | `/inbox?comment=&page=` |
| `token` | vault `expires_at` expired or ≤7 days | Settings → Reconnect |
| `cadence` | page warn or block | Composer |

Buying-intent regex lives in `operator.ts` (`how much|price|where can i buy|…`). `desk.ts` has a parallel helper — prefer `operator.ts`.

### 17.2 Practice seed (`seed.ts` + `fleet.ts`)

`bootstrapApp`: if the operator has **no** pages, `seedPracticeWorkspace` inserts **North Shore Books** (CREATE_CONTENT) + **Winona Weekend** (no ADVERTISE/MANAGE) with mixed Published / LocalScheduled / FacebookScheduled / LocalDraft / Failed / overdue polaroid (**2 hours** ago, Photo) so Needs you is never empty, plus merch, comments (`localSentiment`), ideas, snippets. Then `expandPracticeFleet` fills the other eight from `PRACTICE_FLEET` (10 total). If **any** live (`is_practice=false`) Page exists, expand **and** `ensureOverduePractice` are no-ops. `ensureMemory` is gated by `memory_seeded_once` — deleted Later cards stay gone.

`getSql()` is **server-only** (throws if `window` is defined). Empty `DATABASE_URL` is treated as unset. PGLite applies `import.meta.glob("/migrations/*.sql")` into `_migrations` in a serialized chain. `scripts/migrate.mjs` does the same against Postgres (`pg`, one transaction per file) and **exits 0** when `DATABASE_URL` is missing.

`uniquenessScore = round((1 - worstJaccard) * 100)` vs the rest of the fleet. Identity planner flags a Page when uniqueness &lt; **55**, or it has no voice/category/merch (live), never published/queued (live), or a duplicate name.

### 17.3 Crypto (why a lost key is fatal)

```ts
const material =
  process.env.POSTERPAL_MASTER_KEY ||
  process.env.BETTER_AUTH_SECRET ||
  process.env.GROK_AUTH_CLIENT_SECRET ||
  PREVIEW_FALLBACK_KEY; // "posterpal-preview-entropy-not-a-secret"
if (material === PREVIEW_FALLBACK_KEY && process.env.NODE_ENV === "production")
  throw new Error("POSTERPAL_MASTER_KEY … is required in production.");
return createHash("sha256").update(material).update("posterpal.dpapi.standin").digest();
// AES-256-GCM, payload v1.{iv}.{tag}.{ciphertext} base64url
```

There is **no rotation path**. Changing the key makes every `*_enc` column decrypt to `null` → “Reconnect Facebook”.

### 17.4 Agent refuse + offline path

```ts
const REFUSE_RE =
  /\b(post (this |it )?now|publish (it|this|now|for me)|auto[- ]?(post|reply|like|comment|follow|share)|send (all|the replies|replies)|reply to (every|all)|go live without me)\b/i;
```

Refuse returns immediately — no model call. No `XAI_API_KEY`: still runs `planSearchQueries` + unverified desk-topic notes + `offlineCaptions` **and** `formatDeskSystemContext` (health/needs/logs/cadence). Diagnose briefs persist that block in `summary`. `liveSearch: false`; toast “Drafted without live search — verify facts.” Live search excludes `facebook.com` / `instagram.com` / `threads.net`.

---

## 18. Environment

See [`.env.example`](.env.example). Actually read by code:

| Var | Role |
| --- | --- |
| `DATABASE_URL` | Postgres. Unset → PGLite. Worker prefers this. |
| `VITE_AUTH_ENABLED` | `"false"` = no login. Anything else = wall. Baked at **build** time. |
| `BETTER_AUTH_SECRET` | Session signing; encryption fallback |
| `BETTER_AUTH_URL` | Public origin behind reverse proxy |
| `POSTERPAL_MASTER_KEY` | AES-GCM vault. Required in production. |
| `POSTERPAL_ADMIN_EMAIL` / `_PASSWORD` | Seed first operator |
| `XAI_API_KEY` | Grok captions / agent / Imagine |
| `POSTERPAL_WORKER_INTERVAL_MS` | Worker period |
| `POSTERPAL_USER_ID` | Worker operator override |
| `PGLITE_MEMORY` / `PGLITE_DATA_DIR` | Embedded DB |
| `PORT` / `NITRO_PORT` / `HOST` | Listen (default 8080 / 0.0.0.0) |
| `GROK_AUTH_*` | Optional federated Google/X |
| `VITE_PUBLIC_HOSTNAME` | OG URLs on publish |

Facebook App ID/Secret and BYO AI keys live **in the DB** (`app_settings`), not env, once pasted in Settings.

---

## 19. Capability status (code-verified 2026-09-01)

Legend: **done** in tree · **partial** · **not started** · **never** (policy)

| Capability | Status | Notes |
| --- | --- | --- |
| Compose text/photo/carousel/video/reel/story | **done** | `publish.ts` |
| Policy + cadence + cross-Page Jaccard | **done** | server-enforced |
| Calendar month/week/heatmap + drag | **done** | Native buttons `aria-pressed`. Drag: LocalScheduled/FacebookScheduled/LocalDraft/FacebookDraft/Failed. Published not draggable. Drop default 10:00; empty-day compose 13:00. |
| Inbox HITL reply/hide + buying-intent | **done** | |
| Analytics 7/28/90d + CSV | **done** | Page insights need 100+ likes |
| Media library + Imagine stills | **done** | still **data URLs in Postgres** (scale risk) |
| Merch + UTM + fitness (per-Page) | **done** | |
| Agent research (profile → search → notes → 3 captions) | **done** | HITL only |
| Agent health injected into prompt | **done** | live-model and grok-no-key; Diagnose persists in `summary` |
| Agent “Diagnose Server” / Composer / Later hooks | **done** | header health pill, Schedule in Composer, Diagnose is a brief |
| Practice fleet of 10 unique Pages | **done** | `fleet.ts` |
| OAuth + `/me/accounts` paging | **done** | `graphCollect` |
| Worker 24/7 (tick, recycle, RSS, sync, vault) | **done** | needs `DATABASE_URL` or Electron `/api/tick` |
| Docker Compose + Dockerfile + health + backup | **done** | AUDIT.md is stale on this |
| Login wall (self-host) / no-login personal desk | **done** | |
| Device `ppd_` bearer on server fns | **done** | |
| Bulk CSV → LocalDrafts/scheduled | **done** | `csv.ts`, `bulk-scheduler.tsx` |
| Recycle-after-days → remix LocalDraft | **done** | never identical |
| RSS auto-**draft** | **done** | max 5 items / feed, 10s, LocalDraft **with** `REMIX_MARK` |
| Best-time chips | **done** | `hourHeatmap(rows, timezone)` uses `zonedDayHour` / `SettingsBag.timezone`; `topSlots` prefers hours 7–21. Defaults Tue 10 / Wed 11 / Thu 10. |
| Electron EXE | **done** | `release/PosterPal.exe` |
| Capacitor APK | **done** | WebView of desk; Login stays on PC |
| PWA install | **done** | |
| CI | **done** | `.github/workflows/ci.yml` |
| `.env.example` | **done** | |
| Live Graph verification on operator’s Pages | **not started** | needs Dev-Mode App + real Pages |
| Media on disk/S3 | **not started** | `content_items.data_url` / `media_assets.data_url` |
| Editable `page_topics` pins | **not started** | Surpass R2 |
| “Dig deeper” second research pass | **not started** | Surpass R3 |
| Locale / timezone as a first-class setting | **done** | Settings picker + `loadSettings.timezone`; heatmap/chips consume it. Quiet hours still parse datetime-local. Locale inferred (`Winona` / `Minnesota` / `in City`). |
| Video/Reel cover picker | **not started** | |
| Watermarks | **not started** | |
| Public `/shop` merch block | **not started** | |
| Reports PDF / competitor Pages | **not started** | out of niche |
| Instagram Graph | **not started** | Phase 4, only if asked |
| Page Messenger | **not started** | different review |
| Full WPF UI | **not started** | `desktop/` is kernel only; Electron is the Windows bet |
| `/api/health` live vs ready split | **not started** | single endpoint is enough for Compose |
| Auto-like / auto-comment / scrape / Group spam | **never** | Surpass §12 |

Phase 0 silent bugs from Surpass §8 (error 100, reschedule duplicate, token wipe, scheduler claim, page-id remap, sync promotion, cadence window, video id, graphCollect, Ctrl+Enter): **fixed in tree**. Pairing token unused (#28) is **fixed** (`ppd_` in `requireUserId`).

---

## 20. Desk Agent vs `fullagencyplan.md` vs `Desktop/fullyagentic`

**PosterPal Agent** is a **research + ops assistant** inside this desk. It must not become a general coding harness.

| Plan item (`fullagencyplan.md`) | Code |
| --- | --- |
| Phase 1: inject `readDeskHealth`, `needsYou`, logs into agent prompt | **done** — both paths; cadence + dueSoon included |
| Phase 2: Diagnose Server button | **done** (`agent.tsx`) — copy says it is a brief |
| Phase 2: Schedule in Composer / Save to Later | **done** — distinct Schedule button prefills `when` |
| Phase 2: Server Health Status Pill **in Agent header** | **done** (`deskHealthFn`) |
| Phase 3: typecheck / lint / test / e2e recorded | see `fullagencyplan.md` execution log |

`C:\Users\mnril\Desktop\fullyagentic\Uber_Agentic_Framework.md` is a **separate** DeepSeek+Grok meta-kernel sketch (event bus, self-healing swarms). It is **not** part of this repo and must not be merged into PosterPal’s HITL Graph desk.

Deepening research (Surpass §17.6 R1–R8): keep refuse-regex (R1, ongoing), pin topics (R2 not started), gated dig-deeper (R3 not started), Jaccard-negative examples (R4 not started), locale setting (R5 partial), comments as inbox intent not web sources (R6 mostly true today), `from_date` freshness (R7 not started), never auto-post-best-angle (R8 — keep).

---

## 21. Faults / debt (honest)

1. **Media as data URLs in Postgres** will melt at a few hundred photos/videos. `content_items.data_url` and `media_assets.data_url`. `resolveMedia` also accepts `http(s)` URLs (Graph `url=` upload). Next step: files on disk / S3; keep `created_with_ai`.
2. **Local scheduler is not 24/7 Graph.** Overdue >10 minutes needs a human click. Limit 8 due posts per tick. Practice “publishes” only locally (`practice_` ids).
3. **Stories/Reels** exist but are the least battle-tested. Stories cannot be Graph-scheduled.
4. **Carousel partial success** is a warning, not `Failed`.
5. **Reschedule Graph PATCH failure** can leave the original Facebook slot plus a local row.
6. **Two `resolvePageId` functions remain** (`page-id.ts` and `ops.ts`) but **both** now refuse stale ids (`undefined`). `ops` list/analytics/media/calendar return empty on a stale provided id (never remap to `pages[0]`). Writes still throw via `getPage`.
7. **Quiet hours** still parse `T(\d{2})` from a datetime-local string and treat **23:00–06:00** as quiet. Heatmap/chips use `SettingsBag.timezone`.
8. **Cadence counts scheduled-in-window (±24h)**, not only Published. Reels have a separate Meta **30/24h** API cap.
9. **`desk.ts` vs `operator.ts`** overlap. Prefer `operator.ts`.
10. **`fns-handled.ts` is unused.** `ops.markCommentHandled` also copies `inbox-extra.ts` SQL.
11. **Graph-ahead scheduler** CAS-claims `Publishing` before `attemptGraphPublish(..., "schedule")`; on failure it reverts to `LocalScheduled` so the next tick can retry. Due-now CAS is unchanged.
12. **RSS** max **5** items, **10s** abort, exact-or-remix dedup, **with** `REMIX_MARK`.
13. **Agent Diagnose** is a brief, not a diagnostic API. Health is also on the Agent header pill.
14. **Encryption key rotation** does not exist.
15. **Facebook hostname / `localhost` vs `127.0.0.1`.** `canonicalOrigin` rewrites it; the Facebook App still has to match.
16. **Insights** lock at `fan_count < 100`. Token errors abort that Page’s remaining insight loop; other errors `continue`.
17. **Vault expiry on HomeSnapshot is desk-wide** (`token_vault` latest row). Fitness is per-Page except that vault item.
18. **Caption length:** `captionStats` — empty / ≤80 news-feed preview / ≤500 / ≤**63206** Graph hard limit / over. Hashtag trim default **3**.
19. **Unfurl SSRF guard** (`unfurlHostBlocked`): loopback, RFC1918, link-local, `facebook.com` / `fb.com` / `instagram.com` / `meta.com`. 4s abort, `res.ok` required, final redirect host re-checked. Composer “paste a shop URL”, not Facebook.
20. **OAuth popup** polls every 800ms for **180s**; Electron uses the system browser so `postMessage` often never fires — poll is the real path.
21. **`ComposerPrefill`** now includes `when`, `firstComment`, `recycleAfterDays`, `link`. `ComposerInput` still has `mode` / `alsoPageIds` which hops do not set (Composer infers schedule from `when`).
22. **`recycleDuePosts` copies each media row with its own `randomUUID()`.** Carousel recycle no longer collides on `content_items.id`.
23. **`recordLog` Graph success path** is the real edge (`/feed`, `/photos`, `/videos`, `/video_reels`, `/photo_stories`).
24. **`persistUserToken` invalidates every valid vault row for the user**, then inserts the new one. `refreshVaultTokens` on Graph 190 invalidates **that row only**; `attemptGraphPublish` 190 sets **all** `token_vault.is_valid=false`.
25. **`ensureMemory`** sets `memory_seeded_once` in the same call as the first idea insert.
26. **`graphFetch` timeout 100s / `graphMultipart` 180s.** Retryable Graph JSON: 5 / 4 attempts. `weekPlanner` (Home strip) swallows SQL errors → empty week.
22. **Settings “Seed practice Pages” copy** describes the 10-Page practice fleet. `startPractice` still runs `expandPracticeFleet`.
23. **Connect coach checkboxes** are local React state only — they do not persist or gate Connect.
24. **APK boot** (`mobile-www/index.html`) **rejects** `127.0.0.1`/`localhost`; health-checks `{origin}/api/health` (4s) then navigates to `{origin}/`. Persist `posterpal-desk-url`.

---

## 21.1 Constants cheat sheet (do not drift)

| Thing | Value | Where |
| --- | --- | --- |
| Graph version | `v26.0` | `constants.ts` |
| Schedule window | 10 min – 30 days | `facebookScheduleWindow` |
| Due-now fire window | last 10 minutes, limit 8 | `tickScheduler` |
| Stuck Publishing | 2 minutes | `tickScheduler` |
| Health “fresh” | 3 minutes | `readDeskHealth` |
| Desk Graph sync throttle | 120s | `ops.tick` |
| Token refresh skip | last validated < 6h; else if expiring in <21 days | `refreshVaultTokens` |
| Token alarm | ≤7 days | `vaultAlarm` / Needs you |
| Jaccard warn / block | 0.55 / 0.82 | `policy.ts` |
| Collision strip | 0.72 | `briefing.findCollisions` |
| Cadence default | warn 8 / block 20 | `pages` columns |
| Reel | 9:16 ±0.08, 540×960, 3–90s, 30 API posts / 24h | `validateReel`, `reelCapLevel` |
| RSS | 5 items, 10s | `fetchFeedItems` |
| Pairing | 6-digit, 10 min, `ppd_` | `devices.ts` |
| OAuth wait | 180s poll | `connect-client.ts` |
| Quiet hours | 23:00–06:00 | `isQuietHour` |
| Golden hour | first 60 minutes of a comment | `inGoldenHour` |
| Fitness | 7 checks, score = 100 * ok/7 | `monetizationFitness` |
| dueSoon cap | 24 | `bootstrapApp` |
| graphCollect | limit 100, max 20 pages | `graph.ts` |
| Identity planner flag | uniqueness &lt; 55 | `briefing.identityIssues` |
| Imagine prompt | min 8 / max 700 chars | `ops.imaginePhoto` / Media route |
| Pair token storage | `localStorage posterpal-device-token` | `pair.tsx` |
| APK desk URL | `posterpal-desk-url`; rejects loopback | `mobile-www/index.html` |
| Official docs cache | 1 hour; 4k stripped HTML | `facebook-docs.ts` |
| Command search | q ≥ 2 chars, 180ms debounce | `command-palette.tsx` |
| Login rate limit | 5/min sign-in, 10/hour sign-up, 100/min global | `auth/server.ts` |
| Composer file cap | **6MB** per file (client ingest) | `composer.tsx` `ingestFiles` |
| Pairing code | `randomInt(100000, 1000000)`, 10 min, one-shot | `devices.createPairingCode` |
| LLM chat timeout | 40s; variants 900 tokens | `ai.ts` |
| Imagine timeout | Grok/Flux 45s; OpenAI/Gemini 60s | `ai.ts` |
| Imagine library | persist `media_assets`, trim last **60**; Composer reuse **6** thumbs | `ops.imaginePhoto` |
| Unfurl HTML cap | 120_000 chars, 500ms debounce | `composer.tsx` + `ops.unfurlLink` |
| Recycle input | 1–365 days; source column nulled after one draft | `publish.recycleDuePosts` |
| Export queue | 200 rows | `ops.exportQueueCsv` |
| Inbox list | 120 comments | `repo.listComments` |
| Sync feed | 40 posts / 25 comments; insights 30 posts | `sync.ts` |
| Unfurl timeout | 4s; block private + facebook.com | `ops.unfurlLink` |

---

## 22. Keeping this file current

Update **this file in the same PR/change** when you:

- Add or rename a file under `src/lib/posterpal/` or `src/routes/`
- Add a `createServerFn` (append to §7)
- Add a migration (append to §10)
- Add a worker job (append to §11)
- Finish or abandon a capability (edit the table in §19)
- Change auth, Graph version, or a non-negotiable law

Do **not** copy whole function bodies here. Point at the file. Status cells must match the tree, not the last plan document.

Suggested header bump: change **Last verified** date when you re-audit.

Do not copy whole function bodies here unless a threshold or branch is the law (Jaccard 0.82, 10-minute overdue, POST-timeout no retry). Point at the file.

---

*PosterPal — compose, schedule, moderate, analyze, monetize. Official Graph v26.0. A human clicks Send.*
