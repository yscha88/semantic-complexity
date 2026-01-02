"""
graph 모듈 테스트

- entity: Entity 관리
- snapshot: Snapshot 관리
- edge: Edge 관리
- metrics: Metrics
- store: SQLiteStore
"""

import pytest
from datetime import datetime

from semantic_complexity.graph import (
    Entity,
    EntityType,
    create_entity_id,
    Snapshot,
    create_snapshot,
    Edge,
    EdgeType,
    WeightComponents,
    Metrics,
    SQLiteStore,
)
from semantic_complexity.graph.entity import create_entity
from semantic_complexity.graph.edge import create_edge
from semantic_complexity.graph.metrics import create_metrics
from semantic_complexity.measurement import ComplexityVector, HodgeBucket


# ============================================================
# Entity 테스트
# ============================================================

class TestEntity:
    """Entity 테스트"""

    def test_entity_type_values(self):
        """EntityType 값"""
        assert EntityType.MODULE.value == "module"
        assert EntityType.FILE.value == "file"
        assert EntityType.FUNC.value == "func"
        assert EntityType.OBJECT.value == "object"

    def test_create_entity_id(self):
        """entity_id 생성"""
        id1 = create_entity_id("src/main.py", "func1", "python")
        id2 = create_entity_id("src/main.py", "func1", "python")
        id3 = create_entity_id("src/main.py", "func2", "python")

        assert id1 == id2  # 동일 입력 → 동일 ID
        assert id1 != id3  # 다른 심볼 → 다른 ID
        assert len(id1) == 16

    def test_create_entity_id_normalizes_path(self):
        """경로 정규화"""
        id1 = create_entity_id("src/main.py", "func1", "python")
        id2 = create_entity_id("src\\main.py", "func1", "python")
        assert id1 == id2

    def test_create_entity(self):
        """Entity 생성"""
        entity = create_entity(
            path="src/main.py",
            symbol="my_func",
            entity_type=EntityType.FUNC,
            language="python",
        )
        assert entity.type == EntityType.FUNC
        assert entity.path == "src/main.py"
        assert entity.symbol == "my_func"

    def test_entity_qualified_name(self):
        """qualified_name"""
        entity = Entity(
            entity_id="abc123",
            type=EntityType.FUNC,
            path="src/main.py",
            symbol="my_func",
            language="python",
        )
        assert entity.qualified_name == "src/main.py:my_func"

    def test_entity_to_dict(self):
        """dict 변환"""
        entity = Entity(
            entity_id="abc123",
            type=EntityType.FUNC,
            path="src/main.py",
            symbol="my_func",
            language="python",
        )
        d = entity.to_dict()
        assert d["entity_id"] == "abc123"
        assert d["type"] == "func"


# ============================================================
# Snapshot 테스트
# ============================================================

class TestSnapshot:
    """Snapshot 테스트"""

    def test_create_snapshot(self):
        """Snapshot 생성"""
        snapshot = create_snapshot(
            commit="abc123def456",
            repo="my-repo",
        )
        assert snapshot.commit == "abc123def456"
        assert snapshot.repo == "my-repo"
        assert snapshot.release_id == "abc123de"
        assert snapshot.env == "dev"

    def test_snapshot_release_id(self):
        """release_id는 commit 앞 8자"""
        snapshot = Snapshot(
            snapshot_id="snap-1",
            commit="1234567890abcdef",
            timestamp=datetime.now(),
            repo="test",
        )
        assert snapshot.release_id == "12345678"

    def test_snapshot_to_dict(self):
        """dict 변환"""
        snapshot = create_snapshot("abc123", "test-repo")
        d = snapshot.to_dict()
        assert "snapshot_id" in d
        assert d["commit"] == "abc123"
        assert d["release_id"] == "abc123"[:8]


# ============================================================
# Edge 테스트
# ============================================================

class TestEdge:
    """Edge 테스트"""

    def test_edge_type_values(self):
        """EdgeType 값"""
        assert EdgeType.IMPORT.value == "import"
        assert EdgeType.CALL.value == "call"
        assert EdgeType.BOUNDARY.value == "boundary"

    def test_weight_components(self):
        """WeightComponents"""
        w = WeightComponents(coupling=0.5, boundary=1.0, cognitive=0.3)
        assert w.total == 1.8
        assert w.to_dict()["coupling"] == 0.5

    def test_create_edge(self):
        """Edge 생성"""
        edge = create_edge(
            src_entity="ent-1",
            dst_entity="ent-2",
            snapshot_id="snap-1",
            edge_type=EdgeType.IMPORT,
            coupling=0.5,
            boundary=1.0,
        )
        assert edge.weight_total == 1.5
        assert edge.is_boundary_crossing() is True

    def test_edge_is_boundary_crossing(self):
        """경계 통과 판정"""
        # boundary edge type
        e1 = Edge(
            src_entity="a", dst_entity="b", snapshot_id="s",
            edge_type=EdgeType.BOUNDARY,
        )
        assert e1.is_boundary_crossing() is True

        # boundary weight > 0
        e2 = Edge(
            src_entity="a", dst_entity="b", snapshot_id="s",
            edge_type=EdgeType.IMPORT,
            weight_components=WeightComponents(boundary=0.5),
        )
        assert e2.is_boundary_crossing() is True

        # 일반 edge
        e3 = Edge(
            src_entity="a", dst_entity="b", snapshot_id="s",
            edge_type=EdgeType.CALL,
        )
        assert e3.is_boundary_crossing() is False


# ============================================================
# Metrics 테스트
# ============================================================

