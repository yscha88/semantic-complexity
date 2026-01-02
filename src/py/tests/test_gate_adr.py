"""
gate/adr 모듈 테스트

- schema: ADR 스키마
- parser: ADR 파서
- validator: ADR 검증기
- expiry: 만료 관리
"""

import pytest
from datetime import date, timedelta

from semantic_complexity.gate.adr import (
    ADRDocument,
    ADRStatus,
    ExpiryStatus,
    ApprovalInfo,
    ConvergenceProof,
    TargetFile,
    TargetMetrics,
    Thresholds,
    parse_adr_yaml,
    ValidationError,
    ValidationResult,
    ADRValidator,
    ExpiryInfo,
    check_expiry,
    get_expiry_warning,
)
from semantic_complexity.gate.adr.parser import adr_to_dict
from semantic_complexity.gate.adr.expiry import (
    is_expired,
    is_warning,
    is_active,
    format_expiry_badge,
)
from semantic_complexity.gate.adr.validator import validate_adr


# ============================================================
# Schema 테스트
# ============================================================

class TestSchema:
    """ADR 스키마 테스트"""

    def test_adr_status_values(self):
        """ADRStatus 값"""
        assert ADRStatus.DRAFT.value == "draft"
        assert ADRStatus.APPROVED.value == "approved"
        assert ADRStatus.DEPRECATED.value == "deprecated"

    def test_expiry_status_values(self):
        """ExpiryStatus 값"""
        assert ExpiryStatus.ACTIVE.value == "active"
        assert ExpiryStatus.WARNING.value == "warning"
        assert ExpiryStatus.EXPIRED.value == "expired"

    def test_approval_info_expiry_date(self):
        """만료일 계산"""
        approval = ApprovalInfo(
            approved_date=date(2025, 1, 1),
            grace_period=timedelta(days=180),
            approver="tech-lead",
        )
        assert approval.expiry_date == date(2025, 6, 30)

    def test_convergence_proof_valid(self):
        """수렴 증명 유효"""
        conv = ConvergenceProof(
            snapshot_before="snap-1",
            snapshot_after="snap-2",
            delta_phi=0.005,
            epsilon=0.01,
            iterations=3,
            evidence_complete=True,
        )
        assert conv.is_valid is True

    def test_convergence_proof_invalid_delta(self):
        """수렴 증명 무효 - delta 초과"""
        conv = ConvergenceProof(
            snapshot_before="snap-1",
            snapshot_after="snap-2",
            delta_phi=0.02,  # > epsilon
            epsilon=0.01,
            iterations=3,
            evidence_complete=True,
        )
        assert conv.is_valid is False

    def test_convergence_proof_invalid_iterations(self):
        """수렴 증명 무효 - iterations 부족"""
        conv = ConvergenceProof(
            snapshot_before="snap-1",
            snapshot_after="snap-2",
            delta_phi=0.005,
            epsilon=0.01,
            iterations=2,  # < 3
            evidence_complete=True,
        )
        assert conv.is_valid is False

    def test_adr_document_is_applicable(self):
        """적용 가능 여부"""
        adr = ADRDocument(
            schema_version="1.0",
            id="ADR-001",
            title="Test ADR",
            status=ADRStatus.APPROVED,
            approval=ApprovalInfo(date.today(), timedelta(days=180), "approver"),
            convergence=None,
            targets=[TargetFile(path="src/main.py")],
            thresholds=Thresholds(nesting=7),
            rationale="Test rationale that is long enough.",
        )
        assert adr.is_applicable("src/main.py") is True
        assert adr.is_applicable("src/other.py") is False

    def test_adr_document_get_target(self):
        """타겟 조회"""
        adr = ADRDocument(
            schema_version="1.0",
            id="ADR-001",
            title="Test",
            status=ADRStatus.APPROVED,
            approval=ApprovalInfo(date.today(), timedelta(days=180), "approver"),
            convergence=None,
            targets=[
                TargetFile(path="src/main.py", signals=["algo/recursion"]),
            ],
            thresholds=Thresholds(nesting=7),
            rationale="Test rationale long enough for validation.",
        )
        target = adr.get_target("src/main.py")
        assert target is not None
        assert "algo/recursion" in target.signals


