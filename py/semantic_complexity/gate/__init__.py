"""
Gate System

PoC → MVP → Production 게이트 조건 검사
"""

__module_type__ = "lib/domain"

from .mvp import (
    check_mvp_gate,
    check_production_gate,
    GateResult,
    BreadGateResult,
    CheeseGateResult,
    HamGateResult,
    MVPGate,
    MVP_THRESHOLDS,
    PRODUCTION_THRESHOLDS,
)

__all__ = [
    "check_mvp_gate",
    "check_production_gate",
    "GateResult",
    "BreadGateResult",
    "CheeseGateResult",
    "HamGateResult",
    "MVPGate",
    "MVP_THRESHOLDS",
    "PRODUCTION_THRESHOLDS",
]
