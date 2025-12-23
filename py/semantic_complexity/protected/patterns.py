"""
Protected Zone System

보호 구역 파일 탐지 및 ADR 요구사항

Deploy Repository Protected Zones:
- */rbac/*
- */network-policy/*
- */ingress/*
- */tls/*
- */secrets/*
- */sealed-secrets/*

Source Repository Protected Zones:
- */auth/*, */authn/*, */authz/*
- */crypto/*, */encryption/*
- */patient-data/*, */phi/*, */pii/*
- */audit/*, */logging/audit*
"""

import fnmatch
import re
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class ProtectedZone:
    """보호 구역 정의"""
    pattern: str
    category: str  # "deploy", "auth", "crypto", "sensitive_data", "audit"
    description: str
    requires_adr: bool = True
    requires_review: bool = True


@dataclass
class ProtectionCheckResult:
    """보호 구역 검사 결과"""
    is_protected: bool
    matched_zones: list[ProtectedZone]
    file_path: str
    requirements: list[str] = field(default_factory=list)

    @property
    def summary(self) -> str:
        """결과 요약"""
        if not self.is_protected:
            return f"✅ {self.file_path}: Not in protected zone"

        zones = [z.category for z in self.matched_zones]
        return f"🔒 {self.file_path}: Protected ({', '.join(zones)})"


# ============================================================
# 보호 구역 패턴 정의
# ============================================================

DEPLOY_PROTECTED_ZONES = [
    ProtectedZone("*/rbac/*", "deploy", "RBAC configuration"),
    ProtectedZone("*/network-policy/*", "deploy", "Network policy"),
    ProtectedZone("*/networkpolicy/*", "deploy", "Network policy"),
    ProtectedZone("*/ingress/*", "deploy", "Ingress configuration"),
    ProtectedZone("*/tls/*", "deploy", "TLS certificates"),
    ProtectedZone("*/secrets/*", "deploy", "Secrets management"),
    ProtectedZone("*/sealed-secrets/*", "deploy", "Sealed secrets"),
    ProtectedZone("*/kustomization.yaml", "deploy", "Kustomize config"),
    ProtectedZone("*/values.yaml", "deploy", "Helm values"),
    ProtectedZone("**/argocd/**", "deploy", "ArgoCD configuration"),
]

SOURCE_PROTECTED_ZONES = [
    # Auth
    ProtectedZone("*/auth/*", "auth", "Authentication module"),
    ProtectedZone("*/authn/*", "auth", "Authentication module"),
    ProtectedZone("*/authz/*", "auth", "Authorization module"),
    ProtectedZone("*/authentication/*", "auth", "Authentication module"),
    ProtectedZone("*/authorization/*", "auth", "Authorization module"),
    ProtectedZone("*/oauth/*", "auth", "OAuth module"),
    ProtectedZone("*/jwt/*", "auth", "JWT handling"),
    ProtectedZone("*/session/*", "auth", "Session management"),

    # Crypto
    ProtectedZone("*/crypto/*", "crypto", "Cryptography module"),
    ProtectedZone("*/encryption/*", "crypto", "Encryption module"),
    ProtectedZone("*/signing/*", "crypto", "Digital signing"),
    ProtectedZone("*/hash/*", "crypto", "Hashing module"),

    # Sensitive Data
    ProtectedZone("*/patient-data/*", "sensitive_data", "Patient data (HIPAA)"),
    ProtectedZone("*/phi/*", "sensitive_data", "Protected Health Information"),
    ProtectedZone("*/pii/*", "sensitive_data", "Personally Identifiable Information"),
    ProtectedZone("*/personal/*", "sensitive_data", "Personal data (GDPR)"),

    # Audit
    ProtectedZone("*/audit/*", "audit", "Audit logging"),
    ProtectedZone("*/logging/audit*", "audit", "Audit logging"),
    ProtectedZone("*/compliance/*", "audit", "Compliance module"),
]

