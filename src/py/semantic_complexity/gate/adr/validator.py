"""
ADR 유효성 검증기

수렴 증명 검증 포함.
"""

__architecture_role__ = "lib/domain"

from dataclasses import dataclass, field
from datetime import date
from typing import Literal

from .schema import ADRDocument, ADRStatus


@dataclass
class ValidationError:
    """검증 오류

    field: 오류 필드
    message: 오류 메시지
    severity: 심각도 (error | warning)
    """
    field: str
    message: str
    severity: Literal["error", "warning"]


@dataclass
class ValidationResult:
    """검증 결과

    valid: 유효 여부 (error 없음)
    errors: 오류 목록
    warnings: 경고 목록
    """
    valid: bool
    errors: list[ValidationError] = field(default_factory=list)
    warnings: list[ValidationError] = field(default_factory=list)


class ADRValidator:
    """ADR 유효성 검증기

    수렴 증명 검증 포함.
    """

    # 상수
    MIN_CONVERGENCE_ITERATIONS = 3
    MIN_RATIONALE_LENGTH = 50
    WARNING_DAYS = 30

    def validate(self, adr: ADRDocument) -> ValidationResult:
        """ADR 유효성 검증

        Args:
            adr: ADRDocument

        Returns:
            ValidationResult
        """
        errors: list[ValidationError] = []
        warnings: list[ValidationError] = []

        # 필수 필드 검증
        self._validate_required_fields(adr, errors)

        # 상태 검증
        self._validate_status(adr, errors, warnings)

        # 유효 기간 검증
        self._validate_grace_period(adr, errors, warnings)

        # 임계값 검증
        self._validate_thresholds(adr, errors)

        # 신호 검증
        self._validate_signals(adr, errors, warnings)

        # 수렴 증명 검증
        self._validate_convergence(adr, errors)

        # rationale 검증
        self._validate_rationale(adr, errors, warnings)

        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
        )

    def _validate_required_fields(
        self,
        adr: ADRDocument,
        errors: list[ValidationError],
    ) -> None:
        """필수 필드 검증"""
        if not adr.id:
            errors.append(ValidationError(
                "id",
                "ADR ID 필수",
                "error",
            ))

        if not adr.title:
            errors.append(ValidationError(
                "title",
                "ADR 제목 필수",
                "error",
            ))

        if not adr.targets:
            errors.append(ValidationError(
                "targets",
                "대상 파일 최소 1개 필수",
                "error",
            ))

    def _validate_status(
        self,
        adr: ADRDocument,
        errors: list[ValidationError],
        warnings: list[ValidationError],
    ) -> None:
        """상태 검증"""
        if adr.status == ADRStatus.DEPRECATED:
            warnings.append(ValidationError(
                "status",
                "ADR이 deprecated 상태",
                "warning",
            ))

        if adr.status == ADRStatus.SUPERSEDED:
            warnings.append(ValidationError(
                "status",
                "ADR이 superseded 상태 - 새 ADR 확인 필요",
                "warning",
            ))

        if adr.status == ADRStatus.DRAFT:
            errors.append(ValidationError(
                "status",
                "ADR이 draft 상태 - approved 필요",
                "error",
            ))

    def _validate_grace_period(
        self,
        adr: ADRDocument,
        errors: list[ValidationError],
        warnings: list[ValidationError],
    ) -> None:
        """유효 기간 검증"""
        today = date.today()
        expiry_date = adr.approval.expiry_date

        if expiry_date < today:
            errors.append(ValidationError(
                "approval.grace_period",
                f"ADR 만료됨 ({expiry_date})",
                "error",
            ))
        elif (expiry_date - today).days <= self.WARNING_DAYS:
            remaining = (expiry_date - today).days
            warnings.append(ValidationError(
                "approval.grace_period",
                f"ADR 만료 임박 ({remaining}일 후)",
                "warning",
            ))

    def _validate_thresholds(
        self,
        adr: ADRDocument,
        errors: list[ValidationError],
    ) -> None:
        """임계값 검증"""
        th = adr.thresholds

        # 최소한 하나는 설정되어야 함
        if th.nesting is None and th.concepts is None:
            errors.append(ValidationError(
                "thresholds",
                "nesting 또는 concepts 임계값 필수",
                "error",
            ))

        # 합리적 범위 검증
        if th.nesting is not None:
            if th.nesting < 4:
                errors.append(ValidationError(
                    "thresholds.nesting",
                    f"nesting={th.nesting} 너무 낮음 (최소 4)",
                    "error",
                ))
            elif th.nesting > 15:
                errors.append(ValidationError(
                    "thresholds.nesting",
                    f"nesting={th.nesting} 너무 높음 (최대 15)",
                    "error",
                ))

        if th.concepts is not None:
            if th.concepts < 5:
                errors.append(ValidationError(
                    "thresholds.concepts",
                    f"concepts={th.concepts} 너무 낮음 (최소 5)",
                    "error",
                ))
            elif th.concepts > 30:
                errors.append(ValidationError(
                    "thresholds.concepts",
                    f"concepts={th.concepts} 너무 높음 (최대 30)",
                    "error",
                ))

    def _validate_signals(
        self,
        adr: ADRDocument,
        errors: list[ValidationError],
        warnings: list[ValidationError],
    ) -> None:
        """신호 검증"""
        for target in adr.targets:
            if not target.signals:
                warnings.append(ValidationError(
                    f"targets[{target.path}].signals",
                    "본질적 복잡도 신호 없음 - 정당성 검토 필요",
                    "warning",
                ))

    def _validate_convergence(
        self,
        adr: ADRDocument,
        errors: list[ValidationError],
    ) -> None:
        """수렴 증명 검증

        ADR 발급 조건:
        - |ΔΦ| < ε
        - iterations >= MIN_CONVERGENCE_ITERATIONS
        - evidence_complete = true
        """
        conv = adr.convergence

        if conv is None:
            # 수렴 증명이 없어도 기존 ADR은 허용
            # 새 ADR은 수렴 증명 필수
            return

        # ε-수렴 조건
        if abs(conv.delta_phi) >= conv.epsilon:
            errors.append(ValidationError(
                "convergence.delta_phi",
                f"|ΔΦ|={abs(conv.delta_phi):.4f} >= ε={conv.epsilon} - 수렴 안 됨",
                "error",
            ))

        # 연속 수렴 횟수
        if conv.iterations < self.MIN_CONVERGENCE_ITERATIONS:
            errors.append(ValidationError(
                "convergence.iterations",
                f"iterations={conv.iterations} < {self.MIN_CONVERGENCE_ITERATIONS} 필요",
                "error",
            ))

        # Evidence 완비
        if not conv.evidence_complete:
            errors.append(ValidationError(
                "convergence.evidence_complete",
                "Evidence 불완전",
                "error",
            ))

        # 스냅샷 참조 확인
        if not conv.snapshot_before or not conv.snapshot_after:
            errors.append(ValidationError(
                "convergence.snapshots",
                "스냅샷 참조 필수",
                "error",
            ))

    def _validate_rationale(
        self,
        adr: ADRDocument,
        errors: list[ValidationError],
        warnings: list[ValidationError],
    ) -> None:
        """rationale 검증"""
        if not adr.rationale:
            errors.append(ValidationError(
                "rationale",
                "근거(rationale) 필수",
                "error",
            ))
        elif len(adr.rationale.strip()) < self.MIN_RATIONALE_LENGTH:
            warnings.append(ValidationError(
                "rationale",
                f"근거가 너무 짧음 ({len(adr.rationale.strip())}자 < {self.MIN_RATIONALE_LENGTH}자)",
                "warning",
            ))


def validate_adr(adr: ADRDocument) -> ValidationResult:
    """ADR 유효성 검증 (단축 함수)

    Args:
        adr: ADRDocument

    Returns:
        ValidationResult
    """
    validator = ADRValidator()
    return validator.validate(adr)


# ============================================================
# 공개 API
# ============================================================

__all__ = [
    "ValidationError",
    "ValidationResult",
    "ADRValidator",
    "validate_adr",
]
