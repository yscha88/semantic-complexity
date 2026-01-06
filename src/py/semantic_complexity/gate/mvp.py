"""
MVP Gate System

PoC → MVP 진입 조건 검사

🍞 Trust boundary explicitly defined
🍞 Auth/authz flow fixed
🧀 Core modules below cognitive threshold
🧀 No state×async×retry violations
🥓 Golden tests exist for critical flows

Essential Complexity Waiver:
- MVP Gate: waiver 불가 (처음부터 제대로 설계)
- Production Gate: waiver 가능 (ADR 필수)
"""

__architecture_role__ = "lib/domain"

from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

from ..types import Axis, ArchitectureRole, SandwichScore, get_canonical_profile, DEFAULT_MODULE_TYPE
from ..analyzers import BreadResult, CognitiveAnalysis, HamResult
from .waiver import check_waiver, WaiverResult, EssentialComplexityConfig


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
    # Waiver 정보 (Production Gate에서만 적용)
    waiver: WaiverResult | None = None
    waived: bool = False


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
    gate: Literal["poc", "mvp", "production"]
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
# Gate 임계값 (기준점 기반)
# ============================================================

# 기준점 (MVP 기준)
BASE_THRESHOLDS = {
    "nesting_max": 4,              # 기준: 중첩 4
    "concepts_per_function": 9,    # 기준: Miller's Law (7±2)
    "hidden_dep_max": 2,           # 기준: 숨겨진 의존성 2개
    "golden_test_min": 0.8,        # 기준: 80% 커버리지
}

# 단계별 조정 계수
STAGE_ADJUSTMENTS = {
    # PoC: 느슨 (+50% / -30%)
    "poc": {
        "nesting_max": +2,         # 4 → 6
        "concepts_per_function": +3,  # 9 → 12
        "hidden_dep_max": +2,      # 2 → 4
        "golden_test_min": -0.3,   # 0.8 → 0.5
    },
    # MVP: 기준 (조정 없음)
    "mvp": {
        "nesting_max": 0,
        "concepts_per_function": 0,
        "hidden_dep_max": 0,
        "golden_test_min": 0,
    },
    # Production: 더 엄격 (-25% / +15%)
    "production": {
        "nesting_max": -1,         # 4 → 3
        "concepts_per_function": -2,  # 9 → 7
        "hidden_dep_max": -1,      # 2 → 1
        "golden_test_min": +0.15,  # 0.8 → 0.95
    },
}

# 단계별 정책
STAGE_POLICIES = {
    "poc": {
        "trust_boundary_required": False,  # 권장만
        "auth_flow_required": False,       # 권장만
        "contract_test_required": False,
        "waiver_allowed": False,           # PoC에서는 waiver 불가
    },
    "mvp": {
        "trust_boundary_required": True,
        "auth_flow_required": True,
        "contract_test_required": False,
        "waiver_allowed": False,           # MVP에서는 waiver 불가
    },
    "production": {
        "trust_boundary_required": True,
        "auth_flow_required": True,
        "contract_test_required": True,
        "waiver_allowed": True,            # 기술부채 허용
    },
}


def get_thresholds(gate_type: Literal["poc", "mvp", "production"]) -> dict:
    """단계별 임계값 계산"""
    adjustments = STAGE_ADJUSTMENTS.get(gate_type, STAGE_ADJUSTMENTS["mvp"])
    policies = STAGE_POLICIES.get(gate_type, STAGE_POLICIES["mvp"])

    thresholds = {}
    for key, base_value in BASE_THRESHOLDS.items():
        adjustment = adjustments.get(key, 0)
        thresholds[key] = base_value + adjustment

    thresholds.update(policies)
    return thresholds


# 미리 계산된 임계값 (호환성)
POC_THRESHOLDS = get_thresholds("poc")
MVP_THRESHOLDS = get_thresholds("mvp")
PRODUCTION_THRESHOLDS = get_thresholds("production")


