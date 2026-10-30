/**
 * Scheduler retry policy (pure — no I/O, safe in a unit test).
 *
 * The local scheduler used to *intend* to retry retryable Graph failures
 * (rate limits, transient 5xx) with exponential backoff, but the retry branch
 * lived in a `catch` around a function that never rethrows Graph errors — so the
 * branch was dead and every transient failure parked the post in `Failed`.
 *
 * This module states the decision as data: given that the failure was retryable
 * and how many retries are already recorded for the post inside the window,
 * decide retry-vs-fail and which attempt number this is. `publish.tickScheduler`
 * consumes it; `scripts/scheduler-policy.test.mjs` pins the boundaries.
 */

export const MAX_SCHEDULER_RETRIES = 3;
/** Retries older than this do not count against the post's budget. */
export const SCHEDULER_RETRY_WINDOW_MS = 60 * 60 * 1000;

export type SchedulerRetryPlan =
  | { retry: true; attempt: number }
  | { retry: false; attempt: number };

/**
 * @param retryable  the Graph failure was classified retryable (429/5xx/…)
 * @param priorRetries `scheduler_retry` rows already recorded in the window
 */
export function planSchedulerRetry(input: {
  retryable: boolean;
  priorRetries: number;
}): SchedulerRetryPlan {
  const prior = Number.isFinite(input.priorRetries)
    ? Math.max(0, Math.floor(input.priorRetries))
    : 0;
  if (!input.retryable) return { retry: false, attempt: prior + 1 };
  // Three retries per post per window, then a named failure. Never unbounded.
  if (prior >= MAX_SCHEDULER_RETRIES) return { retry: false, attempt: prior + 1 };
  return { retry: true, attempt: prior + 1 };
}

/** Human line written to the scheduler log for a retry. */
export function retryLogMessage(attempt: number, delayMs: number, reason: string): string {
  return `${reason} — retry ${attempt}/${MAX_SCHEDULER_RETRIES} in ${Math.round(delayMs / 1000)}s`;
}
