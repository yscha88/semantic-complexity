"""
🥓 Ham (Behavioral) Analyzer

행동 보존 및 유지보수성 분석:
- Golden test 존재 여부
- Contract test 존재 여부
- Critical path 보호 상태
"""

__architecture_role__ = "lib/domain"

import re
from dataclasses import dataclass
from pathlib import Path


@dataclass
class HamResult:
    """🥓 Behavioral 분석 결과"""
    golden_test_coverage: float  # 0.0 ~ 1.0
    golden_tests: list["GoldenTest"]
    contract_test_exists: bool
    contract_tests: list[str]
    critical_paths_protected: int
    critical_paths_total: int
    critical_paths: list["CriticalPath"]
    violations: list[str]


@dataclass
class GoldenTest:
    """Golden Test 정보"""
    name: str
    file_path: str
    covers: list[str]  # 커버하는 함수/모듈


@dataclass
class CriticalPath:
    """Critical Path 정보"""
    name: str
    line: int
    path_type: str  # "payment", "auth", "data_mutation", "external_api"
    protected: bool
    test_file: str | None


# ============================================================
# Critical Path 패턴
# ============================================================

CRITICAL_PATH_PATTERNS = {
    "payment": [
        (r'def\s+(process_payment|charge|refund|transfer)', "Payment processing"),
        (r'stripe\.', "Stripe integration"),
        (r'paypal\.', "PayPal integration"),
        (r'\.pay\(', "Pay method"),
    ],
    "auth": [
        (r'def\s+(login|logout|authenticate|authorize)', "Authentication"),
        (r'def\s+(register|signup|create_user)', "User registration"),
        (r'verify_(token|password|credentials)', "Credential verification"),
    ],
    "data_mutation": [
        (r'def\s+(create|update|delete|remove)_', "CRUD operation"),
        (r'\.save\(\)', "ORM save"),
        (r'\.delete\(\)', "ORM delete"),
        (r'\.commit\(\)', "Transaction commit"),
        (r'db\.session\.(add|delete|commit)', "DB session mutation"),
    ],
    "external_api": [
        (r'requests\.(get|post|put|delete|patch)\(', "External HTTP call"),
        (r'httpx\.(get|post|put|delete|patch)\(', "External HTTP call"),
        (r'aiohttp', "Async HTTP call"),
        (r'grpc', "gRPC call"),
    ],
}

# ============================================================
# Test 패턴
# ============================================================

TEST_FILE_PATTERNS = [
    r'test_.*\.py$',
    r'.*_test\.py$',
    r'tests?/.*\.py$',
]

GOLDEN_TEST_PATTERNS = [
    (r'@pytest\.mark\.golden', "Pytest golden marker"),
    (r'@golden_test', "Golden test decorator"),
    (r'golden_master', "Golden master pattern"),
    (r'snapshot', "Snapshot testing"),
    (r'assert.*==.*expected', "Expected value assertion"),
]

CONTRACT_TEST_PATTERNS = [
    (r'@pytest\.mark\.contract', "Contract test marker"),
    (r'@contract_test', "Contract test decorator"),
    (r'pact', "Pact contract testing"),
    (r'schema.*validate', "Schema validation"),
    (r'openapi|swagger', "OpenAPI/Swagger contract"),
]


