"""
view 모듈

분석 View 제공 (LLM/사용자용).

Views:
- hotspot.py: View A - Hotspot Trajectory (인지 붕괴 후보)
- roi.py: View C - Refactor ROI Ranking (리팩토링 ROI)
- boundary.py: View B - Boundary Flux (경계 흐름)
"""

__module_type__ = "lib/domain"

from .hotspot import (
    HotspotCandidate,
    HOTSPOT_WINDOW,
    RAW_SUM_THRESHOLD,
    detect_hotspots,
    detect_hotspots_batch,
)
from .roi import (
    RefactorCandidate,
    CostFactors,
    COST_WEIGHTS,
    calculate_cost,
    calculate_roi,
    rank_refactor_candidates,
    format_for_llm,
)
from .boundary_view import (
    BoundaryView,
    create_boundary_view,
)

__all__ = [
    # Hotspot
    "HotspotCandidate",
    "HOTSPOT_WINDOW",
    "RAW_SUM_THRESHOLD",
    "detect_hotspots",
    "detect_hotspots_batch",
    # ROI
    "RefactorCandidate",
    "CostFactors",
    "COST_WEIGHTS",
    "calculate_cost",
    "calculate_roi",
    "rank_refactor_candidates",
    "format_for_llm",
    # Boundary View
    "BoundaryView",
    "create_boundary_view",
]
