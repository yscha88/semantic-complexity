"""
🧀 Cheese Analyzer - 인지 가능 여부 판정

정의:
    🧀 Cheese = 사람과 LLM이 인지할 수 있는 범위 내에 있는가?

인지 가능 조건 (4가지 모두 충족):
    1. 중첩 깊이 ≤ N (설정 가능)
    2. 개념 수 ≤ 5개/함수 (Working Memory 한계)
    3. 숨겨진 의존성 최소화
    4. state×async×retry 2개 이상 공존 금지

근거:
    - Miller's Law: 7±2 개념 동시 처리 한계
    - 중첩: 한눈에 구조 파악 가능 범위
    - 숨겨진 의존성: 컨텍스트 완결성
    - state×async×retry: 동시 추론 불가

참조:
    - docs/SDS.ko.md 섹션 3.1
    - docs/THEORY.ko.md 섹션 1
"""

import ast
import re
from dataclasses import dataclass, field
from typing import NamedTuple


# ============================================================
# 설정
# ============================================================

@dataclass(frozen=True)
class CognitiveConfig:
    """인지 가능 판정 설정"""
    nesting_threshold: int = 4          # 중첩 깊이 임계값
    concepts_per_function: int = 5      # 함수당 개념 수 한계
    hidden_dep_threshold: int = 2       # 숨겨진 의존성 허용 수


DEFAULT_CONFIG = CognitiveConfig()


# ============================================================
# 결과 타입
# ============================================================

class AccessibilityResult(NamedTuple):
    """인지 가능 여부 판정 결과"""
    accessible: bool      # 인지 가능 여부
    reason: str           # 판정 사유
    violations: list[str] # 위반 목록


@dataclass
class StateAsyncRetry:
    """state×async×retry 불변조건"""
    has_state: bool = False
    has_async: bool = False
    has_retry: bool = False

    @property
    def count(self) -> int:
        """활성화된 축 수"""
        return sum([self.has_state, self.has_async, self.has_retry])

    @property
    def violated(self) -> bool:
        """2개 이상이면 위반"""
        return self.count >= 2

    @property
    def axes(self) -> list[str]:
        """활성화된 축 목록"""
        result = []
        if self.has_state:
            result.append("state")
        if self.has_async:
            result.append("async")
        if self.has_retry:
            result.append("retry")
        return result


@dataclass
class FunctionInfo:
    """함수 정보"""
    name: str
    lineno: int
    concept_count: int
    concepts: list[str]


@dataclass
class CognitiveAnalysis:
    """전체 분석 결과"""
    accessible: bool
    reason: str
    violations: list[str]

    # 세부 분석
    max_nesting: int
    functions: list[FunctionInfo]
    hidden_dependencies: list[str]
    state_async_retry: StateAsyncRetry

    # 설정
    config: CognitiveConfig


# ============================================================
# 조건 1: 중첩 깊이 계산
# ============================================================

class NestingVisitor(ast.NodeVisitor):
    """중첩 깊이 계산 (AST 방문자)"""

    # 깊이 증가 노드
    NESTING_NODES = (
        ast.If,
        ast.For,
        ast.While,
        ast.With,
        ast.Try,
        ast.ExceptHandler,
        ast.FunctionDef,
        ast.AsyncFunctionDef,
        ast.ClassDef,
        ast.Lambda,
        ast.ListComp,
        ast.DictComp,
        ast.SetComp,
        ast.GeneratorExp,
    )

    def __init__(self):
        self.current_depth = 0
        self.max_depth = 0

    def generic_visit(self, node: ast.AST) -> None:
        if isinstance(node, self.NESTING_NODES):
            self.current_depth += 1
            self.max_depth = max(self.max_depth, self.current_depth)

        super().generic_visit(node)

        if isinstance(node, self.NESTING_NODES):
            self.current_depth -= 1


