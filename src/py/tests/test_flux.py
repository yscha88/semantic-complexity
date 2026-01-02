"""
flux 모듈 테스트

- boundary: 경계 흐름 계산
- degradation: 경계 악화 탐지
"""

import pytest

from semantic_complexity.flux import (
    FluxResult,
    calculate_boundary_flux,
    calculate_boundary_flux_simple,
    DegradationResult,
    DegradationSeverity,
    BOUNDARY_LOAD_THRESHOLD,
    detect_boundary_degradation,
)
from semantic_complexity.flux.boundary import EdgeInput, get_boundary_edge_details
from semantic_complexity.flux.degradation import (
    detect_degradation_simple,
    is_flux_stable,
)


# ============================================================
# Boundary 테스트
# ============================================================

class TestBoundary:
    """경계 흐름 테스트"""

    def test_flux_result_structure(self):
        """FluxResult 구조"""
        result = FluxResult(flux=5.0, boundary_edge_count=3,
                            avg_weight_per_edge=1.67)
        assert result.flux == 5.0
        assert result.boundary_edge_count == 3
        assert result.avg_weight_per_edge == pytest.approx(1.67, rel=1e-2)

    def test_calculate_boundary_flux(self):
        """경계 흐름 계산"""
        edges = [
            EdgeInput(src_entity="a", dst_entity="b",
                      weight_total=2.0, is_boundary=True),
            EdgeInput(src_entity="b", dst_entity="c",
                      weight_total=3.0, is_boundary=True),
            EdgeInput(src_entity="c", dst_entity="d",
                      weight_total=1.0, is_boundary=False),
        ]
        result = calculate_boundary_flux(edges)
        assert result.flux == 5.0  # 2+3
        assert result.boundary_edge_count == 2
        assert result.avg_weight_per_edge == 2.5

    def test_calculate_boundary_flux_no_boundary(self):
        """경계 간선 없음"""
        edges = [
            EdgeInput(src_entity="a", dst_entity="b",
                      weight_total=2.0, is_boundary=False),
        ]
        result = calculate_boundary_flux(edges)
        assert result.flux == 0.0
        assert result.boundary_edge_count == 0
        assert result.avg_weight_per_edge == 0.0

    def test_calculate_boundary_flux_simple(self):
        """간소화된 경계 흐름"""
        weights = [2.0, 3.0, 1.0]
        is_boundary = [True, True, False]
        result = calculate_boundary_flux_simple(weights, is_boundary)
        assert result.flux == 5.0

    def test_calculate_boundary_flux_simple_length_mismatch(self):
        """길이 불일치 오류"""
        with pytest.raises(ValueError):
            calculate_boundary_flux_simple([1.0, 2.0], [True])

    def test_get_boundary_edge_details(self):
        """경계 간선 상세"""
        edges = [
            EdgeInput(src_entity="a", dst_entity="b",
                      weight_total=2.0, is_boundary=True),
            EdgeInput(src_entity="c", dst_entity="d",
                      weight_total=1.0, is_boundary=False),
        ]
        details = get_boundary_edge_details(edges)
        assert len(details) == 1
        assert details[0]["src"] == "a"
        assert details[0]["weight"] == 2.0


# ============================================================
# Degradation 테스트
# ============================================================

class TestDegradation:
    """경계 악화 테스트"""

    def test_boundary_load_threshold(self):
        """임계값 확인"""
        assert BOUNDARY_LOAD_THRESHOLD == 2.0

    def test_no_degradation(self):
        """악화 없음"""
        before = FluxResult(flux=5.0, boundary_edge_count=3,
                            avg_weight_per_edge=1.67)
        after = FluxResult(flux=4.0, boundary_edge_count=3,
                           avg_weight_per_edge=1.33)
        result = detect_boundary_degradation(before, after)
        assert result.degraded is False
        assert result.severity == DegradationSeverity.NONE

    def test_degradation_flux_increase(self):
        """Flux 증가 = 악화"""
        before = FluxResult(flux=5.0, boundary_edge_count=3,
                            avg_weight_per_edge=1.67)
        after = FluxResult(flux=7.0, boundary_edge_count=3,
                           avg_weight_per_edge=2.33)
        result = detect_boundary_degradation(before, after)
        assert result.degraded is True
        assert result.delta_flux == 2.0

    def test_degradation_avg_load_exceeded(self):
        """평균 부하 초과"""
        before = FluxResult(flux=4.0, boundary_edge_count=4,
                            avg_weight_per_edge=1.0)
        after = FluxResult(flux=4.0, boundary_edge_count=1,
                           avg_weight_per_edge=4.0)  # > threshold(2.0)
        result = detect_boundary_degradation(before, after)
        assert result.degraded is True
        assert result.avg_load_exceeded is True

    def test_degradation_severity_severe(self):
        """심각한 악화"""
        before = FluxResult(flux=5.0, boundary_edge_count=3,
                            avg_weight_per_edge=1.67)
        after = FluxResult(flux=10.0, boundary_edge_count=3,
                           avg_weight_per_edge=3.33)  # 증가 + 초과
        result = detect_boundary_degradation(before, after)
        assert result.severity == DegradationSeverity.SEVERE

    def test_degradation_severity_mild(self):
        """경미한 악화"""
        before = FluxResult(flux=5.0, boundary_edge_count=3,
                            avg_weight_per_edge=1.67)
        after = FluxResult(flux=5.5, boundary_edge_count=3,
                           avg_weight_per_edge=1.83)
        result = detect_boundary_degradation(before, after)
        assert result.severity == DegradationSeverity.MILD

    def test_degradation_message(self):
        """악화 메시지"""
        before = FluxResult(flux=5.0, boundary_edge_count=3,
                            avg_weight_per_edge=1.67)
        after = FluxResult(flux=7.0, boundary_edge_count=3,
                           avg_weight_per_edge=2.33)
        result = detect_boundary_degradation(before, after)
        assert "Bread weakening" in result.message

    def test_detect_degradation_simple(self):
        """간소화된 악화 탐지"""
        result = detect_degradation_simple(
            flux_before=5.0,
            flux_after=7.0,
            edge_count=3,
        )
        assert result.degraded is True

    def test_is_flux_stable(self):
        """Flux 안정 여부"""
        before = FluxResult(flux=5.0, boundary_edge_count=3,
                            avg_weight_per_edge=1.67)
        after = FluxResult(flux=4.5, boundary_edge_count=3,
                           avg_weight_per_edge=1.5)
        assert is_flux_stable(before, after) is True

        after_bad = FluxResult(flux=7.0, boundary_edge_count=3,
                               avg_weight_per_edge=2.33)
        assert is_flux_stable(before, after_bad) is False
