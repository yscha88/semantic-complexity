"""
균형점 탐지 및 Gradient 계산

Lyapunov 안정성 기반:
- Energy function: E(v) = ||v - c||²
- Gradient: 균형점으로 향하는 방향
"""

__architecture_role__ = "lib/domain"

import math
from dataclasses import dataclass
from typing import Literal

from ..types import Axis, SandwichScore, CanonicalProfile
from .normalizer import Deviation, calculate_deviation


@dataclass
class GradientDirection:
    """균형점으로 향하는 방향"""
    axis: Axis
    direction: Literal["increase", "decrease"]
    magnitude: float  # 변화 필요량

    @property
    def action_verb(self) -> str:
        """방향에 따른 동사"""
        if self.direction == "increase":
            return "강화"
        return "완화"


@dataclass
class EquilibriumStatus:
    """균형 상태"""
    in_equilibrium: bool
    energy: float  # Lyapunov 에너지
    deviation: Deviation
    gradients: list[GradientDirection]
    nearest_equilibrium: SandwichScore


def calculate_energy(
    current: SandwichScore,
    canonical: SandwichScore,
) -> float:
    """
    Lyapunov 에너지 함수

    E(v) = ||v - c||² = (v - c)ᵀ(v - c)

    낮을수록 균형점에 가까움
    """
    deviation = calculate_deviation(current, canonical)
    return deviation.distance ** 2


def calculate_gradients(
    current: SandwichScore,
    canonical: SandwichScore,
) -> list[GradientDirection]:
    """
    균형점으로 향하는 gradient 계산

    에너지가 감소하는 방향 = 균형점으로 향하는 방향
    """
    deviation = calculate_deviation(current, canonical)

    gradients: list[GradientDirection] = []

    # 각 축별로 gradient 계산
    if deviation.bread != 0:
        gradients.append(GradientDirection(
            axis=Axis.BREAD,
            direction="decrease" if deviation.bread > 0 else "increase",
            magnitude=abs(deviation.bread),
        ))

    if deviation.cheese != 0:
        gradients.append(GradientDirection(
            axis=Axis.CHEESE,
            direction="decrease" if deviation.cheese > 0 else "increase",
            magnitude=abs(deviation.cheese),
        ))

    if deviation.ham != 0:
        gradients.append(GradientDirection(
            axis=Axis.HAM,
            direction="decrease" if deviation.ham > 0 else "increase",
            magnitude=abs(deviation.ham),
        ))

    # 크기순 정렬 (가장 큰 편차부터)
    gradients.sort(key=lambda g: g.magnitude, reverse=True)

    return gradients


def check_equilibrium(
    current: SandwichScore,
    profile: CanonicalProfile,
    threshold: float = 10.0,
) -> EquilibriumStatus:
    """
    균형 상태 확인

    Args:
        current: 현재 점수
        profile: Canonical 프로파일
        threshold: 균형 영역 임계값 (기본 10%)

    Returns:
        EquilibriumStatus: 균형 상태 정보
    """
    canonical = profile.canonical
    deviation = calculate_deviation(current, canonical)
    energy = calculate_energy(current, canonical)
    gradients = calculate_gradients(current, canonical)

    # 균형 영역 내에 있는지 확인
    in_equilibrium = (
        abs(deviation.bread) <= threshold and
        abs(deviation.cheese) <= threshold and
        abs(deviation.ham) <= threshold
    )

    return EquilibriumStatus(
        in_equilibrium=in_equilibrium,
        energy=energy,
        deviation=deviation,
        gradients=gradients,
        nearest_equilibrium=canonical,
    )


def suggest_next_step(
    status: EquilibriumStatus,
) -> GradientDirection | None:
    """
    다음 리팩토링 단계 제안

    가장 큰 편차를 가진 축의 방향을 반환
    """
    if status.in_equilibrium:
        return None

    if not status.gradients:
        return None

    return status.gradients[0]


def estimate_steps_to_equilibrium(
    current: SandwichScore,
    canonical: SandwichScore,
    step_size: float = 5.0,
) -> int:
    """
    균형점까지 예상 단계 수

    Args:
        current: 현재 점수
        canonical: 목표 점수
        step_size: 한 단계당 변화량 (기본 5%)

    Returns:
        예상 단계 수
    """
    deviation = calculate_deviation(current, canonical)
    max_deviation = max(
        abs(deviation.bread),
        abs(deviation.cheese),
        abs(deviation.ham),
    )

    if max_deviation <= step_size:
        return 1

    return math.ceil(max_deviation / step_size)
