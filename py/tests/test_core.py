"""Tests for core complexity analysis."""

from semantic_complexity.core import (
    DEFAULT_WEIGHTS,
    DimensionalComplexity,
    analyze_source,
)


def test_default_weights():
    """Test default weight values."""
    assert DEFAULT_WEIGHTS.control == 1.0
    assert DEFAULT_WEIGHTS.nesting == 1.5
    assert DEFAULT_WEIGHTS.state == 2.0
    assert DEFAULT_WEIGHTS.async_ == 2.5
    assert DEFAULT_WEIGHTS.coupling == 3.0


def test_analyze_source():
    """Test basic source analysis."""
    result = analyze_source("")
    assert isinstance(result, DimensionalComplexity)
