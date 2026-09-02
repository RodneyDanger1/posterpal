/**
 * Structured desk log. Console always; Postgres when the DB is up.
 * Scopes are dotted (`agent.run`, `tick.done`, `compose`) so Happenings can
 * group them. Logging must never throw — callers fire-and-forget.
 */
import { randomUUID } from "node:crypto";

export type DeskLogLevel = "debug" | "info" | "warn" | "error";

export type DeskLogInput = {
  level?: DeskLogLevel;
  scope: string;
  message: string;
  userId?: string | null;
  extra?: unknown;
};

function extraText(extra: unknown): string | null {
  if (extra == null) return null;
  if (extra instanceof Error) return extra.stack || extra.message;
  try {
    const s = JSON.stringify(extra);
    return s.length > 4000 ? s.slice(0, 4000) : s;
  } catch {
    return String(extra).slice(0, 4000);
  }
}

/** Structured log. Never throws. Console always; Postgres when the DB is up. */
export async function deskLog(input: DeskLogInput): Promise<void> {
  const level = input.level ?? "info";
  const line = `[posterpal:${input.scope}] ${input.message}`;
  if (level === "error") console.error(line, input.extra ?? "");
  else if (level === "warn") console.warn(line, input.extra ?? "");
  else console.log(line);

  try {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      insert into desk_logs (id, user_id, level, scope, message, extra)
      values (
        ${randomUUID()},
        ${input.userId ?? null},
        ${level},
        ${input.scope.slice(0, 80)},
        ${input.message.slice(0, 2000)},
        ${extraText(input.extra)}
      )
    `;
    await sql`delete from desk_logs where created_at < now() - interval '14 days'`;
  } catch {
    /* logging must never take down the desk */
  }
}

export async function listDeskLogs(userId: string, limit = 80, scope?: string) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const cap = Math.min(200, Math.max(1, limit));
  const scopeFilter = scope?.trim().slice(0, 80);
  type DeskLogRow = {
    id: string;
    level: string;
    scope: string;
    message: string;
    extra: string | null;
    created_at: string;
  };
  if (scopeFilter) {
    const prefix = `${scopeFilter}%`;
    return sql<DeskLogRow>`
      select id, level, scope, message, extra, created_at
      from desk_logs
      where (user_id = ${userId} or user_id is null)
        and (scope = ${scopeFilter} or scope like ${prefix})
      order by created_at desc
      limit ${cap}
    `;
  }
  return sql<DeskLogRow>`
    select id, level, scope, message, extra, created_at
    from desk_logs
    where user_id = ${userId} or user_id is null
    order by created_at desc
    limit ${cap}
  `;
}

export async function stampTick(userId: string, key: "worker_last_tick" | "scheduler_last_tick") {
  try {
    const { setSetting } = await import("./repo");
    await setSetting(userId, key, new Date().toISOString(), false);
  } catch {
    /* stamp is best-effort */
  }
}

export async function readDeskHealth(userId?: string) {
  let db = "down";
  let workerLastTick: string | null = null;
  let schedulerLastTick: string | null = null;
  try {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`select 1`;
    db = "up";
    if (userId) {
      const { getSetting } = await import("./repo");
      workerLastTick = await getSetting(userId, "worker_last_tick");
      schedulerLastTick = await getSetting(userId, "scheduler_last_tick");
    } else {
      const rows = await sql<{ key: string; value_plain: string | null }>`
        select key, value_plain from app_settings
        where key in ('worker_last_tick', 'scheduler_last_tick')
        order by updated_at desc
      `;
      for (const r of rows) {
        if (r.key === "worker_last_tick" && !workerLastTick) workerLastTick = r.value_plain;
        if (r.key === "scheduler_last_tick" && !schedulerLastTick) schedulerLastTick = r.value_plain;
      }
    }
  } catch {
    db = "down";
  }
  const fresh = (iso: string | null) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return Number.isFinite(t) && Date.now() - t < 3 * 60_000;
  };
  const workerFresh = fresh(workerLastTick);
  const schedulerFresh = fresh(schedulerLastTick);
  return {
    live: true,
    db,
    workerLastTick,
    schedulerLastTick,
    workerFresh,
    schedulerFresh,
    tickerFresh: workerFresh || schedulerFresh,
    status: db === "up" ? "ok" : "degraded",
  };
}