ALL_PROTECTED_ZONES = DEPLOY_PROTECTED_ZONES + SOURCE_PROTECTED_ZONES


class ProtectedZoneChecker:
    """보호 구역 검사기"""

    def __init__(self, custom_zones: list[ProtectedZone] | None = None):
        """
        Args:
            custom_zones: 사용자 정의 보호 구역
        """
        self.zones = ALL_PROTECTED_ZONES.copy()
        if custom_zones:
            self.zones.extend(custom_zones)

    def check(self, file_path: str) -> ProtectionCheckResult:
        """
        파일이 보호 구역에 있는지 검사

        Args:
            file_path: 파일 경로

        Returns:
            ProtectionCheckResult: 검사 결과
        """
        # 경로 정규화
        normalized = file_path.replace("\\", "/").lower()

        matched: list[ProtectedZone] = []

        for zone in self.zones:
            pattern = zone.pattern.lower()
            if fnmatch.fnmatch(normalized, pattern):
                matched.append(zone)

        requirements: list[str] = []
        if matched:
            if any(z.requires_adr for z in matched):
                requirements.append("ADR reference required")
            if any(z.requires_review for z in matched):
                requirements.append("Security review required")

        return ProtectionCheckResult(
            is_protected=len(matched) > 0,
            matched_zones=matched,
            file_path=file_path,
            requirements=requirements,
        )

    def check_multiple(self, file_paths: list[str]) -> list[ProtectionCheckResult]:
        """여러 파일 검사"""
        return [self.check(fp) for fp in file_paths]

    def get_protected_files(self, file_paths: list[str]) -> list[str]:
        """보호 구역에 있는 파일들만 반환"""
        results = self.check_multiple(file_paths)
        return [r.file_path for r in results if r.is_protected]


# ============================================================
# ADR 참조 검사
# ============================================================

ADR_PATTERNS = [
    r'ADR[-\s]?\d+',           # ADR-001, ADR 1
    r'adr[-_]?\d+',            # adr_001
    r'docs/adr/',              # docs/adr/ 링크
    r'Architecture Decision',   # 전체 명칭
]


def check_adr_reference(commit_message: str) -> bool:
    """
    커밋 메시지에 ADR 참조가 있는지 확인

    Args:
        commit_message: Git 커밋 메시지

    Returns:
        True if ADR 참조 존재
    """
    for pattern in ADR_PATTERNS:
        if re.search(pattern, commit_message, re.IGNORECASE):
            return True
    return False


def check_pr_for_protected_changes(
    changed_files: list[str],
    pr_description: str,
) -> tuple[bool, list[str]]:
    """
    PR이 보호 구역 변경 시 ADR 참조가 있는지 확인

    Args:
        changed_files: 변경된 파일 목록
        pr_description: PR 설명

    Returns:
        (통과 여부, 위반 파일 목록)
    """
    checker = ProtectedZoneChecker()
    protected_files = checker.get_protected_files(changed_files)

    if not protected_files:
        return (True, [])  # 보호 구역 변경 없음

    # ADR 참조 확인
    has_adr = check_adr_reference(pr_description)

    if has_adr:
        return (True, [])  # ADR 참조 있음

    return (False, protected_files)


# ============================================================
# 공개 API
# ============================================================

def is_protected(file_path: str) -> bool:
    """파일이 보호 구역에 있는지 확인"""
    checker = ProtectedZoneChecker()
    result = checker.check(file_path)
    return result.is_protected


def check_protected(file_path: str) -> ProtectionCheckResult:
    """보호 구역 상세 검사"""
    checker = ProtectedZoneChecker()
    return checker.check(file_path)


def get_zone_category(file_path: str) -> str | None:
    """파일의 보호 구역 카테고리 반환"""
    checker = ProtectedZoneChecker()
    result = checker.check(file_path)
    if result.matched_zones:
        return result.matched_zones[0].category
    return None
