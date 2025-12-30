"""
MVP Gate System

PoC → MVP 진입 조건 검사

🍞 Trust boundary explicitly defined
🍞 Auth/authz flow fixed
🧀 Core modules below cognitive threshold
🧀 No state×async×retry violations
🥓 Golden tests exist for critical flows
"""

__module_type__ = "lib/domain"

from dataclasses import dataclass, field
from typing import Literal

from ..types import Axis, ModuleType, SandwichScore, get_canonical_profile, DEFAULT_MODULE_TYPE
from ..analyzers import BreadResult, CognitiveAnalysis, HamResult


@dataclass
class BreadGateResult:
    """🍞 Security Gate 결과"""
    passed: bool
    trust_boundary_defined: bool
    auth_flow_fixed: bool
    violations: list[str] = field(default_factory=list)


@dataclass
class CheeseGateResult:
    """🧀 Cognitive Gate 결과"""
    passed: bool
    accessible: bool
    max_nesting: int
    nesting_threshold: int
    state_async_retry_violations: list[str] = field(default_factory=list)
    concept_violations: list[str] = field(default_factory=list)


@dataclass
class HamGateResult:
    """🥓 Behavioral Gate 결과"""
    passed: bool
    golden_test_coverage: float
    critical_paths_protected: list[str] = field(default_factory=list)
    unprotected_paths: list[str] = field(default_factory=list)


@dataclass
class GateResult:
    """전체 Gate 결과"""
    gate: Literal["mvp", "production"]
    passed: bool
    sandwich_formed: bool

    bread: BreadGateResult
    cheese: CheeseGateResult
    ham: HamGateResult

    @property
    def summary(self) -> str:
        """결과 요약"""
        if self.passed:
            return f"✅ {self.gate.upper()} Gate PASSED"

        failed = []
        if not self.bread.passed:
            failed.append("🍞")
        if not self.cheese.passed:
            failed.append("🧀")
        if not self.ham.passed:
            failed.append("🥓")

        return f"❌ {self.gate.upper()} Gate FAILED: {', '.join(failed)}"


# ============================================================
# Gate 임계값
# ============================================================

MVP_THRESHOLDS = {
    "nesting_max": 4,              # 최대 중첩 깊이
    "concepts_per_function": 5,    # 함수당 최대 개념 수
    "hidden_dep_max": 2,           # 최대 숨겨진 의존성
    "golden_test_min": 0.8,        # Golden test 최소 커버리지
    "trust_boundary_required": True,
    "auth_flow_required": True,
}

PRODUCTION_THRESHOLDS = {
    "nesting_max": 3,
    "concepts_per_function": 4,
    "hidden_dep_max": 1,
    "golden_test_min": 0.95,
    "contract_test_required": True,
    "trust_boundary_required": True,
    "auth_flow_required": True,
}


