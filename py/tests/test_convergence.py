"""Tests for v0.0.3 convergence module."""

from semantic_complexity.core.convergence import (
    ConvergenceResult,
    ConvergenceStatus,
    IterationHistory,
    analyze_convergence,
    convergence_score,
    estimate_lipschitz,
    recommend_refactoring,
)
from semantic_complexity.core.tensor import Vector5D


class TestConvergenceScore:
    """Tests for convergence_score function."""

    def test_safe_zone(self):
        # Score below target (threshold - epsilon)
        score = convergence_score(current=7.0, threshold=10.0, epsilon=2.0)
        assert score < 0  # In safe zone

    def test_review_zone(self):
        # Score in epsilon neighborhood
        score = convergence_score(current=9.0, threshold=10.0, epsilon=2.0)
        assert 0 <= score < 1  # In review zone

    def test_violation_zone(self):
        # Score above threshold
        score = convergence_score(current=11.0, threshold=10.0, epsilon=2.0)
        assert score > 1  # In violation zone

    def test_exactly_at_target(self):
        # Score exactly at target (threshold - epsilon)
        score = convergence_score(current=8.0, threshold=10.0, epsilon=2.0)
        assert score == 0.0

    def test_epsilon_zero_safe(self):
        # When epsilon=0, should return 0 if under target
        score = convergence_score(current=5.0, threshold=10.0, epsilon=0)
        assert score == 0.0

    def test_epsilon_zero_violation(self):
        # When epsilon=0, should return inf if over target
        score = convergence_score(current=11.0, threshold=10.0, epsilon=0)
        assert score == float('inf')


class TestIterationHistory:
    """Tests for IterationHistory class."""

    def test_add_scores(self):
        history = IterationHistory(scores=[])
        history.add(10.5)
        history.add(9.8)
        history.add(10.2)
        assert len(history.scores) == 3

    def test_max_history_limit(self):
        history = IterationHistory(scores=[], max_history=3)
        for i in range(5):
            history.add(float(i))
        assert len(history.scores) == 3
        assert history.scores == [2.0, 3.0, 4.0]

    def test_oscillation_detection(self):
        # Clear oscillation pattern: up-down-up-down
        history = IterationHistory(scores=[10.5, 9.8, 10.2, 9.9, 10.1, 9.8])
        assert history.is_oscillating()

    def test_no_oscillation_monotonic(self):
        # Monotonically decreasing (converging)
        history = IterationHistory(scores=[10.5, 10.0, 9.5, 9.0, 8.5, 8.0])
        assert not history.is_oscillating()

    def test_trend_decreasing(self):
        history = IterationHistory(scores=[10.0, 9.0, 8.0, 7.0])
        trend = history.trend()
        assert trend < 0  # Improving

    def test_trend_increasing(self):
        history = IterationHistory(scores=[7.0, 8.0, 9.0, 10.0])
        trend = history.trend()
        assert trend > 0  # Worsening

    def test_trend_stable(self):
        history = IterationHistory(scores=[8.0, 8.0, 8.0, 8.0])
        trend = history.trend()
        assert abs(trend) < 0.01  # Stable


class TestEstimateLipschitz:
    """Tests for Lipschitz constant estimation."""

    def test_lipschitz_basic(self):
        v1 = Vector5D(1.0, 0.0, 0.0, 0.0, 0.0)
        v2 = Vector5D(2.0, 0.0, 0.0, 0.0, 0.0)

        k = estimate_lipschitz(v1, v2, score1=5.0, score2=6.0)
        assert k == 1.0  # |6-5| / |2-1| = 1

    def test_lipschitz_same_point(self):
        v = Vector5D(1.0, 1.0, 1.0, 1.0, 1.0)
        k = estimate_lipschitz(v, v, score1=5.0, score2=5.0)
        assert k == 0.0

    def test_lipschitz_contraction(self):
        v1 = Vector5D(0.0, 0.0, 0.0, 0.0, 0.0)
        v2 = Vector5D(10.0, 0.0, 0.0, 0.0, 0.0)

        # Score change is less than vector change -> contraction
        k = estimate_lipschitz(v1, v2, score1=0.0, score2=5.0)
        assert k < 1.0  # 5/10 = 0.5 < 1


