# ham-R4_opus-4.6_B

<!-- meta
experiment_id: ham-R4
model_name: opus-4.6
model_id: claude-opus-4-6
group: B
prompt_sha256: 8f36b5eb50c587196aea9a673e6e28f4f36a1a3d0091a6a6669b56db01d4e46d
code_sha256: ecb9a2d7e7d762c9e11ee128f3659d41f1631a863e0e9b6b8bc9ca174b170d43
repo: tobymao/saq
commit: fe86758c5063
file: saq/worker.py
lines: 1-281
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
    def __init__(
        self,
        queue: Queue,
        functions: FunctionsType[CtxType],
        *,
        id: t.Optional[str] = None,
        concurrency: int = 10,
        cron_jobs: Collection[CronJob[CtxType]] | None = None,
        cron_tz: tzinfo = timezone.utc,
        startup: LifecycleFunctionsType[CtxType] | None = None,
        shutdown: LifecycleFunctionsType[CtxType] | None = None,
        before_process: LifecycleFunctionsType[CtxType] | None = None,
        after_process: LifecycleFunctionsType[CtxType] | None = None,
        timers: PartialTimersDict | None = None,
        dequeue_timeout: float = 0.0,
        burst: bool = False,
        max_burst_jobs: int | None = None,
        shutdown_grace_period_s: int | None = None,
        cancellation_hard_deadline_s: float = 1.0,
        metadata: t.Optional[JsonDict] = None,
        poll_interval: float = 0.0,
    ) -> None:
        self.queue = queue
        self.concurrency = concurrency
        self.pool = ThreadPoolExecutor()
        self.startup = ensure_coroutine_function_many(startup, self.pool) if startup else None
        self.shutdown = shutdown
        self.before_process = (
            ensure_coroutine_function_many(before_process, self.pool) if before_process else None
        )
        self.after_process = (
            ensure_coroutine_function_many(after_process, self.pool) if after_process else None
        )
        self.timers: TimersDict = {
            "schedule": 1,
            "worker_info": 10,
            "sweep": 60,
            "abort": 1,
        }
        if timers is not None:
            self.timers.update(timers)
        self.event = asyncio.Event()
        functions = set(functions)
        self.functions: dict[str, Function[CtxType]] = {}
        self.cron_jobs: Collection[CronJob] = cron_jobs or []
        self.cron_tz: tzinfo = cron_tz
        self.context: CtxType = t.cast(CtxType, {"worker": self})
        self.tasks: set[Task[t.Any]] = set()
        self.job_task_contexts: dict[Job, JobTaskContext] = {}
        self.dequeue_timeout = dequeue_timeout
        self.burst = burst
        self.max_burst_jobs = max_burst_jobs
        self.burst_jobs_processed = 0
        self.burst_jobs_processed_lock = threading.Lock()
        self.burst_condition_met = False
        self._metadata = metadata
        self._poll_interval = poll_interval
        self._stop_lock = asyncio.Lock()
        self._stopped = False
        self._shutdown_grace_period_s = shutdown_grace_period_s
        self._cancellation_hard_deadline_s = cancellation_hard_deadline_s
        self.id = uuid1() if id is None else id

        if self.burst:
            if self.dequeue_timeout <= 0:
                raise ValueError(
                    "dequeue_timeout must be a positive value greater than 0 when the burst mode is enabled"
                )
            if self.max_burst_jobs is not None:
                self.concurrency = min(self.concurrency, self.max_burst_jobs)

        for job in self.cron_jobs:
            if not croniter.is_valid(job.cron):
                raise ValueError(f"Cron is invalid {job.cron}")
            functions.add(job.function)

        for function in functions:
            if isinstance(function, tuple):
                name, function = function
            else:
                name = function.__qualname__

            self.functions[name] = function

    async def start(self) -> None:
        """Start processing jobs and upkeep tasks."""
        logger.info("Worker starting: %s", repr(self.queue))
        logger.debug("Registered functions:\n%s", "\n".join(f"  {key}" for key in self.functions))

        try:
            self.event = asyncio.Event()
            async with self._stop_lock:
                self._stopped = False
            loop = asyncio.get_running_loop()

            for signum in self.SIGNALS:
                loop.add_signal_handler(signum, self.event.set)

            if self.startup:
                for s in self.startup:
                    await s(self.context)

            self.tasks.update(await self.upkeep())

            for _ in range(self.concurrency):
                self._process()

            await self.event.wait()

        except asyncio.CancelledError:
            pass
        finally:
            logger.info("Working shutting down")
            await self.stop()
            for signum in self.SIGNALS:
                loop.remove_signal_handler(signum)

    async def abort(self, abort_threshold: float) -> None:
        def get_duration(job: Job) -> float:
            return job.duration("running") or 0

        jobs = [
            job for job in self.job_task_contexts if get_duration(job) >= millis(abort_threshold)
        ]

        if not jobs:
            return

        for job in await self.queue.jobs(job.key for job in jobs):
            if not job or job.status not in (Status.ABORTING, Status.ABORTED):
                continue

            task_data = self.job_task_contexts.get(job, None)
            if not task_data:
                logger.warning("No task data found for job %s", job.id)
                continue

            task = task_data["task"]
            logger.info("Aborting %s", job.id)

            if not task.done():
                task_data["aborted"] = "abort" if job.error is None else job.error
                # abort should be a blocking operation
                _ = await cancel_tasks([task], None)

            await self.queue.finish_abort(job)

    async def process(self) -> bool:
        context: CtxType | None = None
        job: Job | None = None

        try:
            job = await self.queue.dequeue(
                timeout=self.dequeue_timeout,
                poll_interval=self._poll_interval,
            )

            if job is None:
                return False

            job.started = now()
            job.attempts += 1
            job.worker_id = self.id
            await job.update(status=Status.ACTIVE)
            context = t.cast(CtxType, {**self.context, "job": job})
            await self._before_process(context)
            logger.info("Processing %s", job.info(logger.isEnabledFor(logging.DEBUG)))

            function = ensure_coroutine_function(self.functions[job.function], self.pool)
            task = asyncio.create_task(function(context, **(job.kwargs or {})))
            self.job_task_contexts[job] = JobTaskContext(task=task, aborted=None)
            try:
                result = await asyncio.wait_for(
                    asyncio.shield(task), job.timeout if job.timeout else None
                )
            except asyncio.TimeoutError:
                # Since we have a shield around the task passed to wait_for,
                # we need to explicitly cancel it on timeout.
                task.cancel()
                raise
            if self.job_task_contexts[job]["aborted"] is None:
                await job.finish(Status.COMPLETE, result=result)
        except asyncio.CancelledError:
            if not job:
                return False
            task_ctx = self.job_task_contexts.get(job)
            assert task_ctx is not None

            task = task_ctx["task"]
            aborted = task_ctx["aborted"]
            if aborted is not None:
                await job.finish(Status.ABORTED, error=aborted)
                return False

            if not task.done():
                cancelled = await cancel_tasks([task], self._cancellation_hard_deadline_s)
                if not cancelled:
                    logger.warning(
                        "Function: %s did not finish cancellation in time, it may be stuck or blocked",
                        job.function,
                        extra={"job_id": job.id},
                    )
                await job.retry("cancelled")
        except Exception as ex:
            if context is not None:
                context["exception"] = ex

            if job:
                logger.exception("Error processing job %s", job)

                # Ensure that the task is done or cancelled
                if task_context := self.job_task_contexts.get(job, None):
                    task = task_context["task"]
                    if not task.done():
                        cancelled = await cancel_tasks([task], self._cancellation_hard_deadline_s)
                        if not cancelled:
                            logger.warning(
                                "Function '%s' did not finish cancellation in time, it may be stuck or blocked",
                                job.function,
                                extra={"job_id": job.id},
                            )

                error = traceback.format_exc()

                if job.retryable:
                    await job.retry(error)
                else:
                    await job.finish(Status.FAILED, error=error)
        finally:
            if context:
                if job is not None:
                    self.job_task_contexts.pop(job, None)

                try:
                    await self._after_process(context)
                except (Exception, asyncio.CancelledError):
                    logger.exception("Failed to run after process hook")
        return True

def start(
    settings: str,
    web: bool = False,
    extra_web_settings: list[str] | None = None,
    port: int = 8080,
) -> None:
    settings_obj = import_settings(settings)

    if "queue" not in settings_obj:
        settings_obj["queue"] = Queue.from_url("redis://localhost")

    loop = asyncio.new_event_loop()
    worker = Worker(**settings_obj)

    async def worker_start() -> None:
        try:
            await worker.queue.connect()
            await worker.start()
        finally:
            await worker.queue.disconnect()

    if web:
        import aiohttp.web

        from saq.web.aiohttp import create_app

        extra_web_settings = extra_web_settings or []
        web_settings = [settings_obj] + [import_settings(s) for s in extra_web_settings]
        queues = [s["queue"] for s in web_settings if s.get("queue")]

        async def shutdown(_app: Application) -> None:
            await worker.stop()

        app = create_app(queues)
        app.on_shutdown.append(shutdown)

        loop.create_task(worker_start()).add_done_callback(
            lambda _: signal.raise_signal(signal.SIGTERM)
        )
        aiohttp.web.run_app(app, port=port, loop=loop)
    else:
        loop.run_until_complete(worker_start())

```

---

## Claude 응답

<!-- Claude가 여기에 응답을 작성 -->
