import { createFileRoute } from "@tanstack/react-router";
import { isLocalTickCaller } from "@/lib/posterpal/lan";

/**
 * Local tick for the Windows EXE (Electron) so scheduled posts fire even if
 * the window is in the background. Only loopback / LAN — never the public
 * internet. The phone never calls this; it talks to the same desk over HTTP.
 */
export const Route = createFileRoute("/api/tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isLocalTickCaller(request)) {
          return Response.json({ error: "tick is local-only" }, { status: 403 });
        }
        try {
          const { getSql } = await import("@/lib/db");
          const sql = await getSql();
          const rows = await sql<{ user_id: string }>`select distinct user_id from app_settings limit 1`;
          const userId = process.env.POSTERPAL_USER_ID?.trim() || rows[0]?.user_id || "dev-user";
          const ops = await import("@/lib/posterpal/ops");
          const result = await ops.tick(userId);
          return Response.json({ ok: true, ...result });
        } catch (e) {
          const { deskLog } = await import("@/lib/posterpal/log");
          const message = e instanceof Error ? e.message : String(e);
          await deskLog({ level: "error", scope: "api.tick", message });
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
