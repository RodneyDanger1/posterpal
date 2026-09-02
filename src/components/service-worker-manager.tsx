import { useEffect } from "react";

/**
 * Registers the PWA service worker once, on the client, in production only.
 * Dev is skipped so Vite HMR and the streaming SSR head-injector aren't
 * shadowed by a cached shell. Failures are swallowed — the SW is a progressive
 * enhancement, never required for the app to work.
 */
export function ServiceWorkerManager() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (import.meta.env.DEV) return;
    // Electron is the desk itself — a cached shell after an EXE update is a bug.
    if (/Electron/i.test(navigator.userAgent)) {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const r of regs) void r.unregister();
      });
      return;
    }
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* progressive enhancement — ignore */
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
