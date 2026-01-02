# Changelog

---

## [0.0.15] - 2026-01-02

### 다국어 기능 동기화

Python, TypeScript, Go 세 언어의 MCP 도구와 기능을 동기화합니다.

#### 🔧 TypeScript 기능 확장

**외부 .waiver.json 지원 추가:**
- `parseWaiverFile()` - JSON 파싱
- `findWaiverFile()` - 상위 디렉토리 탐색
- `matchFilePattern()` - 글롭 패턴 매칭
- `isWaiverExpired()` - 만료 체크
- `checkExternalWaiver()` - 외부 waiver 체크
- `checkWaiver()` - 통합 API (외부 우선, 인라인 폴백)

**MCP 도구 추가 (Python과 동기화):**
- `suggest_refactor` - 리팩토링 권장사항
- `check_budget` - PR 변경 예산 검사
- `get_label` - 지배 축 라벨
- `check_degradation` - 인지 저하 탐지

#### 🆕 Go 구현 신규 추가

Go 언어로 semantic-complexity를 새로 구현:

**패키지 구조:**
```
src/go/
├── cmd/mcp/         # MCP 서버 진입점
├── pkg/analyzer/    # Bread, Cheese, Ham 분석기
├── pkg/gate/        # Gate 및 Waiver 시스템
├── pkg/simplex/     # 정규화 및 균형 계산
└── pkg/types/       # 공통 타입 정의
```

**MCP 도구 (Python/TypeScript와 동일):**
- `analyze_sandwich` - 3축 복잡도 분석
- `check_gate` - Gate 검사 (waiver 포함)
- `analyze_cheese` - 인지 가능성 분석
- `suggest_refactor` - 리팩토링 권장사항
- `check_budget` - PR 변경 예산 검사
- `get_label` - 지배 축 라벨
- `check_degradation` - 인지 저하 탐지

#### 🔄 MCP 도구 출력 형식 동기화

모든 언어에서 동일한 출력 형식을 보장:

**`analyze_sandwich` 출력 확장:**
```json
{
  "bread": { ... },
  "cheese": { ... },
  "ham": { ... },
  "simplex": { "bread": 0.33, "cheese": 0.34, "ham": 0.33 },
  "equilibrium": { "inEquilibrium": true, "energy": 0.01 },
  "label": "balanced",
  "confidence": 0.95,
  "canonical": { "bread": 0.33, "cheese": 0.34, "ham": 0.33 },
  "deviation": { "bread": 0.0, "cheese": 0.0, "ham": 0.0 },
  "recommendations": []
}
```

**`check_gate` 구조 통일:**
```json
{
  "passed": true,
  "gateType": "mvp",
  "violations": [],
  "waiverApplied": false
}
```

**`check_degradation` delta 객체:**
```json
{
  "degraded": false,
  "severity": "none",
  "indicators": [],
  "beforeAccessible": true,
  "afterAccessible": true,
  "delta": {
    "nesting": 0,
    "hiddenDeps": 0,
    "violations": 0
  }
}
```

#### 🔤 JSON 필드명 케이스 통일 (camelCase)

Go의 모든 JSON 태그를 TypeScript와 일치하도록 camelCase로 통일:

| 타입 | 변경 전 (snake_case) | 변경 후 (camelCase) |
|------|---------------------|---------------------|
| CheeseResult | `max_nesting` | `maxNesting` |
| | `hidden_dependencies` | `hiddenDependencies` |
| | `state_async_retry` | `stateAsyncRetry` |
| StateAsyncRetry | `has_state/async/retry` | `hasState/Async/Retry` |
| EquilibriumResult | `in_equilibrium` | `inEquilibrium` |
| | `dominant_axis` | `dominantAxis` |
| GateResult | `gate_type` | `gateType` |
| | `waiver_applied` | `waiverApplied` |
| BreadResult | `trust_boundary_count` | `trustBoundaryCount` |
| | `auth_explicitness` | `authExplicitness` |
| | `secret_patterns` | `secretPatterns` |
| HamResult | `golden_test_coverage` | `goldenTestCoverage` |
| | `unprotected_paths` | `unprotectedPaths` |
| | `test_files_found` | `testFilesFound` |
| Recommendation | `expected_impact` | `expectedImpact` |
| | `target_equilibrium` | `targetEquilibrium` |
| BudgetResult | `module_type` | `moduleType` |
| Delta | `state_transitions` | `stateTransitions` |
| | `public_api` | `publicAPI` |
| | `breaking_changes` | `breakingChanges` |

