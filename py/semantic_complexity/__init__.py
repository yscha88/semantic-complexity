"""
semantic-complexity - Multi-dimensional code complexity analyzer

Python implementation of the semantic complexity analysis engine.
"""

__version__ = "0.0.1"

from semantic_complexity.core import (
    analyze_source,
    analyze_file,
    DimensionalComplexity,
    DimensionalWeights,
    DEFAULT_WEIGHTS,
)

__all__ = [
    "__version__",
    "analyze_source",
    "analyze_file",
    "DimensionalComplexity",
    "DimensionalWeights",
    "DEFAULT_WEIGHTS",
]
