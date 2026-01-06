# SDS: Semantic Complexity Measurement & Waiver System

## 1. 개요

### 1.1 목적
SRS에서 정의된 수학적 프레임워크를 구현하기 위한 설계 명세.

### 1.2 범위
- 복잡도 측정 (5D 벡터, 정준 편차)
- 에너지 계산 및 수렴 판정
- 경계 흐름 분석
- 분석 View (Hotspot, Flux, ROI)
- ADR 기반 Waiver 관리

---

## 2. 아키텍처

### 2.1 컴포넌트 구조

```
semantic_complexity/
├── measurement/
│   ├── __init__.py
│   ├── vector.py         # 5D 벡터 측정
│   ├── deviation.py      # 정준 편차 계산
│   ├── hodge.py          # Hodge bucket 분류
│   └── evidence.py       # rule_hits 수집
├── energy/
│   ├── __init__.py
│   ├── potential.py      # Φ(k) 계산
│   ├── delta.py          # ΔΦ 계산
│   └── convergence.py    # ε-수렴 판정
├── flux/
│   ├── __init__.py
│   ├── boundary.py       # 경계 흐름 계산
│   └── degradation.py    # 경계 악화 탐지
├── view/
│   ├── __init__.py
│   ├── hotspot.py        # View A: Hotspot Trajectory
│   ├── boundary.py       # View B: Boundary Flux
│   └── roi.py            # View C: Refactor ROI
├── graph/
│   ├── __init__.py
│   ├── entity.py         # Entity 관리
│   ├── snapshot.py       # Snapshot 관리
│   ├── edge.py           # Edge 관리
│   └── store.py          # 저장소 (SQLite/JSON)
├── gate/
│   ├── waiver.py         # Waiver 통합 체크
│   ├── mvp.py            # Gate 로직
│   └── adr/
│       ├── __init__.py
│       ├── schema.py     # ADR 스키마
│       ├── parser.py     # ADR 파서
│       ├── validator.py  # 유효성 검증 (수렴 포함)
│       └── expiry.py     # 만료 관리
└── mcp/
    └── __init__.py       # MCP 통합
```

### 2.2 데이터 흐름

```
┌──────────────────────────────────────────────────────────────────┐
│  MEASUREMENT PHASE                                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Source Code ──▶ AST Parser ──▶ 5D Vector x_u                   │
│                      │              │                            │
│                      ▼              ▼                            │
│               rule_hits[]    Hodge Bucket                        │
│               (Evidence)                                         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  DEVIATION PHASE                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  x_u + architectureRole ──▶ μ_t(u) ──▶ d_u = ‖x_u/μ_t - 1‖₂          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  ENERGY PHASE                                                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Σd_u + Σw(e) + OpsPenalty ──▶ Φ(k)                             │
│                                    │                             │
│  Φ(k) - Φ(k-1) ──────────────────▶ ΔΦ                           │
│                                    │                             │
│  |ΔΦ| < ε? ──────────────────────▶ Converged?                   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  ADR ELIGIBILITY                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Converged ∧ Flux stable ∧ Evidence complete ∧ Gate failed      │
│                              │                                   │
│                              ▼                                   │
│                    ADR 발급 가능                                  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. 데이터 모델

### 3.1 Entity

```python
from dataclasses import dataclass, field
from enum import Enum
from typing import Literal


class EntityType(Enum):
    MODULE = "module"
    FILE = "file"
    FUNC = "func"
    OBJECT = "object"


@dataclass
class Entity:
    """코드 엔티티 (안정적 정체성)"""
    entity_id: str                    # stable identifier (hash)
    type: EntityType
    path: str                         # file path
    symbol: str                       # function/class name
    language: Literal["python", "typescript", "go"]

    @property
    def qualified_name(self) -> str:
        return f"{self.path}:{self.symbol}"
```

### 3.2 Snapshot

```python
from datetime import datetime


@dataclass
class Snapshot:
    """커밋 단위 스냅샷"""
    snapshot_id: str                  # auto-generated
    commit: str                       # git commit hash
    timestamp: datetime
    repo: str                         # repository name
    service: str | None = None        # service name (monorepo)
    env: Literal["dev", "prod"] = "dev"
```

### 3.3 Metrics

```python
import numpy as np
from numpy.typing import NDArray


@dataclass
class ComplexityVector:
    """5D 복잡도 벡터"""
    C: float    # Control
    N: float    # Nesting
    S: float    # State
    A: float    # Async
    L: float    # Coupling (Λ)

    def to_array(self) -> NDArray[np.float64]:
        return np.array([self.C, self.N, self.S, self.A, self.L])

    @classmethod
    def from_array(cls, arr: NDArray[np.float64]) -> "ComplexityVector":
        return cls(C=arr[0], N=arr[1], S=arr[2], A=arr[3], L=arr[4])


class HodgeBucket(Enum):
    ALGORITHMIC = "algorithmic"       # C + N
    BALANCED = "balanced"             # A
    ARCHITECTURAL = "architectural"   # S + Λ


@dataclass
class Metrics:
    """엔티티별 메트릭"""
    entity_id: str
    snapshot_id: str

    # 5D 벡터
    x: ComplexityVector

    # 파생 값
    raw_sum: float                    # sum(x)
    tensor: NDArray[np.float64] | None = None  # optional tensor repr

    # 정준 편차
    d: float = 0.0                    # deviation from canonical

    # 분류
    hodge: HodgeBucket = HodgeBucket.ALGORITHMIC
    architecture_role: str = "app"          # api/external, lib/domain, app

    # 신뢰도
    confidence: float = 1.0           # 0.0 ~ 1.0
```

### 3.4 RuleHit (Evidence)

```python
@dataclass
class Location:
    """코드 위치"""
    file: str
    line: int
    column: int | None = None
    ast_node_type: str | None = None  # e.g., "FunctionDef", "If"


@dataclass
class RuleHit:
    """규칙 히트 (측정 근거)"""
    entity_id: str
    snapshot_id: str
    rule_id: str                      # e.g., "nesting/depth", "state/mutation"
    count: int
    locations: list[Location] = field(default_factory=list)

    def has_evidence(self) -> bool:
        return len(self.locations) > 0
```

### 3.5 Edge

```python
class EdgeType(Enum):
    IMPORT = "import"                 # module dependency
    CALL = "call"                     # function call
    INHERIT = "inherit"               # class inheritance
    BOUNDARY = "boundary"             # trust boundary crossing


@dataclass
class WeightComponents:
    """간선 가중치 구성요소"""
    coupling: float = 0.0             # α coefficient
    boundary: float = 0.0             # β coefficient
    cognitive: float = 0.0            # γ coefficient
    failure_propagation: float = 0.0  # δ coefficient


