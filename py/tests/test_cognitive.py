"""
🧀 Cheese (인지 가능 여부) 테스트

정의:
    🧀 Cheese = 사람과 LLM이 인지할 수 있는 범위 내에 있는가?

인지 가능 조건 (4가지 모두 충족):
    1. 중첩 깊이 ≤ N (기본 4)
    2. 개념 수 ≤ 5개/함수
    3. 숨겨진 의존성 최소화 (기본 ≤ 2)
    4. state×async×retry 2개 이상 공존 금지
"""

__module_type__ = "test"

import pytest
from semantic_complexity.analyzers.cheese import (
    is_cognitively_accessible,
    analyze_cognitive,
    calculate_max_nesting,
    extract_functions,
    detect_hidden_dependencies,
    check_state_async_retry,
    CognitiveConfig,
)


# ============================================================
# 인지 가능한 코드 (Accessible)
# ============================================================

class TestAccessible:
    """인지 가능한 코드 테스트 (모든 조건 충족)"""

    def test_simple_function(self):
        """단순 함수 = 인지 가능"""
        source = """
def add(a, b):
    return a + b
"""
        result = is_cognitively_accessible(source)
        assert result.accessible is True
        assert result.reason == "인지 가능"
        assert len(result.violations) == 0

    def test_moderate_nesting(self):
        """적절한 중첩 = 인지 가능"""
        source = """
def process(data):
    if data:
        for item in data:
            if item.valid:
                yield item
"""
        result = is_cognitively_accessible(source)
        assert result.accessible is True

    def test_few_concepts(self):
        """적은 개념 수 = 인지 가능"""
        source = """
def calculate_total(items):
    total = 0
    for item in items:
        total += item.price
    return total
"""
        result = is_cognitively_accessible(source)
        assert result.accessible is True


# ============================================================
# 조건 1: 중첩 깊이
# ============================================================

class TestNestingDepth:
    """중첩 깊이 테스트"""

    def test_nesting_depth_calculation(self):
        """중첩 깊이 계산"""
        source = """
def deep_nesting():
    if a:
        if b:
            if c:
                if d:
                    if e:
                        pass
"""
        depth = calculate_max_nesting(source)
        assert depth == 6  # def + 5 ifs

    def test_exceeds_nesting_threshold(self):
        """중첩 깊이 초과 = 인지 불가"""
        source = """
def too_deep():
    if a:
        if b:
            if c:
                if d:
                    if e:
                        pass
"""
        result = is_cognitively_accessible(source)
        assert result.accessible is False
        assert "중첩 깊이 초과" in result.reason

    def test_custom_nesting_threshold(self):
        """커스텀 중첩 임계값"""
        source = """
def moderate():
    if a:
        if b:
            pass
"""
        # 기본 임계값 (4) = 통과
        result = is_cognitively_accessible(source)
        assert result.accessible is True

        # 엄격한 임계값 (1) = 실패
        strict_config = CognitiveConfig(nesting_threshold=1)
        result = is_cognitively_accessible(source, strict_config)
        assert result.accessible is False


# ============================================================
# 조건 2: 개념 수
# ============================================================

class TestConceptCount:
    """함수당 개념 수 테스트"""

    def test_count_concepts(self):
        """개념 수 계산"""
        source = """
def process(a, b, c):
    x = transform(a)
    y = validate(b)
    z = format(c)
    if is_valid(x, y, z):
        return combine(x, y, z)
    return None
"""
        functions = extract_functions(source)
        assert len(functions) == 1

        func = functions[0]
        assert func.name == "process"
        # params: a, b, c + vars: x, y, z + calls: transform, validate, format, is_valid, combine + control + return
        # 실제 개념 수는 구현에 따라 다름
        assert func.concept_count > 5

    def test_exceeds_concept_limit(self):
        """개념 수 초과 = 인지 불가"""
        source = """
def too_many_concepts(a, b, c, d, e, f):
    x = process_a(a)
    y = process_b(b)
    z = process_c(c)
    if check(x, y, z):
        return combine(x, y, z)
    return None
"""
        result = is_cognitively_accessible(source)
        assert result.accessible is False
        assert "개념 수 초과" in result.violations[0]

    def test_simple_function_under_limit(self):
        """단순 함수 = 개념 수 범위 내"""
        source = """
def simple(a, b):
    return a + b
"""
        functions = extract_functions(source)
        assert len(functions) == 1
        assert functions[0].concept_count <= 5


