# PosterPal

Personal CRM for the Facebook Pages you administer. Compose, schedule, publish, moderate, and analyze — then monetize through better content ops, not banned engagement automation.

**Official Graph API v26.0 only.** No scraping, no unofficial login, no auto-likes, no auto-comments. AI may draft; a human clicks Send.

**Facebook App display name:** register it as **PosterPal**. Meta rejects Book / Face / FB / Facebook / Meta. That is why this desk is no longer BookBoss.

---

## What this is

A **single-operator Facebook Pages desk** for unlimited Pages you already admin (bookstore, events, merch, local brands). Buffer/Hootsuite optimize reach. PosterPal optimizes **selling books, totes, and tickets** without getting the Page suspended.

It is **not** a 12-network SaaS, Ads Manager, Group mass-poster, or engagement bot.

Facebook is optional. First open **auto-seeds** a 10-Page practice fleet (`bootstrapApp` → `seedPracticeWorkspace` + `expandPracticeFleet`) and marks setup complete. The `/setup` wizard is still there if you want the Facebook walkthrough; it is not a hard gate.

### Two ways to run it

| Mode | Login | Who |
| --- | --- | --- |
| **Personal desk** (default) | None. Open it and work. | Windows EXE, `npm run dev` |
| **Self-host** (Docker) | Email/password wall | A machine you control, HTTPS origin |

---

## What you can do

1. **Pages** — rail of every Page. Practice fleet of 10 distinct identities, or Connect once and import all Pages with `CREATE_CONTENT` from `GET /me/accounts` (paged; more than 25 is fine). Graph **cannot create Pages** — create them on facebook.com, then import.
2. **Composer** — default mode is **Local draft** (Send does not hit Graph until you pick Publish now / Schedule / Facebook draft). **Ctrl+S always** saves a local draft even if another mode is selected. Caption, local media (multipart / rupload, **6MB per file** or a public https URL), merch CTA + optional first-comment shop URL, policy, cadence (block still allows local-draft), three AI variants, recycle-after-days (1–365, one-shot on the source), “also draft on” remix. Photo input is `multiple` but Graph Photo uses `media[0]`; extras toast “Switch to Carousel”. Shared `busy` lock (Send / variants / Imagine). Analyze-only Pages can only local-draft. Local-draft Send does **not** clear the box.
3. **Calendar** — This Page / All Pages. Month / Week / Heatmap (`aria-pressed`). Drag scheduled, drafts, and Failed — not Published. Drop dialog defaults to **10:00**; empty-day compose **13:00**.
4. **Inbox** — needs / hidden / all / buying-intent. Pull from Facebook. Reply drafts are suggestions. **Send** POSTs `/{comment-id}/comments`. **Hide** POSTs `is_hidden`. Practice comment ids skip Graph. Sending lock prevents double-submit. **E** marks handled (`needs_reply=false`) without a Graph reply.
5. **Drafts / Later** — tabs Drafts / Scheduled / Failed (`data-view`). Restore Cancelled → LocalDraft. Queue CSV `page,status,when,caption,link` (limit 200). Later Kanban never posts.
6. **Analytics** — 7 / 28 / 90 day charts. CSV `id,published,message,reactions,comments,shares,media_views,variant`. A/B card only when two labeled variants share a `variant_group_id` (human reuses the leader; no auto-pick). Page Insights need 100+ likes; post views come from `post_total_media_view` / `post_media_view`. A **stale** Page id on reads returns empty (never remaps onto `pages[0]`). An omitted id still defaults to the first Page.
7. **Media / Merchandise** — library for the selected Page. Imagine prompt ≥ 8 characters; stills are flagged `createdWithAi` and open in Composer (nothing posts from Media). Merch default UTM `utm_source=facebook&utm_medium=social&utm_campaign={slug}`; **Use in Composer** applies it. A merch URL makes policy warn for `#ad`.
8. **Agent** — five personas (Research, Ops, Inbox, Shop, Rewrite) pick named skills (web research, diagnose, captions, inbox drafts, failed rewrite, merch CTA, policy, next slot). Still HITL. Researches the **public web** (not a Facebook scrape) from this Page’s desk profile, takes notes, drafts three captions. `agentWouldRefuse` matches `post now` / `auto-reply` / `send all replies` / `go live without me` and returns **without calling a model**. No `XAI_API_KEY`: still shows a query plan + unverified desk notes (never fake citations). Every run injects a **DESK OPS snapshot** plus HITL hops (Composer, schedule, Later, failed row inspector, vault, inbox). **Draft inbox replies** stores drafts on the comment — you still click Send. **Fix failed publishes** remixed captions open Composer. Needs you **Ask agent** queues a brief. Story captions get a policy preview. Schedule can prefill merch link, first comment, and recycle-in-30d.
9. **Connect / Pair** — `/connect` is the 6-step official Login coach. Connect opens `/api/facebook/start` in a **popup** (`display=popup`, `auth_type=rerequest`) so the desk iframe never navigates to facebook.com. Callback consumes a 15-minute `oauth_states` row and exchanges the code against the **exact** stored redirect URI. Graph Explorer paste (token length ≥ 20) is the fallback. Pairing: `/pair` (no Guard).
10. **Vault / Settings** — AES-GCM token vault, scheduler logs, **Desk health** (DB + in-tab ticker vs background worker). The header chip is **Desk live** (DB up and a ticker in the last 3 min), **Desk idle** (DB up, no ticker), or **Desk down**. App ID/Secret, per-Page cadence/voice/RSS/slots, **audience time zone** (heatmap and best-time chips), BYO keys (chat **40s**; Imagine Grok **45s** / OpenAI **60s** / Gemini **60s** / Flux **45s**). After Connect, practice Pages hide from the rail unless you turn hide-practice off. Rail label is **Token vault**. `/pair` and `/setup` are not in the rail. Command palette **Phone / APK pairing** goes to `/pair`.