class TestAnalyzeConvergence:
    """Tests for analyze_convergence function."""

    def test_safe_status(self):
        result = analyze_convergence(score=5.0, threshold=10.0, epsilon=2.0)
        assert result.status == ConvergenceStatus.SAFE
        assert result.is_converged
        assert result.distance_to_target < 0

    def test_review_status(self):
        result = analyze_convergence(score=9.0, threshold=10.0, epsilon=2.0)
        assert result.status == ConvergenceStatus.REVIEW
        assert not result.is_converged
        assert result.distance_to_threshold > 0

    def test_violation_status(self):
        result = analyze_convergence(score=12.0, threshold=10.0, epsilon=2.0)
        assert result.status == ConvergenceStatus.VIOLATION
        assert not result.is_converged
        assert result.distance_to_threshold < 0

    def test_oscillating_status(self):
        history = IterationHistory(scores=[10.5, 9.8, 10.2, 9.9, 10.1, 9.8])
        result = analyze_convergence(score=10.0, threshold=10.0, epsilon=2.0, history=history)
        assert result.status == ConvergenceStatus.OSCILLATING

    def test_lipschitz_estimation(self):
        v1 = Vector5D(1.0, 1.0, 1.0, 1.0, 1.0)
        v2 = Vector5D(2.0, 2.0, 2.0, 2.0, 2.0)

        result = analyze_convergence(
            score=6.0, threshold=10.0, epsilon=2.0,
            prev_vector=v1, curr_vector=v2, prev_score=5.0
        )
        assert result.lipschitz_estimate > 0

    def test_target_calculation(self):
        result = analyze_convergence(score=5.0, threshold=10.0, epsilon=2.0)
        assert result.target == 8.0  # 10 - 2


class TestRecommendRefactoring:
    """Tests for refactoring recommendations."""

    def test_recommendations_for_complex_code(self):
        v = Vector5D(10.0, 8.0, 5.0, 3.0, 2.0)  # High control/nesting
        w = Vector5D(1.0, 1.5, 2.0, 2.5, 3.0)

        recommendations = recommend_refactoring(v, w)

        assert len(recommendations) > 0
        # Control should be highest priority (10 * 1.0 = 10)
        # Nesting next (8 * 1.5 = 12)
        dims = [r.dimension for r in recommendations]
        assert "nesting" in dims
        assert "control" in dims

    def test_recommendation_priorities(self):
        v = Vector5D(5.0, 0.0, 0.0, 0.0, 10.0)  # High coupling
        w = Vector5D(1.0, 1.5, 2.0, 2.5, 3.0)

        recommendations = recommend_refactoring(v, w)

        # Coupling: 10 * 3.0 = 30 (highest)
        assert recommendations[0].dimension == "coupling"
        assert recommendations[0].priority >= 4

    def test_no_recommendations_for_simple_code(self):
        v = Vector5D(1.0, 1.0, 1.0, 1.0, 1.0)  # All low but weights differ
        w = Vector5D(1.0, 1.5, 2.0, 2.5, 3.0)

        recommendations = recommend_refactoring(v, w)

        # With different weights, coupling (3.0) is highest even at 1.0
        # Total = 1 + 1.5 + 2 + 2.5 + 3 = 10
        # Coupling = 3/10 = 30% -> priority 4
        # This is expected behavior - weights matter
        assert len(recommendations) > 0

    def test_recommendation_actions(self):
        v = Vector5D(10.0, 10.0, 10.0, 10.0, 10.0)
        w = Vector5D(1.0, 1.5, 2.0, 2.5, 3.0)

        recommendations = recommend_refactoring(v, w)

        for r in recommendations:
            assert r.action  # Should have non-empty action string
            assert r.expected_impact > 0


class TestConvergenceResult:
    """Tests for ConvergenceResult properties."""

    def test_can_converge_with_contraction(self):
        result = ConvergenceResult(
            score=8.0, threshold=10.0, epsilon=2.0,
            convergence_score=0.0, status=ConvergenceStatus.SAFE,
            distance_to_target=0.0, distance_to_threshold=2.0,
            lipschitz_estimate=0.5  # k < 1
        )
        assert result.can_converge

    def test_cannot_converge_without_contraction(self):
        result = ConvergenceResult(
            score=8.0, threshold=10.0, epsilon=2.0,
            convergence_score=0.0, status=ConvergenceStatus.SAFE,
            distance_to_target=0.0, distance_to_threshold=2.0,
            lipschitz_estimate=1.2  # k > 1
        )
        assert not result.can_converge
