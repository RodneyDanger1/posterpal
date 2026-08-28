#!/usr/bin/env node
/**
 * PosterPal background worker — keeps the desk alive when no browser tab is open.
 *
 * Every 60s (or once with --once):
 *   1. tickScheduler(userId)      — fire due LocalScheduled posts, fail stuck Publishing rows
 *   2. syncFromGraph(userId)      — pull published posts, comments, insights from Graph
 *   3. refreshVaultTokens(userId) — extend long-lived tokens before they go stale
 *
 * Requires DATABASE_URL (shared Postgres). The PGLite fallback is in-process —
 * a separate worker process cannot see the web process's PGLite, so the worker
 * refuses to start without DATABASE_URL. Run with: npm run worker
 *
 * Phase 1 (§7) of Surpass.md: "A desk that runs when the browser is closed."
 */
import { getSql } from "../src/lib/db";
import { recycleDuePosts, tickScheduler } from "../src/lib/posterpal/publish";
import { syncFromGraph } from "../src/lib/posterpal/sync";
import { refreshVaultTokens } from "../src/lib/posterpal/facebook-oauth";

const INTERVAL_MS = Number(process.env.POSTERPAL_WORKER_INTERVAL_MS ?? 60_000);
const ONCE = process.argv.includes("--once");
const userId = process.env.POSTERPAL_USER_ID?.trim() || "dev-user";

async function resolveOperatorId(): Promise<string> {
  try {
    const sql = await getSql();
    const rows = await sql<{ user_id: string }>`
      select distinct user_id from app_settings limit 1
    `;
    if (rows[0]?.user_id) return rows[0].user_id;
  } catch (e) {
    console.warn("[worker] could not read operator id, falling back to dev-user:", e instanceof Error ? e.message : e);
  }
  return userId;
}

async function oneTick(operatorId: string): Promise<void> {
  const started = Date.now();
  const results: string[] = [];
  try {
    const n = await tickScheduler(operatorId);
    results.push(`tick:${n}`);
  } catch (e) {
    results.push(`tick:FAILED(${e instanceof Error ? e.message : String(e)})`);
  }
  try {
    const recycled = await recycleDuePosts(operatorId);
    if (recycled > 0) results.push(`recycle:${recycled}`);
  } catch (e) {
    results.push(`recycle:FAILED(${e instanceof Error ? e.message : String(e)})`);
  }
  try {
    const { rssDrafts } = await import("../src/lib/posterpal/ops");
    const drafted = await rssDrafts(operatorId);
    if (drafted > 0) results.push(`rss:${drafted}`);
  } catch (e) {
    results.push(`rss:FAILED(${e instanceof Error ? e.message : String(e)})`);
  }
  try {
    const sync = await syncFromGraph(operatorId);
    results.push(
      `sync:${sync.postsUpdated} posts, ${sync.commentsImported} comments${sync.errors.length ? `, ${sync.errors.length} error(s)` : ""}`,
    );
  } catch (e) {
    results.push(`sync:FAILED(${e instanceof Error ? e.message : String(e)})`);
  }
  try {
    const vault = await refreshVaultTokens(operatorId);
    results.push(`vault:${vault.refreshed ? "refreshed" : "ok"}`);
  } catch (e) {
    results.push(`vault:FAILED(${e instanceof Error ? e.message : String(e)})`);
  }
  console.log(`[worker] ${new Date().toISOString()} ${results.join(" | ")} (${Date.now() - started}ms)`);
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error(
      "[worker] DATABASE_URL is not set. The worker needs the shared Postgres the web app also uses — " +
        "PGLite lives inside the web process and a second process cannot see it. " +
        "Set DATABASE_URL (and run migrations) before starting the worker.",
    );
    process.exit(1);
  }

  const operatorId = await resolveOperatorId();
  console.log(`[worker] starting — operator ${operatorId}, interval ${INTERVAL_MS}ms${ONCE ? " (once)" : ""}`);

  if (ONCE) {
    await oneTick(operatorId);
    process.exit(0);
  }

  // Run one tick immediately, then on the interval.
  await oneTick(operatorId);
  const timer = setInterval(() => {
    void oneTick(operatorId);
  }, INTERVAL_MS);
  timer.unref?.();

  const shutdown = (signal: string) => {
    console.log(`[worker] ${signal} — stopping.`);
    clearInterval(timer);
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

void main();
