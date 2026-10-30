/**
 * Post lifecycle guards (pure — no I/O, safe in a unit test).
 *
 * The post row is a small state machine:
 *
 *   LocalDraft ─┐
 *   LocalScheduled ─┼─> Publishing ─> Published | Failed | LocalScheduled(backoff)
 *   Failed ─────┘                 └─> FacebookScheduled / FacebookDraft (graph schedule/draft)
 *   Published ──> (terminal; duplicate into a new row)
 *   Cancelled ──> LocalDraft (restore only; never straight to Publishing)
 *
 * `publishExisting` used to set `Publishing` and call Graph without checking the
 * current status: a second publish request for a `Published`/`Publishing` post
 * would send a duplicate to Facebook. This module names the legal publish
 * entrants and gives the refusal text for the rest.
 */

export const PUBLISHABLE_STATUSES = [
  "LocalDraft",
  "LocalScheduled",
  "Failed",
  "FacebookDraft",
] as const;

export type PublishableStatus = (typeof PUBLISHABLE_STATUSES)[number];

export function isPublishableStatus(status: string): boolean {
  return (PUBLISHABLE_STATUSES as readonly string[]).includes(status);
}

/**
 * Null when this row may enter `Publishing`; otherwise the operator-facing
 * refusal that names the current state and the correct next action.
 */
export function publishBlockedReason(status: string): string | null {
  if (isPublishableStatus(status)) return null;
  if (status === "Published") {
    return "This post is already published. Duplicate it into a new draft if you need another send — publishing again would put a duplicate on Facebook.";
  }
  if (status === "Publishing") {
    return "A publish is already in progress for this post. Wait for it to finish before retrying.";
  }
  if (status === "FacebookScheduled") {
    return "This post is scheduled on Facebook. Reschedule it or cancel it first; publishing now would duplicate it.";
  }
  if (status === "Cancelled") {
    return "This draft was cancelled. Restore it first, then publish.";
  }
  return `Posts in status "${status}" cannot be published from this desk.`;
}
