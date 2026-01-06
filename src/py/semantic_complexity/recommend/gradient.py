"""
Gradient-based Recommender

균형점으로 향하는 리팩토링 권장사항 생성
"""

__architecture_role__ = "lib/domain"

from dataclasses import dataclass
from typing import Literal

from ..types import Axis, ArchitectureRole, SandwichScore, get_canonical_profile
from ..simplex import (
    GradientDirection,
    EquilibriumStatus,
    check_equilibrium,
    calculate_deviation,
)
from ..analyzers import CognitiveAnalysis


@dataclass
class Recommendation:
    """리팩토링 권장사항"""
    axis: Axis
    priority: int  # 1 = 최우선
    action: str
    reason: str
    expected_impact: dict[str, float]  # {"🍞": -5, "🧀": +3, ...}
    target_equilibrium: bool  # True면 균형점 방향


# ============================================================
# 축별 리팩토링 액션
# ============================================================

BREAD_ACTIONS = {
    "increase": [
        ("신뢰 경계 명시적 정의 추가", "Trust boundary를 코드에 명시적으로 표현"),
        ("인증/인가 데코레이터 적용", "엔드포인트에 @authenticated 등 적용"),
        ("입력 유효성 검사 추가", "외부 입력에 대한 검증 로직 추가"),
    ],
    "decrease": [
        ("보안 로직 분리", "비즈니스 로직에서 보안 로직 분리"),
        ("공통 보안 미들웨어로 추출", "반복되는 보안 로직을 미들웨어로"),
    ],
}

CHEESE_ACTIONS = {
    "increase": [
        # 🧀 increase는 드문 케이스 (복잡도가 너무 낮음)
        ("적절한 에러 핸들링 추가", "예외 상황 처리 로직 추가"),
    ],
    "decrease": [
        ("중첩 평탄화 (early return)", "깊은 중첩을 early return으로 평탄화"),
        ("함수 추출 (Extract Function)", "복잡한 블록을 별도 함수로 추출 (파라미터 묶기 금지)"),
        ("조건 단순화", "복잡한 조건을 명명된 변수로 분리"),
        ("상태 분리", "state×async×retry 분리"),
        ("Switch → 다형성", "switch/match를 Strategy 패턴으로"),
    ],
}

# 🚫 Anti-pattern 경고 (LLM이 사용하면 안 되는 편법)
CHEESE_ANTI_PATTERNS = [
    ("*args/**kwargs 사용 금지", "*args, **kwargs로 파라미터 숨기기는 복잡도 회피 편법"),
    ("Config 객체 bundling 금지", "관련 없는 파라미터를 config 객체로 묶지 말 것"),
    ("Tuple/Dict 파라미터 금지", "params: tuple, options: dict 형태로 의미 숨기기 금지"),
    ("인라인 치환 금지", "명명된 변수를 인라인 표현식으로 대체하지 말 것"),
]

HAM_ACTIONS = {
    "increase": [
        ("Golden test 추가", "Critical path에 대한 golden test 작성"),
        ("Contract test 추가", "API 계약 테스트 작성"),
        ("Test fixture 정리", "테스트 코드 구조화"),
    ],
    "decrease": [
        # 🥓 decrease는 드문 케이스 (테스트가 너무 많음?!)
        ("중복 테스트 정리", "불필요한 중복 테스트 제거"),
    ],
}

AXIS_ACTIONS = {
    Axis.BREAD: BREAD_ACTIONS,
    Axis.CHEESE: CHEESE_ACTIONS,
    Axis.HAM: HAM_ACTIONS,
}


class GradientRecommender:
    """Gradient 기반 권장사항 생성기"""

    def __init__(
        self,
        current: SandwichScore,
        architecture_role: ArchitectureRole,
        cognitive_result: CognitiveAnalysis | None = None,
    ):
        self.current = current
        self.architecture_role = architecture_role
        self.profile = get_canonical_profile(architecture_role)
        self.cognitive_result = cognitive_result

    def recommend(self, max_recommendations: int = 3) -> list[Recommendation]:
        """
        리팩토링 권장사항 생성

        Args:
            max_recommendations: 최대 권장사항 수

        Returns:
            우선순위순 정렬된 권장사항 리스트
        """
        status = check_equilibrium(self.current, self.profile)

        if status.in_equilibrium:
            return []  # 이미 균형

        recommendations: list[Recommendation] = []

        for i, gradient in enumerate(status.gradients[:max_recommendations]):
            rec = self._create_recommendation(gradient, priority=i + 1)
            if rec:
                recommendations.append(rec)

        # state×async×retry 위반 시 추가 권장사항
        if self.cognitive_result and self.cognitive_result.state_async_retry.violated:
            recommendations.insert(0, Recommendation(
                axis=Axis.CHEESE,
                priority=0,  # 최우선
                action="state×async×retry 분리",
                reason="인지 불변조건 위반 - 상태, 비동기, 재시도 로직을 분리해야 함",
                expected_impact={"🧀": -20.0},
                target_equilibrium=True,
            ))

        return recommendations

    def _create_recommendation(
        self,
        gradient: GradientDirection,
        priority: int,
    ) -> Recommendation | None:
        """Gradient에서 권장사항 생성"""
        actions = AXIS_ACTIONS.get(gradient.axis, {})
        direction_actions = actions.get(gradient.direction, [])

        if not direction_actions:
            return None

        action, reason = direction_actions[0]

        # Expected impact 계산
        impact_value = -gradient.magnitude if gradient.direction == "decrease" else gradient.magnitude
        impact = {str(gradient.axis): impact_value}

        return Recommendation(
            axis=gradient.axis,
            priority=priority,
            action=action,
            reason=reason,
            expected_impact=impact,
            target_equilibrium=True,
        )


