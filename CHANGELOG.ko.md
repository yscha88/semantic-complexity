# Changelog

[English](./CHANGELOG.md) | 한국어

---

## [0.0.6] - 2024-12-23

### MCP 도구 통합 & LLM 최적화 설명

#### 도구 통합 (9개 → 6개)

| 이전 | 이후 | 변경 |
|------|------|------|
| `compare_mccabe_dimensional` | → `analyze_function` | 통합 (comparison 필드) |
| `get_dimension_breakdown` | → `analyze_function` | 통합 (dimensions 필드) |
| `infer_module_type` | → `validate_complexity` | 통합 |
| `check_canonical` | → `validate_complexity` | 통합 |

**통합된 6개 도구:**
1. `get_hotspots` - [진입점] 복잡도 핫스팟 검색
2. `analyze_file` - 파일 수준 분석
3. `analyze_function` - 함수 심층 분석 (breakdown + comparison 포함)
4. `suggest_refactor` - 리팩토링 제안
5. `generate_graph` - 의존성/호출 그래프 시각화
6. `validate_complexity` - Canonical 경계 검증 (모듈 타입 추론 포함)

#### LLM 최적화 도구 설명

자율적 도구 선택을 위한 상황별 사용 힌트 추가:
```
USE THIS FIRST when user mentions:
- "refactoring", "리팩토링", "개선"
- "code quality", "코드 품질"
- "what should I improve?", "뭐 고쳐야 해?"
```

---

## [0.0.5] - 2024-12-23

### 빌드 & 보안 수정

#### 빌드
- 순차 빌드: core → cli/mcp (병렬)
- core 빌드 전 cli/mcp가 import 시도하던 CI 빌드 실패 수정

#### 보안
- Go 1.22 → 1.23 (CVE-2024-45336, CVE-2024-45341 수정)

#### CI
- Go 태그 버전 동적화 (하드코딩 `go/v0.0.1` 제거)

---

## [0.0.4] - 2024-12-23

### Go 지원, 테스트 확장 & 새 MCP 도구

#### 테스트 커버리지 확장

| 패키지 | 테스트 수 | 커버리지 |
|--------|----------|----------|
| npm | 119 | - |
| Python | 154 | 96% |
| Go | 94 | - |
| **합계** | **367** | - |

- Go: 94개 테스트 (analyzer, tensor, canonical, scoring)
- Python CLI: 33개 신규 테스트 (0% → 96% 커버리지)
- Cross-language 호환성 테스트 (TS/Python/Go)

#### 보안

- esbuild CVE 수정 (vitest 2.x → 4.x 업그레이드)

#### 문서화

- 패키지별 README 추가 (cli, core, mcp)
- 한글 문서 추가 (README.ko.md, CHANGELOG.ko.md)

#### CDR 기반 이중 지표