#### 📁 Go 패키지 구조 완성

```
src/go/pkg/gate/
├── gate.go    # CheckGate, GetThresholds, GateViolation (신규)
└── waiver.go  # CheckWaiver, 외부 .waiver.json 지원
```

#### 📊 언어별 기능 매트릭스

| 기능 | Python | TypeScript | Go |
|------|--------|------------|-----|
| analyze_sandwich | ✅ | ✅ | ✅ |
| analyze_cheese | ✅ | ✅ | ✅ |
| check_gate | ✅ | ✅ | ✅ |
| suggest_refactor | ✅ | ✅ | ✅ |
| check_budget | ✅ | ✅ | ✅ |
| get_label | ✅ | ✅ | ✅ |
| check_degradation | ✅ | ✅ | ✅ |
| 외부 .waiver.json | ✅ | ✅ | ✅ |

---

## [0.0.14] - 2026-01-02

### 외부 Waiver 파일 지원 + 스키마 개선

#### 📁 `.waiver.json` 외부 파일 지원

프로젝트 레벨에서 waiver를 관리할 수 있는 외부 파일 지원:

```json
{
  "$schema": "https://semantic-complexity.dev/schemas/waiver.json",
  "version": "1.0",
  "waivers": [
    {
      "pattern": "src/crypto/*.py",
      "adr": "ADR-007",
      "justification": "AES-256 암호화 알고리즘",
      "approved_at": "2025-01-15",
      "expires_at": "2025-12-31",
      "approver": "security-team"
    }
  ]
}
```

**기능:**
- 상위 디렉토리 순회 탐색
- 글롭 패턴 매칭 (`src/crypto/*.py`)
- 만료일 체크 (`expires_at: null` = 영구)
- 외부 waiver 우선, 인라인 `__essential_complexity__` 폴백

#### 🔧 스키마 필드명 개선

| 기존 | 변경 | 이유 |
|------|------|------|
| `file_pattern` | `pattern` | 간결 |
| `adr_ref` | `adr` | 간결 |
| `reason` | `justification` | 의미 명확 (정당화 근거) |
| - | `approved_at` | 승인일 추가 |
| `expires` | `expires_at` | 일관성 (`_at` 접미사) |
| `approved_by` | `approver` | SDS-WAIVER와 일치 |

#### 📦 선택적 의존성 추가

`pyproject.toml`에 선택적 의존성 그룹 추가:

```toml
[project.optional-dependencies]
yaml = ["pyyaml>=6.0"]
numpy = ["numpy>=1.24"]
all = ["pyyaml>=6.0", "numpy>=1.24"]
```

**설치:**
```bash
pip install semantic-complexity[yaml]   # YAML ADR 파싱
pip install semantic-complexity[numpy]  # 벡터 연산
pip install semantic-complexity[all]    # 전체
```

---

## [0.0.13] - 2025-12-30

### Essential Complexity Waiver + 3단계 Gate 시스템

본질적 복잡도 면제 시스템과 PoC/MVP/Production 3단계 Gate를 도입합니다.

#### 🚪 3단계 Gate 시스템

| 단계 | 엄격도 | Waiver | 용도 |
|------|--------|--------|------|
| **PoC** | 느슨 | ❌ | 빠른 검증, 일단 돌아가면 OK |
| **MVP** | 바싹 | ❌ | 첫 릴리스, 제대로 설계 강제 |
| **Production** | 엄격 | ✅ | 운영 중 입증된 기술부채 허용 |

**임계값 비교:**
```
           nesting  concepts  test_coverage
PoC:          6        12         50%
MVP:          4         9         80%
Production:   3         7         95%
```

#### 📐 기준점 기반 임계값

하드코딩 대신 `BASE_THRESHOLDS` + `STAGE_ADJUSTMENTS`로 계산:

