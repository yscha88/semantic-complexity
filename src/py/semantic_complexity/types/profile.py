"""
Canonical Profile 정의 - 2계층 구조

1차 구조축: 베이스라인 🍞🧀🥓
2차 도메인축: Delta 조정

규제 근거:
- FDA Cybersecurity Guidance (의료기기)
- HIPAA Security Rule 2025 (MFA 필수, 암호화 필수)
- NIS2 Directive (경영진 개인책임)
- EU Cyber Resilience Act (CRA)
- OWASP ASVS 5.0
- ISO 27001:2022
- SOC 2 Type II
- GDPR Art.32
"""

from __future__ import annotations

__module_type__ = "types"

from dataclasses import dataclass
from typing import NamedTuple

from .axis import Axis
from .module import (
    ModuleType,
    StructuralAxis,
    STRUCTURAL_AXES,
    get_registry,
)
from .score import SandwichScore


class Threshold(NamedTuple):
    """축별 임계값"""
    min: float
    max: float


@dataclass(frozen=True)
class ChangeBudget:
    """PR당 변경 예산"""
    delta_cognitive: int
    delta_state_transitions: int
    delta_public_api: int
    breaking_changes_allowed: bool


@dataclass(frozen=True)
class CanonicalProfile:
    """모듈 타입별 Canonical 프로파일"""
    module_type: ModuleType | str
    canonical: SandwichScore
    thresholds: dict[Axis, Threshold]
    change_budget: ChangeBudget


# ============================================================
# 1차 구조축 베이스라인 (Regulatory-based)
# 근거: docs/REGULATORY_WEIGHTS.ko.md
# ============================================================

@dataclass(frozen=True)
class BaselineWeights:
    """1차 구조축 베이스라인 가중치"""
    bread: int  # 🍞 Security
    cheese: int  # 🧀 Cognitive
    ham: int  # 🥓 Behavioral
    rationale: str  # 규제 근거


# 1차 구조축 베이스라인 (규제 기반)
STRUCTURAL_BASELINES: dict[StructuralAxis, BaselineWeights] = {
    "api": BaselineWeights(
        bread=50, cheese=20, ham=30,
        rationale="FDA, HIPAA, NIS2 경계면 중심",
    ),
    "web": BaselineWeights(
        bread=40, cheese=30, ham=30,
        rationale="GDPR, OWASP (XSS/CSRF)",
    ),
    "app": BaselineWeights(
        bread=25, cheese=45, ham=30,
        rationale="OWASP ASVS L2-L3",
    ),
    "job": BaselineWeights(
        bread=30, cheese=35, ham=35,
        rationale="NIS2 가용성, SOC 2",
    ),
    "lib": BaselineWeights(
        bread=20, cheese=25, ham=55,
        rationale="SOC 2 변경관리, FDA 검증",
    ),
    "deploy": BaselineWeights(
        bread=70, cheese=10, ham=20,
        rationale="NIS2, CRA, 경영진 책임",
    ),
    "data": BaselineWeights(
        bread=55, cheese=15, ham=30,
        rationale="HIPAA, GDPR 데이터 보호",
    ),
}


# ============================================================
# 2차 도메인축 Delta (Regulatory-based)
# ============================================================

@dataclass(frozen=True)
class DeltaWeights:
    """2차 도메인축 Delta 가중치"""
    d_bread: int  # Δ🍞
    d_cheese: int  # Δ🧀
    d_ham: int  # Δ🥓
    rationale: str


