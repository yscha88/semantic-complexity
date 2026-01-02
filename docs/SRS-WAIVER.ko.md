# SRS: Semantic Complexity Measurement & Waiver System

## 1. 개요

### 1.1 목적
코드베이스의 복잡도를 수학적으로 측정하고, 리팩토링의 유효성을 검증하며,
본질적 복잡도(Essential Complexity)에 대해 ADR 기반 면제를 관리하는 시스템의 요구사항을 정의한다.

### 1.2 범위
- 복잡도 측정 및 추적 (5D 벡터, 정준 편차)
- 리팩토링 유효성 검증 (에너지 감소 증명)
- 수렴 판정 및 ADR 발급 조건
- 기술부채 관리 (유예 기간, 만료)

### 1.3 용어 정의

| 용어 | 정의 |
|------|------|
| **Essential Complexity** | 도메인 요구사항에 의해 불가피한 복잡도 (Brooks, 1986) |
| **Accidental Complexity** | 리팩토링으로 제거 가능한 복잡도 |
| **Canonical Profile** | 모듈 타입별 정준(표준) 복잡도 프로파일 μ_t |
| **Deviation** | 정준 편차 d = ‖x/μ - 1‖₂ |
| **Potential Function** | 전역 에너지 함수 Φ(G) |
| **Evidence** | 측정의 근거 (file:line, AST node, rule hit) |
| **ADR** | Architecture Decision Record - 설계 결정 문서 |
| **ε-convergence** | \|ΔΦ\| < ε 상태 (더 이상 에너지 감소 불가) |

---

## 2. 수학적 프레임워크

### 2.1 데이터 모델

```
┌─────────────────────────────────────────────────────────────┐
│  entities (정체성)                                          │
│  ├── entity_id: stable identifier                          │
│  ├── type: module | file | func | object                   │
│  ├── path, symbol, language                                │
├─────────────────────────────────────────────────────────────┤
│  snapshots (commit 단위)                                    │
│  ├── commit, timestamp                                     │
│  ├── repo/service, env (dev/prod)                          │
├─────────────────────────────────────────────────────────────┤
│  metrics (엔티티 × 스냅샷)                                  │
│  ├── x = [C, N, S, A, Λ] ∈ ℝ≥0⁵    ← 5D 복잡도 벡터       │
│  ├── rawSum, tensor                                        │
│  ├── d = ‖x/μ_t - 1‖₂              ← 정준 편차            │
│  ├── hodge: algorithmic|balanced|architectural             │
│  ├── moduleType, confidence                                │
├─────────────────────────────────────────────────────────────┤
│  rule_hits (근거 = Evidence)                                │
│  ├── rule_id, count                                        │
│  ├── locations: [file:line, AST node]                      │
├─────────────────────────────────────────────────────────────┤
│  edges (그래프)                                             │
│  ├── src_entity, dst_entity                                │
│  ├── edge_type                                             │
│  ├── weight_components: {coupling, boundary, cognitive...} │
│  ├── weight_total                                          │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 5D 복잡도 벡터

각 엔티티 u에 대해:

```
x_u = [C, N, S, A, Λ] ∈ ℝ≥0⁵

C = Control      제어 흐름 복잡도 (분기, 조건)
N = Nesting      중첩 깊이
S = State        상태 복잡도 (변수, 부작용)
A = Async        비동기 복잡도 (async/await, callback)
Λ = Coupling     결합도 (의존성, import)
```

### 2.3 Hodge Bucket 분류

```
algorithmic   = C + N     알고리즘적 복잡도 (🧀 Cheese)
balanced      = A         비동기 균형 복잡도
architectural = S + Λ     아키텍처적 복잡도 (🍞 Bread + 🥓 Ham)
```

### 2.4 정준 편차 (Canonical Deviation)

```
μ_t(u) = 모듈 타입 t의 정준 프로파일
d_u = ‖x_u / μ_t(u) - 1‖₂

d_u → 0: 정준 상태 (이상적)
d_u ≫ 0: 정준 이탈 (리팩토링 필요)
```

### 2.5 국소 변화 (Δ 미분)

스냅샷 k-1 → k 사이의 변화:

```
Δx_u = x_u(k) - x_u(k-1)     벡터 변화량
Δd_u = d_u(k) - d_u(k-1)     편차 변화량

