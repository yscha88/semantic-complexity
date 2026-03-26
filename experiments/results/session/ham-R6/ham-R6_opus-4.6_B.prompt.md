# ham-R6_opus-4.6_B

<!-- meta
experiment_id: ham-R6
model_name: opus-4.6
model_id: claude-opus-4-6
group: B
prompt_sha256: 5a105ef475d760ccb1f79fcf3dd4fcb59c977d13fefe92c7499dd051321fd476
code_sha256: 7cdbb24ba2355acbcc26627607ebd712e7bdb769698647b20c6d2b57bb34c99b
repo: procrastinate-org/procrastinate
commit: b75bd5b1d622
file: procrastinate/worker.py
lines: 1-251
-->

## 프롬프트

Analyze the testing practices and behavioral preservation of the following code.
Identify which critical paths are tested and which are not.
If this code were refactored, what existing behavior could break without being caught?

Check the following areas:
- Test coverage of critical paths
- Characterization tests (golden tests)
- API contract tests
- Separation of structural vs behavioral changes

```python
    def _log_job_outcome(
        self,
        status: jobs.Status,
        context: job_context.JobContext,
        job_result: job_context.JobResult | None,
        job_retry: exceptions.JobRetry | None,
        exc_info: bool | BaseException = False,
    ):
        if status == jobs.Status.SUCCEEDED:
            log_action, log_title = "job_success", "Success"
        elif status == jobs.Status.ABORTED and not job_retry:
            log_action, log_title = "job_aborted", "Aborted"
        elif status == jobs.Status.ABORTED and job_retry:
            log_action, log_title = "job_aborted_retry", "Aborted, to retry"
        elif job_retry:
            log_action, log_title = "job_error_retry", "Error, to retry"
        else:
            log_action, log_title = "job_error", "Error"

        text = f"Job {context.job.call_string} ended with status: {log_title}, "
        # in practice we should always have a start and end timestamp here
        # but in theory the JobResult class allows it to be None
        if job_result and job_result.start_timestamp and job_result.end_timestamp:
            duration = job_result.end_timestamp - job_result.start_timestamp
            text += f"lasted {duration:.3f} s"
        if job_result and job_result.result:
            text += f" - Result: {job_result.result}"[:250]

        extra = self._log_extra(
            context=context, action=log_action, job_result=job_result
        )
        log_level = (
            logging.ERROR
            if status == jobs.Status.FAILED and not job_retry
            else logging.INFO
        )
        logger.log(log_level, text, extra=extra, exc_info=exc_info)

    async def _process_job(self, context: job_context.JobContext):
        """
        Processes a given job and persists its status
        """
        task = self.app.tasks.get(context.job.task_name)
        job_retry = None
        exc_info = False
        retry_decision = None
        job = context.job

        job_result = job_context.JobResult(start_timestamp=context.start_timestamp)

        try:
            if not task:
                raise exceptions.TaskNotFound

            self.logger.debug(
                f"Loaded job info, about to start job {job.call_string}",
                extra=self._log_extra(
                    context=context, action="loaded_job_info", job_result=job_result
                ),
            )

            self.logger.info(
                f"Starting job {job.call_string}",
                extra=self._log_extra(
                    context=context, action="start_job", job_result=job_result
                ),
            )

            exc_info: bool | BaseException = False

            async def ensure_async() -> Callable[..., Awaitable[Any]]:
                await_func: Callable[..., Awaitable[Any]]
                if inspect.iscoroutinefunction(task.func):
                    await_func = task
                else:
                    await_func = functools.partial(utils.sync_to_async, task)

                job_args = [context] if task.pass_context else []
                task_result = await await_func(*job_args, **job.task_kwargs)
                # In some cases, the task function might be a synchronous function
                # that returns an awaitable without actually being a
                # coroutinefunction. In that case, in the await above, we haven't
                # actually called the task, but merely generated the awaitable that
                # implements the task. In that case, we want to wait this awaitable.
                # It's easy enough to be in that situation that the best course of
                # action is probably to await the awaitable.
                # It's not even sure it's worth emitting a warning
                if inspect.isawaitable(task_result):
                    task_result = await task_result

                return task_result

            job_result.result = await ensure_async()

        except BaseException as e:
            exc_info = e

            # aborted job can be retried if it is caused by a shutdown.
            if not (isinstance(e, exceptions.JobAborted)) or (
                context.abort_reason() == job_context.AbortReason.SHUTDOWN
            ):
                job_retry = (
                    task.get_retry_exception(exception=e, job=job) if task else None
                )
                retry_decision = job_retry.retry_decision if job_retry else None
                if isinstance(e, exceptions.TaskNotFound):
                    self.logger.exception(
                        f"Task was not found: {e}",
                        extra=self._log_extra(
                            context=context,
                            action="task_not_found",
                            exception=str(e),
                            job_result=job_result,
                        ),
                    )
        finally:
            job_result.end_timestamp = time.time()

            if isinstance(exc_info, exceptions.JobAborted) or isinstance(
                exc_info, asyncio.CancelledError
            ):
                status = jobs.Status.ABORTED
            elif exc_info:
                status = jobs.Status.FAILED
            else:
                status = jobs.Status.SUCCEEDED

            self._log_job_outcome(
                status=status,
                context=context,
                job_result=job_result,
                job_retry=job_retry,
                exc_info=exc_info,
            )

            persist_job_status_task = asyncio.create_task(
                self._persist_job_status(
                    job=job,
                    status=status,
                    retry_decision=retry_decision,
                    context=context,
                    job_result=job_result,
                )
            )
            try:
                await asyncio.shield(persist_job_status_task)
            except asyncio.CancelledError:
                await persist_job_status_task
                raise

    async def _fetch_and_process_jobs(self):
        """Fetch and process jobs until there is no job left or asked to stop"""
        while not self._stop_event.is_set():
            acquire_sem_task = asyncio.create_task(self._job_semaphore.acquire())
            job = None
            try:
                await utils.wait_any(acquire_sem_task, self._stop_event.wait())
                if self._stop_event.is_set():
                    break

                assert self.worker_id is not None
                job = await self.app.job_manager.fetch_job(
                    queues=self.queues, worker_id=self.worker_id
                )
            finally:
                if (not job or self._stop_event.is_set()) and acquire_sem_task.done():
                    self._job_semaphore.release()
                self._new_job_event.clear()

            if not job:
                break

            job_id = job.id

            context = job_context.JobContext(
                app=self.app,
                worker_name=self.worker_name,
                worker_queues=self.queues,
                additional_context=self.additional_context.copy()
                if self.additional_context
                else {},
                job=job,
                abort_reason=lambda: (
                    self._job_ids_to_abort.get(job_id) if job_id else None
                ),
                start_timestamp=time.time(),
            )
            job_task = asyncio.create_task(
                self._process_job(context),
                name=f"process job {job.task_name}[{job.id}]",
            )
            self._running_jobs[job_task] = context

            def on_job_complete(task: asyncio.Task):
                del self._running_jobs[task]
                self._job_semaphore.release()

            job_task.add_done_callback(on_job_complete)

    async def _run_loop(self):
        """
        Run all side coroutines, then start fetching/processing jobs in a loop
        """
        self.logger.info(
            f"Starting worker on {utils.queues_display(self.queues)}",
            extra=self._log_extra(
                action="start_worker", context=None, queues=self.queues, job_result=None
            ),
        )
        self._new_job_event.clear()
        self._stop_event.clear()
        self._running_jobs = {}
        self._job_semaphore = asyncio.Semaphore(self.concurrency)
        side_tasks = self._start_side_tasks()
        side_tasks_monitor = asyncio.create_task(
            self._monitor_side_tasks(side_tasks), name="side_tasks_monitor"
        )

        context = (
            signals.on_stop(self.stop)
            if self.install_signal_handlers
            else contextlib.nullcontext()
        )

        try:
            with context:
                await self._fetch_and_process_jobs()
                if not self.wait:
                    self.logger.info(
                        "No job found. Stopping worker because wait=False",
                        extra=self._log_extra(
                            context=None,
                            action="stop_worker",
                            queues=self.queues,
                            job_result=None,
                        ),
                    )
                    self._stop_event.set()

                while not self._stop_event.is_set():
                    # wait for a new job notification, a stop event or the next polling interval
                    await utils.wait_any(
                        self._new_job_event.wait(),
                        asyncio.sleep(self.fetch_job_polling_interval),
                        self._stop_event.wait(),
                    )
                    await self._fetch_and_process_jobs()
        finally:
            if not side_tasks_monitor.done():
                side_tasks_monitor.cancel()
            await self._shutdown(side_tasks=side_tasks)

```

---

## Claude 응답

<!-- Claude가 여기에 응답을 작성 -->
