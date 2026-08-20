import { createFileRoute } from "@tanstack/react-router";
import { requireUserId } from "@/lib/auth/verify.server";
import { beginFacebookOAuth } from "@/lib/posterpal/ops";

/**
 * Same-origin bounce for the Facebook OAuth popup.
 * Opened synchronously on the Connect click so the preview iframe never
 * navigates to facebook.com (that paints Meta's cookie wall over the desk).
 */
export const Route = createFileRoute("/api/facebook/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await requireUserId();
        const origin = new URL(request.url).origin;
        const redirectUri = `${origin}/api/facebook/callback`;
        try {
          const { url } = await beginFacebookOAuth(userId, redirectUri);
          return new Response(null, {
            status: 302,
            headers: {
              Location: url,
              "Cache-Control": "no-store",
            },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Could not start Facebook login";
          const body = `<!doctype html><html><body style="font-family:Segoe UI,system-ui,sans-serif;padding:32px;background:#F0F2F5;color:#050505">
  <p>${escapeHtml(msg)}</p>
  <p>Close this window and try Connect again from Settings.</p>
  <script>
    try { window.opener && window.opener.postMessage({ source: "posterpal-facebook", ok: false, message: ${JSON.stringify(msg)} }, window.location.origin); } catch (e) {}
  </script>
</body></html>`;
          return new Response(body, {
            status: 400,
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }
      },
    },
  },
});

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (ch) => {
    if (ch === "&") return "&" + "amp;";
    if (ch === "<") return "&" + "lt;";
    if (ch === ">") return "&" + "gt;";
    if (ch === '"') return "&" + "quot;";
    return "&#39;";
  });
}
