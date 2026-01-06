"""
Evidence 타입 정의

RuleHit: 규칙 히트 (측정 근거)
Location: 코드 위치 정보
"""

__architecture_role__ = "lib/domain"

from dataclasses import dataclass, field


@dataclass
class Location:
    """코드 위치

    file:line:column 형식으로 AST 노드 위치 추적.
    """
    file: str
    line: int
    column: int | None = None
    ast_node_type: str | None = None

    def __str__(self) -> str:
        col = f":{self.column}" if self.column else ""
        node = f" ({self.ast_node_type})" if self.ast_node_type else ""
        return f"{self.file}:{self.line}{col}{node}"


@dataclass
class RuleHit:
    """규칙 히트 (측정 근거)

    rule_id: "nesting/depth", "state/mutation", "control/branch" 등
    count: 탐지된 횟수
    locations: 탐지된 위치 목록

    Evidence 역할:
    - 왜 이 점수가 나왔는지 추적
    - ADR 발급 시 근거 자료로 사용
    """
    entity_id: str
    snapshot_id: str
    rule_id: str
    count: int
    locations: list[Location] = field(default_factory=list)

    def has_evidence(self) -> bool:
        """위치 정보가 있는지 확인"""
        return len(self.locations) > 0

    def to_dict(self) -> dict:
        """dict 변환 (JSON 직렬화용)"""
        return {
            "entity_id": self.entity_id,
            "snapshot_id": self.snapshot_id,
            "rule_id": self.rule_id,
            "count": self.count,
            "locations": [
                {
                    "file": loc.file,
                    "line": loc.line,
                    "column": loc.column,
                    "ast_node_type": loc.ast_node_type,
                }
                for loc in self.locations
            ],
        }


# ============================================================
# 공개 API
# ============================================================

__all__ = [
    "Location",
    "RuleHit",
]
