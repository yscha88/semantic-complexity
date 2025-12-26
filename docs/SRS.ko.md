# 소프트웨어 요구사항 명세서 (SRS)
# semantic-complexity v1.0

---

## 1. 서론

### 1.1 목적

본 문서는 **햄 샌드위치 정리 (🍞🧀🥓)**와 **슈페르너 정리**를 기반으로 한 다차원 코드 복잡도 분석 시스템 **semantic-complexity**의 소프트웨어 요구사항을 정의합니다.

시스템이 제공하는 것:
- 균형 잡힌 설계 지점의 **존재성 보장** (슈페르너)
- 균형점으로의 **수렴 경로** (Lyapunov)
- 점진적 리팩토링을 위한 **실용적 절차**

### 1.2 범위

semantic-complexity가 **아닌** 것:
- 단일 숫자 복잡도 메트릭
- 전역 최적화 도구
- 인간 판단의 대체물

semantic-complexity가 **맞는** 것:
- 3축 라벨링 시스템 (🍞🧀🥓)
- 국소적 변경 가이드 시스템
- PoC → MVP → Production 게이트 조건 검증기

### 1.3 용어 정의

| 용어 | 정의 |
|------|------|
| 🍞 빵 (Security) | 구조적 안정성: 인증, 암호화, 신뢰 경계, 규제 준수 |
| 🧀 치즈 (Cognitive) | 맥락 밀도: 중첩, state×async×retry, 숨은 결합 |
| 🥓 햄 (Behavioral) | 유지보수성 균형: 변경 가능성, 테스트 커버리지, 리팩토링 안전성 |
| Canonical Profile | 각 모듈 타입별 기대 🍞🧀🥓 비율 |
| Change Budget | 커밋/PR당 허용되는 각 차원의 델타 |
| Protected Zone | 수정 시 ADR + 리뷰가 필요한 파일들 |
| Simplex | 🍞🧀🥓 꼭짓점으로 이루어진 2-simplex (삼각형) |
| Equilibrium Point | 세 축이 모두 의미 있게 균형 잡힌 지점 |

### 1.4 참조 문헌

- McCabe, T. (1976). A Complexity Measure
- Huntsman, S. (2020). Generalizing cyclomatic complexity via path homology
- Miller, G. (1956). The Magical Number Seven, Plus or Minus Two (작업 기억 한계)
- 햄 샌드위치 정리 (Borsuk-Ulam)
- 슈페르너 정리

---

## 2. 시스템 개요

### 2.1 핵심 정리: 햄 샌드위치 (🍞🧀🥓)

```
유지보수성(🥓)은
보안 구조 안정성(🍞)과 맥락 밀도(🧀) 사이에서만
의미를 갖는다.

어느 하나만 극대화하면 시스템이 퇴화한다.
```

### 2.2 안정성 보장: 슈페르너 정리

```
적절한 경계 라벨링을 가진 세분화된 simplex에는
세 개의 라벨(🍞🧀🥓)을 모두 포함하는 완전 단체가
반드시 적어도 하나 존재한다.

공학적 해석:
각 축을 국소적으로 적절히 라벨링하면,
전역적으로 균형 잡힌 설계 지점이 반드시 존재한다.
```

### 2.3 수렴: Lyapunov 안정성

```
에너지 함수:  E(v) = vᵀMv + ⟨v,w⟩
안정점:       ∂E/∂v = 0 (canonical centroid)
안정성:       M ≥ 0 (positive semidefinite)

E(v)를 감소시키는 모든 리팩토링은 안정 방향으로 이동한다.
```

### 2.4 아키텍처 다이어그램

```
                    ┌─────────────────────────────────────┐
                    │         semantic-complexity          │
                    └─────────────────────────────────────┘
                                     │
            ┌────────────────────────┼────────────────────────┐
            │                        │                        │
            ▼                        ▼                        ▼
    ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
    │   🍞 Security  │       │  🧀 Cognitive  │       │ 🥓 Behavioral  │
    │    Analyzer    │       │    Analyzer    │       │   Analyzer    │
    └───────────────┘       └───────────────┘       └───────────────┘
            │                        │                        │
            └────────────────────────┼────────────────────────┘
                                     │
                                     ▼
                    ┌─────────────────────────────────────┐
                    │        Simplex Coordinator          │
                    │      (라벨링 + 균형점 탐색)          │
                    └─────────────────────────────────────┘
                                     │
            ┌────────────────────────┼────────────────────────┐
            │                        │                        │
            ▼                        ▼                        ▼
    ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
    │  Gate System  │       │ Change Budget │       │  Recommender  │
    │  (PoC→MVP)    │       │    Tracker    │       │  (Gradient)   │
    └───────────────┘       └───────────────┘       └───────────────┘
```

