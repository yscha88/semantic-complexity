"""
Simplex 정규화

Raw scores → SandwichScore (bread + cheese + ham = 100)
"""

import math
from dataclasses import dataclass

from ..types import (
    SandwichScore,
    RawScores,
    RawBreadScore,
    RawCheeseScore,
    RawHamScore,
)
from ..analyzers import BreadResult, CognitiveAnalysis, HamResult


@dataclass
class Deviation:
    """Canonical으로부터의 편차"""
    bread: float   # + 초과, - 미달
    cheese: float
    ham: float

    @property
    def distance(self) -> float:
        """L2 거리 (유클리드 거리)"""
        return math.sqrt(
            self.bread ** 2 +
            self.cheese ** 2 +
            self.ham ** 2
        )

    @property
    def max_deviation(self) -> tuple[str, float]:
        """가장 큰 편차 축과 값"""
        deviations = [
            ("🍞", abs(self.bread)),
            ("🧀", abs(self.cheese)),
            ("🥓", abs(self.ham)),
        ]
        return max(deviations, key=lambda x: x[1])


def normalize_to_simplex(
    bread: float,
    cheese: float,
    ham: float,
) -> SandwichScore:
    """
    Raw 점수를 Simplex로 정규화

    불변조건: bread + cheese + ham = 100
    """
    total = bread + cheese + ham

    if total == 0:
        return SandwichScore.balanced()

    return SandwichScore(
        bread=(bread / total) * 100,
        cheese=(cheese / total) * 100,
        ham=(ham / total) * 100,
    )


def results_to_raw_scores(
    bread_result: BreadResult,
    cheese_result: CognitiveAnalysis,
    ham_result: HamResult,
) -> RawScores:
    """분석 결과를 RawScores로 변환

    CognitiveAnalysis 매핑:
    - max_nesting → cognitive_complexity 대용
    - len(hidden_dependencies) → hidden_coupling
    - state_async_retry.violated → 불변조건 위반
    """
    # 🧀 Cheese: 인지 가능 여부 기반 점수 계산
    # accessible=True면 낮은 복잡도, False면 높은 복잡도
    cheese_score = 0 if cheese_result.accessible else (
        cheese_result.max_nesting * 2 +
        len(cheese_result.hidden_dependencies) +
        (10 if cheese_result.state_async_retry.violated else 0)
    )

    return RawScores(
        bread=RawBreadScore(
            trust_boundary_count=bread_result.trust_boundary_count,
            auth_explicitness=bread_result.auth_explicitness,
            secret_lifecycle_score=1.0 - (len(bread_result.secret_patterns) * 0.1),
            blast_radius=bread_result.blast_radius,
        ),
        cheese=RawCheeseScore(
            cognitive_complexity=cheese_score,
            nesting_penalty=cheese_result.max_nesting,
            hidden_coupling=len(cheese_result.hidden_dependencies),
            state_async_retry_violation=cheese_result.state_async_retry.violated,
        ),
        ham=RawHamScore(
            golden_test_coverage=ham_result.golden_test_coverage,
            contract_test_exists=ham_result.contract_test_exists,
            critical_paths_protected=ham_result.critical_paths_protected,
            critical_paths_total=ham_result.critical_paths_total,
        ),
    )


def results_to_sandwich(
    bread_result: BreadResult,
    cheese_result: CognitiveAnalysis,
    ham_result: HamResult,
) -> SandwichScore:
    """분석 결과를 SandwichScore로 변환"""
    raw = results_to_raw_scores(bread_result, cheese_result, ham_result)
    return raw.to_sandwich()


def calculate_deviation(
    current: SandwichScore,
    canonical: SandwichScore,
) -> Deviation:
    """현재 점수와 Canonical 간의 편차 계산"""
    return Deviation(
        bread=current.bread - canonical.bread,
        cheese=current.cheese - canonical.cheese,
        ham=current.ham - canonical.ham,
    )


def is_in_equilibrium(
    current: SandwichScore,
    canonical: SandwichScore,
    threshold: float = 10.0,
) -> bool:
    """
    균형 영역 내에 있는지 확인

    Args:
        current: 현재 점수
        canonical: 기준 점수
        threshold: 허용 편차 (기본 10%)

    Returns:
        True if 모든 축이 threshold 이내
    """
    deviation = calculate_deviation(current, canonical)
    return (
        abs(deviation.bread) <= threshold and
        abs(deviation.cheese) <= threshold and
        abs(deviation.ham) <= threshold
    )
