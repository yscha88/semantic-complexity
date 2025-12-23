# semantic-complexity

[English](./README.md) | 한국어

**다차원 코드 복잡도 분석기** — 대수적 위상학과 텐서 분석을 기반으로 코드의 실제 유지보수 난이도를 정량화합니다.

## v0.0.7: Native Tensor/Canonical 통합

### 아키텍처 수정
Python/Go CLI가 기본 분석 결과만 반환하던 버그 수정. 이제 각 언어의 native tensor/canonical/hodge 결과를 반환하고 MCP가 직접 사용.

| 컴포넌트 | 이전 | 이후 |
|----------|------|------|
| Python CLI | 기본 분석만 | 전체: tensor, canonical, hodge, recommendations |
| Go CLI | 기본 분석만 | 전체: tensor, canonical, hodge, recommendations |
| MCP | TS로 재계산 | 각 언어의 native 결과 사용 |

### MCP 도구 (6개)
| 도구 | 설명 |
|------|------|
| `get_hotspots` | [진입점] 복잡도 핫스팟 검색 |
| `analyze_file` | 파일 수준 분석 |
| `analyze_function` | 함수 심층 분석 (breakdown + comparison 포함) |
| `suggest_refactor` | 리팩토링 제안 |
| `generate_graph` | 의존성/호출 그래프 시각화 |
| `validate_complexity` | Canonical 경계 검증 (모듈 타입 추론 포함) |

---

## v0.0.6: MCP 도구 통합

- **도구 통합 (9 → 6)**: 중복 도구 병합으로 API 간소화
- **LLM 최적화 설명**: 자율적 도구 선택을 위한 상황별 사용 힌트 추가

---

## v0.0.5: 빌드 & 보안 수정

### 주요 변경사항
- **빌드 순서 수정**: CI 호환을 위한 순차 빌드 (core → cli/mcp)
- **Go 1.23**: 보안 업데이트 (CVE-2024-45336, CVE-2024-45341)
- **Go 태그 동적화**: CI에서 package.json 버전 읽기

---

## v0.0.4: Go 지원 & 테스트 확장

### 주요 변경사항
- **Go 언어 지원**: 텐서 프레임워크 포함 AST 기반 분석기
- **총 367개 테스트**: npm(119) + Python(154) + Go(94)
- **Python 96% 커버리지**: CLI 모듈 테스트 완료
- **새 MCP 도구**: `generate_graph`, `infer_module_type`, `check_canonical`

---

## v0.0.3: Mathematical Framework

### 문제 정의

#### v0.0.2까지의 한계

```
score = Σ(dᵢ × wᵢ) = d₁w₁ + d₂w₂ + ... + d₅w₅
```

이는 **선형 합산**으로, 다음 문제가 있습니다:

| 문제 | 설명 |
|------|------|
| 차원 간 상호작용 무시 | `nesting × async`의 시너지 효과 반영 불가 |
| 단일 가중치 | 모든 모듈에 동일한 가중치 적용 |
| Hard boundary | `score = 10.0` 경계에서 수렴 불안정 |
| 위상 구조 부재 | 코드 공간의 기하학적 특성 무시 |

---

## Mathematical Foundations

### 1. Domain Space 정의

코드 복잡도는 5개의 **domain**으로 구성된 공간 `D`에서 정의됩니다:

```
D = D_control × D_nesting × D_state × D_async × D_coupling ⊂ ℝ⁵
```

각 domain은 독립적인 측정 공간이 아닌, **상호작용하는 fiber bundle** 구조를 가집니다.

#### Domain 정의

| Domain | 기호 | 수학적 정의 | 측정 대상 |
|--------|------|-------------|-----------|
| **Control** | `C` | `dim H₁(G) + 1` (First Betti number) | 분기, 루프, 조건문 |
| **Nesting** | `N` | `Σᵢ depth(nodeᵢ)` (Depth integral) | 중첩 깊이, 콜백 |
| **State** | `S` | `|∂Γ/∂t|` (State transition rate) | 상태 변이, 전이 |
| **Async** | `A` | `π₁(async-flow)` (Fundamental group) | 비동기 경계, await |
| **Coupling** | `Λ` | `deg(v) in G_dep` (Dependency degree) | 전역 접근, I/O, 부수효과 |