Keyboard (Windows; `shortcut-help.tsx`): **Ctrl+K** command palette, **Ctrl+Enter** Composer send (selected mode), **Ctrl+S** local draft, **Esc** clear Composer, **N** new post, **J/K** inbox, **E** mark handled, **?** cheat sheet.

Later board columns (never posted): Inbox → Photo needed → Caption ready → Offer this week.

---

## Current state (verified in source, 2026-09-01)

The desk is a **working personal product**: compose → policy → publish/schedule → calendar → inbox → analytics. The queue fires without a browser tab when **Electron is running** (60s `/api/tick`) or when **`npm run worker` / Docker worker** has `DATABASE_URL`. If both are stopped, overdue `LocalScheduled` posts wait in Needs you after 10 minutes — they are not sprayed late.

It is **not** “finished as a public internet SaaS.” Live Graph on *your* Pages still needs your Dev-Mode Facebook app. Media still lives as data URLs in Postgres. The research agent is a drafter, not an autopilot.

Older write-ups disagree with the tree. Trust this table:

| Claim in old docs | Reality now |
| --- | --- |
| AUDIT.md: no Docker, CI, `.env.example`, backup, health, login, bulk, RSS, recycle | **All exist** |
| Surpass.md: practice fleet is 2 Pages; worker is a sketch | **10 Pages**; worker ticks recycle + RSS + Graph |
| Surpass §8 critical/high bugs | **Fixed** (error 100, duplicate reschedule, token wipe, scheduler claim, page-id remap, …) |
| Pairing token unused | **Fixed** — `Authorization: Bearer ppd_…` resolves to `devices.user_id` |
| `fullagencyplan.md` Phase 3 “verified” | **Not recorded** — see [Desk Agent](#desk-agent-full-agency-plan) |

### Scorecard

| Area | State |
| --- | --- |
| Core compose / schedule / inbox / analytics | Live |
| Policy + cross-Page duplicate guard | Live, server-enforced |
| Worker (queue, recycle, RSS drafts, sync, vault) | Live (`npm run worker` or Docker; Electron ticks locally) |
| Docker self-host + login wall + `/api/health` | Live |
| Electron Windows app + sideload APK | Live |
| CI (typecheck, lint, unit, e2e, image build) | Live |
| Live Graph on a real Page | **Blocked on your Facebook credentials** |
| Disk/S3 media (not data URLs) | Not started |
| Instagram / Messenger / Ads / WPF shell | Not started / out of scope |

### Done vs left vs never

**Shipped**

- Vertical slice above, 10-Page practice fleet, fleet home + uniqueness, per-Page cadence
- Bulk CSV, RSS → LocalDraft, recycle-after-days → remix draft
- Docker Compose (Postgres 17 + app + worker), Dockerfile, `.env.example`, `scripts/backup.sh`
- Login wall for self-host; personal desk stays no-login
- Electron EXE, Capacitor APK as a WebView of the PC desk, PWA
- Device pairing that actually auths writes (`Bearer ppd_…` before the auth-off shortcut)
- Desk logs + health stamps; Agent injects server/queue context on **both** live-model and grok-no-key paths (Diagnose persists it in the summary)
- Cross-Page Jaccard + remix-required so a 10-Page fleet cannot ship identical copy

**Needs work (real product gaps)**

- Prove publish/reply/schedule on a **live** Dev-Mode Page (you)
- Store photos/videos as files, not megabyte data URLs
- Data-driven best-time beyond this Page’s heatmap chips (chips now use the saved audience time zone)
- Video/Reel cover picker; Stories/Reels still the least tested Graph path
- Pin editable Page topics; optional “Dig deeper” research pass
- Document encryption-key rotation (lost key = dead vault)
- Rehearse clean-machine: `docker compose up` → overnight worker → backup/restore
- Quiet hours are 23:00–06:00 parsed from a datetime-local string (audience zone is used for heatmap/chips, not yet for quiet-hour math)
- RSS: newest **5** items per feed, 10s timeout, LocalDraft **with remix prefix** (rewrite before Send)
- Fitness score on Home is `100 * (checks passed / 7)`: 100+ likes, merch link, ≥3 formats, inbox <8, no Failed rows, token >7 days, cadence under warn.
- Composer rejects files **over 6MB** (toast: compress or paste a public https URL for Graph to fetch).
- **Duplicate next week** (`duplicateNextWeekFn`) clones onto the **same** Page with `+7 days` and the **same caption**. Policy Jaccard will usually **block** that as a duplicate unless you rewrite first.
- Cancel/delete of a post this desk created issues Graph `DELETE /{id}`. Posts not `created_by_this_app` cannot be deleted here.

**Not started (optional later)**

- Public `/shop` merch block, watermarks, PDF reports, competitor Pages
- Instagram Content Publishing, Page Messenger (HITL only, different App Review)
- Full WPF UI (`desktop/` is a .NET HMAC/policy library only — the Windows app is Electron)

**Never (Meta / product law)**

- Auto-like, auto-comment, auto-follow, auto-share, auto-DM
- Scraping, cookie login, Selenium, unofficial Graph
- Mass Group posting, buying engagement, “AI posts while you sleep” unsupervised
- Putting App Secret or `POSTERPAL_MASTER_KEY` in the APK

---

## Run it

### Windows (the usual path)

1. Double-click [`PosterPal.bat`](PosterPal.bat), or `npm run desktop`, or the portable EXE from `npm run desktop:build` (`release/PosterPal.exe`).
2. Desk listens on `http://127.0.0.1:8080` (and your LAN IP so a phone can join).
3. Data: `%APPDATA%\PosterPal\pglite` and `master.key`. No Docker required. Closing the window hides to tray; the 60s `/api/tick` keeps running until you **Quit** (that stops the phone from reaching :8080). `PosterPal.bat` also starts a hidden `npm run worker`. Facebook Login opens in the **system browser**. Feed video is a normal `POST /{page}/videos` (not resumable). Reels and video Stories use `rupload.facebook.com`.

Facebook Redirect URI for this app:

```
http://127.0.0.1:8080/api/facebook/callback
```

### Dev (this repo)

```bash
npm ci
npm run dev          # 0.0.0.0:8080, auth off, PGLite on disk (.posterpal-pglite)
```

Useful:

```bash
npm run typecheck
npm test             # scripts/**/*.test.mjs
npm run e2e          # Playwright on :8081, throwaway PGLite
npm run worker       # DATABASE_URL → in-process tick; else HTTP POST /api/tick
npm run verify       # typecheck + lint + test + e2e
npm run db:migrate
npm run desktop      # Electron (auth off). desktop:build → release/PosterPal.exe
```

`npm run dev` / `build` / `build:desk` bake `VITE_AUTH_ENABLED=false`. Docker uses `build:selfhost` (`true`). Rate limits when the wall is on: 5 sign-in attempts/min, 10 sign-ups/hour.

### Docker self-host (login wall + 24/7 worker)

```bash
cp .env.example .env   # POSTGRES_PASSWORD, BETTER_AUTH_SECRET,
                       # POSTERPAL_MASTER_KEY, POSTERPAL_ADMIN_EMAIL/PASSWORD
docker compose up -d --build
```

Open `http://localhost:8080` and sign in. Put **HTTPS** in front (Caddy/Nginx or Cloudflare Tunnel) before Facebook Login will accept a public hostname. Then set `BETTER_AUTH_URL` and paste the URLs Settings shows into the Facebook App.

Health: `GET /api/health` (no auth). Exact JSON from `readDeskHealth()`:

```json
{"live":true,"db":"up","workerLastTick":"…","schedulerLastTick":"…","workerFresh":true,"schedulerFresh":true,"status":"ok"}
```

`status` is `"ok"` if the DB answers `select 1`, else `"degraded"` (HTTP 503). “Fresh” = a tick in the last **3 minutes**.

Backup: `bash scripts/backup.sh ./backups` or `docker compose exec db pg_dump …`.

Full Facebook + TLS walkthrough: [`SETUP.md`](SETUP.md).

### Phone

The APK is a **client of the PC desk**, not a second Graph app. Sideload from `http://<pc-lan-ip>:8080/get-app.html` (HEAD `/api/apk`). The APK first screen (`mobile-www/index.html`) **rejects 127.0.0.1** — paste the LAN URL from Settings. It probes `{origin}/api/health` (4s) then loads `{origin}/`. Facebook Login stays on the PC. Pair from **Settings → Devices** (palette “Phone / APK pairing” also goes here, not `/pair`): 6-digit code (`100000–999999`), 10 minutes, one-shot, token `ppd_…`. 

Paired phones can POST `/api/sync/action` with `{ action, payload }`: `compose` | `reply` | `hide` | `handled`. That is still HITL (a human on the phone). `compose` with `mode: "now"` **will** hit Graph — the APK is not read-only.

Or install the PWA from an HTTPS origin (Safari Add to Home Screen / Chrome Install app).

**Never** put the App Secret in the APK. `appsecret_proof` requires it on the server.

---

## Facebook (Development Mode)

App Review is **not** required if only app roles (Admin / Developer / Tester) use it. Stay in Development Mode for a personal desk.

- Product: Facebook Login — Client OAuth Login and Web OAuth Login on
- Valid OAuth Redirect URI: `{this-origin}/api/facebook/callback` (Facebook treats `localhost` and `127.0.0.1` as **different** URIs. This desk canonicalizes to `127.0.0.1`.)
- App Domains: hostname only (Facebook **rejects** `127.0.0.1` here — leave empty for localhost)
- Scopes: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `pages_manage_engagement`, `pages_read_user_content`, `pages_manage_metadata`, `read_insights`, `publish_video`
- Page tokens from `GET /me/accounts`. `CREATE_CONTENT` to publish; analyze-only Pages import read-only
- Schedule window: **10 minutes–30 days** (Reels: **10 minutes–29 days**). Outside that, the local scheduler keeps the post
- Reels: 9:16, **3–90s**, min 540×960. Meta caps **30 API-published Reels / rolling 24h** on `POST /{page}/video_reels` — the desk enforces that cap (warn 25 / block 30) including scheduled Reels
- Insights: 100+ Page likes. Post-level reactions still sync without that

Paste App ID + App Secret **only in PosterPal Settings**, never in chat. The App ID is stored **plaintext** in `app_settings`; the Secret is AES-GCM. Saving credentials with a blank Secret **keeps** the old Secret. BYO AI keys work the same: empty fields do not delete a stored key.

Running 10 unique Pages: create each on facebook.com with distinct name/category/about/art, add yourself as Admin, Connect once. The desk **blocks** near-duplicate captions across Pages so the fleet does not look like a spam network.

---

## Policy, always on

Blocking flags are enforced in `saveAndDispatch` / `publishExisting` (`src/lib/posterpal/publish.ts`), not only in the Composer UI.

- **Cadence** (per Page, default warn 8 / block 20): counts Published in the last 24h, in-flight Publishing, **and** scheduled slots in the next/last 24h. A week of pre-scheduled posts can hit the cap before anything goes live. **Reels** also have Meta’s **30 API posts / rolling 24h** cap (desk warn 25 / block 30).
- **Duplicate** Jaccard ≥ 0.82 vs last 30 captions on **this** Page (`duplicate`) **and** vs other Pages (`cross-page-duplicate`). ≥ 0.55 is a warn (`similar` / `cross-page-similar`).
- **Remix required** (`remix-required`): clones, recycle copies, and “also draft on” prefix a rewrite marker. Send is blocked until you rewrite in that Page’s voice.
- Branded-content warn if a merch/shop link is present without `#ad` / paid partnership; empty caption blocks; missing alt warns; AI-media is an **info** reminder and is **not** stuffed into the caption.
- Graph errors degrade: 190 → re-auth (vault marked invalid); 4/17/32/613/80001 → backoff; schedule capability misses save locally. Never silent, never crash.

### How a post actually leaves the desk

1. Composer → `composeFn` → `ops.compose` → `saveAndDispatch`. Missing Page id **throws** (`Page not found`); it does not post onto the first Page in the rail.
2. Practice Pages never call Graph. “Publish” writes `facebook_post_id = practice_…` locally so you can learn the desk offline.
3. Live `now` → Graph (feed / photos / carousel / videos / video_reels / stories) with `appsecret_proof`. `first_comment` posts immediately only on `now`. Graph-scheduled posts get the first comment later, when sync sees them in `/published_posts`.
4. Live `schedule` inside Facebook’s **10 minute–30 day** window → unpublished Graph object. Outside that window, or for Stories, the row stays `LocalScheduled`.
5. The **local scheduler** (`tickScheduler`) only auto-fires `LocalScheduled` slots that became due in the **last 10 minutes** (max 8 per tick). Older overdue rows wait in Needs you: “Overdue — desk was closed.” Closing the EXE for an hour does **not** silently spray late posts. The worker **does not re-run policy** on those queued rows — Jaccard twins that appeared after you clicked Schedule can still go out.
6. **Cancel** marks the row Cancelled even if Graph DELETE fails (the Facebook slot may remain). **Delete on Facebook** (inspector) is the opposite: Graph failure leaves the local row Published.
7. Recycle and RSS create **LocalDrafts** only. A human still clicks Publish. Recycle prefixes the rewrite marker; RSS does **not** (policy may still block at Send if the caption twins a recent post).
8. Four things call the scheduler: Home `bootstrapApp`, the shell every 60s, Electron `/api/tick` every 60s, and `npm run worker`. Due-now uses an atomic claim. Pushing a *future* slot onto Facebook does not — don’t run extra tickers unless you want duplicate Graph objects.

Bulk CSV columns: `caption`/`message`, `when`/`date`, `page`/`pageid` (UUID or Page name). Always text posts; policy runs per row.

---

## Architecture (short)

Deep map for coding agents: **[`ARCHITECTURE.md`](ARCHITECTURE.md)** — every file, server function, migration, worker job, and “where do I change X”.

```
Electron or Docker
  → TanStack Start desk :8080
  → src/lib/posterpal/fns.ts → ops.ts → publish | graph | repo | ai
  → Postgres (DATABASE_URL) or PGLite
  → graph.facebook.com/v26.0  (+ HMAC-SHA256 appsecret_proof)
```

Every Graph call attaches `access_token` and `appsecret_proof = HMAC-SHA256(token, app_secret)` as hex (`graph.ts` `appSecretProof`). Tokens in the DB are `v1.{iv}.{tag}.{ciphertext}` AES-256-GCM (`crypto.ts`). The APK never holds the App Secret.

Why the local scheduler exists: Facebook only accepts `scheduled_publish_time` between 10 minutes and 30 days. Recurring “every Saturday forever”, Stories, and “desk was closed” slots live in `LocalScheduled` and are claimed with:

```sql
UPDATE posts SET status = 'Publishing'
WHERE id = $1 AND user_id = $2 AND status = 'LocalScheduled'
RETURNING id
```

A lost race (two ticks) skips the row. POST timeouts are **not** retried — retrying would duplicate the Facebook object.

| Piece | Path |
| --- | --- |
| Product domain | `src/lib/posterpal/` |
| Screens | `src/routes/` |
| Shell | `src/components/app-shell.tsx` |
| Schema | `migrations/0001_auth.sql` … `0011_page_picture_slots.sql` |
| Worker | `scripts/worker.ts` |
| Windows shell | `electron/main.mjs` (not `desktop/`) |
| .NET HMAC tests | `desktop/PosterPal.Core` |
| APK | `android/` + `capacitor.config.json` |

Stack: React 19, Vite 8, TanStack Start, Tailwind v4, Radix, zustand, Better Auth (optional), `pg` / PGLite.

---

## Desk Agent (full-agency plan)

The in-app Agent (`/agent`, `src/lib/posterpal/agent.ts`) is a **research desk with ops visibility**, not an autopilot and not a general coding harness.

[`fullagencyplan.md`](fullagencyplan.md) (2026-08-30) asked for 360° awareness of worker, DB, tokens, and queue, plus one-click hops into Composer / Later.

| Phase | Intent | Status |
| --- | --- | --- |
| 1 | Inject `readDeskHealth`, `needsYou`, recent `desk_logs` into the agent prompt | **Done** — live-model and grok-no-key paths; Diagnose persists it in the summary |
| 2 | Diagnose Server button; Open in Composer; Save to Later | **Done** |
| 2 | Server Health Status Pill **in the Agent header** | **Done** (`deskHealthFn`, Vault-shaped copy) |
| 2 | Distinct “Schedule in Composer” | **Done** — prefills `when` from this Page’s next slot |
| 3 | Record typecheck / lint / unit / e2e after those changes | See execution log in `fullagencyplan.md` |

Still open from Surpass §17 (deepen research, in order): keep the refuse-regex (ongoing), operator-pinned page topics, gated “Dig deeper” second search, Jaccard-negative examples so drafts aren’t twins, comments as inbox intent not web sources, optional freshness window. **Never** add “auto-post best angle at 9am”.

`Desktop/fullyagentic/Uber_Agentic_Framework.md` is a **different project** (DeepSeek + Grok meta-kernel). Do not fold it into this Facebook desk.

---

## Docs map

| File | Use |
| --- | --- |
| **This README** | Product, status, how to run |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Anatomy for agents — **keep it updated when you change the tree** |
| [`SETUP.md`](SETUP.md) | Facebook App, Graph facts, Docker, backups |
| [`fullagencyplan.md`](fullagencyplan.md) | Agent awareness plan (status above) |
| [`Surpass.md`](Surpass.md) | Strategy, Meta rules, competitor gaps — **§8 bug list and some “missing” features are stale** |
| [`PLAN.md`](PLAN.md) | 10-Page fleet pass (2026-08-30) — largely enacted |
| [`AUDIT.md`](AUDIT.md) | 2026-08-28 industry audit — **security/deploy rows are stale** |
| [`AGENTS.md`](AGENTS.md) | Grok Build sandbox contract (preview `:8080`) — not product docs |
| [`desktop/README.md`](desktop/README.md) | The .NET folder is not the Windows app |

---

*PosterPal — compose, schedule, moderate, analyze, monetize. Official Graph v26.0. A human clicks Send.*
