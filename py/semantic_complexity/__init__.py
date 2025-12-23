"""
semantic-complexity - Multi-dimensional code complexity analyzer

Python implementation of the semantic complexity analysis engine.

Dimensions:
- 1D Control: Cyclomatic complexity (branches, loops) - weight 1.0
- 2D Nesting: Depth penalty - weight 1.5
- 3D State: State mutations and transitions - weight 2.0
- 4D Async: Async/await, coroutines - weight 2.5
- 5D Coupling: Hidden dependencies, side effects - weight 3.0
"""

__version__ = "0.0.2"

from semantic_complexity.core import (
    # Constants
    DEFAULT_WEIGHTS,
    AsyncComplexity,
    CouplingComplexity,
    # Result types
    DimensionalComplexity,
    DimensionalWeights,
    FunctionComplexity,
    StateComplexity,
    analyze_file,
    analyze_functions,
    # Main API
    analyze_source,
)

__all__ = [
    "__version__",
    # Main API
    "analyze_source",
    "analyze_file",
    "analyze_functions",
    # Result types
    "DimensionalComplexity",
    "DimensionalWeights",
    "StateComplexity",
    "AsyncComplexity",
    "CouplingComplexity",
    "FunctionComplexity",
    # Constants
    "DEFAULT_WEIGHTS",
]