---

### 2. Tensor Structure

#### 2.1 First-Order (현재 v0.0.2)

```
score⁽¹⁾ = ⟨v, w⟩ = Σᵢ vᵢwᵢ

v = [C, N, S, A, Λ] ∈ ℝ⁵
w = [1.0, 1.5, 2.0, 2.5, 3.0]
```

선형 모델. 차원 간 독립 가정.

#### 2.2 Second-Order Tensor (v0.0.3)

차원 간 **상호작용**을 포착하는 2차 텐서:

```
score⁽²⁾ = vᵀMv + ⟨v, w⟩

M ∈ ℝ⁵ˣ⁵ (Interaction Matrix)
```

**상호작용 행렬 M:**

```
        C     N     S     A     Λ
    ┌─────────────────────────────┐
C   │ 1.0   0.3   0.2   0.2   0.3 │  Control
N   │ 0.3   1.0   0.4   0.8   0.2 │  Nesting × Async ↑
S   │ 0.2   0.4   1.0   0.5   0.9 │  State × Coupling ↑↑
A   │ 0.2   0.8   0.5   1.0   0.4 │  Async × Nesting ↑
Λ   │ 0.3   0.2   0.9   0.4   1.0 │  Coupling × State ↑↑
    └─────────────────────────────┘
```

**해석:**
- `M[N,A] = 0.8`: 깊은 중첩 안의 async → 높은 상호작용
- `M[S,Λ] = 0.9`: 상태 변이 + 숨겨진 의존성 → 치명적

#### 2.3 Third-Order Tensor (모듈 타입별)

모듈 타입에 따라 **다른 상호작용 행렬**을 적용:

```
W ∈ ℝ⁴ˣ⁵ˣ⁵

W[module_type, i, j] = 모듈별 상호작용 가중치
```

```python
# API 모듈: Coupling 상호작용 강조
M_api[S,Λ] = 1.5  # State × Coupling 매우 위험

# Lib 모듈: Control/Nesting 상호작용 강조
M_lib[C,N] = 1.2  # Control × Nesting 중요

# App 모듈: State/Async 상호작용 강조
M_app[S,A] = 1.3  # State × Async 중요
```

---

### 3. ε-Regularization과 수렴

#### 문제: Hard Boundary의 불안정성

```
threshold = 10.0

iteration 1: score = 10.5 → fix
iteration 2: score = 9.8  → ok
iteration 3: score = 10.1 → fix
iteration 4: score = 9.9  → ok
...
경계에서 진동, 수렴 안 함
```

#### 해결: ε-Lifted Space

복잡도 공간을 threshold에서 **ε만큼 떠있는** 상태로 정의:

```
target = threshold - ε

         ┌─────────────────────┐
    ε    │   Safe Zone         │  ← 여기로 수렴
         ├─────────────────────┤
  ──────▶│   threshold = 10    │  ← 불안정 경계
         ├─────────────────────┤
   -ε    │   Violation Zone    │
         └─────────────────────┘
```

#### Contraction Mapping Theorem

수렴을 보장하려면:

```
‖f(x) - f(y)‖ ≤ k‖x - y‖,  where k < 1
```

ε-regularization이 이 조건을 만족시킵니다:

```
score_reg = score + ε‖v‖²

∇score_reg = ∇score + 2εv
```

**결과:**
- ε = 0: k → 1, 수렴 보장 없음
- ε > 0: k < 1, Banach fixed-point theorem 적용 가능

#### Convergence Score

```python
def convergence_score(current: float, threshold: float, epsilon: float) -> float:
    """
    Returns:
        < 0: Safe zone (converged)
        0-1: ε-neighborhood (review needed)
        > 1: Violation zone
    """
    target = threshold - epsilon
    return (current - target) / epsilon
```

---

### 4. Topological Interpretation

#### McCabe와 Algebraic Topology

McCabe 복잡도는 **위상학적 불변량**입니다:

```
McCabe = E - N + 2P = dim H₁(G) + 1
```

- `H₁(G)`: Control Flow Graph의 First Homology Group
- `dim H₁(G)`: First Betti Number (독립 사이클 수)

#### 확장: 각 Domain의 위상 구조

