# PosterPal → Fully Operational Implementation Plan

> **For Hermes:** Execute phase-by-phase. Each task is bite-sized. Commit after every task. Never mark a phase done without the stated verification passing.

**Goal:** Take PosterPal from "works in practice mode on one dev box" to "a person can install it, connect a real Facebook Page, and run their content operation for a month without hitting a bug, losing data, or seeing an unexplained error."

**Architecture:** TanStack Start (SSR + server fns) · PGLite (dev) / Postgres (prod) · Graph API v26.0 with `appsecret_proof` · AES-GCM token vault · single-operator, no app login. Fixes are surgical patches to existing files; the two new subsystems are an E2E regression net (Playwright, already a devDependency) and a self-host bundle (Docker Compose).

**Tech Stack:** TypeScript 5.7, React 19, Vite 8, TanStack Start 1.168, PGLite 0.5 / pg 8.16, tsx test runner, Playwright 1.62, Docker Compose.

---

## Current Context (verified 2026-08-22, not assumed)

| Fact | Value |
|---|---|
| Working tree | `C:\Users\mnril\Desktop\posterpal`, branch `main`, clean |
| HEAD | `5715982` (Round 3 fixes) — 3 commits ahead of upstream `ffb45f9` |
| Node / npm | v22.23.2 / 12.0.2 (hermes-managed) |
| Typecheck | `tsc --noEmit` → clean ✅ |
| Tests | `npm test` → 70 total, **63 pass / 7 fail** (all 7 are pre-existing `grok-pwa-plugin.test.mjs`, Surpass §13.6) |
| Build | `npm run build` → succeeds, ~8s, emits `.vercel/output` |
| Lint | **NEVER RUN THIS SESSION** — unknown state |
| E2E tests | **NONE** — `playwright` is in devDependencies but unused |
| Dev DB | PGLite **falling back to in-memory** (bug, see Phase 0) |
| Prod DB | No Postgres on this box; no Docker binary |
| Migrations | `0001_auth` → `0005_agent` |
| Worker | `scripts/worker.ts` exists, refuses without `DATABASE_URL`, **loop never proven** |

### Bug status — corrected against the code, not the doc

Surpass.md §8 lists 30 bugs. I re-verified the "unknown" ones by reading source this session:

- **Already fixed** (confirmed in code): #13, #17 (`calendar.tsx:233` has `dataTransfer.setData`), #18 (`index.tsx:86` has a `loadError` branch, not `!data`), #22, #27 (`inbox.tsx:40` has a `sending` lock), #29 (`app-shell.tsx:77` has `.catch` + toast), #30, plus all 5 criticals and 5 highs.
- **Genuinely open**: #15 (carousel partial success), #24 (multi-page extras fail but form clears), #25 (extra Photo files never posted), #28 (pairing token unused → phone can read but not write).
- **By design, document don't fix**: #14 (invalidate-on-190 is intentional).

So Phase 1 is four bugs, not twenty.

### Assumptions

1. Target deployment is **the user's own Windows PC** or a small Linux VPS — not a fleet. Single operator.
2. Facebook stays in **Development Mode** (no App Review) — only app-role users.
3. `.vercel/output` remains force-tracked and shipped in commits (repo convention).
4. The 7 `grok-pwa-plugin` failures stay untouched (Surpass §13.6 explicitly says so).

---

# PHASE 0 — Foundation truth (BIG)

*Nothing above this is trustworthy until the dev environment stops lying: data vanishes on restart, and lint has never run.*

**Exit criteria:** Dev data survives a server restart · `npm run lint` exits 0 · worker loop proven against a real Postgres.

---

### Task 0.1: Run lint for the first time, capture the baseline

**Objective:** Find out what `eslint` actually says before changing anything.

**Files:** none (read-only)

**Step 1: Run it**

```bash
cd /c/Users/mnril/Desktop/posterpal && npm run lint 2>&1 | tail -40
```

**Step 2: Record the count**

```bash
npm run lint 2>&1 | grep -cE "error|warning"
```

