"""
MCP Server for semantic-complexity

Ham Sandwich Theorem 기반 코드 복잡도 분석기

3축 메타포:
- Bread (Security): 신뢰 경계, 인증, 암호화
- Cheese (Cognitive): 인지 가능 여부 - 사람과 LLM이 이해할 수 있는가?
- Ham (Behavioral): 행동 보존 - Golden test, Contract test
"""

__module_type__ = "app"

from mcp.server.fastmcp import FastMCP

mcp = FastMCP(name="semantic-complexity")


@mcp.tool()
def analyze_sandwich(source: str, file_path: str | None = None) -> dict:
    """
    Python 코드의 전체 복잡도 분석 (Bread + Cheese + Ham 3축)

    WHEN TO USE:
    - 코드 품질을 종합적으로 평가할 때
    - 리팩토링 우선순위를 결정할 때
    - 코드 리뷰 시 복잡도 기준 확인할 때

    OUTPUT 해석:
    - in_equilibrium=True: 3축 균형 상태 (좋음)
    - energy < 0.1: 안정적
    - recommendations: 우선순위별 개선 제안

    Args:
        source: Python 소스 코드 문자열
        file_path: 파일 경로 (선택, 컨텍스트용)
    """
    from semantic_complexity import analyze_sandwich as _analyze

    result = _analyze(source, file_path)

    return {
        "path": result.path,
        "module_type": str(result.module_type),
        "current": {
            "bread": result.current.bread,
            "cheese": result.current.cheese,
            "ham": result.current.ham,
        },
        "canonical": {
            "bread": result.canonical.bread,
            "cheese": result.canonical.cheese,
            "ham": result.canonical.ham,
        },
        "deviation": {
            "bread": result.deviation.bread,
            "cheese": result.deviation.cheese,
            "ham": result.deviation.ham,
            "distance": result.deviation.distance,
        },
        "label": str(result.label),
        "in_equilibrium": result.in_equilibrium,
        "energy": result.energy,
        "recommendations": [
            {"action": r.action, "priority": r.priority, "axis": str(r.axis)}
            for r in result.recommendations[:5]
        ],
    }


@mcp.tool()
def analyze_cheese(source: str) -> dict:
    """
    Cheese(인지 가능성) 분석 - 사람과 LLM이 코드를 이해할 수 있는가?

    WHEN TO USE:
    - 코드가 너무 복잡해서 이해하기 어려울 때
    - "이 코드 읽기 힘들다" 느낌이 들 때
    - 새 팀원이 코드를 이해하는 데 오래 걸릴 때

    4가지 인지 가능 조건:
    1. 중첩 깊이 <= 4 (if/for/while 등)
    2. 함수당 개념 수 <= 5 (Miller's Law: 7±2)
    3. 숨겨진 의존성 <= 2 (global, 환경변수, I/O 등)
    4. state × async × retry 2개 이상 공존 금지

    OUTPUT 해석:
    - accessible=True: 인지 가능 (좋음)
    - accessible=False: violations 배열에서 원인 확인

    Args:
        source: Python 소스 코드 문자열
    """
    from semantic_complexity import analyze_cognitive

    result = analyze_cognitive(source)

    return {
        "accessible": result.accessible,
        "reason": result.reason,
        "violations": result.violations,
        "max_nesting": result.max_nesting,
        "hidden_dependencies": result.hidden_dependencies,
        "state_async_retry": {
            "state": result.state_async_retry.has_state,
            "async": result.state_async_retry.has_async,
            "retry": result.state_async_retry.has_retry,
            "violated": result.state_async_retry.violated,
        },
    }