---

## 3. 기능 요구사항

### 3.1 3축 분석 시스템

#### FR-3.1.1 보안 축 (🍞) 분석

**입력:** 소스 코드, 설정 파일, 배포 매니페스트

**출력:** 보안 안정성 점수 및 위반 사항

**요구사항:**

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR-3.1.1.1 | 신뢰 경계 정의 탐지 | MUST |
| FR-3.1.1.2 | 인증/인가 흐름 패턴 식별 | MUST |
| FR-3.1.1.3 | 시크릿/자격증명 패턴 탐지 | MUST |
| FR-3.1.1.4 | 암호화 사용 패턴 식별 | SHOULD |
| FR-3.1.1.5 | 보안 변경의 blast radius 계산 | SHOULD |
| FR-3.1.1.6 | 규제 민감 코드 영역 탐지 | MAY |

**메트릭:**
- Trust boundary 수
- 인증 레이어 명시성 점수
- Secret lifecycle 자동화 점수
- 보안 변경 blast radius

#### FR-3.1.2 인지 축 (🧀) 분석

**입력:** 소스 코드 AST

**출력:** 인지 가능 여부 판정 결과

**핵심 정의:**

```
🧀 Cheese = 사람과 LLM이 인지할 수 있는 범위 내에 있는가?
```

**인지 가능 조건 (모두 충족해야 함):**

| 조건 | 기준 | 근거 |
|------|------|------|
| 중첩 깊이 | ≤ N (설정 가능) | 한눈에 구조 파악 |
| 개념 수 | ≤ 5개/함수 | 작업 기억 한계 |
| 숨겨진 의존성 | 최소화 | 컨텍스트 완결성 |
| state×async×retry | 2개 이상 공존 금지 | 동시 추론 불가 |

**요구사항:**

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR-3.1.2.1 | 인지 가능 여부 판정 (4가지 조건) | MUST |
| FR-3.1.2.2 | state×async×retry 동시 존재 탐지 | MUST |
| FR-3.1.2.3 | 숨겨진 의존성 탐지 (전역, 환경변수, 암묵적 I/O, 클로저) | MUST |
| FR-3.1.2.4 | 중첩 깊이 측정 | MUST |
| FR-3.1.2.5 | 함수당 개념 수 계산 (> 5 = 위반) | MUST |

**출력:**
- 인지 가능 여부 (Boolean)
- 위반 시 사유
- 각 조건별 측정값

#### FR-3.1.3 행동 축 (🥓) 분석

**입력:** 소스 코드, 테스트 파일, git 히스토리

**출력:** 유지보수성 균형 점수

**요구사항:**

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR-3.1.3.1 | 핵심 경로에 대한 golden test 존재 탐지 | MUST |
| FR-3.1.3.2 | API에 대한 contract test 존재 탐지 | MUST |
| FR-3.1.3.3 | 핵심 경로 테스트 커버리지 계산 | SHOULD |
| FR-3.1.3.4 | git 히스토리에서 변경 리드타임 분석 | MAY |
| FR-3.1.3.5 | 결함 유입률 분석 | MAY |
| FR-3.1.3.6 | PR 크기 패턴 탐지 | MAY |

**메트릭:**
- Golden test 커버리지 비율
- Contract test 존재 플래그
- 핵심 경로 보호 비율
- 변경 리드타임 (git 기반)
- 결함 유입률 (git 기반)

### 3.2 모듈 타입 분류

#### FR-3.2.1 주요 모듈 타입

