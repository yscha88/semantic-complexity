"""
전역 잠재 함수 Φ(k) 계산

Φ(k) = λ₁·Σ_u d_u(k) + λ₂·Σ_e w(e) + λ₃·OpsPenalty(k)

에너지 함수로서의 Φ:
- Φ가 작을수록 시스템이 안정적
- Φ 감소 = 리팩토링 효과
- Φ 수렴 = 더 이상 개선 여지 없음 (본질적 복잡도)
"""

__architecture_role__ = "lib/domain"

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..graph.edge import Edge
    from ..measurement.vector import ComplexityVector


@dataclass
class PotentialConfig:
    """잠재 함수 가중치 설정

    λ₁: 정준 편차 가중치
    λ₂: 간선 가중치 (bad coupling)
    λ₃: 운영 페널티 가중치
    """
    lambda_1: float = 1.0    # 정준 편차 가중치
    lambda_2: float = 0.5    # 간선 가중치 (bad coupling)
    lambda_3: float = 0.3    # 운영 페널티 가중치


@dataclass
class PotentialResult:
    """잠재 함수 계산 결과

    phi: 최종 에너지 값
    deviation_sum: Σd_u
    edge_weight_sum: Σw(e)
    ops_penalty: 운영 페널티
    components: 구성요소별 기여도
    """
    phi: float
    deviation_sum: float
    edge_weight_sum: float
    ops_penalty: float
    components: dict[str, float]


@dataclass
class MetricsInput:
    """Metrics 입력 (간소화된 인터페이스)"""
    entity_id: str
    d: float  # canonical deviation


@dataclass
class EdgeInput:
    """Edge 입력 (간소화된 인터페이스)"""
    src_entity: str
    dst_entity: str
    weight_total: float
    is_boundary: bool
    coupling: float


def calculate_phi(
    metrics: list[MetricsInput],
    edges: list[EdgeInput],
    ops_penalty: float = 0.0,
    config: PotentialConfig | None = None,
) -> PotentialResult:
    """전역 잠재 함수 계산

    Φ(k) = λ₁·Σ_u d_u(k) + λ₂·Σ_e w(e) + λ₃·OpsPenalty(k)

    Args:
        metrics: 엔티티별 메트릭 (deviation 포함)
        edges: 그래프 간선
        ops_penalty: 운영 페널티 (인시던트, 장애 등)
        config: 가중치 설정

    Returns:
        PotentialResult

    에너지 함수 해석:
    - deviation_sum: 코드 품질 (정준에서 이탈)
    - edge_weight_sum: 구조적 문제 (나쁜 의존성)
    - ops_penalty: 운영 문제 (실제 장애)
    """
    cfg = config or PotentialConfig()

    # Σ d_u: 모든 엔티티의 정준 편차 합
    deviation_sum = sum(m.d for m in metrics)

    # Σ w(e): bad coupling 간선의 가중치 합
    # boundary crossing 또는 높은 결합도 간선만 포함
    edge_weight_sum = sum(
        e.weight_total for e in edges
        if e.is_boundary or e.coupling > 0.5
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


def calculate_phi_simple(
    deviations: list[float],
    edge_weights: list[float] | None = None,
    ops_penalty: float = 0.0,
    config: PotentialConfig | None = None,
) -> PotentialResult:
    """간소화된 잠재 함수 계산

    Args:
        deviations: 편차 값 리스트
        edge_weights: 간선 가중치 리스트 (옵션)
        ops_penalty: 운영 페널티
        config: 가중치 설정

    Returns:
        PotentialResult
    """
    cfg = config or PotentialConfig()

    deviation_sum = sum(deviations)
    edge_weight_sum = sum(edge_weights) if edge_weights else 0.0

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


# ============================================================
# 공개 API
# ============================================================

__all__ = [
    "PotentialConfig",
    "PotentialResult",
    "MetricsInput",
    "EdgeInput",
    "calculate_phi",
    "calculate_phi_simple",
]
