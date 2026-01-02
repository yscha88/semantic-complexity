"""
waiver 모듈 테스트

- 인라인 __essential_complexity__ 파싱
- 외부 .waiver.json 파일 지원
- 파일 패턴 매칭
- 만료 체크
- 통합 waiver 체크
"""

import json
import pytest
from pathlib import Path
from datetime import date, timedelta

from semantic_complexity.gate.waiver import (
    # 타입
    EssentialComplexityConfig,
    ExternalWaiverEntry,
    WaiverFile,
    WaiverResult,
    # 인라인 waiver
    parse_essential_complexity,
    # 외부 waiver
    parse_waiver_file,
    find_waiver_file,
    match_file_pattern,
    check_external_waiver,
    # 통합 API
    check_waiver,
)


# ============================================================
# Layer 1: 인라인 __essential_complexity__ 파싱 테스트
# ============================================================

class TestParseEssentialComplexity:
    """__essential_complexity__ 파싱 테스트"""

    def test_parse_simple_config(self):
        """기본 설정 파싱"""
        source = '''
__essential_complexity__ = {
    "adr": "docs/adr/001-complexity.md",
}
'''
        config = parse_essential_complexity(source)
        assert config is not None
        assert config.adr == "docs/adr/001-complexity.md"

    def test_parse_full_config(self):
        """전체 설정 파싱"""
        source = '''
__essential_complexity__ = {
    "adr": "docs/adr/001.md",
    "nesting": 7,
    "concepts": {"total": 15, "params": 8},
    "reason": "AST Visitor 패턴",
}
'''
        config = parse_essential_complexity(source)
        assert config is not None
        assert config.adr == "docs/adr/001.md"
        assert config.nesting == 7
        assert config.concepts_total == 15
        assert config.concepts_params == 8

    def test_parse_concepts_as_int(self):
        """concepts를 정수로 지정"""
        source = '''
__essential_complexity__ = {
    "adr": "docs/adr/001.md",
    "concepts": 10,
}
'''
        config = parse_essential_complexity(source)
        assert config is not None
        assert config.concepts_total == 10

    def test_no_essential_complexity(self):
        """__essential_complexity__ 없음"""
        source = '''
def foo():
    pass
'''
        config = parse_essential_complexity(source)
        assert config is None

    def test_syntax_error(self):
        """문법 오류 소스"""
        source = '''
def foo(
'''
        config = parse_essential_complexity(source)
        assert config is None


# ============================================================
# Layer 2: 외부 Waiver 파일 파싱 테스트
# ============================================================

class TestParseWaiverFile:
    """외부 .waiver.json 파싱 테스트"""

    def test_parse_valid_waiver_file(self, tmp_path):
        """유효한 waiver 파일 파싱 (SDS 3.9.3 스키마)"""
        waiver_data = {
            "$schema": "https://semantic-complexity.dev/schemas/waiver.json",
            "version": "1.0",
            "waivers": [
                {
                    "pattern": "src/crypto/*.py",
                    "adr": "ADR-007",
                    "justification": "AES-256 암호화",
                    "approved_at": "2025-01-15",
                    "expires_at": "2025-12-31",
                    "approver": "security-team",
                },
                {
                    "pattern": "src/regulations/hipaa.py",
                    "adr": "ADR-012",
                    "justification": "HIPAA 규제 준수",
                    "approved_at": "2025-01-01",
                    "expires_at": None,
                    "approver": "compliance-team",
                }
            ]
        }
        waiver_path = tmp_path / ".waiver.json"
        waiver_path.write_text(json.dumps(waiver_data), encoding="utf-8")

        result = parse_waiver_file(waiver_path)
        assert result is not None
        assert result.schema_url == "https://semantic-complexity.dev/schemas/waiver.json"
        assert result.version == "1.0"
        assert len(result.waivers) == 2
        assert result.waivers[0].pattern == "src/crypto/*.py"
        assert result.waivers[0].adr == "ADR-007"
        assert result.waivers[0].justification == "AES-256 암호화"
        assert result.waivers[0].approved_at == "2025-01-15"
        assert result.waivers[0].approver == "security-team"
        # expires_at: null 지원 확인
        assert result.waivers[1].expires_at is None

    def test_parse_minimal_waiver_file(self, tmp_path):
        """최소 waiver 파일"""
        waiver_data = {
            "version": "1.0",
            "waivers": [
                {
                    "pattern": "*.py",
                    "adr": "ADR-001",
                }
            ]
        }
        waiver_path = tmp_path / ".waiver.json"
        waiver_path.write_text(json.dumps(waiver_data), encoding="utf-8")

        result = parse_waiver_file(waiver_path)
        assert result is not None
        assert result.waivers[0].justification is None
        assert result.waivers[0].expires_at is None

    def test_parse_invalid_json(self, tmp_path):
        """잘못된 JSON"""
        waiver_path = tmp_path / ".waiver.json"
        waiver_path.write_text("{ invalid json }", encoding="utf-8")

        result = parse_waiver_file(waiver_path)
        assert result is None

    def test_parse_nonexistent_file(self, tmp_path):
        """존재하지 않는 파일"""
        waiver_path = tmp_path / ".waiver.json"

        result = parse_waiver_file(waiver_path)
        assert result is None


