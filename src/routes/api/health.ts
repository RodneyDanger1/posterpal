import { createFileRoute } from "@tanstack/react-router";

/**
 * Health endpoint for orchestrators / load balancers / Docker HEALTHCHECK.
 * Returns 200 when the process is up AND the database answers `select 1`;
 * 503 when the DB is unreachable. No auth — this is infrastructure, not data.
 */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const dbUp = await checkDatabase();
        return Response.json(
          { status: dbUp ? "ok" : "degraded", live: true, db: dbUp ? "up" : "down" },
          {
            status: dbUp ? 200 : 503,
            headers: { "content-type": "application/json", "cache-control": "no-store" },
          },
        );
      },
    },
  },
});

async function checkDatabase(): Promise<boolean> {
  try {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`select 1`;
    return true;
  } catch {
    return false;
  }
}
