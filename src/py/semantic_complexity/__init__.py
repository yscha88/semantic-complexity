"""
semantic-complexity

🍞🧀🥓 Ham Sandwich Theorem 기반 다차원 코드 복잡도 분석기

핵심 개념:
- 🍞 Bread (Security): 구조 안정성 - 신뢰 경계, 인증, 암호
- 🧀 Cheese (Cognitive): 인지 가능 여부 - 중첩, 개념수, 숨겨진 의존성, state×async×retry
- 🥓 Ham (Behavioral): 행동 보존 - Golden test, Contract test, Critical path

이론적 토대:
- Ham Sandwich Theorem: 3축 균형점의 존재성 보장
- Sperner's Lemma: 적절한 라벨링 시 균형점 필연적 존재
- Lyapunov Stability: 에너지 함수 기반 수렴 경로

Usage:
    from semantic_complexity import analyze_sandwich, check_gate

    result = analyze_sandwich("path/to/file.py")
    gate = check_gate(result, "mvp")
"""

__architecture_role__ = "lib/common"
__version__ = "0.0.8"

# ============================================================
# Core Types
# ============================================================
from .types import (
    # Axis
    Axis,
    AxisLiteral,
    # Module
    ArchitectureRole,
    ArchitectureRoleLiteral,
    DEFAULT_MODULE_TYPE,
    # Score
    SandwichScore,
    RawScores,
    RawBreadScore,
    RawCheeseScore,
    RawHamScore,
    # Profile
    CanonicalProfile,
    ChangeBudget,
    Threshold,
    CANONICAL_PROFILES,
    get_canonical_profile,
)

# ============================================================
# Analyzers
# ============================================================
from .analyzers import (
    # Bread
    analyze_bread,
    BreadResult,
    TrustBoundary,
    SecretPattern,
    # Cheese
    analyze_cognitive,
    is_cognitively_accessible,
    CognitiveAnalysis,
    AccessibilityResult,
    StateAsyncRetry,
    CognitiveConfig,
    # Ham
    analyze_ham,
    HamResult,
    GoldenTest,
    CriticalPath,
)

# ============================================================
# Simplex
# ============================================================
from .simplex import (
    # Normalizer
    normalize_to_simplex,
    results_to_sandwich,
    calculate_deviation,
    is_in_equilibrium,
    Deviation,
    # Labeler
    get_dominant_label,
    label_module,
    LabelResult,
    # Equilibrium
    calculate_energy,
    calculate_gradients,
    check_equilibrium,
    suggest_next_step,
    GradientDirection,
    EquilibriumStatus,
)

# ============================================================
# Canonical
# ============================================================
# 모듈 타입은 __architecture_role__으로 명시적 선언 (추정 없음)

# ============================================================
# Gate
# ============================================================
from .gate import (
    check_mvp_gate,
    check_production_gate,
    GateResult,
    BreadGateResult,
    CheeseGateResult,
    HamGateResult,
)

# ============================================================
# Budget
# ============================================================
from .budget import (
    check_budget,
    get_budget,
    calculate_delta,
    BudgetCheckResult,
    BudgetViolation,
    Delta,
)

# ============================================================
# Recommend
# ============================================================
from .recommend import (
    suggest_refactor,
    get_priority_action,
    check_degradation,
    Recommendation,
    DegradationResult,
)

# ============================================================
# Protected
# ============================================================
from .protected import (
    is_protected,
    check_protected,
    check_pr_for_protected_changes,
    ProtectionCheckResult,
)


# ============================================================
# High-level API
# ============================================================