@dataclass
class Edge:
    """그래프 간선"""
    src_entity: str                   # entity_id
    dst_entity: str                   # entity_id
    snapshot_id: str
    edge_type: EdgeType
    weight_components: WeightComponents

    @property
    def weight_total(self) -> float:
        w = self.weight_components
        return w.coupling + w.boundary + w.cognitive + w.failure_propagation

    def is_boundary_crossing(self) -> bool:
        return self.edge_type == EdgeType.BOUNDARY or self.weight_components.boundary > 0
```

---

## 4. 측정 모듈 (measurement)

### 4.1 5D 벡터 측정 (vector.py)

```python
import ast
from dataclasses import dataclass


@dataclass
class VectorMeasurement:
    """벡터 측정 결과"""
    vector: ComplexityVector
    rule_hits: list[RuleHit]


class VectorAnalyzer:
    """5D 복잡도 벡터 분석기"""

    def measure(self, source: str, entity_id: str, snapshot_id: str) -> VectorMeasurement:
        tree = ast.parse(source)

        rule_hits: list[RuleHit] = []

        # C: Control flow
        control = self._measure_control(tree, entity_id, snapshot_id, rule_hits)

        # N: Nesting depth
        nesting = self._measure_nesting(tree, entity_id, snapshot_id, rule_hits)

        # S: State complexity
        state = self._measure_state(tree, entity_id, snapshot_id, rule_hits)

        # A: Async complexity
        async_val = self._measure_async(tree, entity_id, snapshot_id, rule_hits)

        # Λ: Coupling
        coupling = self._measure_coupling(tree, entity_id, snapshot_id, rule_hits)

        vector = ComplexityVector(
            C=control,
            N=nesting,
            S=state,
            A=async_val,
            L=coupling,
        )

        return VectorMeasurement(vector=vector, rule_hits=rule_hits)

    def _measure_control(self, tree: ast.AST, entity_id: str,
                         snapshot_id: str, hits: list[RuleHit]) -> float:
        """제어 흐름 복잡도 측정"""
        count = 0
        locations: list[Location] = []

        for node in ast.walk(tree):
            if isinstance(node, (ast.If, ast.For, ast.While, ast.Try,
                                  ast.Match, ast.With)):
                count += 1
                locations.append(Location(
                    file="",  # filled by caller
                    line=node.lineno,
                    column=node.col_offset,
                    ast_node_type=type(node).__name__,
                ))

        if locations:
            hits.append(RuleHit(
                entity_id=entity_id,
                snapshot_id=snapshot_id,
                rule_id="control/branch",
                count=count,
                locations=locations,
            ))

        return float(count)

    def _measure_nesting(self, tree: ast.AST, entity_id: str,
                         snapshot_id: str, hits: list[RuleHit]) -> float:
        """중첩 깊이 측정"""
        max_depth = 0
        deepest_location: Location | None = None

        def walk_depth(node: ast.AST, depth: int = 0):
            nonlocal max_depth, deepest_location

            if isinstance(node, (ast.If, ast.For, ast.While, ast.Try,
                                  ast.With, ast.FunctionDef, ast.AsyncFunctionDef)):
                depth += 1
                if depth > max_depth:
                    max_depth = depth
                    deepest_location = Location(
                        file="",
                        line=node.lineno,
                        column=node.col_offset,
                        ast_node_type=type(node).__name__,
                    )

            for child in ast.iter_child_nodes(node):
                walk_depth(child, depth)

        walk_depth(tree)

        if deepest_location:
            hits.append(RuleHit(
                entity_id=entity_id,
                snapshot_id=snapshot_id,
                rule_id="nesting/depth",
                count=max_depth,
                locations=[deepest_location],
            ))

        return float(max_depth)

    # ... _measure_state, _measure_async, _measure_coupling 유사 구현
```

### 4.2 정준 편차 계산 (deviation.py)

```python
import numpy as np


# 모듈 타입별 정준 프로파일 μ_t
CANONICAL_PROFILES: dict[str, ComplexityVector] = {
    "api/external": ComplexityVector(C=3, N=2, S=1, A=1, L=2),
    "lib/domain": ComplexityVector(C=5, N=3, S=2, A=0, L=3),
    "app": ComplexityVector(C=8, N=4, S=3, A=2, L=5),
    "infra": ComplexityVector(C=4, N=2, S=2, A=3, L=4),
}


def get_canonical_profile(architecture_role: str) -> ComplexityVector:
    """모듈 타입의 정준 프로파일 반환"""
    return CANONICAL_PROFILES.get(architecture_role, CANONICAL_PROFILES["app"])


def calculate_deviation(x: ComplexityVector, architecture_role: str) -> float:
    """
    정준 편차 계산

    d_u = ‖x_u / μ_t(u) - 1‖₂
    """
    mu = get_canonical_profile(architecture_role)

    x_arr = x.to_array()
    mu_arr = mu.to_array()

    # 0으로 나누기 방지
    mu_arr = np.where(mu_arr == 0, 1e-6, mu_arr)

    # 정규화된 편차
    normalized = x_arr / mu_arr - 1

    # L2 norm
    return float(np.linalg.norm(normalized))


def calculate_delta_deviation(d_before: float, d_after: float) -> float:
    """
    편차 변화량 계산

    Δd = d(k) - d(k-1)

    Δd < 0: 정준 수렴 (좋음)
    Δd > 0: 정준 이탈 (나쁨)
    """
    return d_after - d_before
```

### 4.3 Hodge Bucket 분류 (hodge.py)

```python
def classify_hodge(x: ComplexityVector) -> HodgeBucket:
    """
    Hodge bucket 분류

    algorithmic  = C + N     (🧀 Cheese)
    balanced     = A
    architectural = S + Λ    (🍞 Bread + 🥓 Ham)
    """
    algorithmic = x.C + x.N
    balanced = x.A
    architectural = x.S + x.L

    max_val = max(algorithmic, balanced, architectural)

    if max_val == algorithmic:
        return HodgeBucket.ALGORITHMIC
    elif max_val == balanced:
        return HodgeBucket.BALANCED
    else:
        return HodgeBucket.ARCHITECTURAL


def get_hodge_scores(x: ComplexityVector) -> dict[str, float]:
    """Hodge bucket별 점수"""
    return {
        "algorithmic": x.C + x.N,
        "balanced": x.A,
        "architectural": x.S + x.L,
    }
```

---

## 5. 에너지 모듈 (energy)

### 5.1 잠재 함수 계산 (potential.py)

```python
@dataclass
class PotentialConfig:
    """잠재 함수 가중치 설정"""
    lambda_1: float = 1.0    # 정준 편차 가중치
    lambda_2: float = 0.5    # 간선 가중치 (bad coupling)
    lambda_3: float = 0.3    # 운영 페널티 가중치