# 2차 도메인축 Delta
DOMAIN_DELTAS: dict[str, DeltaWeights] = {
    # api/*
    "api/external": DeltaWeights(
        d_bread=+10, d_cheese=-5, d_ham=-5,
        rationale="HIPAA MFA 필수, 계약테스트",
    ),
    "api/internal": DeltaWeights(
        d_bread=-10, d_cheese=+5, d_ham=+5,
        rationale="상대적 유연",
    ),
    "api/gateway": DeltaWeights(
        d_bread=+5, d_cheese=0, d_ham=-5,
        rationale="라우팅, 인증 집중",
    ),

    # web/*
    "web/public": DeltaWeights(
        d_bread=+5, d_cheese=0, d_ham=-5,
        rationale="XSS/CSRF 방어",
    ),
    "web/admin": DeltaWeights(
        d_bread=+10, d_cheese=-5, d_ham=-5,
        rationale="권한 관리, 감사",
    ),
    "web/internal": DeltaWeights(
        d_bread=-10, d_cheese=+5, d_ham=+5,
        rationale="상대적 유연",
    ),

    # app/*
    "app/workflow": DeltaWeights(
        d_bread=-5, d_cheese=+15, d_ham=-10,
        rationale="상태머신 복잡도",
    ),
    "app/adapter": DeltaWeights(
        d_bread=+5, d_cheese=+10, d_ham=-15,
        rationale="CRA 공급망",
    ),
    "app/service": DeltaWeights(
        d_bread=0, d_cheese=0, d_ham=0,
        rationale="균형",
    ),

    # job/*
    "job/batch": DeltaWeights(
        d_bread=0, d_cheese=+10, d_ham=-10,
        rationale="상태 관리",
    ),
    "job/cron": DeltaWeights(
        d_bread=0, d_cheese=+5, d_ham=-5,
        rationale="멱등성",
    ),
    "job/worker": DeltaWeights(
        d_bread=0, d_cheese=+10, d_ham=-10,
        rationale="retry, dead letter",
    ),
    "job/migration": DeltaWeights(
        d_bread=+10, d_cheese=0, d_ham=-10,
        rationale="롤백, 검증",
    ),

    # lib/*
    "lib/domain": DeltaWeights(
        d_bread=-10, d_cheese=+5, d_ham=+5,
        rationale="순수성 강조",
    ),
    "lib/infra": DeltaWeights(
        d_bread=+10, d_cheese=0, d_ham=-10,
        rationale="보안 유틸 포함",
    ),
    "lib/common": DeltaWeights(
        d_bread=0, d_cheese=0, d_ham=0,
        rationale="균형",
    ),

    # deploy/*
    "deploy/cluster": DeltaWeights(
        d_bread=+15, d_cheese=-5, d_ham=-10,
        rationale="NIS2 인프라",
    ),
    "deploy/app": DeltaWeights(
        d_bread=0, d_cheese=0, d_ham=0,
        rationale="기본 배포",
    ),
    "deploy/security": DeltaWeights(
        d_bread=+20, d_cheese=-5, d_ham=-15,
        rationale="모든 규제",
    ),
    "deploy/ci-cd": DeltaWeights(
        d_bread=+5, d_cheese=0, d_ham=-5,
        rationale="공급망 보안",
    ),

    # data/*
    "data/schema": DeltaWeights(
        d_bread=+5, d_cheese=-5, d_ham=0,
        rationale="데이터 무결성",
    ),
    "data/migration": DeltaWeights(
        d_bread=+10, d_cheese=+5, d_ham=-15,
        rationale="HIPAA 복구",
    ),
    "data/seed": DeltaWeights(
        d_bread=-10, d_cheese=0, d_ham=+10,
        rationale="재현성",
    ),
    "data/etl": DeltaWeights(
        d_bread=0, d_cheese=+10, d_ham=-10,
        rationale="상태/변환",
    ),
}


# ============================================================
# 기본 Change Budget (구조축별)
# ============================================================

DEFAULT_CHANGE_BUDGETS: dict[StructuralAxis, ChangeBudget] = {
    "api": ChangeBudget(
        delta_cognitive=3,
        delta_state_transitions=1,
        delta_public_api=2,
        breaking_changes_allowed=False,
    ),
    "web": ChangeBudget(
        delta_cognitive=5,
        delta_state_transitions=2,
        delta_public_api=3,
        breaking_changes_allowed=True,
    ),
    "app": ChangeBudget(
        delta_cognitive=8,
        delta_state_transitions=3,
        delta_public_api=0,
        breaking_changes_allowed=True,
    ),
    "job": ChangeBudget(
        delta_cognitive=5,
        delta_state_transitions=2,
        delta_public_api=0,
        breaking_changes_allowed=True,
    ),
    "lib": ChangeBudget(
        delta_cognitive=5,
        delta_state_transitions=2,
        delta_public_api=5,
        breaking_changes_allowed=True,
    ),
    "deploy": ChangeBudget(
        delta_cognitive=2,
        delta_state_transitions=0,
        delta_public_api=0,
        breaking_changes_allowed=False,
    ),
    "data": ChangeBudget(
        delta_cognitive=3,
        delta_state_transitions=1,
        delta_public_api=0,
        breaking_changes_allowed=False,
    ),
}


# ============================================================
# 프로파일 계산
# ============================================================

def _normalize_weights(bread: int, cheese: int, ham: int) -> tuple[int, int, int]:
    """가중치 정규화 (합 100)"""
    total = bread + cheese + ham
    if total == 0:
        return (33, 33, 34)

    # 정규화
    b = round(bread * 100 / total)
    c = round(cheese * 100 / total)
    h = 100 - b - c  # 반올림 오차 보정

    return (b, c, h)


