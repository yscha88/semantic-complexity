"""
semantic-complexity 타입 정의

핵심 타입:
- Axis: 🍞🧀🥓 3축
- ModuleType: 모듈 타입 (deploy, api-external, ...)
- SandwichScore: Simplex 상의 점수
- CanonicalProfile: 모듈별 기준 프로파일
"""

__module_type__ = "types"

from .axis import Axis, AxisLiteral, AXIS_DESCRIPTIONS
from .module import ModuleType, ModuleTypeLiteral, MODULE_PATTERNS, MODULE_DESCRIPTIONS, DEFAULT_MODULE_TYPE
from .score import (
    SandwichScore,
    RawScores,
    RawBreadScore,
    RawCheeseScore,
    RawHamScore,
)
from .profile import (
    CanonicalProfile,
    ChangeBudget,
    Threshold,
    CANONICAL_PROFILES,
    get_canonical_profile,
)

__all__ = [
    # Axis
    "Axis",
    "AxisLiteral",
    "AXIS_DESCRIPTIONS",
    # Module
    "ModuleType",
    "ModuleTypeLiteral",
    "MODULE_PATTERNS",
    "MODULE_DESCRIPTIONS",
    "DEFAULT_MODULE_TYPE",
    # Score
    "SandwichScore",
    "RawScores",
    "RawBreadScore",
    "RawCheeseScore",
    "RawHamScore",
    # Profile
    "CanonicalProfile",
    "ChangeBudget",
    "Threshold",
    "CANONICAL_PROFILES",
    "get_canonical_profile",
]
