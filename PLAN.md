# PosterPal — 10 unique Pages: audit, gaps, and the plan we are enacting

> **Mostly enacted.** Practice fleet, cross-Page Jaccard, fleet home/calendar, per-Page cadence, setup/start guide, Photo extras, Docker worker key, and tests landed. Current map: [`README.md`](README.md) + [`ARCHITECTURE.md`](ARCHITECTURE.md).

**Date:** 2026-08-30  
**Goal:** A single operator can **start, manage, and run 10 unique Facebook Pages** from this desk, with 0 silent bugs on the local/practice path and Graph-ready wiring for live Pages.

Facebook **cannot create Pages through Graph**. “Start” means: design 10 distinct identities here, create each Page on facebook.com, Connect once (`/me/accounts` pages in), then run them without looking like a spam network.

---

## 1. What PosterPal already is

A personal **Facebook Pages CRM** (TanStack Start + Postgres/PGLite + Graph API v26.0). Not a 12-network SaaS. Not an engagement bot. AI drafts; a human clicks Send.

| Surface | Status (verified in source, 2026-08-30) |
|---|---|
| Composer (text/photo/carousel/video/reel/story, policy, cadence, merch, first comment) | Live |
| Calendar month/week/heatmap + drag reschedule | Live (Radix tabs flake in E2E) |
| Inbox HITL reply/hide + buying-intent | Live |
| Analytics 7/28/90d + CSV | Live |
| Drafts / queue / failed retry | Live |
| Media library, merch+UTM, Agent research, Vault | Live |
| OAuth + `/me/accounts` paging (`graphCollect`) | Live |
| Worker (`tick` + recycle + RSS + sync + vault) | Live (needs `DATABASE_URL`) |
| Docker Compose (app + worker + Postgres 17) | Live |
| Bulk CSV, RSS auto-draft, recycle-after-days | Live |
| Login wall (self-host) / no-login personal desk | Live |
| Practice seed | **Only 2 Pages** |

---

## 2. What was blocking “10 unique Pages”

### Product (P0)

1. **Practice fleet is 2 Pages.** Rail `max-h-52` clips ~5. Home cards show name/likes only — no cadence, inbox, due, uniqueness.
2. **“Also post to” copies the identical caption to other Pages.** Meta inauthentic-behavior risk. Policy Jaccard is **per-Page only**.
3. **Cadence “Save” writes the same cap onto every Page** (`ops.savePrefs` updates all rows). Unique Pages need per-Page caps.
4. **Calendar is forced onto one Page.** `calendarFn` remaps missing ids to `pages[0]`, so a fleet calendar is unreachable.
5. **Setup does not explain how to START Pages.** Graph cannot create them. No identity planner / Connect-all flow.
6. **Stale copy:** “local scheduler only fires while this desk is open” — the worker exists.

### Bugs (P0)

7. **Photo ingest silently drops extras before the #25 toast.** File input is `multiple` only for Carousel; Playwright/DataTransfer keeps one file. `ingestFiles` also resets Photo to `[]` then happens to keep whatever the input gave it.
8. **Calendar/Drafts Radix tabs** ignore some clicks (E2E red: Week `aria-selected` stays false; drafts schedule-cancel flakes).
9. **Docker worker missing `POSTERPAL_MASTER_KEY`.** Production `crypto.ts` refuses the preview key → publish/sync decrypt fails when the browser is closed.
10. **`dueSoon` on home is desk-wide but capped at 8** — 10 Pages will hide the queue.

### Deliberately out of this pass

- Live Graph verification (needs the operator’s Dev-Mode App + real Pages).
- Creating Facebook Pages via API (not available).
- Capacitor APK / WPF shell.
- Instagram / Messenger / Ads.
- Auto-reply, auto-like, Group spam (forbidden — Surpass §12).

---

## 3. Plan we are enacting (this turn)

1. **10 unique practice identities** — expand the seed to a 10-Page fleet (keep North Shore Books + Winona Weekend so existing E2E still holds). Button to expand an existing 2-Page practice desk.
2. **Cross-Page duplicate policy** — Jaccard vs other Pages; block ≥0.82, warn ≥0.55. “Also post to” queues **LocalDrafts** for remix, never identical live posts.
3. **Fleet home** — each card: cadence, inbox, due, merch, uniqueness, voice snippet. Rail lists all 10. Coming-up list is longer. Worker copy is honest.
4. **Fleet calendar** — All Pages toggle; native tabs (role=tab) so E2E and operators both work.
5. **Per-Page cadence + identity** in Settings (voice, warn/block for the **selected** Page only).
6. **Setup / start guide** — create Pages on Facebook, then Connect once; practice fleet for training.
7. **Composer Photo** — `multiple` on Photo, keep extras, toast “Switch to Carousel”.
8. **Drafts native tabs** + honest worker copy.
9. **Docker worker** gets the master key.
10. **Tests** for cross-Page Jaccard + fleet size.

---

## 4. How an operator actually runs 10 unique Pages after this

1. Open the desk (practice fleet of 10 is there).
2. Give each Page a voice + cadence in Settings. Add merch per Page.
3. On facebook.com, create 10 Pages with **distinct names, categories, about, and profile art**. Add yourself as Admin. Add your Facebook App as Admin/Tester.
4. PosterPal Settings → App ID/Secret → Connect. All Pages with `CREATE_CONTENT` import.
5. Composer one Page at a time. Clone is drafts-for-remix. Policy blocks copy-paste networks.
6. Worker (`npm run worker` or Compose) fires the queue with the browser closed.
7. Inbox/Analytics/Calendar follow the rail; Calendar “All Pages” is the overnight view.
