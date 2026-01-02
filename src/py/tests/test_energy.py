"""
energy 모듈 테스트

- potential: Φ(k) 계산
- delta: ΔΦ 계산
- convergence: ε-수렴 판정
"""

import pytest

from semantic_complexity.energy import (
    PotentialConfig,
    PotentialResult,
    calculate_phi,
    DeltaPhiResult,
    calculate_delta_phi,
    ConvergenceResult,
    DEFAULT_EPSILON,
    MIN_CONVERGENCE_ITERATIONS,
    check_convergence,
    can_issue_adr,
)
from semantic_complexity.energy.potential import (
    MetricsInput,
    EdgeInput,
    calculate_phi_simple,
)
from semantic_complexity.energy.delta import (
    calculate_delta_phi_simple,
    calculate_delta_components,
)
from semantic_complexity.energy.convergence import (
    check_convergence_history,
    check_adr_eligibility,
    ADREligibility,
)


# ============================================================
# Potential 테스트
# ============================================================

class TestPotential:
    """잠재 함수 Φ 테스트"""

    def test_potential_config_defaults(self):
        """기본 가중치"""
        cfg = PotentialConfig()
        assert cfg.lambda_1 == 1.0
        assert cfg.lambda_2 == 0.5
        assert cfg.lambda_3 == 0.3

    def test_calculate_phi_simple(self):
        """간소화된 Φ 계산"""
        result = calculate_phi_simple(
            deviations=[1.0, 2.0, 3.0],
            edge_weights=[0.5, 0.5],
            ops_penalty=1.0,
        )
        # Φ = 1.0*(1+2+3) + 0.5*(0.5+0.5) + 0.3*1.0
        # = 6.0 + 0.5 + 0.3 = 6.8
        assert result.phi == pytest.approx(6.8, rel=1e-2)
        assert result.deviation_sum == 6.0
        assert result.edge_weight_sum == 1.0

    def test_calculate_phi_no_edges(self):
        """간선 없는 경우"""
        result = calculate_phi_simple(deviations=[1.0, 2.0])
        assert result.phi == 3.0  # 편차만
        assert result.edge_weight_sum == 0.0

    def test_calculate_phi_with_metrics(self):
        """MetricsInput 사용"""
        metrics = [
            MetricsInput(entity_id="ent-1", d=1.0),
            MetricsInput(entity_id="ent-2", d=2.0),
        ]
        edges = [
            EdgeInput(src_entity="ent-1", dst_entity="ent-2",
                      weight_total=1.0, is_boundary=True, coupling=0.3),
        ]
        result = calculate_phi(metrics, edges)
        assert result.deviation_sum == 3.0
        assert result.edge_weight_sum == 1.0  # boundary edge

    def test_phi_components(self):
        """Φ 구성요소"""
        result = calculate_phi_simple(
            deviations=[2.0],
            edge_weights=[1.0],
            ops_penalty=1.0,
        )
        assert "deviation" in result.components
        assert "edge" in result.components
        assert "ops" in result.components


# ============================================================
# Delta 테스트
# ============================================================

class TestDelta:
    """ΔΦ 테스트"""

    def test_delta_phi_improved(self):
        """Φ 감소 = 개선"""
        before = PotentialResult(phi=10.0, deviation_sum=10.0,
                                  edge_weight_sum=0, ops_penalty=0,
                                  components={})
        after = PotentialResult(phi=8.0, deviation_sum=8.0,
                                 edge_weight_sum=0, ops_penalty=0,
                                 components={})
        result = calculate_delta_phi(before, after)
        assert result.delta_phi == -2.0
        assert result.improved is True

    def test_delta_phi_degraded(self):
        """Φ 증가 = 악화"""
        before = PotentialResult(phi=8.0, deviation_sum=8.0,
                                  edge_weight_sum=0, ops_penalty=0,
                                  components={})
        after = PotentialResult(phi=10.0, deviation_sum=10.0,
                                 edge_weight_sum=0, ops_penalty=0,
                                 components={})
        result = calculate_delta_phi(before, after)
        assert result.delta_phi == 2.0
        assert result.improved is False

    def test_delta_phi_simple(self):
        """간소화된 ΔΦ"""
        result = calculate_delta_phi_simple(phi_before=10.0, phi_after=7.0)
        assert result.delta_phi == -3.0
        assert result.improved is True

    def test_change_percent(self):
        """변화율"""
        result = calculate_delta_phi_simple(phi_before=10.0, phi_after=8.0)
        assert result.change_percent == pytest.approx(-20.0, rel=1e-2)

    def test_delta_components(self):
        """구성요소별 Δ"""
        before = PotentialResult(phi=10.0, deviation_sum=8.0,
                                  edge_weight_sum=2.0, ops_penalty=0,
                                  components={"deviation": 8.0, "edge": 1.0, "ops": 0})
        after = PotentialResult(phi=7.0, deviation_sum=5.0,
                                 edge_weight_sum=2.0, ops_penalty=0,
                                 components={"deviation": 5.0, "edge": 1.0, "ops": 0})
        delta = calculate_delta_components(before, after)
        assert delta["deviation"] == -3.0


