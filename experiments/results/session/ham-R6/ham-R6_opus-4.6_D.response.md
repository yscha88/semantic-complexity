# ham-R6_opus-4.6_D

- model: claude-opus-4-6
- model_actual: claude-opus-4-6
- provider: anthropic-session
- group: D

---

## Analysis: procrastinate/worker.py — Behavioral Preservation (SKILL)

---

### H1: Golden Tests

**`_process_job()` — ❌ fail (5 paths, all untested)**

| Outcome | Trigger | Expected behavior |
|---|---|---|
| Success | task runs, no exception | status=SUCCEEDED, INFO log, result stored |
| Retry | `JobRetry` raised | status=ABORTED, INFO log, job re-queued |
| Error | `JobError` raised | status=FAILED, ERROR log, exc_info=True |
| TaskNotFound | task not in app.tasks | exception propagates, no status update |
| Generic exception | unexpected exception | status=FAILED, ERROR log |

None of these are pinned by tests. Each outcome requires a separate golden test.

**`_log_job_outcome()` — ❌ fail**
The log level decision is observable and must not change:
```python
log_level = logging.ERROR if status == FAILED and not job_retry else logging.INFO
```
A golden test: `_log_job_outcome(FAILED, ..., job_retry=None)` → assert `logger.error` called. `_log_job_outcome(FAILED, ..., job_retry=JobRetry(...))` → assert `logger.info` called.

---

### H2: Contract Tests

**Worker ↔ connector.finish_job contract — ❌ fail**
After execution, `_process_job` calls the connector to persist job status. The exact method name, arguments, and semantics are a PostgreSQL schema contract. No contract test exists.

**Worker ↔ app.tasks contract — ❌ fail**
`self.app.tasks.get(task_name)` expects a dict-like returning a callable or None. The calling convention for the callable (`await task(context.job)`) is the execution contract. Not tested.

**Exception hierarchy contract — ❌ fail**
`JobRetry` and `JobError` are caught explicitly before generic `Exception`. The order matters: if `JobRetry` is a subclass of `JobError` (or vice versa), the order of `except` clauses is behavioral. Not tested.

---

### H3: Structural vs Behavioral Separation

**`_process_job()` — ❌ fail**
The `exc_info` and `job_retry` mutable flags are set across the exception handling chain and then passed to `_log_job_outcome`. This pattern entangles structure (where flags are set) with behavior (what they mean):

```python
exc_info = False        # ← mutable state
job_retry = None        # ← mutable state
try:
    ...
except JobRetry as e:
    job_retry = e       # ← sets flag
except Exception:
    exc_info = True     # ← sets flag
...
self._log_job_outcome(..., job_retry=job_retry, exc_info=exc_info)
```

Any refactoring that changes where these flags are set changes the log behavior. Tests are required before extraction.

---

### H4: Critical Path Coverage

| Path | Coverage | Risk |
|---|---|---|
| `_process_job()` success | ❌ | Critical |
| `_process_job()` JobRetry | ❌ | Critical |
| `_process_job()` FAILED | ❌ | Critical |
| `_log_job_outcome()` log level | ❌ | High (monitoring) |
| `_log_job_outcome()` duration | ❌ | Medium |
| `_fetch_and_process_jobs()` batch | ❌ | Medium |
| `_run_loop()` periodic execution | ❌ | High |

**Estimated coverage: 0%**.

---

### Free-form analysis

**1. `exc_info` flag is error-prone mutable state**
The pattern of initializing `exc_info = False` and setting `exc_info = True` in the exception handler is fragile. Adding a new exception type that should NOT log a traceback requires either:
- Adding a new except clause before `except Exception` with `exc_info = False`
- Or remembering that `exc_info` was set to True and resetting it

A result object (`JobOutcome(status, job_retry, exc_info)`) would make this explicit.

**2. `_log_job_outcome` result truncation is a silent contract**
```python
text += f" - Result: {job_result.result}"[:250]
```
This truncates the result representation to 250 characters in the log. Callers who inspect logs for full results are silently getting truncated output. No test pins the 250-character limit.

**3. `_process_job()` has no timeout**
If `task(context.job)` hangs indefinitely, `_process_job` hangs indefinitely. The PostgreSQL advisory lock held during execution prevents any other worker from picking up the same job. With no timeout, a stuck job can block its queue slot permanently.

**4. `start_timestamp` is set before task execution, `end_timestamp` after**
```python
job_result = JobResult(start_timestamp=context.start_timestamp)
# ... execute task ...
job_result.end_timestamp = time.time()
```
If the task execution is interrupted (process kill, OOM), `end_timestamp` is never set. The `_log_job_outcome()` guard `if job_result.start_timestamp and job_result.end_timestamp` silently omits duration in this case. A behavioral test for this specific path is needed.