@dataclass
class PotentialResult:
    """잠재 함수 계산 결과"""
    phi: float
    deviation_sum: float
    edge_weight_sum: float
    ops_penalty: float
    components: dict[str, float]


def calculate_phi(
    metrics: list[Metrics],
    edges: list[Edge],
    ops_penalty: float = 0.0,
    config: PotentialConfig | None = None,
) -> PotentialResult:
    """
    전역 잠재 함수 계산

    Φ(k) = λ₁·Σ_u d_u(k) + λ₂·Σ_e w(e) + λ₃·OpsPenalty(k)
    """
    cfg = config or PotentialConfig()

    # Σ d_u
    deviation_sum = sum(m.d for m in metrics)

    # Σ w(e) for bad coupling edges
    edge_weight_sum = sum(
        e.weight_total for e in edges
        if e.is_boundary_crossing() or e.weight_components.coupling > 0.5
    )

    # Φ 계산
    phi = (
        cfg.lambda_1 * deviation_sum +
        cfg.lambda_2 * edge_weight_sum +
        cfg.lambda_3 * ops_penalty
    )

    return PotentialResult(
        phi=phi,
        deviation_sum=deviation_sum,
        edge_weight_sum=edge_weight_sum,
        ops_penalty=ops_penalty,
        components={
            "deviation": cfg.lambda_1 * deviation_sum,
            "edge": cfg.lambda_2 * edge_weight_sum,
            "ops": cfg.lambda_3 * ops_penalty,
        },
    )
```

### 5.2 ΔΦ 계산 (delta.py)

```python
@dataclass
class DeltaPhiResult:
    """ΔΦ 계산 결과"""
    delta_phi: float
    phi_before: float
    phi_after: float
    improved: bool           # ΔΦ < 0


def calculate_delta_phi(
    phi_before: PotentialResult,
    phi_after: PotentialResult,
) -> DeltaPhiResult:
    """
    에너지 변화량 계산

    ΔΦ = Φ(after) - Φ(before)

    ΔΦ < 0: 에너지 감소 (좋음)
    ΔΦ > 0: 에너지 증가 (나쁨)
    """
    delta = phi_after.phi - phi_before.phi

    return DeltaPhiResult(
        delta_phi=delta,
        phi_before=phi_before.phi,
        phi_after=phi_after.phi,
        improved=delta < 0,
    )
```

### 5.3 수렴 판정 (convergence.py)

```python
@dataclass
class ConvergenceResult:
    """수렴 판정 결과"""
    converged: bool
    delta_phi: float
    epsilon: float
    iterations: int          # 연속 수렴 횟수
    message: str


DEFAULT_EPSILON = 0.01
MIN_CONVERGENCE_ITERATIONS = 3


def check_convergence(
    delta_phi: float,
    epsilon: float = DEFAULT_EPSILON,
    previous_iterations: int = 0,
) -> ConvergenceResult:
    """
    ε-수렴 판정

    |ΔΦ| < ε → 수렴
    """
    is_converging = abs(delta_phi) < epsilon

    iterations = previous_iterations + 1 if is_converging else 0
    converged = iterations >= MIN_CONVERGENCE_ITERATIONS

    if converged:
        message = f"Converged: |ΔΦ|={abs(delta_phi):.4f} < ε={epsilon} for {iterations} iterations"
    elif is_converging:
        message = f"Converging: |ΔΦ|={abs(delta_phi):.4f} < ε={epsilon} ({iterations}/{MIN_CONVERGENCE_ITERATIONS})"
    else:
        message = f"Not converged: |ΔΦ|={abs(delta_phi):.4f} ≥ ε={epsilon}"

    return ConvergenceResult(
        converged=converged,
        delta_phi=delta_phi,
        epsilon=epsilon,
        iterations=iterations,
        message=message,
    )


def can_issue_adr(
    convergence: ConvergenceResult,
    flux_stable: bool,
    evidence_complete: bool,
    gate_passed: bool,
) -> tuple[bool, str]:
    """
    ADR 발급 가능 여부 판정

    조건:
    - |ΔΦ| < ε (수렴)
    - Flux_boundary 안정
    - Evidence 완비
    - Gate(G) = false (여전히 실패)
    """
    if not convergence.converged:
        return False, f"Not converged: {convergence.message}"

    if not flux_stable:
        return False, "Boundary flux is unstable"

    if not evidence_complete:
        return False, "Evidence is incomplete"

    if gate_passed:
        return False, "Gate passed - no ADR needed"

    return True, "ADR can be issued: Essential Complexity confirmed"
```

---

## 6. Flux 모듈 (flux)

### 6.1 경계 흐름 계산 (boundary.py)

```python
@dataclass
class FluxResult:
    """경계 흐름 계산 결과"""
    flux: float
    boundary_edge_count: int
    avg_weight_per_edge: float


def calculate_boundary_flux(edges: list[Edge]) -> FluxResult:
    """
    경계 흐름 계산

    Flux_boundary(k) = Σ w(e)  where boundary(e) = 1
    """
    boundary_edges = [e for e in edges if e.is_boundary_crossing()]

    flux = sum(e.weight_total for e in boundary_edges)
    count = len(boundary_edges)
    avg = flux / count if count > 0 else 0.0

    return FluxResult(
        flux=flux,
        boundary_edge_count=count,
        avg_weight_per_edge=avg,
    )
```

### 6.2 경계 악화 탐지 (degradation.py)

```python
@dataclass
class DegradationResult:
    """경계 악화 탐지 결과"""
    degraded: bool
    delta_flux: float
    avg_load_exceeded: bool
    message: str


BOUNDARY_LOAD_THRESHOLD = 2.0  # α


def detect_boundary_degradation(
    flux_before: FluxResult,
    flux_after: FluxResult,
) -> DegradationResult:
    """
    경계 악화 탐지

    경고 조건:
    - ΔFlux > 0 (경계 약화)
    - Flux / |E_boundary| > α (경계당 평균 부하 초과)
    """
    delta_flux = flux_after.flux - flux_before.flux
    avg_load_exceeded = flux_after.avg_weight_per_edge > BOUNDARY_LOAD_THRESHOLD

    degraded = delta_flux > 0 or avg_load_exceeded

    if degraded:
        reasons = []
        if delta_flux > 0:
            reasons.append(f"ΔFlux={delta_flux:.2f} > 0")
        if avg_load_exceeded:
            reasons.append(f"avg_load={flux_after.avg_weight_per_edge:.2f} > {BOUNDARY_LOAD_THRESHOLD}")
        message = f"🍞 Bread weakening: {', '.join(reasons)}"
    else:
        message = "Boundary stable"

    return DegradationResult(
        degraded=degraded,
        delta_flux=delta_flux,
        avg_load_exceeded=avg_load_exceeded,
        message=message,
    )
