"""
Core complexity analysis engine (v0.0.3).

Dimensions (5D Domain Space):
- 1D Control: Cyclomatic complexity - dim H₁(G) + 1 (First Betti number)
- 2D Nesting: Depth penalty - Σᵢ depth(nodeᵢ)
- 3D State: State mutations - |∂Γ/∂t| (State transition rate)
- 4D Async: Async boundaries - π₁(async-flow) (Fundamental group)
- 5D Coupling: Hidden dependencies - deg(v) in G_dep

v0.0.3 Features:
- Second-order tensor: score = v^T M v + ⟨v, w⟩
- ε-regularization for convergence
- Module-type canonical profiles
- Hodge decomposition of complexity space
"""

from __future__ import annotations

import ast
from dataclasses import dataclass, field
from pathlib import Path
from typing import NamedTuple

from semantic_complexity.core.canonical import (
    CANONICAL_PROFILES,
    CanonicalProfile,
    ComplexityLevel,
    DeviationResult,
    HodgeDecomposition,
    analyze_deviation,
    classify_complexity_level,
    find_best_module_type,
    hodge_decomposition,
)
from semantic_complexity.core.convergence import (
    ConvergenceResult,
    ConvergenceStatus,
    IterationHistory,
    RefactoringRecommendation,
    analyze_convergence,
    convergence_score,
    recommend_refactoring,
)

# v0.0.3 imports
from semantic_complexity.core.tensor import (
    InteractionMatrix,
    ModuleType,
    TensorScore,
    Vector5D,
    calculate_tensor_score,
    extract_vector,
)

# v0.0.8 imports
from semantic_complexity.core.invariants import (
    CognitiveViolation,
    InvariantCheckResult,
    LockedZoneWarning,
    SecretViolation,
    check_all_invariants,
    check_cognitive_invariant,
    check_locked_zone,
    detect_secrets,
)


class DimensionalWeights(NamedTuple):
    """Weight multipliers for each complexity dimension."""

    control: float = 1.0
    nesting: float = 1.5
    state: float = 2.0
    async_: float = 2.5
    coupling: float = 3.0


DEFAULT_WEIGHTS = DimensionalWeights()


@dataclass
class StateComplexity:
    """3D: State complexity metrics."""

    state_mutations: int = 0
    state_reads: int = 0
    state_branches: int = 0
    state_patterns: int = 0


@dataclass
class AsyncComplexity:
    """4D: Async complexity metrics."""

    async_boundaries: int = 0
    await_count: int = 0
    callback_depth: int = 0
    concurrent_patterns: int = 0


@dataclass
class CouplingComplexity:
    """5D: Hidden coupling complexity metrics."""

    global_access: int = 0
    side_effects: int = 0
    env_dependency: int = 0
    implicit_io: int = 0
    console_io: int = 0  # v0.0.8: print/logging (낮은 가중치)
    closure_captures: int = 0


@dataclass
class DimensionalComplexity:
    """Complete dimensional complexity result."""

    control: int = 0
    nesting: int = 0
    state: StateComplexity = field(default_factory=StateComplexity)
    async_: AsyncComplexity = field(default_factory=AsyncComplexity)
    coupling: CouplingComplexity = field(default_factory=CouplingComplexity)
    weighted: float = 0.0
    weights: DimensionalWeights = field(default_factory=lambda: DEFAULT_WEIGHTS)

    @property
    def contributions(self) -> dict[str, float]:
        """Calculate contribution of each dimension."""
        if self.weighted == 0:
            return {"control": 0, "nesting": 0, "state": 0, "async": 0, "coupling": 0}

        control_w = self.control * self.weights.control
        nesting_w = self.nesting * self.weights.nesting
        state_w = self._score_state() * self.weights.state
        async_w = self._score_async() * self.weights.async_
        coupling_w = self._score_coupling() * self.weights.coupling

        total = control_w + nesting_w + state_w + async_w + coupling_w
        if total == 0:
            return {"control": 0, "nesting": 0, "state": 0, "async": 0, "coupling": 0}

        return {
            "control": round(control_w / total, 3),
            "nesting": round(nesting_w / total, 3),
            "state": round(state_w / total, 3),
            "async": round(async_w / total, 3),
            "coupling": round(coupling_w / total, 3),
        }

    def _score_state(self) -> float:
        return (
            self.state.state_mutations * 2
            + self.state.state_reads * 0.5
            + self.state.state_branches * 3
            + self.state.state_patterns * 5
        )

    def _score_async(self) -> float:
        return (
            self.async_.async_boundaries * 1
            + self.async_.await_count * 1
            + self.async_.callback_depth * 3
            + self.async_.concurrent_patterns * 4
        )

    def _score_coupling(self) -> float:
        """v0.0.8: console_io는 낮은 가중치 (디버깅/로깅 목적)."""
        return (
            self.coupling.global_access * 2
            + self.coupling.side_effects * 3
            + self.coupling.env_dependency * 2
            + self.coupling.implicit_io * 2
            + self.coupling.console_io * 0.5  # print/logging은 낮은 가중치
            + self.coupling.closure_captures * 1
        )


