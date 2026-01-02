"""
ham 모듈 테스트

- Critical path 탐지
- Golden test 탐지
- Contract test 탐지
- Path 보호 상태 확인
"""

import pytest

from semantic_complexity.analyzers.ham import (
    HamResult,
    GoldenTest,
    CriticalPath,
    HamAnalyzer,
    analyze_ham,
    CRITICAL_PATH_PATTERNS,
    GOLDEN_TEST_PATTERNS,
    CONTRACT_TEST_PATTERNS,
)


# ============================================================
# Critical Path 테스트
# ============================================================

class TestCriticalPath:
    """Critical path 탐지 테스트"""

    def test_detect_payment_processing(self):
        """결제 처리 탐지"""
        source = '''
def process_payment(amount, card):
    return charge(card, amount)
'''
        result = analyze_ham(source)
        assert any(p.path_type == "payment" for p in result.critical_paths)

    def test_detect_stripe_integration(self):
        """Stripe 연동 탐지"""
        source = '''
def checkout():
    stripe.Charge.create(amount=1000)
'''
        result = analyze_ham(source)
        assert any(p.path_type == "payment" for p in result.critical_paths)

    def test_detect_auth_login(self):
        """로그인 탐지"""
        source = '''
def login(username, password):
    return authenticate(username, password)
'''
        result = analyze_ham(source)
        assert any(p.path_type == "auth" for p in result.critical_paths)

    def test_detect_user_registration(self):
        """사용자 등록 탐지"""
        source = '''
def register(email, password):
    return create_user(email, password)
'''
        result = analyze_ham(source)
        assert any(p.path_type == "auth" for p in result.critical_paths)

    def test_detect_data_mutation_crud(self):
        """CRUD 작업 탐지"""
        source = '''
def create_order(data):
    order = Order(**data)
    db.session.add(order)
    db.session.commit()
'''
        result = analyze_ham(source)
        assert any(p.path_type == "data_mutation" for p in result.critical_paths)

    def test_detect_orm_save(self):
        """ORM save 탐지"""
        source = '''
def update_user(user, data):
    user.name = data['name']
    user.save()
'''
        result = analyze_ham(source)
        assert any(p.path_type == "data_mutation" for p in result.critical_paths)

    def test_detect_external_api_call(self):
        """외부 API 호출 탐지"""
        source = '''
def fetch_weather():
    return requests.get("https://api.weather.com/data")
'''
        result = analyze_ham(source)
        assert any(p.path_type == "external_api" for p in result.critical_paths)

    def test_detect_http_post(self):
        """HTTP POST 탐지"""
        source = '''
def send_notification(message):
    requests.post("https://api.slack.com/webhook", json=message)
'''
        result = analyze_ham(source)
        assert any(p.path_type == "external_api" for p in result.critical_paths)

    def test_no_critical_path(self):
        """Critical path 없음"""
        source = '''
def simple_calc(a, b):
    return a + b
'''
        result = analyze_ham(source)
        assert len(result.critical_paths) == 0


# ============================================================
# Golden Test 테스트
# ============================================================

class TestGoldenTest:
    """Golden test 탐지 테스트"""

    def test_detect_pytest_golden_marker(self):
        """pytest golden marker 탐지"""
        source = '''
def process_payment(amount):
    return amount * 1.1
'''
        test_sources = {
            "test_payment.py": '''
@pytest.mark.golden
def test_process_payment():
    assert process_payment(100) == 110
'''
        }
        result = analyze_ham(source, test_sources=test_sources)
        assert len(result.golden_tests) >= 1

    def test_detect_snapshot_testing(self):
        """스냅샷 테스트 탐지"""
        source = '''
def render_page():
    return "<html>...</html>"
'''
        test_sources = {
            "test_render.py": '''
def test_render_page(snapshot):
    assert render_page() == snapshot
'''
        }
        result = analyze_ham(source, test_sources=test_sources)
        assert len(result.golden_tests) >= 1

    def test_detect_expected_value_assertion(self):
        """예상 값 assertion 탐지"""
        source = '''
def calculate():
    return 42
'''
        test_sources = {
            "test_calc.py": '''
def test_calculate():
    expected = 42
    assert calculate() == expected
'''
        }
        result = analyze_ham(source, test_sources=test_sources)
        assert len(result.golden_tests) >= 1

    def test_no_golden_tests(self):
        """Golden test 없음"""
        source = '''
def critical_function():
    pass
'''
        result = analyze_ham(source, test_sources={})
        assert len(result.golden_tests) == 0


# ============================================================
# Contract Test 테스트
# ============================================================

class TestContractTest:
    """Contract test 탐지 테스트"""

    def test_detect_pact_testing(self):
        """Pact contract testing 탐지"""
        source = '''
def api_endpoint():
    pass
'''
        test_sources = {
            "test_api.py": '''
def test_api_contract():
    pact.verify()
'''
        }
        result = analyze_ham(source, test_sources=test_sources)
        assert result.contract_test_exists

    def test_detect_schema_validation(self):
        """스키마 검증 탐지"""
        source = '''
def get_user():
    pass
'''
        test_sources = {
            "test_user.py": '''
def test_user_schema():
    schema.validate(response)
'''
        }
        result = analyze_ham(source, test_sources=test_sources)
        assert result.contract_test_exists

    def test_detect_openapi_contract(self):
        """OpenAPI contract 탐지"""
        source = '''
def api():
    pass
'''
        test_sources = {
            "test_contract.py": '''
def test_openapi_compliance():
    openapi.validate(spec)
'''
        }
        result = analyze_ham(source, test_sources=test_sources)
        assert result.contract_test_exists

    def test_no_contract_tests(self):
        """Contract test 없음"""
        source = '''
def api():
    pass
'''
        result = analyze_ham(source, test_sources={})
        assert not result.contract_test_exists