Expected: unknown — this is discovery. Write the number into the Phase 0 checklist below.

**Step 3: Do NOT fix yet.** Auto-fixing lint before the E2E net exists risks silent behavior changes. Record and move on.

---

### Task 0.2: Fix the PGLite in-memory fallback (data loss bug)

**Objective:** Dev data currently evaporates on every restart because `pgliteDataDir()` calls `require()` inside an ESM module.

**Root cause** — `src/lib/db.ts:88-97`:

```ts
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mkdirSync } = require("node:fs") as typeof import("node:fs");
  const { join } = require("node:path") as typeof import("node:path");
  ...
} catch (err) {
  console.warn("[db] PGLite data dir unavailable — falling back to memory:", err);
  return undefined;
}
```

`package.json` has `"type": "module"`, so `require` is not defined. The `try` **always** throws `ReferenceError: require is not defined`, the catch **always** fires, and every dev session runs on a throwaway in-memory DB. Confirmed in the live server log:

```
[db] PGLite data dir unavailable — falling back to memory: ReferenceError: require is not defined
    at pgliteDataDir (src/lib/db.ts:61:25)
```

**Files:**
- Modify: `src/lib/db.ts:1-10` (add static imports), `src/lib/db.ts:83-98` (rewrite the function)
- Test: `scripts/db-pglite.test.mjs` (create)

**Step 1: Write the failing test**

Create `scripts/db-pglite.test.mjs`:

```js
import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { pgliteDataDir } from "../src/lib/db.ts";

test("pgliteDataDir returns a real directory, never undefined-by-crash", () => {
  const dir = pgliteDataDir();
  assert.ok(dir, "must return a path when PGLITE_MEMORY is unset");
  assert.ok(existsSync(dir), `directory must exist on disk: ${dir}`);
});

test("pgliteDataDir honours PGLITE_MEMORY=1 opt-out", () => {
  process.env.PGLITE_MEMORY = "1";
  assert.equal(pgliteDataDir(), undefined);
  delete process.env.PGLITE_MEMORY;
});

test("pgliteDataDir honours PGLITE_DATA_DIR override", () => {
  const custom = join(process.cwd(), ".pglite-test-tmp");
  process.env.PGLITE_DATA_DIR = custom;
  const dir = pgliteDataDir();
  assert.equal(dir, custom);
  assert.ok(existsSync(custom));
  delete process.env.PGLITE_DATA_DIR;
  rmSync(custom, { recursive: true, force: true });
});
```

**Step 2: Run it, verify it fails**

```bash
npx tsx --test scripts/db-pglite.test.mjs
```

Expected: FAIL — either `pgliteDataDir is not exported` or the first assert fails because the function returns `undefined`.

**Step 3: Fix `src/lib/db.ts`**

Add to the top-level imports:

```ts
import { mkdirSync } from "node:fs";
import { join } from "node:path";
```

Replace the whole function body:

```ts
/** Directory for the on-disk PGLite store, or undefined for in-memory only. */
export function pgliteDataDir(): string | undefined {
  if (typeof process === "undefined") return undefined;
  if (process.env.PGLITE_MEMORY === "1") return undefined;
  try {
    const dir = process.env.PGLITE_DATA_DIR?.trim() || join(process.cwd(), ".posterpal-pglite");
    mkdirSync(dir, { recursive: true });
    return dir;
  } catch (err) {
    console.warn("[db] PGLite data dir unavailable — falling back to memory:", err);
    return undefined;
  }
}
```

Note the two changes: static imports (no `require`), and `export` so the test can reach it. Keep the `try/catch` — it now guards a *real* failure mode (read-only filesystem), not a self-inflicted one.

**Step 4: Verify the test passes**

```bash
npx tsx --test scripts/db-pglite.test.mjs
```
Expected: `# pass 3 / # fail 0`

**Step 5: Verify persistence end-to-end (the actual point)**

