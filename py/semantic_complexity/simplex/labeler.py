"""
Simplex 라벨링

모듈/PR에 지배 축 라벨 (🍞/🧀/🥓) 할당
"""

__module_type__ = "lib/domain"

from dataclasses import dataclass
from typing import Literal

from ..types import Axis, SandwichScore


@dataclass
class LabelResult:
    """라벨링 결과"""
    dominant: Axis
    distribution: dict[Axis, float]
    confidence: float  # 지배적 정도 (0.0 ~ 1.0)
    secondary: Axis | None


def get_dominant_label(score: SandwichScore) -> Axis:
    """
    지배적인 축 라벨 반환

    가장 높은 비율의 축을 반환
    """
    if score.bread >= score.cheese and score.bread >= score.ham:
        return Axis.BREAD
    if score.cheese >= score.bread and score.cheese >= score.ham:
        return Axis.CHEESE
    return Axis.HAM


def label_module(score: SandwichScore) -> LabelResult:
    """
    모듈에 라벨 할당

    Returns:
        LabelResult with dominant axis, distribution, and confidence
    """
    distribution = {
        Axis.BREAD: score.bread,
        Axis.CHEESE: score.cheese,
        Axis.HAM: score.ham,
    }

    # 정렬하여 dominant와 secondary 결정
    sorted_axes = sorted(
        distribution.items(),
        key=lambda x: x[1],
        reverse=True,
    )

    dominant = sorted_axes[0][0]
    secondary = sorted_axes[1][0] if len(sorted_axes) > 1 else None

    # Confidence: 1등과 2등의 차이 / 전체
    dominant_value = sorted_axes[0][1]
    secondary_value = sorted_axes[1][1] if len(sorted_axes) > 1 else 0

    # 차이가 클수록 confidence 높음
    gap = dominant_value - secondary_value
    confidence = min(1.0, gap / 50.0)  # 50% 차이면 100% confidence

    return LabelResult(
        dominant=dominant,
        distribution=distribution,
        confidence=confidence,
        secondary=secondary,
    )


def label_pr_changes(
    before: SandwichScore,
    after: SandwichScore,
) -> Axis:
    """
    PR 변경에 라벨 할당

    변화량이 가장 큰 축을 반환
    """
    delta_bread = abs(after.bread - before.bread)
    delta_cheese = abs(after.cheese - before.cheese)
    delta_ham = abs(after.ham - before.ham)

    if delta_bread >= delta_cheese and delta_bread >= delta_ham:
        return Axis.BREAD
    if delta_cheese >= delta_bread and delta_cheese >= delta_ham:
        return Axis.CHEESE
    return Axis.HAM


def classify_change_type(
    before: SandwichScore,
    after: SandwichScore,
) -> Literal["security", "cognitive", "behavioral", "mixed"]:
    """
    변경 유형 분류

    Returns:
        "security": 🍞 보안 관련 변경
        "cognitive": 🧀 인지 복잡도 변경
        "behavioral": 🥓 행동/테스트 변경
        "mixed": 복합 변경
    """
    delta_bread = after.bread - before.bread
    delta_cheese = after.cheese - before.cheese
    delta_ham = after.ham - before.ham

    threshold = 5.0  # 5% 이상 변화를 유의미하게 봄

    significant_changes = []
    if abs(delta_bread) >= threshold:
        significant_changes.append("security")
    if abs(delta_cheese) >= threshold:
        significant_changes.append("cognitive")
    if abs(delta_ham) >= threshold:
        significant_changes.append("behavioral")

    if len(significant_changes) == 0:
        # 가장 큰 변화 기준
        return "security" if abs(delta_bread) >= abs(delta_cheese) and abs(delta_bread) >= abs(delta_ham) else \
               "cognitive" if abs(delta_cheese) >= abs(delta_ham) else \
               "behavioral"
    elif len(significant_changes) == 1:
        return significant_changes[0]  # type: ignore
    else:
        return "mixed"