| Domain | 그래프 | 위상적 측정 |
|--------|--------|-------------|
| Control | Control Flow Graph | `β₁ = dim H₁(CFG)` |
| Nesting | AST Depth Tree | `height(T)` |
| State | State Transition Graph | `β₀, β₁` of STG |
| Async | Async Flow Graph | `π₁(AFG)` |
| Coupling | Dependency Graph | `deg(v), β₁(DG)` |

#### Hodge Decomposition of Code Space

코드 복잡도 공간에 **Hodge-like 분해**를 적용:

```
H^k(Code) = ⊕_{p+q=k} H^{p,q}(Code)
```

복잡도 도메인 공간의 Hodge 구조:

| Hodge Component | 지배 Domain | 특성 | 해석 |
|-----------------|-------------|------|------|
| `H^{2,0}` | Control, Nesting | Algorithmic | 순수 알고리즘 복잡도 |
| `H^{0,2}` | Coupling, State | Architectural | 구조적/의존성 복잡도 |
| `H^{1,1}` | Async (mixed) | Balanced | 혼합 복잡도 |

**Hodge Decomposition의 의미:**

```
         H^{2,0} (Algorithmic)
            ↗
Code Space → H^{1,1} (Balanced/Async)
            ↘
         H^{0,2} (Architectural)
```

- **H^{2,0}** (holomorphic): Control + Nesting → 로컬 알고리즘 복잡도
- **H^{0,2}** (anti-holomorphic): Coupling + State → 전역 구조 복잡도
- **H^{1,1}** (harmonic): Async → 두 세계를 연결하는 경계

**Harmonic Condition:**
```
Δω = 0  (Laplacian이 0인 형태)

최적 코드 = H^{1,1}에서 harmonic form
         = 알고리즘/구조 복잡도가 균형잡힌 상태
```

#### de Rham Cohomology 연결

코드 변경을 **differential form**으로 해석:

```
d: Ω^k(Code) → Ω^{k+1}(Code)

d² = 0  (경계의 경계는 없다)
```

- `Ω^0`: 함수 (스칼라 복잡도)
- `Ω^1`: 함수 간 관계 (의존성)
- `Ω^2`: 모듈 간 관계 (아키텍처)

**Closed vs Exact:**
```
Closed: dω = 0 (변경해도 복잡도 불변)
Exact:  ω = dη (리팩토링으로 제거 가능)

H^k = Closed / Exact = 본질적 복잡도
```

---

### 5. Module Type Canonical Forms

#### Canonical Profile per Module Type

각 모듈 타입은 **이상적인 복잡도 프로필**을 가집니다:

```
Φ: ModuleType → CanonicalProfile

Φ(api)    = (C: low,  N: low,  S: low,  A: low,  Λ: low)
Φ(lib)    = (C: med,  N: med,  S: low,  A: low,  Λ: low)
Φ(app)    = (C: med,  N: med,  S: med,  A: med,  Λ: low)
Φ(web)    = (C: med,  N: high, S: med,  A: med,  Λ: low)
Φ(data)   = (C: low,  N: low,  S: high, A: low,  Λ: med)
Φ(infra)  = (C: low,  N: low,  S: low,  A: high, Λ: high)
Φ(deploy) = (C: low,  N: low,  S: low,  A: low,  Λ: low)
```

#### Deviation Metric

현재 상태와 canonical form 사이의 거리:

```
δ(v, Φ(type)) = ‖v - Φ(type)‖_M

where ‖·‖_M is the M-weighted norm (Mahalanobis-like)
```

---

### 6. Ham Sandwich Decomposition

#### Meta-Dimensions (3-axis)

복잡도 공간을 3개의 **직교 축**으로 투영:

```
π: ℝ⁵ → ℝ³

v = [C, N, S, A, Λ] ↦ [Security, Context, Behavior]
```

| Meta-Axis | 구성 | 의미 |
|-----------|------|------|
| 🍞 **Security** | `f(Λ, S)` | 구조 안정성, 보안 경계 |
| 🧀 **Context** | `g(C, N)` | 맥락 밀도, 인지 부하 |
| 🥓 **Behavior** | `h(S, A)` | 행동 보존성, 예측 가능성 |

#### Ham Sandwich Theorem 적용

> "3차원 공간의 3개 객체는 단일 평면으로 동시 이등분 가능"

