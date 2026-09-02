/** Client-only: are we the phone WebView looking at the PC over LAN? */

export function hostnameOf(origin = typeof window !== "undefined" ? window.location.hostname : ""): string {
  return origin.replace(/^\[|\]$/g, "").toLowerCase();
}

export function isLoopbackHost(host = hostnameOf()): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

export function isPrivateLanHost(host = hostnameOf()): boolean {
  if (isLoopbackHost(host)) return true;
  if (host.startsWith("10.")) return true;
  if (host.startsWith("192.168.")) return true;
  if (host.startsWith("169.254.")) return true;
  const m = /^172\.(\d+)\./.exec(host);
  if (m) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 31) return true;
  }
  return false;
}

/** Android WebView (the APK) after it has navigated to the desk. */
export function isPhoneWebView(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /; wv\)/i.test(ua) || /PosterPal/i.test(ua);
}

export function shouldConnectFacebookHere(): boolean {
  const host = hostnameOf();
  if (isLoopbackHost(host)) return true;
  if (isPrivateLanHost(host)) return false;
  return true;
}

export function capacitorBootUrl(change = false): string {
  return change ? "http://localhost/?change=1" : "http://localhost/";
}
