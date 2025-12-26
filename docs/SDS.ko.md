# 소프트웨어 설계 명세서 (SDS)
# semantic-complexity v1.0

---

## 1. 개요

### 1.1 목적

본 문서는 [SRS.ko.md](./SRS.ko.md)의 요구사항을 구현하기 위한 **설계 결정과 알고리즘**을 명세합니다.

### 1.2 관련 문서

| 문서 | 역할 |
|------|------|
| [THEORY.ko.md](../THEORY.ko.md) | 이론적 토대 (왜) |
| [SRS.ko.md](./SRS.ko.md) | 요구사항 (무엇을) |
| 본 문서 | 설계 (어떻게) |

---

## 2. 시스템 아키텍처

### 2.1 전체 구조

```
┌─────────────────────────────────────────────────────────────┐
│                      semantic-complexity                      │
├─────────────────────────────────────────────────────────────┤
│                        Entry Points                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │   CLI   │  │   MCP   │  │   API   │  │  CI/CD  │        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
├───────┼────────────┼────────────┼────────────┼──────────────┤
│       └────────────┴────────────┴────────────┘              │
│                           │                                  │
│                    ┌──────▼──────┐                          │
│                    │  Analyzer   │                          │
│                    │ Coordinator │                          │
│                    └──────┬──────┘                          │
│       ┌──────────────────┼──────────────────┐               │
│       ▼                  ▼                  ▼               │
│  ┌─────────┐       ┌─────────┐       ┌─────────┐           │
│  │ 🍞 Bread │       │🧀 Cheese│       │ 🥓 Ham  │           │
│  │Security │       │Cognitive│       │Behavior │           │
│  └────┬────┘       └────┬────┘       └────┬────┘           │
│       └──────────────────┼──────────────────┘               │
│                          ▼                                  │
│                   ┌────────────┐                            │
│                   │  Simplex   │                            │
│                   │ Normalizer │                            │
│                   └──────┬─────┘                            │
│       ┌──────────────────┼──────────────────┐               │
│       ▼                  ▼                  ▼               │
│  ┌─────────┐       ┌─────────┐       ┌─────────┐           │
│  │  Gate   │       │ Budget  │       │Gradient │           │
│  │ Checker │       │ Tracker │       │Recommender│          │
│  └─────────┘       └─────────┘       └─────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 모듈 구조

```
packages/core/src/
├── types/                    # 타입 정의
│   ├── axis.ts              # Axis = '🍞' | '🧀' | '🥓'
│   ├── module.ts            # ModuleType
│   ├── score.ts             # SandwichScore
│   └── index.ts
│
├── analyzers/               # 3축 분석기
│   ├── bread/               # 🍞 Security Analyzer
│   │   ├── trust-boundary.ts
│   │   ├── auth-flow.ts
│   │   └── secret-detector.ts
│   ├── cheese/              # 🧀 Cognitive Analyzer
│   │   ├── cognitive.ts     # Cognitive Complexity (NOT McCabe!)
│   │   ├── nesting.ts       # Depth penalty
│   │   ├── hidden-coupling.ts
│   │   └── state-async-retry.ts
│   ├── ham/                 # 🥓 Behavioral Analyzer
│   │   ├── golden-test.ts
│   │   ├── contract-test.ts
│   │   └── critical-path.ts
│   └── index.ts
│
├── simplex/                 # Simplex 정규화
│   ├── normalizer.ts        # 3축 → Simplex 변환
│   ├── labeler.ts           # 지배 축 라벨링
│   ├── equilibrium.ts       # 균형점 탐지
│   └── index.ts
│
├── canonical/               # Canonical Profile
│   ├── profiles.ts          # 모듈 타입별 프로파일
│   ├── detector.ts          # 모듈 타입 자동 탐지
│   ├── deviation.ts         # 편차 계산
│   └── index.ts
│
├── gate/                    # Gate System
│   ├── mvp-gate.ts          # MVP 진입 조건
│   ├── pr-gate.ts           # PR 조건
│   └── index.ts
│
├── budget/                  # Change Budget
│   ├── tracker.ts           # 예산 추적
│   ├── delta.ts             # 변경량 계산
│   └── index.ts
│
├── recommend/               # Gradient Recommender
│   ├── gradient.ts          # 균형 방향 계산
│   ├── actions.ts           # 리팩토링 액션 제안
│   └── index.ts
│
├── protected/               # Protected Zone
│   ├── patterns.ts          # 보호 패턴 정의
│   ├── detector.ts          # 보호 영역 탐지
│   └── index.ts
│
└── index.ts                 # Public API
```

---

## 3. 알고리즘 설계

### 3.1 🧀 Cheese: 인지 가능 여부 판정

#### 3.1.1 정의

```
🧀 Cheese = 사람과 LLM이 인지할 수 있는 범위 내에 있는가?

