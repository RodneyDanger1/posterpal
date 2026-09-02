# PosterPal — Industry-Standards Audit & Modernization Roadmap

> **Stale on deploy/security rows.** Re-verified 2026-09-01: Docker, Compose, CI, `.env.example`, backup, `/api/health`, login wall, bulk CSV, RSS drafts, and recycle **exist**. Use [`README.md`](README.md) + [`ARCHITECTURE.md`](ARCHITECTURE.md) for current status. This file remains useful as the original gap analysis.

**Date:** 2026-08-28
**Method:** Live codebase verification (19,065 LOC across `src/` + `scripts/`) + Meta Graph API v26 permission model + competitor research (Buffer, Hootsuite, Publer, Postiz, Mixpost) + OWASP 2025 / Secrets Management Cheat Sheet.
**Principle:** Every number below was checked against the running repo, not estimated. Claims that could not be verified are labeled as such.

---

## 1. What PosterPal is (purpose)

A **single-operator Facebook Pages "monetization-ops" desk** — not a general-purpose vanity scheduler. Its stated job (README): compose, schedule, publish, moderate, analyze, then *monetize* through content ops (merch catalog, UTM, shop-in-first-comment, a monetization **fitness score**, and a **buying-intent** inbox). Official Graph API v26.0 only — no scraping, no auto-likes/auto-comments, AI drafts but a human always clicks Send.

This niche is the product's core strength: Buffer/Hootsuite/Publer/Postiz optimize *reach and engagement*; PosterPal optimizes *selling books/totes/tickets*. That is a genuine, defensible position — but it also means the "industry standard" bar for a Facebook-Pages tool still includes compose/schedule/inbox/analytics/media/AI, and PosterPal is measured against that bar below.

---

## 2. Scorecard (0–100 per dimension)

| # | Dimension | Score | Verdict | Basis (verified) |
|---|---|---|---|---|
| 1 | **Purpose & positioning** | **90** | Excellent | Crystal-clear niche; distinct from 5 competitors researched |
| 2 | **Core functionality** | **78** | Strong (single-platform) | Compose/schedule/publish/moderate/analyze all live-verified |
| 3 | **Usability & UX** | **72** | Good | Radix UI, dark theme, cmd-palette, keyboard nav, toasts, drag calendar |
| 4 | **Security** | **55** | ⚠️ Not ready to expose | Strong crypto (AES-GCM + production key guard, secure `__Host-` cookies, CSRF, encrypted tokens) but auth **default-off**, `dev-user` fallback persists even when enabled, no sign-in forms, no rate limiting |
| 5 | **Reliability** | **80** | Strong | PGLite→disk fixed, real Postgres wired, worker loop proven, policy server-enforced, error boundary |
| 6 | **Self-host & deployability** | **45** | ⚠️ Not ready | No Dockerfile, no docker-compose, no CI, no `.env.example`, no backup |
| 7 | **Code quality** | **84** | Excellent | `strict: true`, 76/76 tests, 0 lint errors, Playwright E2E, clean module split |
| 8 | **Documentation** | **82** | Excellent | README + SETUP.md + Surpass.md (1,112 lines) + AGENTS.md |

**Overall (unweighted): 73 / 100.**

**Readiness verdict:** a well-architected, well-documented, genuinely functional *local/internal* tool — but **not yet "ready to use completely"** as an internet-facing self-hosted product. The two cliffs are **Security (48)** and **Self-host/deployability (45)**. Fixing those two alone moves the score to the mid-80s; feature-parity work pushes it toward 90.

---

## 3. Industry gap matrix (vs. the field)

| Capability | Buffer/Hootsuite/Publer | Postiz/Mixpost (self-host) | PosterPal (verified) | Gap? |
|---|---|---|---|---|
| Compose + caption + media | ✅ | ✅ | ✅ live | — |
| Visual calendar + drag reschedule | ✅ | ✅ | ✅ month/week/heatmap | — |
| Inbox / reply (HITL) | ✅ | ✅ | ✅ needs-reply + hide | — |
| Analytics + CSV export | ✅ | ✅ | ✅ 7/28/90d + CSV | — |
| Media library | ✅ | ✅ | ✅ `/media` | — |
| AI assistant / captions | ✅ | ✅ | ✅ `/agent` + 3 variants | — |
| Best-time-to-post (data-driven) | ✅ (Publer) | ✅ (Postiz) | ⚠️ heuristic slot only (`best.time` = 0 hits) | **Gap** |
| Bulk scheduling (CSV import) | ✅ (Publer) | ✅ | ❌ (`bulk` = 0) | **Gap** |
| Post recycling / repeat cadence | ✅ (MeetEdgar/Publer) | ✅ (Postiz) | ❌ (`recycl`/`recurring` = 0 in src) | **Gap** |
| RSS auto-post | ✅ (Buffer) | ✅ (Postiz) | ❌ (`rss` = 0) | **Gap** |
| Team roles / approvals | ✅ | ✅ | ❌ by design (single operator) | Deliberate |
| Multi-platform (IG/X/LI) | ✅ | ✅ | ❌ by design (FB-only) | Deliberate |
| Native mobile app | ✅ | partial | ⚠️ pairing + desktop WPF only | **Gap** |
| Self-host: Docker + CI + backup | n/a (SaaS) | ✅ | ❌ (none of the three) | **Critical gap** |
| Login / per-user auth | ✅ | ✅ | ❌ disabled by default | **Critical gap** |

