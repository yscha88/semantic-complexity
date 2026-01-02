"""
ADR Schema Definition

Essential Complexity Waiver를 위한 ADR 문서 스키마.

스키마 버전: 1.0
지원 형식: YAML, JSON, TOML
"""

__module_type__ = "lib/domain"

from dataclasses import dataclass, field
from datetime import date, timedelta
from enum import Enum


class ADRStatus(Enum):
    """ADR 상태"""
    DRAFT = "draft"
    APPROVED = "approved"
    DEPRECATED = "deprecated"
    SUPERSEDED = "superseded"


class ExpiryStatus(Enum):
    """만료 상태"""
    ACTIVE = "active"
    WARNING = "warning"      # 30일 이내 만료
    EXPIRED = "expired"


@dataclass
class ApprovalInfo:
    """승인 정보"""
    approved_date: date
    grace_period: timedelta
    approver: str

    @property
    def expiry_date(self) -> date:
        return self.approved_date + self.grace_period


@dataclass
class ConvergenceProof:
    """수렴 증명

    ADR 발급 전 수렴 조건 충족 증명.
    |ΔΦ| < ε for MIN_CONVERGENCE_ITERATIONS.
    """
    snapshot_before: str
    snapshot_after: str
    delta_phi: float
    epsilon: float
    iterations: int
    evidence_complete: bool

    @property
    def is_valid(self) -> bool:
        """수렴 증명 유효 여부"""
        from ...energy.convergence import MIN_CONVERGENCE_ITERATIONS
        return (
            abs(self.delta_phi) < self.epsilon and
            self.iterations >= MIN_CONVERGENCE_ITERATIONS and
            self.evidence_complete
        )


@dataclass
class TargetMetrics:
    """타겟별 메트릭"""
    x: list[float]           # [C, N, S, A, Λ]
    d: float                 # canonical deviation
    hodge: str               # algorithmic | balanced | architectural


@dataclass
class TargetFile:
    """적용 대상 파일"""
    path: str
    signals: list[str] = field(default_factory=list)
    metrics: TargetMetrics | None = None


@dataclass
class Thresholds:
    """허용치"""
    nesting: int | None = None
    concepts: int | None = None


@dataclass
class ADRDocument:
    """ADR 문서

    Essential Complexity Waiver를 위한 ADR 문서 구조.

    예시:
        schema_version: "1.0"
        id: "ADR-001"
        title: "AST 분석기의 본질적 복잡도"
        status: "approved"
        approval:
          approved_date: "2025-01-01"
          grace_period: "180d"
          approver: "tech-lead"
        targets:
          - path: "src/py/semantic_complexity/analyzers/cheese.py"
            signals: ["algorithm/ast-visitor", "algorithm/recursion"]
        thresholds:
          nesting: 7
          concepts: 15
        rationale: |
          AST Visitor 패턴은 컴파일러/분석 도구의 표준 패턴으로...
    """
    schema_version: str
    id: str
    title: str
    status: ADRStatus
    approval: ApprovalInfo
    convergence: ConvergenceProof | None  # NEW: 수렴 증명
    targets: list[TargetFile]
    thresholds: Thresholds
    rationale: str
    references: list[str] = field(default_factory=list)

    def get_target(self, file_path: str) -> TargetFile | None:
        """파일 경로에 해당하는 타겟 반환"""
        normalized = file_path.replace("\\", "/")
        for target in self.targets:
            if normalized.endswith(target.path) or target.path in normalized:
                return target
        return None

    def is_applicable(self, file_path: str) -> bool:
        """파일에 적용 가능한지 확인"""
        return self.get_target(file_path) is not None


# ============================================================
# 공개 API
# ============================================================

__all__ = [
    "ADRStatus",
    "ExpiryStatus",
    "ApprovalInfo",
    "ConvergenceProof",
    "TargetMetrics",
    "TargetFile",
    "Thresholds",
    "ADRDocument",
]
