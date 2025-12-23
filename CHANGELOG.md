# Changelog

---

## [0.0.2] - 예정

### 핵심 변경: 모듈 타입 기반 정준성(Canonicality) 프레임워크

v0.0.2는 **P-NP 문제의 모듈별 특수해**를 구하는 방향으로 설계됩니다.

#### 이론적 기반: 햄 샌드위치 정리

[위상수학의 햄 샌드위치 정리](https://en.wikipedia.org/wiki/Ham_sandwich_theorem)에서 착안:
> n차원 유클리드 공간에서 n개의 측정 가능한 객체가 주어지면, 단일 (n-1)차원 초평면으로 모든 객체를 동시에 이등분할 수 있다.

Borsuk-Ulam 정리로 증명됨: 연속 함수 f: Sⁿ → Rⁿ에 대해 f(x) = f(-x)인 점 x가 존재.

#### 대수적 위상수학 기반

McCabe 순환복잡도의 본질:
```
V(G) = E - N + 2P = dim H₁(G)
```
- 1차 베티 수(first Betti number)와 동형
- **"순환복잡도는 1차 구조만 보는 저차원적 불변량"**

호몰로지 확장:
| 확장 대상 | 의미 |
|----------|------|
| H₀ | 연결 컴포넌트 분리도 |
| H₁ | 조건 분기/루프 (기존 McCabe) |
| H₂ 이상 | 상태공간 + 제어 흐름 결합 구조 |

차원별 가중 복잡도 공식:
```
C = Σ(wₖ · Cₖ)
```
- Cₖ: k차원 복잡도
- wₖ: 차원 가중치

코드 품질 공간을 3개의 직교 축으로 분해:

```
┌─────────────────────────────────────────┐
│           햄 샌드위치 분해               │
├─────────────────────────────────────────┤
│  🍞 Bread (Security)                    │
│     구조 안정성, 보안 경계               │
│                                         │
│  🧀 Cheese (Context)                    │
│     맥락 밀도, 인지 복잡도               │
│                                         │
│  🥓 Ham (Behavior)                      │
│     행동 보존성, 유지보수성 균형          │
└─────────────────────────────────────────┘
```

슈페르너 정리 적용:
- 3색(🍞🧀🥓) 라벨링된 삼각분할에서 균형점(고정점) 존재
- 반복 필터링으로 이상적 형태(상위 0.1%)에 수렴 가능

#### P-NP 관점

코드 최적화의 NP-hard 문제들:

| 문제 | 복잡도 | 원인 |
|------|--------|------|
| 최적 모듈 분할 | NP-hard | 그래프 분할 |
| 순환 의존성 최소 제거 | NP-hard | Minimum Feedback Arc Set |
| 전역 최적 리팩토링 | NP-hard | 조합 폭발 |

**해결 접근**: 모듈 타입을 제약 조건으로 추가

```
일반 문제 (NP-hard) + 모듈 타입 제약 = 제약된 문제 (P)
```

SAT 문제와 동일한 구조:
- 일반 SAT: NP-complete
- 2-SAT, Horn-SAT: P (구조적 제약으로 인해)

각 모듈 타입이 **독립된 문제 클래스**가 되어, 해당 클래스 내에서 일반해가 존재합니다.

#### 모듈 타입 정의

```typescript
type ModuleType = 'api' | 'app' | 'lib' | 'deploy';
```

| 타입 | 역할 | 정준 특성 |
|------|------|-----------|
| `api` | 경계면 (internal/external) | 얇은 레이어, 무상태, 검증 집중 |
| `app` | 응용 로직 | 상태/비동기 허용, 격리됨 |
| `lib` | 재사용 라이브러리 | 순수 함수, 고응집, 저결합 |
| `deploy` | 배포 구성 | 선언적, 로직 최소 |

#### 메타 차원 (Meta Dimensions)

기존 5개 차원을 3개 상위 축(🍞🧀🥓)으로 집계:

| 메타 차원 | 구성 요소 | 의미 |
|-----------|----------|------|
| 🍞 **Security** | coupling + globalAccess + envDependency | 구조 안정성 |
| 🧀 **Context** | cognitive + nestingDepth + callbackDepth | 맥락 밀도 |
| 🥓 **Behavior** | state + async + sideEffects | 행동 보존성 |

#### 모듈별 정준형 (Canonical Profile)

```typescript
interface CanonicalProfile {
  type: ModuleType;
  ideal: {
    security: Range;
    context: Range;
    behavior: Range;
  };
}
```

| 타입 | Security | Context | Behavior |
|------|----------|---------|----------|
| `api` | 높음 | 낮음 | 낮음 |
| `app` | 중간 | 높음 (허용) | 높음 (허용) |
| `lib` | 낮음 | 낮음 | 낮음 |
| `deploy` | 높음 | 최저 | 최저 |

#### 수렴 분석 (Convergence Analysis)

```typescript
interface ConvergenceResult {
  moduleType: ModuleType;
  currentState: MetaDimensions;
  canonicalState: MetaDimensions;
  deviation: {
    security: number;
    context: number;
    behavior: number;
    total: number;  // L2 norm
  };
  convergenceVector: Vector3D;
  isStable: boolean;
}
```

**NP-hard가 P로 환원되는 이유**:
- 모든 가능한 구조를 탐색하지 않음
- 타입별 정준형으로의 거리만 측정
- 거리 측정: O(n)

#### Delta 분석 (Δ Analysis)

변경량 기반 품질 게이트:

```typescript
interface DeltaAnalysis {
  baseline: Snapshot;
  current: Snapshot;
  delta: MetaDimensions;
  exceedsThreshold: boolean;
  violations: Violation[];
}
```

#### 게이트 시스템

다단계 승인 워크플로우 연동:

| 게이트 | 담당 축 | 검증 내용 |
|--------|---------|----------|
| Dev | Context | 맥락 밀도 증가 제한 |
| QA | Behavior | 행동 변경 제한, 테스트 필수 |
| RA | Security | 보안 영향 평가 필수 |

### 추가되는 파일 구조

```
packages/core/src/
├── canonical/
│   ├── types.ts          # ModuleType, CanonicalProfile
│   ├── profiles.ts       # 모듈별 정준형 정의
│   ├── convergence.ts    # 수렴 분석기
│   └── index.ts
├── gates/
│   ├── types.ts          # Gate 타입
│   ├── delta.ts          # Δ 분석
│   └── index.ts
└── metrics/
    └── meta.ts           # 메타 차원 집계
```

### 기대 효과

1. **모듈별 일반해**: 각 타입 내에서 최적 구조로의 경로 제공
2. **Δ 기반 판단**: "나쁜 코드"가 아닌 "나빠지는 변경" 감지
3. **인지 분산**: 승인 단계별로 다른 축 담당
4. **해석자 독립성**: 사람/LLM/환경 무관 동일 판단

---

## [0.0.1] - 2024-12-23

### 초기 릴리스

다차원 코드 복잡도 분석기의 첫 번째 공개 버전.

### 패키지 구조

```
semantic-complexity-monorepo/
├── packages/
│   ├── core/     # semantic-complexity
│   ├── cli/      # semantic-complexity-cli
│   └── mcp/      # semantic-complexity-mcp
```

### 5개 복잡도 차원

| 차원 | 가중치 | 측정 항목 |
|------|--------|----------|
| 1D Control | ×1.0 | if, switch, loop, 논리연산자 |
| 2D Nesting | ×1.5 | 중첩 깊이, 콜백, 재귀 |
| 3D State | ×2.0 | 상태 변이, hooks, 상태 기계 |
| 4D Async | ×2.5 | async/await, Promise, 동시성 |
| 5D Coupling | ×3.0 | 전역 접근, I/O, 부수효과, 클로저 |

### Core API

```typescript
analyzeFilePath(filePath: string): FileAnalysisResult
analyzeSource(source: string): FileAnalysisResult
analyzeFunctionExtended(node, sourceFile): ExtendedComplexityResult
```

### CLI 명령어

```bash
semantic-complexity summary ./src
semantic-complexity analyze ./src -o report -f html
```

### MCP 도구

| 도구 | 설명 |
|------|------|
| `analyze_file` | 파일 복잡도 분석 |
| `analyze_function` | 함수 복잡도 분석 |
| `get_hotspots` | 핫스팟 검색 |
| `suggest_refactor` | 리팩토링 제안 |

### 기술 스택

- TypeScript 5.7+, Node.js 18+
- pnpm monorepo
- TypeScript Compiler API
- Vitest, ESLint 9

### 제한사항

- TypeScript/JavaScript 전용
- 정적 분석만 지원