```bash
# restart dev server, then:
grep -c "falling back to memory" <server log>   # expected: 0
ls -d .posterpal-pglite                          # expected: directory exists
```

Then in the browser: create a draft → restart the dev server → reload. **The draft must still be there.** This is the acceptance test; the unit test only guards the regression.

**Step 6: Add `.posterpal-pglite/` to `.gitignore`**

**Step 7: Commit**

```bash
git add src/lib/db.ts scripts/db-pglite.test.mjs .gitignore
git commit -m "fix(db): PGLite persisted to disk — require() in ESM always threw, forcing in-memory"
```

---

### Task 0.3: Stand up a real Postgres

**Objective:** Every prod-path claim (worker loop, migrations, concurrency) is currently unprovable. Fix that.

**Blocker:** no Docker, no psql, nothing on `:5432` on this box.

**Step 1: Pick a route** — ask the user:
- (a) Install Docker Desktop → `docker run --name posterpal-pg -e POSTGRES_PASSWORD=posterpal -p 5432:5432 -d postgres:17`
- (b) Install Postgres 17 for Windows natively
- (c) Free hosted branch (Neon / Supabase) — fastest, no local install, and matches the `pg` driver path already in `db.ts`

**Recommendation: (c) Neon.** `createNeonSql()` already exists in `db.ts:65`, it needs zero local install, and it exercises the *same* driver production will use.

**Step 2: Run migrations**

```bash
export DATABASE_URL="postgres://..."
npm run db:migrate
```
Expected: `0001_auth` … `0005_agent` all apply, no errors.

**Step 3: Verify schema**

```bash
psql "$DATABASE_URL" -c "\dt"
```
Expected: `pages`, `posts`, `comments`, `settings`, `scheduler_logs`, `devices`, `agent_runs`, `memory_cards`, `merch_links`, `media_assets`.

**Step 4: Commit** — nothing to commit; record the URL in a local `.env` that is gitignored. **Never commit `DATABASE_URL`.**

---

### Task 0.4: Prove the worker loop

**Objective:** `scripts/worker.ts` has never completed a single real tick.

**Step 1: One-shot**

```bash
DATABASE_URL="postgres://..." npm run worker -- --once
```
Expected: exits 0, logs a tick for `tickScheduler` / `syncFromGraph` / `refreshVaultTokens`, no stack trace.

**Step 2: Prove it actually publishes a due post**
1. In the app, schedule a post for **2 minutes** from now.
2. Close the browser entirely (proves it is not the in-app 60s tick doing the work).
3. Run the worker in loop mode: `DATABASE_URL=… npm run worker`
4. Wait past the scheduled time.
5. Expected: worker log shows the tick, post status flips `LocalScheduled` → `Published`, and a row lands in `scheduler_logs`.

**Step 3: Prove failures are never silent**
Schedule a post, then corrupt its state (e.g. set `scheduled_publish_time` to a NaN-producing value) and confirm it becomes `Failed` **and** writes a `scheduler_logs` row — per the §8 promise "never silent."

**Step 4: Commit** any fixes the exercise surfaces.

---

## Phase 0 checklist

- [ ] Lint baseline recorded: ______ problems
- [ ] PGLite persists across restart (draft survives)
- [ ] `.posterpal-pglite/` gitignored
- [ ] Postgres reachable, all 5 migrations applied
- [ ] Worker publishes a due post with the browser closed
- [ ] Worker failure writes a `scheduler_logs` row

---

# PHASE 1 — Close the four real bugs (SMALL each)

*Grounded in the corrected §8 status above. Four bugs, not twenty.*

---

### Task 1.1: #25 — Extra files in Photo mode are silently dropped

**Objective:** User attaches 4 photos in Photo mode; only 1 is posted, no warning. Either post them all or say so.

**Files:** Modify `src/routes/composer.tsx` (media-mode handling)

**Step 1: Reproduce** — Photo mode, attach 3 files, publish, observe only the first is used and no toast explains it.

**Step 2: Decide the contract.** Photo (single) vs Carousel (multi) is a real Graph distinction. Correct behavior: **offer to switch**, don't silently drop.