| 타입 | 설명 | 기본 🍞🧀🥓 비율 |
|------|------|------------------|
| `deploy` | K8s, Helm, ArgoCD, secrets, network policy | 70 / 10 / 20 |
| `api-external` | 고객/3rd-party 대면, 계약 구속 | 50 / 20 / 30 |
| `api-internal` | 서비스간 통신, 내부 안정성 | 30 / 30 / 40 |
| `app` | 워크플로우, 오케스트레이션, 상태 머신 | 20 / 50 / 30 |
| `lib-domain` | 순수 도메인 로직, 규칙, 검증 | 10 / 30 / 60 |
| `lib-infra` | 공통 클라이언트, 미들웨어, 유틸리티 | 20 / 30 / 50 |

#### FR-3.2.2 모듈 타입 탐지

**요구사항:**

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR-3.2.2.1 | 파일 경로 패턴에서 모듈 타입 자동 탐지 | MUST |
| FR-3.2.2.2 | 설정을 통한 수동 오버라이드 허용 | MUST |
| FR-3.2.2.3 | 커스텀 비율을 가진 커스텀 모듈 타입 지원 | SHOULD |

### 3.3 Canonical Profile 시스템

#### FR-3.3.1 프로파일 정의

각 모듈 타입은 다음을 정의하는 canonical profile을 가짐:

```typescript
interface CanonicalProfile {
  moduleType: ModuleType;

  // 기대 🍞🧀🥓 비율 (합계 100)
  bread: number;    // Security 가중치
  cheese: number;   // Cognitive 가중치
  ham: number;      // Behavioral 가중치

  // 각 축의 임계값
  thresholds: {
    bread: { min: number; max: number };
    cheese: { min: number; max: number };
    ham: { min: number; max: number };
  };

  // PR당 변경 예산
  changeBudget: {
    deltaCognitive: number;
    deltaStateTransitions: number;
    deltaPublicApi: number;
    breakingChangesAllowed: boolean;
  };
}
```

#### FR-3.3.2 편차 분석

**요구사항:**

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR-3.3.2.1 | 모듈의 현재 🍞🧀🥓 비율 계산 | MUST |
| FR-3.3.2.2 | canonical profile과 비교 | MUST |
| FR-3.3.2.3 | 어떤 축이 과다/과소인지 식별 | MUST |
| FR-3.3.2.4 | canonical centroid까지의 거리 계산 | SHOULD |
| FR-3.3.2.5 | 균형점으로 이동할 방향 제안 | MUST |

### 3.4 Simplex 라벨링 시스템

#### FR-3.4.1 모듈/PR 라벨링

**요구사항:**

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR-3.4.1.1 | 각 모듈에 우세 라벨 (🍞/🧀/🥓) 부여 | MUST |
| FR-3.4.1.2 | 변경 기반으로 각 PR에 우세 라벨 부여 | MUST |
| FR-3.4.1.3 | 코드베이스 전체의 라벨 분포 추적 | SHOULD |

**라벨링 규칙:**

```
🍞 라벨: 보안 제약이 우세
  - 인증/인가 변경
  - 암호화 변경
  - 신뢰 경계 수정
  - 규제 민감 코드

🧀 라벨: 맥락 밀도가 우세
  - 높은 cognitive complexity
  - State×async×retry 동시 존재
  - 숨은 결합 증가

🥓 라벨: 유지보수성이 우세
  - 리팩토링 PR
  - 테스트 추가
  - API surface 변경
  - 문서화
```

#### FR-3.4.2 균형점 탐지

**요구사항:**

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR-3.4.2.1 | 모듈이 균형 영역에 있는지 탐지 | MUST |
| FR-3.4.2.2 | 코드베이스에 🍞🧀🥓 완전 simplex가 있는지 탐지 | SHOULD |
| FR-3.4.2.3 | 균형점 방향의 gradient 제공 | MUST |

### 3.5 게이트 시스템

#### FR-3.5.1 MVP 진입 게이트

**요구사항:**

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR-3.5.1.1 | 🍞 체크: Trust boundary 명시적 정의 | MUST |
| FR-3.5.1.2 | 🍞 체크: 인증/인가 흐름 고정 | MUST |
| FR-3.5.1.3 | 🧀 체크: 핵심 모듈 cognitive 임계값 미만 | MUST |
| FR-3.5.1.4 | 🧀 체크: state×async×retry 위반 없음 | MUST |
| FR-3.5.1.5 | 🥓 체크: 핵심 플로우에 Golden test 존재 | MUST |
| FR-3.5.1.6 | 하나라도 실패 시 "샌드위치 미형성" 반환 | MUST |

