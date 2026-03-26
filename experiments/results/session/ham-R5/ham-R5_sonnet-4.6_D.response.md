# ham-R5_sonnet-4.6_D

- model: claude-sonnet-4-6
- model_actual: claude-sonnet-4-6
- provider: anthropic-session
- group: D

---

## Analysis: arq/worker.py — Behavioral Preservation (SKILL)

---

### H1: Golden Tests

**`run_job()` — ❌ fail (critical)**
The most critical function. Contract:
- Input: `job_id` in Redis with serialized function + args
- Expected: function executes, result stored, in-progress key deleted
- Exception path: retry if eligible (re-enqueue with delay), else mark failed
- Abort path: if abort key exists, do not retry

No golden tests observed. The Redis key naming convention (`in_progress_key_prefix + job_id`, result key format) is an implicit serialization contract that could silently change.

**`start_jobs()` distributed lock — ❌ fail**
The `WATCH/MULTI/EXEC` pattern's observable behavior (exactly-once job start under concurrent workers) is not tested. A golden test would verify that two concurrent `start_jobs()` calls for the same job_id result in exactly one job starting.

**`_poll_iteration()` scheduling — ⚠️ warning**
The burst mode behavior (`max_burst_jobs` limit) and the `allow_pick_jobs`/`allow_abort_jobs` flags have observable effects but no pinned tests.

---

### H2: Contract Tests

**Worker ↔ Redis schema contract — ❌ fail**
The implicit Redis schema:
- Queue sorted set: `job_id → score (timestamp_ms)` 
- In-progress key: `in_progress:{job_id}` with TTL
- Result key: key format from `serialize_result()`
- Abort key: checked before retry

This schema is a contract between the worker and any client enqueuing jobs. No contract test verifies it.

**`run_job()` exception type contract — ❌ fail**
The distinction between `CancelledError` (propagate), `asyncio.TimeoutError` (retry if configured), and `Exception` (retry based on attempt count) is a critical contract. No test verifies this three-way dispatch.

---

### H3: Structural vs Behavioral Separation

**`run_job()` — ❌ fail**: Cannot be structurally refactored. The exception handling, retry logic, and Redis cleanup are interleaved:
```python
try:
    result = await asyncio.wait_for(coro, timeout)
except asyncio.CancelledError:
    raise                        # ← behavioral: must propagate
except Exception as e:
    ...                          # ← retry decision + Redis operations
else:
    ...                          # ← result storage + cleanup
```
Any extraction risks changing the exception propagation behavior.

---

### H4: Critical Path Coverage

| Path | Coverage | Risk |
|---|---|---|
| `run_job()` → success → result stored | ❌ none | Critical |
| `run_job()` → exception → retry re-enqueue | ❌ none | Critical |
| `run_job()` → CancelledError → propagates | ❌ none | Critical |
| `run_job()` → abort key present → no retry | ❌ none | High |
| `start_jobs()` → concurrent call → exactly one starts | ❌ none | High |
| `_poll_iteration()` → burst limit → stops | ❌ none | Medium |

Estimated critical path coverage: **<5%**.

---

### Free-form analysis

**1. In-progress key cleanup is not guaranteed on unhandled exception**
```python
# set in start_jobs:
pipe.psetex(in_progress_key, int(self.in_progress_timeout_s * 1000), b'1')
# deleted in run_job — but only if code reaches cleanup
```
If `run_job` raises an unhandled exception before cleanup (e.g., during result serialization), the in-progress key remains until TTL expiry. During that window, the job appears running and won't be picked up. No test covers this failure mode.

**2. `CancelledError` re-raise is a silent contract**
The `except asyncio.CancelledError: raise` is correct for asyncio shutdown semantics but creates a behavioral invariant that future maintainers might inadvertently remove. Without a test that verifies cancellation propagates, this could silently break graceful worker shutdown.

**3. Retry backoff formula is an implicit contract**
```python
next_score = timestamp_ms() + int(1000 * backoff * (2 ** (job_try - 2)))
```
The formula `2 ** (job_try - 2)` (exponential backoff starting at 1× for attempt 2) is a behavioral contract with callers who set `job_retry=RetryError(attempts=N, defer=backoff)`. No test pins this formula.
