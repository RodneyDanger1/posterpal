import { createFileRoute } from "@tanstack/react-router";
import { requireUserId } from "@/lib/auth/verify.server";
import { beginFacebookOAuth } from "@/lib/posterpal/ops";
import { resolveOAuthRedirect } from "@/lib/posterpal/oauth-origin";

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
        try {
          const redirectUri = resolveOAuthRedirect(request);
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
          const body = `<!doctype html><html><body style="font-family:Segoe UI,system-ui,sans-serif;padding:32px;background:#F0F2F5;color:#050505;max-width:560px">
  <p>${escapeHtml(msg)}</p>
  <p>Save App ID + Secret in Settings first. Add the Redirect URI shown there to the Facebook App. Keep this window open so you can read the error.</p>
  <p><button onclick="window.close()" style="padding:8px 14px;border:0;border-radius:6px;background:#1877F2;color:#fff;font-weight:600;cursor:pointer">Close</button></p>
  <script>
    try { window.opener && window.opener.postMessage({ source: "posterpal-facebook", ok: false, message: ${JSON.stringify(msg)} }, "*"); } catch (e) {}
  </script>
</body></html>`;
          return new Response(body, {
            status: 200,
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
