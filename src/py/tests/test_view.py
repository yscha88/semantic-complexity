"""
view 모듈 테스트

- hotspot: Hotspot Trajectory
- roi: Refactor ROI Ranking
- boundary_view: Boundary Flux View
"""

import pytest

from semantic_complexity.view import (
    HotspotCandidate,
    HOTSPOT_WINDOW,
    RAW_SUM_THRESHOLD,
    detect_hotspots,
    detect_hotspots_batch,
    RefactorCandidate,
    CostFactors,
    COST_WEIGHTS,
    calculate_cost,
    calculate_roi,
    rank_refactor_candidates,
    format_for_llm,
    BoundaryView,
    create_boundary_view,
)
from semantic_complexity.view.hotspot import EntityHistory, format_hotspots_for_llm
from semantic_complexity.view.roi import create_refactor_candidate, format_roi_table
from semantic_complexity.view.boundary_view import (
    BoundaryEdgeInfo,
    format_boundary_view,
    get_boundary_status_summary,
)
from semantic_complexity.flux import FluxResult, DegradationResult, DegradationSeverity


# ============================================================
# Hotspot 테스트
# ============================================================

class TestHotspot:
    """Hotspot 테스트"""

    def test_constants(self):
        """상수 확인"""
        assert HOTSPOT_WINDOW == 5
        assert RAW_SUM_THRESHOLD == 20.0

    def test_detect_no_hotspot(self):
        """Hotspot 아님"""
        result = detect_hotspots("ent-1", [0.1, 0.2, 0.15], raw_sum=10.0)
        assert result is None

    def test_detect_hotspot_consecutive(self):
        """연속 증가로 Hotspot"""
        # 5번 연속 증가
        history = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]
        result = detect_hotspots("ent-1", history, raw_sum=15.0)
        assert result is not None
        assert result.consecutive_increases >= 5

    def test_detect_hotspot_raw_sum(self):
        """rawSum으로 Hotspot"""
        result = detect_hotspots("ent-1", [0.1, 0.2], raw_sum=25.0)
        assert result is not None
        assert result.severity in ("medium", "critical")

    def test_detect_hotspot_critical(self):
        """Critical Hotspot"""
        history = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]
        result = detect_hotspots("ent-1", history, raw_sum=25.0)
        assert result is not None
        assert result.severity == "critical"

    def test_detect_hotspots_batch(self):
        """배치 탐지"""
        histories = [
            EntityHistory("ent-1", [0.1, 0.2, 0.3, 0.4, 0.5, 0.6], 25.0),
            EntityHistory("ent-2", [0.1, 0.1], 10.0),
            EntityHistory("ent-3", [0.1, 0.2, 0.3, 0.4, 0.5, 0.6], 15.0),
        ]
        results = detect_hotspots_batch(histories)
        assert len(results) == 2  # ent-1, ent-3
        assert results[0].severity == "critical"  # 가장 심각한 것 먼저

    def test_format_hotspots_for_llm(self):
        """LLM 포맷"""
        candidates = [
            HotspotCandidate("ent-1", 5, 0.6, [0.2, 0.3, 0.4, 0.5, 0.6], "critical"),
        ]
        output = format_hotspots_for_llm(candidates)
        assert "Hotspot" in output
        assert "critical" in output


# ============================================================
# ROI 테스트
# ============================================================

