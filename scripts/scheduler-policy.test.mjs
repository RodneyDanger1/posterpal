import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MAX_SCHEDULER_RETRIES,
  planSchedulerRetry,
  retryLogMessage,
} from "../src/lib/posterpal/scheduler-policy.ts";

// Regression: the retry/backoff branch in tickScheduler was dead code because the
// function it wrapped never rethrew Graph errors. These lock the decision the
// scheduler now consumes from attemptGraphPublish's `failure` result.
test("retryable failures retry up to three times per post, then fail", () => {
  assert.deepEqual(planSchedulerRetry({ retryable: true, priorRetries: 0 }), { retry: true, attempt: 1 });
  assert.deepEqual(planSchedulerRetry({ retryable: true, priorRetries: 1 }), { retry: true, attempt: 2 });
  assert.deepEqual(planSchedulerRetry({ retryable: true, priorRetries: 2 }), { retry: true, attempt: 3 });
  assert.deepEqual(planSchedulerRetry({ retryable: true, priorRetries: 3 }), {
    retry: false,
    attempt: 4,
  });
  assert.equal(MAX_SCHEDULER_RETRIES, 3);
  // Never unbounded, even with corrupt/oversized counters.
  assert.equal(planSchedulerRetry({ retryable: true, priorRetries: 999 }).retry, false);
  assert.equal(planSchedulerRetry({ retryable: true, priorRetries: -4 }).attempt, 1);
  assert.equal(planSchedulerRetry({ retryable: true, priorRetries: Number.NaN }).retry, true);
});

test("human-visible failures are never retried", () => {
  assert.deepEqual(planSchedulerRetry({ retryable: false, priorRetries: 0 }), {
    retry: false,
    attempt: 1,
  });
  assert.deepEqual(planSchedulerRetry({ retryable: false, priorRetries: 2 }), {
    retry: false,
    attempt: 3,
  });
});

test("the retry log line names the attempt budget and the delay in seconds", () => {
  const line = retryLogMessage(2, 2_400, "Graph rate limit (HTTP 429)");
  assert.equal(line, "Graph rate limit (HTTP 429) — retry 2/3 in 2s");
});
