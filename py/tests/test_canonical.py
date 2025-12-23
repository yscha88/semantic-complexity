"""Tests for v0.0.3 canonical module."""

from semantic_complexity.core.canonical import (
    CANONICAL_PROFILES,
    CanonicalProfile,
    ComplexityLevel,
    DeviationResult,
    analyze_deviation,
    classify_complexity_level,
    euclidean_distance,
    find_best_module_type,
    hodge_decomposition,
    mahalanobis_distance,
)
from semantic_complexity.core.tensor import (
    InteractionMatrix,
    ModuleType,
    Vector5D,
)


class TestCanonicalProfile:
    """Tests for CanonicalProfile class."""

    def test_api_profile_exists(self):
        assert ModuleType.API in CANONICAL_PROFILES
        profile = CANONICAL_PROFILES[ModuleType.API]
        assert profile.control == (0, 5)
        assert profile.coupling == (0, 3)

    def test_lib_profile_exists(self):
        profile = CANONICAL_PROFILES[ModuleType.LIB]
        assert profile.control[1] >= profile.control[0]

    def test_centroid_calculation(self):
        profile = CanonicalProfile(
            control=(0, 10),
            nesting=(0, 6),
            state=(0, 4),
            async_=(0, 2),
            coupling=(0, 8),
        )
        centroid = profile.centroid
        assert centroid.control == 5.0
        assert centroid.nesting == 3.0
        assert centroid.state == 2.0
        assert centroid.async_ == 1.0
        assert centroid.coupling == 4.0

    def test_contains_within_bounds(self):
        profile = CANONICAL_PROFILES[ModuleType.API]
        v_inside = Vector5D(2.0, 1.0, 1.0, 1.0, 1.0)
        assert profile.contains(v_inside)

    def test_contains_outside_bounds(self):
        profile = CANONICAL_PROFILES[ModuleType.API]
        v_outside = Vector5D(100.0, 1.0, 1.0, 1.0, 1.0)  # Control way too high
        assert not profile.contains(v_outside)

    def test_violation_dimensions(self):
        profile = CANONICAL_PROFILES[ModuleType.API]
        v = Vector5D(10.0, 10.0, 1.0, 1.0, 1.0)  # Control and nesting too high
        violations = profile.violation_dimensions(v)
        assert "control" in violations
        assert "nesting" in violations
        assert "state" not in violations


class TestDistanceMetrics:
    """Tests for distance calculation functions."""

    def test_euclidean_distance_zero(self):
        v = Vector5D(1.0, 2.0, 3.0, 4.0, 5.0)
        dist = euclidean_distance(v, v)
        assert dist == 0.0

    def test_euclidean_distance_simple(self):
        v1 = Vector5D(0.0, 0.0, 0.0, 0.0, 0.0)
        v2 = Vector5D(3.0, 4.0, 0.0, 0.0, 0.0)
        dist = euclidean_distance(v1, v2)
        assert dist == 5.0  # 3-4-5 triangle

    def test_mahalanobis_distance(self):
        v1 = Vector5D(0.0, 0.0, 0.0, 0.0, 0.0)
        v2 = Vector5D(1.0, 0.0, 0.0, 0.0, 0.0)
        matrix = InteractionMatrix()
        dist = mahalanobis_distance(v1, v2, matrix)
        assert dist > 0


class TestAnalyzeDeviation:
    """Tests for analyze_deviation function."""

    def test_canonical_code(self):
        # Vector within API canonical bounds
        v = Vector5D(2.0, 1.0, 1.0, 1.0, 1.0)
        result = analyze_deviation(v, ModuleType.API)

        assert result.is_canonical
        assert not result.is_orphan
        assert result.status == "canonical"

    def test_deviated_code(self):
        # Vector outside API bounds but within another profile
        v = Vector5D(8.0, 4.0, 1.0, 1.0, 1.0)  # Too complex for API
        result = analyze_deviation(v, ModuleType.API)

        assert not result.is_canonical
        assert "control" in result.violation_dimensions
        assert result.status == "deviated"

    def test_orphan_code(self):
        # Vector outside ALL canonical bounds
        v = Vector5D(50.0, 50.0, 50.0, 50.0, 50.0)
        result = analyze_deviation(v, ModuleType.API)

        assert not result.is_canonical
        assert result.is_orphan
        assert result.status == "orphan"

    def test_deviation_distances(self):
        v = Vector5D(5.0, 5.0, 5.0, 5.0, 5.0)
        result = analyze_deviation(v, ModuleType.LIB)

        assert result.euclidean_distance >= 0
        assert result.mahalanobis_distance >= 0
        assert result.normalized_deviation >= 0
        assert result.normalized_deviation <= 1


class TestFindBestModuleType:
    """Tests for find_best_module_type function."""

    def test_find_api_like_code(self):
        # Low complexity across all dimensions -> API
        v = Vector5D(2.0, 1.0, 0.5, 0.5, 1.0)
        best_type, distance = find_best_module_type(v)
        assert best_type in [ModuleType.API, ModuleType.DEPLOY]

    def test_find_lib_like_code(self):
        # Medium control/nesting, low everything else
        v = Vector5D(5.0, 3.0, 0.5, 0.5, 0.5)
        best_type, distance = find_best_module_type(v)
        assert best_type in [ModuleType.LIB, ModuleType.API]

    def test_find_app_like_code(self):
        # Medium across all dimensions
        v = Vector5D(5.0, 3.0, 4.0, 4.0, 2.0)
        best_type, distance = find_best_module_type(v)
        assert best_type == ModuleType.APP

    def test_distance_returned(self):
        v = Vector5D(5.0, 5.0, 5.0, 5.0, 5.0)
        best_type, distance = find_best_module_type(v)
        assert distance >= 0


