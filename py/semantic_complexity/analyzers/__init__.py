"""
🍞🧀🥓 3축 분석기

- 🍞 Bread (Security): 보안 구조 안정성
- 🧀 Cheese (Cognitive): 인지 가능 여부 판정
- 🥓 Ham (Behavioral): 행동 보존 및 유지보수성
"""

__module_type__ = "lib/domain"

from .bread import analyze_bread, BreadResult, TrustBoundary, SecretPattern
from .cheese import (
    # 핵심 API
    analyze_cognitive,
    is_cognitively_accessible,
    # 결과 타입
    CognitiveAnalysis,
    AccessibilityResult,
    StateAsyncRetry,
    FunctionInfo,
    CognitiveConfig,
    # 개별 분석 함수
    calculate_max_nesting,
    extract_functions,
    detect_hidden_dependencies,
    check_state_async_retry,
)
from .ham import analyze_ham, HamResult, GoldenTest, CriticalPath

__all__ = [
    # Bread
    "analyze_bread",
    "BreadResult",
    "TrustBoundary",
    "SecretPattern",
    # Cheese
    "analyze_cognitive",
    "is_cognitively_accessible",
    "CognitiveAnalysis",
    "AccessibilityResult",
    "StateAsyncRetry",
    "FunctionInfo",
    "CognitiveConfig",
    "calculate_max_nesting",
    "extract_functions",
    "detect_hidden_dependencies",
    "check_state_async_retry",
    # Ham
    "analyze_ham",
    "HamResult",
    "GoldenTest",
    "CriticalPath",
]
