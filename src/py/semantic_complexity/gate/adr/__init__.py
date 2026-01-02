"""
gate/adr 모듈

ADR (Architecture Decision Record) 기반 Essential Complexity Waiver.

구성요소:
- schema.py: ADR 스키마 정의
- parser.py: ADR 파일 파서 (YAML/JSON/TOML)
- validator.py: ADR 유효성 검증 (수렴 포함)
- expiry.py: 만료 관리
"""

__module_type__ = "lib/domain"

from .schema import (
    ADRStatus,
    ExpiryStatus,
    ApprovalInfo,
    ConvergenceProof,
    TargetMetrics,
    TargetFile,
    Thresholds,
    ADRDocument,
)
from .parser import (
    parse_adr_file,
    parse_adr_yaml,
    parse_adr_json,
)
from .validator import (
    ValidationError,
    ValidationResult,
    ADRValidator,
)
from .expiry import (
    ExpiryInfo,
    check_expiry,
    get_expiry_warning,
)

__all__ = [
    # Schema
    "ADRStatus",
    "ExpiryStatus",
    "ApprovalInfo",
    "ConvergenceProof",
    "TargetMetrics",
    "TargetFile",
    "Thresholds",
    "ADRDocument",
    # Parser
    "parse_adr_file",
    "parse_adr_yaml",
    "parse_adr_json",
    # Validator
    "ValidationError",
    "ValidationResult",
    "ADRValidator",
    # Expiry
    "ExpiryInfo",
    "check_expiry",
    "get_expiry_warning",
]