```

---

## 7. View 모듈 (view)

### 7.1 Hotspot Trajectory (hotspot.py)

```python
@dataclass
class HotspotCandidate:
    """인지 붕괴 후보"""
    entity_id: str
    consecutive_increases: int
    current_d: float
    trend: list[float]       # d values over time
    severity: Literal["low", "medium", "high", "critical"]


HOTSPOT_WINDOW = 5           # w: 연속 증가 윈도우
RAW_SUM_THRESHOLD = 20.0


def detect_hotspots(
    entity_id: str,
    d_history: list[float],  # d values over snapshots
    raw_sum: float,
) -> HotspotCandidate | None:
    """
    View A: Hotspot Trajectory

    탐지 조건:
    - ∀i ∈ [k-w, k]: d_u(i) > d_u(i-1) (w 연속 증가)
    - rawSumRatio(k) > threshold
    """
    if len(d_history) < 2:
        return None

    # 연속 증가 횟수 계산
    consecutive = 0
    for i in range(len(d_history) - 1, 0, -1):
        if d_history[i] > d_history[i-1]:
            consecutive += 1
        else:
            break

    is_hotspot = consecutive >= HOTSPOT_WINDOW or raw_sum > RAW_SUM_THRESHOLD

    if not is_hotspot:
        return None

    # 심각도 판정
    if consecutive >= HOTSPOT_WINDOW and raw_sum > RAW_SUM_THRESHOLD:
        severity = "critical"
    elif consecutive >= HOTSPOT_WINDOW:
        severity = "high"
    elif raw_sum > RAW_SUM_THRESHOLD:
        severity = "medium"
    else:
        severity = "low"

    return HotspotCandidate(
        entity_id=entity_id,
        consecutive_increases=consecutive,
        current_d=d_history[-1],
        trend=d_history[-HOTSPOT_WINDOW:] if len(d_history) >= HOTSPOT_WINDOW else d_history,
        severity=severity,
    )
```

### 7.2 ROI Ranking (roi.py)

```python
@dataclass
class RefactorCandidate:
    """리팩토링 후보"""
    delta_id: str            # refactoring identifier
    description: str
    delta_phi: float         # expected ΔΦ
    cost: float
    roi: float               # -ΔΦ / Cost
    affected_entities: list[str]


@dataclass
class CostFactors:
    """비용 요소"""
    files_changed: int
    public_api_changed: int
    schema_changed: int
    policy_touched: int
    test_delta: int


COST_WEIGHTS = {
    "files": 1.0,            # η₁
    "api": 3.0,              # η₂
    "schema": 5.0,           # η₃
    "policy": 4.0,           # η₄
    "test": 2.0,             # η₅
}


def calculate_cost(factors: CostFactors) -> float:
    """
    Cost(Δ) = η₁·#filesChanged + η₂·#publicAPIChanged + ...
    """
    return (
        COST_WEIGHTS["files"] * factors.files_changed +
        COST_WEIGHTS["api"] * factors.public_api_changed +
        COST_WEIGHTS["schema"] * factors.schema_changed +
        COST_WEIGHTS["policy"] * factors.policy_touched +
        COST_WEIGHTS["test"] * factors.test_delta
    )


def calculate_roi(delta_phi: float, cost: float) -> float:
    """
    ROI(Δ) = -ΔΦ / Cost(Δ)
    """
    if cost <= 0:
        return 0.0
    return -delta_phi / cost


def rank_refactor_candidates(
    candidates: list[RefactorCandidate],
    top_k: int = 10,
) -> list[RefactorCandidate]:
    """
    View C: ROI 기준 정렬

    후보 정렬: ROI(Δ₁) > ROI(Δ₂) > ... > ROI(Δₙ)
    """
    return sorted(candidates, key=lambda c: c.roi, reverse=True)[:top_k]


def format_for_llm(candidates: list[RefactorCandidate]) -> str:
    """LLM 제공용 포맷"""
    lines = ["Top-K ROI 후보:"]
    for i, c in enumerate(candidates, 1):
        lines.append(f"{i}. {c.description}")
        lines.append(f"   ROI={c.roi:.2f}, Cost={c.cost:.1f}, -ΔΦ={-c.delta_phi:.2f}")
    return "\n".join(lines)
```

---

## 8. ADR/Waiver 모듈 (gate/adr)

### 8.1 ADR 스키마 (schema.py)

```python
from dataclasses import dataclass, field
from datetime import date, timedelta
from enum import Enum


class ADRStatus(Enum):
    DRAFT = "draft"
    APPROVED = "approved"
    DEPRECATED = "deprecated"
    SUPERSEDED = "superseded"


class ExpiryStatus(Enum):
    ACTIVE = "active"
    WARNING = "warning"
    EXPIRED = "expired"


@dataclass
class ApprovalInfo:
    approved_date: date
    grace_period: timedelta
    approver: str

    @property
    def expiry_date(self) -> date:
        return self.approved_date + self.grace_period


@dataclass
class ConvergenceProof:
    """수렴 증명"""
    snapshot_before: str
    snapshot_after: str
    delta_phi: float
    epsilon: float
    iterations: int
    evidence_complete: bool

    @property
    def is_valid(self) -> bool:
        return (
            abs(self.delta_phi) < self.epsilon and
            self.iterations >= MIN_CONVERGENCE_ITERATIONS and
            self.evidence_complete
        )


@dataclass
class TargetMetrics:
    """타겟별 메트릭"""
    x: list[float]           # [C, N, S, A, Λ]
    d: float
    hodge: str


@dataclass
class TargetFile:
    path: str
    signals: list[str] = field(default_factory=list)
    metrics: TargetMetrics | None = None


@dataclass
class Thresholds:
    nesting: int | None = None
    concepts: int | None = None


@dataclass
class ADRDocument:
    """ADR 문서 (수렴 증명 포함)"""
    schema_version: str
    id: str
    title: str
    status: ADRStatus
    approval: ApprovalInfo
    convergence: ConvergenceProof     # NEW: 수렴 증명
    targets: list[TargetFile]
    thresholds: Thresholds
    rationale: str
    references: list[str] = field(default_factory=list)

    def get_target(self, file_path: str) -> TargetFile | None:
        normalized = file_path.replace("\\", "/")
        for target in self.targets:
            if normalized.endswith(target.path) or target.path in normalized:
                return target
        return None

    def is_applicable(self, file_path: str) -> bool:
        return self.get_target(file_path) is not None