Δd_u < 0: 정준 수렴 (유효한 리팩토링)
Δd_u > 0: 정준 이탈 (부채 증가)
```

### 2.6 전역 잠재 함수 (Potential Function)

```
Φ(k) = λ₁·Σ_u d_u(k) + λ₂·Σ_e w(e) + λ₃·OpsPenalty(k)

λ₁: 정준 편차 가중치
λ₂: 간선 가중치 (bad coupling)
λ₃: 운영 페널티 가중치
```

**수렴 조건:**
```
Φ(k) 단조 감소 → 안정 구조로 수렴
|ΔΦ| < ε       → ε-수렴 상태 도달
```

### 2.7 경계 흐름 (Boundary Flux)

```
Flux_boundary(k) = Σ w(e)  where boundary(e) = 1

Flux ↑: 🍞 Bread 얇아짐 (신뢰 경계 위험)
Flux ↓: 🍞 Bread 강화
```

---

## 3. 리팩토링 유효성 검증

### 3.1 유효한 리팩토링 조건

리팩토링 Δ가 유효하려면:

```
1. Evidence 완비
   ∀u ∈ affected(Δ): rule_hits[u] ≠ ∅

2. 에너지 감소
   ΔΦ = Φ(after) - Φ(before) < 0

3. 경계 건전성
   Flux_boundary(after) ≤ Flux_boundary(before)
```

### 3.2 최적 리팩토링 선택

```
Δ* = argmin_{Δ∈A} ΔΦ(Δ)
     s.t. Gate(Δ) = true
          Cost(Δ) ≤ B

A = 허용 가능한 리팩토링 집합
B = 비용 예산
```

### 3.3 비용 함수

```
Cost(Δ) = η₁·#filesChanged
        + η₂·#publicAPIChanged
        + η₃·#schemaChanged
        + η₄·#policyTouched
        + η₅·testDelta
```

### 3.4 Refactor ROI

```
ROI(Δ) = -ΔΦ / Cost(Δ)

ROI > 0: 비용 대비 에너지 감소 효과 있음
ROI ↑: 우선 수행 대상
```

**LLM 활용**: ROI 상위 후보만 제공 → 성능 향상

---

## 4. 분석 View

### 4.1 View A: Hotspot Trajectory

```
d_u(k), rawSumRatio(k)가 지속 증가하는 엔티티
→ "인지 붕괴 후보" (MVP에서 사고 나는 곳)
```

**탐지 조건:**
```
∀i ∈ [k-w, k]: d_u(i) > d_u(i-1)     ← w 연속 증가
∨ rawSumRatio(k) > threshold
```

### 4.2 View B: Boundary Flux

```
Flux_boundary(k) = Σ w(e)  where boundary(e) = 1
ΔFlux = Flux(k) - Flux(k-1)
→ "보안 구조가 흔들리는 곳" (deploy/infra 영향)
```

**경고 조건:**
```
ΔFlux > 0                  ← 경계 약화
∨ Flux / |E_boundary| > α  ← 경계당 평균 부하 초과
```

### 4.3 View C: Refactor ROI Ranking

```
ROI(Δ) = -ΔΦ / Cost(Δ)