**Step 3: Implement** — when `mediaType === "Photo"` and `files.length > 1`:

```ts
toast.error(
  `Photo mode posts one image. You attached ${files.length}. Switch to Carousel to post them all.`,
  { action: { label: "Switch to Carousel", onClick: () => s.setMediaType("Carousel") } },
);
return;
```

**Step 4: Verify live** — attach 3 in Photo mode → toast appears with a working "Switch to Carousel" action → after switching, all 3 upload.

**Step 5: Commit** — `fix(composer): stop silently dropping extra Photo-mode files (#25)`

---

### Task 1.2: #24 — Multi-page compose clears the form even when a Page failed

**Objective:** Send to 2 Pages, one fails; the form empties and the caption is lost.

**Files:** Modify `src/routes/composer.tsx` (submit path, `resetForm` call)

**Step 1: Reproduce** — trip a cadence block on Page B only, send to A+B, watch the form clear despite B failing.

**Step 2: Fix** — only reset when *every* target succeeded:

```ts
const failures = results.filter((r) => !r.ok);
if (failures.length === 0) {
  resetForm();
} else {
  toast.error(
    `Posted to ${results.length - failures.length}, failed on ${failures.length}: ${failures.map((f) => f.pageName).join(", ")}. Caption kept so you can retry.`,
  );
}
```

**Step 3: Verify live** — the caption survives a partial failure and the toast names the failed Page.

**Step 4: Commit** — `fix(composer): keep the caption when a multi-page send partially fails (#24)`

---

### Task 1.3: #15 — Carousel reports success when slides were dropped

**Objective:** 5 slides, 2 fail to upload, the post publishes with 3 and calls it a win.

**Files:** Modify `src/lib/posterpal/publish.ts` (carousel branch)

**Step 1: Add a unit test** in `scripts/phase0.test.mjs` asserting the carousel result surfaces a `partial` flag with the failed-slide count.

**Step 2: Fix** — thread partial state through the return value and toast:

```
"Posted with 3 of 5 slides — 2 failed to upload. Check the media and repost if you need all five."
```

**Step 3: Verify** — `npx tsx --test scripts/phase0.test.mjs` passes.

**Step 4: Commit** — `fix(publish): report dropped carousel slides instead of silent success (#15)`

---

### Task 1.4: #28 — Paired phone can read but not write

**Objective:** Pairing issues a token; API calls never send it, so a paired phone is read-only. This is the last unfinished promise in the Devices feature.

**Files:**
- Modify: `src/lib/posterpal/devices.ts` (token verification on mutations)
- Modify: client fetch layer — attach `Authorization: Bearer <deviceToken>`
- Test: `scripts/devices.test.mjs` (create)

**Step 1: Write the failing test** — a mutation with a valid device token succeeds; with a revoked token returns 401.

**Step 2: Implement** — store the token client-side on pair; attach it on every server-fn call; verify with the existing `resolveDeviceToken` (already used by `/api/sync/snapshot`).

**Step 3: Verify live** — pair a second browser profile, publish a draft **from the paired device**, confirm it lands. Then revoke the device in Settings and confirm the next write returns 401.

**Step 4: Commit** — `feat(devices): paired devices can write, not just read (#28)`

---

### Task 1.5: Document #14 as intentional

**Objective:** Stop it being re-reported forever.

**Files:** Modify `Surpass.md` §8

Add: *"#14 invalidate-on-190 is **by design** — a 190 means the token is dead; stamping `last_validated_at` prevents a retry storm. Not a bug. Do not 'fix'."*

**Commit** — `docs: mark #14 as intentional, not a bug`

---

# PHASE 2 — The regression net (BIG)

*This is the single highest-value phase. Everything verified so far was verified **by hand**, once. Nothing stops a future change from silently breaking it. `playwright` is already installed and completely unused.*

**Exit criteria:** `npm run e2e` exercises every critical path headlessly and is wired into the release gate.

---

