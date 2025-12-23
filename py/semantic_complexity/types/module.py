"""
모듈 타입 정의 - 2계층 구조

1차: 구조 축 (Structural Axis) - 베이스라인
2차: 도메인 축 (Domain Axis) - Delta 조정

확장 방식:
1. 기본 내장 타입 (DEFAULT_*)
2. .semantic-complexity.yaml 통한 override/확장
"""

from __future__ import annotations

__module_type__ = "types"

from dataclasses import dataclass, field
from typing import Literal


# ============================================================
# 1차 구조축 (Structural Axis)
# ============================================================

StructuralAxis = Literal["api", "web", "app", "job", "lib", "deploy", "data"]

STRUCTURAL_AXES: tuple[StructuralAxis, ...] = (
    "api",
    "web",
    "app",
    "job",
    "lib",
    "deploy",
    "data",
)


@dataclass(frozen=True)
class StructuralDefinition:
    """1차 구조축 정의"""
    axis: StructuralAxis
    description: str
    characteristics: str
    patterns: tuple[str, ...] = ()


# 1차 구조축 기본 정의
DEFAULT_STRUCTURAL_DEFINITIONS: dict[StructuralAxis, StructuralDefinition] = {
    "api": StructuralDefinition(
        axis="api",
        description="UI 없이 endpoint만 노출",
        characteristics="경계면 역할, 검증 집중",
        patterns=(
            "**/api/**",
            "**/routes/**",
            "**/handlers/**",
            "**/endpoints/**",
        ),
    ),
    "web": StructuralDefinition(
        axis="web",
        description="자체 Web UI + endpoint 가능",
        characteristics="프레젠테이션 + API",
        patterns=(
            "**/web/**",
            "**/pages/**",
            "**/views/**",
            "**/templates/**",
            "**/components/**",
        ),
    ),
    "app": StructuralDefinition(
        axis="app",
        description="핵심 비즈니스 로직",
        characteristics="상태/비동기/워크플로우",
        patterns=(
            "**/app/**",
            "**/services/**",
            "**/use_cases/**",
            "**/application/**",
        ),
    ),
    "job": StructuralDefinition(
        axis="job",
        description="일회성/주기적 실행",
        characteristics="Batch, Cron, Worker",
        patterns=(
            "**/jobs/**",
            "**/tasks/**",
            "**/workers/**",
            "**/cron/**",
            "**/batch/**",
        ),
    ),
    "lib": StructuralDefinition(
        axis="lib",
        description="라이브러리 형태",
        characteristics="재사용, 순수성 지향",
        patterns=(
            "**/lib/**",
            "**/utils/**",
            "**/common/**",
            "**/shared/**",
            "**/domain/**",
        ),
    ),
    "deploy": StructuralDefinition(
        axis="deploy",
        description="배포/인프라 구성",
        characteristics="선언적, 보안 중심",
        patterns=(
            "**/deploy/**",
            "**/k8s/**",
            "**/helm/**",
            "**/manifests/**",
            "**/.github/workflows/**",
            "**/Dockerfile",
            "**/docker-compose*",
        ),
    ),
    "data": StructuralDefinition(
        axis="data",
        description="데이터/스토리지",
        characteristics="스키마, 마이그레이션",
        patterns=(
            "**/data/**",
            "**/migrations/**",
            "**/schemas/**",
            "**/models/**",
            "**/seeds/**",
        ),
    ),
}


# ============================================================
# 2차 도메인축 (Domain Axis)
# ============================================================

@dataclass(frozen=True)
class DomainDefinition:
    """2차 도메인축 정의"""
    domain: str  # e.g., "external", "internal", "workflow"
    parent: StructuralAxis
    description: str
    characteristics: str
    patterns: tuple[str, ...] = ()

    @property
    def full_type(self) -> str:
        """전체 타입명 (e.g., 'api/external')"""
        return f"{self.parent}/{self.domain}"


