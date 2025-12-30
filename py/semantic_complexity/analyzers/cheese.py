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

__module_type__ = "lib/domain"

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
    concepts_per_function: int = 9      # 함수당 개념 수 한계 (Miller's Law: 7±2)
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

    제외 항목 (인지 부하 거의 없음):
    - self/cls 파라미터: 클래스 메서드의 첫 번째 인자
    - Built-in 함수: str, int, len, tuple, list, dict 등
    """

    # Built-in 및 일반적 표준 라이브러리 함수 (인지 부하 거의 없음)
    BUILTIN_FUNCTIONS = frozenset({
        # Python built-in
        "str", "int", "float", "bool", "bytes", "bytearray",
        "len", "range", "enumerate", "zip", "map", "filter",
        "list", "dict", "set", "tuple", "frozenset",
        "type", "isinstance", "issubclass", "hasattr", "getattr", "setattr",
        "print", "repr", "hash", "id", "hex", "bin", "oct",
        "min", "max", "sum", "abs", "round", "pow", "divmod",
        "sorted", "reversed", "any", "all",
        "open", "iter", "next",
        "vars", "dir", "globals", "locals",
        # numpy 기본 변환 함수
        "array", "asarray", "asanyarray", "ascontiguousarray",
        "zeros", "ones", "empty", "full",
        "arange", "linspace", "logspace",
        "reshape", "ravel", "flatten", "squeeze", "expand_dims",
        "concatenate", "stack", "vstack", "hstack",
        "copy", "deepcopy",
        # pathlib 기본
        "Path",
    })

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

        # 1. 파라미터 (각각 개념) - self/cls 제외
        for arg in node.args.args:
            if arg.arg not in ("self", "cls"):
                self._current_concepts.append(f"param:{arg.arg}")

        # 2. 지역 변수
        for stmt in ast.walk(node):
            if isinstance(stmt, ast.Assign):
                for target in stmt.targets:
                    if isinstance(target, ast.Name):
                        concept = f"var:{target.id}"
                        if concept not in self._current_concepts:
                            self._current_concepts.append(concept)

        # 3. 함수 호출 (고유한 것만) - built-in 제외
        calls = set()
        for stmt in ast.walk(node):
            if isinstance(stmt, ast.Call):
                call_name = self._get_call_name(stmt)
                if call_name and call_name not in calls:
                    # Built-in 함수는 인지 부하가 거의 없으므로 제외
                    if call_name not in self.BUILTIN_FUNCTIONS:
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
# 문자열/주석 제거 (False positive 방지)
# ============================================================

def strip_strings_and_comments(source: str) -> str:
    """
    소스 코드에서 문자열 리터럴과 주석 제거

    패턴 매칭 시 false positive 방지를 위해 사용.
    문자열과 주석 내용을 공백으로 대체하여 라인 번호 유지.

    Args:
        source: Python 소스 코드

    Returns:
        문자열/주석이 제거된 코드
    """
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return source

    # 문자열 위치 수집 (docstring 포함)
    string_ranges: list[tuple[int, int]] = []

    for node in ast.walk(tree):
        # 문자열 상수 (Python 3.8+)
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            if hasattr(node, 'lineno') and hasattr(node, 'end_lineno'):
                start = _get_offset(source, node.lineno, node.col_offset)
                end = _get_offset(source, node.end_lineno, node.end_col_offset)
                if start is not None and end is not None:
                    string_ranges.append((start, end))

    # 주석 제거 (# 부터 줄 끝까지)
    result = list(source)

    # 문자열 범위 마스킹
    for start, end in string_ranges:
        for i in range(start, min(end, len(result))):
            if result[i] != '\n':
                result[i] = ' '

    # 주석 마스킹 (문자열 내부가 아닌 # 만)
    in_string = False
    string_char = None
    i = 0
    while i < len(result):
        c = result[i]

        # 문자열 시작/끝 추적 (이미 마스킹된 부분은 공백)
        if c in ('"', "'") and (i == 0 or result[i-1] != '\\'):
            if not in_string:
                in_string = True
                string_char = c
            elif c == string_char:
                in_string = False
                string_char = None

        # 문자열 밖의 # = 주석
        if c == '#' and not in_string:
            while i < len(result) and result[i] != '\n':
                result[i] = ' '
                i += 1
        i += 1

    return ''.join(result)


def _get_offset(source: str, lineno: int, col_offset: int) -> int | None:
    """라인/컬럼을 문자열 오프셋으로 변환"""
    lines = source.splitlines(keepends=True)
    if lineno < 1 or lineno > len(lines):
        return None

    offset = sum(len(lines[i]) for i in range(lineno - 1))
    return offset + col_offset


# ============================================================
# 조건 3: 숨겨진 의존성 탐지
# ============================================================

# 숨겨진 의존성 패턴 (쓰기/상태변경만 카운트)
#
# | 유형            | 예시                                      | 처리      |
# |-----------------|-------------------------------------------|-----------|
# | 읽기 (배제)     | config 로딩, 데이터 읽기, 체크포인트 로딩 | ✅ 허용   |
# | 쓰기 (카운트)   | 파일 저장, DB 수정, 외부 API 호출         | ⚠️ 카운트 |
# | 환경변수 (배제) | os.environ.get()                          | ✅ 허용   |
#
HIDDEN_DEPENDENCY_PATTERNS: list[tuple[str, str]] = [
    # === 상태 수정 (위험) ===
    (r"\bglobal\s+\w+", "global variable mutation"),

    # === 파일 쓰기 ===
    (r"\.write\s*\(", "file write"),
    (r"\.writelines\s*\(", "file write"),
    (r"\.save\s*\(", "file save"),
    (r"\.dump\s*\(", "data dump"),
    (r"\.to_csv\s*\(", "csv write"),
    (r"\.to_json\s*\(", "json write"),
    (r"\.to_pickle\s*\(", "pickle write"),

    # === DB 수정 ===
    (r"\.commit\s*\(", "db commit"),
    (r"\.execute\s*\([^)]*\b(INSERT|UPDATE|DELETE)\b", "db mutation"),
    (r"\.insert", "db insert"),
    (r"\.update\s*\(", "db update"),
    (r"\.delete\s*\(", "db delete"),

    # === 외부 API 쓰기 ===
    (r"requests\.post\s*\(", "HTTP POST"),
    (r"requests\.put\s*\(", "HTTP PUT"),
    (r"requests\.delete\s*\(", "HTTP DELETE"),
    (r"requests\.patch\s*\(", "HTTP PATCH"),
    (r"httpx\.post\s*\(", "HTTP POST"),
    (r"httpx\.put\s*\(", "HTTP PUT"),

    # === 외부 프로세스 실행 ===
    (r"\bsubprocess\.run\s*\(", "subprocess"),
    (r"\bsubprocess\.call\s*\(", "subprocess"),
    (r"\bsubprocess\.Popen\s*\(", "subprocess"),
    (r"\bos\.system\s*\(", "system call"),

    # === 비결정적 (테스트 어려움) ===
    (r"\brandom\.(?!seed)", "randomness"),
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

    탐지 대상:
    1. 패턴 기반: global, 환경변수, I/O, 네트워크 등
    2. AST 기반: 클로저 캡처 (내부 함수가 외부 변수 참조)

    Args:
        source: Python 소스 코드

    Returns:
        탐지된 숨겨진 의존성 목록
    """
    # 문자열/주석 제거된 코드로 패턴 매칭
    stripped = strip_strings_and_comments(source)

    found: list[HiddenDependency] = []
    seen_reasons: set[str] = set()

    # 1. 패턴 기반 탐지
    for pattern, reason in HIDDEN_DEPENDENCY_PATTERNS:
        if reason in seen_reasons:
            continue

        match = re.search(pattern, stripped, re.IGNORECASE)
        if match:
            line_no = stripped[:match.start()].count("\n") + 1
            found.append(HiddenDependency(
                pattern=pattern,
                reason=reason,
                line=line_no,
            ))
            seen_reasons.add(reason)

    # 2. 클로저 캡처 탐지 (AST 기반)
    closure_captures = _detect_closure_captures(source)
    for var_name, line_no in closure_captures:
        reason = f"closure capture: {var_name}"
        if reason not in seen_reasons:
            found.append(HiddenDependency(
                pattern="closure",
                reason=reason,
                line=line_no,
            ))
            seen_reasons.add(reason)

    return found


