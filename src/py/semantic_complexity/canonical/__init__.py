"""
Canonical Profile System

모듈 타입별 기준 프로파일
"""

__architecture_role__ = "lib/domain"

from ..types.profile import (
    CanonicalProfile,
    ChangeBudget,
    Threshold,
    CANONICAL_PROFILES,
    get_canonical_profile,
)

__all__ = [
    # Profiles
    "CanonicalProfile",
    "ChangeBudget",
    "Threshold",
    "CANONICAL_PROFILES",
    "get_canonical_profile",
]