```

### 8.2 검증기 (validator.py) - 수렴 검증 추가

```python
@dataclass
class ValidationError:
    field: str
    message: str
    severity: Literal["error", "warning"]


@dataclass
class ValidationResult:
    valid: bool
    errors: list[ValidationError]
    warnings: list[ValidationError]


class ADRValidator:
    """ADR 유효성 검증기 (수렴 검증 포함)"""

    def validate(self, adr: ADRDocument) -> ValidationResult:
        errors: list[ValidationError] = []
        warnings: list[ValidationError] = []

        # 기존 검증
        self._validate_required_fields(adr, errors)
        self._validate_status(adr, errors, warnings)
        self._validate_grace_period(adr, errors, warnings)
        self._validate_thresholds(adr, errors)
        self._validate_signals(adr, errors, warnings)

        # NEW: 수렴 증명 검증
        self._validate_convergence(adr, errors)

        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
        )

    def _validate_convergence(self, adr: ADRDocument, errors: list[ValidationError]):
        """수렴 증명 검증"""
        conv = adr.convergence

        # ε-수렴 조건
        if abs(conv.delta_phi) >= conv.epsilon:
            errors.append(ValidationError(
                "convergence.delta_phi",
                f"|ΔΦ|={abs(conv.delta_phi):.4f} ≥ ε={conv.epsilon} - not converged",
                "error"
            ))

        # 연속 수렴 횟수
        if conv.iterations < MIN_CONVERGENCE_ITERATIONS:
            errors.append(ValidationError(
                "convergence.iterations",
                f"iterations={conv.iterations} < {MIN_CONVERGENCE_ITERATIONS} required",
                "error"
            ))

        # Evidence 완비
        if not conv.evidence_complete:
            errors.append(ValidationError(
                "convergence.evidence_complete",
                "Evidence is incomplete",
                "error"
            ))

        # 스냅샷 존재 확인 (실제 검증은 외부에서)
        if not conv.snapshot_before or not conv.snapshot_after:
            errors.append(ValidationError(
                "convergence.snapshots",
                "Snapshot references required",
                "error"
            ))
```

---

## 9. MCP 통합

### 9.1 check_gate 수정

```python
@mcp.tool()
def check_gate(
    source: str,
    file_path: str | None = None,
    gate_type: str = "mvp",
    project_root: str | None = None,
) -> dict:
    """Gate 검사 + Waiver 정보 + 수렴 상태"""

    # 기존 Gate 로직...

    # Waiver 정보
    waiver_info = None
    if result.cheese.waiver:
        w = result.cheese.waiver
        waiver_info = {
            "applied": result.cheese.waived,
            "adr_path": w.adr_path,
            "status": w.expiry.status.value if w.expiry else None,
            "expiry_date": str(w.expiry.expiry_date) if w.expiry else None,
            "remaining_days": w.expiry.remaining_days if w.expiry else None,
            "convergence": {
                "delta_phi": w.adr.convergence.delta_phi if w.adr else None,
                "epsilon": w.adr.convergence.epsilon if w.adr else None,
                "converged": w.adr.convergence.is_valid if w.adr else False,
            } if w.adr and w.adr.convergence else None,
            "adjustments": w.adjustments,
        }

    return {
        # ... 기존 필드 ...
        "waiver": waiver_info,
    }


@mcp.tool()
def check_adr_eligibility(
    source: str,
    file_path: str,
    snapshot_before: str,
    snapshot_after: str,
) -> dict:
    """ADR 발급 자격 확인"""

    # 측정
    metrics_before = measure_metrics(source, snapshot_before)
    metrics_after = measure_metrics(source, snapshot_after)

    # 에너지 계산
    phi_before = calculate_phi(metrics_before)
    phi_after = calculate_phi(metrics_after)
    delta = calculate_delta_phi(phi_before, phi_after)

    # 수렴 판정
    convergence = check_convergence(delta.delta_phi)

    # Flux 계산
    flux_before = calculate_boundary_flux(edges_before)
    flux_after = calculate_boundary_flux(edges_after)
    degradation = detect_boundary_degradation(flux_before, flux_after)

    # Evidence 확인
    evidence_complete = all(m.rule_hits for m in metrics_after)

    # Gate 결과
    gate_result = check_gate(source, file_path)

    # ADR 발급 가능 여부
    can_issue, reason = can_issue_adr(
        convergence=convergence,
        flux_stable=not degradation.degraded,
        evidence_complete=evidence_complete,
        gate_passed=gate_result["passed"],
    )

    return {
        "eligible": can_issue,
        "reason": reason,
        "convergence": {
            "converged": convergence.converged,
            "delta_phi": convergence.delta_phi,
            "epsilon": convergence.epsilon,
            "iterations": convergence.iterations,
        },
        "flux": {
            "stable": not degradation.degraded,
            "delta_flux": degradation.delta_flux,
            "message": degradation.message,
        },
        "evidence": {
            "complete": evidence_complete,
        },
        "gate": {
            "passed": gate_result["passed"],
        },
    }
```

---

## 10. 테스트 계획

### 10.1 단위 테스트

| 모듈 | 테스트 케이스 |
|------|---------------|
| measurement/vector.py | 5D 벡터 측정, rule_hits 생성 |
| measurement/deviation.py | 정준 편차 계산, Δd 계산 |
| measurement/hodge.py | Hodge bucket 분류 |
| energy/potential.py | Φ(k) 계산 |
| energy/convergence.py | ε-수렴 판정 |
| flux/boundary.py | Flux 계산 |
| flux/degradation.py | 경계 악화 탐지 |
| view/hotspot.py | Hotspot 탐지 |
| view/roi.py | ROI 계산 및 정렬 |
| gate/adr/validator.py | 수렴 증명 검증 |

### 10.2 통합 테스트

- 전체 파이프라인: Source → Metrics → Φ → Convergence → ADR
- MCP check_gate + check_adr_eligibility 연동
- 실제 코드베이스 기반 수렴 시뮬레이션

---

## 11. 저장소 아키텍처

### 11.1 전체 파이프라인

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PIPELINE                                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │ Analyzer    │───▶│ Graph       │───▶│ Ingestor    │───▶│ Interpreter │  │
│  │ (AST→벡터)  │    │ Builder     │    │ (DB 적재)   │    │ (쿼리/판정) │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│        │                  │                  │                  │           │
│        ▼                  ▼                  ▼                  ▼           │
│   entities          edges            snapshots           Evidence          │
│   metrics         w_components       upsert             Packager           │
│   rule_hits                          versioning         (JSON 패킷)        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 11.2 SQL 모델 (Postgres)

**용도**: 추적/감사/리포트, Δ 쿼리, 정합성

```sql
-- 1) snapshots (커밋 단위)
CREATE TABLE snapshots (
  snapshot_id BIGSERIAL PRIMARY KEY,
  repo TEXT NOT NULL,
  commit_hash TEXT NOT NULL,
  release_id TEXT NOT NULL,           -- commit prefix(8)
  ts TIMESTAMPTZ NOT NULL,
  analyzer_version TEXT NOT NULL,
  profile_version TEXT NOT NULL,
  matrix_version TEXT NOT NULL,
  UNIQUE(repo, commit_hash)
);

