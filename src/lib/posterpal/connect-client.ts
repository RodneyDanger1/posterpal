import { shouldConnectFacebookHere } from "./runtime-client";

/** Facebook treats localhost ≠ 127.0.0.1. The Windows desk always uses 127.0.0.1. */
export function facebookCallbackUri(): string {
  if (typeof window === "undefined") return "http://127.0.0.1:8080/api/facebook/callback";
  try {
    const u = new URL(window.location.origin);
    if (u.hostname === "localhost" || u.hostname === "::1") u.hostname = "127.0.0.1";
    return `${u.origin}/api/facebook/callback`;
  } catch {
    return `${window.location.origin}/api/facebook/callback`;
  }
}

function facebookStartUri(redirectUri: string): string {
  const path = typeof window === "undefined" ? "/api/facebook/start" : `${window.location.origin}/api/facebook/start`;
  return `${path}?redirect_uri=${encodeURIComponent(redirectUri)}`;
}

/**
 * Official Facebook Login. Opens a popup when the browser allows it; otherwise
 * a new tab. Electron opens the system browser (real Chrome cookies). We always
 * poll the desk because postMessage dies across COOP / system-browser tabs.
 */
export function connectFacebookPopup(
  poll?: () => Promise<{ ok: boolean; message: string; lastError?: string | null }>,
): Promise<string> {
  if (typeof window !== "undefined" && !shouldConnectFacebookHere()) {
    return Promise.reject(
      new Error(
        "Facebook Login has to run on the PC window (http://127.0.0.1:8080). This phone is looking at the same desk over Wi‑Fi and does not talk to Facebook itself.",
      ),
    );
  }
  const redirect = facebookCallbackUri();
  const startUrl = facebookStartUri(redirect);
  const popup = window.open(startUrl, "posterpal-fb", "popup,width=560,height=740");
  if (!popup) {
    const a = document.createElement("a");
    a.href = startUrl;
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const started = Date.now();
    const finish = (ok: boolean, message: string) => {
      if (settled) return;
      settled = true;
      window.clearInterval(timer);
      window.removeEventListener("message", onMsg);
      if (ok) resolve(message);
      else reject(new Error(message));
    };
    const timer = window.setInterval(() => {
      void (async () => {
        if (settled) return;
        if (poll) {
          try {
            const s = await poll();
            if (s.ok) {
              finish(true, s.message);
              return;
            }
          } catch {
            /* keep polling */
          }
        }
        if (Date.now() - started > 180_000) {
          finish(
            false,
            "Timed out waiting for Facebook. Put exactly http://127.0.0.1:8080/api/facebook/callback on the Facebook App as Valid OAuth Redirect URI (leave App Domains empty). Or paste a User Token from Graph API Explorer.",
          );
        }
      })();
    }, 800);
    const onMsg = (ev: MessageEvent) => {
      const data = ev.data as { source?: string; ok?: boolean; message?: string };
      if (data?.source !== "posterpal-facebook") return;
      finish(Boolean(data.ok), data.message ?? (data.ok ? "Connected" : "Connect failed"));
    };
    window.addEventListener("message", onMsg);
  });
}
