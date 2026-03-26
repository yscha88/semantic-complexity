# ham-R5_sonnet-4.6_B

- model: claude-sonnet-4-6
- model_actual: claude-sonnet-4-6
- provider: anthropic-session
- group: B

---

## Analysis: arq/worker.py — Behavioral Preservation

### Critical paths

**`run_job()` — highest risk**
The entire job execution pipeline is in one function. Critical behaviors that must be preserved:
- In-progress key (`psetex`) set before execution, deleted after
- `CancelledError` must propagate (never swallowed)
- Retry logic: job re-enqueued with score = `timestamp + backoff_delay`
- Abort check: if `abort` key exists in Redis, job is not retried
- Result stored in Redis with serialization

No golden tests visible. The exact serialization format of results and the retry key naming (`in_progress_key_prefix + job_id`) are implicit contracts.

**`start_jobs()` — medium risk**
Distributed lock acquisition via Redis `WATCH/MULTI/EXEC`. The race condition handling (retry on `WatchError`) is a behavioral contract. If refactored to use Lua scripts, the behavior must be exactly equivalent.

**`_poll_iteration()` — medium risk**
The ordering of operations (pick jobs → cancel aborted → cleanup finished) is behavioral. Reordering could cause jobs to be polled after abort signals are processed, changing which jobs are aborted.

**`run_cron()` — medium risk**
Overlap prevention (checking if a cron task is already running) is behavioral. The timing calculation for "is this cron job due?" must remain exact.

### Key behavioral contracts (implicit)

1. A job's in-progress key is set atomically with job start and deleted on completion/retry/failure
2. `CancelledError` propagates — shutdown works correctly
3. Retry scores are set correctly for delayed re-execution
4. Job counter reflects actual in-flight count

### Refactoring risks
`run_job` cannot be safely decomposed without tests because:
- The exception handling sequence (CancelledError → re-raise; TimeoutError → retry check; Exception → retry check) must be preserved exactly
- The Redis cleanup sequence must run in all paths