# ============================================================
# Parser 테스트
# ============================================================

class TestParser:
    """ADR 파서 테스트"""

    def test_parse_yaml_minimal(self):
        """최소 YAML 파싱"""
        yaml_content = """
schema_version: "1.0"
id: ADR-001
title: Test ADR
status: approved
approval:
  approved_date: "2025-01-01"
  grace_period: "180d"
  approver: tech-lead
targets:
  - path: src/main.py
thresholds:
  nesting: 7
rationale: |
  This is a test rationale that is long enough to pass validation.
"""
        adr = parse_adr_yaml(yaml_content)
        assert adr.id == "ADR-001"
        assert adr.status == ADRStatus.APPROVED
        assert adr.thresholds.nesting == 7

    def test_parse_yaml_with_convergence(self):
        """수렴 증명 포함 YAML"""
        yaml_content = """
schema_version: "1.0"
id: ADR-002
title: Test with Convergence
status: approved
approval:
  approved_date: "2025-01-01"
  grace_period: "180d"
  approver: tech-lead
convergence:
  snapshot_before: snap-1
  snapshot_after: snap-2
  delta_phi: 0.005
  epsilon: 0.01
  iterations: 3
  evidence_complete: true
targets:
  - path: src/main.py
    signals:
      - algo/recursion
thresholds:
  nesting: 7
  concepts: 15
rationale: |
  This is a test rationale that is definitely long enough.
"""
        adr = parse_adr_yaml(yaml_content)
        assert adr.convergence is not None
        assert adr.convergence.is_valid is True

    def test_adr_to_dict(self):
        """ADR to dict 변환"""
        adr = ADRDocument(
            schema_version="1.0",
            id="ADR-001",
            title="Test",
            status=ADRStatus.APPROVED,
            approval=ApprovalInfo(date(2025, 1, 1), timedelta(days=180), "approver"),
            convergence=None,
            targets=[TargetFile(path="src/main.py")],
            thresholds=Thresholds(nesting=7),
            rationale="Test rationale.",
        )
        d = adr_to_dict(adr)
        assert d["id"] == "ADR-001"
        assert d["status"] == "approved"


# ============================================================
# Validator 테스트
# ============================================================

class TestValidator:
    """ADR 검증기 테스트"""

    @pytest.fixture
    def valid_adr(self):
        """유효한 ADR"""
        return ADRDocument(
            schema_version="1.0",
            id="ADR-001",
            title="Valid ADR",
            status=ADRStatus.APPROVED,
            approval=ApprovalInfo(
                date.today() - timedelta(days=10),
                timedelta(days=180),
                "approver"
            ),
            convergence=ConvergenceProof(
                snapshot_before="snap-1",
                snapshot_after="snap-2",
                delta_phi=0.005,
                epsilon=0.01,
                iterations=3,
                evidence_complete=True,
            ),
            targets=[TargetFile(path="src/main.py", signals=["algo/recursion"])],
            thresholds=Thresholds(nesting=7, concepts=15),
            rationale="This is a sufficiently long rationale for the ADR document.",
        )

    def test_validate_valid_adr(self, valid_adr):
        """유효한 ADR 검증"""
        result = validate_adr(valid_adr)
        assert result.valid is True
        assert len(result.errors) == 0

    def test_validate_missing_id(self, valid_adr):
        """ID 누락"""
        valid_adr.id = ""
        result = validate_adr(valid_adr)
        assert result.valid is False
        assert any(e.field == "id" for e in result.errors)

    def test_validate_draft_status(self, valid_adr):
        """Draft 상태"""
        valid_adr.status = ADRStatus.DRAFT
        result = validate_adr(valid_adr)
        assert result.valid is False
        assert any(e.field == "status" for e in result.errors)

    def test_validate_expired(self, valid_adr):
        """만료됨"""
        valid_adr.approval = ApprovalInfo(
            date(2020, 1, 1),  # 과거
            timedelta(days=30),
            "approver"
        )
        result = validate_adr(valid_adr)
        assert result.valid is False
        assert any("grace_period" in e.field for e in result.errors)

    def test_validate_invalid_convergence(self, valid_adr):
        """수렴 증명 무효"""
        valid_adr.convergence = ConvergenceProof(
            snapshot_before="snap-1",
            snapshot_after="snap-2",
            delta_phi=0.1,  # > epsilon
            epsilon=0.01,
            iterations=3,
            evidence_complete=True,
        )
        result = validate_adr(valid_adr)
        assert result.valid is False
        assert any("convergence" in e.field for e in result.errors)

    def test_validate_nesting_too_low(self, valid_adr):
        """nesting 너무 낮음"""
        valid_adr.thresholds = Thresholds(nesting=2)  # < 4
        result = validate_adr(valid_adr)
        assert result.valid is False

    def test_validate_nesting_too_high(self, valid_adr):
        """nesting 너무 높음"""
        valid_adr.thresholds = Thresholds(nesting=20)  # > 15
        result = validate_adr(valid_adr)
        assert result.valid is False

    def test_validate_missing_thresholds(self, valid_adr):
        """임계값 없음"""
        valid_adr.thresholds = Thresholds()  # 둘 다 None
        result = validate_adr(valid_adr)
        assert result.valid is False

    def test_validate_short_rationale_warning(self, valid_adr):
        """짧은 rationale 경고"""
        valid_adr.rationale = "Short."
        result = validate_adr(valid_adr)
        # 에러는 아니지만 경고
        assert any("rationale" in w.field for w in result.warnings)


