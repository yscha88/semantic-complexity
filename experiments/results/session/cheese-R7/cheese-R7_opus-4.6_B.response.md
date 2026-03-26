# cheese-R7_opus-4.6_B

- model: claude-opus-4-6
- model_actual: claude-opus-4-6
- provider: anthropic-session
- group: B

---

## Analysis: arq/worker.py — Cognitive Complexity

### Overall assessment
This is an async Redis-based job queue worker. `run_job` is a high-complexity function that combines multiple concerns. Other functions are moderate complexity typical of queue worker implementations.

### Function analysis

**`run_job` (~CC 37, grade E) — critical**
This function is the heart of the worker and has accumulated significant complexity over time. It handles:
- Job data retrieval and deserialization (with corrupt data handling)
- Function lookup and `coroutine_function` type checking  
- Timeout-bounded execution with `asyncio.wait_for`
- Exception handling with three distinct paths: `CancelledError` (re-raise), `asyncio.TimeoutError` (possible retry), generic `Exception` (retry logic)
- Retry decision: attempt count vs max, score expiry, abort flag
- Exponential backoff calculation: `1000 * backoff * (2 ** (job_try - 2))`
- Result serialization and storage
- In-progress key cleanup

The `CancelledError` re-raise is correct for asyncio task cancellation but is easy to accidentally remove during maintenance.

**`_poll_iteration` (~CC 9, grade B)**
Manages burst mode limits, job acquisition from sorted set, abort job cancellation, finished task cleanup, and heartbeat. The burst mode interaction (checking remaining capacity before reading) is correct but adds branches.

**`start_jobs` (~CC 8, grade B)**
Implements distributed lock via Redis `WATCH`/`MULTI`/`EXEC`. Multiple early-exit guards: job counter limit, already-running detection, score expiry. The counter management (increment before pipeline, decrement on failure) creates a temporary inconsistency window.

**`run_cron` (~CC 9, grade B)**
Cron job scheduling with overlap prevention. The time calculation and `last_run` tracking are correct but dense.

### Critical issues

1. **`run_job` lacks a `finally` block** — Redis in-progress key cleanup is not guaranteed on unexpected exceptions
2. **Counter increment/decrement in `start_jobs` is not atomic** — creates race condition window in concurrent polling
3. **Exponential backoff formula is undocumented** — `2 ** (job_try - 2)` means attempt 2 = 1x base, attempt 3 = 2x, attempt 4 = 4x, etc. This is non-obvious.

### Refactoring priority
1. Extract `run_job` into 4+ methods with a `try/finally` for cleanup
2. Document the retry backoff formula
3. Add an assertion comment explaining why `CancelledError` must be re-raised