class MVPGate:
    """PoC/MVP/Production Gate 검사기"""

    def __init__(
        self,
        bread_result: BreadResult,
        cheese_result: CognitiveAnalysis,
        ham_result: HamResult,
        architecture_role: ArchitectureRole | None = None,
        gate_type: Literal["poc", "mvp", "production"] = "mvp",
        source: str | None = None,
        file_path: str | Path | None = None,
        project_root: str | Path | None = None,
    ):
        self.bread_result = bread_result
        self.cheese_result = cheese_result
        self.ham_result = ham_result
        self.architecture_role = architecture_role or DEFAULT_MODULE_TYPE
        self.gate_type = gate_type
        self.source = source
        self.file_path = file_path
        self.project_root = project_root

        # 단계별 임계값 가져오기
        self.thresholds = get_thresholds(gate_type)

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
        2. 개념 수 ≤ 9개/함수
        3. 숨겨진 의존성 최소화
        4. state×async×retry 2개 이상 공존 금지

        Essential Complexity Waiver:
        - MVP Gate: waiver 불가 (처음부터 제대로 설계)
        - Production Gate: waiver 가능 (ADR 필수)
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

        # 기본 통과 조건: 인지 가능 = True
        passed = self.cheese_result.accessible

        # Waiver 체크 (waiver_allowed인 단계에서만)
        waiver_result: WaiverResult | None = None
        waived = False

        waiver_allowed = self.thresholds.get("waiver_allowed", False)
        if waiver_allowed and not passed and self.source:
            # 실패 시 waiver 체크
            waiver_result = check_waiver(
                self.source,
                self.file_path,
                self.project_root,
            )
            if waiver_result.waived and waiver_result.config:
                # Waiver는 무조건 pass가 아님!
                # 조정된 임계값으로 재검사
                waived, sar_violations, concept_violations = self._recheck_with_waiver(
                    waiver_result.config,
                    sar_violations,
                    concept_violations,
                )
                passed = waived  # 조정된 임계값으로 통과해야 pass

        return CheeseGateResult(
            passed=passed,
            accessible=self.cheese_result.accessible,
            max_nesting=max_nesting,
            nesting_threshold=nesting_threshold,
            state_async_retry_violations=sar_violations,
            concept_violations=concept_violations,
            waiver=waiver_result,
            waived=waived,
        )

    def _recheck_with_waiver(
        self,
        config: EssentialComplexityConfig,
        sar_violations: list[str],
        concept_violations: list[str],
    ) -> tuple[bool, list[str], list[str]]:
        """
        Waiver 임계값으로 재검사

        Waiver는 "무조건 pass"가 아님:
        - config.nesting: 중첩 임계값 조정
        - config.concepts_total: 개념 수 임계값 조정
        - 조정된 임계값으로 violations 재필터링

        Returns:
            (통과 여부, 남은 SAR violations, 남은 concept violations)
        """
        new_sar_violations = sar_violations.copy()
        new_concept_violations: list[str] = []

        # 조정된 임계값
        adjusted_nesting = config.nesting or self.thresholds["nesting_max"]
        adjusted_concepts = config.concepts_total or self.thresholds["concepts_per_function"]

        for violation in concept_violations:
            # 중첩 깊이 violation 재검사
            if "중첩 깊이 초과" in violation:
                # "중첩 깊이 초과: 6 > 4" 형태에서 실제 값 추출
                actual_nesting = self.cheese_result.max_nesting
                if actual_nesting > adjusted_nesting:
                    # 조정된 임계값으로도 초과
                    new_concept_violations.append(
                        f"중첩 깊이 초과: {actual_nesting} > {adjusted_nesting} (waiver 적용)"
                    )
                # else: 조정된 임계값 이하 → violation 제거

            # 개념 수 violation 재검사
            elif "개념 수 초과" in violation:
                # 함수별로 재검사 필요
                still_violated = False
                for func in self.cheese_result.functions:
                    if func.name in violation and func.concept_count > adjusted_concepts:
                        still_violated = True
                        new_concept_violations.append(
                            f"개념 수 초과: {func.name}() = {func.concept_count}개 > {adjusted_concepts} (waiver 적용)"
                        )
                        break

                if not still_violated:
                    # 원래 violation에서 함수명 추출 실패 시 원본 유지
                    matched = False
                    for func in self.cheese_result.functions:
                        if func.name in violation:
                            matched = True
                            break
                    if not matched:
                        new_concept_violations.append(violation)
            else:
                # 기타 violation은 유지
                new_concept_violations.append(violation)

        # 모든 violations이 해결되었는지 확인
        all_passed = len(new_sar_violations) == 0 and len(new_concept_violations) == 0

        return all_passed, new_sar_violations, new_concept_violations

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

def check_poc_gate(
    bread_result: BreadResult,
    cheese_result: CognitiveAnalysis,
    ham_result: HamResult,
    architecture_role: ArchitectureRole | None = None,
) -> GateResult:
    """
    PoC Gate 검사 (느슨)

    PoC 단계: 빠른 검증, 일단 돌아가면 OK.
    Trust boundary, auth flow 권장만 (필수 아님).

    Args:
        bread_result: 🍞 Security 분석 결과
        cheese_result: 🧀 Cognitive 분석 결과 (인지 가능 여부)
        ham_result: 🥓 Behavioral 분석 결과
        architecture_role: 모듈 타입

    Returns:
        GateResult: Gate 검사 결과
    """
    gate = MVPGate(bread_result, cheese_result, ham_result, architecture_role, "poc")
    return gate.check()


def check_mvp_gate(
    bread_result: BreadResult,
    cheese_result: CognitiveAnalysis,
    ham_result: HamResult,
    architecture_role: ArchitectureRole | None = None,
) -> GateResult:
    """
    MVP Gate 검사 (바싹)

    MVP 단계: 첫 릴리스, 제대로 설계 강제.
    Waiver 불가 - 처음부터 제대로.

    Args:
        bread_result: 🍞 Security 분석 결과
        cheese_result: 🧀 Cognitive 분석 결과 (인지 가능 여부)
        ham_result: 🥓 Behavioral 분석 결과
        architecture_role: 모듈 타입

    Returns:
        GateResult: Gate 검사 결과
    """
    gate = MVPGate(bread_result, cheese_result, ham_result, architecture_role, "mvp")
    return gate.check()


def check_production_gate(
    bread_result: BreadResult,
    cheese_result: CognitiveAnalysis,
    ham_result: HamResult,
    architecture_role: ArchitectureRole | None = None,
    source: str | None = None,
    file_path: str | Path | None = None,
    project_root: str | Path | None = None,
) -> GateResult:
    """
    Production Gate 검사 (더 엄격)

    Production Gate에서는 Essential Complexity Waiver 가능.
    __essential_complexity__에 ADR 경로가 있고 파일이 존재하면 유예.

    Args:
        bread_result: 🍞 Security 분석 결과
        cheese_result: 🧀 Cognitive 분석 결과 (인지 가능 여부)
        ham_result: 🥓 Behavioral 분석 결과
        architecture_role: 모듈 타입
        source: 소스 코드 (waiver 체크용)
        file_path: 파일 경로 (ADR 상대 경로 해석용)
        project_root: 프로젝트 루트 (ADR 경로 해석용)

    Returns:
        GateResult: Gate 검사 결과
    """
    gate = MVPGate(
        bread_result,
        cheese_result,
        ham_result,
        architecture_role,
        "production",
        source,
        file_path,
        project_root,
    )
    return gate.check()