# ============================================================
# Path 보호 상태 테스트
# ============================================================

class TestPathProtection:
    """Critical path 보호 상태 테스트"""

    def test_protected_path(self):
        """보호된 critical path"""
        source = '''
def process_payment(amount):
    return amount * 1.1
'''
        test_sources = {
            "test_payment.py": '''
from module import process_payment

def test_process_payment():
    assert process_payment(100) == 110
'''
        }
        result = analyze_ham(source, test_sources=test_sources)
        assert result.critical_paths_protected >= 1
        protected = [p for p in result.critical_paths if p.protected]
        assert len(protected) >= 1

    def test_unprotected_path(self):
        """보호되지 않은 critical path"""
        source = '''
def process_payment(amount):
    return amount * 1.1
'''
        result = analyze_ham(source, test_sources={})
        assert result.critical_paths_protected == 0
        unprotected = [p for p in result.critical_paths if not p.protected]
        assert len(unprotected) >= 1

    def test_partial_protection(self):
        """부분 보호"""
        source = '''
def login(user, password):
    pass

def logout(user):
    pass
'''
        test_sources = {
            "test_auth.py": '''
def test_login():
    login("user", "pass")
'''
        }
        result = analyze_ham(source, test_sources=test_sources)
        # login은 보호, logout은 미보호


# ============================================================
# Coverage 테스트
# ============================================================

class TestCoverage:
    """Golden test 커버리지 테스트"""

    def test_full_coverage(self):
        """100% 커버리지"""
        source = '''
def simple():
    return 1
'''
        result = analyze_ham(source, test_sources={})
        # Critical path 없으면 100%
        assert result.golden_test_coverage == 1.0

    def test_zero_coverage(self):
        """0% 커버리지"""
        source = '''
def process_payment(amount):
    pass
'''
        result = analyze_ham(source, test_sources={})
        assert result.golden_test_coverage == 0.0

    def test_partial_coverage(self):
        """부분 커버리지"""
        source = '''
def login():
    pass

def logout():
    pass
'''
        test_sources = {
            "test_auth.py": '''
def test_login():
    login()
'''
        }
        result = analyze_ham(source, test_sources=test_sources)
        assert 0.0 < result.golden_test_coverage < 1.0


# ============================================================
# Violations 테스트
# ============================================================

class TestViolations:
    """Violations 테스트"""

    def test_unprotected_paths_violation(self):
        """보호되지 않은 critical path 위반"""
        source = '''
def process_payment():
    pass
'''
        result = analyze_ham(source, test_sources={})
        assert any("Unprotected critical paths" in v for v in result.violations)

    def test_no_golden_tests_violation(self):
        """Golden test 없음 위반"""
        source = '''
def login():
    pass
'''
        result = analyze_ham(source, test_sources={})
        assert any("No golden tests" in v for v in result.violations)

    def test_external_api_without_contract(self):
        """외부 API 호출인데 contract test 없음"""
        source = '''
def fetch_data():
    requests.get("https://api.example.com")
'''
        result = analyze_ham(source, test_sources={})
        assert any("contract test" in v.lower() for v in result.violations)


# ============================================================
# 통합 테스트
# ============================================================

class TestIntegration:
    """통합 테스트"""

    def test_well_tested_module(self):
        """잘 테스트된 모듈"""
        source = '''
def process_payment(amount):
    return amount * 1.1
'''
        test_sources = {
            "test_payment.py": '''
@pytest.mark.golden
def test_process_payment():
    expected = 110
    assert process_payment(100) == expected
'''
        }
        result = analyze_ham(source, test_sources=test_sources)
        assert result.golden_test_coverage > 0.0
        assert len(result.golden_tests) >= 1

    def test_ham_result_structure(self):
        """HamResult 구조 확인"""
        source = "def foo(): pass"
        result = analyze_ham(source)

        assert isinstance(result, HamResult)
        assert isinstance(result.golden_test_coverage, float)
        assert isinstance(result.golden_tests, list)
        assert isinstance(result.contract_test_exists, bool)
        assert isinstance(result.contract_tests, list)
        assert isinstance(result.critical_paths_protected, int)
        assert isinstance(result.critical_paths_total, int)
        assert isinstance(result.critical_paths, list)
        assert isinstance(result.violations, list)

    def test_analyzer_with_file_path(self):
        """파일 경로 포함 분석"""
        source = '''
def login():
    pass
'''
        result = analyze_ham(source, file_path="src/auth/login.py")
        assert len(result.critical_paths) >= 1


# ============================================================
# Edge Cases
# ============================================================

class TestEdgeCases:
    """Edge case 테스트"""

    def test_empty_source(self):
        """빈 소스"""
        result = analyze_ham("")
        assert result.critical_paths_total == 0
        assert result.golden_test_coverage == 1.0

    def test_empty_test_sources(self):
        """테스트 소스 없음"""
        source = '''
def process():
    pass
'''
        result = analyze_ham(source, test_sources=None)
        assert len(result.golden_tests) == 0

    def test_multiple_critical_paths(self):
        """여러 critical path"""
        source = '''
def login():
    pass

def process_payment():
    pass

def delete_user():
    pass

def fetch_external():
    requests.get("http://api.com")
'''
        result = analyze_ham(source)
        assert result.critical_paths_total >= 3