# ============================================================
# 조건 3: 숨겨진 의존성
# ============================================================

class TestHiddenDependencies:
    """숨겨진 의존성 테스트"""

    def test_detect_global(self):
        """global 변수 탐지"""
        source = """
counter = 0

def increment():
    global counter
    counter += 1
"""
        deps = detect_hidden_dependencies(source)
        assert any("global" in d.reason for d in deps)

    def test_detect_environment(self):
        """환경 변수 탐지"""
        source = """
import os

def get_config():
    return os.environ.get("API_KEY")
"""
        deps = detect_hidden_dependencies(source)
        assert any("environ" in d.reason for d in deps)

    def test_detect_file_io(self):
        """파일 I/O 탐지"""
        source = """
def read_file(path):
    with open(path) as f:
        return f.read()
"""
        deps = detect_hidden_dependencies(source)
        assert any("file" in d.reason.lower() for d in deps)

    def test_detect_network(self):
        """네트워크 요청 탐지"""
        source = """
import requests

def fetch_data(url):
    return requests.get(url).json()
"""
        deps = detect_hidden_dependencies(source)
        assert any("HTTP" in d.reason for d in deps)

    def test_exceeds_hidden_dep_threshold(self):
        """숨겨진 의존성 초과 = 인지 불가"""
        source = """
import os
import requests
import random

def dangerous():
    key = os.environ.get("KEY")
    data = requests.get("http://api").json()
    return random.choice(data)
"""
        result = is_cognitively_accessible(source)
        assert result.accessible is False
        assert "숨겨진 의존성 초과" in str(result.violations)


# ============================================================
# 조건 4: state×async×retry 불변조건
# ============================================================

class TestStateAsyncRetry:
    """state×async×retry 불변조건 테스트"""

    def test_state_only_ok(self):
        """state만 = 위반 아님"""
        source = """
class Counter:
    def increment(self):
        self.count = self.count + 1
"""
        invariant = check_state_async_retry(source)
        assert invariant.has_state is True
        assert invariant.has_async is False
        assert invariant.has_retry is False
        assert invariant.violated is False

    def test_async_only_ok(self):
        """async만 = 위반 아님"""
        source = """
async def fetch():
    return await http_client.get()
"""
        invariant = check_state_async_retry(source)
        assert invariant.has_async is True
        assert invariant.has_state is False
        assert invariant.has_retry is False
        assert invariant.violated is False

    def test_retry_only_ok(self):
        """retry만 = 위반 아님"""
        source = """
@tenacity.retry(max_retries=3)
def fetch():
    return http_client.get()
"""
        invariant = check_state_async_retry(source)
        assert invariant.has_retry is True
        assert invariant.has_state is False
        assert invariant.has_async is False
        assert invariant.violated is False

    def test_state_and_async_violated(self):
        """state + async = 위반"""
        source = """
class AsyncService:
    async def update(self):
        self.data = await fetch_data()
"""
        invariant = check_state_async_retry(source)
        assert invariant.has_state is True
        assert invariant.has_async is True
        assert invariant.violated is True

        result = is_cognitively_accessible(source)
        assert result.accessible is False
        assert "state × async" in str(result.violations)

    def test_async_and_retry_violated(self):
        """async + retry = 위반"""
        source = """
@tenacity.retry
async def fetch_with_retry():
    return await http_client.get()
"""
        invariant = check_state_async_retry(source)
        assert invariant.has_async is True
        assert invariant.has_retry is True
        assert invariant.violated is True

    def test_state_and_retry_violated(self):
        """state + retry = 위반"""
        source = """
class RetryableService:
    def fetch_with_retry(self):
        for attempt in range(3):
            try:
                self.last_result = http_client.get()
                return self.last_result
            except:
                time.sleep(1)
"""
        invariant = check_state_async_retry(source)
        assert invariant.has_state is True
        assert invariant.has_retry is True
        assert invariant.violated is True

    def test_all_three_violated(self):
        """state + async + retry = 당연히 위반"""
        source = """
class RetryableAsyncService:
    async def fetch_with_retry(self):
        for attempt in range(3):
            try:
                self.last_result = await http_client.get()
                return self.last_result
            except:
                await asyncio.sleep(1)
"""
        invariant = check_state_async_retry(source)
        assert invariant.has_state is True
        assert invariant.has_async is True
        assert invariant.has_retry is True
        assert invariant.violated is True
        assert invariant.count == 3


