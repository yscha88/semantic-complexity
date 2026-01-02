"""
🍞🧀🥓 3축 타입 정의

Ham Sandwich Theorem 기반 복잡도 축:
- 🍞 Bread (Security): 구조 안정성
- 🧀 Cheese (Cognitive): 인지 밀도
- 🥓 Ham (Behavioral): 행동 보존
"""

__module_type__ = "types"

from enum import Enum
from typing import Literal


class Axis(str, Enum):
    """3축 열거형"""
    BREAD = "🍞"    # Security
    CHEESE = "🧀"   # Cognitive
    HAM = "🥓"      # Behavioral

    def __str__(self) -> str:
        return self.value


# 타입 힌트용 리터럴
AxisLiteral = Literal["🍞", "🧀", "🥓"]


# 축별 설명
AXIS_DESCRIPTIONS = {
    Axis.BREAD: {
        "name": "Security",
        "korean": "보안/구조",
        "description": "신뢰 경계, 인증, 암호, 배포 안정성",
        "measures": ["trust_boundary", "auth_flow", "secret_handling", "blast_radius"],
    },
    Axis.CHEESE: {
        "name": "Cognitive",
        "korean": "인지",
        "description": "인간/LLM이 이해 가능한 구조적 복잡도",
        "measures": ["cognitive_complexity", "nesting_depth", "hidden_coupling", "state_async_retry"],
    },
    Axis.HAM: {
        "name": "Behavioral",
        "korean": "행동",
        "description": "리팩토링 후 의미 보존, 테스트 커버리지",
        "measures": ["golden_test", "contract_test", "critical_path_coverage"],
    },
}