@mcp.tool()
def check_gate(
    source: str,
    file_path: str | None = None,
    gate_type: str = "mvp",
    test_dir: str | None = None,
) -> dict:
    """
    릴리스 Gate 검사 - MVP 또는 Production 출시 가능 여부 판정

    WHEN TO USE:
    - PoC → MVP 전환 시점에 준비도 확인
    - MVP → Production 배포 전 품질 검증
    - CI/CD 파이프라인에서 품질 게이트로 사용

    MVP Gate 조건:
    - Bread: 신뢰 경계 정의됨, 인증 흐름 명시적
    - Cheese: 인지 가능 (accessible=True)
    - Ham: Golden test 커버리지 >= 80%

    Production Gate 조건 (더 엄격):
    - MVP 조건 모두 충족
    - Ham: Golden test 커버리지 >= 95%

    OUTPUT 해석:
    - passed=True: Gate 통과, 출시 가능
    - passed=False: summary에서 실패 원인 확인

    Args:
        source: Python 소스 코드 문자열
        file_path: 파일 경로 (선택, 테스트 파일 자동 탐색에 사용)
        gate_type: "mvp" 또는 "production"
        test_dir: 테스트 디렉토리 경로 (선택, 없으면 자동 탐색)
    """
    from semantic_complexity import (
        analyze_bread, analyze_cognitive, analyze_ham,
        check_mvp_gate, check_production_gate,
    )
    from semantic_complexity.analyzers.test_discovery import discover_tests

    # 테스트 파일 자동 탐색
    test_sources = discover_tests(file_path)

    bread = analyze_bread(source, file_path)
    cheese = analyze_cognitive(source)
    ham = analyze_ham(source, file_path, test_sources)

    if gate_type == "production":
        result = check_production_gate(bread, cheese, ham)
    else:
        result = check_mvp_gate(bread, cheese, ham)

    return {
        "gate": result.gate,
        "passed": result.passed,
        "sandwich_formed": result.sandwich_formed,
        "summary": result.summary,
        "bread": {
            "passed": result.bread.passed,
            "trust_boundary_defined": result.bread.trust_boundary_defined,
            "auth_flow_fixed": result.bread.auth_flow_fixed,
            "violations": result.bread.violations,
        },
        "cheese": {
            "passed": result.cheese.passed,
            "accessible": result.cheese.accessible,
            "max_nesting": result.cheese.max_nesting,
            "violations": result.cheese.state_async_retry_violations + result.cheese.concept_violations,
        },
        "ham": {
            "passed": result.ham.passed,
            "golden_test_coverage": result.ham.golden_test_coverage,
            "unprotected_paths": result.ham.unprotected_paths,
        },
        "test_files_found": list(test_sources.keys()),
    }


@mcp.tool()
def suggest_refactor(source: str, module_type: str | None = None) -> list[dict]:
    """
    리팩토링 권장사항 - 코드 개선을 위한 구체적 액션 제안

    WHEN TO USE:
    - analyze_sandwich 또는 analyze_cheese 결과가 나쁠 때
    - "어떻게 고쳐야 하지?" 질문에 답할 때
    - 리팩토링 우선순위를 정할 때

    모듈 타입별 다른 기준 적용:
    - api/external: 보안(Bread) 중시
    - lib/domain: 인지성(Cheese) 중시
    - app: 균형 중시

    OUTPUT:
    - priority 1이 가장 시급
    - axis: 어떤 축(bread/cheese/ham)을 개선하는 액션인지
    - action: 구체적 리팩토링 액션

    Args:
        source: Python 소스 코드 문자열
        module_type: 모듈 타입 (예: "api/external", "lib/domain", "app")
    """
    from semantic_complexity import (
        analyze_cognitive,
        suggest_refactor as _suggest,
        ModuleType,
        DEFAULT_MODULE_TYPE,
    )
    from semantic_complexity.simplex import results_to_sandwich
    from semantic_complexity.analyzers import analyze_bread, analyze_ham

    bread = analyze_bread(source)
    cheese = analyze_cognitive(source)
    ham = analyze_ham(source)

    sandwich = results_to_sandwich(bread, cheese, ham)

    if module_type:
        mt = ModuleType.from_string(module_type)
    else:
        mt = DEFAULT_MODULE_TYPE

    recommendations = _suggest(sandwich, mt, cheese)

    return [
        {
            "action": r.action,
            "priority": r.priority,
            "axis": str(r.axis),
            "reason": r.reason,
        }
        for r in recommendations
    ]


