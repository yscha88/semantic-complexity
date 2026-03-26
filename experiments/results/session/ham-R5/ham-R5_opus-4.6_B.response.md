# ham-R5_opus-4.6_B

- model: claude-opus-4-6
- model_actual: claude-opus-4-6
- provider: anthropic-session
- group: B

---

## Analysis: arq/worker.py — Behavioral Preservation

### Summary
arq's worker has a high ratio of critical-path code to test coverage. The `run_job` function alone carries behavioral contracts that are impossible to verify without integration tests against a real or mock Redis instance.

### Critical paths and behavioral contracts

**`run_job()` — critical, no golden tests**
Observable behaviors that must be preserved:
1. Successful job → result stored in Redis with correct key format
2. Exception → retry logic: re-enqueued with `timestamp + exponential_backoff` score
3. Abort key present → skip retry regardless of attempt count  
4. In-progress key deleted in all terminal paths (success, failure, abort)
5. `CancelledError` re-raised without being swallowed

Contract violation example: if the in-progress key TTL changes, stuck jobs last longer. If the retry score formula changes, retry timing breaks for all existing `RetryError` users.

**`start_jobs()` — medium risk**
The Redis `WATCH/MULTI/EXEC` distributed locking ensures at-most-once job start across multiple workers. This behavioral guarantee is untestable without concurrent execution tests.

**`run_cron()` — medium risk**
Cron overlap prevention (`if coro_id in self.tasks`) prevents a cron job from running twice simultaneously. This is a behavioral guarantee that would break if the task tracking structure changes.

### What breaks silently without tests

1. Rename `in_progress_key_prefix` → stuck job detection breaks
2. Change retry formula → all configured `defer` values produce wrong delays
3. Remove `CancelledError` re-raise → graceful shutdown stops working
4. Change result serialization format → clients reading results get `None` or corrupt data
5. Reorder exception handlers → `TimeoutError` might hit wrong branch

### Recommendations
1. Add `run_job()` golden tests using a mock or test Redis instance
2. Add a test specifically for `CancelledError` propagation (cancellation test)
3. Add a test for retry backoff: given `RetryError(attempts=3, defer=1.0)`, verify score is set to `now + 1000ms` on first retry
4. Pin the in-progress key naming as a named constant with a test