인지 가능 조건 (모두 충족해야 함):
┌─────────────────────────────────────────────────────────────┐
│ 조건              │ 기준              │ 근거                │
├───────────────────┼───────────────────┼────────────────────┤
│ 1. 중첩 깊이       │ ≤ N (설정 가능)   │ 한눈에 구조 파악    │
│ 2. 개념 수         │ ≤ 5개/함수        │ 작업 기억 한계      │
│ 3. 숨겨진 의존성    │ 최소화            │ 컨텍스트 완결성     │
│ 4. state×async×retry │ 2개 이상 공존 금지 │ 동시 추론 불가    │
└─────────────────────────────────────────────────────────────┘
```

#### 3.1.2 의사코드: 인지 가능 여부 판정

```
FUNCTION is_cognitively_accessible(code, config) -> (Boolean, String):
    """
    코드가 사람/LLM이 인지 가능한 범위 내인지 판정

    Input:
        code: 분석 대상 소스 코드
        config: 임계값 설정 (NESTING_THRESHOLD, HIDDEN_DEP_THRESHOLD)

    Output:
        (True, "인지 가능")     - 🧀 양호
        (False, 위반 사유)      - 🧀 위반
    """

    # ─────────────────────────────────────────────────────────
    # 조건 1: 중첩 깊이 검사
    # ─────────────────────────────────────────────────────────
    max_nesting = calculate_max_nesting(code)
    IF max_nesting > config.NESTING_THRESHOLD:
        RETURN (False, "중첩 깊이 초과: " + max_nesting)

    # ─────────────────────────────────────────────────────────
    # 조건 2: 함수당 개념 수 검사
    # ─────────────────────────────────────────────────────────
    FOR each function IN extract_functions(code):
        concept_count = count_concepts(function)
        IF concept_count > 5:
            RETURN (False, "개념 수 초과: " + function.name + " = " + concept_count)

    # ─────────────────────────────────────────────────────────
    # 조건 3: 숨겨진 의존성 검사
    # ─────────────────────────────────────────────────────────
    hidden_deps = detect_hidden_dependencies(code)
    IF hidden_deps.count > config.HIDDEN_DEP_THRESHOLD:
        RETURN (False, "숨겨진 의존성 초과: " + hidden_deps.list)

    # ─────────────────────────────────────────────────────────
    # 조건 4: state×async×retry 공존 검사
    # ─────────────────────────────────────────────────────────
    invariant = check_state_async_retry(code)
    IF invariant.violated:
        RETURN (False, "state×async×retry 공존: " + invariant.details)

    RETURN (True, "인지 가능")
```

#### 3.1.3 의사코드: 중첩 깊이 계산

```
FUNCTION calculate_max_nesting(code) -> Integer:
    """
    코드의 최대 중첩 깊이 계산
    """

    NESTING_STRUCTURES = {
        'if', 'elif', 'else',
        'for', 'while',
        'try', 'except',
        'with',
        'match',
        'lambda',
        'list_comprehension',
        'dict_comprehension',
        'set_comprehension'
    }

    max_depth = 0
    current_depth = 0

    FUNCTION traverse(node):
        nonlocal max_depth, current_depth

        IF node.type IN NESTING_STRUCTURES:
            current_depth += 1
            max_depth = MAX(max_depth, current_depth)

        FOR child IN node.children:
            traverse(child)

        IF node.type IN NESTING_STRUCTURES:
            current_depth -= 1

    traverse(parse_ast(code))
    RETURN max_depth
```

#### 3.1.4 의사코드: 개념 수 계산

```
FUNCTION count_concepts(function) -> Integer:
    """
    함수 내 개념 수 계산

    개념 = 함수가 다루는 독립적인 관심사
    """

    concepts = SET()
    local_names = get_local_names(function)  # 파라미터 + 로컬 변수

    FOR each node IN traverse_ast(function.body):

        # 외부 함수/메서드 호출
        IF is_call(node):
            callee = get_callee_name(node)
            IF callee NOT IN local_names:
                concepts.ADD(callee)

        # 외부 이름 접근
        IF is_name(node):
            IF node.name NOT IN local_names:
                concepts.ADD(node.name)

        # 상태 변이
        IF is_state_mutation(node):
            concepts.ADD("state:" + get_target(node))

    RETURN SIZE(concepts)
