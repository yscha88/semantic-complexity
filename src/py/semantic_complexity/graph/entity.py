"""
Entity (코드 엔티티)

시간에 독립적인 안정적 정체성.

entity_id: AST fingerprint 기반 stable ID
type: module | file | func | object
"""

__architecture_role__ = "lib/domain"

import hashlib
from dataclasses import dataclass
from enum import Enum
from typing import Literal


class EntityType(Enum):
    """엔티티 타입"""
    MODULE = "module"
    FILE = "file"
    FUNC = "func"
    OBJECT = "object"


@dataclass
class Entity:
    """코드 엔티티 (안정적 정체성)

    entity_id: stable identifier (hash)
    type: 엔티티 타입
    path: 파일 경로
    symbol: 함수/클래스 이름
    language: 언어
    """
    entity_id: str
    type: EntityType
    path: str
    symbol: str
    language: Literal["python", "typescript", "go"]

    @property
    def qualified_name(self) -> str:
        """정규화된 이름"""
        return f"{self.path}:{self.symbol}"

    def to_dict(self) -> dict:
        """dict 변환"""
        return {
            "entity_id": self.entity_id,
            "type": self.type.value,
            "path": self.path,
            "symbol": self.symbol,
            "language": self.language,
        }


def create_entity_id(
    path: str,
    symbol: str,
    language: str,
    content_hash: str | None = None,
) -> str:
    """엔티티 ID 생성

    AST fingerprint 기반 stable ID.

    Args:
        path: 파일 경로
        symbol: 심볼 이름
        language: 언어
        content_hash: 콘텐츠 해시 (옵션)

    Returns:
        entity_id (sha256 앞 16자)
    """
    # 경로 정규화
    normalized_path = path.replace("\\", "/")

    # fingerprint 생성
    fingerprint_parts = [normalized_path, symbol, language]
    if content_hash:
        fingerprint_parts.append(content_hash)

    fingerprint = ":".join(fingerprint_parts)
    hash_value = hashlib.sha256(fingerprint.encode()).hexdigest()

    return hash_value[:16]


def create_entity(
    path: str,
    symbol: str,
    entity_type: EntityType,
    language: Literal["python", "typescript", "go"] = "python",
    content_hash: str | None = None,
) -> Entity:
    """Entity 생성

    Args:
        path: 파일 경로
        symbol: 심볼 이름
        entity_type: 엔티티 타입
        language: 언어
        content_hash: 콘텐츠 해시 (옵션)

    Returns:
        Entity
    """
    entity_id = create_entity_id(path, symbol, language, content_hash)

    return Entity(
        entity_id=entity_id,
        type=entity_type,
        path=path,
        symbol=symbol,
        language=language,
    )


# ============================================================
# 공개 API
# ============================================================

__all__ = [
    "EntityType",
    "Entity",
    "create_entity_id",
    "create_entity",
]