# ============================================================
# Convergence 테스트
# ============================================================

class TestConvergence:
    """수렴 판정 테스트"""

    def test_default_epsilon(self):
        """기본 ε"""
        assert DEFAULT_EPSILON == 0.01

    def test_min_iterations(self):
        """최소 연속 수렴 횟수"""
        assert MIN_CONVERGENCE_ITERATIONS == 3

    def test_check_convergence_not_converging(self):
        """수렴 안 됨"""
        result = check_convergence(delta_phi=0.1, epsilon=0.01)
        assert result.converged is False
        assert result.iterations == 0

    def test_check_convergence_converging(self):
        """수렴 중 (연속 횟수 부족)"""
        result = check_convergence(delta_phi=0.005, epsilon=0.01,
                                   previous_iterations=1)
        assert result.converged is False
        assert result.iterations == 2

    def test_check_convergence_converged(self):
        """수렴 완료"""
        result = check_convergence(delta_phi=0.005, epsilon=0.01,
                                   previous_iterations=2)
        assert result.converged is True
        assert result.iterations == 3

    def test_check_convergence_reset(self):
        """수렴 리셋 (ΔΦ 증가)"""
        result = check_convergence(delta_phi=0.1, epsilon=0.01,
                                   previous_iterations=2)
        assert result.iterations == 0  # 리셋

    def test_check_convergence_history(self):
        """히스토리 기반 수렴"""
        history = [0.1, 0.05, 0.005, 0.003, 0.002]
        result = check_convergence_history(history, epsilon=0.01)
        assert result.converged is True  # 마지막 3개 수렴

    def test_check_convergence_history_not_enough(self):
        """히스토리 부족"""
        history = [0.1, 0.05, 0.005]
        result = check_convergence_history(history, epsilon=0.01)
        assert result.converged is False  # 1개만 수렴


# ============================================================
# ADR 발급 조건 테스트
# ============================================================

class TestADRIssuance:
    """ADR 발급 조건 테스트"""

    def test_can_issue_all_conditions_met(self):
        """모든 조건 충족"""
        conv = ConvergenceResult(converged=True, delta_phi=0.005,
                                  epsilon=0.01, iterations=3, message="")
        eligible, reason = can_issue_adr(
            convergence=conv,
            flux_stable=True,
            evidence_complete=True,
            gate_passed=False,
        )
        assert eligible is True
        assert "Essential Complexity confirmed" in reason

    def test_can_issue_not_converged(self):
        """수렴 안 됨"""
        conv = ConvergenceResult(converged=False, delta_phi=0.1,
                                  epsilon=0.01, iterations=0, message="")
        eligible, reason = can_issue_adr(
            convergence=conv,
            flux_stable=True,
            evidence_complete=True,
            gate_passed=False,
        )
        assert eligible is False
        assert "Not converged" in reason

    def test_can_issue_flux_unstable(self):
        """Flux 불안정"""
        conv = ConvergenceResult(converged=True, delta_phi=0.005,
                                  epsilon=0.01, iterations=3, message="")
        eligible, reason = can_issue_adr(
            convergence=conv,
            flux_stable=False,
            evidence_complete=True,
            gate_passed=False,
        )
        assert eligible is False
        assert "flux" in reason.lower()

    def test_can_issue_evidence_incomplete(self):
        """Evidence 불완전"""
        conv = ConvergenceResult(converged=True, delta_phi=0.005,
                                  epsilon=0.01, iterations=3, message="")
        eligible, reason = can_issue_adr(
            convergence=conv,
            flux_stable=True,
            evidence_complete=False,
            gate_passed=False,
        )
        assert eligible is False
        assert "Evidence" in reason

    def test_can_issue_gate_passed(self):
        """Gate 통과 - ADR 불필요"""
        conv = ConvergenceResult(converged=True, delta_phi=0.005,
                                  epsilon=0.01, iterations=3, message="")
        eligible, reason = can_issue_adr(
            convergence=conv,
            flux_stable=True,
            evidence_complete=True,
            gate_passed=True,
        )
        assert eligible is False
        assert "no ADR needed" in reason

    def test_adr_eligibility_dataclass(self):
        """ADREligibility 구조"""
        conv = ConvergenceResult(converged=True, delta_phi=0.005,
                                  epsilon=0.01, iterations=3, message="")
        result = check_adr_eligibility(
            convergence=conv,
            flux_stable=True,
            evidence_complete=True,
            gate_passed=False,
        )
        assert isinstance(result, ADREligibility)
        assert result.eligible is True
        assert result.flux_stable is True