# ============================================================
# 공개 API
# ============================================================

def suggest_refactor(
    current: SandwichScore,
    architecture_role: ArchitectureRole,
    cognitive_result: CognitiveAnalysis | None = None,
    max_recommendations: int = 3,
) -> list[Recommendation]:
    """
    리팩토링 권장사항 생성

    Args:
        current: 현재 SandwichScore
        architecture_role: 모듈 타입
        cognitive_result: Cognitive 분석 결과 (인지 가능 여부)
        max_recommendations: 최대 권장사항 수

    Returns:
        우선순위순 정렬된 권장사항 리스트
    """
    recommender = GradientRecommender(current, architecture_role, cognitive_result)
    return recommender.recommend(max_recommendations)


def get_priority_action(
    current: SandwichScore,
    architecture_role: ArchitectureRole,
) -> Recommendation | None:
    """
    가장 우선순위 높은 액션 반환

    Args:
        current: 현재 SandwichScore
        architecture_role: 모듈 타입

    Returns:
        최우선 권장사항 또는 None (이미 균형)
    """
    recommendations = suggest_refactor(current, architecture_role, max_recommendations=1)
    return recommendations[0] if recommendations else None


# ============================================================
# 인지 저하 탐지
# ============================================================

@dataclass
class DegradationResult:
    """인지 저하 탐지 결과"""
    degraded: bool
    severity: Literal["none", "mild", "moderate", "severe"]
    indicators: list[str]
    before_accessible: bool
    after_accessible: bool
    delta_nesting: int
    delta_hidden_deps: int
    delta_violations: int


def check_degradation(
    before: CognitiveAnalysis,
    after: CognitiveAnalysis,
) -> DegradationResult:
    """
    인지 저하 탐지 - 코드 변경이 인지성을 악화시켰는지 확인

    WHEN TO USE:
    - PR 리뷰 시 인지성 악화 여부 확인
    - 리팩토링 전후 비교
    - 기술 부채 추적

    저하 지표:
    1. accessible True → False 전환
    2. 중첩 깊이 증가
    3. 숨겨진 의존성 증가
    4. state×async×retry 위반 발생

    Args:
        before: 변경 전 CognitiveAnalysis
        after: 변경 후 CognitiveAnalysis

    Returns:
        DegradationResult: 저하 여부 및 심각도
    """
    indicators: list[str] = []

    # 1. 인지 가능 상태 전환
    accessibility_lost = before.accessible and not after.accessible
    if accessibility_lost:
        indicators.append("인지 가능 상태 상실 (accessible: True → False)")

    # 2. 중첩 깊이 증가
    delta_nesting = after.max_nesting - before.max_nesting
    if delta_nesting > 0:
        indicators.append(f"중첩 깊이 증가: +{delta_nesting} ({before.max_nesting} → {after.max_nesting})")

    # 3. 숨겨진 의존성 증가
    delta_hidden = len(after.hidden_dependencies) - len(before.hidden_dependencies)
    if delta_hidden > 0:
        indicators.append(f"숨겨진 의존성 증가: +{delta_hidden}")

    # 4. state×async×retry 위반 발생
    sar_before = before.state_async_retry.violated
    sar_after = after.state_async_retry.violated
    if not sar_before and sar_after:
        indicators.append(f"state×async×retry 위반 발생: {' × '.join(after.state_async_retry.axes)}")

    # 5. 위반 사항 증가
    delta_violations = len(after.violations) - len(before.violations)
    if delta_violations > 0:
        indicators.append(f"위반 사항 증가: +{delta_violations}")

    # 심각도 판정
    severity: Literal["none", "mild", "moderate", "severe"]
    if not indicators:
        severity = "none"
    elif accessibility_lost:
        severity = "severe"
    elif len(indicators) >= 3:
        severity = "severe"
    elif len(indicators) >= 2:
        severity = "moderate"
    else:
        severity = "mild"

    return DegradationResult(
        degraded=len(indicators) > 0,
        severity=severity,
        indicators=indicators,
        before_accessible=before.accessible,
        after_accessible=after.accessible,
        delta_nesting=delta_nesting,
        delta_hidden_deps=delta_hidden,
        delta_violations=delta_violations,
    )
