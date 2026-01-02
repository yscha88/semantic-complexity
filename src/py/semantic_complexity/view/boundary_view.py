"""
View B: Boundary Flux

경계 흐름 분석 View:
- 경계 간선 현황
- Flux 추이
- 악화 경고

Bread (보안) 관련 가시화.
"""

__module_type__ = "lib/domain"

from dataclasses import dataclass

from ..flux.boundary import FluxResult
from ..flux.degradation import DegradationResult, DegradationSeverity


@dataclass
class BoundaryEdgeInfo:
    """경계 간선 정보"""
    src: str
    dst: str
    weight: float
    edge_type: str


@dataclass
class BoundaryView:
    """경계 흐름 View

    flux: 현재 flux
    delta_flux: flux 변화량 (있으면)
    degradation: 악화 결과 (있으면)
    top_edges: 가중치 높은 경계 간선
    """
    flux: FluxResult
    delta_flux: float | None = None
    degradation: DegradationResult | None = None
    top_edges: list[BoundaryEdgeInfo] | None = None


def create_boundary_view(
    flux_current: FluxResult,
    flux_previous: FluxResult | None = None,
    degradation: DegradationResult | None = None,
    edges: list[BoundaryEdgeInfo] | None = None,
    top_k: int = 10,
) -> BoundaryView:
    """Boundary View 생성

    Args:
        flux_current: 현재 flux
        flux_previous: 이전 flux (있으면 delta 계산)
        degradation: 악화 결과
        edges: 경계 간선 목록
        top_k: 상위 간선 수

    Returns:
        BoundaryView
    """
    delta_flux = None
    if flux_previous:
        delta_flux = flux_current.flux - flux_previous.flux

    top_edges = None
    if edges:
        sorted_edges = sorted(edges, key=lambda e: e.weight, reverse=True)
        top_edges = sorted_edges[:top_k]

    return BoundaryView(
        flux=flux_current,
        delta_flux=delta_flux,
        degradation=degradation,
        top_edges=top_edges,
    )


def format_boundary_view(view: BoundaryView) -> str:
    """LLM 제공용 포맷

    Args:
        view: BoundaryView

    Returns:
        포맷된 문자열
    """
    lines = ["Boundary Flux View:"]

    # Flux 현황
    lines.append(f"  flux: {view.flux.flux:.2f}")
    lines.append(f"  boundary_edges: {view.flux.boundary_edge_count}")
    lines.append(f"  avg_weight: {view.flux.avg_weight_per_edge:.2f}")

    # Delta
    if view.delta_flux is not None:
        direction = "↑" if view.delta_flux > 0 else "↓" if view.delta_flux < 0 else "→"
        lines.append(f"  delta_flux: {view.delta_flux:+.2f} {direction}")

    # 악화 경고
    if view.degradation:
        d = view.degradation
        if d.degraded:
            severity_emoji = {
                DegradationSeverity.NONE: "✅",
                DegradationSeverity.MILD: "🟡",
                DegradationSeverity.MODERATE: "🟠",
                DegradationSeverity.SEVERE: "🔴",
            }[d.severity]
            lines.append(f"  status: {severity_emoji} {d.message}")
        else:
            lines.append("  status: ✅ Stable")

    # Top edges
    if view.top_edges:
        lines.append("  top_boundary_edges:")
        for e in view.top_edges[:5]:
            lines.append(f"    {e.src} → {e.dst}: {e.weight:.2f} ({e.edge_type})")

    return "\n".join(lines)


def get_boundary_status_summary(view: BoundaryView) -> dict:
    """경계 상태 요약 (JSON용)

    Args:
        view: BoundaryView

    Returns:
        요약 dict
    """
    status = "stable"
    if view.degradation and view.degradation.degraded:
        status = view.degradation.severity.value

    return {
        "status": status,
        "flux": view.flux.flux,
        "boundary_edge_count": view.flux.boundary_edge_count,
        "delta_flux": view.delta_flux,
        "degraded": view.degradation.degraded if view.degradation else False,
    }


# ============================================================
# 공개 API
# ============================================================

__all__ = [
    "BoundaryEdgeInfo",
    "BoundaryView",
    "create_boundary_view",
    "format_boundary_view",
    "get_boundary_status_summary",
]
