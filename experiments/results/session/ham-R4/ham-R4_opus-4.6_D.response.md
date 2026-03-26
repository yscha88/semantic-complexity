# ham-R4_opus-4.6_D

- model: claude-opus-4-6
- model_actual: claude-opus-4-6
- provider: anthropic-session
- group: D

---

## Analysis: saq/worker.py — Behavioral Preservation (SKILL)

---

### H1: Golden Tests

**`process()` — ❌ fail (critical)**
`process()` is the most important function in the entire worker. Its contract:
- Input: a job dequeued from `queue`
- Expected behavior: `before_process` hooks run, job executes, `after_process` hooks run, status is updated to `complete` or `failed`
- Exception contract: if job raises, status → `failed`, after_process still runs, semaphore still released

No golden tests pin this contract. A refactoring that changes hook ordering or exception propagation could silently break all applications using this worker.

**`abort()` — ❌ fail**
The shutdown sequence (cancel tasks, wait for grace period, force kill) has observable output (which jobs complete vs which are aborted) but no golden test characterizes it.

**`__init__` default values — ⚠️ warning**
`concurrency=10`, `timers` defaults, `cancellation_hard_deadline_s=1.0` are behavioral defaults. They're not pinned by tests.

---

### H2: Contract Tests

**Worker ↔ Queue contract — ❌ fail**
The implicit contract between `Worker` and `Queue`:
- `queue.dequeue(timeout)` returns a job or None
- `queue.finish(ctx, status, result, ...)` persists job result
- `queue.abort(ctx, error)` marks job as aborted

No contract tests verify this interface. If `Queue.finish()` changes its signature or semantics, `Worker.process()` fails at runtime.

**Lifecycle hook contract — ❌ fail**
`before_process` and `after_process` are callable contracts: they receive `(ctx, job)` and may return None or a modified context. No contract test verifies the calling convention.

---

### H3: Structural vs Behavioral Change Separation

**`process()` entanglement — ❌ fail**
`process()` cannot be structurally decomposed without affecting behavioral contracts. Specifically:
- Exception handling, semaphore release, and status update are interleaved
- Extracting `_run_hooks()` would require carefully preserving exception propagation behavior
- No existing tests would catch regressions from such extraction

**`__init__` parameter accumulation — ⚠️ warning**
With 20+ parameters, any structural change (adding a parameter, changing a default) is a behavioral change from the caller's perspective. The parameters need grouping into configuration objects to enable safe structural changes.

---

### H4: Critical Path Coverage

| Path | Coverage | Risk if missing |
|---|---|---|
| `process()` → success → status=complete | ❌ none | High — core contract |
| `process()` → exception → status=failed, after_process runs | ❌ none | High — error contract |
| `process()` → semaphore released on exception | ❌ none | Critical — resource leak |
| Concurrency limit: >N jobs rejected | ❌ none | High — core SLA |
| `abort()` → jobs finish within grace period | ❌ none | High — shutdown contract |
| Cron job fires at correct time | ❌ none | Medium — scheduling |
| `abort()` → force cancel after grace period | ❌ none | High — shutdown contract |

Estimated critical path coverage: **0-5%**.

---

### Free-form analysis

**1. Semaphore leak on exception (critical behavioral risk)**
```python
# In process():
await self.sem.acquire()   # ← acquired
# ... hooks, execution, status update ...
self.sem.release()         # ← must always execute
```
If any code between `acquire()` and `release()` raises and is not caught, the semaphore is permanently decremented. Over time (`concurrency` such leaks), the worker stops accepting new jobs. A `try/finally` block must guarantee `release()`:
```python
await self.sem.acquire()
try:
    ...
finally:
    self.sem.release()
```
No test would catch this without injecting a hook that raises.

**2. `job_task_contexts` mutation during `abort()` iteration**
`abort()` iterates `self.job_task_contexts` and awaits task cancellation. During each `await`, `process()` can run and mutate `job_task_contexts` (adding new entries or deleting completed ones). This causes `RuntimeError: dictionary changed size during iteration` in Python ≥ 3.9 strict dict mode. Fix: `list(self.job_task_contexts.items())` snapshot before iteration.

**3. `burst_condition_met` threading lock with async code**
```python
self.burst_condition_met = False
self.burst_jobs_processed_lock = threading.Lock()
```
A `threading.Lock()` in async code is an antipattern. If `burst_jobs_processed_lock` is acquired in a sync context during an async event loop tick, it can deadlock. Should use `asyncio.Lock()`.

**4. No clock injection for cron testing**
All cron scheduling depends on `datetime.now(tz)`. Without injecting the clock as a dependency, cron scheduling is effectively untestable without real time passage or global monkeypatching.