class TestComplexityLevel:
    """Tests for complexity level classification."""

    def test_minimal(self):
        assert classify_complexity_level(1.0) == ComplexityLevel.MINIMAL

    def test_low(self):
        assert classify_complexity_level(3.0) == ComplexityLevel.LOW

    def test_medium(self):
        assert classify_complexity_level(7.0) == ComplexityLevel.MEDIUM

    def test_high(self):
        assert classify_complexity_level(15.0) == ComplexityLevel.HIGH

    def test_extreme(self):
        assert classify_complexity_level(25.0) == ComplexityLevel.EXTREME

    def test_boundaries(self):
        assert classify_complexity_level(2.0) == ComplexityLevel.LOW
        assert classify_complexity_level(5.0) == ComplexityLevel.MEDIUM
        assert classify_complexity_level(10.0) == ComplexityLevel.HIGH
        assert classify_complexity_level(20.0) == ComplexityLevel.EXTREME


class TestHodgeDecomposition:
    """Tests for Hodge decomposition."""

    def test_decomposition_components(self):
        v = Vector5D(5.0, 3.0, 2.0, 4.0, 1.0)
        hodge = hodge_decomposition(v)

        # Algorithmic: Control + Nesting
        # 5.0 * 1.0 + 3.0 * 1.5 = 5 + 4.5 = 9.5
        assert hodge.algorithmic == 9.5

        # Architectural: State + Coupling
        # 2.0 * 2.0 + 1.0 * 3.0 = 4 + 3 = 7
        assert hodge.architectural == 7.0

        # Balanced: Async
        # 4.0 * 2.5 = 10
        assert hodge.balanced == 10.0

    def test_total(self):
        v = Vector5D(5.0, 3.0, 2.0, 4.0, 1.0)
        hodge = hodge_decomposition(v)
        assert hodge.total == hodge.algorithmic + hodge.architectural + hodge.balanced

    def test_balance_ratio(self):
        # High async -> high balance ratio
        v = Vector5D(1.0, 1.0, 1.0, 10.0, 1.0)
        hodge = hodge_decomposition(v)
        assert hodge.balance_ratio > 0.5

        # Low async -> low balance ratio
        v = Vector5D(10.0, 10.0, 10.0, 0.0, 10.0)
        hodge = hodge_decomposition(v)
        assert hodge.balance_ratio < 0.1

    def test_is_harmonic(self):
        # Well-balanced code (reasonable async)
        v = Vector5D(3.0, 2.0, 2.0, 3.0, 2.0)
        hodge = hodge_decomposition(v)
        # balance_ratio = 7.5 / (3 + 3 + 4 + 7.5 + 6) = 7.5 / 23.5 ≈ 0.32
        assert hodge.is_harmonic

    def test_not_harmonic(self):
        # Unbalanced code (no async, high everything else)
        v = Vector5D(10.0, 10.0, 10.0, 0.0, 10.0)
        hodge = hodge_decomposition(v)
        assert not hodge.is_harmonic

    def test_zero_vector(self):
        v = Vector5D.zero()
        hodge = hodge_decomposition(v)
        assert hodge.total == 0
        assert hodge.balance_ratio == 0

    def test_custom_weights(self):
        v = Vector5D(1.0, 1.0, 1.0, 1.0, 1.0)
        custom_weights = Vector5D(2.0, 2.0, 2.0, 2.0, 2.0)  # All equal
        hodge = hodge_decomposition(v, weights=custom_weights)

        # With equal weights: algorithmic = 4, architectural = 4, balanced = 2
        assert hodge.algorithmic == 4.0
        assert hodge.architectural == 4.0
        assert hodge.balanced == 2.0


class TestDeviationResult:
    """Tests for DeviationResult properties."""

    def test_status_canonical(self):
        result = DeviationResult(
            euclidean_distance=1.0,
            mahalanobis_distance=1.0,
            max_dimension_deviation=0.5,
            normalized_deviation=0.1,
            is_canonical=True,
            is_orphan=False,
            module_type=ModuleType.API,
            vector=Vector5D.zero(),
            profile=CANONICAL_PROFILES[ModuleType.API],
            violation_dimensions=[],
        )
        assert result.status == "canonical"

    def test_status_orphan(self):
        result = DeviationResult(
            euclidean_distance=50.0,
            mahalanobis_distance=50.0,
            max_dimension_deviation=40.0,
            normalized_deviation=1.0,
            is_canonical=False,
            is_orphan=True,
            module_type=ModuleType.API,
            vector=Vector5D(50, 50, 50, 50, 50),
            profile=CANONICAL_PROFILES[ModuleType.API],
            violation_dimensions=["control", "nesting", "state", "async", "coupling"],
        )
        assert result.status == "orphan"

    def test_status_deviated(self):
        result = DeviationResult(
            euclidean_distance=10.0,
            mahalanobis_distance=10.0,
            max_dimension_deviation=8.0,
            normalized_deviation=0.5,
            is_canonical=False,
            is_orphan=False,
            module_type=ModuleType.API,
            vector=Vector5D(10, 1, 1, 1, 1),
            profile=CANONICAL_PROFILES[ModuleType.API],
            violation_dimensions=["control"],
        )
        assert result.status == "deviated"
