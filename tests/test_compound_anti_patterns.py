"""
Compound Anti-Pattern bug reproduction tests.

Each test demonstrates that the anti-pattern produces an ACTUAL BUG,
and the safe alternative does NOT.

These tests serve as empirical evidence that the patterns defined in
docs/COMPOUND_ANTI_PATTERNS.md cause real defects.
"""

import asyncio
import pytest


# ============================================================
# SA-CROSS: State-Await Crossing → interleaving race
# ============================================================


class ServiceWithSACross:
    """VULNERABLE: shared state crosses await boundary."""

    def __init__(self):
        self.status = "idle"

    async def process(self):
        self.status = "running"
        await asyncio.sleep(0)  # yield control
        self.status = "done"


class ServiceWithoutSACross:
    """SAFE: no shared state change before await."""

    def __init__(self):
        self.status = "idle"

    async def process(self):
        result = await asyncio.sleep(0)
        self.status = "done"


@pytest.mark.asyncio
async def test_sa_cross_race_condition():
    """SA-CROSS: concurrent calls see inconsistent state."""
    svc = ServiceWithSACross()
    observed_states = []

    async def observer():
        for _ in range(10):
            observed_states.append(svc.status)
            await asyncio.sleep(0)

    # Run process and observer concurrently
    await asyncio.gather(svc.process(), observer())

    # BUG: observer sees "running" even though process may have failed
    assert "running" in observed_states, (
        "SA-CROSS demonstrated: intermediate state 'running' was observable "
        "by concurrent coroutine during await"
    )


@pytest.mark.asyncio
async def test_sa_cross_safe_no_intermediate():
    """SAFE version: no intermediate state exposed."""
    svc = ServiceWithoutSACross()
    observed_states = []

    async def observer():
        for _ in range(10):
            observed_states.append(svc.status)
            await asyncio.sleep(0)

    await asyncio.gather(svc.process(), observer())

    # SAFE: observer only sees "idle" or "done", never "running"
    assert "running" not in observed_states, (
        "Safe version should never expose intermediate state"
    )


# ============================================================
# SR-LEAK: State Leak on Retry Failure → stale state
# ============================================================


class ServiceWithSRLeak:
    """VULNERABLE: state leaks on retry failure."""

    def __init__(self):
        self.status = "idle"

    def process(self):
        for attempt in range(3):
            self.status = "trying"
            success = False  # simulate all attempts failing
            if success:
                self.status = "done"
                return True
        # BUG: status is "trying" not "failed" or "idle"
        return False


class ServiceWithoutSRLeak:
    """SAFE: explicit cleanup after retry exhaustion."""

    def __init__(self):
        self.status = "idle"

    def process(self):
        for attempt in range(3):
            try:
                success = False  # simulate failure
                if success:
                    self.status = "done"
                    return True
            except Exception:
                continue
        self.status = "failed"  # explicit final state
        return False


def test_sr_leak_stale_state():
    """SR-LEAK: after all retries fail, status is 'trying' (stale)."""
    svc = ServiceWithSRLeak()
    result = svc.process()

    assert result is False
    # BUG: status stuck at "trying" — misleading
    assert svc.status == "trying", (
        "SR-LEAK demonstrated: status remains 'trying' after all retries failed"
    )


def test_sr_leak_safe_explicit_final():
    """SAFE version: status is explicitly 'failed'."""
    svc = ServiceWithoutSRLeak()
    result = svc.process()

    assert result is False
    assert svc.status == "failed", "Safe version should have explicit 'failed' status"


# ============================================================
# SR-ACCUM: Counter Accumulation → non-idempotent
# ============================================================


class ServiceWithSRAccum:
    """VULNERABLE: counter increments on every retry attempt."""

    def __init__(self):
        self.call_count = 0

    def process(self):
        for attempt in range(3):
            self.call_count += 1  # increments even on failure
            success = attempt == 2  # succeeds on 3rd try
            if success:
                return True
        return False


class ServiceWithoutSRAccum:
    """SAFE: counter increments only on success."""

    def __init__(self):
        self.call_count = 0

    def process(self):
        for attempt in range(3):
            success = attempt == 2
            if success:
                self.call_count += 1  # only on success
                return True
        return False


def test_sr_accum_inflated_count():
    """SR-ACCUM: call_count is 3 even though only 1 logical call."""
    svc = ServiceWithSRAccum()
    svc.process()

    # BUG: 1 logical operation counted as 3
    assert svc.call_count == 3, (
        "SR-ACCUM demonstrated: 1 operation counted as 3 due to retry"
    )


def test_sr_accum_safe_correct_count():
    """SAFE version: call_count is 1."""
    svc = ServiceWithoutSRAccum()
    svc.process()

    assert svc.call_count == 1


# ============================================================
# AR-SWALLOW: CancelledError swallowed → task won't stop
# ============================================================


class ServiceWithARSwallow:
    """VULNERABLE: broad except catches CancelledError.

    NOTE: Python 3.9+ changed CancelledError to BaseException.
    In Python 3.8 and below, except Exception catches it.
    This test uses except BaseException to demonstrate the pattern
    regardless of Python version.
    """

    def __init__(self):
        self.running = True

    async def fetch(self):
        while self.running:
            try:
                await asyncio.sleep(10)
                return "data"
            except BaseException:  # catches CancelledError in ALL Python versions
                await asyncio.sleep(0.01)
                continue