```python
BASE_THRESHOLDS = {
    "nesting_max": 4,           # MVP 기준
    "concepts_per_function": 9,
    "golden_test_min": 0.8,
}

# PoC: +2, +3, -0.3
# MVP: 기준 (조정 없음)
# Production: -1, -2, +0.15
```

#### 🎫 Essential Complexity Waiver

**사용법:**
```python
__module_type__ = "lib/domain"
__essential_complexity__ = {
    "adr": "docs/adr/003-inference.md",
}
```

**동작:**
- Production Gate에서만 waiver 적용
- ADR 파일 존재 시 복잡도 검사 유예
- PoC/MVP에서는 waiver 불가 (처음부터 제대로)

#### 🔍 복잡도 신호 탐지

본질적 복잡도 판단을 위한 토대 정보 제공:

| 카테고리 | 신호 예시 |
|----------|-----------|
| math | `np.linalg`, `torch.matmul`, `fft` |
| algorithm | `memo[`, `visited`, `heapq` |
| domain | `voxel`, `segmentation`, `cipher` |

```python
context = build_complexity_context(source)
# context.signals: 탐지된 신호
# context.questions: 검토 질문 (자동 생성)
```

#### 🚫 LLM Waiver 편법 방지

`LLM_REFACTORING_PROTOCOL.md` 업데이트:
- `__essential_complexity__` 수정 금지
- ADR 파일 생성/수정 금지
- 리팩토링 대신 면제로 도망 금지

---

## [0.0.12] - 2025-12-30

### Anti-pattern Penalty 시스템 도입

LLM이 개념 수 줄이기 위해 `*args`, `**kwargs` 등 편법을 사용하는 것을 방지합니다.

#### 🧀 Cheese Anti-pattern Penalty

**탐지 대상:**

| Anti-pattern | Penalty | 이유 |
|--------------|---------|------|
| `*args` 사용 | +3 | 실제 파라미터 수를 숨김 |
| `**kwargs` 사용 | +3 | 실제 파라미터 수를 숨김 |

**FunctionInfo 확장:**
- `raw_concept_count`: penalty 적용 전 원본 개념 수
- `concept_count`: penalty 포함 최종 개념 수
- `anti_patterns`: 탐지된 anti-pattern 목록

**예시:**
```python
# 편법: *args, **kwargs로 파라미터 숨기기
def process(*args, **kwargs):  # raw: 1, penalty: +6, total: 7
    return args[0]

# 올바른 방법: 명시적 파라미터
def process(input_data, config, options):  # concepts: 4
    return transform(input_data)
```

#### 📄 LLM_REFACTORING_PROTOCOL.md 업데이트

새로운 섹션 5 "Anti-Patterns (Prohibited Refactoring Tricks)" 추가:

| 금지 패턴 | 설명 |
|-----------|------|
| `*args`/`**kwargs` wrapping | 파라미터 수 숨기기 |
| Config object bundling | 관련 없는 파라미터 묶기 |
| Tuple/Dict packing | 의미 숨기기 |
| Inline everything | 가독성 저하 |

> "Metric evasion is not refactoring—it is obfuscation."

#### 🎯 gradient.py 업데이트

`CHEESE_ANTI_PATTERNS` 추가로 권장사항에 금지 사항 명시

---

## [0.0.11] - 2025-12-30

### Bread Trust Boundary 패턴 확장 + Cheese 개념 수 계산 개선

#### 🍞 Bread 개선

**Trust Boundary 패턴 확장:**

| 패턴 유형 | 예시 | 설명 |
|-----------|------|------|
| `marker` | `TRUST_BOUNDARY = True` | 변수 마커 |
| `marker` | `TRUST_BOUNDARY: EXTERNAL API` | docstring 헤더 |
| `marker` | `"""Trust Boundary: ...` | 함수 docstring |
| `marker` | `# TRUST_BOUNDARY` | 주석 마커 |

**AUTH_FLOW 패턴 인식:**
- `AUTH_FLOW: NONE` 같은 명시적 선언 인식
- AUTH_FLOW가 선언되어 있으면 `auth_explicitness` 체크 우회
- 파일 기반 처리 등 인증 불필요 케이스 지원

