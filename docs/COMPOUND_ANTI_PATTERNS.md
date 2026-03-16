# 복합 안티패턴 (Compound Anti-Patterns)

> 단일 관심사는 안전하지만, 특정 조합이 같은 함수에 공존할 때 위험해지는 패턴.
> 기존 정적 분석 도구는 개별 관심사만 탐지하며, 이 조합을 탐지하지 못한다.

---

## 배경

기존 정적 분석 도구(pylint, Semgrep, SonarQube 등)는 **단일 패턴**을 탐지한다:
- "broad except가 있다" (pylint W0703)
- "async 함수에서 time.sleep을 쓴다" (flake8-async ASYNC251)

하지만 실제 버그는 **조합**에서 발생한다:
- "broad except가 **async retry 루프 안에** 있어서 CancelledError를 삼킨다"
- "shared state 변경이 **await 경계를 가로질러** interleaving race를 만든다"

이 문서는 그러한 **복합 안티패턴(Compound Anti-Pattern)**을 정의한다.

---

## 용어 정의

**복합 안티패턴**: 2개 이상의 관심사(state, async, retry)가 같은 함수 스코프에서
특정 조건으로 결합될 때 발생하는 위험 패턴. 각 관심사 단독으로는 안전하다.

**3가지 관심사**:
| 관심사 | 정의 | 탐지 기준 |
|--------|------|----------|
| **S (State)** | shared mutable state의 변경. `self.`, 전역 변수, 클로저 캡처 변수. 로컬 변수는 제외 | `self.x =`, `global x`, 클로저 내 `nonlocal x` |
| **A (Async)** | 실행 양보(yield of control). `await`, `yield`, `async for`, `async with` | `await`, `yield`, `async for/with` |
| **R (Retry)** | 실패 시 재시도. `for attempt in range(N)`, `while True` + `except` + `continue`, backoff 라이브러리 | retry 루프 패턴, `@retry` 데코레이터 |

---

## SA 계열 — State × Async

### SA-CROSS: State-Await Crossing

> shared state 변경이 await 경계를 가로질러, 중간 상태가 다른 코루틴에 노출된다.

**구조**:
```python
async def process(self):
    self.status = "running"     # ① write
    result = await do_work()    # ② yield — 다른 코루틴이 여기서 self.status를 봄
    self.status = "done"        # ③ write
```

**위험**: ② 시점에서 다른 코루틴이 `self.status`를 읽으면 "running" 상태를 보지만,
실제로는 `do_work()`가 실패했을 수 있다. asyncio가 단일 스레드라도 코루틴
interleaving으로 인해 race condition이 발생한다.

**안전한 대안**:
```python
async def process(self):
    result = await do_work()    # await 전에 state 변경 없음
    self.status = "done"        # await 후 한 번만 write
```

**탐지 조건**: 같은 함수에서 `self.X = ...` → `await` → `self.X = ...` 순서가 존재하고,
X가 함수 외부에서 관측 가능(public 속성, 다른 메서드에서 참조)할 때.

**선행 근거**: Lee 2006 [3] "The Problem with Threads" — 공유 가변 상태 +
비결정적 실행 양보가 결합하면 추론이 근본적으로 어려워짐. 단, Lee는 멀티스레드를
다루며 단일 스레드 async에는 직접 적용되지 않으나 코루틴 interleaving에서 유사 문제 발생.

---

### SA-LOOP: State-Conditioned Await Loop

> 루프 조건이 shared state에 의존하는데, 루프 본문에 await가 있어
> 조건이 루프 밖에서 변경될 수 있다.

**구조**:
```python
async def listen(self):
    while self._running:            # shared state가 루프 조건
        msg = await queue.get()     # yield — 이 사이에 _running이 False로 변할 수 있음
        self.process(msg)
```

**위험**: `await queue.get()` 중에 다른 코루틴이 `self._running = False`로 설정해도,
현재 코루틴은 `await`에서 돌아온 후에야 조건을 확인한다. 이미 받은 `msg`를
처리하게 되어 종료 타이밍이 불명확하다.

**안전한 대안**:
```python
async def listen(self):
    while self._running:
        try:
            msg = await asyncio.wait_for(queue.get(), timeout=1.0)
        except asyncio.TimeoutError:
            continue                # timeout으로 주기적 조건 확인
        self.process(msg)
```

**탐지 조건**: `while self.X` 또는 `while not self.X` 루프 안에 `await`가 존재할 때.

---

### SA-ACCUM: State Accumulation During Async Iteration