[Clinical Dementia Rating (CDR)](https://knightadrc.wustl.edu/professionals-clinicians/cdr-dementia-staging-instrument/)에서 영감을 받은 두 가지 보완적 지표:

| 지표 | CDR 대응 | 계산 | 용도 |
|------|----------|------|------|
| **Tensor Score** | CDR Global | `vᵀMv + ⟨v,w⟩ + ε‖v‖²` | 단계 분류 |
| **Raw Sum** | CDR-SOB | `C + N + S + A + Λ` | 변화 추적 |

- `rawSum`: 복잡도 도메인의 단순 합 (C + N + S + A + Λ)
- `rawSumThreshold`: Canonical profile 상한 합계
- `rawSumRatio`: `rawSum / rawSumThreshold` (0-0.7: 안전, 0.7-1.0: 검토, >1.0: 위반)

#### MCP 크로스 플랫폼 지원

- 크로스 플랫폼 Python 명령어 fallback (`python3` / `python` / `py`)
- Linux, Mac, Windows 모두 지원

#### Go 언어 지원

- Go AST 기반 분석기
- MCP 서버 `.go` 파일 자동 감지
- Go 코드 전체 복잡도 도메인 분석

---

## [0.0.3] - 2024-12-23

### 2차 Tensor Framework

수학적 기반을 확장하여 차원 간 상호작용을 포착하는 2차 텐서 분석 도입.

#### 핵심 변경

**Second-Order Tensor**
```
score = vᵀMv + ⟨v,w⟩ + ε‖v‖²

v = [Control, Nesting, State, Async, Coupling] ∈ ℝ⁵
M = 5×5 Interaction Matrix (모듈 타입별)
ε = Regularization parameter
```

**ε-Regularization**
- Hard boundary(threshold=10)에서의 수렴 불안정 해결
- Banach fixed-point theorem 적용으로 수렴 보장
- Convergence score: `(current - target) / ε`

**Hodge Decomposition**
```
H^{2,0} (algorithmic)  : Control + Nesting
H^{1,1} (balanced)     : Async
H^{0,2} (architectural): State + Coupling
```

#### 모듈 타입 확장: 8개

| 타입 | 역할 | 특성 |
|------|------|------|
| `api` | REST/GraphQL endpoints | C:low, Λ:low |
| `lib` | 순수 함수, 유틸리티 | C:med, S:low |
| `app` | 비즈니스 로직 | S:med, A:med |
| `web` | UI 컴포넌트 | N:high |
| `data` | 엔티티, 스키마, DTO | S:high, Λ:med |
| `infra` | Repository, DB/IO | A:high, Λ:high |
| `deploy` | 설정, 인프라 | all:low |
| `unknown` | 미분류 | permissive |

#### MCP 서버

- 자동 언어 감지 (TypeScript/JavaScript + Python)
- 6개 도구 모두 Python 지원
- `language` 필터 파라미터 추가

#### Python 패키지

`semantic-complexity` PyPI 패키지 추가:
- Python 3.10+ 지원
- AST 기반 분석기
- CLI 도구 포함

#### 새 파일

```
packages/core/src/tensor/
├── types.ts      # Vector5D, TensorScore, etc.
├── matrix.ts     # InteractionMatrix, MODULE_MATRICES
├── scoring.ts    # calculateTensorScore, hodgeDecomposition
├── canonical.ts  # CANONICAL_5D_PROFILES
└── index.ts

py/semantic_complexity/core/
├── tensor.py      # ModuleType, Vector5D, InteractionMatrix
├── convergence.py # ConvergenceResult, analyze_convergence
└── canonical.py   # CanonicalProfile, HodgeDecomposition
```

---

## [0.0.2] - 2024-12-23

### Canonical Profiles & Meta-dimensions

모듈 타입 기반 정준성(Canonicality) 프레임워크 도입.

#### 핵심 변경

**모듈 타입별 정준형**
```typescript
type ModuleType = 'api' | 'app' | 'lib' | 'deploy';

Φ: ModuleType → CanonicalProfile
```

**메타 차원 (Ham Sandwich)**
| 축 | 구성 | 의미 |
|----|------|------|
| 🍞 Security | coupling + globalAccess | 구조 안정성 |
| 🧀 Context | cognitive + nesting | 맥락 밀도 |
| 🥓 Behavior | state + async | 행동 보존성 |

**수렴 분석**
- 현재 상태 → 정준형까지의 거리 측정
- Deviation metric: L2 norm

**Delta 게이트**
- 변경량 기반 품질 검증
- Dev/QA/RA 단계별 게이트

#### 새 파일

```
packages/core/src/
├── canonical/
│   ├── types.ts
│   ├── profiles.ts
│   └── convergence.ts
└── gates/
    ├── types.ts
    └── delta.ts
```

---

## [0.0.1] - 2024-12-23

### 초기 릴리스

다차원 코드 복잡도 분석기의 첫 번째 공개 버전.

#### 복잡도 도메인

| 도메인 | 가중치 | 측정 항목 |
|------|--------|----------|
| Control (C) | ×1.0 | if, switch, loop, 논리연산자 |
| Nesting (N) | ×1.5 | 중첩 깊이, 콜백 |
| State (S) | ×2.0 | 상태 변이, hooks |
| Async (A) | ×2.5 | async/await, Promise |
| Coupling (Λ) | ×3.0 | 전역 접근, I/O, 부수효과 |

#### 패키지 구조

```
semantic-complexity-monorepo/
├── packages/
│   ├── core/     # semantic-complexity (npm)
│   ├── cli/      # semantic-complexity-cli
│   └── mcp/      # semantic-complexity-mcp
```

#### Core API

```typescript
analyzeFilePath(filePath: string): FileAnalysisResult
analyzeSource(source: string): FileAnalysisResult
analyzeFunctionExtended(node, sourceFile): ExtendedComplexityResult
```

#### CLI 명령어

```bash
semantic-complexity summary ./src
semantic-complexity analyze ./src -o report -f html
```

#### MCP 도구

| 도구 | 설명 |
|------|------|
| `analyze_file` | 파일 복잡도 분석 |
| `analyze_function` | 함수 복잡도 분석 |
| `get_hotspots` | 핫스팟 검색 |
| `suggest_refactor` | 리팩토링 제안 |

---
