# PosterPal Full Agency & Server Intelligence Plan

**Created:** 2026-08-30  
**Last re-audit:** 2026-09-01 (implementation pass: health pill, offline diagnose, Schedule in Composer, then backend + 2026 Graph upgrades)

**Goal:** Transform PosterPal's Desk Agent into a system-intelligent operator assistant with read-level visibility into worker/DB/tokens/queue, and one-click hops into Composer / Later — **without** ever publishing or auto-replying.

Canonical product map: [`README.md`](README.md) · [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## 1. What this plan is (and is not)

The Agent (`src/lib/posterpal/agent.ts` + `src/routes/agent.tsx`) is a **research desk**, not a coding harness and not an autopilot.

It **may**: profile a Page from desk data, search the public web (excluding Facebook/Instagram/Threads), take notes, draft three captions, generate an Imagine still (flagged `createdWithAi`), park an idea on Later, prefill Composer.

It **must not**: like, follow, share, comment, publish, scrape facebook.com, or invent hours/events. `agentWouldRefuse` short-circuits those briefs with **no model call**.

`Desktop/fullyagentic/Uber_Agentic_Framework.md` is a **different project**. Do not merge it here.

### What “agency” means in this codebase

| Layer | Code | What the model actually gets |
| --- | --- | --- |
| Page profile | `research.buildPageProfile` | name, category, brand_voice, merch titles/URLs, last captions, inferred locale/topics/purpose, suggested briefs |
| Live search | `agent.liveResearch` | xAI `search_parameters` + `web_search` tool, facebook/instagram/threads excluded |
| Server context | `buildDeskSnapshot` + `formatDeskSnapshot` inside `runDeskAgent` | **Live-model and grok-no-key paths.** Full desk: queue, vault, inbox, Graph quota, cadence/Reels cap, failed publishes, scheduler log, worker/ticker, last Facebook error |
| UI hooks | `agent.tsx` | Diagnose Server (a **canned brief**, not an API), header health pill, Open in Composer, **Schedule in Composer**, Save to Later, Map this Page, Today’s angle, Generate still |

`PageResearchProfile` does **not** contain health fields. Phase 1’s “inject into PageResearchProfile **and** system prompts” landed as **system prompt only**.

---

## 2. Phased roadmap (original) vs tree

### Phase 1 — Context enrichment (`agent.ts`)

Intent: inject `readDeskHealth`, `needsYou`, `listDeskLogs` so the model can answer “is the worker up / what’s overdue / why did publish fail?”

**Landed on both paths.** `loadDeskSystemContext` runs before the grok-no-key early return. Diagnose briefs persist the block in `summary` (no fake citations). Caption generation on the live path still receives it as `systemContext`.

Health “fresh” = last tick < **3 minutes** (`log.ts`). Worker vs scheduler stamps: `worker_last_tick` (worker process) vs `scheduler_last_tick` (`ops.tick` / Electron). A desk with only the EXE running can show worker Idle and scheduler Fresh — that is correct, not a bug.

Fleet identity / merch / heatmap are **not** in `systemContext`. They arrive only via `buildPageProfile` (and heatmap is not in the profile at all). Cadence for the selected Page **is** in the context.

### Phase 2 — UI (`agent.tsx`)

| Item | Status | Evidence |
| --- | --- | --- |
| Diagnose Server button | **Done** | Brief asks the model to use attached desk context; copy says it is **not** a diagnostic API |
| Open in Composer | **Done** | Prefills `message`, `pageId`, `mediaType`, `imagePrompt`. No `when` (stays local-draft). |
| Save to Later | **Done** | `saveIdeaFn` storytelling caption, `notes: "caption-ready"` |
| Server Health pill **in Agent header** | **Done** | `deskHealthFn` — same DB / ticker / worker copy as Vault |
| Distinct “Schedule in Composer” | **Done** | `setComposerPrefill({ …, when: scheduleWhenForPage(page.posting_slots_json) })`. Human still clicks Schedule. |

### Phase 3 — Verification

**Not recorded.** No typecheck/lint/test/e2e row in the execution log.

---

## 3. Execution log

| Date & Time | Phase | Action | Status |
|---|---|---|---|
| 2026-08-30 21:48 | Setup | Created this file | Planned |
| 2026-08-30 21:49 | Phase 1 | Health/needs/logs into `agent.ts` live path | Completed (offline hole remains) |
| 2026-08-30 21:50 | Phase 2 | Diagnose Server + Composer/Later hooks | Completed (pill + schedule still open) |
| 2026-09-01 | Re-audit | Docs aligned with tree; remaining work listed | This file |
| 2026-09-01 | Phase 1–2 | Offline `systemContext`, Agent health pill, Schedule in Composer | Completed |
| 2026-09-01 | Beyond plan | Recycle UUID, Graph-ahead CAS, timezone heatmap, Reels 3–90s + 30/24h, RSS remix, default slots Tue/Wed/Thu mornings | Completed |
| 2026-09-01 | Phase 3 | `npm run typecheck` (pass), `npm run lint` (0 errors, 9 pre-existing warnings), `npm test` (112 pass), `npx playwright test e2e/agent.spec.ts` (pass) | Completed |
| 2026-09-01 | Ops visibility | Full DESK OPS snapshot for Agent (queue/vault/inbox/quota/fails); Graph error hints + jitter; tick.done log | Completed |
| 2026-09-01 | Agent hops | HITL hops + inbox reply drafts persisted on comments + Composer prefill (first comment, recycle 30d) + caption policy preview | Completed |

---

## 4. Remaining work (this plan only)

**This plan’s items 1–5 are implemented.** Item 6 is the verification row in the execution log after `npm test` / typecheck / e2e.

Already shipped **beyond** this plan (do not re-build): purpose card, topic chips, suggested briefs, Map this Page, caption/image provider selects, Generate still (`createdWithAi`), Today’s angle, Diagnose Server **button** (canned brief), header health pill, Schedule in Composer, offline diagnose summary.

Out of scope (ARCHITECTURE.md): editable page topics, gated “Dig deeper”, disk/S3 media, live Graph rehearsal, Uber meta-kernel.

Prefill limitation: `ComposerPrefill` has no `mode` / `firstComment` / `recycleAfterDays`. “Schedule in Composer” sets `when` (Composer switches to schedule mode). Recycle / first comment still cannot be prefilled.

---

## 5. How a Diagnose run actually flows today

```
Agent tab → Diagnose Server
  → run({ brief: "Using the server & desk context already attached…" })
  → runAgentFn → ops.runAgent → runDeskAgent
       refuse regex? no
       loadDeskSystemContext (health/needs/logs/cadence)
       grok + no XAI_API_KEY?
         YES → offlineCaptions + desk-topic notes
               + health block persisted in summary
         NO  → liveResearch + systemContext in caption prompt
               + health block persisted in summary when brief matches /diagnos/i
  → UI shows notes + 3 captions + Open in Composer + Schedule in Composer
```

The Agent header pill and Desk health card show the same numbers as Vault. Diagnose is a brief that *reads* them.

---

## 6. Tests an agent must not break

```
npm test                 # includes scripts/research.test.mjs (locale, stopwords, queries)
npx playwright test e2e/agent.spec.ts
```

Refuse-regex coverage lives in research/agent tests as they grow. Add phrases to `REFUSE_RE`, never exceptions.

---

*PosterPal Agent drafts. A human clicks Publish and Send.*