**게이트 결과:**

```typescript
interface GateResult {
  canEnterMvp: boolean;

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
    criticalPathsProtected: string[];
    unprotectedPaths: string[];
  };

  sandwichFormed: boolean;
}
```

#### FR-3.5.2 PR 게이트

**요구사항:**

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR-3.5.2.1 | PR의 change budget 체크 | MUST |
| FR-3.5.2.2 | 보호구역 수정 탐지 | MUST |
| FR-3.5.2.3 | 🍞 변경 시 ADR 요구 | MUST |
| FR-3.5.2.4 | 🥓 행동 변경은 단일 목적 요구 | SHOULD |
| FR-3.5.2.5 | 🧀 감소 PR은 자유롭게 허용 | MUST |

### 3.6 Change Budget 시스템

#### FR-3.6.1 예산 정의

| 모듈 타입 | ΔCognitive | ΔState | ΔPublicAPI | Breaking |
|----------|------------|--------|------------|----------|
| api-external | ≤ 3 | ≤ 1 | ≤ 2 | NO |
| api-internal | ≤ 5 | ≤ 2 | ≤ 3 | ADR 필요 |
| app | ≤ 8 | ≤ 3 | N/A | N/A |
| lib-domain | ≤ 5 | ≤ 2 | ≤ 5 | ADR 필요 |
| lib-infra | ≤ 8 | ≤ 3 | ≤ 3 | ADR 필요 |
| deploy | ≤ 2 | N/A | N/A | ADR + 보안 리뷰 |

#### FR-3.6.2 예산 추적

**요구사항:**

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR-3.6.2.1 | PR당 각 축의 delta 계산 | MUST |
| FR-3.6.2.2 | 모듈 타입 예산과 비교 | MUST |
| FR-3.6.2.3 | 예산 위반 보고 | MUST |
| FR-3.6.2.4 | 시간에 따른 누적 예산 추적 | MAY |

### 3.7 보호구역 시스템

#### FR-3.7.1 영역 정의

**Deploy Repository 보호구역:**
- `*/rbac/*`
- `*/network-policy/*`
- `*/ingress/*`
- `*/tls/*`
- `*/secrets/*`
- `*/sealed-secrets/*`

**Source Repository 보호구역:**
- `*/auth/*`, `*/authn/*`, `*/authz/*`
- `*/crypto/*`, `*/encryption/*`
- `*/patient-data/*`, `*/phi/*`, `*/pii/*`
- `*/audit/*`, `*/logging/audit*`

#### FR-3.7.2 영역 강제

**요구사항:**

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR-3.7.2.1 | 보호구역 수정 탐지 | MUST |
| FR-3.7.2.2 | 보호구역 변경 시 ADR 참조 요구 | MUST |
| FR-3.7.2.3 | 추가 테스트 증거 요구 | SHOULD |
| FR-3.7.2.4 | 커스텀 보호구역 패턴 지원 | MUST |

### 3.8 인지기능저하 탐지

#### FR-3.8.1 저하 체크리스트

다음 조건 중 **2개 이상** 충족 시 인지기능저하 탐지:

| # | 조건 | 탐지 방법 |
|---|------|----------|
| 1 | 암묵적 컨텍스트 의존 ≥ 2개 | 숨은 결합 분석 |
| 2 | state×async×retry 동시 존재 | AST 패턴 탐지 |
| 3 | PR이 핵심 파일 ≥ 25개 수정 | Git diff 분석 |
| 4 | golden/contract test 부재 | 테스트 파일 탐지 |
| 5 | 행동 설명 어려움 | (수동 플래그) |
| 6 | 온보딩 30분 내 설명 불가 | (수동 플래그) |

**요구사항:**

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR-3.8.1.1 | 자동화 가능한 조건 (1-4) 체크 | MUST |
| FR-3.8.1.2 | 위반 수 카운트 및 ≥ 2 임계값 | MUST |
| FR-3.8.1.3 | 저하 구역 상태 보고 | MUST |
| FR-3.8.1.4 | 조건 5-6에 대한 수동 플래그 지원 | MAY |

