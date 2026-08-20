/** Same-origin bounce so the popup is first-party (Facebook cookies work there). */
export function facebookCallbackUri(): string {
  if (typeof window === "undefined") return "/api/facebook/callback";
  return `${window.location.origin}/api/facebook/callback`;
}

function facebookStartUri(): string {
  if (typeof window === "undefined") return "/api/facebook/start";
  return `${window.location.origin}/api/facebook/start`;
}

/**
 * Open the official Facebook OAuth dialog in a TOP-LEVEL popup.
 *
 * Must run on the click (no await first) — waiting on a server function drops
 * the user-gesture, the popup is blocked, and a location= fallback would
 * navigate the live-preview iframe to Facebook's cookie wall.
 */
export function connectFacebookPopup(): Promise<string> {
  const startUrl = facebookStartUri();
  const popup = window.open(startUrl, "posterpal-fb", "popup,width=520,height=720");
  if (!popup) {
    throw new Error(
      "Pop-up blocked. Allow pop-ups to connect Facebook — this preview frame cannot open Facebook itself (third-party cookies).",
    );
  }
  return new Promise<string>((resolve, reject) => {
    const origin = window.location.origin;
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
      if (!popup.closed) return;
      window.setTimeout(() => {
        finish(false, "Facebook window closed before finishing.");
      }, 400);
    }, 400);
    const onMsg = (ev: MessageEvent) => {
      if (ev.origin !== origin) return;
      const data = ev.data as { source?: string; ok?: boolean; message?: string };
      if (data?.source !== "posterpal-facebook") return;
      finish(Boolean(data.ok), data.message ?? (data.ok ? "Connected" : "Connect failed"));
    };
    window.addEventListener("message", onMsg);
  });
}
