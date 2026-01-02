"""
Edge (그래프 간선)

엔티티 간 관계.
가중치 구성요소: coupling, boundary, cognitive, failure_propagation.
"""

__module_type__ = "lib/domain"

from dataclasses import dataclass, field
from enum import Enum


class EdgeType(Enum):
    """간선 타입"""
    IMPORT = "import"         # 모듈 의존성
    CALL = "call"             # 함수 호출
    INHERIT = "inherit"       # 클래스 상속
    BOUNDARY = "boundary"     # Trust boundary crossing


@dataclass
class WeightComponents:
    """간선 가중치 구성요소

    coupling: α - 결합도
    boundary: β - 경계 통과
    cognitive: γ - 인지 복잡도 전파
    failure_propagation: δ - 장애 전파
    """
    coupling: float = 0.0
    boundary: float = 0.0
    cognitive: float = 0.0
    failure_propagation: float = 0.0

    @property
    def total(self) -> float:
        """총 가중치"""
        return self.coupling + self.boundary + self.cognitive + self.failure_propagation

    def to_dict(self) -> dict:
        """dict 변환"""
        return {
            "coupling": self.coupling,
            "boundary": self.boundary,
            "cognitive": self.cognitive,
            "failure_propagation": self.failure_propagation,
        }


@dataclass
class Edge:
    """그래프 간선

    src_entity: 출발 엔티티 ID
    dst_entity: 도착 엔티티 ID
    snapshot_id: 스냅샷 ID
    edge_type: 간선 타입
    weight_components: 가중치 구성요소
    """
    src_entity: str
    dst_entity: str
    snapshot_id: str
    edge_type: EdgeType
    weight_components: WeightComponents = field(default_factory=WeightComponents)

    @property
    def weight_total(self) -> float:
        """총 가중치"""
        return self.weight_components.total

    def is_boundary_crossing(self) -> bool:
        """경계 통과 간선 여부"""
        return (
            self.edge_type == EdgeType.BOUNDARY or
            self.weight_components.boundary > 0
        )

    def to_dict(self) -> dict:
        """dict 변환"""
        return {
            "src_entity": self.src_entity,
            "dst_entity": self.dst_entity,
            "snapshot_id": self.snapshot_id,
            "edge_type": self.edge_type.value,
            "weight_total": self.weight_total,
            "weight_components": self.weight_components.to_dict(),
        }


def create_edge(
    src_entity: str,
    dst_entity: str,
    snapshot_id: str,
    edge_type: EdgeType,
    coupling: float = 0.0,
    boundary: float = 0.0,
    cognitive: float = 0.0,
    failure_propagation: float = 0.0,
) -> Edge:
    """Edge 생성

    Args:
        src_entity: 출발 엔티티 ID
        dst_entity: 도착 엔티티 ID
        snapshot_id: 스냅샷 ID
        edge_type: 간선 타입
        coupling: 결합도 가중치
        boundary: 경계 가중치
        cognitive: 인지 가중치
        failure_propagation: 장애 전파 가중치

    Returns:
        Edge
    """
    return Edge(
        src_entity=src_entity,
        dst_entity=dst_entity,
        snapshot_id=snapshot_id,
        edge_type=edge_type,
        weight_components=WeightComponents(
            coupling=coupling,
            boundary=boundary,
            cognitive=cognitive,
            failure_propagation=failure_propagation,
        ),
    )


# ============================================================
# 공개 API
# ============================================================

__all__ = [
    "EdgeType",
    "WeightComponents",
    "Edge",
    "create_edge",
]
