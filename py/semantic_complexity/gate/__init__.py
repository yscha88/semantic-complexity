"""
Gate System

PoC → MVP → Production 게이트 조건 검사
Essential Complexity Waiver 시스템 포함
"""

__module_type__ = "lib/domain"

from .mvp import (
    check_poc_gate,
    check_mvp_gate,
    check_production_gate,
    get_thresholds,
    GateResult,
    BreadGateResult,
    CheeseGateResult,
    HamGateResult,
    MVPGate,
    BASE_THRESHOLDS,
    STAGE_ADJUSTMENTS,
    STAGE_POLICIES,
    POC_THRESHOLDS,
    MVP_THRESHOLDS,
    PRODUCTION_THRESHOLDS,
)

from .waiver import (
    EssentialComplexityConfig,
    ComplexitySignal,
    ComplexityContext,
    WaiverResult,
    parse_essential_complexity,
    detect_complexity_signals,
    detect_complex_imports,
    build_complexity_context,
    check_waiver,
)

__all__ = [
    # Gate API
    "check_poc_gate",
    "check_mvp_gate",
    "check_production_gate",
    "get_thresholds",
    # Gate Results
    "GateResult",
    "BreadGateResult",
    "CheeseGateResult",
    "HamGateResult",
    "MVPGate",
    # Thresholds
    "BASE_THRESHOLDS",
    "STAGE_ADJUSTMENTS",
    "STAGE_POLICIES",
    "POC_THRESHOLDS",
    "MVP_THRESHOLDS",
    "PRODUCTION_THRESHOLDS",
    # Waiver
    "EssentialComplexityConfig",
    "ComplexitySignal",
    "ComplexityContext",
    "WaiverResult",
    "parse_essential_complexity",
    "detect_complexity_signals",
    "detect_complex_imports",
    "build_complexity_context",
    "check_waiver",
]