@mcp.tool()
def check_budget(
    before_source: str,
    after_source: str,
    module_type: str | None = None,
) -> dict:
    """
    PR 변경 예산 검사 - 한 PR에서 허용되는 복잡도 증가량 검증

    WHEN TO USE:
    - PR 리뷰 시 변경량이 적절한지 확인
    - "이 PR이 너무 큰가?" 판단할 때
    - CI에서 복잡도 증가 제한 게이트로 사용

    모듈 타입별 예산:
    | 타입         | ΔCognitive | ΔState | Breaking |
    |--------------|------------|--------|----------|
    | api/external | ≤ 3        | ≤ 1    | NO       |
    | lib/domain   | ≤ 5        | ≤ 2    | ADR 필요 |
    | app          | ≤ 8        | ≤ 3    | N/A      |

    OUTPUT 해석:
    - passed=True: 예산 내 변경
    - passed=False: violations에서 초과 항목 확인

    Args:
        before_source: 변경 전 소스 코드
        after_source: 변경 후 소스 코드
        module_type: 모듈 타입 (예: "api/external")
    """
    from semantic_complexity import (
        analyze_cognitive,
        check_budget as _check_budget,
        calculate_delta,
        ModuleType,
        DEFAULT_MODULE_TYPE,
    )

    before = analyze_cognitive(before_source)
    after = analyze_cognitive(after_source)
    delta = calculate_delta(before, after)

    if module_type:
        mt = ModuleType.from_string(module_type)
    else:
        mt = DEFAULT_MODULE_TYPE

    result = _check_budget(mt, delta)

    return {
        "passed": result.passed,
        "module_type": str(result.module_type),
        "summary": result.summary,
        "delta": {
            "cognitive": result.delta_cognitive,
            "state_transitions": result.delta_state_transitions,
            "public_api": result.delta_public_api,
            "breaking_changes": result.has_breaking_changes,
        },
        "violations": [
            {"dimension": v.dimension, "allowed": v.allowed, "actual": v.actual}
            for v in result.violations
        ],
    }


@mcp.tool()
def get_label(source: str) -> dict:
    """
    모듈의 지배 축 라벨 반환 - 이 코드가 어떤 성격인지 판단

    WHEN TO USE:
    - 코드가 보안/인지/행동 중 어느 쪽에 치우쳐 있는지 확인
    - 모듈 분류/정리 시 참고
    - 아키텍처 리뷰 시 모듈 성격 파악

    라벨 의미:
    - Bread: 보안 중심 (인증, 암호화, 권한)
    - Cheese: 인지 중심 (복잡한 비즈니스 로직)
    - Ham: 행동 중심 (테스트, 검증 로직)

    Args:
        source: Python 소스 코드 문자열

    Returns:
        지배 축 라벨 및 점수
    """
    from semantic_complexity import analyze_sandwich
    from semantic_complexity.simplex import label_module

    result = analyze_sandwich(source)
    label_result = label_module(result.current)

    return {
        "dominant": str(label_result.dominant),
        "confidence": label_result.confidence,
        "scores": {
            "bread": result.current.bread,
            "cheese": result.current.cheese,
            "ham": result.current.ham,
        },
        "interpretation": _interpret_label(label_result.dominant),
    }


def _interpret_label(axis) -> str:
    """라벨 해석"""
    from semantic_complexity import Axis
    interpretations = {
        Axis.BREAD: "보안/인증 중심 모듈 - Trust boundary, 권한 검사 등이 주요 관심사",
        Axis.CHEESE: "인지/복잡도 중심 모듈 - 비즈니스 로직, 알고리즘이 주요 관심사",
        Axis.HAM: "행동/테스트 중심 모듈 - 검증, 테스트, 계약이 주요 관심사",
    }
    return interpretations.get(axis, "알 수 없음")


@mcp.tool()
def check_degradation(
    before_source: str,
    after_source: str,
) -> dict:
    """
    인지 저하 탐지 - 코드 변경이 인지성을 악화시켰는지 확인

    WHEN TO USE:
    - PR 리뷰 시 "이 변경이 코드를 더 복잡하게 만들었나?"
    - 리팩토링 전후 비교
    - 기술 부채 모니터링

    저하 지표:
    1. accessible True → False 전환 (심각)
    2. 중첩 깊이 증가
    3. 숨겨진 의존성 증가
    4. state×async×retry 위반 발생

    심각도:
    - none: 저하 없음
    - mild: 경미한 저하
    - moderate: 보통 저하
    - severe: 심각한 저하

    Args:
        before_source: 변경 전 소스 코드
        after_source: 변경 후 소스 코드

    Returns:
        저하 여부, 심각도, 지표 목록
    """
    from semantic_complexity import analyze_cognitive, check_degradation as _check

    before = analyze_cognitive(before_source)
    after = analyze_cognitive(after_source)
    result = _check(before, after)

    return {
        "degraded": result.degraded,
        "severity": result.severity,
        "indicators": result.indicators,
        "before_accessible": result.before_accessible,
        "after_accessible": result.after_accessible,
        "delta": {
            "nesting": result.delta_nesting,
            "hidden_deps": result.delta_hidden_deps,
            "violations": result.delta_violations,
        },
    }


def main():
    """Run MCP server"""
    mcp.run()


if __name__ == "__main__":
    main()
