import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/media/{id} — serves stored media bytes.
 *
 * Rows created after the disk refactor keep only `file_path`; legacy rows still
 * hold an inline data URL. Both are served here so the UI has one URL shape.
 *
 * Access control: same-origin guard + the same session/device resolution the
 * server functions use. A signed-out caller gets 401, a cross-site scripted
 * request gets 403, and a missing/foreign row gets 404 (never 403 — it must not
 * reveal that another user's media exists).
 */
export const Route = createFileRoute("/api/media/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = String((params as { id?: string } | undefined)?.id ?? "").trim();
        if (!id) return new Response("Missing media id", { status: 400 });

        const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
        const { requireUserId } = await import("@/lib/auth/verify.server");
        try {
          assertSameSiteRequest();
        } catch {
          return new Response("Forbidden", { status: 403 });
        }
        let userId: string;
        try {
          userId = await requireUserId();
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }

        const { getSql } = await import("@/lib/db");
        const sql = await getSql();
        const rows = await sql<{
          file_name: string;
          mime_type: string | null;
          data_url: string | null;
          file_path: string | null;
        }>`
          select file_name, mime_type, data_url, file_path from content_items
          where id = ${id} and user_id = ${userId}
          union all
          select file_name, mime_type, data_url, file_path from media_assets
          where id = ${id} and user_id = ${userId}
          limit 1
        `;
        const row = rows[0];
        if (!row) return new Response("Not found", { status: 404 });

        const { readMediaBytes } = await import("@/lib/posterpal/media-files");
        let bytes: Uint8Array | null = null;
        if (row.file_path) {
          const stored = await readMediaBytes(row.file_path);
          if (stored) bytes = new Uint8Array(stored);
        }
        if (!bytes && row.data_url?.startsWith("data:")) {
          const { decodeDataUrl } = await import("@/lib/posterpal/graph");
          const decoded = decodeDataUrl(row.data_url);
          if (decoded) bytes = decoded.bytes;
        }
        if (!bytes) return new Response("Media bytes unavailable", { status: 404 });

        const mime = row.mime_type?.trim() || "application/octet-stream";
        // Copy into a fresh ArrayBuffer so the Response body owns its bytes
        // (Buffer views can be pooled views with a non-zero byteOffset).
        const body = new Uint8Array(bytes);
        return new Response(body.buffer, {
          status: 200,
          headers: {
            "content-type": mime,
            "content-length": String(body.byteLength),
            // Private: these are the operator's unpublished assets.
            "cache-control": "private, max-age=300",
            "x-content-type-options": "nosniff",
            "content-disposition": `inline; filename="${row.file_name.replace(/["\\\r\n]/g, "_")}"`,
          },
        });
      },
    },
  },
});
