"""
ADR 만료 관리

만료 상태 확인 및 경고.
"""

__module_type__ = "lib/domain"

from dataclasses import dataclass
from datetime import date

from .schema import ADRDocument, ExpiryStatus


# ============================================================
# 상수
# ============================================================

WARNING_DAYS = 30  # 만료 경고 기간


# ============================================================
# 타입 정의
# ============================================================

@dataclass
class ExpiryInfo:
    """만료 정보

    status: 만료 상태
    expiry_date: 만료일
    remaining_days: 잔여 일수
    message: 상태 메시지
    """
    status: ExpiryStatus
    expiry_date: date
    remaining_days: int
    message: str


# ============================================================
# 만료 확인
# ============================================================

def check_expiry(adr: ADRDocument, today: date | None = None) -> ExpiryInfo:
    """ADR 만료 상태 확인

    Args:
        adr: ADRDocument
        today: 기준일 (기본: 오늘)

    Returns:
        ExpiryInfo
    """
    if today is None:
        today = date.today()

    expiry_date = adr.approval.expiry_date
    remaining = (expiry_date - today).days

    if remaining < 0:
        status = ExpiryStatus.EXPIRED
        message = f"ADR 만료됨 ({abs(remaining)}일 전)"
    elif remaining <= WARNING_DAYS:
        status = ExpiryStatus.WARNING
        message = f"ADR 만료 임박 ({remaining}일 후)"
    else:
        status = ExpiryStatus.ACTIVE
        message = f"ADR 유효 ({remaining}일 남음)"

    return ExpiryInfo(
        status=status,
        expiry_date=expiry_date,
        remaining_days=remaining,
        message=message,
    )


def is_expired(adr: ADRDocument, today: date | None = None) -> bool:
    """만료 여부

    Args:
        adr: ADRDocument
        today: 기준일

    Returns:
        만료 여부
    """
    info = check_expiry(adr, today)
    return info.status == ExpiryStatus.EXPIRED


def is_warning(adr: ADRDocument, today: date | None = None) -> bool:
    """만료 임박 여부

    Args:
        adr: ADRDocument
        today: 기준일

    Returns:
        만료 임박 여부
    """
    info = check_expiry(adr, today)
    return info.status == ExpiryStatus.WARNING


def is_active(adr: ADRDocument, today: date | None = None) -> bool:
    """활성 여부

    Args:
        adr: ADRDocument
        today: 기준일

    Returns:
        활성 여부
    """
    info = check_expiry(adr, today)
    return info.status == ExpiryStatus.ACTIVE


def get_expiry_warning(adr: ADRDocument, today: date | None = None) -> str | None:
    """만료 경고 메시지

    Args:
        adr: ADRDocument
        today: 기준일

    Returns:
        경고 메시지 (활성이면 None)
    """
    info = check_expiry(adr, today)

    if info.status == ExpiryStatus.ACTIVE:
        return None

    return info.message


def format_expiry_badge(adr: ADRDocument, today: date | None = None) -> str:
    """만료 상태 배지

    Args:
        adr: ADRDocument
        today: 기준일

    Returns:
        배지 문자열
    """
    info = check_expiry(adr, today)

    badges = {
        ExpiryStatus.ACTIVE: f"[ACTIVE: {info.remaining_days}d]",
        ExpiryStatus.WARNING: f"[WARNING: {info.remaining_days}d]",
        ExpiryStatus.EXPIRED: "[EXPIRED]",
    }

    return badges[info.status]


# ============================================================
# 공개 API
# ============================================================

__all__ = [
    "ExpiryInfo",
    "WARNING_DAYS",
    "check_expiry",
    "is_expired",
    "is_warning",
    "is_active",
    "get_expiry_warning",
    "format_expiry_badge",
]
