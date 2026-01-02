"""
View A: Hotspot Trajectory

인지 붕괴 후보 탐지:
- d_u 연속 증가 (w 연속)
- rawSumRatio > threshold

Cheese (인지 복잡도) 관련 핵심 지표.
"""

__module_type__ = "lib/domain"

from dataclasses import dataclass
from typing import Literal


# ============================================================
# 상수
# ============================================================

HOTSPOT_WINDOW = 5           # w: 연속 증가 윈도우
RAW_SUM_THRESHOLD = 20.0     # rawSum 임계값


# ============================================================
# 타입 정의
# ============================================================

@dataclass
class HotspotCandidate:
    """인지 붕괴 후보

    entity_id: 엔티티 ID
    consecutive_increases: 연속 증가 횟수
    current_d: 현재 정준 편차
    trend: d 값 변화 추이
    severity: 심각도
    """
    entity_id: str
    consecutive_increases: int
    current_d: float
    trend: list[float]
    severity: Literal["low", "medium", "high", "critical"]


# ============================================================
# 탐지
# ============================================================

def detect_hotspots(
    entity_id: str,
    d_history: list[float],
    raw_sum: float,
) -> HotspotCandidate | None:
    """View A: Hotspot Trajectory

    탐지 조건:
    - ∀i ∈ [k-w, k]: d_u(i) > d_u(i-1) (w 연속 증가)
    - rawSumRatio(k) > threshold

    Args:
        entity_id: 엔티티 ID
        d_history: 스냅샷별 d 값 히스토리 (최신이 마지막)
        raw_sum: 현재 rawSum

    Returns:
        HotspotCandidate 또는 None (hotspot 아니면)
    """
    if len(d_history) < 2:
        return None

    # 연속 증가 횟수 계산
    consecutive = _count_consecutive_increases(d_history)

    is_hotspot = consecutive >= HOTSPOT_WINDOW or raw_sum > RAW_SUM_THRESHOLD

    if not is_hotspot:
        return None

    # 심각도 판정
    severity = _calculate_severity(consecutive, raw_sum)

    return HotspotCandidate(
        entity_id=entity_id,
        consecutive_increases=consecutive,
        current_d=d_history[-1] if d_history else 0.0,
        trend=d_history[-HOTSPOT_WINDOW:] if len(d_history) >= HOTSPOT_WINDOW else d_history.copy(),
        severity=severity,
    )


def _count_consecutive_increases(d_history: list[float]) -> int:
    """연속 증가 횟수 계산

    뒤에서부터 앞으로 탐색하여 연속 증가 횟수 반환.
    """
    consecutive = 0
    for i in range(len(d_history) - 1, 0, -1):
        if d_history[i] > d_history[i - 1]:
            consecutive += 1
        else:
            break
    return consecutive


def _calculate_severity(
    consecutive: int,
    raw_sum: float,
) -> Literal["low", "medium", "high", "critical"]:
    """심각도 계산

    critical: 연속 증가 >= w AND rawSum > threshold
    high: 연속 증가 >= w
    medium: rawSum > threshold
    low: 기타
    """
    if consecutive >= HOTSPOT_WINDOW and raw_sum > RAW_SUM_THRESHOLD:
        return "critical"
    elif consecutive >= HOTSPOT_WINDOW:
        return "high"
    elif raw_sum > RAW_SUM_THRESHOLD:
        return "medium"
    else:
        return "low"


@dataclass
class EntityHistory:
    """엔티티별 히스토리"""
    entity_id: str
    d_history: list[float]
    raw_sum: float


def detect_hotspots_batch(
    histories: list[EntityHistory],
) -> list[HotspotCandidate]:
    """배치 hotspot 탐지

    Args:
        histories: 엔티티별 히스토리 목록

    Returns:
        탐지된 HotspotCandidate 목록 (심각도순 정렬)
    """
    candidates: list[HotspotCandidate] = []

    for h in histories:
        candidate = detect_hotspots(
            entity_id=h.entity_id,
            d_history=h.d_history,
            raw_sum=h.raw_sum,
        )
        if candidate:
            candidates.append(candidate)

    # 심각도순 정렬
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    candidates.sort(key=lambda c: (severity_order[c.severity], -c.current_d))

    return candidates


def format_hotspots_for_llm(candidates: list[HotspotCandidate]) -> str:
    """LLM 제공용 포맷

    Args:
        candidates: HotspotCandidate 목록

    Returns:
        포맷된 문자열
    """
    if not candidates:
        return "No hotspots detected."

    lines = ["Hotspot Trajectory (인지 붕괴 후보):"]
    for i, c in enumerate(candidates, 1):
        severity_emoji = {
            "critical": "🔴",
            "high": "🟠",
            "medium": "🟡",
            "low": "🟢",
        }[c.severity]

        lines.append(f"{i}. {severity_emoji} {c.entity_id}")
        lines.append(f"   severity={c.severity}, d={c.current_d:.3f}")
        lines.append(f"   consecutive_increases={c.consecutive_increases}")
        lines.append(f"   trend={[f'{d:.2f}' for d in c.trend]}")

    return "\n".join(lines)


# ============================================================
# 공개 API
# ============================================================

__all__ = [
    "HotspotCandidate",
    "HOTSPOT_WINDOW",
    "RAW_SUM_THRESHOLD",
    "detect_hotspots",
    "EntityHistory",
    "detect_hotspots_batch",
    "format_hotspots_for_llm",
]