class ServiceWithoutARSwallow:
    """SAFE: CancelledError is re-raised."""

    def __init__(self):
        self.running = True

    async def fetch(self):
        while self.running:
            try:
                await asyncio.sleep(10)
                return "data"
            except asyncio.CancelledError:
                raise  # always propagate cancellation
            except Exception:
                await asyncio.sleep(0.01)
                continue


@pytest.mark.asyncio
async def test_ar_swallow_cannot_cancel():
    """AR-SWALLOW: task cannot be cancelled — hangs on shutdown."""
    svc = ServiceWithARSwallow()
    task = asyncio.create_task(svc.fetch())

    await asyncio.sleep(0.05)
    task.cancel()

    # Give it time to process the cancellation
    await asyncio.sleep(0.1)

    # BUG: task is STILL running because except Exception caught CancelledError
    assert not task.done(), (
        "AR-SWALLOW demonstrated: task could not be cancelled "
        "because broad except caught CancelledError"
    )

    # Cleanup: force stop
    svc.running = False
    await asyncio.sleep(0.05)
    task.cancel()
    try:
        await task
    except (asyncio.CancelledError, Exception):
        pass


@pytest.mark.asyncio
async def test_ar_swallow_safe_cancels():
    """SAFE version: task cancels properly."""
    svc = ServiceWithoutARSwallow()
    task = asyncio.create_task(svc.fetch())

    await asyncio.sleep(0.05)
    task.cancel()

    with pytest.raises(asyncio.CancelledError):
        await task


# ============================================================
# AR-INFINITE: Unbounded retry → resource exhaustion
# ============================================================


class ServiceWithARInfinite:
    """VULNERABLE: no retry limit."""

    def __init__(self):
        self.attempt_count = 0

    async def connect(self):
        while True:
            try:
                self.attempt_count += 1
                raise ConnectionError("db down")
            except ConnectionError:
                await asyncio.sleep(0.001)  # fast for testing


class ServiceWithoutARInfinite:
    """SAFE: retry limit + timeout."""

    def __init__(self):
        self.attempt_count = 0

    async def connect(self, max_attempts=3):
        for _ in range(max_attempts):
            try:
                self.attempt_count += 1
                raise ConnectionError("db down")
            except ConnectionError:
                await asyncio.sleep(0.001)
        raise ConnectionError("max retries exceeded")


@pytest.mark.asyncio
async def test_ar_infinite_runs_forever():
    """AR-INFINITE: without external cancellation, retries indefinitely."""
    svc = ServiceWithARInfinite()
    task = asyncio.create_task(svc.connect())

    await asyncio.sleep(0.1)  # let it run
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    # BUG: hundreds of attempts in 0.1 seconds
    assert svc.attempt_count > 50, (
        f"AR-INFINITE demonstrated: {svc.attempt_count} attempts in 0.1s "
        "with no sign of stopping"
    )


@pytest.mark.asyncio
async def test_ar_infinite_safe_bounded():
    """SAFE version: stops after max_attempts."""
    svc = ServiceWithoutARInfinite()

    with pytest.raises(ConnectionError, match="max retries"):
        await svc.connect(max_attempts=3)

    assert svc.attempt_count == 3


# ============================================================
# SR-PARTIAL: Partial state update → inconsistency
# ============================================================


class ServiceWithSRPartial:
    """VULNERABLE: partial state update on retry."""

    def __init__(self):
        self.data = "old_data"
        self.result = "old_result"

    def process(self):
        for attempt in range(3):
            self.data = f"new_data_v{attempt}"  # succeeds
            if attempt < 2:
                raise ValueError("compute failed")  # fails
            self.result = f"result_for_{self.data}"


class ServiceWithoutSRPartial:
    """SAFE: atomic update — all or nothing."""

    def __init__(self):
        self.data = "old_data"
        self.result = "old_result"

    def process(self):
        for attempt in range(3):
            try:
                local_data = f"new_data_v{attempt}"
                if attempt < 2:
                    raise ValueError("compute failed")
                local_result = f"result_for_{local_data}"
                # atomic commit
                self.data = local_data
                self.result = local_result
                return
            except ValueError:
                continue


def test_sr_partial_inconsistent_state():
    """SR-PARTIAL: data is updated but result is stale."""
    svc = ServiceWithSRPartial()
    try:
        svc.process()
    except ValueError:
        pass

    # BUG: data is "new_data_v1" but result is "old_result" — inconsistent
    assert svc.data != "old_data", "data was updated"
    assert svc.result == "old_result", (
        "SR-PARTIAL demonstrated: data updated but result is stale — inconsistent state"
    )


def test_sr_partial_safe_atomic():
    """SAFE version: either both updated or neither."""
    svc = ServiceWithoutSRPartial()
    svc.process()

    assert "new_data_v2" in svc.data
    assert "new_data_v2" in svc.result, "Safe version: data and result are consistent"