### Task 2.1: Playwright scaffold

**Files:** Create `playwright.config.ts`, `e2e/fixtures.ts`

```ts
// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },   // app hydrates async — 2-4s is normal
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8080",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:8080",
    reuseExistingServer: true,
    timeout: 120_000,   // cold Vite start measured at ~44s on this box
  },
});
```

Add to `package.json`:
```json
"e2e": "playwright test",
"e2e:ui": "playwright test --ui"
```

**Critical lesson to encode** (learned the hard way this session):
- Sonner toasts render in a **portal**; assert with `page.getByText(...)`, and give them a generous timeout — several "bugs" this session were just toasts expiring before assertion.
- The app hydrates async; **never** assert immediately after `goto`. Use `expect(...).toBeVisible()` which auto-retries, not a bare snapshot.
- Radix controls ignore untrusted synthetic events — Playwright's real clicks are fine, but hand-rolled `dispatchEvent` is not.

**Commit** — `test(e2e): playwright scaffold`

---

### Task 2.2 – 2.9: One spec per critical path

Write these as separate small tasks, one file each, each committed on its own:

| Task | File | Covers |
|---|---|---|
| 2.2 | `e2e/composer.spec.ts` | draft save · schedule + best-slot autofill · duplicate-caption block · policy block · **stale-policy fast-Send** (the Round 3 regression) |
| 2.3 | `e2e/calendar.spec.ts` | month/week/heatmap · drag-reschedule · Published not draggable · dialog cancel |
| 2.4 | `e2e/inbox.spec.ts` | reply send · empty-reply guard · hide · j/k/e keys · intent tab |
| 2.5 | `e2e/drafts.spec.ts` | cancel · failed-retry · tab counts |
| 2.6 | `e2e/settings.spec.ts` | cadence save→enforce→restore · theme · **name checker rejects BookBoss** (Round 3 regression) |
| 2.7 | `e2e/analytics.spec.ts` | CSV export shape · range switch |
| 2.8 | `e2e/agent.spec.ts` | offline drafting labels notes "unverified" (§17.4 honesty contract) |
| 2.9 | `e2e/smoke.spec.ts` | all 12 nav routes render without a JS error |

Each spec follows: navigate → act → assert on **user-visible text**, not internals.

**Example — the Round 3 stale-policy regression, locked down forever:**

```ts
test("fast Send after typing does not report a stale policy block", async ({ page }) => {
  await page.goto("/composer");
  await page.getByRole("button", { name: "Publish now" }).click();
  await page.getByPlaceholder("Write the caption…").fill("Unique caption " + Date.now());
  await page.getByRole("button", { name: "Send" }).click();   // immediate, inside the 250ms debounce
  await expect(page.getByText("Policy checklist blocked")).not.toBeVisible();
});
```

---

### Task 2.10: Wire E2E into the gate

Add to `package.json`:
```json
"verify": "npm run typecheck && npm run lint && npm test && npm run e2e"
```

**Exit criteria:** `npm run verify` is the one command that answers "is PosterPal OK?"

**Commit** — `chore: single verify gate (typecheck + lint + unit + e2e)`

---

# PHASE 3 — Self-host (BIG)

*Surpass Phase 1's headline deliverable, never started. Without it "self-hosted" is a claim, not a feature.*

---

### Task 3.1: `docker-compose.yml`

**Files:** Create `docker-compose.yml`, `Dockerfile`, `.env.example`

```yaml
services:
  db:
    image: postgres:17
    environment:
      POSTGRES_USER: posterpal
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env}
      POSTGRES_DB: posterpal
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U posterpal"]
      interval: 5s
      retries: 10

  app:
    build: .
    depends_on:
      db: { condition: service_healthy }
    environment:
      DATABASE_URL: postgres://posterpal:${POSTGRES_PASSWORD}@db:5432/posterpal
      POSTERPAL_MASTER_KEY: ${POSTERPAL_MASTER_KEY:?generate with openssl rand -base64 32}
    ports: ["8080:8080"]

  worker:
    build: .
    command: npm run worker
    depends_on:
      db: { condition: service_healthy }
    environment:
      DATABASE_URL: postgres://posterpal:${POSTERPAL_MASTER_KEY}@db:5432/posterpal
      POSTERPAL_MASTER_KEY: ${POSTERPAL_MASTER_KEY}

volumes: { pgdata: }
```