-- 2) entities (정체성: 시간에 독립적인 ID)
CREATE TABLE entities (
  entity_id UUID PRIMARY KEY,
  repo TEXT NOT NULL,
  entity_type TEXT NOT NULL,          -- module|file|function|object
  language TEXT NOT NULL,
  path TEXT,
  symbol TEXT,
  fingerprint TEXT NOT NULL,          -- AST 기반 stable fingerprint
  UNIQUE(repo, fingerprint)
);

-- 3) metrics (엔티티 × 스냅샷)
CREATE TABLE metrics (
  snapshot_id BIGINT NOT NULL REFERENCES snapshots(snapshot_id),
  entity_id UUID NOT NULL REFERENCES entities(entity_id),
  architecture_role TEXT NOT NULL,
  module_confidence REAL NOT NULL,

  -- 5D 벡터
  c REAL NOT NULL,
  n REAL NOT NULL,
  s REAL NOT NULL,
  a REAL NOT NULL,
  lambda REAL NOT NULL,

  -- 파생 점수
  raw_sum REAL NOT NULL,
  raw_sum_threshold REAL NOT NULL,
  raw_sum_ratio REAL NOT NULL,
  tensor_score REAL NOT NULL,
  tensor_zone TEXT NOT NULL,          -- safe|review|violation
  canonical_deviation REAL NOT NULL,

  -- Hodge bucket
  h_alg INT NOT NULL,
  h_bal INT NOT NULL,
  h_arch INT NOT NULL,

  PRIMARY KEY(snapshot_id, entity_id)
);

-- 4) rule_hits (근거: 왜 점수가 이렇게 나왔나)
CREATE TABLE rule_hits (
  snapshot_id BIGINT NOT NULL REFERENCES snapshots(snapshot_id),
  entity_id UUID NOT NULL REFERENCES entities(entity_id),
  rule_id TEXT NOT NULL,
  hit_count INT NOT NULL,
  locations JSONB,                    -- [{path, startLine, endLine, nodeType}, ...]
  PRIMARY KEY(snapshot_id, entity_id, rule_id)
);

-- 5) edges (스냅샷별 그래프)
CREATE TABLE edges (
  snapshot_id BIGINT NOT NULL REFERENCES snapshots(snapshot_id),
  src_entity_id UUID NOT NULL REFERENCES entities(entity_id),
  dst_entity_id UUID NOT NULL REFERENCES entities(entity_id),
  edge_type TEXT NOT NULL,            -- import|call|data|auth|deploy
  w_total REAL NOT NULL,
  w_components JSONB,                 -- {coupling, boundary, cognitive, failure}
  PRIMARY KEY(snapshot_id, src_entity_id, dst_entity_id, edge_type)
);
```

### 11.3 인덱스

```sql
-- Hotspot 조회
CREATE INDEX idx_metrics_hotspot
  ON metrics(snapshot_id, canonical_deviation DESC);

-- rawSumRatio 조회
CREATE INDEX idx_metrics_raw_ratio
  ON metrics(snapshot_id, raw_sum_ratio DESC);

-- Boundary edges 조회
CREATE INDEX idx_edges_boundary
  ON edges(snapshot_id, edge_type, w_total DESC);

-- 경로 기반 조회
CREATE INDEX idx_entities_path
  ON entities(repo, path);

-- 규칙별 히트 조회
CREATE INDEX idx_rule_hits_rule
  ON rule_hits(snapshot_id, rule_id);
```

### 11.4 핵심 쿼리

#### (A) Hotspot Top 20

```sql
SELECT e.entity_type, e.path, e.symbol,
       m.canonical_deviation, m.tensor_score, m.raw_sum_ratio
FROM metrics m
JOIN entities e ON e.entity_id = m.entity_id
WHERE m.snapshot_id = :sid
ORDER BY m.canonical_deviation DESC
LIMIT 20;
```

#### (B) Δ(증가량) 위험 급증 엔티티

```sql
WITH cur AS (
  SELECT entity_id, canonical_deviation AS d
  FROM metrics WHERE snapshot_id = :sid
),
prev AS (
  SELECT entity_id, canonical_deviation AS d
  FROM metrics WHERE snapshot_id = :sid_prev
)
SELECT e.path, e.symbol, (cur.d - prev.d) AS delta_d
FROM cur JOIN prev USING(entity_id)
JOIN entities e ON e.entity_id = cur.entity_id
ORDER BY delta_d DESC
LIMIT 50;
```

#### (C) Boundary Flux (🍞 얇아지는지)

```sql
SELECT SUM(w_total) AS boundary_flux
FROM edges
WHERE snapshot_id = :sid
  AND (w_components->>'boundary')::float > 0;
```

#### (D) 수렴 상태 확인 (연속 ΔΦ)

```sql
WITH phi_history AS (
  SELECT snapshot_id,
         SUM(canonical_deviation) AS phi,
         LAG(SUM(canonical_deviation)) OVER (ORDER BY snapshot_id) AS phi_prev
  FROM metrics
  WHERE snapshot_id IN (:recent_sids)
  GROUP BY snapshot_id
)
SELECT snapshot_id,
       phi,
       (phi - phi_prev) AS delta_phi,
       ABS(phi - phi_prev) < :epsilon AS converging
