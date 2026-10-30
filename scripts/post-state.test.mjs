import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isPublishableStatus,
  publishBlockedReason,
  PUBLISHABLE_STATUSES,
} from "../src/lib/posterpal/post-state.ts";

// Regression: publishExisting set Publishing and called Graph without checking
// the current status, so a second publish request for an already-published row
// would put a duplicate on the Page. The guard refuses by name (and says the next
// action) while the legal entrants keep working.
test("draft, failed, local-scheduled and facebook-draft rows may publish", () => {
  for (const status of PUBLISHABLE_STATUSES) {
    assert.equal(isPublishableStatus(status), true, `${status} must be publishable`);
    assert.equal(publishBlockedReason(status), null, `${status} must not be blocked`);
  }
  assert.equal(publishBlockedReason("LocalDraft"), null);
  assert.equal(publishBlockedReason("Failed"), null);
});

test("terminal and in-flight states are refused by name, with the next action", () => {
  const published = publishBlockedReason("Published");
  assert.ok(published);
  assert.match(published, /already published/);
  assert.match(published, /Duplicate it/);

  const publishing = publishBlockedReason("Publishing");
  assert.ok(publishing);
  assert.match(publishing, /already in progress/);

  const scheduled = publishBlockedReason("FacebookScheduled");
  assert.ok(scheduled);
  assert.match(scheduled, /scheduled on Facebook/);
  assert.match(scheduled, /Reschedule it or cancel it/);

  const cancelled = publishBlockedReason("Cancelled");
  assert.ok(cancelled);
  assert.match(cancelled, /Restore it first/);

  const unknown = publishBlockedReason("SomethingElse");
  assert.ok(unknown);
  assert.match(unknown, /cannot be published/);
});

test("the guard's publishable set is exactly the four legal entrants", () => {
  assert.deepEqual([...PUBLISHABLE_STATUSES].sort(), [
    "FacebookDraft",
    "Failed",
    "LocalDraft",
    "LocalScheduled",
  ]);
});
