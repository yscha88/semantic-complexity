"""
semantic-complexity - Multi-dimensional code complexity analyzer (v0.0.3)

Python implementation of the semantic complexity analysis engine.

Dimensions (5D Domain Space):
- 1D Control: Cyclomatic complexity - dim H₁(G) + 1 - weight 1.0
- 2D Nesting: Depth penalty - Σᵢ depth(nodeᵢ) - weight 1.5
- 3D State: State mutations - |∂Γ/∂t| - weight 2.0
- 4D Async: Async boundaries - π₁(async-flow) - weight 2.5
- 5D Coupling: Hidden dependencies - deg(v) in G_dep - weight 3.0

v0.0.3 Features:
- Second-order tensor: score = v^T M v + ⟨v, w⟩
- ε-regularization for convergence
- Module-type canonical profiles
- Hodge decomposition of complexity space
"""

__version__ = "0.0.3"

from semantic_complexity.core import (
    CANONICAL_PROFILES,
    # v0.0.2 API
    DEFAULT_WEIGHTS,
    AsyncComplexity,
    CanonicalProfile,
    # v0.0.3 Canonical
    ComplexityLevel,
    ConvergenceResult,
    # v0.0.3 Convergence
    ConvergenceStatus,
    CouplingComplexity,
    DeviationResult,
    DimensionalComplexity,
    DimensionalWeights,
    FunctionComplexity,
    HodgeDecomposition,
    InteractionMatrix,
    IterationHistory,
    # v0.0.3 Tensor
    ModuleType,
    RefactoringRecommendation,
    StateComplexity,
    TensorScore,
    Vector5D,
    analyze_convergence,
    analyze_deviation,
    analyze_file,
    analyze_functions,
    analyze_source,
    calculate_tensor_score,
    classify_complexity_level,
    convergence_score,
    extract_vector,
    find_best_module_type,
    hodge_decomposition,
    recommend_refactoring,
)

__all__ = [
    "__version__",
    # v0.0.2 API
    "analyze_source",
    "analyze_file",
    "analyze_functions",
    "DimensionalComplexity",
    "DimensionalWeights",
    "StateComplexity",
    "AsyncComplexity",
    "CouplingComplexity",
    "FunctionComplexity",
    "DEFAULT_WEIGHTS",
    # v0.0.3 Tensor
    "ModuleType",
    "Vector5D",
    "InteractionMatrix",
    "TensorScore",
    "extract_vector",
    "calculate_tensor_score",
    # v0.0.3 Convergence
    "ConvergenceStatus",
    "ConvergenceResult",
    "IterationHistory",
    "RefactoringRecommendation",
    "convergence_score",
    "analyze_convergence",
    "recommend_refactoring",
    # v0.0.3 Canonical
    "ComplexityLevel",
    "CanonicalProfile",
    "DeviationResult",
    "HodgeDecomposition",
    "CANONICAL_PROFILES",
    "analyze_deviation",
    "find_best_module_type",
    "classify_complexity_level",
    "hodge_decomposition",
]