> async 반복 중 shared state에 누적하여 불완전한 중간 상태가 노출된다.

**구조**:
```python
async def collect(self):
    async for item in stream:
        self.items.append(item)     # 매 yield마다 불완전한 리스트 노출
```

**위험**: `stream`의 각 `__anext__` 호출에서 실행이 양보될 때,
다른 코루틴이 `self.items`를 읽으면 아직 수집이 완료되지 않은 불완전한 상태를 본다.

**안전한 대안**:
```python
async def collect(self):
    local_items = []
    async for item in stream:
        local_items.append(item)    # 로컬 변수에 누적
    self.items = local_items        # 한 번에 교체 (원자적)
```

**탐지 조건**: `async for` 루프 안에서 `self.X.append/extend/update` 또는 `self.X += `가 존재할 때.

---

## SR 계열 — State × Retry

### SR-LEAK: State Leak on Retry Failure

> retry 루프에서 shared state를 변경한 뒤 실패하면, 중간 상태가 정리되지 않고 잔존한다.

**구조**:
```python
def process(self):
    for attempt in range(3):
        self.status = "trying"      # state 변경
        result = call_api()         # 실패하면...
        if result:
            self.status = "done"
            return result
    # self.status가 "trying"인 채로 끝남
```

**위험**: 3회 모두 실패 시 `self.status`는 "trying"으로 남는다.
외부에서 이 객체의 상태를 확인하면 "아직 시도 중"으로 오해한다.

**안전한 대안**:
```python
def process(self):
    for attempt in range(3):
        try:
            return call_api()
        except TransientError:
            continue
        finally:
            pass
    self.status = "failed"          # 명시적 최종 상태
```

**탐지 조건**: retry 루프(for + range 또는 while + attempt) 안에서 `self.X = `가 있고,
루프 밖에 `finally` 또는 루프 후 `self.X = `(정리)가 없을 때.

**선행 근거**: Stoica et al. 2024 [9] (SOSP) — retry + state 조합에서
멱등성 위반과 상태 오염이 체계적으로 발생.

---

### SR-ACCUM: Counter Accumulation Across Retries

> retry마다 shared state 카운터가 누적되어 비멱등적 동작을 만든다.

**구조**:
```python
def process(self):
    for attempt in range(3):
        self.total_calls += 1       # retry마다 누적
        result = call_api()
        if result: return result
```

**위험**: 3회 시도하면 `total_calls`가 3 증가한다.
"1회 처리"의 부작용이 "3회 처리"로 보인다. 과금, 로깅, 통계에서 왜곡.

**안전한 대안**:
```python
def process(self):
    attempts = 0                    # 로컬 변수
    for attempt in range(3):
        attempts += 1
        result = call_api()
        if result:
            self.total_calls += 1   # 성공 시에만 1회 누적
            return result
```

**탐지 조건**: retry 루프 안에서 `self.X += ` 또는 `self.X = self.X + `가 존재할 때.

---

### SR-PARTIAL: Partial State Update on Retry

> retry 루프에서 여러 state를 순차적으로 변경하다 중간에 실패하면
> 일부만 변경된 불일치 상태가 남는다.

**구조**:
```python
def process(self):
    for attempt in range(3):
        self.data = fetch_data()        # ① 성공
        self.result = compute(self.data) # ② 실패 시 data만 갱신, result는 이전 값
```

**위험**: ②에서 실패하면 `self.data`는 새 값, `self.result`는 이전 값 — 불일치.

**안전한 대안**:
```python
def process(self):
    for attempt in range(3):
        try:
            data = fetch_data()         # 로컬
            result = compute(data)      # 로컬
            self.data = data            # 성공 시에만 한 번에 갱신
            self.result = result
            return
        except TransientError:
            continue
```

**탐지 조건**: retry 루프 안에서 `self.X = ` 이 2개 이상 있고, 중간에 예외 가능한 호출이 있을 때.

---

## AR 계열 — Async × Retry

### AR-SWALLOW: CancelledError Swallowing in Retry

> async retry 루프에서 broad except가 CancelledError를 삼켜 서비스가 종료되지 않는다.

**구조**:
```python
async def fetch(self):
    while True:
        try:
            return await http.get(url)
        except Exception:               # CancelledError도 잡힘
            await asyncio.sleep(1)
```

**위험**: `asyncio.CancelledError`는 Python 3.9+에서 `BaseException`이지만,
3.8 이하에서는 `Exception`의 하위 클래스. 또한 `except Exception`은 습관적으로
사용되어 의도치 않게 cancellation을 삼킴. 서비스 종료(shutdown) 시 이 태스크가
영원히 종료되지 않는다.