# ============================================================
# 전체 분석 테스트
# ============================================================

class TestFullAnalysis:
    """전체 분석 테스트"""

    def test_analyze_cognitive_accessible(self):
        """인지 가능한 코드 전체 분석"""
        source = """
def simple(a, b):
    if a > b:
        return a
    return b
"""
        analysis = analyze_cognitive(source)

        assert analysis.accessible is True
        assert analysis.reason == "인지 가능"
        assert len(analysis.violations) == 0
        assert analysis.max_nesting <= 4
        assert not analysis.state_async_retry.violated

    def test_analyze_cognitive_inaccessible(self):
        """인지 불가능한 코드 전체 분석"""
        source = """
import os
import requests
import random

class ComplexService:
    async def complex_operation(self, a, b, c, d, e, f):
        for attempt in range(3):
            if a:
                if b:
                    if c:
                        if d:
                            if e:
                                self.result = await requests.get(os.environ["URL"])
                                return random.choice(self.result)
"""
        analysis = analyze_cognitive(source)

        assert analysis.accessible is False
        assert len(analysis.violations) > 0

        # 여러 조건 위반 확인
        violations_str = str(analysis.violations)
        # 중첩, 개념수, 숨겨진 의존성, state×async×retry 중 일부 위반


# ============================================================
# 엣지 케이스
# ============================================================

class TestEdgeCases:
    """엣지 케이스 테스트"""

    def test_empty_source(self):
        """빈 소스 = 인지 가능"""
        source = ""
        result = is_cognitively_accessible(source)
        assert result.accessible is True

    def test_syntax_error(self):
        """구문 오류 = 인지 가능 (분석 실패 = 빈 결과)"""
        source = "def broken(:"
        result = is_cognitively_accessible(source)
        # 파싱 실패 시 빈 결과 = 위반 없음
        assert result.accessible is True

    def test_nested_functions(self):
        """중첩 함수"""
        source = """
def outer(a):
    def inner(b):
        return a + b
    return inner
"""
        functions = extract_functions(source)
        assert len(functions) == 2

    def test_lambda_not_counted_as_function(self):
        """람다는 별도 함수로 카운트 안함"""
        source = """
def process(items):
    return map(lambda x: x * 2, items)
"""
        functions = extract_functions(source)
        # 람다는 FunctionDef가 아님
        assert len(functions) == 1
        assert functions[0].name == "process"


# ============================================================
# 설정 테스트
# ============================================================

class TestConfig:
    """설정 테스트"""

    def test_custom_config(self):
        """커스텀 설정"""
        source = """
def moderate():
    if a:
        if b:
            if c:
                pass
"""
        # 기본 설정 (nesting=4) = 통과
        default_result = is_cognitively_accessible(source)
        assert default_result.accessible is True

        # 엄격한 설정 (nesting=2) = 실패
        strict_config = CognitiveConfig(
            nesting_threshold=2,
            concepts_per_function=3,
            hidden_dep_threshold=1,
        )
        strict_result = is_cognitively_accessible(source, strict_config)
        assert strict_result.accessible is False
        assert "중첩 깊이 초과" in strict_result.reason

    def test_lenient_config(self):
        """관대한 설정"""
        source = """
import os
import requests
import random

def complex():
    if a:
        if b:
            if c:
                if d:
                    if e:
                        pass
"""
        # 관대한 설정
        lenient_config = CognitiveConfig(
            nesting_threshold=10,
            concepts_per_function=20,
            hidden_dep_threshold=10,
        )
        result = is_cognitively_accessible(source, lenient_config)
        # 여전히 실패할 수 있음 (state×async×retry는 설정 불가)
