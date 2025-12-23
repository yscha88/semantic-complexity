"""
모듈 타입 자동 탐지

파일 경로 패턴을 기반으로 모듈 타입 추론
"""

import fnmatch
from pathlib import Path

from ..types import ModuleType, MODULE_PATTERNS


# 기본 모듈 타입 (상수)
DEFAULT_MODULE_TYPE = ModuleType(structural="app")


def detect_module_type(file_path: str) -> ModuleType:
    """
    파일 경로에서 모듈 타입 추론

    Args:
        file_path: 파일 경로

    Returns:
        ModuleType: 추론된 모듈 타입 (기본값: app)
    """
    # 경로 정규화
    normalized = file_path.replace("\\", "/").lower()

    # 각 모듈 타입의 패턴과 매칭
    for module_type_str, patterns in MODULE_PATTERNS.items():
        for pattern in patterns:
            pattern_lower = pattern.lower()
            if fnmatch.fnmatch(normalized, pattern_lower):
                return ModuleType.from_string(module_type_str)

    # 기본값
    return DEFAULT_MODULE_TYPE


def detect_module_type_from_content(source: str) -> ModuleType | None:
    """
    소스 코드 내용에서 모듈 타입 힌트 추론

    Args:
        source: 소스 코드

    Returns:
        ModuleType or None
    """
    source_lower = source.lower()

    # Deploy 힌트
    deploy_hints = ["apiversion:", "kind:", "kubectl", "helm", "argocd"]
    if any(hint in source_lower for hint in deploy_hints):
        return ModuleType(structural="deploy")

    # API External 힌트
    api_external_hints = ["@api_view", "openapi", "swagger", "@router."]
    if any(hint in source_lower for hint in api_external_hints):
        return ModuleType(structural="api", domain="external")

    # API Internal 힌트
    api_internal_hints = ["grpc", "@internal", "message_queue", "kafka"]
    if any(hint in source_lower for hint in api_internal_hints):
        return ModuleType(structural="api", domain="internal")

    # Domain 힌트
    domain_hints = ["@dataclass", "class.*entity", "class.*aggregate", "@validator"]
    if any(hint in source_lower for hint in domain_hints):
        return ModuleType(structural="lib", domain="domain")

    # Infra 힌트
    infra_hints = ["@client", "http_client", "database", "repository"]
    if any(hint in source_lower for hint in infra_hints):
        return ModuleType(structural="lib", domain="infra")

    return None


def detect_with_fallback(
    file_path: str,
    source: str | None = None,
    default: ModuleType | None = None,
) -> ModuleType:
    """
    경로와 내용을 조합하여 모듈 타입 추론

    Args:
        file_path: 파일 경로
        source: 소스 코드 (선택)
        default: 기본값

    Returns:
        ModuleType
    """
    if default is None:
        default = DEFAULT_MODULE_TYPE

    # 1. 경로 기반 탐지
    path_result = detect_module_type(file_path)
    if path_result != DEFAULT_MODULE_TYPE:  # app이 아니면 확정
        return path_result

    # 2. 내용 기반 탐지 (경로가 app으로 판단된 경우)
    if source:
        content_result = detect_module_type_from_content(source)
        if content_result:
            return content_result

    return default
