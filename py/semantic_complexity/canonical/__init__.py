"""
Canonical Profile System

모듈 타입별 기준 프로파일 및 자동 탐지
"""

from .detector import (
    detect_module_type,
    detect_module_type_from_content,
    detect_with_fallback,
)
from ..types.profile import (
    CanonicalProfile,
    ChangeBudget,
    Threshold,
    CANONICAL_PROFILES,
    get_canonical_profile,
)

__all__ = [
    # Detection
    "detect_module_type",
    "detect_module_type_from_content",
    "detect_with_fallback",
    # Profiles (re-export)
    "CanonicalProfile",
    "ChangeBudget",
    "Threshold",
    "CANONICAL_PROFILES",
    "get_canonical_profile",
]