Deliberate gaps (single-operator, FB-only) are **not** defects — they are the product. The *actionable* gaps are the industry-standard capabilities a solo Page operator would still expect: **bulk scheduling, recycling, data-driven best-time, RSS auto-post, a mobile/APK client, Docker+CI+backup, and a real login.**

---

## 4. What is already strong (do not re-litigate)

- **Policy engine is server-enforced, not UI-only** — cadence caps, duplicate-text (vs last 30 posts), branded-content disclosure, empty caption, missing alt text, AI-media reminder.
- **Graph errors degrade, never crash silently** — 190 → re-auth; 4/17/32/613/80001 → backoff; capability misses save locally and toast precisely.
- **Token hygiene** — AES-GCM vault for Page tokens, `appsecret_proof` HMAC, app ID/secret encrypted at rest.
- **Persistence** — PGLite persisted to disk (in-memory fallback bug fixed), real Postgres wired + 5 migrations applied + worker proven publishing with no browser.
- **Test suite** — 76/76 unit tests, 0 lint errors, `strict: true`, Playwright E2E scaffold in place.
- **Error boundary** — `AppErrorComponent` wired into the router and `__root`.

---

## 5. The modernization plan

Ordering rationale: **security first** (an exposed desk with no login is the single largest risk), then **self-host/deploy** (the other "not ready" cliff), then **feature parity**, then **polish**, then a **launch gate**. Each phase is independently shippable and commits frequently.

### Phase A — Security (make it safe to expose) — *blocks public deployment*

**Step A1. Make login real (enable + wire the forms).**
- Microstep: flip `emailAndPasswordEnabled` to `true` in `src/lib/auth/email-password.ts` (verified one-line backend toggle).
- Microstep: build the sign-up/sign-in forms — wire `authClient.signUp.email` / `authClient.signIn.email` from `@/lib/auth/client` into `src/routes/login.tsx` (verified: **no** sign-in/sign-up call exists in any route or component today).
- Microstep: make `requireUserId` in `verify.server.ts` throw `UnauthorizedError` instead of `?? DEV_USER_ID` when auth is configured, and gate every server fn behind it (the fallback is the highest-risk line).
- Microstep: seed a first operator from `POSTERPAL_ADMIN_EMAIL` / `POSTERPAL_ADMIN_PASSWORD` so a fresh deploy has a known credential.
- Microstep: decouple from the Grok auth broker — the "deployed" mode (`GROK_AUTH_*` + `genericOAuth`) is an external dependency; a standalone self-host needs the local email/password path (or direct Google OAuth) instead.
- Verify: `npm run build` with auth on → unauthenticated server fn returns 401, not `dev-user` rows.

**Step A2. Harden the auth surface.**
- Microstep: rate-limit login (e.g. 5 failures → exponential backoff) and add generic "invalid credentials" messaging (block user-enumeration).
- Microstep: enforce `Secure` + `HttpOnly` + `SameSite` session cookies; add HSTS header via the Nitro middleware in `server/`.
- Microstep: set a strong `BETTER_AUTH_SECRET` requirement — refuse to boot in production if it is missing or a known default.

**Step A3. Secrets hygiene.**
- Microstep: ship a redacted `.env.example` listing every required var (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `VITE_AUTH_ENABLED`, `XAI_API_KEY`, FB app id/secret, encryption key) with comments — none currently exists.
- Microstep: confirm the FB token encryption key is derived from `BETTER_AUTH_SECRET` (or a separate `POSTERPAL_MASTER_KEY`) and is not hard-coded; document rotation.

**Step A4. Health + observability.**
- Microstep: add `GET /api/health` returning DB connectivity (1-row `select 1`) + version — needed for Docker healthchecks and load-balancers (verified: no health route exists today).
- Microstep: add a `/api/health/live` (process up) vs `/api/health/ready` (DB up) split for orchestrators.

### Phase B — Self-host & deploy (make it a real product)

**Step B1. Containerize.**
- Microstep: multi-stage `Dockerfile` (Node build → Nitro server) with non-root user.
- Microstep: `docker-compose.yml` with `app` + `postgres:17` + a named volume; wire `DATABASE_URL` and run `db:migrate` on boot.
- Microstep: `.dockerignore` (exclude `node_modules`, `.posterpal-pglite`, `test-results`, `desktop/`).