class TestMetrics:
    """Metrics 테스트"""

    def test_create_metrics(self):
        """Metrics 생성"""
        x = ComplexityVector(C=5, N=3, S=2, A=1, L=4)
        metrics = create_metrics(
            entity_id="ent-1",
            snapshot_id="snap-1",
            x=x,
            d=1.5,
            hodge=HodgeBucket.ALGORITHMIC,
            module_type="lib/domain",
        )
        assert metrics.raw_sum == 15.0
        assert metrics.d == 1.5

    def test_metrics_auto_raw_sum(self):
        """raw_sum 자동 계산"""
        x = ComplexityVector(C=1, N=2, S=3, A=4, L=5)
        metrics = Metrics(
            entity_id="ent-1",
            snapshot_id="snap-1",
            x=x,
        )
        assert metrics.raw_sum == 15.0

    def test_metrics_to_dict(self):
        """dict 변환"""
        x = ComplexityVector(C=1, N=2, S=3, A=4, L=5)
        metrics = Metrics(
            entity_id="ent-1",
            snapshot_id="snap-1",
            x=x,
            d=1.0,
            hodge=HodgeBucket.ALGORITHMIC,
        )
        d = metrics.to_dict()
        assert d["entity_id"] == "ent-1"
        assert d["x"]["C"] == 1


# ============================================================
# SQLiteStore 테스트
# ============================================================

class TestSQLiteStore:
    """SQLiteStore 테스트"""

    @pytest.fixture
    def store(self):
        """인메모리 스토어"""
        s = SQLiteStore()
        yield s
        s.close()

    def test_insert_and_get_snapshot(self, store):
        """스냅샷 저장/조회"""
        snapshot = create_snapshot("abc123", "test-repo")
        store.insert_snapshot(snapshot)

        retrieved = store.get_snapshot(snapshot.snapshot_id)
        assert retrieved is not None
        assert retrieved.commit == "abc123"

    def test_insert_and_get_entity(self, store):
        """엔티티 저장/조회"""
        entity = create_entity(
            path="src/main.py",
            symbol="func1",
            entity_type=EntityType.FUNC,
        )
        store.insert_entity(entity, "test-repo")

        retrieved = store.get_entity(entity.entity_id)
        assert retrieved is not None
        assert retrieved.symbol == "func1"

    def test_insert_and_get_metrics(self, store):
        """메트릭 저장/조회"""
        snapshot = create_snapshot("abc123", "test-repo")
        store.insert_snapshot(snapshot)

        entity = create_entity("src/main.py", "func1", EntityType.FUNC)
        store.insert_entity(entity, "test-repo")

        x = ComplexityVector(C=5, N=3, S=2, A=1, L=4)
        metrics = create_metrics(
            entity_id=entity.entity_id,
            snapshot_id=snapshot.snapshot_id,
            x=x,
            d=1.5,
            hodge=HodgeBucket.ALGORITHMIC,
        )
        store.insert_metrics(metrics)

        retrieved = store.get_metrics(snapshot.snapshot_id, entity.entity_id)
        assert retrieved is not None
        assert retrieved.d == pytest.approx(1.5, rel=1e-2)

    def test_get_hotspots(self, store):
        """Hotspot 조회"""
        snapshot = create_snapshot("abc123", "test-repo")
        store.insert_snapshot(snapshot)

        for i in range(3):
            entity = create_entity(f"src/mod{i}.py", f"func{i}", EntityType.FUNC)
            store.insert_entity(entity, "test-repo")
            metrics = Metrics(
                entity_id=entity.entity_id,
                snapshot_id=snapshot.snapshot_id,
                x=ComplexityVector(C=i*2, N=i, S=1, A=0, L=1),
                d=float(i),  # 0, 1, 2
            )
            store.insert_metrics(metrics)

        hotspots = store.get_hotspots(snapshot.snapshot_id, limit=2)
        assert len(hotspots) == 2
        # deviation 내림차순
        assert hotspots[0]["canonical_deviation"] >= hotspots[1]["canonical_deviation"]

    def test_get_phi(self, store):
        """Φ 조회"""
        snapshot = create_snapshot("abc123", "test-repo")
        store.insert_snapshot(snapshot)

        for i, d in enumerate([1.0, 2.0, 3.0]):
            entity = create_entity(f"src/mod{i}.py", f"func{i}", EntityType.FUNC)
            store.insert_entity(entity, "test-repo")
            metrics = Metrics(
                entity_id=entity.entity_id,
                snapshot_id=snapshot.snapshot_id,
                x=ComplexityVector.zero(),
                d=d,
            )
            store.insert_metrics(metrics)

        phi = store.get_phi(snapshot.snapshot_id)
        assert phi == 6.0  # 1+2+3

    def test_insert_and_get_edges(self, store):
        """간선 저장/조회"""
        snapshot = create_snapshot("abc123", "test-repo")
        store.insert_snapshot(snapshot)

        edge = create_edge(
            src_entity="ent-1",
            dst_entity="ent-2",
            snapshot_id=snapshot.snapshot_id,
            edge_type=EdgeType.IMPORT,
            coupling=0.5,
        )
        store.insert_edge(edge)

        edges = store.get_edges(snapshot.snapshot_id)
        assert len(edges) == 1
        assert edges[0].src_entity == "ent-1"

    def test_get_boundary_flux(self, store):
        """경계 Flux 조회"""
        snapshot = create_snapshot("abc123", "test-repo")
        store.insert_snapshot(snapshot)

        # boundary edge
        e1 = create_edge("a", "b", snapshot.snapshot_id, EdgeType.BOUNDARY,
                         boundary=2.0)
        # non-boundary edge
        e2 = create_edge("c", "d", snapshot.snapshot_id, EdgeType.CALL,
                         coupling=1.0)
        store.insert_edge(e1)
        store.insert_edge(e2)

        flux = store.get_boundary_flux(snapshot.snapshot_id)
        assert flux == 2.0  # boundary만
