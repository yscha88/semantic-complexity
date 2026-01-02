"""
경계 흐름 (Boundary Flux) 계산

Flux_boundary(k) = Σ w(e)  where boundary(e) = 1

Trust Boundary를 넘는 간선들의 가중치 합.
Bread (보안) 관련 핵심 지표.
"""

__module_type__ = "lib/domain"

from dataclasses import dataclass


@dataclass
class FluxResult:
    """경계 흐름 계산 결과

    flux: 총 경계 흐름
    boundary_edge_count: 경계 간선 수
    avg_weight_per_edge: 간선당 평균 가중치
    """
    flux: float
    boundary_edge_count: int
    avg_weight_per_edge: float


@dataclass
class EdgeInput:
    """Edge 입력 (간소화된 인터페이스)"""
    src_entity: str
    dst_entity: str
    weight_total: float
    is_boundary: bool


def calculate_boundary_flux(edges: list[EdgeInput]) -> FluxResult:
    """경계 흐름 계산

    Flux_boundary(k) = Σ w(e)  where boundary(e) = 1

    Args:
        edges: 그래프 간선 목록

    Returns:
        FluxResult

    의미:
    - flux 높음 = 경계 통과 트래픽 많음 (잠재적 보안 위험)
    - flux 증가 = Bread 약화 (경계 침식)
    """
    boundary_edges = [e for e in edges if e.is_boundary]

    flux = sum(e.weight_total for e in boundary_edges)
    count = len(boundary_edges)
    avg = flux / count if count > 0 else 0.0

    return FluxResult(
        flux=flux,
        boundary_edge_count=count,
        avg_weight_per_edge=avg,
    )


def calculate_boundary_flux_simple(
    weights: list[float],
    is_boundary: list[bool],
) -> FluxResult:
    """간소화된 경계 흐름 계산

    Args:
        weights: 간선 가중치 리스트
        is_boundary: 경계 여부 리스트

    Returns:
        FluxResult
    """
    if len(weights) != len(is_boundary):
        raise ValueError("weights와 is_boundary 길이가 다름")

    boundary_weights = [w for w, b in zip(weights, is_boundary) if b]

    flux = sum(boundary_weights)
    count = len(boundary_weights)
    avg = flux / count if count > 0 else 0.0

    return FluxResult(
        flux=flux,
        boundary_edge_count=count,
        avg_weight_per_edge=avg,
    )


def get_boundary_edge_details(edges: list[EdgeInput]) -> list[dict]:
    """경계 간선 상세 정보

    Args:
        edges: 그래프 간선 목록

    Returns:
        경계 간선 상세 목록
    """
    return [
        {
            "src": e.src_entity,
            "dst": e.dst_entity,
            "weight": e.weight_total,
        }
        for e in edges
        if e.is_boundary
    ]


# ============================================================
# 공개 API
# ============================================================

__all__ = [
    "FluxResult",
    "EdgeInput",
    "calculate_boundary_flux",
    "calculate_boundary_flux_simple",
    "get_boundary_edge_details",
]