```

#### 3.1.5 의사코드: 숨겨진 의존성 탐지

```
FUNCTION detect_hidden_dependencies(code) -> HiddenDepResult:
    """
    컨텍스트 밖에서 오는 숨겨진 의존성 탐지
    """

    deps = []

    # ─────────────────────────────────────────────────────────
    # 1. 전역 변수 접근
    # ─────────────────────────────────────────────────────────
    GLOBAL_PATTERNS = ['global X', 'nonlocal X']
    FOR match IN find_patterns(code, GLOBAL_PATTERNS):
        deps.APPEND(HiddenDep(type="global", location=match))

    # ─────────────────────────────────────────────────────────
    # 2. 환경 변수 접근
    # ─────────────────────────────────────────────────────────
    ENV_PATTERNS = ['os.environ', 'getenv(', 'os.getenv']
    FOR match IN find_patterns(code, ENV_PATTERNS):
        deps.APPEND(HiddenDep(type="env", location=match))

    # ─────────────────────────────────────────────────────────
    # 3. 암묵적 I/O
    # ─────────────────────────────────────────────────────────
    IO_PATTERNS = ['open(', 'requests.', 'urllib', 'socket.']
    FOR match IN find_patterns(code, IO_PATTERNS):
        deps.APPEND(HiddenDep(type="io", location=match))

    # ─────────────────────────────────────────────────────────
    # 4. 클로저 캡처
    # ─────────────────────────────────────────────────────────
    FOR each inner_function IN find_inner_functions(code):
        captured = find_captured_variables(inner_function)
        FOR var IN captured:
            deps.APPEND(HiddenDep(type="closure", location=var))

    RETURN HiddenDepResult(count=SIZE(deps), list=deps)
```

#### 3.1.6 의사코드: state×async×retry 불변조건

```
STRUCT InvariantResult:
    has_state: Boolean
    has_async: Boolean
    has_retry: Boolean
    violated: Boolean
    details: String


FUNCTION check_state_async_retry(code) -> InvariantResult:
    """
    state×async×retry 불변조건 검사

    규칙: 3개 중 2개 이상 공존 시 위반
    근거: 동시에 추론할 수 없는 복잡도
    """

    has_state = detect_state_mutation(code)
    has_async = detect_async_pattern(code)
    has_retry = detect_retry_pattern(code)

    count = 0
    IF has_state: count += 1
    IF has_async: count += 1
    IF has_retry: count += 1

    violated = count >= 2

    details = []
    IF has_state: details.APPEND("state")
    IF has_async: details.APPEND("async")
    IF has_retry: details.APPEND("retry")

    RETURN InvariantResult(
        has_state = has_state,
        has_async = has_async,
        has_retry = has_retry,
        violated = violated,
        details = JOIN(details, " × ")
    )


FUNCTION detect_state_mutation(code) -> Boolean:
    """상태 변이 패턴 탐지"""
    STATE_PATTERNS = [
        'self.X = ',           # 인스턴스 상태
        'global X',            # 전역 상태
        '.append(', '.update(', '.extend(',  # 컬렉션 변이
        '[X] = '               # 인덱스 할당
    ]
    RETURN matches_any(code, STATE_PATTERNS)


FUNCTION detect_async_pattern(code) -> Boolean:
    """비동기 패턴 탐지"""
    ASYNC_PATTERNS = [
        'async def',
        'await ',
        'asyncio.',
        'ThreadPoolExecutor',
        'ProcessPoolExecutor'
    ]
    RETURN matches_any(code, ASYNC_PATTERNS)


FUNCTION detect_retry_pattern(code) -> Boolean:
    """재시도 패턴 탐지"""
    RETRY_PATTERNS = [
        'retry', 'backoff', 'attempt', 'max_retries',
        'for X in range(N)'   # 재시도 루프 패턴
    ]
    RETURN matches_any(code, RETRY_PATTERNS)
```

#### 3.1.7 예시

```python
# ─────────────────────────────────────────────────────────────
# 예시 1: 인지 가능 ✓
# ─────────────────────────────────────────────────────────────
def simple_function(x):
    if x > 0:
        return process(x)
    return default()