### 3.9 추천 시스템

#### FR-3.9.1 Gradient 기반 추천

**요구사항:**

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| FR-3.9.1.1 | 균형점 방향의 gradient 계산 | MUST |
| FR-3.9.1.2 | 구체적 리팩토링 액션 제안 | MUST |
| FR-3.9.1.3 | 예상 영향으로 우선순위 지정 | SHOULD |
| FR-3.9.1.4 | 모듈 타입 제약 준수 | MUST |

**추천 형식:**

```typescript
interface Recommendation {
  axis: '🍞' | '🧀' | '🥓';
  priority: number;
  action: string;
  expectedImpact: {
    deltaBread: number;
    deltaCheese: number;
    deltaHam: number;
  };
  targetEquilibrium: boolean;
}
```

---

## 4. 비기능 요구사항

### 4.1 성능

| ID | 요구사항 | 목표 |
|----|----------|------|
| NFR-4.1.1 | 단일 파일 분석 | < 100ms |
| NFR-4.1.2 | 전체 프로젝트 분석 (1000 파일) | < 30s |
| NFR-4.1.3 | PR delta 분석 | < 5s |

### 4.2 정확도

| ID | 요구사항 | 목표 |
|----|----------|------|
| NFR-4.2.1 | 인지 가능 조건 판정 정확도 | 95% |
| NFR-4.2.2 | 모듈 타입 자동 탐지 정확도 | 90% |
| NFR-4.2.3 | 위반 false positive 비율 | < 10% |

### 4.3 확장성

| ID | 요구사항 |
|----|----------|
| NFR-4.3.1 | 커스텀 모듈 타입 지원 |
| NFR-4.3.2 | 커스텀 canonical profile 지원 |
| NFR-4.3.3 | 커스텀 보호구역 패턴 지원 |
| NFR-4.3.4 | 새 분석기를 위한 플러그인 아키텍처 |

### 4.4 언어 지원

| ID | 요구사항 | 우선순위 |
|----|----------|----------|
| NFR-4.4.1 | TypeScript/JavaScript | MUST |
| NFR-4.4.2 | Python | MUST |
| NFR-4.4.3 | Go | MUST |
| NFR-4.4.4 | LSP를 통한 기타 언어 | MAY |

---

## 5. 인터페이스 요구사항

### 5.1 CLI 인터페이스

```bash
# 🍞🧀🥓 출력으로 분석
semantic-complexity analyze ./src --format sandwich

# MVP 게이트 체크
semantic-complexity gate mvp ./src

# PR 예산 체크
semantic-complexity budget ./src --base main --head feature

# 모듈 라벨링
semantic-complexity label ./src/auth
```

### 5.2 MCP (Model Context Protocol) 인터페이스

```typescript
// 도구들
- analyze_sandwich(path, moduleType)
- check_gate(path, gateType)
- check_budget(baseBranch, headBranch)
- get_label(path)
- suggest_refactor(path)
- check_degradation(path)
```

### 5.3 출력 형식

#### 5.3.1 Sandwich 형식

```json
{
  "module": "src/auth",
  "moduleType": "api-external",
  "sandwich": {
    "bread": 45,
    "cheese": 25,
    "ham": 30,
    "canonical": { "bread": 50, "cheese": 20, "ham": 30 },
    "deviation": { "bread": -5, "cheese": +5, "ham": 0 },
    "label": "🧀",
    "inEquilibrium": false
  },
  "recommendations": [
    {
      "axis": "🧀",
      "action": "상태 머신을 별도 모듈로 추출",
      "expectedImpact": { "cheese": -8 }
    }
  ]
}
```

#### 5.3.2 Gate 형식

```json
{
  "gate": "mvp",
  "passed": false,
  "sandwichFormed": false,
  "axes": {
    "bread": { "passed": true, "details": "..." },
    "cheese": { "passed": false, "violations": ["OrderService에 state×async×retry 존재"] },
    "ham": { "passed": true, "details": "..." }
  }
}
```

---

## 6. 데이터 모델

### 6.1 핵심 타입