후보 정렬: ROI(Δ₁) > ROI(Δ₂) > ... > ROI(Δₙ)
→ 비용 대비 안정화 효과가 큰 순서로 수행
```

**LLM 제공 정보:**
```
Top-K ROI 후보:
1. Δ₁: ROI=2.3, Cost=5, -ΔΦ=11.5
2. Δ₂: ROI=1.8, Cost=8, -ΔΦ=14.4
...
```

---

## 5. ADR 발급 조건

### 5.1 Essential Complexity 인정 조건

ADR 발급이 가능한 경우:

```
|ΔΦ(k)| < ε              ← 수렴 (더 이상 에너지 감소 불가)
∧ Flux_boundary 안정      ← 경계 건전성 유지
∧ ∀u: Evidence 완비       ← 모든 측정에 근거 존재
∧ Gate(G) = false         ← 여전히 임계값 초과
────────────────────────
→ Essential Complexity 인정
→ ADR 발급 가능
```

### 5.2 ADR 발급 불가 조건

```
ΔΦ < -ε                  ← 아직 리팩토링으로 개선 가능
∨ Evidence 불완전         ← 측정 근거 누락
∨ Flux_boundary 증가      ← 경계 악화 중
────────────────────────
→ ADR 발급 거부
→ 리팩토링 먼저 수행
```

---

## 6. Ham Sandwich 3계층 보정 체계

| 계층 | 역할 | 정의 위치 |
|------|------|-----------|
| **1차** | 기본 의미론적 복잡도 | 코드 (BASE_THRESHOLDS) |
| **2차** | 모듈 타입별 보정 | 코드 (STAGE_ADJUSTMENTS) |
| **3차** | 본질적 복잡도 신호 기반 보정 | ADR 문서 (수렴 증명 필요) |

### 6.1 본질적 복잡도 신호 (Complexity Signals)

코드에서 자동 탐지되는 본질적 복잡도 패턴:

| 카테고리 | 신호 | 예시 |
|----------|------|------|
| **math** | 선형대수, 텐서 연산 | `np.linalg`, `torch.matmul` |
| **algorithm** | 재귀, DP, 그래프 순회 | 재귀 함수, `heapq`, `deque` |
| **domain** | 3D 이미징, 암호화, 파싱 | `nibabel`, `ast.parse` |

### 6.2 신호 기반 자동 보정

| 신호 | nesting 보정 | concepts 보정 |
|------|--------------|---------------|
| algorithm (재귀) | +2 | ×1.5 |
| math | +1 | ×1.3 |
| domain | +1 | ×1.2 |

---

## 7. 기능 요구사항

### 7.1 ADR 문서 관리

#### FR-7.1.1 ADR 스키마
- ADR 문서는 구조화된 형식(YAML/JSON/TOML)으로 작성
- 필수 필드: 승인일, 유예 기간, 적용 대상, 허용치
- 선택 필드: 사유, 검토자, 관련 신호

#### FR-7.1.2 ADR 파싱
- 시스템은 ADR 문서를 파싱하여 메타데이터 추출
- 지원 형식: YAML, JSON, TOML
- 파싱 실패 시 waiver 거부

#### FR-7.1.3 ADR 유효성 검증
- 필수 필드 존재 확인
- 날짜 형식 검증
- 허용치 범위 검증 (수렴 증명 기반)

### 7.2 유예 기간 관리

#### FR-7.2.1 만료 계산
```
expiry_date = approved_date + grace_period
is_expired = today > expiry_date
```

#### FR-7.2.2 만료 상태
| 상태 | 조건 | waiver 적용 |
|------|------|-------------|
| **active** | today ≤ expiry_date | O |
| **expired** | today > expiry_date | X |
| **warning** | expiry_date - today ≤ 30일 | O (경고) |

#### FR-7.2.3 만료 시 동작
- 만료된 waiver는 자동 무효화
- Gate 검사 결과에 만료 사유 포함
- 갱신 필요 알림

### 7.3 MCP 통합

#### FR-7.3.1 check_gate 연동
- ADR 파싱 및 유효성 검증 자동 수행
- 만료 상태 결과에 포함
- LLM 회피 방지 (ADR 파일 실제 존재 확인)

#### FR-7.3.2 결과 출력
```yaml
waiver:
  status: "active" | "expired" | "warning"
  adr_path: "docs/adr/001-*.yaml"
  approved_date: "2025-01-01"
  expiry_date: "2025-07-01"
  remaining_days: 180
  convergence:
    epsilon: 0.01
    delta_phi: 0.005
    converged: true
  signals_detected: ["algorithm/recursion"]
  adjustments:
    nesting: +2
    concepts: ×1.5
