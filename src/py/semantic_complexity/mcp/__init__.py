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

# Usage guide for LLM
USAGE_GUIDE = """# semantic-complexity 사용 가이드

## 개요
Ham Sandwich Theorem 기반 코드 복잡도 분석기입니다.
코드를 3가지 축으로 분석하여 균형 잡힌 품질을 측정합니다.

## 3축 모델 (Bread-Cheese-Ham)

### 🍞 Bread (보안성)
- Trust Boundary 정의 여부
- 인증/인가 명시성
- 시크릿 하드코딩 탐지
- 숨겨진 의존성 (환경변수, 파일I/O)

### 🧀 Cheese (인지 가능성)
- 중첩 깊이 (≤4 권장)
- 개념 수 (≤9개/함수, Miller's Law)
- state×async×retry 동시 사용 금지
- 숨겨진 의존성 최소화

### 🥓 Ham (행동 보존)
- 테스트 커버리지
- Golden Test 존재 여부
- Critical Path 보호율

## 도구 사용 시나리오

| 시나리오 | 도구 |
|----------|------|
| 코드 전체 품질 분석 | analyze_sandwich |
| 인지 복잡도만 확인 | analyze_cheese |
| PR 리뷰 시 품질 게이트 | check_gate |
| 리팩토링 방향 제안 | suggest_refactor |
| 코드 변경 전후 비교 | check_degradation |
| 변경 예산 초과 확인 | check_budget |
| 코드 특성 라벨링 | get_label |

## Gate 단계
- PoC: 빠른 검증, 느슨한 기준
- MVP: 첫 릴리스, 기본 기준
- Production: 운영, 엄격한 기준 + Waiver 지원

## 인지 복잡도 정의
인지 복잡도는 개발자가 코드를 읽고 이해하는 데 필요한 정신적 노력입니다.
- 중첩이 깊으면 컨텍스트 스택이 커짐
- 상태+비동기+재시도가 동시에 있으면 경우의 수 폭발
- 숨겨진 의존성은 예측 불가능한 부작용 유발
"""


@mcp.resource("docs://usage-guide")
def get_usage_guide() -> str:
    """semantic-complexity MCP 서버 사용 가이드"""
    return USAGE_GUIDE


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
    project_root: str | None = None,
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

    Essential Complexity Waiver (Production Gate만 적용):
    - 인라인: __essential_complexity__ 선언 + ADR 존재 시 면제
    - 외부: .waiver.json 파일로 프로젝트 레벨 waiver 관리
    - MVP Gate: waiver 불가 (처음부터 제대로 설계)
    - Production Gate: waiver 가능 (기술부채 허용)

    OUTPUT 해석:
    - passed=True: Gate 통과, 출시 가능
    - passed=False: summary에서 실패 원인 확인
    - cheese.waived: waiver 적용 여부 (Production Gate에서만)

    Args:
        source: Python 소스 코드 문자열
        file_path: 파일 경로 (선택, 테스트 파일 자동 탐색에 사용)
        gate_type: "mvp" 또는 "production"
        test_dir: 테스트 디렉토리 경로 (선택, 없으면 자동 탐색)
        project_root: 프로젝트 루트 (선택, .waiver.json 탐색 및 ADR 경로 해석에 사용)
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
        # Production Gate: waiver 가능 (source 전달 필요)
        result = check_production_gate(
            bread, cheese, ham,
            source=source,
            file_path=file_path,
            project_root=project_root,
        )
    else:
        # MVP Gate: waiver 불가
        result = check_mvp_gate(bread, cheese, ham)

    # Waiver 정보 (Production Gate에서만)
    waiver_info = None
    if result.cheese.waiver:
        waiver_info = {
            "applied": result.cheese.waived,
            "adr": result.cheese.waiver.adr_path,
            "source": "external" if result.cheese.waiver.external_waiver else "inline",
        }
        # 외부 waiver 상세 정보
        if result.cheese.waiver.external_waiver:
            ext = result.cheese.waiver.external_waiver
            waiver_info["external"] = {
                "pattern": ext.pattern,
                "justification": ext.justification,
                "approved_at": ext.approved_at,
                "expires_at": ext.expires_at,
                "approver": ext.approver,
            }

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
            "waived": result.cheese.waived,
        },
        "ham": {
            "passed": result.ham.passed,
            "golden_test_coverage": result.ham.golden_test_coverage,
            "unprotected_paths": result.ham.unprotected_paths,
        },
        "test_files_found": list(test_sources.keys()),
        "waiver": waiver_info,
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
