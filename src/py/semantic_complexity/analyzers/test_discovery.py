"""
Test file discovery for Ham analyzer.

테스트 파일 자동 탐색:
- 소스 파일과 관련된 테스트 파일 찾기
- 테스트 디렉토리 구조 파악
- 테스트 소스 코드 로드
"""

__architecture_role__ = "lib/infra"

import re
from pathlib import Path


def find_test_dir(source_path: Path) -> Path | None:
    """프로젝트 루트에서 테스트 디렉토리 찾기."""
    current = source_path.parent

    # 상위로 올라가면서 tests/ 또는 test/ 찾기
    for _ in range(10):  # 최대 10단계
        for test_dir_name in ["tests", "test"]:
            test_dir = current / test_dir_name
            if test_dir.is_dir():
                return test_dir

        parent = current.parent
        if parent == current:
            break
        current = parent

    return None


def get_module_name(source_path: Path) -> str:
    """소스 파일에서 모듈 이름 추출."""
    stem = source_path.stem
    return stem


def get_parent_package(source_path: Path) -> str | None:
    """소스 파일의 부모 패키지 이름 추출."""
    parent = source_path.parent
    if parent.name and parent.name != "src":
        return parent.name
    return None


def find_related_tests(source_path: Path) -> list[Path]:
    """소스 파일과 관련된 테스트 파일 찾기."""
    test_dir = find_test_dir(source_path)
    if not test_dir:
        return []

    module_name = get_module_name(source_path)
    parent_pkg = get_parent_package(source_path)

    test_files: list[Path] = []

    # 테스트 파일 패턴들
    patterns = [
        f"test_{module_name}.py",
        f"{module_name}_test.py",
    ]

    # 부모 패키지가 있으면 추가 패턴
    if parent_pkg:
        patterns.extend([
            f"test_{parent_pkg}_{module_name}.py",
            f"test_{parent_pkg}.py",
        ])

    # 테스트 디렉토리에서 검색
    for pattern in patterns:
        for test_file in test_dir.rglob(pattern):
            if test_file.is_file():
                test_files.append(test_file)

    # 중복 제거
    return list(set(test_files))


def load_test_sources(test_files: list[Path]) -> dict[str, str]:
    """테스트 파일들의 소스 코드 로드."""
    sources: dict[str, str] = {}

    for test_file in test_files:
        try:
            content = test_file.read_text(encoding="utf-8")
            sources[str(test_file)] = content
        except Exception:
            continue

    return sources


def discover_tests(source_path: str | Path | None) -> dict[str, str]:
    """
    소스 파일과 관련된 테스트 파일 탐색 및 로드.

    Args:
        source_path: 소스 파일 경로

    Returns:
        {test_file_path: test_source_code}
    """
    if not source_path:
        return {}

    path = Path(source_path)
    if not path.exists():
        return {}

    test_files = find_related_tests(path)
    return load_test_sources(test_files)


__all__ = [
    "discover_tests",
    "find_related_tests",
    "find_test_dir",
]