class MVPGate:
    """MVP Gate 검사기"""

    def __init__(
        self,
        bread_result: BreadResult,
        cheese_result: CognitiveAnalysis,
        ham_result: HamResult,
        module_type: ModuleType | None = None,
        gate_type: Literal["mvp", "production"] = "mvp",
    ):
        self.bread_result = bread_result
        self.cheese_result = cheese_result
        self.ham_result = ham_result
        self.module_type = module_type or DEFAULT_MODULE_TYPE
        self.gate_type = gate_type

        self.thresholds = (
            PRODUCTION_THRESHOLDS if gate_type == "production"
            else MVP_THRESHOLDS
        )

    def check(self) -> GateResult:
        """Gate 검사 실행"""
        bread_gate = self._check_bread()
        cheese_gate = self._check_cheese()
        ham_gate = self._check_ham()

        # 🍞🧀🥓 모두 통과해야 sandwich 형성
        sandwich_formed = (
            bread_gate.passed and
            cheese_gate.passed and
            ham_gate.passed
        )

        return GateResult(
            gate=self.gate_type,
            passed=sandwich_formed,
            sandwich_formed=sandwich_formed,
            bread=bread_gate,
            cheese=cheese_gate,
            ham=ham_gate,
        )

    def _check_bread(self) -> BreadGateResult:
        """🍞 Security Gate 검사"""
        violations: list[str] = []

        # Trust boundary 정의 확인
        trust_boundary_defined = self.bread_result.trust_boundary_count > 0
        if self.thresholds.get("trust_boundary_required") and not trust_boundary_defined:
            violations.append("Trust boundary not defined")

        # Auth flow 명시성 확인
        # AUTH_FLOW 패턴이 명시되어 있으면 (NONE 포함) "명시적"으로 간주
        auth_flow_declared = any(
            "AUTH_FLOW" in p for p in self.bread_result.auth_patterns
        )
        auth_flow_fixed = auth_flow_declared or self.bread_result.auth_explicitness >= 0.3
        if self.thresholds.get("auth_flow_required") and not auth_flow_fixed:
            violations.append(f"Auth flow not explicit enough: {self.bread_result.auth_explicitness:.2f}")

        # High severity secrets 확인
        high_secrets = [s for s in self.bread_result.secret_patterns if s.severity == "high"]
        if high_secrets:
            violations.append(f"High severity secrets detected: {len(high_secrets)}")

        passed = len(violations) == 0

        return BreadGateResult(
            passed=passed,
            trust_boundary_defined=trust_boundary_defined,
            auth_flow_fixed=auth_flow_fixed,
            violations=violations,
        )

    def _check_cheese(self) -> CheeseGateResult:
        """🧀 Cognitive Gate 검사

        인지 가능 조건 (4가지 모두 충족):
        1. 중첩 깊이 ≤ N
        2. 개념 수 ≤ 5개/함수
        3. 숨겨진 의존성 최소화
        4. state×async×retry 2개 이상 공존 금지
        """
        sar_violations: list[str] = []
        concept_violations: list[str] = []

        nesting_threshold = self.thresholds["nesting_max"]
        max_nesting = self.cheese_result.max_nesting

        # 이미 is_cognitively_accessible에서 모든 조건 검사함
        # violations 리스트에서 세부 정보 추출
        for violation in self.cheese_result.violations:
            if "state" in violation.lower() or "async" in violation.lower() or "retry" in violation.lower():
                sar_violations.append(violation)
            else:
                concept_violations.append(violation)

        # Gate 통과 조건: 인지 가능 = True
        passed = self.cheese_result.accessible

        return CheeseGateResult(
            passed=passed,
            accessible=self.cheese_result.accessible,
            max_nesting=max_nesting,
            nesting_threshold=nesting_threshold,
            state_async_retry_violations=sar_violations,
            concept_violations=concept_violations,
        )

    def _check_ham(self) -> HamGateResult:
        """🥓 Behavioral Gate 검사"""
        min_coverage = self.thresholds["golden_test_min"]
        coverage = self.ham_result.golden_test_coverage

        protected = [p.name for p in self.ham_result.critical_paths if p.protected]
        unprotected = [p.name for p in self.ham_result.critical_paths if not p.protected]

        passed = coverage >= min_coverage

        return HamGateResult(
            passed=passed,
            golden_test_coverage=coverage,
            critical_paths_protected=protected,
            unprotected_paths=unprotected,
        )


# ============================================================
# 공개 API
# ============================================================

def check_mvp_gate(
    bread_result: BreadResult,
    cheese_result: CognitiveAnalysis,
    ham_result: HamResult,
    module_type: ModuleType | None = None,
) -> GateResult:
    """
    MVP Gate 검사

    Args:
        bread_result: 🍞 Security 분석 결과
        cheese_result: 🧀 Cognitive 분석 결과 (인지 가능 여부)
        ham_result: 🥓 Behavioral 분석 결과
        module_type: 모듈 타입

    Returns:
        GateResult: Gate 검사 결과
    """
    gate = MVPGate(bread_result, cheese_result, ham_result, module_type, "mvp")
    return gate.check()


def check_production_gate(
    bread_result: BreadResult,
    cheese_result: CognitiveAnalysis,
    ham_result: HamResult,
    module_type: ModuleType | None = None,
) -> GateResult:
    """
    Production Gate 검사 (더 엄격)

    Args:
        bread_result: 🍞 Security 분석 결과
        cheese_result: 🧀 Cognitive 분석 결과 (인지 가능 여부)
        ham_result: 🥓 Behavioral 분석 결과
        module_type: 모듈 타입

    Returns:
        GateResult: Gate 검사 결과
    """
    gate = MVPGate(bread_result, cheese_result, ham_result, module_type, "production")
    return gate.check()