# 2차 도메인축 기본 정의
DEFAULT_DOMAIN_DEFINITIONS: dict[str, DomainDefinition] = {
    # api/*
    "api/external": DomainDefinition(
        domain="external",
        parent="api",
        description="외부 노출 API (고객, 3rd-party)",
        characteristics="🍞↑↑ authn/authz, rate limit, audit, 계약테스트",
        patterns=(
            "**/api/external/**",
            "**/api/public/**",
            "**/api/v*/**",
            "**/routes/public/**",
        ),
    ),
    "api/internal": DomainDefinition(
        domain="internal",
        parent="api",
        description="내부 서비스간 API",
        characteristics="🍞↑ 계약 필요하지만 유연",
        patterns=(
            "**/api/internal/**",
            "**/grpc/**",
            "**/events/**",
        ),
    ),
    "api/gateway": DomainDefinition(
        domain="gateway",
        parent="api",
        description="API Gateway, BFF",
        characteristics="🍞↑↑ 라우팅, 인증 집중",
        patterns=(
            "**/gateway/**",
            "**/bff/**",
        ),
    ),

    # web/*
    "web/public": DomainDefinition(
        domain="public",
        parent="web",
        description="공개 웹사이트",
        characteristics="🍞↑ XSS/CSRF, 접근성",
        patterns=(
            "**/web/public/**",
            "**/pages/public/**",
        ),
    ),
    "web/admin": DomainDefinition(
        domain="admin",
        parent="web",
        description="관리자 대시보드",
        characteristics="🍞↑↑ 권한 관리, 감사",
        patterns=(
            "**/web/admin/**",
            "**/admin/**",
            "**/dashboard/**",
        ),
    ),
    "web/internal": DomainDefinition(
        domain="internal",
        parent="web",
        description="내부 도구",
        characteristics="🍞↓ 상대적으로 유연",
        patterns=(
            "**/web/internal/**",
            "**/tools/**",
        ),
    ),

    # app/*
    "app/workflow": DomainDefinition(
        domain="workflow",
        parent="app",
        description="상태머신, saga, orchestration",
        characteristics="🧀↑↑↑ retry/timeout, 맥락밀도 폭발",
        patterns=(
            "**/workflows/**",
            "**/orchestration/**",
            "**/saga/**",
            "**/state_machine/**",
        ),
    ),
    "app/adapter": DomainDefinition(
        domain="adapter",
        parent="app",
        description="외부 시스템 연결 (PACS/EHR/S3)",
        characteristics="🧀↑ hidden coupling 위험",
        patterns=(
            "**/adapters/**",
            "**/integrations/**",
            "**/connectors/**",
        ),
    ),
    "app/service": DomainDefinition(
        domain="service",
        parent="app",
        description="일반 비즈니스 서비스",
        characteristics="균형",
        patterns=(
            "**/services/**",
            "**/use_cases/**",
        ),
    ),

    # job/*
    "job/batch": DomainDefinition(
        domain="batch",
        parent="job",
        description="대량 데이터 처리",
        characteristics="🧀↑ 상태 관리, 재시작",
        patterns=(
            "**/batch/**",
            "**/bulk/**",
        ),
    ),
    "job/cron": DomainDefinition(
        domain="cron",
        parent="job",
        description="주기적 스케줄 작업",
        characteristics="🧀↑ 멱등성 필요",
        patterns=(
            "**/cron/**",
            "**/scheduled/**",
        ),
    ),
    "job/worker": DomainDefinition(
        domain="worker",
        parent="job",
        description="큐 기반 비동기 워커",
        characteristics="🧀↑ retry, dead letter",
        patterns=(
            "**/workers/**",
            "**/consumers/**",
        ),
    ),
    "job/migration": DomainDefinition(
        domain="migration",
        parent="job",
        description="데이터 마이그레이션",
        characteristics="🍞↑ 롤백, 검증",
        patterns=(
            "**/migrations/**",
            "**/migrate/**",
        ),
    ),

    # lib/*
    "lib/domain": DomainDefinition(
        domain="domain",
        parent="lib",
        description="도메인 규칙, 정책, 검증",
        characteristics="🥓↑↑ 순수, 테스트 용이",
        patterns=(
            "**/domain/**",
            "**/rules/**",
            "**/validators/**",
            "**/policies/**",
        ),
    ),
    "lib/infra": DomainDefinition(
        domain="infra",
        parent="lib",
        description="공용 클라이언트, 미들웨어",
        characteristics="🍞↑ 보안 유틸 포함",
        patterns=(
            "**/infrastructure/**",
            "**/clients/**",
            "**/middleware/**",
        ),
    ),
    "lib/common": DomainDefinition(
        domain="common",
        parent="lib",
        description="공용 유틸리티",
        characteristics="🥓↑ 순수 함수 지향",
        patterns=(
            "**/utils/**",
            "**/helpers/**",
            "**/common/**",
        ),
    ),

    # deploy/*
    "deploy/cluster": DomainDefinition(
        domain="cluster",
        parent="deploy",
        description="ingress, cert-manager, netpol",
        characteristics="🍞↑↑↑ 인프라 보안",
        patterns=(
            "**/cluster/**",
            "**/infra/**",
            "**/network/**",
        ),
    ),
    "deploy/app": DomainDefinition(
        domain="app",
        parent="deploy",
        description="values, env, secret refs, HPA",
        characteristics="🍞↑↑ 앱 배포 구성",
        patterns=(
            "**/apps/**",
            "**/values/**",
            "**/envs/**",
        ),
    ),
    "deploy/security": DomainDefinition(
        domain="security",
        parent="deploy",
        description="mTLS, PKI, IAM/RBAC, OPA",
        characteristics="🍞↑↑↑ 보안 정책",
        patterns=(
            "**/security/**",
            "**/rbac/**",
            "**/policies/**",
            "**/pki/**",
        ),
    ),
    "deploy/ci-cd": DomainDefinition(
        domain="ci-cd",
        parent="deploy",
        description="파이프라인, 빌드 구성",
        characteristics="🍞↑ 공급망 보안",
        patterns=(
            "**/.github/**",
            "**/ci/**",
            "**/pipelines/**",
        ),
    ),

    # data/*
    "data/schema": DomainDefinition(
        domain="schema",
        parent="data",
        description="DB 스키마, 테이블 정의",
        characteristics="🍞↑ 데이터 무결성",
        patterns=(
            "**/schemas/**",
            "**/tables/**",
            "**/ddl/**",
        ),
    ),
    "data/migration": DomainDefinition(
        domain="migration",
        parent="data",
        description="스키마 마이그레이션",
        characteristics="🍞↑ 🥓↑ 롤백, 검증",
        patterns=(
            "**/migrations/**",
            "**/alembic/**",
        ),
    ),
    "data/seed": DomainDefinition(
        domain="seed",
        parent="data",
        description="초기/테스트 데이터",
        characteristics="🥓↑ 재현성",
        patterns=(
            "**/seeds/**",
            "**/fixtures/**",
        ),
    ),
    "data/etl": DomainDefinition(
        domain="etl",
        parent="data",
        description="데이터 파이프라인",
        characteristics="🧀↑ 상태/변환",
        patterns=(
            "**/etl/**",
            "**/pipelines/**",
            "**/transforms/**",
        ),
    ),
}


