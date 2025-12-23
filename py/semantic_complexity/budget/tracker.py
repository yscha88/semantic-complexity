"""
Change Budget Tracker

PR당 변경 예산 추적 및 검사

| Module Type   | ΔCognitive | ΔState | ΔPublicAPI | Breaking |
|---------------|------------|--------|------------|----------|
| api-external  | ≤ 3        | ≤ 1    | ≤ 2        | NO       |
| api-internal  | ≤ 5        | ≤ 2    | ≤ 3        | with ADR |
| app           | ≤ 8        | ≤ 3    | N/A        | N/A      |
| lib-domain    | ≤ 5        | ≤ 2    | ≤ 5        | with ADR |
| lib-infra     | ≤ 8        | ≤ 3    | ≤ 3        | with ADR |
| deploy        | ≤ 2        | N/A    | N/A        | ADR+Review|
"""

__module_type__ = "lib/domain"

from dataclasses import dataclass, field
from typing import Literal

from ..types import ModuleType, ChangeBudget, get_canonical_profile, DEFAULT_MODULE_TYPE
from ..analyzers import CognitiveAnalysis


@dataclass
class BudgetViolation:
    """예산 위반 항목"""
    dimension: str
    allowed: int
    actual: int
    excess: int

    @property
    def message(self) -> str:
        """위반 메시지"""
        return f"{self.dimension}: {self.actual} > {self.allowed} (초과: {self.excess})"


@dataclass
class BudgetCheckResult:
    """예산 검사 결과"""
    passed: bool
    module_type: ModuleType
    violations: list[BudgetViolation] = field(default_factory=list)

    # Delta 값들
    delta_cognitive: int = 0
    delta_state_transitions: int = 0
    delta_public_api: int = 0
    has_breaking_changes: bool = False

    @property
    def summary(self) -> str:
        """결과 요약"""
        if self.passed:
            return f"✅ Budget check PASSED for {self.module_type}"

        violation_msgs = [v.message for v in self.violations]
        return f"❌ Budget EXCEEDED: {', '.join(violation_msgs)}"


@dataclass
class Delta:
    """변경량"""
    cognitive: int = 0
    state_transitions: int = 0
    public_api: int = 0
    breaking_changes: bool = False


class BudgetTracker:
    """Change Budget 추적기"""

    def __init__(self, module_type: ModuleType):
        self.module_type = module_type
        self.profile = get_canonical_profile(module_type)
        self.budget = self.profile.change_budget

    def check(self, delta: Delta) -> BudgetCheckResult:
        """
        예산 대비 변경량 검사

        Args:
            delta: 변경량

        Returns:
            BudgetCheckResult: 검사 결과
        """
        violations: list[BudgetViolation] = []

        # ΔCognitive 검사
        if delta.cognitive > self.budget.delta_cognitive:
            violations.append(BudgetViolation(
                dimension="ΔCognitive",
                allowed=self.budget.delta_cognitive,
                actual=delta.cognitive,
                excess=delta.cognitive - self.budget.delta_cognitive,
            ))

        # ΔState 검사
        if delta.state_transitions > self.budget.delta_state_transitions:
            violations.append(BudgetViolation(
                dimension="ΔState",
                allowed=self.budget.delta_state_transitions,
                actual=delta.state_transitions,
                excess=delta.state_transitions - self.budget.delta_state_transitions,
            ))

        # ΔPublicAPI 검사 (app 제외)
        if self.module_type != DEFAULT_MODULE_TYPE:
            if delta.public_api > self.budget.delta_public_api:
                violations.append(BudgetViolation(
                    dimension="ΔPublicAPI",
                    allowed=self.budget.delta_public_api,
                    actual=delta.public_api,
                    excess=delta.public_api - self.budget.delta_public_api,
                ))

        # Breaking changes 검사
        if delta.breaking_changes and not self.budget.breaking_changes_allowed:
            violations.append(BudgetViolation(
                dimension="BreakingChanges",
                allowed=0,
                actual=1,
                excess=1,
            ))

        return BudgetCheckResult(
            passed=len(violations) == 0,
            module_type=self.module_type,
            violations=violations,
            delta_cognitive=delta.cognitive,
            delta_state_transitions=delta.state_transitions,
            delta_public_api=delta.public_api,
            has_breaking_changes=delta.breaking_changes,
        )


def calculate_delta(
    before: CognitiveAnalysis,
    after: CognitiveAnalysis,
) -> Delta:
    """
    두 분석 결과 간의 변경량 계산

    Args:
        before: 변경 전 분석 결과
        after: 변경 후 분석 결과

    Returns:
        Delta: 변경량
    """
    # 인지 가능 여부 기반 복잡도 점수 계산
    def score(result: CognitiveAnalysis) -> int:
        if result.accessible:
            return 0
        return (
            result.max_nesting * 2 +
            len(result.hidden_dependencies) +
            (10 if result.state_async_retry.violated else 0)
        )

    return Delta(
        cognitive=score(after) - score(before),
        state_transitions=0,  # TODO: 상태 전이 분석 필요
        public_api=0,  # TODO: Public API 분석 필요
        breaking_changes=False,  # TODO: Breaking change 탐지 필요
    )


# ============================================================
# 공개 API
# ============================================================

def check_budget(
    module_type: ModuleType,
    delta: Delta,
) -> BudgetCheckResult:
    """
    Change Budget 검사

    Args:
        module_type: 모듈 타입
        delta: 변경량

    Returns:
        BudgetCheckResult: 검사 결과
    """
    tracker = BudgetTracker(module_type)
    return tracker.check(delta)


def get_budget(module_type: ModuleType) -> ChangeBudget:
    """모듈 타입의 Change Budget 반환"""
    profile = get_canonical_profile(module_type)
    return profile.change_budget
