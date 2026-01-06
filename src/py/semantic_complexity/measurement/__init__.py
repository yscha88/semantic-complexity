"""
measurement 모듈

5D 복잡도 벡터 측정 및 정준 편차 계산.

구성요소:
- vector: 5D 벡터 [C, N, S, A, Λ] 측정
- deviation: 정준 편차 d_u 계산
- hodge: Hodge bucket 분류
- evidence: RuleHit, Location 증거 수집
"""

__architecture_role__ = "lib/domain"

from .vector import (
    ComplexityVector,
    VectorMeasurement,
    VectorAnalyzer,
)
from .deviation import (
    CANONICAL_5D_PROFILES,
    get_canonical_5d_profile,
    calculate_deviation,
    calculate_delta_deviation,
)
from .hodge import (
    HodgeBucket,
    classify_hodge,
    get_hodge_scores,
)
from .evidence import (
    Location,
    RuleHit,
)

__all__ = [
    # Vector
    "ComplexityVector",
    "VectorMeasurement",
    "VectorAnalyzer",
    # Deviation
    "CANONICAL_5D_PROFILES",
    "get_canonical_5d_profile",
    "calculate_deviation",
    "calculate_delta_deviation",
    # Hodge
    "HodgeBucket",
    "classify_hodge",
    "get_hodge_scores",
    # Evidence
    "Location",
    "RuleHit",
]