# ============================================================
# ModuleType - 확장 가능한 구조
# ============================================================

@dataclass
class ModuleType:
    """
    모듈 타입 (확장 가능)

    표현 형식:
    - 1차만: "api", "lib", "deploy"
    - 2차 포함: "api/external", "lib/domain", "deploy/security"
    """
    structural: StructuralAxis
    domain: str | None = None

    def __post_init__(self):
        # 유효성 검증
        if self.structural not in STRUCTURAL_AXES:
            raise ValueError(f"Unknown structural axis: {self.structural}")

    def __str__(self) -> str:
        if self.domain:
            return f"{self.structural}/{self.domain}"
        return self.structural

    def __hash__(self) -> int:
        return hash(str(self))

    def __eq__(self, other: object) -> bool:
        if isinstance(other, ModuleType):
            return str(self) == str(other)
        if isinstance(other, str):
            return str(self) == other
        return False

    @classmethod
    def from_string(cls, type_str: str) -> "ModuleType":
        """문자열에서 ModuleType 생성"""
        if "/" in type_str:
            structural, domain = type_str.split("/", 1)
            return cls(structural=structural, domain=domain)  # type: ignore
        return cls(structural=type_str)  # type: ignore

    @property
    def full_type(self) -> str:
        """전체 타입명"""
        return str(self)

    @property
    def is_secondary(self) -> bool:
        """2차 도메인축 포함 여부"""
        return self.domain is not None