# ============================================================
# Layer 3: Waiver 파일 탐색 테스트
# ============================================================

class TestFindWaiverFile:
    """waiver 파일 탐색 테스트"""

    def test_find_in_same_directory(self, tmp_path):
        """같은 디렉토리에서 찾기"""
        src_dir = tmp_path / "src"
        src_dir.mkdir()
        waiver_path = src_dir / ".waiver.json"
        waiver_path.write_text("{}", encoding="utf-8")
        file_path = src_dir / "test.py"
        file_path.write_text("", encoding="utf-8")

        result = find_waiver_file(file_path, tmp_path)
        assert result == waiver_path

    def test_find_in_parent_directory(self, tmp_path):
        """상위 디렉토리에서 찾기"""
        src_dir = tmp_path / "src" / "module"
        src_dir.mkdir(parents=True)
        waiver_path = tmp_path / ".waiver.json"
        waiver_path.write_text("{}", encoding="utf-8")
        file_path = src_dir / "test.py"
        file_path.write_text("", encoding="utf-8")

        result = find_waiver_file(file_path, tmp_path)
        assert result == waiver_path

    def test_not_found(self, tmp_path):
        """waiver 파일 없음"""
        src_dir = tmp_path / "src"
        src_dir.mkdir()
        file_path = src_dir / "test.py"
        file_path.write_text("", encoding="utf-8")

        result = find_waiver_file(file_path, tmp_path)
        assert result is None


# ============================================================
# Layer 4: 파일 패턴 매칭 테스트
# ============================================================

class TestMatchFilePattern:
    """파일 패턴 매칭 테스트"""

    def test_exact_match(self):
        """정확한 경로 매칭"""
        assert match_file_pattern("src/auth/login.py", "src/auth/login.py")

    def test_wildcard_match(self):
        """와일드카드 매칭"""
        assert match_file_pattern("src/crypto/aes.py", "src/crypto/*.py")

    def test_glob_pattern(self):
        """글롭 패턴"""
        # fnmatch의 * 는 경로 구분자를 포함한 모든 문자와 매칭
        assert match_file_pattern("src/module/sub/file.py", "src/*.py")
        assert match_file_pattern("src/module/file.py", "src/*/*.py")

    def test_no_match(self):
        """매칭 안됨"""
        assert not match_file_pattern("src/auth/login.py", "src/crypto/*.py")

    def test_windows_path_normalization(self):
        """윈도우 경로 정규화"""
        assert match_file_pattern("src\\crypto\\aes.py", "src/crypto/*.py")


# ============================================================
# Layer 5: ExternalWaiverEntry 만료 테스트
# ============================================================

class TestExternalWaiverExpiry:
    """외부 waiver 만료 테스트"""

    def test_not_expired(self):
        """만료되지 않음"""
        future = (date.today() + timedelta(days=30)).isoformat()
        entry = ExternalWaiverEntry(
            pattern="*.py",
            adr="ADR-001",
            expires_at=future,
        )
        assert not entry.is_expired()

    def test_expired(self):
        """만료됨"""
        past = (date.today() - timedelta(days=1)).isoformat()
        entry = ExternalWaiverEntry(
            pattern="*.py",
            adr="ADR-001",
            expires_at=past,
        )
        assert entry.is_expired()

    def test_no_expiry(self):
        """만료일 없음 (영구)"""
        entry = ExternalWaiverEntry(
            pattern="*.py",
            adr="ADR-001",
        )
        assert not entry.is_expired()

    def test_invalid_date_format(self):
        """잘못된 날짜 형식"""
        entry = ExternalWaiverEntry(
            pattern="*.py",
            adr="ADR-001",
            expires_at="invalid-date",
        )
        assert not entry.is_expired()  # 파싱 실패 시 만료되지 않은 것으로