@dataclass
class FunctionComplexity:
    """Complexity result for a single function."""

    name: str
    lineno: int
    end_lineno: int
    cyclomatic: int
    cognitive: int
    dimensional: DimensionalComplexity


# ─────────────────────────────────────────────────────────────────
# AST Visitor for Complexity Analysis
# ─────────────────────────────────────────────────────────────────

# v0.0.8: 콘솔 출력 함수 (낮은 가중치 - 디버깅/로깅 목적)
CONSOLE_FUNCTIONS = frozenset({
    "print", "logging", "logger",
})

# 실제 I/O 함수 (높은 가중치)
IO_FUNCTIONS = frozenset({
    "input", "open", "read", "write", "close",
})

GLOBAL_OBJECTS = frozenset({
    "os", "sys", "environ", "globals", "locals",
})

STATE_PATTERNS = frozenset({
    "state", "status", "mode", "phase", "step", "stage", "flag",
})


class ComplexityVisitor(ast.NodeVisitor):
    """AST visitor for calculating complexity metrics."""

    def __init__(self) -> None:
        self.control = 0
        self.nesting = 0
        self.max_nesting = 0
        self.current_depth = 0

        self.state = StateComplexity()
        self.async_ = AsyncComplexity()
        self.coupling = CouplingComplexity()

        self._local_vars: set[str] = set()
        self._in_async = False

    def _enter_block(self) -> None:
        self.current_depth += 1
        self.max_nesting = max(self.max_nesting, self.current_depth)
        self.nesting += self.current_depth

    def _exit_block(self) -> None:
        self.current_depth -= 1

    # 1D Control Flow
    def visit_If(self, node: ast.If) -> None:
        self.control += 1
        self._enter_block()
        self.generic_visit(node)
        self._exit_block()

    def visit_For(self, node: ast.For) -> None:
        self.control += 1
        self._enter_block()
        self.generic_visit(node)
        self._exit_block()

    def visit_While(self, node: ast.While) -> None:
        self.control += 1
        self._enter_block()
        self.generic_visit(node)
        self._exit_block()

    def visit_Try(self, node: ast.Try) -> None:
        self.control += len(node.handlers)
        self._enter_block()
        self.generic_visit(node)
        self._exit_block()

    def visit_With(self, node: ast.With) -> None:
        self.control += 1
        self._enter_block()
        self.generic_visit(node)
        self._exit_block()

    def visit_Match(self, node: ast.Match) -> None:
        self.control += len(node.cases)
        self._enter_block()
        self.generic_visit(node)
        self._exit_block()

    def visit_BoolOp(self, node: ast.BoolOp) -> None:
        # and/or operators add to control complexity
        self.control += len(node.values) - 1
        self.generic_visit(node)

    def visit_IfExp(self, node: ast.IfExp) -> None:
        # Ternary operator
        self.control += 1
        self.generic_visit(node)

    def visit_comprehension(self, node: ast.comprehension) -> None:
        self.control += 1
        if node.ifs:
            self.control += len(node.ifs)
        self.generic_visit(node)

    # 3D State
    def visit_Assign(self, node: ast.Assign) -> None:
        for target in node.targets:
            if isinstance(target, ast.Name):
                name = target.id
                if self._is_state_variable(name):
                    self.state.state_mutations += 1
                self._local_vars.add(name)
        self.generic_visit(node)

    def visit_AugAssign(self, node: ast.AugAssign) -> None:
        if isinstance(node.target, ast.Name):
            self.state.state_mutations += 1
        self.generic_visit(node)

    def visit_AnnAssign(self, node: ast.AnnAssign) -> None:
        if isinstance(node.target, ast.Name):
            self._local_vars.add(node.target.id)
        self.generic_visit(node)

    def _is_state_variable(self, name: str) -> bool:
        name_lower = name.lower()
        has_pattern = any(p in name_lower for p in STATE_PATTERNS)
        return has_pattern or name.startswith("is_") or name.startswith("has_")

    # 4D Async
    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        self.async_.async_boundaries += 1
        old_async = self._in_async
        self._in_async = True
        self.generic_visit(node)
        self._in_async = old_async

    def visit_Await(self, node: ast.Await) -> None:
        self.async_.await_count += 1
        self.generic_visit(node)

    def visit_AsyncFor(self, node: ast.AsyncFor) -> None:
        self.async_.async_boundaries += 1
        self.control += 1
        self._enter_block()
        self.generic_visit(node)
        self._exit_block()

    def visit_AsyncWith(self, node: ast.AsyncWith) -> None:
        self.async_.async_boundaries += 1
        self.control += 1
        self._enter_block()
        self.generic_visit(node)
        self._exit_block()

    # 5D Coupling
    def visit_Global(self, node: ast.Global) -> None:
        self.coupling.global_access += len(node.names)
        self.generic_visit(node)

    def visit_Nonlocal(self, node: ast.Nonlocal) -> None:
        self.coupling.closure_captures += len(node.names)
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call) -> None:
        func_name = self._get_call_name(node)
        if func_name:
            # v0.0.8: console 출력과 실제 I/O 구분
            if func_name in CONSOLE_FUNCTIONS:
                self.coupling.console_io += 1
            elif func_name in IO_FUNCTIONS:
                self.coupling.implicit_io += 1
            if func_name in GLOBAL_OBJECTS:
                self.coupling.global_access += 1
            if func_name in {"asyncio.gather", "asyncio.wait", "asyncio.create_task"}:
                self.async_.concurrent_patterns += 1
        self.generic_visit(node)

    def visit_Attribute(self, node: ast.Attribute) -> None:
        if isinstance(node.value, ast.Name):
            obj_name = node.value.id
            if obj_name == "os" and node.attr == "environ":
                self.coupling.env_dependency += 1
            elif obj_name == "self":
                if node.attr.startswith("_"):
                    self.coupling.side_effects += 1
        self.generic_visit(node)

    def visit_Name(self, node: ast.Name) -> None:
        if node.id in GLOBAL_OBJECTS:
            self.coupling.global_access += 1
        self.generic_visit(node)

    def _get_call_name(self, node: ast.Call) -> str | None:
        if isinstance(node.func, ast.Name):
            return node.func.id
        if isinstance(node.func, ast.Attribute):
            if isinstance(node.func.value, ast.Name):
                return f"{node.func.value.id}.{node.func.attr}"
        return None

    def visit_Lambda(self, node: ast.Lambda) -> None:
        self.async_.callback_depth += 1
        self.generic_visit(node)

    def get_result(self, weights: DimensionalWeights = DEFAULT_WEIGHTS) -> DimensionalComplexity:
        """Calculate final dimensional complexity."""
        result = DimensionalComplexity(
            control=self.control,
            nesting=self.nesting,
            state=self.state,
            async_=self.async_,
            coupling=self.coupling,
            weights=weights,
        )

        # Calculate weighted sum
        weighted = (
            result.control * weights.control
            + result.nesting * weights.nesting
            + result._score_state() * weights.state
            + result._score_async() * weights.async_
            + result._score_coupling() * weights.coupling
        )
        result.weighted = round(weighted, 1)

        return result


