"""
v0.0.3: Module Type Canonical Forms and Deviation Metrics.

Mathematical foundation:
    Φ: ModuleType → CanonicalProfile
    δ(v, Φ(τ)) = ‖v - Φ(τ)‖_M (Mahalanobis-like distance)

Conditional Canonical Existence Theorem:
    Under conditions (i)-(v), ∃! v* = argmin[v^T M v + ⟨v,w⟩ + ε‖v‖²]
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    pass

from semantic_complexity.core.tensor import (
    InteractionMatrix,
    ModuleType,
    Vector5D,
)


class ComplexityLevel(Enum):
    """Complexity level classification."""

    MINIMAL = "minimal"  # 0-2
    LOW = "low"          # 2-5
    MEDIUM = "medium"    # 5-10
    HIGH = "high"        # 10-20
    EXTREME = "extreme"  # 20+


@dataclass(frozen=True)
class CanonicalProfile:
    """
    Canonical complexity profile for a module type.

    Defines the ideal complexity distribution per dimension.
    """

    control: tuple[float, float]   # (min, max) expected range
    nesting: tuple[float, float]
    state: tuple[float, float]
    async_: tuple[float, float]
    coupling: tuple[float, float]

    @property
    def centroid(self) -> Vector5D:
        """Center point of the canonical region."""
        return Vector5D(
            control=(self.control[0] + self.control[1]) / 2,
            nesting=(self.nesting[0] + self.nesting[1]) / 2,
            state=(self.state[0] + self.state[1]) / 2,
            async_=(self.async_[0] + self.async_[1]) / 2,
            coupling=(self.coupling[0] + self.coupling[1]) / 2,
        )

    def contains(self, v: Vector5D) -> bool:
        """Check if vector is within canonical region."""
        return (
            self.control[0] <= v.control <= self.control[1]
            and self.nesting[0] <= v.nesting <= self.nesting[1]
            and self.state[0] <= v.state <= self.state[1]
            and self.async_[0] <= v.async_ <= self.async_[1]
            and self.coupling[0] <= v.coupling <= self.coupling[1]
        )

    def violation_dimensions(self, v: Vector5D) -> list[str]:
        """Get list of dimensions that violate the canonical bounds."""
        violations = []
        dims = [
            ("control", v.control, self.control),
            ("nesting", v.nesting, self.nesting),
            ("state", v.state, self.state),
            ("async", v.async_, self.async_),
            ("coupling", v.coupling, self.coupling),
        ]
        for name, val, (lo, hi) in dims:
            if val < lo or val > hi:
                violations.append(name)
        return violations


# Canonical profiles per module type (based on README definitions)
CANONICAL_PROFILES: dict[ModuleType, CanonicalProfile] = {
    ModuleType.API: CanonicalProfile(
        control=(0, 5),      # low: thin controllers
        nesting=(0, 3),      # low: flat structure
        state=(0, 2),        # low: stateless preferred
        async_=(0, 3),       # low: simple I/O
        coupling=(0, 3),     # low: explicit deps
    ),
    ModuleType.LIB: CanonicalProfile(
        control=(0, 10),     # medium: algorithmic complexity ok
        nesting=(0, 5),      # medium: some depth acceptable
        state=(0, 2),        # low: pure functions preferred
        async_=(0, 2),       # low: sync preferred
        coupling=(0, 2),     # low: minimal deps
    ),
    ModuleType.APP: CanonicalProfile(
        control=(0, 10),     # medium: business logic
        nesting=(0, 5),      # medium: reasonable depth
        state=(0, 8),        # medium: stateful ok
        async_=(0, 8),       # medium: async workflows
        coupling=(0, 5),     # low: controlled deps
    ),
    ModuleType.WEB: CanonicalProfile(
        control=(0, 8),      # medium: UI logic
        nesting=(0, 10),     # higher: component hierarchy
        state=(0, 5),        # medium: UI state
        async_=(0, 5),       # medium: data fetching
        coupling=(0, 3),     # low: component isolation
    ),
    ModuleType.DEPLOY: CanonicalProfile(
        control=(0, 3),      # low: simple scripts
        nesting=(0, 2),      # low: flat
        state=(0, 2),        # low: idempotent
        async_=(0, 2),       # low: sequential
        coupling=(0, 3),     # low: explicit config
    ),
    ModuleType.UNKNOWN: CanonicalProfile(
        control=(0, 15),     # permissive
        nesting=(0, 10),
        state=(0, 10),
        async_=(0, 10),
        coupling=(0, 10),
    ),
}


@dataclass
class DeviationResult:
    """Result of deviation analysis from canonical form."""

    # Distance metrics
    euclidean_distance: float    # ‖v - Φ(τ)‖₂
    mahalanobis_distance: float  # ‖v - Φ(τ)‖_M
    max_dimension_deviation: float  # max deviation in any dimension

    # Normalized scores
    normalized_deviation: float  # 0-1 scale

    # Status
    is_canonical: bool          # within canonical bounds
    is_orphan: bool             # outside all canonical regions

    # Details
    module_type: ModuleType
    vector: Vector5D
    profile: CanonicalProfile
    violation_dimensions: list[str]

    @property
    def status(self) -> str:
        if self.is_canonical:
            return "canonical"
        elif self.is_orphan:
            return "orphan"
        else:
            return "deviated"


def euclidean_distance(v: Vector5D, target: Vector5D) -> float:
    """Calculate Euclidean distance between two vectors."""
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(v, target)))


def mahalanobis_distance(
    v: Vector5D,
    target: Vector5D,
    interaction_matrix: InteractionMatrix,
) -> float:
    """
    Calculate Mahalanobis-like distance using interaction matrix.

    δ(v, Φ) = sqrt((v - Φ)^T M (v - Φ))
    """
    diff = [a - b for a, b in zip(v, target)]
    diff_vec = Vector5D.from_list(diff)

    # M-weighted inner product
    result = interaction_matrix.quadratic_form(diff_vec)
    return math.sqrt(abs(result))


def analyze_deviation(
    v: Vector5D,
    module_type: ModuleType = ModuleType.UNKNOWN,
) -> DeviationResult:
    """
    Analyze deviation from canonical form.

    Args:
        v: Current complexity vector
        module_type: Target module type

    Returns:
        DeviationResult with detailed analysis
    """
    profile = CANONICAL_PROFILES.get(module_type, CANONICAL_PROFILES[ModuleType.UNKNOWN])
    centroid = profile.centroid

    # Get interaction matrix for module type
    matrix = InteractionMatrix(module_type=module_type)

    # Calculate distances
    euc_dist = euclidean_distance(v, centroid)
    mah_dist = mahalanobis_distance(v, centroid, matrix)

    # Max dimension deviation
    dims = list(zip(v, centroid))
    max_dev = max(abs(a - b) for a, b in dims)

    # Normalize to 0-1 scale (assuming max reasonable deviation is 50)
    norm_dev = min(1.0, mah_dist / 50.0)

    # Check canonical bounds
    is_canonical = profile.contains(v)
    violations = profile.violation_dimensions(v)

    # Check if orphan (outside ALL canonical regions)
    is_orphan = True
    for mt, prof in CANONICAL_PROFILES.items():
        if mt != ModuleType.UNKNOWN and prof.contains(v):
            is_orphan = False
            break

    return DeviationResult(
        euclidean_distance=round(euc_dist, 3),
        mahalanobis_distance=round(mah_dist, 3),
        max_dimension_deviation=round(max_dev, 3),
        normalized_deviation=round(norm_dev, 3),
        is_canonical=is_canonical,
        is_orphan=is_orphan,
        module_type=module_type,
        vector=v,
        profile=profile,
        violation_dimensions=violations,
    )


def find_best_module_type(v: Vector5D) -> tuple[ModuleType, float]:
    """
    Find the module type with smallest deviation from vector.

    Returns:
        (best_type, distance)
    """
    best_type = ModuleType.UNKNOWN
    best_dist = float('inf')

    for module_type in ModuleType:
        if module_type == ModuleType.UNKNOWN:
            continue

        profile = CANONICAL_PROFILES[module_type]
        centroid = profile.centroid
        matrix = InteractionMatrix(module_type=module_type)

        dist = mahalanobis_distance(v, centroid, matrix)
        if dist < best_dist:
            best_dist = dist
            best_type = module_type

    return best_type, round(best_dist, 3)


def classify_complexity_level(score: float) -> ComplexityLevel:
    """Classify complexity score into level."""
    if score < 2:
        return ComplexityLevel.MINIMAL
    elif score < 5:
        return ComplexityLevel.LOW
    elif score < 10:
        return ComplexityLevel.MEDIUM
    elif score < 20:
        return ComplexityLevel.HIGH
    else:
        return ComplexityLevel.EXTREME


@dataclass
class HodgeDecomposition:
    """
    Hodge-like decomposition of complexity space.

    H^k(Code) = ⊕_{p+q=k} H^{p,q}(Code)
    """

    algorithmic: float   # H^{2,0}: Control + Nesting (local)
    architectural: float  # H^{0,2}: Coupling + State (global)
    balanced: float       # H^{1,1}: Async (mixed)

    @property
    def total(self) -> float:
        return self.algorithmic + self.architectural + self.balanced

    @property
    def balance_ratio(self) -> float:
        """
        Ratio of balanced (harmonic) component.

        Higher = more balanced complexity distribution.
        """
        if self.total == 0:
            return 0.0
        return self.balanced / self.total

    @property
    def is_harmonic(self) -> bool:
        """Check if complexity is in harmonic state (well-balanced)."""
        return self.balance_ratio >= 0.3


def hodge_decomposition(v: Vector5D, weights: Vector5D | None = None) -> HodgeDecomposition:
    """
    Decompose complexity vector into Hodge components.

    - H^{2,0} (holomorphic): Control + Nesting → Local algorithmic
    - H^{0,2} (anti-holomorphic): Coupling + State → Global structural
    - H^{1,1} (harmonic): Async → Mixed/balanced
    """
    if weights is None:
        weights = Vector5D(1.0, 1.5, 2.0, 2.5, 3.0)

    # Algorithmic: Control + Nesting
    algorithmic = v.control * weights.control + v.nesting * weights.nesting

    # Architectural: State + Coupling
    architectural = v.state * weights.state + v.coupling * weights.coupling

    # Balanced: Async (bridges both worlds)
    balanced = v.async_ * weights.async_

    return HodgeDecomposition(
        algorithmic=round(algorithmic, 2),
        architectural=round(architectural, 2),
        balanced=round(balanced, 2),
    )


__all__ = [
    "ComplexityLevel",
    "CanonicalProfile",
    "DeviationResult",
    "HodgeDecomposition",
    "CANONICAL_PROFILES",
    "euclidean_distance",
    "mahalanobis_distance",
    "analyze_deviation",
    "find_best_module_type",
    "classify_complexity_level",
    "hodge_decomposition",
]