# 타입 힌트용
ModuleTypeLiteral = str  # 실제로는 "api", "api/external" 등의 문자열


# ============================================================
# 호환성 변수 (기존 인터페이스 유지)
# ============================================================

# 모듈 타입별 패턴 (glob 패턴)
MODULE_PATTERNS: dict[str, tuple[str, ...]] = {
    axis: defn.patterns
    for axis, defn in DEFAULT_STRUCTURAL_DEFINITIONS.items()
}
MODULE_PATTERNS.update({
    full_type: defn.patterns
    for full_type, defn in DEFAULT_DOMAIN_DEFINITIONS.items()
})

# 모듈 타입별 설명
MODULE_DESCRIPTIONS: dict[str, str] = {
    axis: defn.description
    for axis, defn in DEFAULT_STRUCTURAL_DEFINITIONS.items()
}
MODULE_DESCRIPTIONS.update({
    full_type: defn.description
    for full_type, defn in DEFAULT_DOMAIN_DEFINITIONS.items()
})


# ============================================================
# 레지스트리 - 런타임 확장
# ============================================================

class ModuleTypeRegistry:
    """
    모듈 타입 레지스트리

    기본 정의 + 사용자 확장 관리
    """

    def __init__(self):
        self._structural: dict[StructuralAxis, StructuralDefinition] = (
            dict(DEFAULT_STRUCTURAL_DEFINITIONS)
        )
        self._domain: dict[str, DomainDefinition] = (
            dict(DEFAULT_DOMAIN_DEFINITIONS)
        )

    def get_structural(self, axis: StructuralAxis) -> StructuralDefinition | None:
        """1차 구조축 정의 조회"""
        return self._structural.get(axis)

    def get_domain(self, full_type: str) -> DomainDefinition | None:
        """2차 도메인축 정의 조회"""
        return self._domain.get(full_type)

    def register_structural(self, definition: StructuralDefinition) -> None:
        """1차 구조축 등록/override"""
        self._structural[definition.axis] = definition

    def register_domain(self, definition: DomainDefinition) -> None:
        """2차 도메인축 등록/override"""
        self._domain[definition.full_type] = definition

    def list_structural(self) -> list[StructuralAxis]:
        """등록된 1차 구조축 목록"""
        return list(self._structural.keys())

    def list_domains(self, parent: StructuralAxis | None = None) -> list[str]:
        """등록된 2차 도메인축 목록"""
        if parent:
            return [k for k, v in self._domain.items() if v.parent == parent]
        return list(self._domain.keys())

    def get_patterns(self, module_type: ModuleType) -> tuple[str, ...]:
        """모듈 타입의 패턴 목록 조회"""
        if module_type.domain:
            domain_def = self.get_domain(str(module_type))
            if domain_def:
                return domain_def.patterns

        structural_def = self.get_structural(module_type.structural)
        if structural_def:
            return structural_def.patterns

        return ()


# 전역 레지스트리
_registry = ModuleTypeRegistry()


def get_registry() -> ModuleTypeRegistry:
    """전역 레지스트리 반환"""
    return _registry


def reset_registry() -> None:
    """레지스트리 초기화 (테스트용)"""
    global _registry
    _registry = ModuleTypeRegistry()


# ============================================================
# 기본 모듈 타입
# ============================================================

# __module_type__ 미선언 시 기본값
DEFAULT_MODULE_TYPE = ModuleType(structural="app")