def _detect_closure_captures(source: str) -> list[tuple[str, int]]:
    """
    클로저 캡처 탐지 - 내부 함수가 외부 스코프 변수를 참조하는 경우

    Returns:
        [(변수명, 라인번호), ...]
    """
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return []

    captures: list[tuple[str, int]] = []

    for node in ast.walk(tree):
        # 함수 정의 찾기
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            # 내부 함수 찾기
            for child in ast.walk(node):
                if child is node:
                    continue
                if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)):
                    # 내부 함수의 캡처된 변수 찾기
                    captured = _find_captured_variables(node, child)
                    for var_name, lineno in captured:
                        captures.append((var_name, lineno))

    return captures


def _find_captured_variables(
    outer_func: ast.FunctionDef | ast.AsyncFunctionDef,
    inner_func: ast.FunctionDef | ast.AsyncFunctionDef | ast.Lambda,
) -> list[tuple[str, int]]:
    """외부 함수에서 캡처된 변수 찾기"""
    # 외부 함수의 로컬 변수 수집
    outer_locals: set[str] = set()

    # 파라미터
    for arg in outer_func.args.args:
        outer_locals.add(arg.arg)

    # 로컬 할당
    for stmt in ast.walk(outer_func):
        if isinstance(stmt, ast.Assign):
            for target in stmt.targets:
                if isinstance(target, ast.Name):
                    outer_locals.add(target.id)
        elif isinstance(stmt, ast.AnnAssign) and isinstance(stmt.target, ast.Name):
            outer_locals.add(stmt.target.id)

    # 내부 함수의 로컬 변수 수집
    inner_locals: set[str] = set()

    if isinstance(inner_func, (ast.FunctionDef, ast.AsyncFunctionDef)):
        for arg in inner_func.args.args:
            inner_locals.add(arg.arg)

    for stmt in ast.walk(inner_func):
        if isinstance(stmt, ast.Assign):
            for target in stmt.targets:
                if isinstance(target, ast.Name):
                    inner_locals.add(target.id)

    # 내부 함수에서 참조하는 외부 변수 찾기
    captured: list[tuple[str, int]] = []
    seen: set[str] = set()

    for stmt in ast.walk(inner_func):
        if isinstance(stmt, ast.Name) and isinstance(stmt.ctx, ast.Load):
            var_name = stmt.id
            # 외부 로컬이면서 내부 로컬이 아닌 변수 = 캡처
            if var_name in outer_locals and var_name not in inner_locals:
                if var_name not in seen:
                    captured.append((var_name, stmt.lineno))
                    seen.add(var_name)

    return captured


