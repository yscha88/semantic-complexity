# cheese-R7_sonnet-4.6_B

- model: claude-sonnet-4-6
- model_actual: claude-sonnet-4-6
- provider: anthropic-session
- group: B

---

## Analysis: arq/worker.py — Cognitive Complexity

### Function complexity estimates

**`run_job` (~CC 37, grade E) — very high**
The most complex function in this set. Combines: job deserialization, function lookup, timeout management, exception handling (including CancelledError, asyncio.TimeoutError, and generic exceptions), retry logic with exponential backoff calculation, job result serialization, and Redis state cleanup in a single async function. The error path branches alone (retry eligible? score expired? abort requested?) add 10+ branches.

**`_poll_iteration` (~CC 9, grade B) — moderate**
Burst mode limit checking, job acquisition with score-based filtering, abort job cancellation, and finished task cleanup are all present. The interaction between `allow_pick_jobs`, `allow_abort_jobs`, and burst mode creates multiple conditional paths.

**`run_cron` (~CC 9, grade B) — moderate**
Iterates over cron jobs, checks if they're due based on current time, handles overlapping execution prevention, and manages task lifecycle. The time comparison and overlap detection add branches.

**`start_jobs` (~CC 8, grade B) — moderate**
Redis pipeline with `WATCH`/`MULTI`/`EXEC` transaction for distributed lock acquisition. Multiple early-exit conditions: job counter limit, already-running check, score expiry check, and `WatchError`/`ResponseError` handling.

### Nesting depth
`run_job` exceeds 5 levels at its deepest: async context manager → try/except → if retry → if score check → further conditionals.
`start_jobs` reaches 4 levels with the pipeline transaction block.

### Single Responsibility
`run_job` violates SRP severely:
- Job deserialization from Redis
- Function lookup and argument preparation
- Execution with timeout
- Exception classification (retry vs abort vs failure)
- Result serialization
- Redis key cleanup

These are at least 4 distinct responsibilities.

### Code placement
The retry backoff calculation is inlined in `run_job` rather than extracted as `_calculate_retry_delay(job_def, attempt)`. The CancelledError re-raise in the middle of error handling is correct but easy to miss.