class HamAnalyzer:
    """🥓 Behavioral Analyzer"""

    def __init__(
        self,
        source: str,
        file_path: str | None = None,
        test_sources: dict[str, str] | None = None,
    ):
        """
        Args:
            source: 분석할 소스 코드
            file_path: 파일 경로
            test_sources: 테스트 파일들 {path: source}
        """
        self.source = source
        self.file_path = file_path
        self.test_sources = test_sources or {}
        self.lines = source.splitlines()

    def analyze(self) -> HamResult:
        """전체 분석 실행"""
        critical_paths = self._detect_critical_paths()
        golden_tests = self._detect_golden_tests()
        contract_tests = self._detect_contract_tests()

        # Critical path 보호 상태 확인
        self._check_path_protection(critical_paths)

        protected_count = sum(1 for p in critical_paths if p.protected)

        violations = self._collect_violations(
            critical_paths, golden_tests, contract_tests
        )

        return HamResult(
            golden_test_coverage=self._calculate_golden_coverage(critical_paths),
            golden_tests=golden_tests,
            contract_test_exists=len(contract_tests) > 0,
            contract_tests=contract_tests,
            critical_paths_protected=protected_count,
            critical_paths_total=len(critical_paths),
            critical_paths=critical_paths,
            violations=violations,
        )

    def _detect_critical_paths(self) -> list[CriticalPath]:
        """Critical path 탐지"""
        paths: list[CriticalPath] = []

        for line_num, line in enumerate(self.lines, 1):
            for path_type, patterns in CRITICAL_PATH_PATTERNS.items():
                for pattern, description in patterns:
                    match = re.search(pattern, line, re.IGNORECASE)
                    if match:
                        paths.append(CriticalPath(
                            name=self._extract_function_name(line, match),
                            line=line_num,
                            path_type=path_type,
                            protected=False,  # 나중에 확인
                            test_file=None,
                        ))

        return paths

    def _detect_golden_tests(self) -> list[GoldenTest]:
        """Golden test 탐지"""
        golden_tests: list[GoldenTest] = []

        for test_path, test_source in self.test_sources.items():
            for pattern, description in GOLDEN_TEST_PATTERNS:
                if re.search(pattern, test_source, re.IGNORECASE):
                    # 테스트가 커버하는 함수 추출
                    covers = self._extract_covered_functions(test_source)
                    golden_tests.append(GoldenTest(
                        name=description,
                        file_path=test_path,
                        covers=covers,
                    ))
                    break  # 파일당 하나만

        return golden_tests

    def _detect_contract_tests(self) -> list[str]:
        """Contract test 탐지"""
        contract_tests: list[str] = []

        for test_path, test_source in self.test_sources.items():
            for pattern, description in CONTRACT_TEST_PATTERNS:
                if re.search(pattern, test_source, re.IGNORECASE):
                    contract_tests.append(f"{test_path}: {description}")
                    break

        return contract_tests

    def _check_path_protection(self, paths: list[CriticalPath]) -> None:
        """Critical path가 테스트로 보호되는지 확인"""
        all_covered_functions: set[str] = set()

        for test_path, test_source in self.test_sources.items():
            covered = self._extract_covered_functions(test_source)
            all_covered_functions.update(covered)

        for path in paths:
            # 함수 이름이 테스트에서 참조되는지 확인
            if path.name in all_covered_functions:
                path.protected = True
                # 어떤 테스트 파일에서 커버하는지 찾기
                for test_path, test_source in self.test_sources.items():
                    if path.name in test_source:
                        path.test_file = test_path
                        break

    def _extract_covered_functions(self, test_source: str) -> list[str]:
        """테스트 소스에서 테스트하는 함수 이름 추출"""
        functions: list[str] = []

        # from ... import ... 패턴에서 추출
        imports = re.findall(r'from\s+\S+\s+import\s+([^#\n]+)', test_source)
        for imp in imports:
            names = [n.strip() for n in imp.split(',')]
            functions.extend(names)

        # 함수 호출 패턴에서 추출
        calls = re.findall(r'(\w+)\s*\(', test_source)
        functions.extend(calls)

        return list(set(functions))

    def _calculate_golden_coverage(self, paths: list[CriticalPath]) -> float:
        """Golden test 커버리지 계산"""
        if not paths:
            return 1.0  # Critical path 없으면 100% 커버리지

        protected = sum(1 for p in paths if p.protected)
        return protected / len(paths)

    def _extract_function_name(self, line: str, match: re.Match) -> str:
        """라인에서 함수 이름 추출"""
        # def 문에서 함수 이름 추출
        func_match = re.search(r'def\s+(\w+)', line)
        if func_match:
            return func_match.group(1)

        # 매치된 부분에서 추출
        return match.group().strip()[:30]

    def _collect_violations(
        self,
        paths: list[CriticalPath],
        golden_tests: list[GoldenTest],
        contract_tests: list[str],
    ) -> list[str]:
        """위반 사항 수집"""
        violations: list[str] = []

        # 보호되지 않은 critical path
        unprotected = [p for p in paths if not p.protected]
        if unprotected:
            names = [p.name for p in unprotected[:5]]  # 최대 5개
            violations.append(f"Unprotected critical paths: {', '.join(names)}")

        # Golden test 없음
        if not golden_tests and paths:
            violations.append("No golden tests found for critical paths")

        # Contract test 없음 (API 모듈인 경우)
        has_api = any(p.path_type == "external_api" for p in paths)
        if has_api and not contract_tests:
            violations.append("External API calls without contract tests")

        return violations


# ============================================================
# 공개 API
# ============================================================

def analyze_ham(
    source: str,
    file_path: str | None = None,
    test_sources: dict[str, str] | None = None,
) -> HamResult:
    """
    🥓 Behavioral 분석

    Args:
        source: Python 소스 코드
        file_path: 파일 경로 (선택)
        test_sources: 관련 테스트 파일들 {path: source}

    Returns:
        HamResult: 분석 결과
    """
    analyzer = HamAnalyzer(source, file_path, test_sources)
    return analyzer.analyze()