```typescript
type Axis = '🍞' | '🧀' | '🥓';

type ModuleType =
  | 'deploy'
  | 'api-external'
  | 'api-internal'
  | 'app'
  | 'lib-domain'
  | 'lib-infra';

interface SandwichScore {
  bread: number;      // 0-100
  cheese: number;     // 0-100
  ham: number;        // 0-100
  // bread + cheese + ham = 100
}

interface CanonicalProfile {
  moduleType: ModuleType;
  canonical: SandwichScore;
  thresholds: Record<Axis, { min: number; max: number }>;
  changeBudget: ChangeBudget;
}

interface ModuleAnalysis {
  path: string;
  moduleType: ModuleType;
  current: SandwichScore;
  canonical: SandwichScore;
  deviation: SandwichScore;
  label: Axis;
  inEquilibrium: boolean;
  violations: Violation[];
  recommendations: Recommendation[];
}
```

### 6.2 불변조건 타입

```typescript
interface CognitiveInvariant {
  // state × async × retry는 공존 불가
  hasState: boolean;
  hasAsync: boolean;
  hasRetry: boolean;
  violated: boolean;
}

interface HiddenCoupling {
  globalAccess: string[];
  implicitIO: string[];
  envDependency: string[];
  closureCaptures: string[];
  total: number;
  threshold: number;
  violated: boolean;
}
```

---

## 7. 제약사항

### 7.1 수학적 제약

1. **Simplex 제약**: bread + cheese + ham = 100
2. **비음수성**: 모든 축 ≥ 0
3. **슈페르너 조건**: 경계 라벨링이 일관성 있어야 함

### 7.2 공학적 제약

1. **인지 불변조건**: state × async × retry는 같은 함수/모듈에 공존 불가
2. **보호구역**: 변경 시 ADR + 증거 필요
3. **Change Budget**: 델타가 모듈 타입 한도를 초과하면 안 됨

### 7.3 구현 제약

1. 🧀 축은 인지 가능 여부 4가지 조건으로 판정
2. 점진적 분석 지원 필수 (PR 수준)
3. delta 분석을 위해 git과 통합 필수

---

## 8. 부록

### A. 인지 가능 조건 (🧀)

```
🧀 Cheese = 사람과 LLM이 인지할 수 있는 범위 내에 있는가?

인지 가능 조건 (모두 충족):
┌─────────────────────────────────────────────────────────────┐
│ 1. 중첩 깊이 ≤ N        - 한눈에 구조 파악 가능             │
│ 2. 개념 수 ≤ 5/함수      - 작업 기억(Working Memory) 한계   │
│ 3. 숨겨진 의존성 최소    - 컨텍스트 완결성                  │
│ 4. state×async×retry    - 2개 이상 공존 금지 (동시 추론 불가)│
└─────────────────────────────────────────────────────────────┘

위반 시 → 인지 불가 (🧀 실패)
```

### B. 슈페르너 정리 적용

```
2-Simplex: 🍞, 🧀, 🥓 꼭짓점을 가진 삼각형

세분화: 각 모듈/PR이 부분 삼각형

라벨링: 각 부분 삼각형 꼭짓점에 우세 축 라벨

정리: 세 라벨을 모두 포함하는 부분 삼각형이 적어도 하나 존재

공학: 균형 잡힌 설계 지점이 반드시 존재
```

### C. 모듈 타입 탐지 패턴

```typescript
const MODULE_PATTERNS = {
  'deploy': [
    '**/k8s/**', '**/helm/**', '**/deploy/**',
    '**/manifests/**', '**/.github/workflows/**'
  ],
  'api-external': [
    '**/api/external/**', '**/api/public/**',
    '**/routes/v*/**'
  ],
  'api-internal': [
    '**/api/internal/**', '**/grpc/**',
    '**/events/**'
  ],
  'app': [
    '**/app/**', '**/services/**',
    '**/workflows/**', '**/jobs/**'
  ],
  'lib-domain': [
    '**/domain/**', '**/models/**',
    '**/rules/**', '**/validators/**'
  ],
  'lib-infra': [
    '**/lib/**', '**/utils/**',
    '**/common/**', '**/shared/**'
  ]
};
```

---

## 문서 이력

| 버전 | 날짜         | 작성자 | 변경사항 |
|------|------------|--------|----------|
| 1.0 | 2025-12-24 | semantic-complexity team | 이론적 토대 기반 초기 SRS |