```

---

## 8. 비기능 요구사항

### 8.1 보안

#### NFR-8.1.1 LLM 회피 방지
- ADR 파일은 실제 파일시스템에 존재해야 함
- MCP 호출 시 source 내 `__essential_complexity__` 변조 탐지
- LLM은 ADR 생성/수정 금지 (LLM_REFACTORING_PROTOCOL)

#### NFR-8.1.2 승인 추적
- ADR 변경 이력 Git 추적
- 승인자 정보 필수

### 8.2 호환성

#### NFR-8.2.1 기존 시스템 호환
- 기존 `__essential_complexity__` 선언 방식 지원 (deprecated)
- 점진적 마이그레이션 경로 제공

### 8.3 성능

#### NFR-8.3.1 파싱 성능
- ADR 파싱은 100ms 이내 완료
- 캐싱 지원

---

## 9. 제약사항

### 9.1 ADR 생성 권한
- ADR 문서는 사람만 생성/수정 가능
- LLM은 ADR 내용 제안만 가능 (실제 생성 불가)

### 9.2 허용치 범위
- 3차 보정은 수렴 상태(|ΔΦ| < ε)에서만 유효
- 무제한 waiver 불가

### 9.3 유예 기간 제한
- 최대 유예 기간: 365일
- 갱신 시 재검토 필수 (수렴 상태 재확인)

---

## 10. 인터페이스

### 10.1 ADR 스키마 (YAML 예시)

```yaml
# docs/adr/001-ast-analyzer-complexity.yaml
schema_version: "1.0"
id: "ADR-001"
title: "AST 분석기의 본질적 복잡도"
status: "approved"

# 승인 정보
approval:
  approved_date: "2025-01-01"
  grace_period: "180d"
  approver: "tech-lead"

# 수렴 증명
convergence:
  snapshot_before: "abc123"
  snapshot_after: "def456"
  delta_phi: 0.005
  epsilon: 0.01
  evidence_complete: true

# 적용 대상
targets:
  - path: "src/py/semantic_complexity/analyzers/cheese.py"
    signals: ["algorithm/ast-visitor", "algorithm/recursion"]
    metrics:
      x: [12, 7, 3, 0, 5]
      d: 0.23
      hodge: "algorithmic"
  - path: "src/ts/src/analyzers/cheese.ts"
    signals: ["algorithm/ast-visitor", "algorithm/recursion"]

# 허용치 (수렴 상태에서의 측정값 기반)
thresholds:
  nesting: 7
  concepts: 15

# 사유
rationale: |
  AST Visitor 패턴은 컴파일러/분석 도구의 표준 패턴으로,
  재귀와 다중 노드 타입 분기가 본질적으로 필요함.

  수렴 분석 결과:
  - ΔΦ = 0.005 < ε = 0.01 (수렴 상태)
  - 추가 리팩토링으로 개선 불가능
  - Essential Complexity로 인정

# 참조
references:
  - "https://docs.python.org/3/library/ast.html"
  - "Brooks, No Silver Bullet (1986)"
```

### 10.2 API

```python
# complexity/measurement.py
def measure_entity(source: str, entity_id: str) -> Metrics
def calculate_deviation(metrics: Metrics, module_type: str) -> float
def detect_signals(source: str) -> list[ComplexitySignal]

# complexity/energy.py
def calculate_phi(graph: Graph, k: int) -> float
def calculate_delta_phi(graph: Graph, k: int) -> float
def check_convergence(delta_phi: float, epsilon: float) -> bool

# complexity/flux.py
def calculate_flux(graph: Graph, k: int) -> float
def detect_boundary_degradation(flux_before: float, flux_after: float) -> bool

# waiver/adr.py
def parse_adr(adr_path: Path) -> ADRDocument | None
def validate_adr(adr: ADRDocument) -> ValidationResult
def check_expiry(adr: ADRDocument) -> ExpiryStatus
def verify_convergence(adr: ADRDocument, graph: Graph) -> bool
```

---

## 11. 참조

- [THEORY.ko.md](THEORY.ko.md) - Ham Sandwich 이론적 기반
- [LLM_REFACTORING_PROTOCOL.md](LLM_REFACTORING_PROTOCOL.md) - LLM 제약사항
- [STABILITY_INVARIANTS.md](STABILITY_INVARIANTS.md) - 안정성 불변조건
- Brooks, F. (1986). No Silver Bullet - Essential vs Accidental Complexity
- Lyapunov Stability Theory - 에너지 함수 수렴 분석