# 분석:
#   중첩: 1 ✓
#   개념 수: 2 (process, default) ✓
#   숨겨진 의존성: 0 ✓
#   state×async×retry: 0 ✓
# 결과: 인지 가능


# ─────────────────────────────────────────────────────────────
# 예시 2: 인지 불가 ✗ - 중첩 초과
# ─────────────────────────────────────────────────────────────
def deeply_nested(a, b, c, d):
    if a:
        if b:
            if c:
                if d:
                    return result

# 분석:
#   중첩: 4 (threshold=3 가정)
# 결과: 인지 불가 - "중첩 깊이 초과: 4"


# ─────────────────────────────────────────────────────────────
# 예시 3: 인지 불가 ✗ - state×async×retry 공존
# ─────────────────────────────────────────────────────────────
async def fetch_with_retry(self):
    for attempt in range(3):           # retry ✓
        try:
            self.result = await fetch() # state ✓ + async ✓
            return self.result
        except:
            await sleep(1)

# 분석:
#   state: self.result = ...
#   async: async def, await
#   retry: for attempt in range(3)
#   공존 수: 3
# 결과: 인지 불가 - "state×async×retry 공존: state × async × retry"
```

### 3.2 state×async×retry 불변조건 (상세)

#### 3.2.2 탐지 패턴

```typescript
// 상태 (State) 탐지
const STATE_PATTERNS = {
  typescript: [
    /\bthis\.\w+\s*=/,           // this.field =
    /\blet\s+\w+\s*=/,           // let 변수
    /\.setState\(/,              // React setState
    /\bstore\./,                 // Redux/MobX store
  ],
  python: [
    /\bself\.\w+\s*=/,           // self.field =
    /\bglobal\s+\w+/,            // global 변수
  ],
  go: [
    /\b\w+\s*=\s*[^=]/,          // 변수 재할당
    /\batomic\./,                // atomic 연산
  ]
};

// 비동기 (Async) 탐지
const ASYNC_PATTERNS = {
  typescript: [
    /\basync\s+function/,
    /\bawait\s+/,
    /\.then\(/,
    /new\s+Promise\(/,
  ],
  python: [
    /\basync\s+def/,
    /\bawait\s+/,
    /asyncio\./,
  ],
  go: [
    /\bgo\s+func/,
    /\bgo\s+\w+\(/,
    /<-\s*\w+/,                  // channel receive
    /\w+\s*<-/,                  // channel send
  ]
};

// 재시도 (Retry) 탐지
const RETRY_PATTERNS = {
  all: [
    /retry/i,
    /backoff/i,
    /attempt/i,
    /max_retries/i,
    /for\s*\(.*;\s*\w+\s*<\s*\d+/,  // for loop with counter
  ]
};
```

#### 3.2.3 알고리즘

```typescript
function checkCognitiveInvariant(code: string, lang: Language): CognitiveInvariant {
  const hasState = matchesAny(code, STATE_PATTERNS[lang]);
  const hasAsync = matchesAny(code, ASYNC_PATTERNS[lang]);
  const hasRetry = matchesAny(code, RETRY_PATTERNS.all);

  // 3개 중 2개 이상이면 위반
  const count = [hasState, hasAsync, hasRetry].filter(Boolean).length;
  const violated = count >= 2;

  return { hasState, hasAsync, hasRetry, violated };
}
```

### 3.3 Simplex 정규화

#### 3.3.1 Raw Score → Simplex 변환

```typescript
interface RawScores {
  bread: number;    // 0 ~ ∞ (보안 점수)
  cheese: number;   // 0 ~ ∞ (인지 점수)
  ham: number;      // 0 ~ ∞ (행동 점수)
}

interface SandwichScore {
  bread: number;    // 0 ~ 100
  cheese: number;   // 0 ~ 100
  ham: number;      // 0 ~ 100
  // bread + cheese + ham = 100
}

function normalizeToSimplex(raw: RawScores): SandwichScore {
  const total = raw.bread + raw.cheese + raw.ham;

  if (total === 0) {
    // 기본값: 균등 분배
    return { bread: 33.33, cheese: 33.33, ham: 33.34 };
  }

  return {
    bread: (raw.bread / total) * 100,
    cheese: (raw.cheese / total) * 100,
    ham: (raw.ham / total) * 100,
  };
}
```

#### 3.3.2 지배 축 라벨링

```typescript
type DominantLabel = '🍞' | '🧀' | '🥓';

function labelDominantAxis(score: SandwichScore): DominantLabel {
  if (score.bread >= score.cheese && score.bread >= score.ham) {
    return '🍞';
  }
  if (score.cheese >= score.bread && score.cheese >= score.ham) {
    return '🧀';
  }
  return '🥓';
}
```

### 3.4 Canonical Profile 편차 계산

#### 3.4.1 모듈 타입별 Canonical 정의

```typescript
const CANONICAL_PROFILES: Record<ModuleType, SandwichScore> = {
  'deploy':       { bread: 70, cheese: 10, ham: 20 },
  'api-external': { bread: 50, cheese: 20, ham: 30 },
  'api-internal': { bread: 30, cheese: 30, ham: 40 },
  'app':          { bread: 20, cheese: 50, ham: 30 },
  'lib-domain':   { bread: 10, cheese: 30, ham: 60 },
  'lib-infra':    { bread: 20, cheese: 30, ham: 50 },
};
```

#### 3.4.2 편차 계산

```typescript
interface Deviation {
  bread: number;    // + 는 초과, - 는 미달
  cheese: number;
  ham: number;
  distance: number; // L2 거리
}

function calculateDeviation(
  current: SandwichScore,
  canonical: SandwichScore
): Deviation {
  const dB = current.bread - canonical.bread;
  const dC = current.cheese - canonical.cheese;
  const dH = current.ham - canonical.ham;

  return {
    bread: dB,
    cheese: dC,
    ham: dH,
    distance: Math.sqrt(dB*dB + dC*dC + dH*dH),
  };
}
```

### 3.5 Gradient 방향 계산

#### 3.5.1 Lyapunov 에너지 함수

```typescript
// E(v) = ||v - c||² = (v - c)ᵀ(v - c)
// 여기서 v = 현재 점, c = canonical centroid

function calculateEnergy(
  current: SandwichScore,
  canonical: SandwichScore
): number {
  const dB = current.bread - canonical.bread;
  const dC = current.cheese - canonical.cheese;
  const dH = current.ham - canonical.ham;

  return dB*dB + dC*dC + dH*dH;
}
```

#### 3.5.2 Gradient (개선 방향)

```typescript
interface GradientDirection {
  axis: '🍞' | '🧀' | '🥓';
  direction: 'increase' | 'decrease';
  magnitude: number;
}

function calculateGradient(
  current: SandwichScore,
  canonical: SandwichScore
): GradientDirection[] {
  const deviation = calculateDeviation(current, canonical);

  const gradients: GradientDirection[] = [];

  // 가장 큰 편차부터 개선
  if (Math.abs(deviation.bread) > 0) {
    gradients.push({
      axis: '🍞',
      direction: deviation.bread > 0 ? 'decrease' : 'increase',
      magnitude: Math.abs(deviation.bread),
    });
  }
  if (Math.abs(deviation.cheese) > 0) {
    gradients.push({
      axis: '🧀',
      direction: deviation.cheese > 0 ? 'decrease' : 'increase',
      magnitude: Math.abs(deviation.cheese),
    });
  }
  if (Math.abs(deviation.ham) > 0) {
    gradients.push({
      axis: '🥓',
      direction: deviation.ham > 0 ? 'decrease' : 'increase',
      magnitude: Math.abs(deviation.ham),
    });
  }

  // 크기순 정렬
  return gradients.sort((a, b) => b.magnitude - a.magnitude);
}
```

---

## 4. 데이터 구조

### 4.1 핵심 타입

```typescript
// 축 타입
type Axis = '🍞' | '🧀' | '🥓';

// 모듈 타입
type ModuleType =
  | 'deploy'
  | 'api-external'
  | 'api-internal'
  | 'app'
  | 'lib-domain'
  | 'lib-infra';

// Simplex 상의 점
interface SandwichScore {
  bread: number;
  cheese: number;
  ham: number;
}

// 분석 결과
interface ModuleAnalysis {
  path: string;
  moduleType: ModuleType;

  // Raw scores (정규화 전)
  raw: {
    bread: RawBreadScore;
    cheese: RawCheeseScore;
    ham: RawHamScore;
  };

  // Simplex 점수
  current: SandwichScore;
  canonical: SandwichScore;
  deviation: Deviation;

  // 라벨링
  label: Axis;
  inEquilibrium: boolean;

  // 위반사항
  violations: Violation[];

  // 권장사항
  recommendations: Recommendation[];
}
```

### 4.2 Gate 결과 타입

```typescript
interface GateResult {
  gate: 'mvp' | 'production';
  passed: boolean;
  sandwichFormed: boolean;

  bread: {
    passed: boolean;
    trustBoundaryDefined: boolean;
    authFlowFixed: boolean;
    violations: string[];
  };

  cheese: {
    passed: boolean;
    maxCognitive: number;
    threshold: number;
    stateAsyncRetryViolations: string[];
  };

  ham: {
    passed: boolean;
    goldenTestCoverage: number;
    contractTestExists: boolean;
    criticalPathsProtected: string[];
    unprotectedPaths: string[];
  };
}
```

### 4.3 Change Budget 타입

```typescript
interface ChangeBudget {
  deltaCognitive: number;
  deltaStateTransitions: number;
  deltaPublicApi: number;
  breakingChangesAllowed: boolean;
}

interface BudgetCheckResult {
  passed: boolean;
  violations: {
    dimension: string;
    allowed: number;
    actual: number;
  }[];
}

const CHANGE_BUDGETS: Record<ModuleType, ChangeBudget> = {
  'deploy':       { deltaCognitive: 2,  deltaStateTransitions: 0, deltaPublicApi: 0, breakingChangesAllowed: false },
  'api-external': { deltaCognitive: 3,  deltaStateTransitions: 1, deltaPublicApi: 2, breakingChangesAllowed: false },
  'api-internal': { deltaCognitive: 5,  deltaStateTransitions: 2, deltaPublicApi: 3, breakingChangesAllowed: true },
  'app':          { deltaCognitive: 8,  deltaStateTransitions: 3, deltaPublicApi: 0, breakingChangesAllowed: true },
  'lib-domain':   { deltaCognitive: 5,  deltaStateTransitions: 2, deltaPublicApi: 5, breakingChangesAllowed: true },
  'lib-infra':    { deltaCognitive: 8,  deltaStateTransitions: 3, deltaPublicApi: 3, breakingChangesAllowed: true },
};
```

---

## 5. 인터페이스 설계

### 5.1 Public API

```typescript
// Core 분석
export function analyzeSandwich(path: string, options?: AnalyzeOptions): Promise<ModuleAnalysis>;

// Gate 검사
export function checkGate(path: string, gate: 'mvp' | 'production'): Promise<GateResult>;

// Budget 검사
export function checkBudget(baseBranch: string, headBranch: string): Promise<BudgetCheckResult>;

// 라벨링
export function getLabel(path: string): Promise<Axis>;

// 권장사항
export function suggestRefactor(path: string): Promise<Recommendation[]>;

// 인지 저하 탐지
export function checkDegradation(path: string): Promise<DegradationResult>;
```

### 5.2 MCP Tools

```typescript
const MCP_TOOLS = [
  {
    name: 'analyze_sandwich',
    description: '🍞🧀🥓 3축 복잡도 분석',
    parameters: { path: string, moduleType?: ModuleType },
  },
  {
    name: 'check_gate',
    description: 'MVP/Production gate 조건 검사',
    parameters: { path: string, gate: 'mvp' | 'production' },
  },
  {
    name: 'check_budget',
    description: 'PR 변경 예산 검사',
    parameters: { baseBranch: string, headBranch: string },
  },
  {
    name: 'get_label',
    description: '모듈의 지배 축 라벨 반환',
    parameters: { path: string },
  },
  {
    name: 'suggest_refactor',
    description: '균형 방향 리팩토링 제안',
    parameters: { path: string },
  },
  {
    name: 'check_degradation',
    description: '인지 저하 징후 탐지',
    parameters: { path: string },
  },
];
```

---

## 6. 참조

- [THEORY.ko.md](../THEORY.ko.md) - 이론적 토대
- [SRS.ko.md](./SRS.ko.md) - 요구사항 명세
- [MODULE_TYPES.ko.md](./MODULE_TYPES.ko.md) - 모듈 타입 분류 체계
- [REGULATORY_WEIGHTS.ko.md](./REGULATORY_WEIGHTS.ko.md) - 규제 기반 가중치

---

## 문서 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 1.0 | 2025-12-24 | 초기 설계 명세 작성 |