> **Note for the implementer:** the `worker` service's `DATABASE_URL` above contains a deliberate typo (`POSTERPAL_MASTER_KEY` where the password belongs) — fix it to `${POSTGRES_PASSWORD}` when you write the real file. Left visible here because it is exactly the class of copy-paste bug that makes a compose file fail at 2am.

**Note the separate `worker` service** — this is what makes scheduled posts fire when the browser is closed, the #1 functional gap for real use.

**Step: Verify** — `docker compose up` on a clean machine → app reachable on :8080 → schedule a post → close the browser → post publishes.

---

### Task 3.2: `SELFHOST.md`

Cover, in order: prerequisites → `openssl rand -base64 32` for the master key → `.env` setup → `docker compose up` → first-run practice mode → connecting Facebook (including the **exact** redirect URI for their host) → backup (`pg_dump`) → restore → upgrade → troubleshooting.

**Acceptance test:** hand it to someone who has never seen the repo. They get to a working desk without asking a question.

---

### Task 3.3: Windows-native path

Not everyone will run Docker. Document `npm ci && npm run build && npm start` + `npm run worker` as a second service, with a note on Task Scheduler for auto-start.

**Windows is the stated target** — every script must work in `cmd`. This session already had to add `cross-env` for exactly this reason; re-verify after any script change.

---

# PHASE 4 — Production hardening (MEDIUM)

### Task 4.1: Secret-handling audit
Confirm no secret can reach a log, a toast, or the client bundle. Grep the built output for the master key, app secret, and any `EAA…` token. `crypto.ts` already refuses the preview fallback key on public hosts — verify that guard actually fires with `NODE_ENV=production`.

### Task 4.2: Global error boundary
One uncaught render error currently white-screens the desk. Add a React error boundary with a "Reload the desk" action and the error text. Per §8's own promise: *"Never silent, never crash."*

### Task 4.3: `/api/health`
Return `{ ok, db, migrations, worker_last_tick }`. Needed for compose healthchecks and for the user to answer "is the worker alive?" without reading logs.

### Task 4.4: Backup/restore rehearsal
Actually run `pg_dump` → destroy the volume → restore → verify drafts, tokens, and Later cards all came back. **A backup that has never been restored is not a backup.**

### Task 4.5: Now fix the lint baseline
With the E2E net live, it is finally safe. `npm run lint -- --fix`, review the diff, fix the rest by hand, confirm `npm run verify` stays green.

---

# PHASE 5 — Live Graph verification (BLOCKED on user)

*Everything Graph-related has been verified by code reading and practice mode only. Zero real API calls have ever been made.*

**Needs from the user:** a Facebook App in Development Mode + a real Page they administer.

| Task | Verifies |
|---|---|
| 5.1 | OAuth round-trip, `/me/accounts`, `CREATE_CONTENT` gating |
| 5.2 | Publish text, photo (multipart), carousel, video, **Reel** (9:16, 3-60s, ≥540×960) |
| 5.3 | Native scheduling inside the 10min-30day window; local scheduler outside it |
| 5.4 | Comment pull → reply → hide, all against real Graph |
| 5.5 | Analytics sync; confirm the 100-likes insights threshold degrades gracefully |
| 5.6 | Error paths: force a 190 (re-auth) and a 32/613 (backoff) and confirm the documented behavior |
| 5.7 | Token refresh: confirm long-lived token exchange and the vault expiry countdown |

**This phase cannot be faked.** Until it runs, the honest status is "Graph integration is written and reviewed but never executed."

---

# PHASE 6 — Release gate (SMALL)

