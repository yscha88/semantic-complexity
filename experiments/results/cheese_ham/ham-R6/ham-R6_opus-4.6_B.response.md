# ham-R6_opus-4.6_B

- model: claude-opus-4-6
- model_actual: claude-opus-4-6
- provider: anthropic-session
- timestamp: 2026-03-26T11:32:09.742288+00:00
- temperature: 0
- seed: N/A
- prompt_sha256: 5a105ef475d760ccb1f79fcf3dd4fcb59c977d13fefe92c7499dd051321fd476
- tokens: session (미측정)
- elapsed: session (미측정)

---

# ham-R6_opus-4.6_B

- model: claude-opus-4-6
- model_actual: claude-opus-4-6
- provider: anthropic-session
- group: B

---

## Analysis: procrastinate/worker.py — Behavioral Preservation

### Assessment
Procrastinate is a PostgreSQL-backed task queue. The behavioral contracts involve database state transitions, log emissions, and exception type semantics that are all implicit.

### Critical paths

**`_process_job()` — critical, no golden tests**
Five distinct outcomes need golden tests:
1. **Success**: execute → status=SUCCEEDED → log INFO
2. **JobRetry**: catch → re-queue → status=ABORTED → log INFO  
3. **JobError**: catch → status=FAILED → log ERROR with traceback
4. **TaskNotFound**: raise exception (skips status update)
5. **Unexpected exception**: behavior undefined — test needed

**`_log_job_outcome()` — medium risk**
The log level (ERROR vs INFO) and `exc_info` (True vs False) are observable behaviors. Any monitoring system that parses logs depends on these being correct. The `[:250]` truncation of `job_result.result` is a behavioral contract for result display.

**`_fetch_and_process_jobs()` — medium risk**
Batch job fetching with `batch_size` limit. The behavior of fetching exactly `batch_size` jobs per iteration (vs one at a time) affects throughput and memory usage. This is a performance contract.

### Key behavioral invariants

1. `FAILED` + no retry → `logging.ERROR`; everything else → `logging.INFO`
2. `JobRetry` → job re-enqueued (not marked failed)
3. `exc_info=True` only for FAILED status (not retry, not success)
4. Result truncated to 250 chars in log output

### Refactoring recommendations

1. **`_process_job()` needs golden tests first** — the exception type hierarchy (`JobRetry` < `JobError` < `Exception`) determines which path runs
2. **Clock injection** — `job_result.start_timestamp` / `end_timestamp` should be injectable for testing
3. **Extract `_execute_task(context)` → (result, exception)** — then `_process_job` only handles outcome classification
4. **Pin log level contract with a test** — `FAILED` → ERROR is the most important observable behavior to protect