# ─────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────


def analyze_source(
    source: str,
    filename: str = "input.py",
    weights: DimensionalWeights = DEFAULT_WEIGHTS,
) -> DimensionalComplexity:
    """Analyze complexity of Python source code."""
    try:
        tree = ast.parse(source, filename=filename)
    except SyntaxError:
        return DimensionalComplexity(weights=weights)

    visitor = ComplexityVisitor()
    visitor.visit(tree)
    return visitor.get_result(weights)


def analyze_file(
    filepath: str | Path,
    weights: DimensionalWeights = DEFAULT_WEIGHTS,
) -> DimensionalComplexity:
    """Analyze complexity of a Python file."""
    path = Path(filepath)
    source = path.read_text(encoding="utf-8")
    return analyze_source(source, str(path), weights)


def analyze_functions(
    source: str,
    filename: str = "input.py",
    weights: DimensionalWeights | None = None,
) -> list[FunctionComplexity]:
    """Analyze complexity of each function in source code."""
    if weights is None:
        weights = DEFAULT_WEIGHTS

    try:
        tree = ast.parse(source, filename=filename)
    except SyntaxError:
        return []

    results: list[FunctionComplexity] = []

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            # Extract function body
            func_source = ast.get_source_segment(source, node)
            if func_source:
                visitor = ComplexityVisitor()
                visitor.visit(node)
                dimensional = visitor.get_result(weights)

                results.append(
                    FunctionComplexity(
                        name=node.name,
                        lineno=node.lineno,
                        end_lineno=node.end_lineno or node.lineno,
                        cyclomatic=dimensional.control + 1,
                        cognitive=dimensional.control + dimensional.nesting,
                        dimensional=dimensional,
                    )
                )

    return results


__all__ = [
    # v0.0.2 exports
    "DimensionalWeights",
    "DEFAULT_WEIGHTS",
    "StateComplexity",
    "AsyncComplexity",
    "CouplingComplexity",
    "DimensionalComplexity",
    "FunctionComplexity",
    "analyze_source",
    "analyze_file",
    "analyze_functions",
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
