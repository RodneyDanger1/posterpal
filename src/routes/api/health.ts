import { createFileRoute } from "@tanstack/react-router";

/**
 * Health endpoint for orchestrators / load balancers / Docker HEALTHCHECK.
 * Returns 200 when the process is up AND the database answers `select 1`;
 * 503 when the DB is unreachable. No auth — this is infrastructure, not data.
 */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      OPTIONS: () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, OPTIONS",
            "access-control-max-age": "86400",
          },
        }),
      GET: async () => {
        const { readDeskHealth } = await import("@/lib/posterpal/log");
        const health = await readDeskHealth();
        return Response.json(health, {
          status: health.db === "up" ? 200 : 503,
          headers: {
            "content-type": "application/json",
            "cache-control": "no-store",
            // Boot page in the APK is a different origin (http://localhost) and
            // probes this before navigating. Health is not secret.
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, OPTIONS",
          },
        });
      },
    },
  },
});