def calculate_max_nesting(source: str) -> int:
    """
    코드의 최대 중첩 깊이 계산

    Args:
        source: Python 소스 코드

    Returns:
        최대 중첩 깊이
    """
    try:
        tree = ast.parse(source)
        visitor = NestingVisitor()
        visitor.visit(tree)
        return visitor.max_depth
    except SyntaxError:
        return 0


# ============================================================
# 조건 2: 개념 수 계산
# ============================================================

class ConceptVisitor(ast.NodeVisitor):
    """함수당 개념 수 계산

    개념(Concept)의 정의:
    - 변수/파라미터: 추적해야 할 상태
    - 함수 호출: 이해해야 할 동작
    - 조건문/분기: 고려해야 할 경로
    - 반환값: 결과 추적
    """

    def __init__(self):
        self.functions: list[FunctionInfo] = []
        self._current_concepts: list[str] = []
        self._current_name: str = ""
        self._current_lineno: int = 0

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        self._analyze_function(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        self._analyze_function(node)

    def _analyze_function(
        self,
        node: ast.FunctionDef | ast.AsyncFunctionDef,
    ) -> None:
        """함수의 개념 수 분석"""
        self._current_name = node.name
        self._current_lineno = node.lineno
        self._current_concepts = []

        # 1. 파라미터 (각각 개념)
        for arg in node.args.args:
            self._current_concepts.append(f"param:{arg.arg}")

        # 2. 지역 변수
        for stmt in ast.walk(node):
            if isinstance(stmt, ast.Assign):
                for target in stmt.targets:
                    if isinstance(target, ast.Name):
                        concept = f"var:{target.id}"
                        if concept not in self._current_concepts:
                            self._current_concepts.append(concept)

        # 3. 함수 호출 (고유한 것만)
        calls = set()
        for stmt in ast.walk(node):
            if isinstance(stmt, ast.Call):
                call_name = self._get_call_name(stmt)
                if call_name and call_name not in calls:
                    calls.add(call_name)
                    self._current_concepts.append(f"call:{call_name}")

        # 4. 제어 흐름 (분기점)
        for stmt in ast.walk(node):
            if isinstance(stmt, (ast.If, ast.Match)):
                self._current_concepts.append("control:branch")
                break

        # 5. 반환값 (여러 return이 있으면 하나만)
        for stmt in ast.walk(node):
            if isinstance(stmt, ast.Return) and stmt.value:
                self._current_concepts.append("return:value")
                break

        self.functions.append(FunctionInfo(
            name=self._current_name,
            lineno=self._current_lineno,
            concept_count=len(self._current_concepts),
            concepts=self._current_concepts.copy(),
        ))

        # 중첩 함수 처리
        self.generic_visit(node)

    def _get_call_name(self, node: ast.Call) -> str | None:
        """호출 함수명 추출"""
        if isinstance(node.func, ast.Name):
            return node.func.id
        if isinstance(node.func, ast.Attribute):
            return node.func.attr
        return None


def extract_functions(source: str) -> list[FunctionInfo]:
    """
    코드에서 함수 추출 및 개념 수 계산

    Args:
        source: Python 소스 코드

    Returns:
        함수 목록 (개념 수 포함)
    """
    try:
        tree = ast.parse(source)
        visitor = ConceptVisitor()
        visitor.visit(tree)
        return visitor.functions
    except SyntaxError:
        return []


def count_concepts(function: FunctionInfo) -> int:
    """함수의 개념 수 반환"""
    return function.concept_count


# ============================================================
# 조건 3: 숨겨진 의존성 탐지
# ============================================================

# 숨겨진 의존성 패턴
HIDDEN_DEPENDENCY_PATTERNS: list[tuple[str, str]] = [
    # Global state
    (r"\bglobal\s+\w+", "global variable"),

    # Environment
    (r"\bos\.environ", "os.environ access"),
    (r"\bgetenv\s*\(", "getenv() call"),
    (r"\bos\.getenv\s*\(", "os.getenv() call"),

    # Implicit I/O
    (r"\bopen\s*\(", "file I/O"),
    (r"\bprint\s*\(", "stdout write"),
    (r"\binput\s*\(", "stdin read"),

    # Implicit network
    (r"\brequests\.", "HTTP client"),
    (r"\burllib", "HTTP client"),
    (r"\bsocket\.", "socket I/O"),
    (r"\bhttpx\.", "HTTP client"),
    (r"\baiohttp\.", "async HTTP"),

    # Database
    (r"\bsqlalchemy\.", "database"),
    (r"\bpymongo\.", "database"),
    (r"\bpsycopg", "database"),
    (r"\bmysql\.", "database"),

    # Time/randomness (non-deterministic)
    (r"\bdatetime\.now\s*\(", "current time"),
    (r"\btime\.time\s*\(", "current time"),
    (r"\brandom\.", "randomness"),

    # Subprocess
    (r"\bsubprocess\.", "subprocess"),
    (r"\bos\.system\s*\(", "system call"),
    (r"\bos\.popen\s*\(", "system call"),
]


@dataclass
class HiddenDependency:
    """숨겨진 의존성"""
    pattern: str
    reason: str
    line: int | None = None


def detect_hidden_dependencies(source: str) -> list[HiddenDependency]:
    """
    숨겨진 의존성 탐지

    Args:
        source: Python 소스 코드

    Returns:
        탐지된 숨겨진 의존성 목록
    """
    found: list[HiddenDependency] = []
    seen_reasons: set[str] = set()

    for pattern, reason in HIDDEN_DEPENDENCY_PATTERNS:
        if reason in seen_reasons:
            continue

        match = re.search(pattern, source, re.IGNORECASE)
        if match:
            # 라인 번호 계산
            line_no = source[:match.start()].count("\n") + 1
            found.append(HiddenDependency(
                pattern=pattern,
                reason=reason,
                line=line_no,
            ))
            seen_reasons.add(reason)

    return found


# ============================================================
# 조건 4: state×async×retry 공존 검사
# ============================================================

# State 패턴
STATE_PATTERNS: list[str] = [
    r"\bself\.\w+\s*=",          # self.field =
    r"\bglobal\s+\w+",           # global 변수
    r"\.append\s*\(",            # 리스트 변이
    r"\.extend\s*\(",            # 리스트 변이
    r"\.update\s*\(",            # 딕셔너리 변이
    r"\.pop\s*\(",               # 컬렉션 변이
    r"\[\w+\]\s*=",              # 인덱스 할당
    r"\bnonlocal\s+",            # nonlocal 변수
]

# Async 패턴
ASYNC_PATTERNS: list[str] = [
    r"\basync\s+def",
    r"\bawait\s+",
    r"\basyncio\.",
    r"\.run_in_executor\s*\(",
    r"\bThreadPoolExecutor",
    r"\bProcessPoolExecutor",
    r"\bconcurrent\.futures",
    r"\bthreading\.",
    r"\bmultiprocessing\.",
]

# Retry 패턴
RETRY_PATTERNS: list[str] = [
    r"\bretry",
    r"\bbackoff",
    r"\battempt",
    r"\bmax_retries",
    r"\btenacity\.",
    r"\bretrying\.",
    r"for\s+_\s+in\s+range\s*\(\s*\d+\s*\)",  # for _ in range(N)
    r"while\s+.*<\s*\d+",                      # while count < N
]


def check_state_async_retry(source: str) -> StateAsyncRetry:
    """
    state×async×retry 공존 검사

    규칙: 3개 중 2개 이상이 같은 모듈에 공존하면 위반

    Args:
        source: Python 소스 코드

    Returns:
        StateAsyncRetry 결과
    """
    result = StateAsyncRetry()

    # State 탐지
    for pattern in STATE_PATTERNS:
        if re.search(pattern, source, re.IGNORECASE):
            result.has_state = True
            break

    # Async 탐지
    for pattern in ASYNC_PATTERNS:
        if re.search(pattern, source, re.IGNORECASE):
            result.has_async = True
            break

    # Retry 탐지
    for pattern in RETRY_PATTERNS:
        if re.search(pattern, source, re.IGNORECASE):
            result.has_retry = True
            break

    return result


# ============================================================
# 통합 판정 함수
# ============================================================

def is_cognitively_accessible(
    source: str,
    config: CognitiveConfig | None = None,
) -> AccessibilityResult:
    """
    인지 가능 여부 판정

    의사코드 (docs/SDS.ko.md 섹션 3.1.2):

        FUNCTION is_cognitively_accessible(code, config):
            # 조건 1: 중첩 깊이
            IF max_nesting > config.NESTING_THRESHOLD:
                RETURN (False, "중첩 깊이 초과")

            # 조건 2: 함수당 개념 수
            FOR each function:
                IF concept_count > 5:
                    RETURN (False, "개념 수 초과")

            # 조건 3: 숨겨진 의존성
            IF hidden_deps > config.HIDDEN_DEP_THRESHOLD:
                RETURN (False, "숨겨진 의존성 초과")

            # 조건 4: state×async×retry
            IF invariant.violated:
                RETURN (False, "state×async×retry 공존")

            RETURN (True, "인지 가능")

    Args:
        source: Python 소스 코드
        config: 판정 설정 (기본값: DEFAULT_CONFIG)

    Returns:
        AccessibilityResult: (accessible, reason, violations)
    """
    if config is None:
        config = DEFAULT_CONFIG

    violations: list[str] = []

    # 조건 1: 중첩 깊이 검사
    max_nesting = calculate_max_nesting(source)
    if max_nesting > config.nesting_threshold:
        violations.append(
            f"중첩 깊이 초과: {max_nesting} > {config.nesting_threshold}"
        )

    # 조건 2: 함수당 개념 수 검사
    functions = extract_functions(source)
    for func in functions:
        if func.concept_count > config.concepts_per_function:
            violations.append(
                f"개념 수 초과: {func.name}() = {func.concept_count}개 "
                f"(line {func.lineno})"
            )

    # 조건 3: 숨겨진 의존성 검사
    hidden_deps = detect_hidden_dependencies(source)
    if len(hidden_deps) > config.hidden_dep_threshold:
        deps_str = ", ".join(d.reason for d in hidden_deps)
        violations.append(
            f"숨겨진 의존성 초과: {len(hidden_deps)}개 ({deps_str})"
        )

    # 조건 4: state×async×retry 공존 검사
    invariant = check_state_async_retry(source)
    if invariant.violated:
        axes_str = " × ".join(invariant.axes)
        violations.append(
            f"state×async×retry 공존: {axes_str}"
        )

    # 최종 판정
    if violations:
        return AccessibilityResult(
            accessible=False,
            reason=violations[0],  # 첫 번째 위반 사유
            violations=violations,
        )

    return AccessibilityResult(
        accessible=True,
        reason="인지 가능",
        violations=[],
    )


def analyze_cognitive(
    source: str,
    config: CognitiveConfig | None = None,
) -> CognitiveAnalysis:
    """
    전체 인지 가능 분석 (세부 정보 포함)

    Args:
        source: Python 소스 코드
        config: 판정 설정

    Returns:
        CognitiveAnalysis: 전체 분석 결과
    """
    if config is None:
        config = DEFAULT_CONFIG

    # 개별 분석
    max_nesting = calculate_max_nesting(source)
    functions = extract_functions(source)
    hidden_deps = detect_hidden_dependencies(source)
    invariant = check_state_async_retry(source)

    # 통합 판정
    result = is_cognitively_accessible(source, config)

    return CognitiveAnalysis(
        accessible=result.accessible,
        reason=result.reason,
        violations=result.violations,
        max_nesting=max_nesting,
        functions=functions,
        hidden_dependencies=[d.reason for d in hidden_deps],
        state_async_retry=invariant,
        config=config,
    )
