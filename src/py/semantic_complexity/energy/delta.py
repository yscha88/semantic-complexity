"""
에너지 변화량 ΔΦ 계산

ΔΦ = Φ(after) - Φ(before)

리팩토링 효과 측정:
- ΔΦ < 0: 에너지 감소 (좋음) - 리팩토링 효과 있음
- ΔΦ > 0: 에너지 증가 (나쁨) - 코드 악화
- ΔΦ ≈ 0: 변화 없음 - 본질적 복잡도 도달?
"""

__module_type__ = "lib/domain"

from dataclasses import dataclass

from .potential import PotentialResult


@dataclass
class DeltaPhiResult:
    """ΔΦ 계산 결과

    delta_phi: 에너지 변화량
    phi_before: 이전 에너지
    phi_after: 이후 에너지
    improved: 개선 여부 (ΔΦ < 0)
    """
    delta_phi: float
    phi_before: float
    phi_after: float
    improved: bool

    @property
    def change_percent(self) -> float:
        """변화율 (%)"""
        if self.phi_before == 0:
            return 0.0
        return (self.delta_phi / self.phi_before) * 100


def calculate_delta_phi(
    phi_before: PotentialResult,
    phi_after: PotentialResult,
) -> DeltaPhiResult:
    """에너지 변화량 계산

    ΔΦ = Φ(after) - Φ(before)

    Args:
        phi_before: 이전 스냅샷의 Φ
        phi_after: 이후 스냅샷의 Φ

    Returns:
        DeltaPhiResult

    해석:
    - ΔΦ < 0: 에너지 감소 (좋음)
    - ΔΦ > 0: 에너지 증가 (나쁨)
    """
    delta = phi_after.phi - phi_before.phi

    return DeltaPhiResult(
        delta_phi=delta,
        phi_before=phi_before.phi,
        phi_after=phi_after.phi,
        improved=delta < 0,
    )


def calculate_delta_phi_simple(
    phi_before: float,
    phi_after: float,
) -> DeltaPhiResult:
    """간소화된 ΔΦ 계산

    Args:
        phi_before: 이전 에너지 값
        phi_after: 이후 에너지 값

    Returns:
        DeltaPhiResult
    """
    delta = phi_after - phi_before

    return DeltaPhiResult(
        delta_phi=delta,
        phi_before=phi_before,
        phi_after=phi_after,
        improved=delta < 0,
    )


def calculate_delta_components(
    before: PotentialResult,
    after: PotentialResult,
) -> dict[str, float]:
    """구성요소별 변화량 계산

    Args:
        before: 이전 결과
        after: 이후 결과

    Returns:
        구성요소별 Δ
    """
    return {
        "deviation": after.components["deviation"] - before.components["deviation"],
        "edge": after.components["edge"] - before.components["edge"],
        "ops": after.components["ops"] - before.components["ops"],
    }


# ============================================================
# 공개 API
# ============================================================

__all__ = [
    "DeltaPhiResult",
    "calculate_delta_phi",
    "calculate_delta_phi_simple",
    "calculate_delta_components",
]
