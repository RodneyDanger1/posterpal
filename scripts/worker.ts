#!/usr/bin/env node
/**
 * PosterPal background worker — keeps the desk alive when no browser tab is open.
 *
 * Every 60s (or once with --once):
 *   1. tickScheduler(userId)      — fire due LocalScheduled, fail stuck Publishing
 *   2. recycleDuePosts(userId)    — HITL LocalDraft remix copies
 *   3. ops.rssDrafts(userId)      — HITL LocalDrafts from page RSS feeds
 *   4. syncFromGraph(userId)      — published posts, comments, insights
 *   5. refreshVaultTokens(userId) — extend long-lived tokens
 *
 * With DATABASE_URL: runs those jobs in-process against Postgres.
 * Without DATABASE_URL: HTTP POSTs /api/tick on the local desk (PGLite lives
 * in the web process; this worker cannot see it). The desk must be up.
 * Run with: npm run worker
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
  const { deskLog, stampTick } = await import("../src/lib/posterpal/log");
  await stampTick(operatorId, "worker_last_tick");
  const failed = results.filter((r) => r.includes("FAILED"));
  const notable = results.filter((r) => !/^vault:ok$/.test(r) && !/^tick:0$/.test(r));
  if (failed.length || notable.length) {
    await deskLog({
      level: failed.length ? "error" : "info",
      scope: "worker",
      userId: operatorId,
      message: (failed.length ? failed : notable).join(" | "),
    });
  }
}

async function httpTick(): Promise<void> {
  const port = Number(process.env.PORT || process.env.NITRO_PORT || 8080);
  const url = `http://127.0.0.1:${port}/api/tick`;
  try {
    const res = await fetch(url, { method: "POST" });
    const text = await res.text();
    const line = `[worker:http] ${new Date().toISOString()} ${url} -> ${res.status} ${text.slice(0, 180)}`;
    if (!res.ok) console.warn(line);
    else console.log(line);
  } catch (e) {
    console.warn(`[worker:http] ${new Date().toISOString()} ${url} failed:`, e instanceof Error ? e.message : e);
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const isPglite = !databaseUrl;
  if (isPglite) {
    console.log("[worker] DATABASE_URL not set — running HTTP ticker against local desk /api/tick (PGLite mode)");
  }

  const runTick = async () => {
    if (isPglite) {
      await httpTick();
    } else {
      const operatorId = await resolveOperatorId();
      await oneTick(operatorId);
    }
  };

  console.log(`[worker] starting — interval ${INTERVAL_MS}ms${ONCE ? " (once)" : ""}`);

  if (ONCE) {
    await runTick();
    process.exit(0);
  }

  await runTick();
  const timer = setInterval(() => {
    void runTick();
  }, INTERVAL_MS);

  const shutdown = (signal: string) => {
    console.log(`[worker] ${signal} — stopping.`);
    clearInterval(timer);
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => {
    console.error("[worker] unhandledRejection", reason instanceof Error ? reason.message : reason);
  });
  process.on("uncaughtException", (err) => {
    console.error("[worker] uncaughtException", err.message);
    process.exit(1);
  });
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

void main();
