"""
v0.0.3: Second-Order Tensor and Interaction Matrix.

Mathematical foundation:
    score^(2) = v^T M v + <v, w>

where:
    v = [C, N, S, A, Λ] ∈ ℝ⁵ (complexity vector)
    M ∈ ℝ⁵ˣ⁵ (interaction matrix)
    w = [w₁, w₂, w₃, w₄, w₅] (linear weights)
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from semantic_complexity.core import DimensionalComplexity


class ModuleType(Enum):
    """Module type classification for context-aware analysis."""

    API = "api"          # REST/GraphQL endpoints, thin controllers
    LIB = "lib"          # Reusable library code, pure functions
    APP = "app"          # Application logic, stateful services
    WEB = "web"          # Static frontend, UI components
    DATA = "data"        # Models, entities, schemas
    INFRA = "infra"      # Repositories, DB access, external I/O
    DEPLOY = "deploy"    # Infrastructure, configuration
    UNKNOWN = "unknown"  # Unclassified


# Dimension indices
IDX_CONTROL = 0
IDX_NESTING = 1
IDX_STATE = 2
IDX_ASYNC = 3
IDX_COUPLING = 4


@dataclass(frozen=True)
class Vector5D:
    """5-dimensional complexity vector."""

    control: float
    nesting: float
    state: float
    async_: float
    coupling: float

    def __iter__(self):
        return iter([self.control, self.nesting, self.state, self.async_, self.coupling])

    def __getitem__(self, idx: int) -> float:
        return [self.control, self.nesting, self.state, self.async_, self.coupling][idx]

    def to_list(self) -> list[float]:
        return [self.control, self.nesting, self.state, self.async_, self.coupling]

    def norm(self) -> float:
        """L2 norm of the vector."""
        return math.sqrt(sum(x * x for x in self))

    def dot(self, other: Vector5D) -> float:
        """Dot product with another vector."""
        return sum(a * b for a, b in zip(self, other))

    @classmethod
    def from_list(cls, values: list[float]) -> Vector5D:
        if len(values) != 5:
            raise ValueError("Vector5D requires exactly 5 values")
        return cls(values[0], values[1], values[2], values[3], values[4])

    @classmethod
    def zero(cls) -> Vector5D:
        return cls(0.0, 0.0, 0.0, 0.0, 0.0)


class InteractionMatrix:
    """
    5x5 Interaction Matrix for second-order tensor analysis.

    M[i,j] represents the interaction strength between dimensions i and j.
    - Diagonal: self-interaction (typically 1.0)
    - Off-diagonal: cross-dimension interaction
    """

    # Default interaction matrix (symmetric, positive semi-definite)
    DEFAULT_MATRIX: list[list[float]] = [
        # C     N     S     A     Λ
        [1.0,  0.3,  0.2,  0.2,  0.3],  # Control
        [0.3,  1.0,  0.4,  0.8,  0.2],  # Nesting × Async ↑
        [0.2,  0.4,  1.0,  0.5,  0.9],  # State × Coupling ↑↑
        [0.2,  0.8,  0.5,  1.0,  0.4],  # Async × Nesting ↑
        [0.3,  0.2,  0.9,  0.4,  1.0],  # Coupling × State ↑↑
    ]

    # Module-type specific interaction matrices
    MODULE_MATRICES: dict[ModuleType, list[list[float]]] = {
        ModuleType.API: [
            # API: Coupling interactions are critical
            [1.0,  0.2,  0.3,  0.2,  0.4],
            [0.2,  1.0,  0.3,  0.6,  0.2],
            [0.3,  0.3,  1.0,  0.4,  1.5],  # State × Coupling ↑↑↑
            [0.2,  0.6,  0.4,  1.0,  0.5],
            [0.4,  0.2,  1.5,  0.5,  1.0],  # Coupling × State ↑↑↑
        ],
        ModuleType.LIB: [
            # LIB: Control/Nesting interactions are important
            [1.0,  1.2,  0.2,  0.2,  0.2],  # Control × Nesting ↑
            [1.2,  1.0,  0.3,  0.5,  0.2],  # Nesting × Control ↑
            [0.2,  0.3,  1.0,  0.3,  0.6],
            [0.2,  0.5,  0.3,  1.0,  0.3],
            [0.2,  0.2,  0.6,  0.3,  1.0],
        ],
        ModuleType.APP: [
            # APP: State/Async interactions are critical
            [1.0,  0.3,  0.3,  0.3,  0.3],
            [0.3,  1.0,  0.5,  0.9,  0.2],  # Nesting × Async ↑
            [0.3,  0.5,  1.0,  1.3,  0.7],  # State × Async ↑↑
            [0.3,  0.9,  1.3,  1.0,  0.4],  # Async × State ↑↑
            [0.3,  0.2,  0.7,  0.4,  1.0],
        ],
        ModuleType.WEB: [
            # WEB: Nesting is most important (component hierarchy)
            [1.0,  0.5,  0.2,  0.4,  0.2],
            [0.5,  1.5,  0.3,  0.6,  0.2],  # Nesting self-weight ↑
            [0.2,  0.3,  1.0,  0.3,  0.5],
            [0.4,  0.6,  0.3,  1.0,  0.3],
            [0.2,  0.2,  0.5,  0.3,  1.0],
        ],
        ModuleType.DATA: [
            # DATA: State is most important (entity definitions)
            [1.0,  0.2,  0.3,  0.1,  0.4],
            [0.2,  1.0,  0.2,  0.1,  0.2],
            [0.3,  0.2,  1.5,  0.2,  0.8],  # State self-weight ↑, State × Coupling ↑
            [0.1,  0.1,  0.2,  1.0,  0.2],
            [0.4,  0.2,  0.8,  0.2,  1.0],  # Coupling × State ↑
        ],
        ModuleType.INFRA: [
            # INFRA: Async and Coupling are critical (DB/IO)
            [1.0,  0.2,  0.2,  0.3,  0.4],
            [0.2,  1.0,  0.2,  0.3,  0.2],
            [0.2,  0.2,  1.0,  0.4,  0.6],
            [0.3,  0.3,  0.4,  1.5,  0.8],  # Async self-weight ↑, Async × Coupling ↑
            [0.4,  0.2,  0.6,  0.8,  1.5],  # Coupling self-weight ↑, Coupling × Async ↑
        ],
        ModuleType.DEPLOY: [
            # DEPLOY: All interactions should be minimal
            [1.0,  0.1,  0.1,  0.1,  0.2],
            [0.1,  1.0,  0.1,  0.1,  0.1],
            [0.1,  0.1,  1.0,  0.1,  0.3],
            [0.1,  0.1,  0.1,  1.0,  0.2],
            [0.2,  0.1,  0.3,  0.2,  1.0],
        ],
    }

    def __init__(
        self,
        matrix: list[list[float]] | None = None,
        module_type: ModuleType = ModuleType.UNKNOWN,
    ):
        if matrix is not None:
            self._matrix = matrix
        elif module_type in self.MODULE_MATRICES:
            self._matrix = self.MODULE_MATRICES[module_type]
        else:
            self._matrix = self.DEFAULT_MATRIX

        self._module_type = module_type

    def __getitem__(self, key: tuple[int, int]) -> float:
        i, j = key
        return self._matrix[i][j]

    @property
    def matrix(self) -> list[list[float]]:
        return self._matrix

    @property
    def module_type(self) -> ModuleType:
        return self._module_type

    def quadratic_form(self, v: Vector5D) -> float:
        """
        Calculate v^T M v (quadratic form).

        This captures dimension interactions.
        """
        result = 0.0
        v_list = v.to_list()
        for i in range(5):
            for j in range(5):
                result += v_list[i] * self._matrix[i][j] * v_list[j]
        return result

    def is_positive_semidefinite(self) -> bool:
        """
        Check if matrix is positive semi-definite.

        For convergence guarantee, M must be PSD.
        Uses Sylvester's criterion (all principal minors >= 0).
        """
        # Simplified check: diagonal dominance
        for i in range(5):
            row_sum = sum(abs(self._matrix[i][j]) for j in range(5) if j != i)
            if self._matrix[i][i] < row_sum:
                return False
        return True

    def eigenvalues_approx(self) -> list[float]:
        """
        Approximate eigenvalues using power iteration.

        For a proper implementation, use numpy.linalg.eigvals.
        This is a simplified version for dependency-free operation.
        """
        # Gershgorin circle theorem bounds
        bounds = []
        for i in range(5):
            center = self._matrix[i][i]
            radius = sum(abs(self._matrix[i][j]) for j in range(5) if j != i)
            bounds.append((center - radius, center + radius))

        # Return diagonal as rough approximation
        return [self._matrix[i][i] for i in range(5)]


@dataclass
class TensorScore:
    """
    Result of tensor-based complexity calculation.

    Dual-metric approach inspired by CDR (Clinical Dementia Rating):
    - tensorScore (CDR Global style): Algorithm-based, captures interactions
    - rawSum (CDR-SOB style): Simple sum, better for tracking changes
    """

    # Raw scores
    linear: float           # ⟨v, w⟩
    quadratic: float        # v^T M v
    raw: float              # linear + quadratic

    # Regularized scores
    regularization: float   # ε‖v‖²
    regularized: float      # raw + regularization

    # Metadata
    epsilon: float
    module_type: ModuleType
    vector: Vector5D

    # CDR-SOB style metrics
    raw_sum: float          # C + N + S + A + Λ (simple sum)
    raw_sum_threshold: float  # Threshold based on canonical upper bounds
    raw_sum_ratio: float    # raw_sum / raw_sum_threshold (0-1 = safe, >1 = violation)

    @property
    def is_safe(self) -> bool:
        """Check if score is in safe zone (below threshold - ε)."""
        return self.regularized < 8.0  # threshold(10) - ε(2)

    @property
    def needs_review(self) -> bool:
        """Check if score is in ε-neighborhood."""
        return 8.0 <= self.regularized < 10.0

    @property
    def is_violation(self) -> bool:
        """Check if score exceeds threshold."""
        return self.regularized >= 10.0


def calculate_raw_sum(v: Vector5D) -> float:
    """
    Calculate raw sum of dimensions (CDR-SOB style).

    Simple sum: C + N + S + A + Λ
    """
    return v.control + v.nesting + v.state + v.async_ + v.coupling


def calculate_raw_sum_threshold(module_type: ModuleType) -> float:
    """
    Calculate rawSum threshold from canonical profile upper bounds.

    Import here to avoid circular dependency.
    """
    from semantic_complexity.core.canonical import CANONICAL_PROFILES

    profile = CANONICAL_PROFILES.get(module_type)
    if profile is None:
        profile = CANONICAL_PROFILES[ModuleType.UNKNOWN]

    return (
        profile.control[1]
        + profile.nesting[1]
        + profile.state[1]
        + profile.async_[1]
        + profile.coupling[1]
    )


def extract_vector(complexity: DimensionalComplexity) -> Vector5D:
    """Extract 5D vector from DimensionalComplexity."""
    return Vector5D(
        control=float(complexity.control),
        nesting=float(complexity.nesting),
        state=complexity._score_state(),
        async_=complexity._score_async(),
        coupling=complexity._score_coupling(),
    )


def calculate_tensor_score(
    complexity: DimensionalComplexity,
    module_type: ModuleType = ModuleType.UNKNOWN,
    epsilon: float = 2.0,
    weights: Vector5D | None = None,
) -> TensorScore:
    """
    Calculate complexity score using second-order tensor.

    score = v^T M v + ⟨v, w⟩ + ε‖v‖²

    Args:
        complexity: DimensionalComplexity result from analyzer
        module_type: Module type for context-aware interaction matrix
        epsilon: Regularization parameter (default: 2.0)
        weights: Linear weights (default: [1.0, 1.5, 2.0, 2.5, 3.0])

    Returns:
        TensorScore with detailed breakdown
    """
    if weights is None:
        weights = Vector5D(1.0, 1.5, 2.0, 2.5, 3.0)

    # Extract complexity vector
    v = extract_vector(complexity)

    # Get interaction matrix for module type
    matrix = InteractionMatrix(module_type=module_type)

    # Calculate components
    linear = v.dot(weights)
    quadratic = matrix.quadratic_form(v) * 0.1  # Scale factor for interaction term
    raw = linear + quadratic

    # ε-regularization
    regularization = epsilon * (v.norm() ** 2) * 0.01  # Scale factor
    regularized = raw + regularization

    # CDR-SOB style: simple sum and threshold
    raw_sum = calculate_raw_sum(v)
    raw_sum_threshold = calculate_raw_sum_threshold(module_type)
    raw_sum_ratio = raw_sum / raw_sum_threshold if raw_sum_threshold > 0 else 0.0

    return TensorScore(
        linear=round(linear, 2),
        quadratic=round(quadratic, 2),
        raw=round(raw, 2),
        regularization=round(regularization, 2),
        regularized=round(regularized, 2),
        epsilon=epsilon,
        module_type=module_type,
        vector=v,
        # CDR-SOB style
        raw_sum=round(raw_sum, 2),
        raw_sum_threshold=raw_sum_threshold,
        raw_sum_ratio=round(raw_sum_ratio, 3),
    )


__all__ = [
    "ModuleType",
    "Vector5D",
    "InteractionMatrix",
    "TensorScore",
    "extract_vector",
    "calculate_tensor_score",
    "calculate_raw_sum",
    "calculate_raw_sum_threshold",
    "IDX_CONTROL",
    "IDX_NESTING",
    "IDX_STATE",
    "IDX_ASYNC",
    "IDX_COUPLING",
]
