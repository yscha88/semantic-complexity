"""
Metrics (엔티티별 메트릭)

엔티티 × 스냅샷 단위의 측정값.
5D 벡터 + 파생 점수 + Hodge bucket.
"""

__module_type__ = "lib/domain"

from dataclasses import dataclass, field

from ..measurement.vector import ComplexityVector
from ..measurement.hodge import HodgeBucket


@dataclass
class Metrics:
    """엔티티별 메트릭

    entity_id: 엔티티 ID
    snapshot_id: 스냅샷 ID
    x: 5D 복잡도 벡터
    raw_sum: 벡터 요소 합
    d: 정준 편차
    hodge: Hodge bucket
    module_type: 모듈 타입
    confidence: 신뢰도
    """
    entity_id: str
    snapshot_id: str
    x: ComplexityVector
    raw_sum: float = 0.0
    d: float = 0.0
    hodge: HodgeBucket = HodgeBucket.ALGORITHMIC
    module_type: str = "app"
    confidence: float = 1.0

    def __post_init__(self) -> None:
        """초기화 후 처리"""
        if self.raw_sum == 0.0:
            self.raw_sum = self.x.raw_sum

    def to_dict(self) -> dict:
        """dict 변환"""
        return {
            "entity_id": self.entity_id,
            "snapshot_id": self.snapshot_id,
            "x": self.x.to_dict(),
            "raw_sum": self.raw_sum,
            "d": self.d,
            "hodge": self.hodge.value,
            "module_type": self.module_type,
            "confidence": self.confidence,
        }


def create_metrics(
    entity_id: str,
    snapshot_id: str,
    x: ComplexityVector,
    d: float,
    hodge: HodgeBucket,
    module_type: str = "app",
    confidence: float = 1.0,
) -> Metrics:
    """Metrics 생성

    Args:
        entity_id: 엔티티 ID
        snapshot_id: 스냅샷 ID
        x: 5D 벡터
        d: 정준 편차
        hodge: Hodge bucket
        module_type: 모듈 타입
        confidence: 신뢰도

    Returns:
        Metrics
    """
    return Metrics(
        entity_id=entity_id,
        snapshot_id=snapshot_id,
        x=x,
        raw_sum=x.raw_sum,
        d=d,
        hodge=hodge,
        module_type=module_type,
        confidence=confidence,
    )


# ============================================================
# 공개 API
# ============================================================

__all__ = [
    "Metrics",
    "create_metrics",
]