# ============================================================
# Layer 6: 외부 Waiver 체크 테스트
# ============================================================

class TestCheckExternalWaiver:
    """외부 waiver 체크 테스트"""

    def test_valid_waiver(self, tmp_path):
        """유효한 외부 waiver"""
        waiver_data = {
            "version": "1.0",
            "waivers": [
                {
                    "pattern": "src/crypto/*.py",
                    "adr": "ADR-007",
                    "justification": "암호화 알고리즘",
                }
            ]
        }
        waiver_path = tmp_path / ".waiver.json"
        waiver_path.write_text(json.dumps(waiver_data), encoding="utf-8")

        src_dir = tmp_path / "src" / "crypto"
        src_dir.mkdir(parents=True)
        file_path = src_dir / "aes.py"
        file_path.write_text("", encoding="utf-8")

        result = check_external_waiver(file_path, tmp_path)
        assert result.waived
        assert result.adr_path == "ADR-007"
        assert result.reason == "암호화 알고리즘"

    def test_expired_waiver(self, tmp_path):
        """만료된 waiver"""
        past = (date.today() - timedelta(days=1)).isoformat()
        waiver_data = {
            "version": "1.0",
            "waivers": [
                {
                    "pattern": "*.py",
                    "adr": "ADR-001",
                    "expires_at": past,
                }
            ]
        }
        waiver_path = tmp_path / ".waiver.json"
        waiver_path.write_text(json.dumps(waiver_data), encoding="utf-8")

        file_path = tmp_path / "test.py"
        file_path.write_text("", encoding="utf-8")

        result = check_external_waiver(file_path, tmp_path)
        assert not result.waived
        assert "만료됨" in result.reason

    def test_no_matching_pattern(self, tmp_path):
        """매칭되는 패턴 없음"""
        waiver_data = {
            "version": "1.0",
            "waivers": [
                {
                    "pattern": "src/crypto/*.py",
                    "adr": "ADR-007",
                }
            ]
        }
        waiver_path = tmp_path / ".waiver.json"
        waiver_path.write_text(json.dumps(waiver_data), encoding="utf-8")

        file_path = tmp_path / "test.py"
        file_path.write_text("", encoding="utf-8")

        result = check_external_waiver(file_path, tmp_path)
        assert not result.waived


# ============================================================
# Layer 7: 통합 Waiver 체크 테스트
# ============================================================

class TestCheckWaiver:
    """통합 waiver 체크 테스트"""

    def test_external_waiver_priority(self, tmp_path):
        """외부 waiver 우선"""
        waiver_data = {
            "version": "1.0",
            "waivers": [
                {
                    "pattern": "*.py",
                    "adr": "ADR-EXTERNAL",
                }
            ]
        }
        waiver_path = tmp_path / ".waiver.json"
        waiver_path.write_text(json.dumps(waiver_data), encoding="utf-8")

        file_path = tmp_path / "test.py"
        source = '''
__essential_complexity__ = {
    "adr": "docs/adr/inline.md",
}
'''
        file_path.write_text(source, encoding="utf-8")

        result = check_waiver(source, file_path, tmp_path)
        assert result.waived
        assert result.adr_path == "ADR-EXTERNAL"  # 외부 우선

    def test_fallback_to_inline(self, tmp_path):
        """인라인으로 폴백"""
        # ADR 파일 생성
        adr_dir = tmp_path / "docs" / "adr"
        adr_dir.mkdir(parents=True)
        adr_file = adr_dir / "001.md"
        adr_file.write_text("# ADR 001\n" + "x" * 50, encoding="utf-8")

        source = '''
__essential_complexity__ = {
    "adr": "docs/adr/001.md",
}
'''
        file_path = tmp_path / "test.py"
        file_path.write_text(source, encoding="utf-8")

        result = check_waiver(source, file_path, tmp_path)
        assert result.waived
        assert result.adr_path == "docs/adr/001.md"

    def test_no_waiver(self, tmp_path):
        """waiver 없음"""
        source = '''
def foo():
    pass
'''
        file_path = tmp_path / "test.py"
        file_path.write_text(source, encoding="utf-8")

        result = check_waiver(source, file_path, tmp_path)
        assert not result.waived

    def test_without_file_path(self):
        """file_path 없이 (인라인만)"""
        source = '''
__essential_complexity__ = {
    "adr": "docs/adr/001.md",
}
'''
        result = check_waiver(source)
        assert not result.waived  # ADR 파일 존재 안함
