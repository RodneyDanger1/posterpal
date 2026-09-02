import { useEffect } from "react";
import { reportClientErrorFn } from "@/lib/posterpal/fns";

/** Catch uncaught UI errors and send them to the desk log. Never throws. */
export function ClientLogCatcher() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const last = new Map<string, number>();
    const send = (message: string, extra?: string) => {
      const key = message.slice(0, 180);
      const now = Date.now();
      if ((last.get(key) ?? 0) > now - 8_000) return;
      last.set(key, now);
      void reportClientErrorFn({ data: { message, scope: "window", extra } }).catch(() => undefined);
    };
    const onError = (event: ErrorEvent) => {
      send(event.message || "window.onerror", event.error instanceof Error ? event.error.stack : undefined);
    };
    const onReject = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason ?? "unhandledrejection");
      send(message, reason instanceof Error ? reason.stack : undefined);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onReject);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onReject);
    };
  }, []);
  return null;
}
