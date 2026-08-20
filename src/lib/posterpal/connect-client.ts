/** Same-origin bounce so the popup is first-party (Facebook cookies work there). */
export function facebookCallbackUri(): string {
  if (typeof window === "undefined") return "/api/facebook/callback";
  return `${window.location.origin}/api/facebook/callback`;
}

function facebookStartUri(redirectUri: string): string {
  const path = typeof window === "undefined" ? "/api/facebook/start" : `${window.location.origin}/api/facebook/start`;
  return `${path}?redirect_uri=${encodeURIComponent(redirectUri)}`;
}

/**
 * Open the official Facebook OAuth dialog in a TOP-LEVEL popup.
 *
 * Must run on the click (no await first) — waiting on a server function drops
 * the user-gesture, the popup is blocked, and a location= fallback would
 * navigate the live-preview iframe to Facebook's cookie wall.
 *
 * After the popup closes we poll the desk: postMessage often dies (COOP /
 * opener null) even when Graph already imported Pages.
 */
export function connectFacebookPopup(
  poll?: () => Promise<{ ok: boolean; message: string; lastError?: string | null }>,
): Promise<string> {
  const redirect = facebookCallbackUri();
  const startUrl = facebookStartUri(redirect);
  const popup = window.open(startUrl, "posterpal-fb", "popup,width=560,height=740");
  if (!popup) {
    throw new Error(
      "Pop-up blocked. Allow pop-ups for this site — Facebook Login cannot run inside the preview iframe.",
    );
  }
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const finish = (ok: boolean, message: string) => {
      if (settled) return;
      settled = true;
      window.clearInterval(timer);
      window.removeEventListener("message", onMsg);
      if (ok) resolve(message);
      else reject(new Error(message));
    };
    const timer = window.setInterval(() => {
      let closed = false;
      try {
        closed = popup.closed;
      } catch {
        closed = true;
      }
      if (!closed) return;
      window.clearInterval(timer);
      void (async () => {
        if (poll) {
          for (let i = 0; i < 16; i++) {
            await new Promise((r) => window.setTimeout(r, 500));
            try {
              const s = await poll();
              if (s.ok) {
                finish(true, s.message);
                return;
              }
              if (s.lastError) {
                finish(false, s.lastError);
                return;
              }
            } catch {
              /* keep polling */
            }
          }
        }
        finish(
          false,
          "Facebook window closed before we got a result. If you logged in, wait a second and refresh Pages. Otherwise add the Redirect URI from Settings to the Facebook App, or paste a User Token.",
        );
      })();
    }, 400);
    const onMsg = (ev: MessageEvent) => {
      const data = ev.data as { source?: string; ok?: boolean; message?: string };
      if (data?.source !== "posterpal-facebook") return;
      finish(Boolean(data.ok), data.message ?? (data.ok ? "Connected" : "Connect failed"));
    };
    window.addEventListener("message", onMsg);
  });
}
