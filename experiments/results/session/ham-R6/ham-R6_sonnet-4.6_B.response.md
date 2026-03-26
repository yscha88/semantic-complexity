# ham-R6_sonnet-4.6_B

- model: claude-sonnet-4-6
- model_actual: claude-sonnet-4-6
- provider: anthropic-session
- group: B

---

## Analysis: procrastinate/worker.py — Behavioral Preservation

### Critical paths

**`_process_job()` — highest risk**
Core job execution method. Critical behaviors:
- Task lookup in `self.app.tasks` — if task not found, raises `TaskNotFound`
- Job execution with PostgreSQL-backed result persistence
- `JobRetry` exception handling: job is re-queued via `connector`
- Status update: `SUCCEEDED`, `FAILED`, or `ABORTED`
- Log emission for every outcome

The ordering of status update vs log emission is behavioral — logging before updating status means the log and actual state could temporarily diverge.

**`_fetch_and_process_jobs()` — medium risk**
The polling loop: fetch batch of jobs → process each. The batch size and polling interval are behavioral parameters. If refactored to use a push model, the batch semantics must be preserved.

**`_log_job_outcome()` — medium risk**
This function determines log level (ERROR for FAILED, INFO for others) and constructs structured log output. The `exc_info` parameter controls traceback inclusion. Any change to log format or level breaks observability integrations.

### Behavioral contracts (implicit)

1. `FAILED` status → log at ERROR level with `exc_info=True`
2. `ABORTED` + `job_retry` → re-queue, log at INFO
3. `SUCCEEDED` → log at INFO, no exc_info
4. Task not found → `TaskNotFound` exception (not `FAILED` status)

### Test coverage gaps

No test files in this code. Critical gaps:
- No golden test for `_process_job()` normal flow
- No test for `JobRetry` re-queue behavior
- No test for `TaskNotFound` exception path
- No test for log level correctness per status

### Refactoring risks
`_process_job()` exception handling chain (`JobRetry`, `exceptions.JobError`, generic) must be preserved. The `job_retry` vs `exc_info` flag interaction in `_log_job_outcome` is stateful and subtle.