def calculate_canonical(module_type: ModuleType) -> SandwichScore:
    """
    모듈 타입의 canonical 비율 계산

    계산식:
        최종 가중치 = 1차 베이스라인 + 2차 Delta (정규화)
    """
    # 1차 베이스라인
    baseline = STRUCTURAL_BASELINES.get(module_type.structural)
    if not baseline:
        # fallback: 균형
        return SandwichScore(bread=33, cheese=33, ham=34)

    bread = baseline.bread
    cheese = baseline.cheese
    ham = baseline.ham

    # 2차 Delta 적용
    if module_type.domain:
        full_type = str(module_type)
        delta = DOMAIN_DELTAS.get(full_type)
        if delta:
            bread += delta.d_bread
            cheese += delta.d_cheese
            ham += delta.d_ham

    # 정규화
    b, c, h = _normalize_weights(bread, cheese, ham)
    return SandwichScore(bread=b, cheese=c, ham=h)


def calculate_thresholds(canonical: SandwichScore) -> dict[Axis, Threshold]:
    """canonical 기준 threshold 계산 (±10)"""
    return {
        Axis.BREAD: Threshold(
            min=max(0, canonical.bread - 10),
            max=min(100, canonical.bread + 10),
        ),
        Axis.CHEESE: Threshold(
            min=max(0, canonical.cheese - 10),
            max=min(100, canonical.cheese + 10),
        ),
        Axis.HAM: Threshold(
            min=max(0, canonical.ham - 10),
            max=min(100, canonical.ham + 10),
        ),
    }


def get_canonical_profile(module_type: ModuleType | str) -> CanonicalProfile:
    """
    모듈 타입에 해당하는 Canonical Profile 반환

    Args:
        module_type: ModuleType 객체 또는 문자열 ("api", "api/external")

    Returns:
        CanonicalProfile
    """
    # 문자열이면 변환
    if isinstance(module_type, str):
        module_type = ModuleType.from_string(module_type)

    # Canonical 계산
    canonical = calculate_canonical(module_type)

    # Threshold 계산
    thresholds = calculate_thresholds(canonical)

    # Change budget
    budget = DEFAULT_CHANGE_BUDGETS.get(
        module_type.structural,
        ChangeBudget(
            delta_cognitive=5,
            delta_state_transitions=2,
            delta_public_api=3,
            breaking_changes_allowed=True,
        ),
    )

    return CanonicalProfile(
        module_type=module_type,
        canonical=canonical,
        thresholds=thresholds,
        change_budget=budget,
    )


# ============================================================
# OWASP ASVS 레벨별 조정
# ============================================================

def adjust_for_asvs_level(
    profile: CanonicalProfile,
    level: int,
) -> CanonicalProfile:
    """
    OWASP ASVS 레벨에 따른 프로파일 조정

    | ASVS 레벨 | 적용 대상 | 조정 |
    |-----------|-----------|------|
    | Level 1   | 모든 앱   | 기본 |
    | Level 2   | 민감 데이터 | 🍞+10, 🧀+5 |
    | Level 3   | 금융/의료/정부 | 🍞+20, 🧀+10, 🥓+10 |
    """
    if level < 2:
        return profile

    if level == 2:
        d_bread, d_cheese, d_ham = 10, 5, 0
    else:  # level >= 3
        d_bread, d_cheese, d_ham = 20, 10, 10

    bread = profile.canonical.bread + d_bread
    cheese = profile.canonical.cheese + d_cheese
    ham = profile.canonical.ham + d_ham

    b, c, h = _normalize_weights(bread, cheese, ham)
    new_canonical = SandwichScore(bread=b, cheese=c, ham=h)
    new_thresholds = calculate_thresholds(new_canonical)

    return CanonicalProfile(
        module_type=profile.module_type,
        canonical=new_canonical,
        thresholds=new_thresholds,
        change_budget=profile.change_budget,
    )


# ============================================================
# 캐시된 프로파일 (자주 사용되는 타입)
# ============================================================

CANONICAL_PROFILES: dict[str, CanonicalProfile] = {}


def _init_profiles() -> None:
    """프로파일 캐시 초기화"""
    global CANONICAL_PROFILES

    # 1차 구조축 프로파일
    for axis in STRUCTURAL_AXES:
        module_type = ModuleType(structural=axis)
        CANONICAL_PROFILES[axis] = get_canonical_profile(module_type)

    # 2차 도메인축 프로파일
    for full_type in DOMAIN_DELTAS.keys():
        CANONICAL_PROFILES[full_type] = get_canonical_profile(full_type)


# 초기화
_init_profiles()
