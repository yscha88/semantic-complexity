"""
View C: Refactor ROI Ranking

리팩토링 ROI 계산 및 순위:
ROI(Δ) = -ΔΦ / Cost(Δ)

Cost(Δ) = η₁·#filesChanged + η₂·#publicAPIChanged + ...

비용 대비 에너지 감소 효과가 큰 리팩토링 우선.
"""

__architecture_role__ = "lib/domain"

from dataclasses import dataclass


# ============================================================
# 상수
# ============================================================

COST_WEIGHTS = {
    "files": 1.0,            # η₁: 파일 변경
    "api": 3.0,              # η₂: 공개 API 변경
    "schema": 5.0,           # η₃: 스키마 변경
    "policy": 4.0,           # η₄: 정책 터치
    "test": 2.0,             # η₅: 테스트 변경
}


# ============================================================
# 타입 정의
# ============================================================

@dataclass
class CostFactors:
    """비용 요소

    files_changed: 변경 파일 수
    public_api_changed: 공개 API 변경 수
    schema_changed: 스키마 변경 수
    policy_touched: 정책 터치 수
    test_delta: 테스트 변경 수
    """
    files_changed: int = 0
    public_api_changed: int = 0
    schema_changed: int = 0
    policy_touched: int = 0
    test_delta: int = 0


@dataclass
class RefactorCandidate:
    """리팩토링 후보

    delta_id: 리팩토링 식별자
    description: 설명
    delta_phi: 예상 ΔΦ (음수 = 개선)
    cost: 비용
    roi: ROI = -ΔΦ / Cost
    affected_entities: 영향받는 엔티티
    """
    delta_id: str
    description: str
    delta_phi: float
    cost: float
    roi: float
    affected_entities: list[str]


# ============================================================
# 계산
# ============================================================

def calculate_cost(factors: CostFactors) -> float:
    """비용 계산

    Cost(Δ) = η₁·#filesChanged + η₂·#publicAPIChanged + ...

    Args:
        factors: 비용 요소

    Returns:
        총 비용
    """
    return (
        COST_WEIGHTS["files"] * factors.files_changed +
        COST_WEIGHTS["api"] * factors.public_api_changed +
        COST_WEIGHTS["schema"] * factors.schema_changed +
        COST_WEIGHTS["policy"] * factors.policy_touched +
        COST_WEIGHTS["test"] * factors.test_delta
    )


def calculate_roi(delta_phi: float, cost: float) -> float:
    """ROI 계산

    ROI(Δ) = -ΔΦ / Cost(Δ)

    Args:
        delta_phi: 에너지 변화량 (음수 = 개선)
        cost: 비용

    Returns:
        ROI (높을수록 좋음)

    해석:
    - ΔΦ < 0 (개선) → -ΔΦ > 0 → ROI > 0
    - 비용이 낮고 개선이 크면 ROI 높음
    """
    if cost <= 0:
        return 0.0
    return -delta_phi / cost


def create_refactor_candidate(
    delta_id: str,
    description: str,
    delta_phi: float,
    factors: CostFactors,
    affected_entities: list[str],
) -> RefactorCandidate:
    """리팩토링 후보 생성

    Args:
        delta_id: 리팩토링 ID
        description: 설명
        delta_phi: 예상 ΔΦ
        factors: 비용 요소
        affected_entities: 영향받는 엔티티

    Returns:
        RefactorCandidate
    """
    cost = calculate_cost(factors)
    roi = calculate_roi(delta_phi, cost)

    return RefactorCandidate(
        delta_id=delta_id,
        description=description,
        delta_phi=delta_phi,
        cost=cost,
        roi=roi,
        affected_entities=affected_entities,
    )


# ============================================================
# 순위
# ============================================================

def rank_refactor_candidates(
    candidates: list[RefactorCandidate],
    top_k: int = 10,
) -> list[RefactorCandidate]:
    """View C: ROI 기준 정렬

    후보 정렬: ROI(Δ₁) > ROI(Δ₂) > ... > ROI(Δₙ)

    Args:
        candidates: 리팩토링 후보 목록
        top_k: 상위 k개 반환

    Returns:
        ROI 순 정렬된 후보 목록
    """
    return sorted(candidates, key=lambda c: c.roi, reverse=True)[:top_k]


def format_for_llm(candidates: list[RefactorCandidate]) -> str:
    """LLM 제공용 포맷

    Args:
        candidates: RefactorCandidate 목록

    Returns:
        포맷된 문자열
    """
    if not candidates:
        return "No refactor candidates."

    lines = ["Top-K ROI 후보:"]
    for i, c in enumerate(candidates, 1):
        lines.append(f"{i}. {c.description}")
        lines.append(f"   ROI={c.roi:.2f}, Cost={c.cost:.1f}, -ΔΦ={-c.delta_phi:.2f}")
        if c.affected_entities:
            lines.append(f"   affected: {', '.join(c.affected_entities[:3])}")
            if len(c.affected_entities) > 3:
                lines.append(f"   ... and {len(c.affected_entities) - 3} more")

    return "\n".join(lines)


def format_roi_table(candidates: list[RefactorCandidate]) -> str:
    """ROI 테이블 포맷

    Args:
        candidates: RefactorCandidate 목록

    Returns:
        테이블 형식 문자열
    """
    if not candidates:
        return "No candidates."

    lines = [
        "| Rank | Description | ROI | Cost | -ΔΦ |",
        "|------|-------------|-----|------|-----|",
    ]
    for i, c in enumerate(candidates, 1):
        desc = c.description[:30] + "..." if len(c.description) > 30 else c.description
        lines.append(f"| {i} | {desc} | {c.roi:.2f} | {c.cost:.1f} | {-c.delta_phi:.2f} |")

    return "\n".join(lines)


# ============================================================
# 공개 API
# ============================================================

__all__ = [
    "RefactorCandidate",
    "CostFactors",
    "COST_WEIGHTS",
    "calculate_cost",
    "calculate_roi",
    "create_refactor_candidate",
    "rank_refactor_candidates",
    "format_for_llm",
    "format_roi_table",
]