**Implication:** 최적의 리팩토링 전략이 존재함을 보장

---

### 7. Canonical Existence Theorem과 반례

#### 정리 (Naive Version)

> "모든 모듈 타입 τ에 대해 최적의 canonical profile Φ*(τ)가 존재한다"

**증명 스케치:**
1. Weierstrass 정리: compact set에서 연속함수는 최솟값을 가짐
2. 2차 형식 `vᵀMv`는 M이 positive semi-definite일 때 볼록
3. ε-regularization이 strict convexity 보장
4. Hodge decomposition이 유일성 제공

그러나 이 정리는 **여러 조건에서 실패**합니다.

---

#### 반례 1: Non-Compact Domain (비유계 제약)

Weierstrass 정리는 **compact set**에서만 적용됩니다.

```python
# 플러그인 시스템 - Coupling이 무한히 증가 가능
class PluginManager:
    def load_plugin(self, plugin):
        self.plugins.append(plugin)
        for p in self.plugins:
            p.notify_all(self.plugins)  # O(n²) coupling
```

```
Λ(Coupling) → ∞  as  |plugins| → ∞

Domain: D_coupling = [0, ∞)  ← NOT bounded!
∴ Φ(plugin_manager) is NOT compact
∴ Minimum may not exist (infimum only)
```

---

#### 반례 2: Non-Convex Objective (비볼록 목적함수)

M이 **positive semi-definite가 아닌** 경우:

```
M_adversarial =
    ┌─────────────────────────────────┐
    │ 1.0  -0.5   0.2   0.2   0.3    │
    │-0.5   1.0   0.4  -0.3   0.2    │  ← 음수 상호작용
    │ 0.2   0.4   1.0   0.5  -0.6    │
    │ 0.2  -0.3   0.5   1.0   0.4    │
    │ 0.3   0.2  -0.6   0.4   1.0    │
    └─────────────────────────────────┘

eigenvalues(M) = [1.8, 1.2, 0.9, 0.4, -0.3]
                                      ↑
                              Negative eigenvalue!
```

**결과:** Control과 Nesting이 서로 상쇄하는 코드 패턴에서 **multiple local minima** 발생.

---

#### 반례 3: ε = 0 진동 (Regularization 없음)

```
ε = 0일 때:
  Lipschitz constant k ≈ 1
  ‖f(x) - f(y)‖ ≤ k‖x - y‖ where k = 1

Banach fixed-point theorem FAILS when k = 1
```

**실제 현상:**
```
iteration 1: score = 10.5 → extract_method() → Coupling ↑
iteration 2: score = 9.8  → inline_method()  → Control ↑
iteration 3: score = 10.2 → extract_method() → Coupling ↑
... 무한 진동
```

---

#### 반례 4: Module Type Ambiguity (타입 모호성)

```python
class UserService:
    """API + Lib + App 특성을 모두 가진 hybrid 모듈"""

    def __init__(self, db, cache, queue):
        self.db = db          # Coupling (api-like)
        self.cache = cache    # State (app-like)
        self.queue = queue    # Async (lib-like)
```

```
P(api) = 0.4,  P(lib) = 0.3,  P(app) = 0.3

Φ_mixture = 0.4×Φ(api) + 0.3×Φ(lib) + 0.3×Φ(app)
          ≠ Φ(τ) for any τ

Convex combination of canonical profiles ≠ canonical
```

---

#### 반례 5: Hodge Uniqueness 실패

위상적으로 동등하지만 복잡도가 다른 함수:

```
f₁(x) = Σᵢ₌₁ⁿ if(cond_i) { action_i }   # Control = n, Nesting = 1
f₂(x) = switch(classify(x)) { ... }      # Control = k, Nesting = log(n)

β₁(CFG_f₁) = β₁(CFG_f₂)  ← Same Betti number
But score(f₁) ≠ score(f₂)
```

Hodge structure가 metric 정보 없이는 유일성을 보장하지 않음.

---

#### 반례 6: Legacy Code (실세계 위반)

```python
class LegacyPaymentProcessor:
    """10년간 진화한 코드 - 모든 타입의 특성을 가짐"""
    global_config = {}  # deploy
    _cache = {}         # app

    # Control = 47, Nesting = 12, State = 23, Async = 8, Coupling = 31
```

