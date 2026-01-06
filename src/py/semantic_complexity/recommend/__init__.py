"""
Gradient Recommender

균형점으로 향하는 리팩토링 권장사항
"""

__architecture_role__ = "lib/domain"

from .gradient import (
    suggest_refactor,
    get_priority_action,
    check_degradation,
    GradientRecommender,
    Recommendation,
    DegradationResult,
    BREAD_ACTIONS,
    CHEESE_ACTIONS,
    HAM_ACTIONS,
)

__all__ = [
    "suggest_refactor",
    "get_priority_action",
    "check_degradation",
    "GradientRecommender",
    "Recommendation",
    "DegradationResult",
    "BREAD_ACTIONS",
    "CHEESE_ACTIONS",
    "HAM_ACTIONS",
]