**안전한 대안**:
```python
async def fetch(self):
    for attempt in range(3):
        try:
            return await http.get(url)
        except asyncio.CancelledError:
            raise                       # cancellation은 항상 전파
        except (TimeoutError, ConnectionError):
            await asyncio.sleep(attempt * 2)
    raise MaxRetriesExceeded()
```

**탐지 조건**: async 함수의 retry 루프 안에서 `except Exception` 또는 bare `except`가 있고,
`except asyncio.CancelledError: raise`가 **없을** 때.

**선행 근거**: flake8-async ASYNC103 — CancelledError를 잡고 re-raise하지 않는 경우 탐지.
단, "retry 루프 안에서"라는 조합 조건은 없음.

---

### AR-INFINITE: Unbounded Async Retry

> async retry에 횟수/시간 제한이 없어 영구 장애 시 무한 재시도한다.

**구조**:
```python
async def connect(self):
    while True:
        try:
            self.conn = await db.connect()
            return
        except ConnectionError:
            await asyncio.sleep(1)
```

**위험**: DB가 영구적으로 다운되면 이 함수는 **영원히** 재시도한다.
리소스(메모리, 커넥션 풀, 로그)가 계속 소비되고,
상위 호출자는 응답을 받지 못한다.

**안전한 대안**:
```python
async def connect(self, max_attempts=5, timeout=30):
    async with asyncio.timeout(timeout):       # 전체 시간 제한
        for attempt in range(max_attempts):     # 횟수 제한
            try:
                self.conn = await db.connect()
                return
            except ConnectionError:
                await asyncio.sleep(min(2 ** attempt, 10))  # exponential backoff
    raise ConnectionFailed()
```

**탐지 조건**: `while True` + `await` + `except` + `continue/pass` 구조에서
`range()`, `max_attempts`, `timeout`, `asyncio.timeout` 등의 **제한 장치가 없을** 때.

---

### AR-STORM: Retry Without Backoff

> async retry에 backoff/jitter가 없어 동시 재시도가 서비스를 압도한다.

**구조**:
```python
async def fetch(self):
    for i in range(10):
        try:
            return await api.call()
        except RateLimitError:
            await asyncio.sleep(1)      # 고정 1초 — 동시 클라이언트가 모두 1초 후 재시도
```

**위험**: 100개 클라이언트가 동시에 실패하면 1초 후 100개가 동시에 재시도.
이것이 **thundering herd/retry storm** — 서비스를 더 압도하여 장애를 악화.

**안전한 대안**:
```python
async def fetch(self):
    for i in range(5):
        try:
            return await api.call()
        except RateLimitError:
            delay = min(2 ** i, 30) + random.uniform(0, 1)  # exponential backoff + jitter
            await asyncio.sleep(delay)
```

**탐지 조건**: retry 루프 안에서 `await asyncio.sleep(상수)` (고정 대기)이고,
`random`, `jitter`, 또는 `2 ** ` (지수 증가)가 **없을** 때.

---

## 복합 패턴 요약 (SAR)

### SAR: State-Async-Retry Triple Violation

> SA + SR + AR 중 어떤 조합이든 3가지가 한 함수에 공존하면 hard fail.

**구조**: 위 패턴 중 아무 조합이든 3가지 관심사가 같은 함수 스코프에 존재.

**위험**: 각 2가지 조합의 위험이 **곱셈적으로** 결합.
- SA의 interleaving + SR의 상태 잔존 + AR의 무한 재시도
- 상태기계 + 재진입 + 부분 실패 = **경우의 수 폭발**

**탐지 조건**: 같은 함수에서 SA 패턴 + SR 패턴 + AR 패턴 중 3가지가 동시 존재.

**선행 근거**: 
- Eaddy et al. 2008 [8] — 관심사 분산도가 높을수록 결함 밀도 증가 (실증)
- Sweller et al. 2019 [5] — element interactivity가 곱셈적으로 증가하면 인지 부하 폭발 (이론)
- 직접적 SAR 조합 연구는 없음 — 간접 근거 기반 추론

---

## 관련 문서

- [STABILITY_INVARIANTS.md](STABILITY_INVARIANTS.md) — 불변조건 전체 스펙
- [../skills/cheese-gate/SKILL.md](../skills/cheese-gate/SKILL.md) — 🧀 Cheese 판단 규칙
- [THEORY.ko.md](THEORY.ko.md) — 이론적 토대 + 참고 문헌