```
v_actual = [47, 12, 23, 8, 31]

For ANY module type τ:
  δ(v_actual, Φ(τ)) > ε_max

∄ τ : v_actual ∈ Φ(τ)

"Orphan" state - 어떤 canonical form에도 속하지 않음
```

---

#### 반례 요약

| 반례 | 위반 조건 | 결과 |
|------|-----------|------|
| 1. Plugin Manager | Compact domain | Infimum only, no minimum |
| 2. Adversarial M | Positive definite | Multiple local minima |
| 3. ε = 0 | Contraction mapping | Non-convergence |
| 4. Hybrid module | Clear type | Undefined Φ(τ) |
| 5. Topological equiv | Metric uniqueness | Non-unique decomposition |
| 6. Legacy code | Clean design | Outside all canonical regions |

---

#### 수정된 정리 (Conditional Canonical Existence)

```
Theorem: Let τ ∈ ModuleTypes, and suppose:
  (i)   Φ(τ) ⊂ ℝ⁵ is compact (bounded constraints)
  (ii)  M is positive semi-definite (convex objective)
  (iii) ε > 0 (regularization active)
  (iv)  τ is uniquely determined (no type ambiguity)
  (v)   Code is "newly designed" (not legacy accumulation)

Then ∃! v* ∈ Φ(τ) such that:
  v* = argmin_{v ∈ Φ(τ)} [vᵀMv + ⟨v,w⟩ + ε‖v‖²]

Moreover, iterative refinement converges:
  v_{n+1} = f(v_n) → v* as n → ∞
```

**Implications:**
- 새 코드 설계 시: 정리가 적용되어 최적 구조 존재
- 레거시 리팩토링 시: 먼저 타입을 명확히 하고, 경계 조건 확인 필요
- ε > 0 유지가 수렴의 핵심

---

### 6. 이중 지표 접근법 (CDR 기반)