def analyze_sandwich(
    source: str,
    file_path: str | None = None,
    test_sources: dict[str, str] | None = None,
    architecture_role: ArchitectureRole | None = None,
) -> "ModuleAnalysis":
    """
    🍞🧀🥓 전체 분석 실행

    Args:
        source: Python 소스 코드
        file_path: 파일 경로 (선택)
        test_sources: 테스트 파일들 {path: source} (선택)
        architecture_role: 모듈 타입 (__architecture_role__ 선언값 사용, 미제공시 기본값)

    Returns:
        ModuleAnalysis: 분석 결과
    """
    from dataclasses import dataclass

    # 모듈 타입: 명시적 제공 또는 기본값
    if architecture_role is None:
        architecture_role = DEFAULT_MODULE_TYPE

    # 3축 분석
    bread_result = analyze_bread(source, file_path)
    cheese_result = analyze_cognitive(source)
    ham_result = analyze_ham(source, file_path, test_sources)

    # Simplex 정규화
    sandwich = results_to_sandwich(bread_result, cheese_result, ham_result)

    # Canonical 프로파일
    profile = get_canonical_profile(architecture_role)
    deviation = calculate_deviation(sandwich, profile.canonical)

    # 라벨링
    label_result = label_module(sandwich)

    # 균형 상태
    eq_status = check_equilibrium(sandwich, profile)

    # 권장사항
    recommendations = suggest_refactor(sandwich, architecture_role, cheese_result)

    @dataclass
    class ModuleAnalysis:
        """모듈 분석 결과"""
        path: str | None
        architecture_role: ArchitectureRole
        current: SandwichScore
        canonical: SandwichScore
        deviation: Deviation
        label: Axis
        in_equilibrium: bool
        energy: float
        bread: BreadResult
        cheese: CognitiveAnalysis
        ham: HamResult
        recommendations: list[Recommendation]

    return ModuleAnalysis(
        path=file_path,
        architecture_role=architecture_role,
        current=sandwich,
        canonical=profile.canonical,
        deviation=deviation,
        label=label_result.dominant,
        in_equilibrium=eq_status.in_equilibrium,
        energy=eq_status.energy,
        bread=bread_result,
        cheese=cheese_result,
        ham=ham_result,
        recommendations=recommendations,
    )


__all__ = [
    # Version
    "__version__",
    # Types
    "Axis",
    "AxisLiteral",
    "ArchitectureRole",
    "ArchitectureRoleLiteral",
    "SandwichScore",
    "RawScores",
    "RawBreadScore",
    "RawCheeseScore",
    "RawHamScore",
    "CanonicalProfile",
    "ChangeBudget",
    "Threshold",
    "CANONICAL_PROFILES",
    "get_canonical_profile",
    # Analyzers
    "analyze_bread",
    "BreadResult",
    "TrustBoundary",
    "SecretPattern",
    "analyze_cognitive",
    "is_cognitively_accessible",
    "CognitiveAnalysis",
    "AccessibilityResult",
    "StateAsyncRetry",
    "CognitiveConfig",
    "analyze_ham",
    "HamResult",
    "GoldenTest",
    "CriticalPath",
    # Simplex
    "normalize_to_simplex",
    "results_to_sandwich",
    "calculate_deviation",
    "is_in_equilibrium",
    "Deviation",
    "get_dominant_label",
    "label_module",
    "LabelResult",
    "calculate_energy",
    "calculate_gradients",
    "check_equilibrium",
    "suggest_next_step",
    "GradientDirection",
    "EquilibriumStatus",
    # Canonical
    "DEFAULT_MODULE_TYPE",
    # Gate
    "check_mvp_gate",
    "check_production_gate",
    "GateResult",
    "BreadGateResult",
    "CheeseGateResult",
    "HamGateResult",
    # Budget
    "check_budget",
    "get_budget",
    "calculate_delta",
    "BudgetCheckResult",
    "BudgetViolation",
    "Delta",
    # Recommend
    "suggest_refactor",
    "get_priority_action",
    "check_degradation",
    "Recommendation",
    "DegradationResult",
    # Protected
    "is_protected",
    "check_protected",
    "check_pr_for_protected_changes",
    "ProtectionCheckResult",
    # High-level
    "analyze_sandwich",
]
