# ham-R6_sonnet-4.6_D

- model: claude-sonnet-4-6
- model_actual: claude-sonnet-4-6
- provider: anthropic-session
- group: D

---

## Analysis: procrastinate/worker.py — Behavioral Preservation (SKILL)

---

### H1: Golden Tests

**`_process_job()` — ❌ fail**
Contract:
- Input: `JobContext` with a valid task
- Success: `context.job` executed, status → `SUCCEEDED`, logged at INFO
- `JobRetry` raised: job re-queued, status → `ABORTED`, logged at INFO
- `JobError` raised: status → `FAILED`, logged at ERROR with traceback
- `TaskNotFound`: propagates as exception (no status update?)

No golden tests observed. The distinction between `JobRetry` (controlled retry) and `Exception` (failure) is a critical behavioral contract.

**`_log_job_outcome()` log level contract — ❌ fail**
```python
log_level = (
    logging.ERROR if status == jobs.Status.FAILED and not job_retry
    else logging.INFO
)
```
This is an observable behavioral contract: `FAILED` without retry → ERROR. Anything else → INFO. Changing this breaks all monitoring setups that alert on ERROR log entries from this worker.

---

### H2: Contract Tests

**Worker ↔ App.tasks contract — ❌ fail**
```python
task = self.app.tasks.get(context.job.task_name)
```
The contract: `app.tasks` is a dict-like with task name → callable. If `task` is None, `TaskNotFound` is raised. No contract test verifies this interface.

**Worker ↔ PostgreSQL connector contract — ❌ fail**
After job execution, the worker updates job status via the connector. The connector interface (what method is called, with what arguments) is a consumer-provider contract that needs tests.

---

### H3: Structural vs Behavioral Separation

**`_process_job()` — ❌ fail**
The exception handling, logging, and status update are all in one method. Extracting logging would require preserving the `exc_info` and `job_retry` flag semantics exactly:
```python
self._log_job_outcome(
    status=status,
    context=context,
    job_result=job_result,
    job_retry=job_retry,
    exc_info=exc_info,    # ← stateful: set True for FAILED, False otherwise
)
```
These flags must be correctly set in every exception path.

---

### H4: Critical Path Coverage

| Path | Behavior | Coverage |
|---|---|---|
| `_process_job()` success | SUCCEEDED + INFO log | ❌ |
| `_process_job()` → JobRetry | re-queue + INFO log | ❌ |
| `_process_job()` → JobError | FAILED + ERROR log + exc_info | ❌ |
| `_process_job()` → TaskNotFound | exception propagates | ❌ |
| `_log_job_outcome()` log level | ERROR for FAILED only | ❌ |
| `_fetch_and_process_jobs()` | batch fetch + process | ❌ |

Estimated coverage: **<10%**.

---

### Free-form analysis

**1. `exc_info` flag management is implicit and error-prone**
`exc_info` starts as `False` and is set to `True` in the exception handler:
```python
exc_info = False
...
except Exception:
    exc_info = True
    status = jobs.Status.FAILED
```
If a future developer adds a new exception type that should NOT include traceback (e.g., a user-facing validation error), they must remember to either not set `exc_info = True` or explicitly set it back. This mutable flag pattern is fragile.

**2. `_log_job_outcome()` duration calculation depends on timestamps being set**
```python
if job_result and job_result.start_timestamp and job_result.end_timestamp:
    duration = job_result.end_timestamp - job_result.start_timestamp
```
The comment says "in practice we should always have start and end timestamp" but the guard allows them to be missing. If they're missing, the log message lacks duration — a silent data loss in observability. No test verifies that timestamps are always set.

**3. `_fetch_and_process_jobs()` batch size is not tested**
If `batch_size` is changed, jobs might be over-fetched (memory pressure) or under-fetched (throughput degradation). The behavioral contract of the batch size is not pinned.