# ============================================================
# 조건 4: state×async×retry 공존 검사 (명시적 방식)
# ============================================================

# State 패턴 (명시적: 클래스 필드 변이, 전역/비지역 변수만)
STATE_PATTERNS: list[str] = [
    r"\bself\.\w+\s*=",          # self.field = (인스턴스 상태 변이)
    r"\bglobal\s+\w+",           # global 변수 선언
    r"\bnonlocal\s+\w+",         # nonlocal 변수 선언
]

# Async 패턴 (명시적: async/await 키워드, 동시성 라이브러리)
ASYNC_PATTERNS: list[str] = [
    r"\basync\s+def\b",          # async 함수 정의
    r"\bawait\s+",               # await 키워드
    r"\basyncio\.",              # asyncio 라이브러리
    r"\bThreadPoolExecutor\b",   # 스레드 풀
    r"\bProcessPoolExecutor\b",  # 프로세스 풀
    r"\bthreading\.Thread\b",    # 스레드 생성
    r"\bmultiprocessing\.Process\b",  # 프로세스 생성
]

# Retry 패턴 (명시적: 데코레이터, 전용 라이브러리만)
# 참고: try-except + loop 조합은 AST로 별도 탐지
RETRY_DECORATOR_PATTERNS: list[str] = [
    r"@retry\b",                 # @retry 데코레이터
    r"@backoff\.",               # @backoff.on_exception 등
    r"@tenacity\.",              # @tenacity.retry 등
    r"@retrying\.",              # @retrying.retry 등
]

RETRY_IMPORT_PATTERNS: list[str] = [
    r"\bfrom\s+tenacity\s+import\b",
    r"\bimport\s+tenacity\b",
    r"\bfrom\s+retrying\s+import\b",
    r"\bimport\s+retrying\b",
    r"\bfrom\s+backoff\s+import\b",
    r"\bimport\s+backoff\b",
]


