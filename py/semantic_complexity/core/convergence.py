"""
v0.0.3: ε-Regularization and Convergence Analysis.

Mathematical foundation:
    score_reg = score + ε‖v‖²

Contraction Mapping Theorem:
    ‖f(x) - f(y)‖ ≤ k‖x - y‖, where k < 1

When ε > 0, Banach fixed-point theorem guarantees convergence.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from semantic_complexity.core.tensor import Vector5D


class ConvergenceStatus(Enum):
    """Convergence status based on ε-neighborhood."""

    SAFE = "safe"              # score < threshold - ε (converged)
    REVIEW = "review"          # threshold - ε ≤ score < threshold
    VIOLATION = "violation"    # score ≥ threshold
    OSCILLATING = "oscillating"  # Detected oscillation pattern


@dataclass
class ConvergenceResult:
    """Result of convergence analysis."""

    # Current state
    score: float
    threshold: float
    epsilon: float

    # Convergence metrics
    convergence_score: float  # (score - target) / ε
    status: ConvergenceStatus

    # Distance from target
    distance_to_target: float  # score - (threshold - ε)
    distance_to_threshold: float  # threshold - score

    # Lipschitz estimate (for contraction check)
    lipschitz_estimate: float

    @property
    def target(self) -> float:
        """Target score (threshold - ε)."""
        return self.threshold - self.epsilon

    @property
    def is_converged(self) -> bool:
        """Check if in safe zone (fully converged)."""
        return self.status == ConvergenceStatus.SAFE

    @property
    def can_converge(self) -> bool:
        """Check if Banach conditions are met (k < 1)."""
        return self.lipschitz_estimate < 1.0


@dataclass
class IterationHistory:
    """History of refactoring iterations for oscillation detection."""

    scores: list[float]
    max_history: int = 10

    def add(self, score: float) -> None:
        """Add a score to history."""
        self.scores.append(score)
        if len(self.scores) > self.max_history:
            self.scores.pop(0)

    def is_oscillating(self, tolerance: float = 0.5) -> bool:
        """
        Detect oscillation pattern.

        Oscillation = alternating above/below threshold without convergence.
        """
        if len(self.scores) < 4:
            return False

        # Check for alternating pattern
        diffs = [self.scores[i+1] - self.scores[i] for i in range(len(self.scores) - 1)]

        # Count sign changes
        sign_changes = sum(
            1 for i in range(len(diffs) - 1)
            if diffs[i] * diffs[i+1] < 0
        )

        # High sign change ratio indicates oscillation
        return sign_changes >= len(diffs) * 0.6

    def trend(self) -> float:
        """
        Calculate trend direction.

        Returns:
            < 0: Improving (score decreasing)
            > 0: Worsening (score increasing)
            ≈ 0: Stable
        """
        if len(self.scores) < 2:
            return 0.0

        # Simple linear regression slope
        n = len(self.scores)
        x_mean = (n - 1) / 2
        y_mean = sum(self.scores) / n

        numerator = sum((i - x_mean) * (self.scores[i] - y_mean) for i in range(n))
        denominator = sum((i - x_mean) ** 2 for i in range(n))

        if denominator == 0:
            return 0.0

        return numerator / denominator


def convergence_score(current: float, threshold: float, epsilon: float) -> float:
    """
    Calculate convergence score.

    Returns:
        < 0: Safe zone (converged)
        0-1: ε-neighborhood (review needed)
        > 1: Violation zone
    """
    target = threshold - epsilon
    if epsilon == 0:
        return float('inf') if current > target else 0.0
    return (current - target) / epsilon


def estimate_lipschitz(
    v1: Vector5D,
    v2: Vector5D,
    score1: float,
    score2: float,
) -> float:
    """
    Estimate Lipschitz constant from two points.

    k = |f(x) - f(y)| / |x - y|

    For contraction mapping, we need k < 1.
    """

    # Calculate vector distance
    diff = [a - b for a, b in zip(v1, v2)]
    v_dist = sum(d * d for d in diff) ** 0.5

    if v_dist < 1e-10:
        return 0.0

    # Calculate score distance
    s_dist = abs(score1 - score2)

    return s_dist / v_dist


def analyze_convergence(
    score: float,
    threshold: float = 10.0,
    epsilon: float = 2.0,
    history: IterationHistory | None = None,
    prev_vector: Vector5D | None = None,
    curr_vector: Vector5D | None = None,
    prev_score: float | None = None,
) -> ConvergenceResult:
    """
    Analyze convergence status.

    Args:
        score: Current complexity score
        threshold: Maximum allowed score (default: 10.0)
        epsilon: ε-regularization parameter (default: 2.0)
        history: Optional iteration history for oscillation detection
        prev_vector: Previous complexity vector (for Lipschitz estimation)
        curr_vector: Current complexity vector (for Lipschitz estimation)
        prev_score: Previous score (for Lipschitz estimation)

    Returns:
        ConvergenceResult with detailed analysis
    """
    target = threshold - epsilon
    conv_score = convergence_score(score, threshold, epsilon)

    # Determine status
    if history and history.is_oscillating():
        status = ConvergenceStatus.OSCILLATING
    elif conv_score < 0:
        status = ConvergenceStatus.SAFE
    elif conv_score < 1:
        status = ConvergenceStatus.REVIEW
    else:
        status = ConvergenceStatus.VIOLATION

    # Estimate Lipschitz constant
    lipschitz = 0.0
    if prev_vector and curr_vector and prev_score is not None:
        lipschitz = estimate_lipschitz(prev_vector, curr_vector, prev_score, score)

    return ConvergenceResult(
        score=score,
        threshold=threshold,
        epsilon=epsilon,
        convergence_score=round(conv_score, 3),
        status=status,
        distance_to_target=round(score - target, 2),
        distance_to_threshold=round(threshold - score, 2),
        lipschitz_estimate=round(lipschitz, 3),
    )


@dataclass
class RefactoringRecommendation:
    """Recommendation for refactoring based on convergence analysis."""

    dimension: str
    priority: int  # 1-5, higher = more urgent
    action: str
    expected_impact: float  # Estimated score reduction


def recommend_refactoring(
    vector: Vector5D,
    weights: Vector5D,
    threshold: float = 10.0,
    epsilon: float = 2.0,
) -> list[RefactoringRecommendation]:
    """
    Recommend refactoring actions based on vector analysis.

    Prioritizes dimensions with highest weighted contribution.
    """

    dimensions = ["control", "nesting", "state", "async", "coupling"]
    weighted = [v * w for v, w in zip(vector, weights)]
    total = sum(weighted)

    if total == 0:
        return []

    # Calculate contribution percentages
    contributions = [(dim, w, w / total) for dim, w in zip(dimensions, weighted)]
    contributions.sort(key=lambda x: x[1], reverse=True)

    recommendations = []
    for i, (dim, weighted_val, pct) in enumerate(contributions):
        if pct < 0.1:  # Skip dimensions contributing < 10%
            continue

        action = _get_refactoring_action(dim)
        priority = min(5, int(pct * 10) + 1)  # Scale to 1-5
        impact = weighted_val * 0.3  # Assume 30% reduction possible

        recommendations.append(RefactoringRecommendation(
            dimension=dim,
            priority=priority,
            action=action,
            expected_impact=round(impact, 2),
        ))

    return recommendations


def _get_refactoring_action(dimension: str) -> str:
    """Get recommended action for a dimension."""
    actions = {
        "control": "Extract complex conditionals into separate functions",
        "nesting": "Flatten nested structures using early returns or guard clauses",
        "state": "Reduce state mutations; consider immutable patterns",
        "async": "Simplify async flow; reduce callback nesting",
        "coupling": "Extract dependencies; use dependency injection",
    }
    return actions.get(dimension, "Review and simplify")


__all__ = [
    "ConvergenceStatus",
    "ConvergenceResult",
    "IterationHistory",
    "RefactoringRecommendation",
    "convergence_score",
    "estimate_lipschitz",
    "analyze_convergence",
    "recommend_refactoring",
]
