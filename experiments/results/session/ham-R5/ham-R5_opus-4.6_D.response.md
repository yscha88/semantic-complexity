# ham-R5_opus-4.6_D

- model: claude-opus-4-6
- model_actual: claude-opus-4-6
- provider: anthropic-session
- group: D

---

## Analysis: arq/worker.py — Behavioral Preservation (SKILL)

---

### H1: Golden Tests

**`run_job()` — ❌ fail (highest priority)**
Observable behaviors that need golden tests:
- **Happy path**: `job_func(*args, **kwargs)` executes, result serialized to Redis, in-progress key deleted
- **Retry path**: exception raised, attempt < max_tries → `zadd(queue, score=now+delay, job_id)`, in-progress key deleted
- **Abort path**: abort key present in Redis → job not retried, marked as aborted
- **Failure path**: exception raised, attempt = max_tries → marked failed, no re-enqueue
- **Timeout path**: `asyncio.TimeoutError` → treated as retry if retries remaining

All five observable outcomes require separate golden tests.

**`start_jobs()` distributed lock — ❌ fail**
The exactly-once guarantee under concurrent workers is the core correctness property of the queue. No golden test pins it.

---

### H2: Contract Tests

**arq job serialization contract — ❌ fail**
The job data format stored in Redis (`serialize_result`, `deserialize_result`) is an implicit contract between worker versions. No contract test verifies forward/backward compatibility.

**`retry_error.retry()` calling convention — ❌ fail**
`run_job` calls `job.retry()` or inspects `RetryError.retries_remaining`. The interface between the worker and the retry mechanism is undocumented by tests.

**`CancelledError` propagation contract — ❌ fail (critical)**
The behavioral contract:
> "A `CancelledError` during job execution MUST propagate out of `run_job()` — it MUST NOT be swallowed."

This enables graceful worker shutdown. It is the single most important behavioral invariant in this codebase, and it has no test.

---

### H3: Structural vs Behavioral Separation

**`run_job()` — ❌ fail**
The three-way exception dispatch is structurally inseparable from its behavioral consequences:
```python
except asyncio.CancelledError:
    raise                   # behavioral: shutdown contract
except asyncio.TimeoutError:
    ...                     # behavioral: timeout = retry if configured
except Exception as e:
    ...                     # behavioral: error = retry if attempts remain
```
Extracting any of these paths risks the behavioral guarantees. The only safe extraction is after comprehensive golden tests exist.

---

### H4: Critical Path Coverage

| Path | Behavior | Coverage |
|---|---|---|
| `run_job()` happy path | result → Redis | ❌ |
| `run_job()` retry path | re-enqueue with delay | ❌ |
| `run_job()` abort path | no retry, abort status | ❌ |
| `run_job()` max retries | mark failed | ❌ |
| `run_job()` CancelledError | propagates | ❌ |
| in-progress key cleanup | always deleted | ❌ |
| `start_jobs()` concurrent | exactly once | ❌ |
| `run_cron()` overlap | at-most-once | ❌ |

**Estimated coverage: 0%** of named critical paths.

---

### Free-form analysis

**1. `CancelledError` swallowing risk is latent (critical)**
```python
except asyncio.CancelledError:
    raise
```
This is correct. But there is no test that verifies it. In Python 3.7 and earlier, `CancelledError` was a subclass of `Exception` — in that version, a `except Exception` clause above would catch it first. The current ordering (CancelledError before Exception) is correct for Python 3.8+, but without a test, a version regression or code reorder could silently break graceful shutdown.

**2. In-progress key TTL creates a recovery window**
```python
pipe.psetex(in_progress_key, int(self.in_progress_timeout_s * 1000), b'1')
```
If the worker process is killed (SIGKILL, OOM) mid-execution, the in-progress key persists for `in_progress_timeout_s` seconds. During this window, the job is invisible to all workers. The default TTL is a behavioral contract — changing it changes recovery time. No test pins this value.

**3. Retry score calculation creates a time-dependency**
```python
next_score = timestamp_ms() + int(1000 * backoff * (2 ** (job_try - 2)))
```
`timestamp_ms()` is called at the moment of failure. This means two workers failing the same job at slightly different times would produce different retry scores. The test for retry behavior must account for this time dependency, making it impossible to write a purely deterministic golden test without clock injection.

**4. `abort()` check uses a Redis key lookup per job execution**
```python
abort_job_ids = await self.pool.smembers(self.queue.abort_id)
if job_id in abort_job_ids:
    ...
```
This adds a Redis round-trip to every job execution. The behavioral guarantee (abort flag is checked before retry decision) is correct but creates a latency contract that's not tested.
