"""
Snapshot (커밋 단위 스냅샷)

시간 축 단위.
commit + timestamp + repo 정보.
"""

__module_type__ = "lib/domain"

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Literal


@dataclass
class Snapshot:
    """커밋 단위 스냅샷

    snapshot_id: auto-generated UUID
    commit: git commit hash
    timestamp: 스냅샷 생성 시간
    repo: repository 이름
    service: 서비스 이름 (monorepo용)
    env: 환경 (dev | prod)
    """
    snapshot_id: str
    commit: str
    timestamp: datetime
    repo: str
    service: str | None = None
    env: Literal["dev", "prod"] = "dev"

    @property
    def release_id(self) -> str:
        """릴리스 ID (commit 앞 8자)"""
        return self.commit[:8]

    def to_dict(self) -> dict:
        """dict 변환"""
        return {
            "snapshot_id": self.snapshot_id,
            "commit": self.commit,
            "release_id": self.release_id,
            "timestamp": self.timestamp.isoformat(),
            "repo": self.repo,
            "service": self.service,
            "env": self.env,
        }


def create_snapshot(
    commit: str,
    repo: str,
    service: str | None = None,
    env: Literal["dev", "prod"] = "dev",
    timestamp: datetime | None = None,
) -> Snapshot:
    """Snapshot 생성

    Args:
        commit: git commit hash
        repo: repository 이름
        service: 서비스 이름 (monorepo용)
        env: 환경
        timestamp: 생성 시간 (기본: 현재)

    Returns:
        Snapshot
    """
    return Snapshot(
        snapshot_id=str(uuid.uuid4()),
        commit=commit,
        timestamp=timestamp or datetime.now(),
        repo=repo,
        service=service,
        env=env,
    )


# ============================================================
# 공개 API
# ============================================================

__all__ = [
    "Snapshot",
    "create_snapshot",
]
