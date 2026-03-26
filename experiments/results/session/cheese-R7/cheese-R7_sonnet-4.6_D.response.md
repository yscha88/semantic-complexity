# cheese-R7_sonnet-4.6_D

- model: claude-sonnet-4-6
- model_actual: claude-sonnet-4-6
- provider: anthropic-session
- group: D

---

## Analysis: arq/worker.py — Cognitive Complexity (SKILL)

---

### C1: Cyclomatic Complexity per function

| Function | Estimated CC | Grade | Rating |
|---|---|---|---|
| `run_job` | 35-40 | E | ❌ fail |
| `_poll_iteration` | 9 | B | ⚠️ warning |
| `run_cron` | 9 | B | ⚠️ warning |
| `start_jobs` | 8 | B | ⚠️ warning |

**`run_job` detail**: Key complexity drivers:
- Job deserialization result handling (missing, expired, corrupt)
- Function lookup (not found = fail vs deferral)
- Timeout handling (`asyncio.TimeoutError` vs `CancelledError` vs generic exception)
- Retry eligibility check (attempt count, score expiry, abort flag)
- Exponential backoff calculation with max cap
- Redis pipeline cleanup in all paths (success, retry, failure, abort)

---

### C2: Nesting Depth

**`run_job` — ❌ fail** (depth 5+):
```
async with self.sem:                              # depth 1
  try:                                            # depth 2
    result = await asyncio.wait_for(...)
  except asyncio.CancelledError:
    raise
  except Exception as e:
    if retry:                                     # depth 3
      if score and score > timestamp_ms():        # depth 4
        ...
      else:
        await self.pool.zadd(...)                 # depth 4
```

**`start_jobs` — ⚠️ warning** (depth 4):
```
for job_id_b in job_ids:
  async with self.pool.pipeline(...) as pipe:    # depth 2
    if ongoing_exists or not score or ...:       # depth 3
      continue
    try:
      await pipe.execute()                       # depth 3
    except (ResponseError, WatchError):          # depth 3
```

---

### C3: Single Responsibility

**`run_job` — ❌ fail**: Six distinct responsibilities:
1. Job data retrieval and deserialization from Redis
2. Function lookup and argument preparation
3. Async execution with timeout
4. Exception classification and retry decision
5. Result serialization and storage
6. In-progress key cleanup (always, via finally-equivalent paths)

Recommended decomposition:
- `_load_job_data(job_id) → JobDef | None`
- `_execute_job_with_timeout(job_def) → result`
- `_handle_job_exception(exc, job_def) → RetryDecision`
- `_store_job_result(job_id, result, status)`

**`_poll_iteration` — ⚠️ warning**: Mixes burst mode management, job acquisition, abort processing, and task cleanup. These are four distinct polling concerns.

---

### C4: Code Placement

**Retry backoff calculation inline in `run_job` — ❌ fail**:
```python
next_score = timestamp_ms() + int(1000 * backoff * (2 ** (job_try - 2)))
```
Exponential backoff formula inlined in an already-complex function. Should be `_calculate_retry_delay_ms(backoff_base, attempt) → int`.

**`CancelledError` re-raise placement — ⚠️ warning**:
```python
except asyncio.CancelledError:
    raise
except Exception as e:
    ...
```
This is correct (CancelledError must propagate for proper task cancellation) but easy to accidentally remove during refactoring. A comment explaining why it must be re-raised would prevent regression.

---

### Free-form analysis

**1. `run_job` has no finally block for Redis cleanup**
The in-progress key (`psetex` set in `start_jobs`) must be deleted after job completion. If `run_job` raises an unhandled exception before the cleanup code, the job will appear in-progress indefinitely until expiry. A `try/finally` block should guarantee cleanup.

**2. `start_jobs` counter management is not atomic**
```python
self.job_counter = self.job_counter + 1  # increment before pipeline
...
self.job_counter = self.job_counter - 1  # decrement on early exit
```
The counter is incremented before the Redis transaction and decremented on failure paths. Between increment and decrement, the counter is inconsistent. In an async context with multiple concurrent `start_jobs` invocations, this can cause jobs to be rejected incorrectly.

**3. `_poll_iteration` has no backpressure mechanism**
`zrangebyscore` always returns up to `queue_read_limit` jobs regardless of how many are currently being processed. If processing is slower than polling, tasks accumulate without bound.
