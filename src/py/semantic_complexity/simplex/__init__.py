"""
Simplex 모듈

Ham Sandwich Theorem 기반 3차원 simplex:
- 정규화: Raw scores → SandwichScore
- 라벨링: 지배 축 결정
- 균형점: Lyapunov 에너지 기반 균형 탐지
"""

__architecture_role__ = "lib/domain"

from .normalizer import (
    normalize_to_simplex,
    results_to_raw_scores,
    results_to_sandwich,
    calculate_deviation,
    is_in_equilibrium,
    Deviation,
)
from .labeler import (
    get_dominant_label,
    label_module,
    label_pr_changes,
    classify_change_type,
    LabelResult,
)
from .equilibrium import (
    calculate_energy,
    calculate_gradients,
    check_equilibrium,
    suggest_next_step,
    estimate_steps_to_equilibrium,
    GradientDirection,
    EquilibriumStatus,
)

__all__ = [
    # Normalizer
    "normalize_to_simplex",
    "results_to_raw_scores",
    "results_to_sandwich",
    "calculate_deviation",
    "is_in_equilibrium",
    "Deviation",
    # Labeler
    "get_dominant_label",
    "label_module",
    "label_pr_changes",
    "classify_change_type",
    "LabelResult",
    # Equilibrium
    "calculate_energy",
    "calculate_gradients",
    "check_equilibrium",
    "suggest_next_step",
    "estimate_steps_to_equilibrium",
    "GradientDirection",
    "EquilibriumStatus",
]
