"""
energy 모듈

잠재 함수 Φ 계산 및 ε-수렴 판정.

구성요소:
- potential: 전역 잠재 함수 Φ(k) 계산
- delta: ΔΦ 계산
- convergence: ε-수렴 판정 및 ADR 발급 조건 검사
"""

__architecture_role__ = "lib/domain"

from .potential import (
    PotentialConfig,
    PotentialResult,
    calculate_phi,
)
from .delta import (
    DeltaPhiResult,
    calculate_delta_phi,
)
from .convergence import (
    ConvergenceResult,
    DEFAULT_EPSILON,
    MIN_CONVERGENCE_ITERATIONS,
    check_convergence,
    can_issue_adr,
)

__all__ = [
    # Potential
    "PotentialConfig",
    "PotentialResult",
    "calculate_phi",
    # Delta
    "DeltaPhiResult",
    "calculate_delta_phi",
    # Convergence
    "ConvergenceResult",
    "DEFAULT_EPSILON",
    "MIN_CONVERGENCE_ITERATIONS",
    "check_convergence",
    "can_issue_adr",
]