**Step B2. Backup & restore.**
- Microstep: `scripts/backup.sh` — `pg_dump` to a timestamped file, retention policy.
- Microstep: document restore steps (drop/recreate + `db:migrate` + `psql < dump`).

**Step B3. Complete the self-host doc.**
- Microstep: expand `SETUP.md` into a fresh-machine walkthrough: prerequisites → env vars → `docker compose up` → reverse proxy (Caddy/Nginx) TLS → Facebook App config (App Domains / Site URL / Redirect URI) → first login.
- Microstep: document the Windows-native path (no-Docker) alongside Docker.

**Step B4. CI.**
- Microstep: `.github/workflows/ci.yml` running `typecheck` → `lint` → `test` → `e2e` on push/PR.
- Microstep: a build job that runs `npm run build` and uploads the Nitro artifact.

### Phase C — Feature parity (industry-standard capabilities)

**Step C1. Bulk scheduling.**
- Microstep: CSV template (`caption`, `page`, `media_url`, `when`) + upload route that validates via the existing policy engine and creates `LocalScheduled` posts; surface per-row errors.

**Step C2. Post recycling / repeat cadence.**
- Microstep: a `recurring` flag on posts + a recycle queue the worker advances (re-uses the proven worker loop).

**Step C3. Data-driven best-time-to-post.**
- Microstep: aggregate `posts` reaction/comment timestamps into a per-Page hour×day heatmap; replace the heuristic slot autofill with it.

**Step C4. RSS auto-post.**
- Microstep: a feed URL per Page + a worker task that drafts new feed items into the queue (AI caption optional, human approves).

**Step C5. Mobile/APK client.**
- Microstep: finish the paired-device read path into a thin Capacitor/PWA shell hitting the same HTTPS origin (the `pair` + `api/sync/*` plumbing already exists).

### Phase D — Quality & polish

**Step D1. Clear the 28 TODO/stub markers.**
- Microstep: triage each into fix / delete / documented-debt; fix the live ones.

**Step D2. Close the 8 lint warnings.**
- Microstep: resolve `react-hooks/exhaustive-deps` with deliberate dep arrays + comments; fix `react-refresh/only-export-components` and the `useMemo` warning.

**Step D3. Stabilize E2E.**
- Microstep: fix the 4 flaky specs (Radix Switch/Tabs don't respond to synthetic clicks in headless — use the native-setter/`data-state` approach; `#25` file-input via `DataTransfer`).

**Step D4. Accessibility & states.**
- Microstep: run the frontend-component audit — icon-only buttons need labels, dialogs need focus-trap/Escape, empty/loading/error states for every async surface.

### Phase E — Launch gate

**Step E1. Clean-machine rehearsal.** Fresh clone → `docker compose up` → migrate → seed → compose/schedule → worker publishes → backup/restore round-trip.

**Step E2. Live Graph verification.** Needs a real Facebook Dev-Mode app: connect, publish, reply, schedule — the only remaining un-verified path (blocked on user credentials).

**Step E3. Release.** Tag + changelog + a "self-host" section in README pointing at Docker + SETUP.

---

## 6. Risk register & open questions

1. **Auth fallback** — `verify.server.ts` `?? DEV_USER_ID` is the highest-risk line; enabling auth without removing this fallback would silently re-open the single-user path. Must be fixed in A1.
2. **Grok auth-broker dependency** — the only *wired* "auth on" mode federates to the Grok platform's broker (`GROK_AUTH_ISSUER`/`genericOAuth`). A truly standalone self-host needs the local email/password path (backend exists, forms don't) or direct Google OAuth, not a broker tied to the Grok sandbox.
3. **Facebook App Review** — the product works in Dev Mode (operator's own Pages, no review). "Ready to use completely" for *other* users requires Meta App Review (screencasts + use-case descriptions) — a process risk outside the code, documented in SETUP.
4. **Encryption key rotation** — the AES-GCM token vault key lifecycle is not documented; a lost key = irrecoverable tokens. Add rotation + a key-derivation statement.
5. **Desktop `desktop/` kernel** — the .NET 9 WPF kernel can't be compiled in this environment; it is out of scope for the web-app modernization but must be tracked separately.
6. **Uncommitted work** — the Playwright scaffold (`e2e/`, `playwright.config.ts`, `package.json` scripts, `@playwright/test` dep) is currently uncommitted. Commit it before starting Phase A.

---

*Sources: Meta Graph API permissions reference (`pages_manage_posts`, `pages_read_engagement`, `pages_read_user_content`, `pages_manage_engagement`, `read_insights`); OWASP Secrets Management + Web Checklist; Buffer/Publer/Postiz feature documentation.*
