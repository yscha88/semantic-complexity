"""
정준 편차 계산

d_u = ‖x_u / μ_t(u) - 1‖₂

모듈 타입별 정준 프로파일 μ_t에서의 편차를 계산.
"""

__architecture_role__ = "lib/domain"

from .vector import ComplexityVector


# ============================================================
# 모듈 타입별 5D 정준 프로파일
# ============================================================

CANONICAL_5D_PROFILES: dict[str, ComplexityVector] = {
    # api/external: 보안(Bread) 중시 - 낮은 복잡도
    "api/external": ComplexityVector(C=3, N=2, S=1, A=1, L=2),

    # lib/domain: 인지성(Cheese) 중시 - 중간 복잡도
    "lib/domain": ComplexityVector(C=5, N=3, S=2, A=0, L=3),

    # app: 균형 - 높은 복잡도 허용
    "app": ComplexityVector(C=8, N=4, S=3, A=2, L=5),

    # infra: 비동기(A) 높음
    "infra": ComplexityVector(C=4, N=2, S=2, A=3, L=4),

    # deploy: 최소 복잡도
    "deploy": ComplexityVector(C=2, N=1, S=1, A=1, L=2),
}


def get_canonical_5d_profile(architecture_role: str) -> ComplexityVector:
    """모듈 타입의 5D 정준 프로파일 반환

    Args:
        architecture_role: 모듈 타입 (api/external, lib/domain, app, ...)

    Returns:
        해당 모듈 타입의 정준 프로파일
        알 수 없는 타입은 "app" 프로파일 반환
    """
    return CANONICAL_5D_PROFILES.get(architecture_role, CANONICAL_5D_PROFILES["app"])


def calculate_deviation(x: ComplexityVector, architecture_role: str) -> float:
    """정준 편차 계산

    d_u = ‖x_u / μ_t(u) - 1‖₂

    Args:
        x: 측정된 5D 벡터
        architecture_role: 모듈 타입

    Returns:
        L2 노름 기반 정준 편차

    수학적 의미:
    - d_u = 0: 정확히 정준 상태
    - d_u > 0: 정준에서 이탈
    - d_u가 클수록 더 많이 이탈
    """
    import numpy as np

    mu = get_canonical_5d_profile(architecture_role)

    x_arr = x.to_array()
    mu_arr = mu.to_array()

    # 정규화된 편차: x/μ - 1
    # 정준과 같으면 0, 정준보다 크면 양수, 작으면 음수
    # 둘 다 0인 경우는 편차 0으로 처리
    normalized = np.zeros_like(x_arr)
    for i in range(len(x_arr)):
        if mu_arr[i] == 0:
            # μ=0일 때: x도 0이면 편차 0, x≠0이면 큰 편차
            normalized[i] = 0.0 if x_arr[i] == 0 else x_arr[i]
        else:
            normalized[i] = x_arr[i] / mu_arr[i] - 1

    # L2 norm
    return float(np.linalg.norm(normalized))


def calculate_delta_deviation(d_before: float, d_after: float) -> float:
    """편차 변화량 계산

    Δd = d(k) - d(k-1)

    Args:
        d_before: 이전 스냅샷의 편차
        d_after: 현재 스냅샷의 편차

    Returns:
        Δd (편차 변화량)

    해석:
    - Δd < 0: 정준 수렴 (좋음) - 코드가 정준 상태에 가까워짐
    - Δd > 0: 정준 이탈 (나쁨) - 코드가 정준 상태에서 멀어짐
    - Δd = 0: 변화 없음
    """
    return d_after - d_before


def is_converging(delta_d: float, threshold: float = 0.01) -> bool:
    """정준으로 수렴 중인지 판정

    Args:
        delta_d: 편차 변화량
        threshold: 수렴 임계값

    Returns:
        수렴 중 여부
    """
    return delta_d < -threshold


def is_diverging(delta_d: float, threshold: float = 0.01) -> bool:
    """정준에서 발산 중인지 판정

    Args:
        delta_d: 편차 변화량
        threshold: 발산 임계값

    Returns:
        발산 중 여부
    """
    return delta_d > threshold


# ============================================================
# 공개 API
# ============================================================

__all__ = [
    "CANONICAL_5D_PROFILES",
    "get_canonical_5d_profile",
    "calculate_deviation",
    "calculate_delta_deviation",
    "is_converging",
    "is_diverging",
]
