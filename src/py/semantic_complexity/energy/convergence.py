"""
ε-수렴 판정

|ΔΦ| < ε → 수렴

수렴 조건:
- 연속 MIN_CONVERGENCE_ITERATIONS번 |ΔΦ| < ε 만족
- 수렴 = 더 이상 리팩토링으로 개선 불가 (본질적 복잡도)

ADR 발급 조건:
- Converged ∧ Flux stable ∧ Evidence complete ∧ Gate failed
"""

__architecture_role__ = "lib/domain"

from dataclasses import dataclass


# ============================================================
# 상수
# ============================================================

DEFAULT_EPSILON = 0.01
MIN_CONVERGENCE_ITERATIONS = 3


# ============================================================
# 타입 정의
# ============================================================

@dataclass
class ConvergenceResult:
    """수렴 판정 결과

    converged: 수렴 여부
    delta_phi: 에너지 변화량
    epsilon: 수렴 임계값
    iterations: 연속 수렴 횟수
    message: 상태 메시지
    """
    converged: bool
    delta_phi: float
    epsilon: float
    iterations: int
    message: str


# ============================================================
# 수렴 판정
# ============================================================

def check_convergence(
    delta_phi: float,
    epsilon: float = DEFAULT_EPSILON,
    previous_iterations: int = 0,
) -> ConvergenceResult:
    """ε-수렴 판정

    |ΔΦ| < ε → 수렴 중

    Args:
        delta_phi: 에너지 변화량
        epsilon: 수렴 임계값
        previous_iterations: 이전까지의 연속 수렴 횟수

    Returns:
        ConvergenceResult

    수렴 로직:
    1. |ΔΦ| < ε이면 iterations += 1
    2. |ΔΦ| >= ε이면 iterations = 0 (리셋)
    3. iterations >= MIN_CONVERGENCE_ITERATIONS이면 converged = True
    """
    is_converging = abs(delta_phi) < epsilon

    iterations = previous_iterations + 1 if is_converging else 0
    converged = iterations >= MIN_CONVERGENCE_ITERATIONS

    if converged:
        message = (
            f"Converged: |ΔΦ|={abs(delta_phi):.4f} < ε={epsilon} "
            f"for {iterations} iterations"
        )
    elif is_converging:
        message = (
            f"Converging: |ΔΦ|={abs(delta_phi):.4f} < ε={epsilon} "
            f"({iterations}/{MIN_CONVERGENCE_ITERATIONS})"
        )
    else:
        message = f"Not converged: |ΔΦ|={abs(delta_phi):.4f} >= ε={epsilon}"

    return ConvergenceResult(
        converged=converged,
        delta_phi=delta_phi,
        epsilon=epsilon,
        iterations=iterations,
        message=message,
    )


def check_convergence_history(
    delta_phi_history: list[float],
    epsilon: float = DEFAULT_EPSILON,
) -> ConvergenceResult:
    """히스토리 기반 수렴 판정

    Args:
        delta_phi_history: ΔΦ 히스토리 (최신이 마지막)
        epsilon: 수렴 임계값

    Returns:
        ConvergenceResult
    """
    if not delta_phi_history:
        return ConvergenceResult(
            converged=False,
            delta_phi=0.0,
            epsilon=epsilon,
            iterations=0,
            message="No history",
        )

    # 최근부터 연속 수렴 횟수 계산
    iterations = 0
    for delta in reversed(delta_phi_history):
        if abs(delta) < epsilon:
            iterations += 1
        else:
            break

    latest_delta = delta_phi_history[-1]
    converged = iterations >= MIN_CONVERGENCE_ITERATIONS

    if converged:
        message = (
            f"Converged: last {iterations} iterations below ε={epsilon}"
        )
    else:
        message = (
            f"Not converged: {iterations}/{MIN_CONVERGENCE_ITERATIONS} "
            f"iterations below ε={epsilon}"
        )

    return ConvergenceResult(
        converged=converged,
        delta_phi=latest_delta,
        epsilon=epsilon,
        iterations=iterations,
        message=message,
    )


# ============================================================
# ADR 발급 조건
# ============================================================

def can_issue_adr(
    convergence: ConvergenceResult,
    flux_stable: bool,
    evidence_complete: bool,
    gate_passed: bool,
) -> tuple[bool, str]:
    """ADR 발급 가능 여부 판정

    조건 (모두 만족):
    1. |ΔΦ| < ε (수렴)
    2. Flux_boundary 안정
    3. Evidence 완비
    4. Gate(G) = false (여전히 실패)

    Args:
        convergence: 수렴 판정 결과
        flux_stable: 경계 흐름 안정 여부
        evidence_complete: 증거 완비 여부
        gate_passed: Gate 통과 여부

    Returns:
        (발급 가능 여부, 사유)

    ADR 발급 의미:
    - 리팩토링으로 개선 불가능한 본질적 복잡도 확인
    - 해당 모듈에 대한 복잡도 기준 예외 승인
    """
    if not convergence.converged:
        return False, f"Not converged: {convergence.message}"

    if not flux_stable:
        return False, "Boundary flux is unstable - security boundaries may be weakening"

    if not evidence_complete:
        return False, "Evidence is incomplete - cannot verify essential complexity"

    if gate_passed:
        return False, "Gate passed - no ADR needed, code meets standards"

    return True, "ADR can be issued: Essential Complexity confirmed"


@dataclass
class ADREligibility:
    """ADR 발급 자격"""
    eligible: bool
    reason: str
    convergence: ConvergenceResult
    flux_stable: bool
    evidence_complete: bool
    gate_passed: bool


def check_adr_eligibility(
    convergence: ConvergenceResult,
    flux_stable: bool,
    evidence_complete: bool,
    gate_passed: bool,
) -> ADREligibility:
    """ADR 발급 자격 검사 (상세 결과)

    Args:
        convergence: 수렴 판정 결과
        flux_stable: 경계 흐름 안정 여부
        evidence_complete: 증거 완비 여부
        gate_passed: Gate 통과 여부

    Returns:
        ADREligibility (모든 조건 상태 포함)
    """
    eligible, reason = can_issue_adr(
        convergence=convergence,
        flux_stable=flux_stable,
        evidence_complete=evidence_complete,
        gate_passed=gate_passed,
    )

    return ADREligibility(
        eligible=eligible,
        reason=reason,
        convergence=convergence,
        flux_stable=flux_stable,
        evidence_complete=evidence_complete,
        gate_passed=gate_passed,
    )


# ============================================================
# 공개 API
# ============================================================

__all__ = [
    "ConvergenceResult",
    "DEFAULT_EPSILON",
    "MIN_CONVERGENCE_ITERATIONS",
    "check_convergence",
    "check_convergence_history",
    "can_issue_adr",
    "ADREligibility",
    "check_adr_eligibility",
]
