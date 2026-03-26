# cheese-R7_opus-4.6_D

- model: claude-opus-4-6
- model_actual: claude-opus-4-6
- provider: anthropic-session
- group: D

---

## Analysis: arq/worker.py — Cognitive Complexity (SKILL)

---

### C1: Cyclomatic Complexity per function

| Function | Estimated CC | Grade | Rating | Root cause |
|---|---|---|---|---|
| `run_job` | 36-40 | E | ❌ fail | 6 distinct concerns accumulated |
| `_poll_iteration` | 9 | B | ⚠️ warning | burst + pick + abort + cleanup |
| `run_cron` | 9 | B | ⚠️ warning | time check + overlap prevention |
| `start_jobs` | 8 | B | ⚠️ warning | distributed lock + multi-guard |

**`run_job` is E-grade**: This is a case of responsibility accumulation over time. The function started as job execution and has grown to include serialization, retry logic, distributed coordination, and cleanup — each addition was locally reasonable but the aggregate is not.

---

### C2: Nesting Depth

**`run_job` — ❌ fail** (depth 5-6):
The deepest path goes through: sem acquire → try → except Exception → if retry → if score check → Redis zadd call. Nesting depth 5.

**`start_jobs` — ⚠️ warning** (depth 4):
for → pipeline context manager → if ongoing_exists → try → except.

**`_poll_iteration`, `run_cron` — ✅ pass** (max depth 3).

---

### C3: Single Responsibility

**`run_job` — ❌ fail**: Decomposed responsibilities:
1. **Job loading** — Redis get + deserialize + missing/corrupt handling
2. **Execution** — `asyncio.wait_for` + coroutine type check
3. **Exception classification** — CancelledError, TimeoutError, generic Exception → retry decision
4. **Retry scheduling** — score calculation, backoff, Redis zadd
5. **Result persistence** — serialize + store
6. **Cleanup** — in-progress key deletion

This is a 6-concern function. A `_JobExecutor` class or `run_job → _prepare → _execute → _finalize` decomposition is needed.

**`_poll_iteration` — ⚠️ warning**: Four polling concerns (burst check, job acquisition, abort check, task cleanup) are reasonable to have in one iteration method, but each warrants its own extracted method for testability.

---

### C4: Code Placement

**Retry backoff inline — ❌ fail**:
```python
next_score = timestamp_ms() + int(1000 * backoff * (2 ** (job_try - 2)))
```
The formula `2 ** (job_try - 2)` means:
- attempt 2 → 1× base delay
- attempt 3 → 2× base delay  
- attempt 4 → 4× base delay

The `job_try - 2` offset is never explained. Extract as:
```python
def _retry_delay_ms(backoff_base: float, attempt: int) -> int:
    # attempt starts at 1; first retry (attempt=2) uses 1x base delay
    return int(1000 * backoff_base * (2 ** (attempt - 2)))
```

**`CancelledError` re-raise — ⚠️ warning**:
```python
except asyncio.CancelledError:
    raise  # must propagate for task cancellation to work
```
The comment should be added — without it, a future maintainer may "fix" this pattern and break graceful shutdown.

---

### Free-form analysis

**1. `run_job` has no `finally` for in-progress key cleanup (critical)**
```python
in_progress_key = in_progress_key_prefix + job_id
# set in start_jobs via psetex
# deleted in run_job success/retry/failure paths
# BUT: if run_job raises before deletion, key remains until TTL expiry
```
If `run_job` raises an unhandled exception before the cleanup code (e.g., during result serialization), the in-progress key persists. Depending on the TTL, jobs can appear stuck for minutes or hours. A `try/finally` block must wrap all post-execution cleanup.

**2. Counter race condition in `start_jobs`**
```python
self.job_counter = self.job_counter + 1        # incremented BEFORE pipeline
await pipe.execute()                           # may raise WatchError
self.job_counter = self.job_counter - 1        # decremented on failure
```
Between the increment and the pipeline execution, another coroutine running in the same event loop iteration could read `job_counter` and incorrectly conclude the worker is at capacity. In asyncio's cooperative scheduling, this is low probability but possible during high throughput.

**3. No timeout on `start_jobs` Redis pipeline**
The `WATCH`/`MULTI`/`EXEC` pipeline in `start_jobs` has no timeout. If Redis becomes unavailable mid-transaction, `start_jobs` will hang indefinitely until the connection times out at the transport level.

**4. `_poll_iteration` task cleanup is O(n) per iteration**
```python
for job_id, t in list(self.tasks.items()):
    if t.done():
        del self.tasks[job_id]
```
Iterating all tasks every poll iteration is O(n) where n is the number of in-flight jobs. With high concurrency, this adds measurable overhead. A callback-based cleanup (using `task.add_done_callback`) would be O(1).
