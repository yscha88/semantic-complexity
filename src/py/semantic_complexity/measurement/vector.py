"""
5D 복잡도 벡터 측정

벡터 구성:
- C: Control (제어 흐름 복잡도)
- N: Nesting (중첩 깊이)
- S: State (상태 복잡도)
- A: Async (비동기 복잡도)
- L: Lambda/Coupling (결합도)
"""

__module_type__ = "lib/domain"

import ast
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import numpy as np
    from numpy.typing import NDArray

from .evidence import Location, RuleHit


@dataclass
class ComplexityVector:
    """5D 복잡도 벡터

    x_u = [C, N, S, A, Λ]

    Hodge bucket 분류:
    - algorithmic  = C + N     (🧀 Cheese)
    - balanced     = A
    - architectural = S + Λ    (🍞 Bread + 🥓 Ham)
    """
    C: float    # Control
    N: float    # Nesting
    S: float    # State
    A: float    # Async
    L: float    # Coupling (Λ)

    def to_array(self) -> "NDArray[np.float64]":
        """NumPy 배열로 변환"""
        import numpy as np
        return np.array([self.C, self.N, self.S, self.A, self.L], dtype=np.float64)

    @classmethod
    def from_array(cls, arr: "NDArray[np.float64]") -> "ComplexityVector":
        """NumPy 배열에서 생성"""
        return cls(C=float(arr[0]), N=float(arr[1]), S=float(arr[2]),
                   A=float(arr[3]), L=float(arr[4]))

    @classmethod
    def zero(cls) -> "ComplexityVector":
        """영벡터"""
        return cls(C=0.0, N=0.0, S=0.0, A=0.0, L=0.0)

    @property
    def raw_sum(self) -> float:
        """벡터 요소 합"""
        return self.C + self.N + self.S + self.A + self.L

    def to_dict(self) -> dict[str, float]:
        """dict 변환"""
        return {"C": self.C, "N": self.N, "S": self.S, "A": self.A, "L": self.L}


@dataclass
class VectorMeasurement:
    """벡터 측정 결과"""
    vector: ComplexityVector
    rule_hits: list[RuleHit] = field(default_factory=list)