### Task 6.1: Full clean-machine rehearsal
Fresh clone → `npm ci` → `npm run verify` → `docker compose up` → practice mode → connect a real Page → publish → close browser → confirm the worker fires a scheduled post.

### Task 6.2: Truth-pass on the docs
README, SETUP.md, SELFHOST.md, Surpass.md — every claim either verified or explicitly labeled unverified. **No aspirational statements in the present tense.**

### Task 6.3: Decide the grok-pwa 7
Either fix them or delete them. A permanently red suite trains everyone to ignore red. Surpass §13.6 says don't burn a day — so **delete them** if they no longer describe a shipped feature.

### Task 6.4: Tag `v1.0.0`

---

## Files likely to change

| Path | Phase | Change |
|---|---|---|
| `src/lib/db.ts` | 0 | static imports; export + fix `pgliteDataDir` |
| `.gitignore` | 0 | `.posterpal-pglite/` |
| `src/routes/composer.tsx` | 1 | #24 partial-failure reset, #25 extra files |
| `src/lib/posterpal/publish.ts` | 1 | #15 carousel partial |
| `src/lib/posterpal/devices.ts` | 1 | #28 device-token writes |
| `Surpass.md` | 1, 6 | #14 rationale; status truth-pass |
| `playwright.config.ts`, `e2e/*.spec.ts` | 2 | **new** — 9 specs |
| `package.json` | 2 | `e2e`, `verify` scripts |
| `Dockerfile`, `docker-compose.yml`, `.env.example` | 3 | **new** |
| `SELFHOST.md` | 3 | **new** |
| `src/components/error-boundary.tsx` | 4 | **new** |
| `src/routes/api/health.ts` | 4 | **new** |

## Validation

```bash
npm run verify   # typecheck + lint + 70 unit tests + 9 e2e specs
```

Per-phase gates are listed in each phase's exit criteria. **A phase is not done until its gate passes on a clean run.**

## Risks & tradeoffs

| Risk | Mitigation |
|---|---|
| **Phase 5 is unskippable and needs the user.** No amount of local work substitutes for one real Graph call. | Start Phase 5 credential setup early, in parallel with Phase 2. |
| Playwright flakes on async hydration and toast timing — this session lost real time to exactly that. | Generous `expect` timeouts, auto-retrying assertions, `trace: retain-on-failure`. Never assert on a bare snapshot. |
| Auto-`--fix` on an unknown lint baseline could change behavior. | Deliberately deferred to Phase 4.5, *after* the E2E net exists. |
| `.vercel/output` is force-tracked; every build dirties the tree. | Keep including it (repo convention), but never let it mask a source diff in review. |
| PGLite (dev) and Postgres (prod) can diverge. | Phase 0.3 makes Postgres the default for any real testing; PGLite is demo-only. |
| Windows-first target, most tooling assumes POSIX. | Already bitten twice (`cross-env`, test globs). Re-verify every script on `cmd` after touching `package.json`. |

## Open questions

1. **Postgres route** — Neon (recommended, zero install, same `pg` driver as prod), Docker Desktop, or native Windows?
2. **Facebook credentials** — when can Phase 5 start? It is the only phase that cannot be done locally.
3. **The grok-pwa 7** — fix or delete? I recommend delete; they test a plugin surface unrelated to PosterPal's product.
4. **Deployment target** — Windows PC that stays on, or a Linux VPS? Changes the emphasis of Phase 3.
5. **Scope of "no bugs"** — practice mode only, or the full live-Graph path? The latter makes Phase 5 mandatory and the timeline dependent on your Facebook app.

## Sequencing

```
Phase 0 ─── Phase 1 ─── Phase 2 ─── Phase 4 ─── Phase 6
   │                       │           │
   └──── Phase 3 ──────────┘           │
                    Phase 5 (parallel, user-blocked)
```

Phase 0 gates everything. Phase 2 should land before Phase 4 so lint fixes are covered by tests. Phase 3 can run in parallel with Phase 2. Phase 5 starts the moment credentials exist.