FROM phi_history
ORDER BY snapshot_id;
```

### 11.5 NoSQL 모델 (MongoDB/Document)

**용도**: Evidence packet 아카이브, 가변 구조, 릴리스 승인 패킷

```json
// snapshots/{repo}/{commit_hash}
{
  "repo": "semantic-complexity",
  "commit": "abcdef1234...",
  "releaseId": "abcdef12",
  "ts": "2025-12-31T05:00:00Z",
  "versions": {
    "analyzer": "0.0.13",
    "profiles": "2025-12-30",
    "matrix": "m1"
  },
  "entities": [
    {
      "entityId": "uuid-1234",
      "type": "function",
      "path": "src/py/semantic_complexity/analyzers/cheese.py",
      "symbol": "semantic_complexity.analyzers.cheese.analyze_cheese",
      "architectureRole": { "inferred": "lib/domain", "confidence": 0.95 },
      "vector": { "C": 12, "N": 7, "S": 3, "A": 0, "L": 5 },
      "scores": {
        "rawSum": 27,
        "rawSumRatio": 0.74,
        "tensor": 12.5,
        "deviation": 0.23
      },
      "hodge": { "alg": 19, "bal": 0, "arch": 8 },
      "ruleHits": [
        {
          "ruleId": "nesting/depth",
          "count": 7,
          "locations": [
            { "line": 120, "nodeType": "FunctionDef" },
            { "line": 145, "nodeType": "If" }
          ]
        },
        {
          "ruleId": "control/branch",
          "count": 12,
          "locations": [...]
        }
      ]
    }
  ],
  "edges": [
    {
      "src": "uuid-1234",
      "dst": "uuid-5678",
      "type": "import",
      "w": 2.1,
      "components": { "coupling": 0.8, "boundary": 0, "cognitive": 0.5, "failure": 0.8 }
    }
  ],
  "summary": {
    "totalEntities": 45,
    "totalEdges": 120,
    "phi": 15.23,
    "boundaryFlux": 8.5
  },
  "convergence": {
    "deltaPhi": 0.005,
    "epsilon": 0.01,
    "iterations": 3,
    "converged": true
  }
}
```

### 11.6 Graph DB (Neo4j) - 선택

**용도**: 구조적 해석, 경로/커뮤니티/중심성 분석

```cypher
// 노드 생성
CREATE (e:Entity {
  entityId: 'uuid-1234',
  type: 'function',
  path: 'src/py/semantic_complexity/analyzers/cheese.py',
  symbol: 'analyze_cheese',
  deviation: 0.23
})

// 관계 생성
MATCH (src:Entity {entityId: 'uuid-1234'})
MATCH (dst:Entity {entityId: 'uuid-5678'})
CREATE (src)-[:CALLS {w: 2.1, boundary: 0.5}]->(dst)

// Boundary crossing이 많은 함수 주변 2-hop 서브그래프
MATCH path = (e:Entity)-[r*1..2]-(neighbor)
WHERE e.deviation > 0.5
  AND ANY(rel IN relationships(path) WHERE rel.boundary > 0)
RETURN path
LIMIT 100

// Hotspot 영향 범위 분석
MATCH (hotspot:Entity {entityId: :hotspot_id})
MATCH (hotspot)-[*1..3]-(affected)
RETURN DISTINCT affected.path, affected.symbol, affected.deviation
ORDER BY affected.deviation DESC
```

### 11.7 권장 구성

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STORAGE ARCHITECTURE                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Postgres (메인)                                                      │    │
│  │ - entities, metrics, edges, snapshots, rule_hits                    │    │
│  │ - 정합성 보장, Δ 쿼리, 리포트                                        │    │
│  │ - Hotspot/Flux/ROI 분석                                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                               │
│                              ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Document Store (보조)                                                │    │
│  │ - MongoDB / JSON files                                               │    │
│  │ - Evidence packet 원본 아카이브                                      │    │
│  │ - 감사/승인 첨부용                                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                              │                                               │
│                              ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Neo4j (선택)                                                         │    │
│  │ - 구조적 해석 (경로, 커뮤니티, 중심성)                               │    │
│  │ - "왜 여기가 hotspot인가?" 구조적 설명                               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 11.8 Self-Validation 전략

```
semantic-complexity 자기 검증:
1. 자신의 소스코드를 분석
2. metrics/edges/rule_hits 생성
3. Φ(k) 계산
4. 이전 스냅샷과 비교 → ΔΦ
5. 수렴 상태 확인
6. Gate 통과 여부 판정

┌─────────────────────────────────────────────────────────────────┐
│  Self-Validation Pipeline                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  semantic-complexity/    ──▶  Analyzer  ──▶  DB 적재           │
│  (source)                                       │               │
│                                                 ▼               │
│                                          Φ(k) 계산             │
│                                                 │               │
│                                                 ▼               │
│  semantic-complexity/    ◀──  Gate 판정  ◀──  ΔΦ 비교         │
│  (validated)                                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. Python 저장소 구현 (Lightweight)

### 12.1 SQLite 기반 (로컬 개발용)

