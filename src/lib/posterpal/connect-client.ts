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
      const timer = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(timer);
          window.removeEventListener("message", onMsg);
          reject(new Error("Facebook window closed before finishing."));
        }
      }, 400);
      const onMsg = (ev: MessageEvent) => {
        if (ev.origin !== window.location.origin) return;
        const data = ev.data as { source?: string; ok?: boolean; message?: string };
        if (data?.source !== "posterpal-facebook") return;
        window.clearInterval(timer);
        window.removeEventListener("message", onMsg);
        if (data.ok) resolve(data.message ?? "Connected");
        else reject(new Error(data.message ?? "Connect failed"));
      };
      window.addEventListener("message", onMsg);
    });
  });
}
