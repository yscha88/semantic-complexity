"""
ADR 파일 파서

YAML, JSON, TOML 형식 지원.
"""

__architecture_role__ = "lib/domain"

import json
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from .schema import (
    ADRDocument,
    ADRStatus,
    ApprovalInfo,
    ConvergenceProof,
    TargetFile,
    TargetMetrics,
    Thresholds,
)


def parse_adr_file(file_path: Path | str) -> ADRDocument:
    """ADR 파일 파싱

    파일 확장자에 따라 적절한 파서 선택.

    Args:
        file_path: ADR 파일 경로

    Returns:
        ADRDocument

    Raises:
        ValueError: 지원하지 않는 형식
        FileNotFoundError: 파일 없음
    """
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"ADR 파일 없음: {path}")

    content = path.read_text(encoding="utf-8")
    suffix = path.suffix.lower()

    if suffix in (".yaml", ".yml"):
        return parse_adr_yaml(content)
    elif suffix == ".json":
        return parse_adr_json(content)
    elif suffix == ".toml":
        return parse_adr_toml(content)
    else:
        raise ValueError(f"지원하지 않는 형식: {suffix}")


def parse_adr_yaml(content: str) -> ADRDocument:
    """YAML 형식 ADR 파싱

    Args:
        content: YAML 문자열

    Returns:
        ADRDocument
    """
    try:
        import yaml
    except ImportError:
        raise ImportError("PyYAML 필요: pip install pyyaml")

    data = yaml.safe_load(content)
    return _dict_to_adr(data)


def parse_adr_json(content: str) -> ADRDocument:
    """JSON 형식 ADR 파싱

    Args:
        content: JSON 문자열

    Returns:
        ADRDocument
    """
    data = json.loads(content)
    return _dict_to_adr(data)


def parse_adr_toml(content: str) -> ADRDocument:
    """TOML 형식 ADR 파싱

    Args:
        content: TOML 문자열

    Returns:
        ADRDocument
    """
    try:
        import tomllib
    except ImportError:
        try:
            import tomli as tomllib
        except ImportError:
            raise ImportError("tomli 필요 (Python 3.10 이하): pip install tomli")

    data = tomllib.loads(content)
    return _dict_to_adr(data)


def _dict_to_adr(data: dict[str, Any]) -> ADRDocument:
    """dict를 ADRDocument로 변환

    Args:
        data: 파싱된 dict

    Returns:
        ADRDocument
    """
    # approval
    approval_data = data.get("approval", {})
    approved_date = _parse_date(approval_data.get("approved_date"))
    grace_period = _parse_timedelta(approval_data.get("grace_period", "180d"))

    approval = ApprovalInfo(
        approved_date=approved_date,
        grace_period=grace_period,
        approver=approval_data.get("approver", "unknown"),
    )

    # convergence (optional)
    convergence = None
    conv_data = data.get("convergence")
    if conv_data:
        convergence = ConvergenceProof(
            snapshot_before=conv_data.get("snapshot_before", ""),
            snapshot_after=conv_data.get("snapshot_after", ""),
            delta_phi=float(conv_data.get("delta_phi", 0.0)),
            epsilon=float(conv_data.get("epsilon", 0.01)),
            iterations=int(conv_data.get("iterations", 0)),
            evidence_complete=bool(conv_data.get("evidence_complete", False)),
        )

    # targets
    targets = []
    for t in data.get("targets", []):
        metrics = None
        if "metrics" in t:
            m = t["metrics"]
            metrics = TargetMetrics(
                x=m.get("x", [0, 0, 0, 0, 0]),
                d=float(m.get("d", 0.0)),
                hodge=m.get("hodge", "algorithmic"),
            )
        targets.append(TargetFile(
            path=t.get("path", ""),
            signals=t.get("signals", []),
            metrics=metrics,
        ))

    # thresholds
    thresh_data = data.get("thresholds", {})
    thresholds = Thresholds(
        nesting=thresh_data.get("nesting"),
        concepts=thresh_data.get("concepts"),
    )

    return ADRDocument(
        schema_version=data.get("schema_version", "1.0"),
        id=data.get("id", ""),
        title=data.get("title", ""),
        status=ADRStatus(data.get("status", "draft")),
        approval=approval,
        convergence=convergence,
        targets=targets,
        thresholds=thresholds,
        rationale=data.get("rationale", ""),
        references=data.get("references", []),
    )


def _parse_date(value: Any) -> date:
    """날짜 파싱

    Args:
        value: 날짜 값 (str, date, datetime)

    Returns:
        date
    """
    if value is None:
        return date.today()

    if isinstance(value, date):
        return value

    if isinstance(value, str):
        # YYYY-MM-DD 형식
        parts = value.split("-")
        if len(parts) == 3:
            return date(int(parts[0]), int(parts[1]), int(parts[2]))

    raise ValueError(f"날짜 파싱 실패: {value}")


def _parse_timedelta(value: str) -> timedelta:
    """기간 파싱

    Args:
        value: 기간 문자열 (예: "180d", "30d", "6m")

    Returns:
        timedelta
    """
    if not value:
        return timedelta(days=180)

    value = value.strip().lower()

    if value.endswith("d"):
        days = int(value[:-1])
        return timedelta(days=days)
    elif value.endswith("m"):
        months = int(value[:-1])
        return timedelta(days=months * 30)  # 근사치
    elif value.endswith("y"):
        years = int(value[:-1])
        return timedelta(days=years * 365)

    # 숫자만 있으면 일로 간주
    try:
        return timedelta(days=int(value))
    except ValueError:
        return timedelta(days=180)


def adr_to_dict(adr: ADRDocument) -> dict[str, Any]:
    """ADRDocument를 dict로 변환

    Args:
        adr: ADRDocument

    Returns:
        dict (YAML/JSON 직렬화용)
    """
    result = {
        "schema_version": adr.schema_version,
        "id": adr.id,
        "title": adr.title,
        "status": adr.status.value,
        "approval": {
            "approved_date": adr.approval.approved_date.isoformat(),
            "grace_period": f"{adr.approval.grace_period.days}d",
            "approver": adr.approval.approver,
        },
        "targets": [
            {
                "path": t.path,
                "signals": t.signals,
                **({"metrics": {
                    "x": t.metrics.x,
                    "d": t.metrics.d,
                    "hodge": t.metrics.hodge,
                }} if t.metrics else {}),
            }
            for t in adr.targets
        ],
        "thresholds": {
            "nesting": adr.thresholds.nesting,
            "concepts": adr.thresholds.concepts,
        },
        "rationale": adr.rationale,
        "references": adr.references,
    }

    if adr.convergence:
        result["convergence"] = {
            "snapshot_before": adr.convergence.snapshot_before,
            "snapshot_after": adr.convergence.snapshot_after,
            "delta_phi": adr.convergence.delta_phi,
            "epsilon": adr.convergence.epsilon,
            "iterations": adr.convergence.iterations,
            "evidence_complete": adr.convergence.evidence_complete,
        }

    return result


# ============================================================
# 공개 API
# ============================================================

__all__ = [
    "parse_adr_file",
    "parse_adr_yaml",
    "parse_adr_json",
    "parse_adr_toml",
    "adr_to_dict",
]
