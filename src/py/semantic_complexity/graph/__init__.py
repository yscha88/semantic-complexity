"""
graph 모듈

그래프 데이터 모델 및 저장소.

구성요소:
- entity.py: Entity (코드 엔티티)
- snapshot.py: Snapshot (커밋 단위 스냅샷)
- edge.py: Edge (그래프 간선)
- metrics.py: Metrics (엔티티별 메트릭)
- store.py: SQLite 기반 저장소
"""

__architecture_role__ = "lib/domain"

from .entity import (
    EntityType,
    Entity,
    create_entity_id,
)
from .snapshot import (
    Snapshot,
    create_snapshot,
)
from .edge import (
    EdgeType,
    WeightComponents,
    Edge,
)
from .metrics import (
    Metrics,
)
from .store import (
    SQLiteStore,
)

__all__ = [
    # Entity
    "EntityType",
    "Entity",
    "create_entity_id",
    # Snapshot
    "Snapshot",
    "create_snapshot",
    # Edge
    "EdgeType",
    "WeightComponents",
    "Edge",
    # Metrics
    "Metrics",
    # Store
    "SQLiteStore",
]
