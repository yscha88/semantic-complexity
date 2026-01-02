"""
경계 악화 (Boundary Degradation) 탐지

경계 약화 조건:
- ΔFlux > 0: 경계 통과 트래픽 증가
- Flux / |E_boundary| > α: 경계당 평균 부하 초과

Bread 약화 = 보안 경계 침식 = 위험
"""

__module_type__ = "lib/domain"

from dataclasses import dataclass
from enum import Enum

from .boundary import FluxResult


# ============================================================
# 상수
# ============================================================

BOUNDARY_LOAD_THRESHOLD = 2.0  # α: 경계당 평균 부하 임계값


# ============================================================
# 타입 정의
# ============================================================

class DegradationSeverity(Enum):
    """악화 심각도"""
    NONE = "none"
    MILD = "mild"
    MODERATE = "moderate"
    SEVERE = "severe"


@dataclass
class DegradationResult:
    """경계 악화 탐지 결과

    degraded: 악화 여부
    delta_flux: 흐름 변화량
    avg_load_exceeded: 평균 부하 초과 여부
    severity: 심각도
    message: 상태 메시지
    """
    degraded: bool
    delta_flux: float
    avg_load_exceeded: bool
    severity: DegradationSeverity
    message: str


# ============================================================
# 악화 탐지
# ============================================================

def detect_boundary_degradation(
    flux_before: FluxResult,
    flux_after: FluxResult,
    threshold: float = BOUNDARY_LOAD_THRESHOLD,
) -> DegradationResult:
    """경계 악화 탐지

    경고 조건:
    - ΔFlux > 0: 경계 약화
    - Flux / |E_boundary| > α: 경계당 평균 부하 초과

    Args:
        flux_before: 이전 스냅샷의 경계 흐름
        flux_after: 이후 스냅샷의 경계 흐름
        threshold: 평균 부하 임계값 (α)

    Returns:
        DegradationResult
    """
    delta_flux = flux_after.flux - flux_before.flux
    avg_load_exceeded = flux_after.avg_weight_per_edge > threshold

    flux_increased = delta_flux > 0
    degraded = flux_increased or avg_load_exceeded

    # 심각도 판정
    severity = _calculate_severity(delta_flux, avg_load_exceeded, threshold, flux_after)

    # 메시지 생성
    message = _build_message(degraded, delta_flux, avg_load_exceeded, threshold, flux_after)

    return DegradationResult(
        degraded=degraded,
        delta_flux=delta_flux,
        avg_load_exceeded=avg_load_exceeded,
        severity=severity,
        message=message,
    )


def _calculate_severity(
    delta_flux: float,
    avg_load_exceeded: bool,
    threshold: float,
    flux_after: FluxResult,
) -> DegradationSeverity:
    """심각도 계산

    SEVERE: ΔFlux > 0 AND 평균 부하 초과
    MODERATE: ΔFlux > threshold 또는 평균 부하 > 2 * threshold
    MILD: ΔFlux > 0 또는 평균 부하 초과
    NONE: 악화 없음
    """
    flux_increased = delta_flux > 0
    large_increase = delta_flux > threshold
    very_high_load = flux_after.avg_weight_per_edge > threshold * 2

    if flux_increased and avg_load_exceeded:
        return DegradationSeverity.SEVERE
    elif large_increase or very_high_load:
        return DegradationSeverity.MODERATE
    elif flux_increased or avg_load_exceeded:
        return DegradationSeverity.MILD
    else:
        return DegradationSeverity.NONE


def _build_message(
    degraded: bool,
    delta_flux: float,
    avg_load_exceeded: bool,
    threshold: float,
    flux_after: FluxResult,
) -> str:
    """상태 메시지 생성"""
    if not degraded:
        return "Boundary stable"

    reasons = []
    if delta_flux > 0:
        reasons.append(f"ΔFlux={delta_flux:.2f} > 0")
    if avg_load_exceeded:
        reasons.append(
            f"avg_load={flux_after.avg_weight_per_edge:.2f} > {threshold}"
        )

    return f"Bread weakening: {', '.join(reasons)}"


def detect_degradation_simple(
    flux_before: float,
    flux_after: float,
    edge_count: int,
    threshold: float = BOUNDARY_LOAD_THRESHOLD,
) -> DegradationResult:
    """간소화된 악화 탐지

    Args:
        flux_before: 이전 flux
        flux_after: 이후 flux
        edge_count: 경계 간선 수
        threshold: 임계값

    Returns:
        DegradationResult
    """
    delta_flux = flux_after - flux_before
    avg_load = flux_after / edge_count if edge_count > 0 else 0.0
    avg_load_exceeded = avg_load > threshold

    flux_increased = delta_flux > 0
    degraded = flux_increased or avg_load_exceeded

    if flux_increased and avg_load_exceeded:
        severity = DegradationSeverity.SEVERE
    elif delta_flux > threshold or avg_load > threshold * 2:
        severity = DegradationSeverity.MODERATE
    elif flux_increased or avg_load_exceeded:
        severity = DegradationSeverity.MILD
    else:
        severity = DegradationSeverity.NONE

    if degraded:
        reasons = []
        if flux_increased:
            reasons.append(f"ΔFlux={delta_flux:.2f}")
        if avg_load_exceeded:
            reasons.append(f"avg_load={avg_load:.2f}")
        message = f"Bread weakening: {', '.join(reasons)}"
    else:
        message = "Boundary stable"

    return DegradationResult(
        degraded=degraded,
        delta_flux=delta_flux,
        avg_load_exceeded=avg_load_exceeded,
        severity=severity,
        message=message,
    )


def is_flux_stable(
    flux_before: FluxResult,
    flux_after: FluxResult,
    threshold: float = BOUNDARY_LOAD_THRESHOLD,
) -> bool:
    """경계 흐름 안정 여부

    ADR 발급 조건 중 하나.

    Args:
        flux_before: 이전 flux
        flux_after: 이후 flux
        threshold: 임계값

    Returns:
        안정 여부 (악화되지 않음)
    """
    result = detect_boundary_degradation(flux_before, flux_after, threshold)
    return not result.degraded


# ============================================================
# 공개 API
# ============================================================

__all__ = [
    "DegradationResult",
    "DegradationSeverity",
    "BOUNDARY_LOAD_THRESHOLD",
    "detect_boundary_degradation",
    "detect_degradation_simple",
    "is_flux_stable",
]
