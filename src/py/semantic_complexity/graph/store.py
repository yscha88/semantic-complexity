"""
SQLite 기반 저장소

로컬 개발용 lightweight 저장소.
SDS 11.8 SQLite 스키마 구현.
"""

__module_type__ = "lib/domain"

import json
import sqlite3
from pathlib import Path
from typing import Any

from .entity import Entity, EntityType
from .snapshot import Snapshot
from .edge import Edge, EdgeType, WeightComponents
from .metrics import Metrics
from ..measurement.vector import ComplexityVector
from ..measurement.hodge import HodgeBucket


class SQLiteStore:
    """SQLite 기반 로컬 저장소

    SDS 11.8 스키마 구현.
    """

    SCHEMA = """
    CREATE TABLE IF NOT EXISTS snapshots (
        snapshot_id TEXT PRIMARY KEY,
        repo TEXT NOT NULL,
        commit_hash TEXT NOT NULL,
        release_id TEXT NOT NULL,
        ts TEXT NOT NULL,
        analyzer_version TEXT NOT NULL,
        UNIQUE(repo, commit_hash)
    );

    CREATE TABLE IF NOT EXISTS entities (
        entity_id TEXT PRIMARY KEY,
        repo TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        language TEXT NOT NULL,
        path TEXT,
        symbol TEXT,
        fingerprint TEXT NOT NULL,
        UNIQUE(repo, fingerprint)
    );

    CREATE TABLE IF NOT EXISTS metrics (
        snapshot_id TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        module_type TEXT NOT NULL,
        c REAL, n REAL, s REAL, a REAL, lambda REAL,
        raw_sum REAL,
        canonical_deviation REAL,
        h_alg INTEGER, h_bal INTEGER, h_arch INTEGER,
        confidence REAL DEFAULT 1.0,
        PRIMARY KEY(snapshot_id, entity_id)
    );

    CREATE TABLE IF NOT EXISTS rule_hits (
        snapshot_id TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        rule_id TEXT NOT NULL,
        hit_count INTEGER NOT NULL,
        locations TEXT,
        PRIMARY KEY(snapshot_id, entity_id, rule_id)
    );

    CREATE TABLE IF NOT EXISTS edges (
        snapshot_id TEXT NOT NULL,
        src_entity_id TEXT NOT NULL,
        dst_entity_id TEXT NOT NULL,
        edge_type TEXT NOT NULL,
        w_total REAL NOT NULL,
        w_components TEXT,
        PRIMARY KEY(snapshot_id, src_entity_id, dst_entity_id, edge_type)
    );

    CREATE INDEX IF NOT EXISTS idx_metrics_deviation
        ON metrics(snapshot_id, canonical_deviation DESC);

    CREATE INDEX IF NOT EXISTS idx_metrics_raw_sum
        ON metrics(snapshot_id, raw_sum DESC);

    CREATE INDEX IF NOT EXISTS idx_edges_boundary
        ON edges(snapshot_id, edge_type);
    """

    ANALYZER_VERSION = "0.0.13"

    def __init__(self, db_path: Path | str = ":memory:"):
        """저장소 초기화

        Args:
            db_path: DB 파일 경로 (기본: 메모리)
        """
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self) -> None:
        """스키마 초기화"""
        self.conn.executescript(self.SCHEMA)
        self.conn.commit()

    def close(self) -> None:
        """연결 종료"""
        self.conn.close()

    # ============================================================
    # Snapshot
    # ============================================================

    def insert_snapshot(self, snapshot: Snapshot) -> str:
        """스냅샷 저장

        Args:
            snapshot: Snapshot

        Returns:
            snapshot_id
        """
        self.conn.execute("""
            INSERT OR REPLACE INTO snapshots
            (snapshot_id, repo, commit_hash, release_id, ts, analyzer_version)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            snapshot.snapshot_id,
            snapshot.repo,
            snapshot.commit,
            snapshot.release_id,
            snapshot.timestamp.isoformat(),
            self.ANALYZER_VERSION,
        ))
        self.conn.commit()
        return snapshot.snapshot_id

    def get_snapshot(self, snapshot_id: str) -> Snapshot | None:
        """스냅샷 조회

        Args:
            snapshot_id: 스냅샷 ID

        Returns:
            Snapshot 또는 None
        """
        from datetime import datetime

        cursor = self.conn.execute("""
            SELECT * FROM snapshots WHERE snapshot_id = ?
        """, (snapshot_id,))
        row = cursor.fetchone()

        if not row:
            return None

        return Snapshot(
            snapshot_id=row["snapshot_id"],
            commit=row["commit_hash"],
            timestamp=datetime.fromisoformat(row["ts"]),
            repo=row["repo"],
        )

    # ============================================================
    # Entity
    # ============================================================

    def insert_entity(self, entity: Entity, repo: str) -> str:
        """엔티티 저장

        Args:
            entity: Entity
            repo: repository 이름

        Returns:
            entity_id
        """
        fingerprint = f"{entity.path}:{entity.symbol}:{entity.language}"

        self.conn.execute("""
            INSERT OR REPLACE INTO entities
            (entity_id, repo, entity_type, language, path, symbol, fingerprint)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            entity.entity_id,
            repo,
            entity.type.value,
            entity.language,
            entity.path,
            entity.symbol,
            fingerprint,
        ))
        self.conn.commit()
        return entity.entity_id

    def get_entity(self, entity_id: str) -> Entity | None:
        """엔티티 조회

        Args:
            entity_id: 엔티티 ID

        Returns:
            Entity 또는 None
        """
        cursor = self.conn.execute("""
            SELECT * FROM entities WHERE entity_id = ?
        """, (entity_id,))
        row = cursor.fetchone()

        if not row:
            return None

        return Entity(
            entity_id=row["entity_id"],
            type=EntityType(row["entity_type"]),
            path=row["path"],
            symbol=row["symbol"],
            language=row["language"],
        )

    # ============================================================
    # Metrics
    # ============================================================

    def insert_metrics(self, metrics: Metrics) -> None:
        """메트릭 저장

        Args:
            metrics: Metrics
        """
        h_scores = {
            "alg": int(metrics.x.C + metrics.x.N),
            "bal": int(metrics.x.A),
            "arch": int(metrics.x.S + metrics.x.L),
        }

        self.conn.execute("""
            INSERT OR REPLACE INTO metrics
            (snapshot_id, entity_id, module_type,
             c, n, s, a, lambda, raw_sum, canonical_deviation,
             h_alg, h_bal, h_arch, confidence)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            metrics.snapshot_id,
            metrics.entity_id,
            metrics.module_type,
            metrics.x.C,
            metrics.x.N,
            metrics.x.S,
            metrics.x.A,
            metrics.x.L,
            metrics.raw_sum,
            metrics.d,
            h_scores["alg"],
            h_scores["bal"],
            h_scores["arch"],
            metrics.confidence,
        ))
        self.conn.commit()

    def get_metrics(self, snapshot_id: str, entity_id: str) -> Metrics | None:
        """메트릭 조회

        Args:
            snapshot_id: 스냅샷 ID
            entity_id: 엔티티 ID

        Returns:
            Metrics 또는 None
        """
        cursor = self.conn.execute("""
            SELECT * FROM metrics
            WHERE snapshot_id = ? AND entity_id = ?
        """, (snapshot_id, entity_id))
        row = cursor.fetchone()

        if not row:
            return None

        return self._row_to_metrics(row)

    def _row_to_metrics(self, row: sqlite3.Row) -> Metrics:
        """Row를 Metrics로 변환"""
        x = ComplexityVector(
            C=row["c"],
            N=row["n"],
            S=row["s"],
            A=row["a"],
            L=row["lambda"],
        )

        # Hodge bucket 판정
        h_scores = {
            "alg": row["h_alg"],
            "bal": row["h_bal"],
            "arch": row["h_arch"],
        }
        max_key = max(h_scores, key=h_scores.get)
        hodge_map = {
            "alg": HodgeBucket.ALGORITHMIC,
            "bal": HodgeBucket.BALANCED,
            "arch": HodgeBucket.ARCHITECTURAL,
        }
        hodge = hodge_map[max_key]

        return Metrics(
            entity_id=row["entity_id"],
            snapshot_id=row["snapshot_id"],
            x=x,
            raw_sum=row["raw_sum"],
            d=row["canonical_deviation"],
            hodge=hodge,
            module_type=row["module_type"],
            confidence=row["confidence"] or 1.0,
        )

    # ============================================================
    # 쿼리
    # ============================================================

    def get_hotspots(self, snapshot_id: str, limit: int = 20) -> list[dict]:
        """Hotspot 조회 (View A)

        Args:
            snapshot_id: 스냅샷 ID
            limit: 반환 개수

        Returns:
            Hotspot 목록
        """
        cursor = self.conn.execute("""
            SELECT e.entity_type, e.path, e.symbol,
                   m.canonical_deviation, m.raw_sum
            FROM metrics m
            JOIN entities e ON e.entity_id = m.entity_id
            WHERE m.snapshot_id = ?
            ORDER BY m.canonical_deviation DESC
            LIMIT ?
        """, (snapshot_id, limit))
        return [dict(row) for row in cursor.fetchall()]

    def get_delta_deviations(
        self,
        sid_cur: str,
        sid_prev: str,
        limit: int = 50,
    ) -> list[dict]:
        """Δd 조회 (위험 급증 엔티티)

        Args:
            sid_cur: 현재 스냅샷 ID
            sid_prev: 이전 스냅샷 ID
            limit: 반환 개수

        Returns:
            Δd 목록
        """
        cursor = self.conn.execute("""
            WITH cur AS (
                SELECT entity_id, canonical_deviation AS d
                FROM metrics WHERE snapshot_id = ?
            ),
            prev AS (
                SELECT entity_id, canonical_deviation AS d
                FROM metrics WHERE snapshot_id = ?
            )
            SELECT e.path, e.symbol, (cur.d - prev.d) AS delta_d
            FROM cur JOIN prev USING(entity_id)
            JOIN entities e ON e.entity_id = cur.entity_id
            ORDER BY delta_d DESC
            LIMIT ?
        """, (sid_cur, sid_prev, limit))
        return [dict(row) for row in cursor.fetchall()]

    def get_boundary_flux(self, snapshot_id: str) -> float:
        """경계 Flux 조회 (View B)

        Args:
            snapshot_id: 스냅샷 ID

        Returns:
            Boundary flux 값
        """
        cursor = self.conn.execute("""
            SELECT SUM(w_total) AS flux
            FROM edges
            WHERE snapshot_id = ?
              AND (edge_type = 'boundary'
                   OR json_extract(w_components, '$.boundary') > 0)
        """, (snapshot_id,))
        row = cursor.fetchone()
        return row["flux"] or 0.0

    def get_phi(self, snapshot_id: str) -> float:
        """Φ 조회 (정준 편차 합)

        Args:
            snapshot_id: 스냅샷 ID

        Returns:
            Φ 값
        """
        cursor = self.conn.execute("""
            SELECT SUM(canonical_deviation) AS phi
            FROM metrics
            WHERE snapshot_id = ?
        """, (snapshot_id,))
        row = cursor.fetchone()
        return row["phi"] or 0.0

    # ============================================================
    # Edge
    # ============================================================

    def insert_edge(self, edge: Edge) -> None:
        """간선 저장

        Args:
            edge: Edge
        """
        self.conn.execute("""
            INSERT OR REPLACE INTO edges
            (snapshot_id, src_entity_id, dst_entity_id, edge_type, w_total, w_components)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            edge.snapshot_id,
            edge.src_entity,
            edge.dst_entity,
            edge.edge_type.value,
            edge.weight_total,
            json.dumps(edge.weight_components.to_dict()),
        ))
        self.conn.commit()

    def get_edges(self, snapshot_id: str) -> list[Edge]:
        """스냅샷의 모든 간선 조회

        Args:
            snapshot_id: 스냅샷 ID

        Returns:
            Edge 목록
        """
        cursor = self.conn.execute("""
            SELECT * FROM edges WHERE snapshot_id = ?
        """, (snapshot_id,))

        edges = []
        for row in cursor.fetchall():
            components = json.loads(row["w_components"]) if row["w_components"] else {}
            edge = Edge(
                src_entity=row["src_entity_id"],
                dst_entity=row["dst_entity_id"],
                snapshot_id=row["snapshot_id"],
                edge_type=EdgeType(row["edge_type"]),
                weight_components=WeightComponents(**components),
            )
            edges.append(edge)

        return edges


# ============================================================
# 공개 API
# ============================================================

__all__ = [
    "SQLiteStore",
]