class VectorAnalyzer:
    """5D 복잡도 벡터 분석기

    소스 코드를 AST로 파싱하여 5D 벡터를 측정.
    각 측정마다 RuleHit으로 근거(evidence) 수집.
    """

    def measure(
        self,
        source: str,
        entity_id: str,
        snapshot_id: str,
        file_path: str = "",
    ) -> VectorMeasurement:
        """5D 벡터 측정

        Args:
            source: Python 소스 코드
            entity_id: 엔티티 ID
            snapshot_id: 스냅샷 ID
            file_path: 파일 경로 (Location용)

        Returns:
            VectorMeasurement (vector + rule_hits)
        """
        try:
            tree = ast.parse(source)
        except SyntaxError:
            return VectorMeasurement(vector=ComplexityVector.zero())

        rule_hits: list[RuleHit] = []

        # C: Control flow
        control = self._measure_control(tree, entity_id, snapshot_id, file_path, rule_hits)

        # N: Nesting depth
        nesting = self._measure_nesting(tree, entity_id, snapshot_id, file_path, rule_hits)

        # S: State complexity
        state = self._measure_state(tree, entity_id, snapshot_id, file_path, rule_hits)

        # A: Async complexity
        async_val = self._measure_async(tree, entity_id, snapshot_id, file_path, rule_hits)

        # Λ: Coupling
        coupling = self._measure_coupling(tree, entity_id, snapshot_id, file_path, rule_hits)

        vector = ComplexityVector(
            C=control,
            N=nesting,
            S=state,
            A=async_val,
            L=coupling,
        )

        return VectorMeasurement(vector=vector, rule_hits=rule_hits)

    def _measure_control(
        self,
        tree: ast.AST,
        entity_id: str,
        snapshot_id: str,
        file_path: str,
        hits: list[RuleHit],
    ) -> float:
        """제어 흐름 복잡도 측정

        분기문(if, for, while, try, match, with) 개수 카운트.
        """
        count = 0
        locations: list[Location] = []

        for node in ast.walk(tree):
            if isinstance(node, (ast.If, ast.For, ast.While, ast.Try,
                                  ast.Match, ast.With)):
                count += 1
                locations.append(Location(
                    file=file_path,
                    line=node.lineno,
                    column=node.col_offset,
                    ast_node_type=type(node).__name__,
                ))

        if locations:
            hits.append(RuleHit(
                entity_id=entity_id,
                snapshot_id=snapshot_id,
                rule_id="control/branch",
                count=count,
                locations=locations,
            ))

        return float(count)

    def _measure_nesting(
        self,
        tree: ast.AST,
        entity_id: str,
        snapshot_id: str,
        file_path: str,
        hits: list[RuleHit],
    ) -> float:
        """중첩 깊이 측정

        최대 중첩 깊이 추적.
        """
        max_depth = 0
        deepest_location: Location | None = None

        def walk_depth(node: ast.AST, depth: int = 0) -> None:
            nonlocal max_depth, deepest_location

            # 중첩 증가 노드
            if isinstance(node, (ast.If, ast.For, ast.While, ast.Try,
                                  ast.With, ast.FunctionDef, ast.AsyncFunctionDef)):
                depth += 1
                if depth > max_depth:
                    max_depth = depth
                    deepest_location = Location(
                        file=file_path,
                        line=node.lineno,
                        column=node.col_offset,
                        ast_node_type=type(node).__name__,
                    )

            for child in ast.iter_child_nodes(node):
                walk_depth(child, depth)

        walk_depth(tree)

        if deepest_location:
            hits.append(RuleHit(
                entity_id=entity_id,
                snapshot_id=snapshot_id,
                rule_id="nesting/depth",
                count=max_depth,
                locations=[deepest_location],
            ))

        return float(max_depth)

    def _measure_state(
        self,
        tree: ast.AST,
        entity_id: str,
        snapshot_id: str,
        file_path: str,
        hits: list[RuleHit],
    ) -> float:
        """상태 복잡도 측정

        - global 문
        - nonlocal 문
        - 클래스 속성 mutation (self.xxx = yyy)
        """
        count = 0
        locations: list[Location] = []

        for node in ast.walk(tree):
            # global/nonlocal
            if isinstance(node, (ast.Global, ast.Nonlocal)):
                count += len(node.names)
                locations.append(Location(
                    file=file_path,
                    line=node.lineno,
                    column=node.col_offset,
                    ast_node_type=type(node).__name__,
                ))
            # self.xxx = yyy
            elif isinstance(node, ast.Assign):
                for target in node.targets:
                    if isinstance(target, ast.Attribute):
                        if isinstance(target.value, ast.Name) and target.value.id == "self":
                            count += 1
                            locations.append(Location(
                                file=file_path,
                                line=node.lineno,
                                column=node.col_offset,
                                ast_node_type="SelfAttributeAssign",
                            ))

        if locations:
            hits.append(RuleHit(
                entity_id=entity_id,
                snapshot_id=snapshot_id,
                rule_id="state/mutation",
                count=count,
                locations=locations,
            ))

        return float(count)

    def _measure_async(
        self,
        tree: ast.AST,
        entity_id: str,
        snapshot_id: str,
        file_path: str,
        hits: list[RuleHit],
    ) -> float:
        """비동기 복잡도 측정

        - async def
        - await
        - async for
        - async with
        """
        count = 0
        locations: list[Location] = []

        for node in ast.walk(tree):
            if isinstance(node, ast.AsyncFunctionDef):
                count += 1
                locations.append(Location(
                    file=file_path,
                    line=node.lineno,
                    column=node.col_offset,
                    ast_node_type="AsyncFunctionDef",
                ))
            elif isinstance(node, ast.Await):
                count += 1
                locations.append(Location(
                    file=file_path,
                    line=node.lineno,
                    column=node.col_offset,
                    ast_node_type="Await",
                ))
            elif isinstance(node, ast.AsyncFor):
                count += 1
                locations.append(Location(
                    file=file_path,
                    line=node.lineno,
                    column=node.col_offset,
                    ast_node_type="AsyncFor",
                ))
            elif isinstance(node, ast.AsyncWith):
                count += 1
                locations.append(Location(
                    file=file_path,
                    line=node.lineno,
                    column=node.col_offset,
                    ast_node_type="AsyncWith",
                ))

        if locations:
            hits.append(RuleHit(
                entity_id=entity_id,
                snapshot_id=snapshot_id,
                rule_id="async/complexity",
                count=count,
                locations=locations,
            ))

        return float(count)

    def _measure_coupling(
        self,
        tree: ast.AST,
        entity_id: str,
        snapshot_id: str,
        file_path: str,
        hits: list[RuleHit],
    ) -> float:
        """결합도 측정

        - import 문 개수
        - 함수 파라미터 개수 (과다 파라미터)
        """
        import_count = 0
        param_violations = 0
        locations: list[Location] = []

        for node in ast.walk(tree):
            # import
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                import_count += 1
                locations.append(Location(
                    file=file_path,
                    line=node.lineno,
                    column=node.col_offset,
                    ast_node_type="Import",
                ))
            # 과다 파라미터 (> 5)
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                args = node.args
                total_params = (
                    len(args.posonlyargs) +
                    len(args.args) +
                    len(args.kwonlyargs) +
                    (1 if args.vararg else 0) +
                    (1 if args.kwarg else 0)
                )
                # self/cls 제외
                if args.args and args.args[0].arg in ("self", "cls"):
                    total_params -= 1

                if total_params > 5:
                    param_violations += 1
                    locations.append(Location(
                        file=file_path,
                        line=node.lineno,
                        column=node.col_offset,
                        ast_node_type="ExcessiveParams",
                    ))

        # 결합도 = import 수 * 0.5 + 파라미터 위반 * 2
        coupling = import_count * 0.5 + param_violations * 2.0

        if locations:
            hits.append(RuleHit(
                entity_id=entity_id,
                snapshot_id=snapshot_id,
                rule_id="coupling/dependency",
                count=import_count + param_violations,
                locations=locations,
            ))

        return coupling


# ============================================================
# 공개 API
# ============================================================

__all__ = [
    "ComplexityVector",
    "VectorMeasurement",
    "VectorAnalyzer",
]
