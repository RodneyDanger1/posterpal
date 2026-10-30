import { useEffect, useRef } from "react";

/**
 * Re-run a loader when the desk "comes back": window focus, tab visibility, or
 * regaining network. This is what makes comments/pages/queues feel live without
 * hammering Graph on a timer — no polling when the tab is hidden, one refresh the
 * moment the operator returns.
 *
 * `minIntervalMs` debounces focus events (alt-tab spam) so we never exceed the
 * desk's own rate-limit discipline.
 */
export function useFocusRefresh(
  refresh: () => void,
  opts: { minIntervalMs?: number; enabled?: boolean } = {},
): void {
  const cb = useRef(refresh);
  cb.current = refresh;
  const min = opts.minIntervalMs ?? 20_000;
  const enabled = opts.enabled !== false;

  useEffect(() => {
    if (!enabled) return;
    let last = 0;
    const run = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - last < min) return;
      last = now;
      cb.current();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") run();
    };
    window.addEventListener("focus", run);
    window.addEventListener("online", run);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", run);
      window.removeEventListener("online", run);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, min]);
}
