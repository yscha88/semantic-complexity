"""
measurement 모듈 테스트

- VectorAnalyzer: 5D 벡터 측정
- deviation: 정준 편차 계산
- hodge: Hodge bucket 분류
- evidence: RuleHit, Location
"""

import pytest

from semantic_complexity.measurement import (
    ComplexityVector,
    VectorMeasurement,
    VectorAnalyzer,
    calculate_deviation,
    calculate_delta_deviation,
    get_canonical_5d_profile,
    CANONICAL_5D_PROFILES,
    HodgeBucket,
    classify_hodge,
    get_hodge_scores,
    Location,
    RuleHit,
)


# ============================================================
# ComplexityVector 테스트
# ============================================================

class TestComplexityVector:
    """ComplexityVector 테스트"""

    def test_create_vector(self):
        """벡터 생성"""
        v = ComplexityVector(C=1.0, N=2.0, S=3.0, A=4.0, L=5.0)
        assert v.C == 1.0
        assert v.N == 2.0
        assert v.S == 3.0
        assert v.A == 4.0
        assert v.L == 5.0

    def test_raw_sum(self):
        """raw_sum 계산"""
        v = ComplexityVector(C=1.0, N=2.0, S=3.0, A=4.0, L=5.0)
        assert v.raw_sum == 15.0

    def test_zero_vector(self):
        """영벡터"""
        v = ComplexityVector.zero()
        assert v.C == 0.0
        assert v.raw_sum == 0.0

    def test_to_array(self):
        """numpy 배열 변환"""
        v = ComplexityVector(C=1.0, N=2.0, S=3.0, A=4.0, L=5.0)
        arr = v.to_array()
        assert arr[0] == 1.0
        assert arr[4] == 5.0
        assert len(arr) == 5

    def test_from_array(self):
        """numpy 배열에서 생성"""
        import numpy as np
        arr = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
        v = ComplexityVector.from_array(arr)
        assert v.C == 1.0
        assert v.L == 5.0

    def test_to_dict(self):
        """dict 변환"""
        v = ComplexityVector(C=1.0, N=2.0, S=3.0, A=4.0, L=5.0)
        d = v.to_dict()
        assert d == {"C": 1.0, "N": 2.0, "S": 3.0, "A": 4.0, "L": 5.0}


# ============================================================
# VectorAnalyzer 테스트
# ============================================================

class TestVectorAnalyzer:
    """VectorAnalyzer 테스트"""

    def test_measure_control_flow(self):
        """제어 흐름 측정"""
        source = """
def func():
    if True:
        pass
    for i in range(10):
        pass
    while False:
        pass
"""
        analyzer = VectorAnalyzer()
        result = analyzer.measure(source, "ent-1", "snap-1")
        assert result.vector.C == 3.0  # if, for, while

    def test_measure_nesting(self):
        """중첩 깊이 측정"""
        source = """
def func():
    if True:
        if True:
            if True:
                pass
"""
        analyzer = VectorAnalyzer()
        result = analyzer.measure(source, "ent-1", "snap-1")
        assert result.vector.N >= 3  # 3단계 중첩

    def test_measure_state(self):
        """상태 복잡도 측정"""
        source = """
counter = 0
def func():
    global counter
    counter += 1
"""
        analyzer = VectorAnalyzer()
        result = analyzer.measure(source, "ent-1", "snap-1")
        assert result.vector.S >= 1  # global

    def test_measure_async(self):
        """비동기 복잡도 측정"""
        source = """
async def func():
    await something()
"""
        analyzer = VectorAnalyzer()
        result = analyzer.measure(source, "ent-1", "snap-1")
        assert result.vector.A >= 2  # async def + await

    def test_measure_coupling(self):
        """결합도 측정"""
        source = """
import os
import sys
from pathlib import Path

def func(a, b, c, d, e, f, g):  # 7 params > 5
    pass
"""
        analyzer = VectorAnalyzer()
        result = analyzer.measure(source, "ent-1", "snap-1")
        assert result.vector.L > 0  # imports + excessive params

    def test_rule_hits_generated(self):
        """RuleHit 생성 확인"""
        source = """
def func():
    if True:
        for i in range(10):
            pass
"""
        analyzer = VectorAnalyzer()
        result = analyzer.measure(source, "ent-1", "snap-1", "test.py")

        assert len(result.rule_hits) > 0
        rule_ids = [h.rule_id for h in result.rule_hits]
        assert "control/branch" in rule_ids
        assert "nesting/depth" in rule_ids

    def test_syntax_error_returns_zero(self):
        """구문 오류 시 영벡터"""
        source = "def func( invalid syntax"
        analyzer = VectorAnalyzer()
        result = analyzer.measure(source, "ent-1", "snap-1")
        assert result.vector.raw_sum == 0.0

    def test_empty_source(self):
        """빈 소스"""
        analyzer = VectorAnalyzer()
        result = analyzer.measure("", "ent-1", "snap-1")
        assert result.vector.raw_sum == 0.0