def _detect_retry_with_ast(source: str) -> bool:
    """
    AST 기반 retry 패턴 탐지

    명시적 retry 패턴:
    1. @retry, @backoff 등 데코레이터
    2. tenacity, retrying 라이브러리 import
    3. try-except 내부에 재시도 루프 (for/while + break)
    """
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return False

    # 1. 데코레이터 검사
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for decorator in node.decorator_list:
                dec_name = _get_decorator_name(decorator)
                if dec_name and dec_name.lower() in ('retry', 'backoff', 'tenacity'):
                    return True

    # 2. try-except + loop + break/continue 패턴 (재시도 구조)
    for node in ast.walk(tree):
        if isinstance(node, ast.Try):
            # try 블록 내에 loop가 있고, except에서 continue/재시도 하는 패턴
            if _has_retry_loop_pattern(node):
                return True

    # 3. loop + try-except + break 패턴
    for node in ast.walk(tree):
        if isinstance(node, (ast.For, ast.While)):
            if _has_try_break_pattern(node):
                return True

    return False


def _get_decorator_name(decorator: ast.expr) -> str | None:
    """데코레이터 이름 추출"""
    if isinstance(decorator, ast.Name):
        return decorator.id
    if isinstance(decorator, ast.Attribute):
        return decorator.attr
    if isinstance(decorator, ast.Call):
        return _get_decorator_name(decorator.func)
    return None


def _has_retry_loop_pattern(try_node: ast.Try) -> bool:
    """try-except 내에 재시도 루프 패턴이 있는지 확인"""
    # except 핸들러에 continue가 있으면 재시도 패턴
    for handler in try_node.handlers:
        for node in ast.walk(handler):
            if isinstance(node, ast.Continue):
                return True
    return False


def _has_try_break_pattern(loop_node: ast.For | ast.While) -> bool:
    """
    loop 내에 retry 패턴이 있는지 확인

    retry 패턴 조건:
    1. loop + try-except + break (명시적 탈출)
    2. loop + try-except + return (성공시 반환)
    3. for _ in range(N) + try-except (N이 작은 숫자)
    """
    has_try = False
    has_exit = False  # break 또는 return

    for node in ast.walk(loop_node):
        if isinstance(node, ast.Try):
            has_try = True
        if isinstance(node, (ast.Break, ast.Return)):
            has_exit = True

    if not has_try:
        return False

    # try가 있고 break/return이 있으면 retry 패턴
    if has_exit:
        return True

    # for _ in range(N) 형태이면서 N이 작은 숫자면 retry 패턴
    if isinstance(loop_node, ast.For):
        if _is_small_range_loop(loop_node):
            return True

    return False


def _is_small_range_loop(for_node: ast.For) -> bool:
    """for _ in range(N) 형태이고 N이 작은 숫자인지 확인"""
    iter_node = for_node.iter

    # range(...) 호출인지 확인
    if not isinstance(iter_node, ast.Call):
        return False

    if not isinstance(iter_node.func, ast.Name):
        return False

    if iter_node.func.id != 'range':
        return False

    # range의 첫 번째 인자가 작은 숫자인지 (10 이하)
    if iter_node.args:
        first_arg = iter_node.args[0]
        if isinstance(first_arg, ast.Constant) and isinstance(first_arg.value, int):
            return first_arg.value <= 10

    return False


def check_state_async_retry(source: str) -> StateAsyncRetry:
    """
    state×async×retry 공존 검사 (명시적 방식)

    규칙: 3개 중 2개 이상이 같은 모듈에 공존하면 위반

    명시적 탐지 기준:
    - State: self.field 변이, global/nonlocal 선언
    - Async: async def, await, 동시성 라이브러리
    - Retry: @retry 데코레이터, retry 라이브러리, try-except+loop 패턴

    Args:
        source: Python 소스 코드

    Returns:
        StateAsyncRetry 결과
    """
    # 문자열/주석 제거된 코드로 패턴 매칭
    stripped = strip_strings_and_comments(source)

    result = StateAsyncRetry()

    # State 탐지 (명시적: self.field 변이, global/nonlocal만)
    for pattern in STATE_PATTERNS:
        if re.search(pattern, stripped):
            result.has_state = True
            break

    # Async 탐지 (명시적: async/await, 동시성 라이브러리)
    for pattern in ASYNC_PATTERNS:
        if re.search(pattern, stripped):
            result.has_async = True
            break

    # Retry 탐지 (명시적: 3단계)
    # 1. 데코레이터 패턴
    for pattern in RETRY_DECORATOR_PATTERNS:
        if re.search(pattern, stripped):
            result.has_retry = True
            break

    # 2. import 패턴
    if not result.has_retry:
        for pattern in RETRY_IMPORT_PATTERNS:
            if re.search(pattern, stripped):
                result.has_retry = True
                break

    # 3. AST 기반 try-except + loop 패턴
    if not result.has_retry:
        result.has_retry = _detect_retry_with_ast(source)

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
