"""
Hodge Bucket 분류

5D 벡터를 3개의 Hodge bucket으로 분류:
- algorithmic  = C + N     (🧀 Cheese - 인지 복잡도)
- balanced     = A         (균형)
- architectural = S + Λ    (🍞 Bread + 🥓 Ham - 구조적 복잡도)
"""

__architecture_role__ = "lib/domain"

from enum import Enum

from .vector import ComplexityVector


class HodgeBucket(Enum):
    """Hodge bucket 분류

    복잡도의 성격에 따른 분류:
    - ALGORITHMIC: 알고리즘 복잡도 (제어흐름 + 중첩)
    - BALANCED: 균형 상태 (비동기)
    - ARCHITECTURAL: 구조적 복잡도 (상태 + 결합)
    """
    ALGORITHMIC = "algorithmic"       # C + N → 🧀 Cheese
    BALANCED = "balanced"             # A
    ARCHITECTURAL = "architectural"   # S + Λ → 🍞 Bread + 🥓 Ham


def classify_hodge(x: ComplexityVector) -> HodgeBucket:
    """Hodge bucket 분류

    Args:
        x: 5D 복잡도 벡터

    Returns:
        지배적인 Hodge bucket

    분류 기준:
    - algorithmic  = C + N (제어흐름 + 중첩)
    - balanced     = A (비동기)
    - architectural = S + Λ (상태 + 결합)

    세 값 중 가장 큰 것이 지배 bucket.
    """
    scores = get_hodge_scores(x)

    algorithmic = scores["algorithmic"]
    balanced = scores["balanced"]
    architectural = scores["architectural"]

    max_val = max(algorithmic, balanced, architectural)

    if max_val == algorithmic:
        return HodgeBucket.ALGORITHMIC
    elif max_val == balanced:
        return HodgeBucket.BALANCED
    else:
        return HodgeBucket.ARCHITECTURAL


def get_hodge_scores(x: ComplexityVector) -> dict[str, float]:
    """Hodge bucket별 점수

    Args:
        x: 5D 복잡도 벡터

    Returns:
        {algorithmic, balanced, architectural} 점수
    """
    return {
        "algorithmic": x.C + x.N,
        "balanced": x.A,
        "architectural": x.S + x.L,
    }


def get_hodge_ratio(x: ComplexityVector) -> dict[str, float]:
    """Hodge bucket별 비율

    Args:
        x: 5D 복잡도 벡터

    Returns:
        {algorithmic, balanced, architectural} 비율 (합 = 1)
    """
    scores = get_hodge_scores(x)
    total = sum(scores.values())

    if total == 0:
        return {"algorithmic": 0.33, "balanced": 0.33, "architectural": 0.34}

    return {k: v / total for k, v in scores.items()}


def map_hodge_to_sandwich(bucket: HodgeBucket) -> str:
    """Hodge bucket을 Sandwich 축으로 매핑

    Args:
        bucket: Hodge bucket

    Returns:
        대응되는 Sandwich 축

    매핑:
    - ALGORITHMIC → cheese (인지 복잡도)
    - BALANCED → ham (균형/테스트)
    - ARCHITECTURAL → bread (구조/보안)
    """
    mapping = {
        HodgeBucket.ALGORITHMIC: "cheese",
        HodgeBucket.BALANCED: "ham",
        HodgeBucket.ARCHITECTURAL: "bread",
    }
    return mapping[bucket]


# ============================================================
# 공개 API
# ============================================================

__all__ = [
    "HodgeBucket",
    "classify_hodge",
    "get_hodge_scores",
    "get_hodge_ratio",
    "map_hodge_to_sandwich",
]