# ============================================================
# Deviation 테스트
# ============================================================

class TestDeviation:
    """정준 편차 테스트"""

    def test_canonical_profiles_exist(self):
        """정준 프로파일 존재"""
        assert "api/external" in CANONICAL_5D_PROFILES
        assert "lib/domain" in CANONICAL_5D_PROFILES
        assert "app" in CANONICAL_5D_PROFILES

    def test_get_canonical_profile(self):
        """프로파일 조회"""
        profile = get_canonical_5d_profile("lib/domain")
        assert profile.C == 5
        assert profile.N == 3

    def test_get_canonical_profile_unknown(self):
        """알 수 없는 타입은 app 반환"""
        profile = get_canonical_5d_profile("unknown")
        assert profile == CANONICAL_5D_PROFILES["app"]

    def test_calculate_deviation_at_canonical(self):
        """정준 상태에서 편차 = 0"""
        profile = get_canonical_5d_profile("lib/domain")
        d = calculate_deviation(profile, "lib/domain")
        assert d == pytest.approx(0.0, abs=1e-6)

    def test_calculate_deviation_above_canonical(self):
        """정준 초과 시 편차 > 0"""
        # lib/domain 정준: C=5, N=3, S=2, A=0, L=3
        x = ComplexityVector(C=10, N=6, S=4, A=0, L=6)  # 2배
        d = calculate_deviation(x, "lib/domain")
        assert d > 0

    def test_calculate_delta_deviation(self):
        """편차 변화량"""
        delta = calculate_delta_deviation(d_before=1.0, d_after=0.5)
        assert delta == -0.5  # 개선

        delta = calculate_delta_deviation(d_before=0.5, d_after=1.0)
        assert delta == 0.5  # 악화


# ============================================================
# Hodge 테스트
# ============================================================

class TestHodge:
    """Hodge bucket 테스트"""

    def test_classify_algorithmic(self):
        """algorithmic 분류 (C+N 지배)"""
        x = ComplexityVector(C=10, N=8, S=1, A=1, L=1)
        assert classify_hodge(x) == HodgeBucket.ALGORITHMIC

    def test_classify_balanced(self):
        """balanced 분류 (A 지배)"""
        x = ComplexityVector(C=1, N=1, S=1, A=20, L=1)
        assert classify_hodge(x) == HodgeBucket.BALANCED

    def test_classify_architectural(self):
        """architectural 분류 (S+L 지배)"""
        x = ComplexityVector(C=1, N=1, S=10, A=1, L=10)
        assert classify_hodge(x) == HodgeBucket.ARCHITECTURAL

    def test_get_hodge_scores(self):
        """Hodge 점수"""
        x = ComplexityVector(C=5, N=3, S=2, A=1, L=4)
        scores = get_hodge_scores(x)
        assert scores["algorithmic"] == 8  # C+N
        assert scores["balanced"] == 1     # A
        assert scores["architectural"] == 6  # S+L


# ============================================================
# Evidence 테스트
# ============================================================

class TestEvidence:
    """Evidence 테스트"""

    def test_location_str(self):
        """Location 문자열 변환"""
        loc = Location(file="test.py", line=10, column=5, ast_node_type="If")
        assert str(loc) == "test.py:10:5 (If)"

    def test_location_minimal(self):
        """최소 Location"""
        loc = Location(file="test.py", line=10)
        assert str(loc) == "test.py:10"

    def test_rule_hit_has_evidence(self):
        """RuleHit evidence 확인"""
        hit = RuleHit(
            entity_id="ent-1",
            snapshot_id="snap-1",
            rule_id="nesting/depth",
            count=5,
            locations=[Location(file="test.py", line=10)],
        )
        assert hit.has_evidence() is True

    def test_rule_hit_no_evidence(self):
        """RuleHit evidence 없음"""
        hit = RuleHit(
            entity_id="ent-1",
            snapshot_id="snap-1",
            rule_id="nesting/depth",
            count=5,
        )
        assert hit.has_evidence() is False

    def test_rule_hit_to_dict(self):
        """RuleHit dict 변환"""
        hit = RuleHit(
            entity_id="ent-1",
            snapshot_id="snap-1",
            rule_id="control/branch",
            count=3,
            locations=[Location(file="test.py", line=10)],
        )
        d = hit.to_dict()
        assert d["rule_id"] == "control/branch"
        assert d["count"] == 3
        assert len(d["locations"]) == 1