```python
# graph/store.py
import sqlite3
import json
from pathlib import Path
from dataclasses import asdict


class SQLiteStore:
    """SQLite 기반 로컬 저장소"""

    SCHEMA = """
    CREATE TABLE IF NOT EXISTS snapshots (
        snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
        repo TEXT NOT NULL,
        commit_hash TEXT NOT NULL,
        release_id TEXT NOT NULL,
        ts TEXT NOT NULL,
        analyzer_version TEXT NOT NULL,
        UNIQUE(repo, commit_hash)
    );

    CREATE TABLE IF NOT EXISTS entities (
        entity_id TEXT PRIMARY KEY,
        repo TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        language TEXT NOT NULL,
        path TEXT,
        symbol TEXT,
        fingerprint TEXT NOT NULL,
        UNIQUE(repo, fingerprint)
    );

    CREATE TABLE IF NOT EXISTS metrics (
        snapshot_id INTEGER NOT NULL,
        entity_id TEXT NOT NULL,
        architecture_role TEXT NOT NULL,
        c REAL, n REAL, s REAL, a REAL, lambda REAL,
        raw_sum REAL,
        canonical_deviation REAL,
        h_alg INTEGER, h_bal INTEGER, h_arch INTEGER,
        PRIMARY KEY(snapshot_id, entity_id)
    );

    CREATE TABLE IF NOT EXISTS rule_hits (
        snapshot_id INTEGER NOT NULL,
        entity_id TEXT NOT NULL,
        rule_id TEXT NOT NULL,
        hit_count INTEGER NOT NULL,
        locations TEXT,
        PRIMARY KEY(snapshot_id, entity_id, rule_id)
    );

    CREATE TABLE IF NOT EXISTS edges (
        snapshot_id INTEGER NOT NULL,
        src_entity_id TEXT NOT NULL,
        dst_entity_id TEXT NOT NULL,
        edge_type TEXT NOT NULL,
        w_total REAL NOT NULL,
        w_components TEXT,
        PRIMARY KEY(snapshot_id, src_entity_id, dst_entity_id, edge_type)
    );

    CREATE INDEX IF NOT EXISTS idx_metrics_deviation
        ON metrics(snapshot_id, canonical_deviation DESC);
    """

    def __init__(self, db_path: Path | str = ":memory:"):
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self):
        self.conn.executescript(self.SCHEMA)
        self.conn.commit()

    def insert_snapshot(self, snapshot: Snapshot) -> int:
        cursor = self.conn.execute("""
            INSERT INTO snapshots (repo, commit_hash, release_id, ts, analyzer_version)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(repo, commit_hash) DO UPDATE SET ts = excluded.ts
            RETURNING snapshot_id
        """, (snapshot.repo, snapshot.commit, snapshot.commit[:8],
              snapshot.timestamp.isoformat(), "0.0.13"))
        self.conn.commit()
        return cursor.fetchone()[0]

    def insert_metrics(self, snapshot_id: int, metrics: Metrics):
        self.conn.execute("""
            INSERT OR REPLACE INTO metrics
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            snapshot_id, metrics.entity_id, metrics.architecture_role,
            metrics.x.C, metrics.x.N, metrics.x.S, metrics.x.A, metrics.x.L,
            metrics.raw_sum, metrics.d,
            int(metrics.x.C + metrics.x.N),  # h_alg
            int(metrics.x.A),                 # h_bal
            int(metrics.x.S + metrics.x.L),   # h_arch
        ))
        self.conn.commit()

    def get_hotspots(self, snapshot_id: int, limit: int = 20) -> list[dict]:
        cursor = self.conn.execute("""
            SELECT e.entity_type, e.path, e.symbol,
                   m.canonical_deviation, m.raw_sum
            FROM metrics m
            JOIN entities e ON e.entity_id = m.entity_id
            WHERE m.snapshot_id = ?
            ORDER BY m.canonical_deviation DESC
            LIMIT ?
        """, (snapshot_id, limit))
        return [dict(row) for row in cursor.fetchall()]

    def get_delta_deviations(self, sid_cur: int, sid_prev: int) -> list[dict]:
        cursor = self.conn.execute("""
            WITH cur AS (
                SELECT entity_id, canonical_deviation AS d FROM metrics WHERE snapshot_id = ?
            ),
            prev AS (
                SELECT entity_id, canonical_deviation AS d FROM metrics WHERE snapshot_id = ?
            )
            SELECT e.path, e.symbol, (cur.d - prev.d) AS delta_d
            FROM cur JOIN prev USING(entity_id)
            JOIN entities e ON e.entity_id = cur.entity_id
            ORDER BY delta_d DESC
            LIMIT 50
        """, (sid_cur, sid_prev))
        return [dict(row) for row in cursor.fetchall()]

    def get_boundary_flux(self, snapshot_id: int) -> float:
        cursor = self.conn.execute("""
            SELECT SUM(w_total) AS flux
            FROM edges
            WHERE snapshot_id = ?
              AND json_extract(w_components, '$.boundary') > 0
        """, (snapshot_id,))
        row = cursor.fetchone()
        return row["flux"] or 0.0
```

### 12.2 JSON 기반 Evidence Packager

```python
# evidence/packager.py
import json
from datetime import datetime
from pathlib import Path
from dataclasses import asdict


class EvidencePackager:
    """Evidence packet JSON 생성기"""

    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def package(
        self,
        snapshot: Snapshot,
        entities: list[Entity],
        metrics: list[Metrics],
        rule_hits: list[RuleHit],
        edges: list[Edge],
        convergence: ConvergenceResult | None = None,
    ) -> Path:
        """Evidence packet 생성"""
        packet = {
            "repo": snapshot.repo,
            "commit": snapshot.commit,
            "releaseId": snapshot.commit[:8],
            "ts": snapshot.timestamp.isoformat(),
            "versions": {
                "analyzer": "0.0.13",
                "profiles": datetime.now().strftime("%Y-%m-%d"),
            },
            "entities": self._build_entities(entities, metrics, rule_hits),
            "edges": self._build_edges(edges),
            "summary": self._build_summary(metrics, edges),
        }

        if convergence:
            packet["convergence"] = {
                "deltaPhi": convergence.delta_phi,
                "epsilon": convergence.epsilon,
                "iterations": convergence.iterations,
                "converged": convergence.converged,
            }

        # 저장
        filename = f"{snapshot.repo}_{snapshot.commit[:8]}.json"
        output_path = self.output_dir / filename
        output_path.write_text(json.dumps(packet, indent=2, ensure_ascii=False))

        return output_path

    def _build_entities(
        self,
        entities: list[Entity],
        metrics: list[Metrics],
        rule_hits: list[RuleHit],
    ) -> list[dict]:
        metrics_map = {m.entity_id: m for m in metrics}
        hits_map: dict[str, list[RuleHit]] = {}
        for h in rule_hits:
            hits_map.setdefault(h.entity_id, []).append(h)

        result = []
        for e in entities:
            m = metrics_map.get(e.entity_id)
            hits = hits_map.get(e.entity_id, [])

            entity_data = {
                "entityId": e.entity_id,
                "type": e.type.value,
                "path": e.path,
                "symbol": e.symbol,
            }

            if m:
                entity_data["architectureRole"] = {
                    "inferred": m.architecture_role,
                    "confidence": m.confidence,
                }
                entity_data["vector"] = {
                    "C": m.x.C, "N": m.x.N, "S": m.x.S, "A": m.x.A, "L": m.x.L
                }
                entity_data["scores"] = {
                    "rawSum": m.raw_sum,
                    "deviation": m.d,
                }
                entity_data["hodge"] = {
                    "alg": int(m.x.C + m.x.N),
                    "bal": int(m.x.A),
                    "arch": int(m.x.S + m.x.L),
                }

            if hits:
                entity_data["ruleHits"] = [
                    {
                        "ruleId": h.rule_id,
                        "count": h.count,
                        "locations": [asdict(loc) for loc in h.locations],
                    }
                    for h in hits
                ]

            result.append(entity_data)

        return result

    def _build_edges(self, edges: list[Edge]) -> list[dict]:
        return [
            {
                "src": e.src_entity,
                "dst": e.dst_entity,
                "type": e.edge_type.value,
                "w": e.weight_total,
                "components": asdict(e.weight_components),
            }
            for e in edges
        ]

    def _build_summary(self, metrics: list[Metrics], edges: list[Edge]) -> dict:
        phi = sum(m.d for m in metrics)
        boundary_flux = sum(
            e.weight_total for e in edges
            if e.is_boundary_crossing()
        )
        return {
            "totalEntities": len(metrics),
            "totalEdges": len(edges),
            "phi": phi,
            "boundaryFlux": boundary_flux,
        }
```

---

## 13. 참조

- [SRS-WAIVER.ko.md](SRS-WAIVER.ko.md) - 요구사항 명세
- [THEORY.ko.md](THEORY.ko.md) - Ham Sandwich 이론적 기반
- Lyapunov Stability Theory - 에너지 함수 수렴 분석
- PostgreSQL JSON Functions - w_components 쿼리
- SQLite JSON1 Extension - 로컬 개발용