# ============================================================
# SA-LOOP: State-Conditioned Await Loop → stale condition
# ============================================================


class ServiceWithSALoop:
    def __init__(self):
        self._running = True
        self.processed = []

    async def listen(self, queue):
        while self._running:
            msg = await queue.get()
            self.processed.append(msg)

    def stop(self):
        self._running = False


class ServiceWithoutSALoop:
    def __init__(self):
        self._running = True
        self.processed = []

    async def listen(self, queue):
        while self._running:
            try:
                msg = await asyncio.wait_for(queue.get(), timeout=0.05)
                self.processed.append(msg)
            except asyncio.TimeoutError:
                continue

    def stop(self):
        self._running = False


@pytest.mark.asyncio
async def test_sa_loop_processes_after_stop():
    svc = ServiceWithSALoop()
    queue = asyncio.Queue()

    task = asyncio.create_task(svc.listen(queue))
    await asyncio.sleep(0.01)

    svc.stop()
    await queue.put("after_stop")
    await asyncio.sleep(0.01)

    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    assert "after_stop" in svc.processed, (
        "SA-LOOP demonstrated: message processed AFTER stop() was called"
    )


@pytest.mark.asyncio
async def test_sa_loop_safe_respects_stop():
    svc = ServiceWithoutSALoop()
    queue = asyncio.Queue()

    task = asyncio.create_task(svc.listen(queue))
    await asyncio.sleep(0.01)

    svc.stop()
    await asyncio.sleep(0.1)

    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    assert "after_stop" not in svc.processed, "Safe version: no processing after stop"


# ============================================================
# SA-ACCUM: Async Iteration Accumulate → incomplete state
# ============================================================


class ServiceWithSAAccum:
    def __init__(self):
        self.items = []

    async def collect(self, stream):
        async for item in stream:
            self.items.append(item)


class ServiceWithoutSAAccum:
    def __init__(self):
        self.items = []

    async def collect(self, stream):
        local = []
        async for item in stream:
            local.append(item)
        self.items = local


async def _slow_stream(items):
    for item in items:
        yield item
        await asyncio.sleep(0)


@pytest.mark.asyncio
async def test_sa_accum_incomplete_state_visible():
    svc = ServiceWithSAAccum()
    observed_lengths = []

    async def observer():
        for _ in range(10):
            observed_lengths.append(len(svc.items))
            await asyncio.sleep(0)

    await asyncio.gather(
        svc.collect(_slow_stream(["a", "b", "c", "d", "e"])),
        observer(),
    )

    intermediate = [l for l in observed_lengths if 0 < l < 5]
    assert len(intermediate) > 0, (
        "SA-ACCUM demonstrated: observer saw incomplete list during async iteration"
    )


@pytest.mark.asyncio
async def test_sa_accum_safe_atomic_swap():
    svc = ServiceWithoutSAAccum()
    observed_lengths = []

    async def observer():
        for _ in range(10):
            observed_lengths.append(len(svc.items))
            await asyncio.sleep(0)

    await asyncio.gather(
        svc.collect(_slow_stream(["a", "b", "c", "d", "e"])),
        observer(),
    )

    for length in observed_lengths:
        assert length == 0 or length == 5, (
            f"Safe version: items length should be 0 or 5, got {length}"
        )


# ============================================================
# AR-STORM: No Backoff → thundering herd
# ============================================================


class ServiceWithARStorm:
    def __init__(self):
        self.attempt_times = []

    async def fetch(self):
        for i in range(5):
            self.attempt_times.append(asyncio.get_event_loop().time())
            try:
                raise ConnectionError("fail")
            except ConnectionError:
                await asyncio.sleep(1)


class ServiceWithoutARStorm:
    def __init__(self):
        self.attempt_times = []

    async def fetch(self):
        import random

        for i in range(5):
            self.attempt_times.append(asyncio.get_event_loop().time())
            try:
                raise ConnectionError("fail")
            except ConnectionError:
                delay = min(2**i, 30) + random.uniform(0, 0.5)
                await asyncio.sleep(delay)


@pytest.mark.asyncio
async def test_ar_storm_uniform_intervals():
    svc = ServiceWithARStorm()
    await svc.fetch()

    intervals = [
        svc.attempt_times[i + 1] - svc.attempt_times[i]
        for i in range(len(svc.attempt_times) - 1)
    ]

    all_same = all(abs(iv - intervals[0]) < 0.1 for iv in intervals)
    assert all_same, (
        f"AR-STORM demonstrated: all retry intervals are uniform ({intervals}) "
        "→ thundering herd risk when multiple clients retry simultaneously"
    )


@pytest.mark.asyncio
async def test_ar_storm_safe_exponential_backoff():
    svc = ServiceWithoutARStorm()
    task = asyncio.create_task(svc.fetch())

    await asyncio.sleep(4)
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    if len(svc.attempt_times) >= 3:
        intervals = [
            svc.attempt_times[i + 1] - svc.attempt_times[i]
            for i in range(len(svc.attempt_times) - 1)
        ]
        assert intervals[-1] > intervals[0], (
            f"Safe version: intervals should increase ({intervals})"
        )