#### 🧀 Cheese 개선

**개념 수 계산 최적화:**

| 제외 항목 | 이유 |
|-----------|------|
| `self`, `cls` 파라미터 | 클래스 메서드 규약, 인지 부하 없음 |
| Python built-in | `str`, `int`, `len`, `tuple` 등 |
| numpy 기본 함수 | `array`, `asanyarray`, `zeros` 등 |
| pathlib 기본 | `Path` |

**효과:**
- 불필요한 개념 카운트 제거로 더 정확한 인지 복잡도 측정
- 예: `_load_image_data()` 12개 → 9개 (self, str, asanyarray 제외)

#### 🚪 Gate 개선

- `MVPGate._check_bread()`에서 AUTH_FLOW 패턴 인식
- AUTH_FLOW 명시 시 `auth_flow_fixed = True`

---

## [0.0.10] - 2025-12-29

### Cheese 정책 개선 + Bread 민감정보 출력 탐지

#### 🧀 Cheese 정책 개선

- 함수당 개념 수 한계: 5개 → 9개 (Miller's Law 7±2 반영)
- 숨겨진 의존성: 읽기 작업 제외, 쓰기 작업만 카운트
- state×async×retry: 명시적 패턴만 탐지 (데코레이터, 라이브러리)

#### 🍞 Bread 민감정보 출력 탐지

`SECRET_LEAK_PATTERNS` 추가:
- `print(password)`, `print(api_key)` 등 민감 변수 출력 탐지
- `logger.info(secret)` 등 로깅 민감정보 탐지
- 모듈 타입별 정책 (api/external: print 금지)

---

## [0.0.9] - 2025-12-28

### Test Discovery

#### 🥓 Ham: 테스트 파일 자동 탐색

`discover_tests()` 함수 추가:
- 소스 파일 경로에서 대응하는 테스트 파일 자동 탐색
- 패턴: `test_*.py`, `*_test.py`, `tests/test_*.py`
- Golden test 커버리지 계산에 활용

---

## [0.0.8] - 2025-12-24

### 언어별 독립 MCP 서버 & Class 재활용율 분석

#### 언어별 독립 MCP 서버

각 언어가 자체 MCP 서버를 가짐:

| 패키지 | 설치 | 명령어 |
|--------|------|--------|
| **TypeScript/JS** | `npm i -g semantic-complexity-ts-mcp` | `semantic-complexity-ts-mcp` |
| **Python** | `pip install semantic-complexity` | `semantic-complexity-py-mcp` |
| **Go** | `go install .../mcp/main` | `go-complexity-mcp` |

**장점:**
- 서브프로세스 오버헤드 없음 (각 MCP가 네이티브 코드 실행)
- 성능과 신뢰성 향상
- 모든 언어에서 일관된 5개 도구 인터페이스

#### Class 재활용율 분석 (TypeScript/JavaScript)

새로운 `analyze_class` 도구로 OO 설계 품질 평가:

```json
{
  "name": "DatabaseConnection",
  "metrics": {
    "wmc": 5,      // Weighted Methods per Class (클래스당 가중 메서드)
    "lcom": 0.0,   // Lack of Cohesion of Methods (0=응집됨)
    "cbo": 2,      // Coupling Between Objects (객체 간 결합도)
    "rfc": 8,      // Response For a Class (클래스 응답 수)
    "dit": 0       // Depth of Inheritance Tree (상속 깊이)
  },
  "reusability": {
    "score": 99,
    "grade": "A",
    "zone": "reusable"
  }
}
```

**메트릭 설명:**

| 메트릭 | 의미 | 임계값 |
|--------|------|--------|
| **WMC** | 메서드 복잡도 합계 | <20 (낮음), >50 (높음) |
| **LCOM** | 메서드 응집도 (0=완벽, 1=없음) | <0.5 (낮음), >0.8 (높음) |
| **CBO** | 외부 의존성 수 | <5 (낮음), >14 (높음) |
| **RFC** | 메서드 + 호출 메서드 | <20 (낮음), >50 (높음) |
| **DIT** | 상속 깊이 | <3 (권장) |

**재활용율 점수:**
- 0-100 점 (벌점 공식 기반)
- 등급: A (≥80), B (≥60), C (≥40), D (≥20), F (<20)
- 영역: reusable, moderate, problematic

#### 모든 패키지 `--version` 지원

| 패키지 | 명령어 | 출력 |
|--------|--------|------|
| npm CLI | `semantic-complexity --version` | `0.0.8` |
| npm MCP | `semantic-complexity-ts-mcp --version` | `0.0.8` |
| Python CLI | `semantic-complexity --version` | `0.0.8` |
| Python MCP | `semantic-complexity-py-mcp --version` | `0.0.8` |
| Go CLI | `go-complexity -version` | `0.0.8` |
| Go MCP | `go-complexity-mcp -version` | `0.0.8` |

#### 안정성 프레임워크 (이론)

5D 복잡도 공간이 이제 **Lyapunov 안정성 해석**을 지원:

```
에너지 함수: E(v) = vᵀMv + ⟨v,w⟩
안정점:      ∂E/∂v = 0 (canonical centroid)
안정성:      M ≥ 0 (positive semidefinite)
```

이는 리팩토링할 때 코드가 자연스럽게 canonical profile로 "흐른다"는 것을 의미하며, 권장사항을 따르면 안정적이고 최소 복잡도의 코드로 수렴한다는 수학적 보장을 제공함

---

## [0.0.7] - 2025-12-24

### Native Tensor/Canonical 통합 (아키텍처 수정)

#### 버그 수정: 크로스 언어 아키텍처

**문제**: Python/Go CLI가 기본 분석 결과만 반환하고, MCP가 TypeScript core로 tensor/canonical을 재계산하고 있었음. 각 언어는 자체 AST 파서와 분석 패턴이 있어 이 방식은 구조적으로 잘못됨.

**해결**: 각 언어가 native tensor/canonical/hodge 결과를 반환하도록 수정.

| 컴포넌트 | 이전 | 이후 |
|----------|------|------|
| Python CLI | 기본 분석만 | 전체: tensor, canonical, hodge, recommendations |
| Go CLI | 기본 분석만 | 전체: tensor, canonical, hodge, recommendations |
| MCP | TS core로 재계산 | 각 언어의 native 결과 사용 |

#### Python CLI (`py/semantic_complexity/cli`)

응답에 포함되는 정보:
```json
{
  "tensor": { "score": 12.5, "zone": "review", "rawSum": 8, ... },
  "moduleType": { "inferred": "lib", "confidence": 0.85 },
  "canonical": { "profile": "lib", "deviation": 0.12, ... },
  "hodge": { "algorithmic": 3, "balanced": 2, "architectural": 3 },
  "recommendations": [{ "priority": 1, "suggestion": "..." }]
}
```

#### Go CLI (`go/semanticcomplexity`)

`FunctionResult` struct 확장:
```go
type FunctionResult struct {
    // ... 기존 필드
    Tensor          TensorScoreOutput      `json:"tensor"`
    ModuleType      ModuleTypeOutput       `json:"moduleType"`
    Canonical       CanonicalOutput        `json:"canonical"`
    Hodge           HodgeOutput            `json:"hodge"`
    Recommendations []RecommendationOutput `json:"recommendations"`
}
```

#### MCP 서버

- Python/Go 결과에서 native tensor/canonical 사용
- TypeScript core는 native 결과 없을 때만 fallback으로 사용
- 비-TypeScript 언어에 대한 불필요한 재계산 제거

---

## [0.0.6] - 2025-12-23

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

## [0.0.5] - 2025-12-23

### 빌드 & 보안 수정

#### 빌드
- 순차 빌드: core → cli/mcp (병렬)
- core 빌드 전 cli/mcp가 import 시도하던 CI 빌드 실패 수정

#### 보안
- Go 1.22 → 1.23 (CVE-2025-45336, CVE-2025-45341 수정)

#### CI
- Go 태그 버전 동적화 (하드코딩 `go/v0.0.1` 제거)

---

## [0.0.4] - 2025-12-23

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

## [0.0.3] - 2025-12-23

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

## [0.0.2] - 2025-12-23

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

## [0.0.1] - 2025-12-23

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