class TestROI:
    """ROI 테스트"""

    def test_cost_weights(self):
        """비용 가중치"""
        assert COST_WEIGHTS["files"] == 1.0
        assert COST_WEIGHTS["api"] == 3.0

    def test_calculate_cost(self):
        """비용 계산"""
        factors = CostFactors(
            files_changed=5,
            public_api_changed=2,
            schema_changed=1,
            policy_touched=0,
            test_delta=3,
        )
        cost = calculate_cost(factors)
        # 1*5 + 3*2 + 5*1 + 4*0 + 2*3 = 5 + 6 + 5 + 0 + 6 = 22
        assert cost == 22.0

    def test_calculate_roi(self):
        """ROI 계산"""
        # ΔΦ = -3 (개선), Cost = 6
        roi = calculate_roi(delta_phi=-3.0, cost=6.0)
        assert roi == 0.5  # -(-3)/6

    def test_calculate_roi_zero_cost(self):
        """비용 0"""
        roi = calculate_roi(delta_phi=-3.0, cost=0.0)
        assert roi == 0.0

    def test_calculate_roi_degradation(self):
        """악화 시 ROI 음수"""
        roi = calculate_roi(delta_phi=3.0, cost=6.0)
        assert roi == -0.5

    def test_create_refactor_candidate(self):
        """후보 생성"""
        factors = CostFactors(files_changed=2, public_api_changed=1)
        candidate = create_refactor_candidate(
            delta_id="refactor-1",
            description="Extract method",
            delta_phi=-2.0,
            factors=factors,
            affected_entities=["ent-1", "ent-2"],
        )
        assert candidate.cost == 5.0  # 1*2 + 3*1
        assert candidate.roi == pytest.approx(0.4, rel=1e-2)  # 2/5

    def test_rank_refactor_candidates(self):
        """순위 정렬"""
        candidates = [
            RefactorCandidate("r1", "Low ROI", -1.0, 10.0, 0.1, []),
            RefactorCandidate("r2", "High ROI", -5.0, 5.0, 1.0, []),
            RefactorCandidate("r3", "Medium ROI", -3.0, 6.0, 0.5, []),
        ]
        ranked = rank_refactor_candidates(candidates)
        assert ranked[0].delta_id == "r2"  # ROI=1.0
        assert ranked[1].delta_id == "r3"  # ROI=0.5
        assert ranked[2].delta_id == "r1"  # ROI=0.1

    def test_rank_top_k(self):
        """Top-K"""
        candidates = [
            RefactorCandidate(f"r{i}", f"Refactor {i}", -1.0, 1.0, float(i), [])
            for i in range(10)
        ]
        ranked = rank_refactor_candidates(candidates, top_k=3)
        assert len(ranked) == 3

    def test_format_for_llm(self):
        """LLM 포맷"""
        candidates = [
            RefactorCandidate("r1", "Extract method", -2.0, 5.0, 0.4, ["ent-1"]),
        ]
        output = format_for_llm(candidates)
        assert "ROI" in output
        assert "Extract method" in output


# ============================================================
# BoundaryView 테스트
# ============================================================

class TestBoundaryView:
    """BoundaryView 테스트"""

    def test_create_boundary_view(self):
        """View 생성"""
        flux = FluxResult(flux=5.0, boundary_edge_count=3,
                          avg_weight_per_edge=1.67)
        view = create_boundary_view(flux)
        assert view.flux == flux
        assert view.delta_flux is None

    def test_create_boundary_view_with_previous(self):
        """이전 flux 포함"""
        current = FluxResult(flux=7.0, boundary_edge_count=3,
                             avg_weight_per_edge=2.33)
        previous = FluxResult(flux=5.0, boundary_edge_count=3,
                              avg_weight_per_edge=1.67)
        view = create_boundary_view(current, previous)
        assert view.delta_flux == 2.0

    def test_create_boundary_view_with_edges(self):
        """간선 정보 포함"""
        flux = FluxResult(flux=5.0, boundary_edge_count=3,
                          avg_weight_per_edge=1.67)
        edges = [
            BoundaryEdgeInfo("a", "b", 3.0, "import"),
            BoundaryEdgeInfo("c", "d", 2.0, "call"),
        ]
        view = create_boundary_view(flux, edges=edges, top_k=1)
        assert len(view.top_edges) == 1
        assert view.top_edges[0].weight == 3.0

    def test_format_boundary_view(self):
        """포맷"""
        flux = FluxResult(flux=5.0, boundary_edge_count=3,
                          avg_weight_per_edge=1.67)
        view = create_boundary_view(flux)
        output = format_boundary_view(view)
        assert "flux" in output.lower()

    def test_get_boundary_status_summary(self):
        """상태 요약"""
        flux = FluxResult(flux=5.0, boundary_edge_count=3,
                          avg_weight_per_edge=1.67)
        deg = DegradationResult(degraded=True, delta_flux=2.0,
                                avg_load_exceeded=False,
                                severity=DegradationSeverity.MILD,
                                message="")
        view = BoundaryView(flux=flux, degradation=deg)
        summary = get_boundary_status_summary(view)
        assert summary["status"] == "mild"
        assert summary["degraded"] is True
