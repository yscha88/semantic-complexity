"""
flux 모듈

경계 흐름 (Boundary Flux) 분석.

Bread (보안 경계) 관련:
- boundary.py: 경계 흐름 계산
- degradation.py: 경계 악화 탐지

Flux_boundary(k) = Σ w(e)  where boundary(e) = 1

경계 악화 경고:
- ΔFlux > 0: 경계 약화
- Flux / |E_boundary| > α: 경계당 평균 부하 초과
"""

__architecture_role__ = "lib/domain"

from .boundary import (
    FluxResult,
    calculate_boundary_flux,
    calculate_boundary_flux_simple,
)
from .degradation import (
    DegradationResult,
    BOUNDARY_LOAD_THRESHOLD,
    detect_boundary_degradation,
    DegradationSeverity,
)

__all__ = [
    # Boundary
    "FluxResult",
    "calculate_boundary_flux",
    "calculate_boundary_flux_simple",
    # Degradation
    "DegradationResult",
    "BOUNDARY_LOAD_THRESHOLD",
    "detect_boundary_degradation",
    "DegradationSeverity",
]
