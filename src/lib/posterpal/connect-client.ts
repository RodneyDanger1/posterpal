import { beginFacebookOAuth } from "./fns";

export function facebookCallbackUri(): string {
  if (typeof window === "undefined") return "/api/facebook/callback";
  return `${window.location.origin}/api/facebook/callback`;
}

/** Open the official Facebook OAuth dialog and resolve when the popup reports back. */
export function connectFacebookPopup(): Promise<string> {
  const redirectUri = facebookCallbackUri();
  return beginFacebookOAuth({ data: { redirectUri } }).then(({ url }) => {
    return new Promise<string>((resolve, reject) => {
      const popup = window.open(url, "posterpal-fb", "popup,width=520,height=720");
      if (!popup) {
        window.location.href = url;
        reject(new Error("Popup blocked — allow pop-ups, or continue in this tab."));
        return;
      }
      let settled = false;
      let closeTimer: number | undefined;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        window.clearInterval(timer);
        if (closeTimer !== undefined) window.clearTimeout(closeTimer);
        window.removeEventListener("message", onMsg);
        fn();
      };
      const timer = window.setInterval(() => {
        if (!popup.closed) return;
        window.clearInterval(timer);
        closeTimer = window.setTimeout(() => {
          finish(() => reject(new Error("Facebook window closed before finishing.")));
        }, 600);
      }, 400);
      const onMsg = (ev: MessageEvent) => {
        if (ev.origin !== window.location.origin) return;
        const data = ev.data as { source?: string; ok?: boolean; message?: string };
        if (data?.source !== "posterpal-facebook") return;
        if (data.ok) finish(() => resolve(data.message ?? "Connected"));
        else finish(() => reject(new Error(data.message ?? "Connect failed")));
      };
      window.addEventListener("message", onMsg);
    });
  });
}