# ============================================================
# Expiry 테스트
# ============================================================

class TestExpiry:
    """만료 관리 테스트"""

    @pytest.fixture
    def active_adr(self):
        """활성 ADR"""
        return ADRDocument(
            schema_version="1.0",
            id="ADR-001",
            title="Active ADR",
            status=ADRStatus.APPROVED,
            approval=ApprovalInfo(
                date.today() - timedelta(days=10),
                timedelta(days=180),
                "approver"
            ),
            convergence=None,
            targets=[],
            thresholds=Thresholds(nesting=7),
            rationale="Test.",
        )

    def test_check_expiry_active(self, active_adr):
        """활성 상태"""
        info = check_expiry(active_adr)
        assert info.status == ExpiryStatus.ACTIVE
        assert info.remaining_days > 30

    def test_check_expiry_warning(self, active_adr):
        """경고 상태"""
        active_adr.approval = ApprovalInfo(
            date.today() - timedelta(days=160),
            timedelta(days=180),
            "approver"
        )
        info = check_expiry(active_adr)
        assert info.status == ExpiryStatus.WARNING
        assert info.remaining_days <= 30

    def test_check_expiry_expired(self, active_adr):
        """만료 상태"""
        active_adr.approval = ApprovalInfo(
            date(2020, 1, 1),
            timedelta(days=30),
            "approver"
        )
        info = check_expiry(active_adr)
        assert info.status == ExpiryStatus.EXPIRED
        assert info.remaining_days < 0

    def test_is_expired(self, active_adr):
        """만료 여부"""
        assert is_expired(active_adr) is False

        active_adr.approval = ApprovalInfo(
            date(2020, 1, 1), timedelta(days=30), "approver"
        )
        assert is_expired(active_adr) is True

    def test_is_active(self, active_adr):
        """활성 여부"""
        assert is_active(active_adr) is True

    def test_get_expiry_warning(self, active_adr):
        """경고 메시지"""
        # 활성 → None
        assert get_expiry_warning(active_adr) is None

        # 만료 → 메시지
        active_adr.approval = ApprovalInfo(
            date(2020, 1, 1), timedelta(days=30), "approver"
        )
        msg = get_expiry_warning(active_adr)
        assert msg is not None
        assert "만료" in msg

    def test_format_expiry_badge(self, active_adr):
        """배지 포맷"""
        badge = format_expiry_badge(active_adr)
        assert "ACTIVE" in badge

        active_adr.approval = ApprovalInfo(
            date(2020, 1, 1), timedelta(days=30), "approver"
        )
        badge = format_expiry_badge(active_adr)
        assert "EXPIRED" in badge