[Clinical Dementia Rating (CDR)](https://knightadrc.wustl.edu/professionals-clinicians/cdr-dementia-staging-instrument/)에서 영감을 받아 두 가지 보완적 지표를 사용:

| 지표 | CDR 대응 | 계산 | 용도 |
|------|----------|------|------|
| **Tensor Score** | CDR Global | `vᵀMv + ⟨v,w⟩ + ε‖v‖²` | 단계 분류, 상호작용 포착 |
| **Raw Sum** | CDR-SOB | `C + N + S + A + Λ` | 시간에 따른 변화 추적 |

#### 왜 두 가지 지표인가?

| 속성 | Tensor Score | Raw Sum |
|------|--------------|---------|
| 계산 방식 | 알고리즘 기반 | 단순 합산 |
| 데이터 타입 | 순서형 (staging) | 연속형 (interval) |
| 상호작용 포착 | O (M 행렬) | X |
| 변화 민감도 | 낮음 | 높음 |
| 최적 용도 | 분류 | 진행 추적 |

#### Raw Sum 임계값

Raw Sum 임계값은 정준형 프로파일의 상한 합산에서 도출:

```
rawSumThreshold(module_type) = Σ canonical_upper_bounds

예시 (api):
  control[1] + nesting[1] + state[1] + async[1] + coupling[1]
  = 5 + 3 + 2 + 3 + 3 = 16
```

| 모듈 | Raw Sum 임계값 |
|------|----------------|
| api | 16 |
| lib | 21 |
| app | 36 |
| web | 31 |
| data | 22 |
| infra | 26 |
| deploy | 12 |
| unknown | 55 |

#### 해석

```
rawSumRatio = rawSum / rawSumThreshold

0.0 - 0.7: 안전 구간
0.7 - 1.0: 검토 필요
    > 1.0: 위반
```

---

## Implementation

### Score Calculation (v0.0.3)

```python
def calculate_score(
    v: Vector5D,
    module_type: ModuleType,
    epsilon: float = 2.0
) -> ComplexityScore:
    # 1차 항
    linear = dot(v, get_weights(module_type))

    # 2차 항 (상호작용)
    M = get_interaction_matrix(module_type)
    quadratic = v.T @ M @ v

    # ε-정규화
    regularization = epsilon * norm(v) ** 2

    return ComplexityScore(
        raw=linear + quadratic,
        regularized=linear + quadratic + regularization,
        epsilon=epsilon
    )
```

### Convergence Analysis

```python
def analyze_convergence(
    current: Vector5D,
    module_type: ModuleType,
    threshold: float = 10.0,
    epsilon: float = 2.0
) -> ConvergenceResult:
    canonical = get_canonical_profile(module_type)
    deviation = mahalanobis_distance(current, canonical)

    conv_score = (deviation - (threshold - epsilon)) / epsilon

    return ConvergenceResult(
        deviation=deviation,
        convergence_score=conv_score,
        status="safe" if conv_score < 0 else
               "review" if conv_score < 1 else "violation"
    )
```

---

## Package Structure

```
semantic-complexity/
├── packages/           # TypeScript (JS/TS 분석)
│   ├── core/          # 분석 엔진
│   ├── cli/           # CLI 도구
│   └── mcp/           # Claude Code 연동
├── py/                # Python (Python 분석)
│   └── semantic_complexity/
└── go/                # Go 분석
    └── semanticcomplexity/
```

## Installation

```bash
# TypeScript/JavaScript
npm install semantic-complexity

# Python
pip install semantic-complexity

# Go
go get github.com/yscha88/semantic-complexity/go/semanticcomplexity
```

## MCP 서버

TypeScript/JavaScript, Python, Go 자동 언어 감지.

**크로스 플랫폼 지원:** Linux, Mac, Windows (자동 Python 명령어 fallback: `python3` → `python` → `py`)

```json
{
  "mcpServers": {
    "semantic-complexity": {
      "command": "npx",
      "args": ["semantic-complexity-mcp"]
    }
  }
}
```

### 제공 도구

| 도구 | 설명 |
|------|------|
| `analyze_file` | 파일 복잡도 분석 (TS/JS, Python, Go) |
| `analyze_function` | 함수 복잡도 분석 |
| `get_hotspots` | 복잡도 핫스팟 검색 |
| `compare_mccabe_dimensional` | McCabe vs 차원 복잡도 비교 |
| `suggest_refactor` | 리팩토링 제안 |
| `get_dimension_breakdown` | 상세 차원 분석 |
| `generate_graph` | 의존성/호출 그래프 생성 (v0.0.4) |
| `infer_module_type` | 복잡도 프로필에서 모듈 타입 추론 (v0.0.4) |
| `check_canonical` | 정준형 경계 준수 검사 (v0.0.4) |

## CLI

```bash
# 프로젝트 분석
npx semantic-complexity scan ./src

# 의존성 그래프 생성
npx semantic-complexity graph ./src --format mermaid

# 파일의 호출 그래프 생성
npx semantic-complexity graph ./src/index.ts --type call
```

## Roadmap

| Version | Features |
|---------|----------|
| v0.0.1 | 다중 도메인 복잡도 분석, 선형 가중합 |
| v0.0.2 | Canonical profiles, Meta-dimensions, Delta gates |
| v0.0.3 | 2차 Tensor, ε-regularization, 8개 모듈 타입, Python/MCP |
| **v0.0.4** | **Go 지원, 그래프 생성, 모듈 타입 추론, CLI 개선** |
| v0.0.5 | 위상학적 분석 심화 (Betti numbers) |
| v0.0.6 | IDE 플러그인 (VSCode), CI/CD 연동 |

## References

### Complexity Theory
1. McCabe, T.J. (1976). "A Complexity Measure" - IEEE TSE
2. Halstead, M.H. (1977). "Elements of Software Science"

### Algebraic Topology
3. Borsuk-Ulam Theorem - Topological Fixed Point
4. Sperner's Lemma - Combinatorial Topology
5. Betti Numbers & Homology Groups - `H_n(X)` invariants

### Hodge Theory
6. Hodge, W.V.D. (1941). "The Theory and Applications of Harmonic Integrals"
7. Hodge Decomposition: `H^k(M) = ⊕_{p+q=k} H^{p,q}(M)`
8. de Rham Cohomology - Differential forms on manifolds

### Convergence & Fixed Points
9. Banach Fixed-Point Theorem - Contraction Mapping
10. Lyapunov Stability - ε-neighborhood convergence

## License

MIT
