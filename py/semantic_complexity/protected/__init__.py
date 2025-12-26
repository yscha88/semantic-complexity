"""
Protected Zone System

보호 구역 파일 탐지 및 ADR 요구사항
"""

__module_type__ = "lib/domain"

from .patterns import (
    is_protected,
    check_protected,
    get_zone_category,
    check_adr_reference,
    check_pr_for_protected_changes,
    ProtectedZoneChecker,
    ProtectionCheckResult,
    ProtectedZone,
    DEPLOY_PROTECTED_ZONES,
    SOURCE_PROTECTED_ZONES,
    ALL_PROTECTED_ZONES,
)

__all__ = [
    "is_protected",
    "check_protected",
    "get_zone_category",
    "check_adr_reference",
    "check_pr_for_protected_changes",
    "ProtectedZoneChecker",
    "ProtectionCheckResult",
    "ProtectedZone",
    "DEPLOY_PROTECTED_ZONES",
    "SOURCE_PROTECTED_ZONES",
    "ALL_PROTECTED_ZONES",
]
