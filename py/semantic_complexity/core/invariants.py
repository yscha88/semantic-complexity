"""
Invariant Checks (v0.0.8)

Cognitive: state x async x retry coexistence detection
Security: Secret pattern detection, locked zone warning
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional


# -------------------------------------------------------------------------
# Cognitive Invariant: state x async x retry coexistence forbidden
# -------------------------------------------------------------------------


@dataclass
class CognitiveViolation:
    """Result of cognitive invariant check."""

    has_state: bool
    has_async: bool
    has_retry: bool
    violation: bool
    message: str


def check_cognitive_invariant(
    state_mutations: int,
    state_machine_patterns: int,
    async_boundaries: int,
    promise_chains: int,
    retry_patterns: int,
) -> CognitiveViolation:
    """
    Check for state x async x retry coexistence.

    These three coexisting in the same function indicates cognitive collapse risk.
    """
    has_state = state_mutations > 0 or state_machine_patterns > 0
    has_async = async_boundaries > 0 or promise_chains > 0
    has_retry = retry_patterns > 0

    # Violation if all three exist
    violation = has_state and has_async and has_retry

    # Warning if two exist
    count = sum([has_state, has_async, has_retry])

    message = ""
    if violation:
        message = "VIOLATION: state x async x retry coexistence. Function split required."
    elif count == 2:
        message = "WARNING: 2 axes coexist. Complexity concern."

    return CognitiveViolation(
        has_state=has_state,
        has_async=has_async,
        has_retry=has_retry,
        violation=violation,
        message=message,
    )


# -------------------------------------------------------------------------
# Security: Secret pattern detection
# -------------------------------------------------------------------------


@dataclass
class SecretViolation:
    """Result of secret pattern detection."""

    pattern: str
    match: str
    line: int
    severity: str  # "warning" or "error"
    message: str


SECRET_PATTERNS: list[tuple[re.Pattern[str], str, str]] = [
    # API Keys
    (
        re.compile(r"""['"`](?:api[_-]?key|apikey)['"`]\s*[=:]\s*['"`][^'"`]{10,}['"`]""", re.I),
        "API_KEY",
        "error",
    ),
    (
        re.compile(r"""['"`](?:secret|password|passwd|pwd)['"`]\s*[=:]\s*['"`][^'"`]{6,}['"`]""", re.I),
        "SECRET",
        "error",
    ),
    # Bearer tokens
    (re.compile(r"Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+"), "BEARER_TOKEN", "error"),
    # AWS
    (re.compile(r"AKIA[0-9A-Z]{16}"), "AWS_ACCESS_KEY", "error"),
    (re.compile(r"aws[_-]?secret[_-]?access[_-]?key", re.I), "AWS_SECRET_KEY", "error"),
    # Private keys
    (re.compile(r"-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----"), "PRIVATE_KEY", "error"),
    # Connection strings
    (
        re.compile(r"(?:mongodb|postgres|mysql|redis)://[^@]+:[^@]+@", re.I),
        "DB_CONNECTION_STRING",
        "error",
    ),
    # Environment variable access (warning)
    (re.compile(r"os\.environ\[['\"]?[A-Z_]+['\"]?\]"), "ENV_ACCESS", "warning"),
    (re.compile(r"os\.getenv\(['\"][A-Z_]+['\"]\)"), "ENV_ACCESS", "warning"),
]


def detect_secrets(code: str) -> list[SecretViolation]:
    """Detect secret patterns in code."""
    violations: list[SecretViolation] = []

    for pattern, name, severity in SECRET_PATTERNS:
        for match in pattern.finditer(code):
            # Find line number
            before_match = code[: match.start()]
            line = before_match.count("\n") + 1

            # Mask the actual secret
            matched_text = match.group()
            if len(matched_text) > 20:
                masked = matched_text[:10] + "..." + matched_text[-5:]
            else:
                masked = matched_text

            if severity == "error":
                message = f"ERROR: {name} detected at line {line}. Remove before commit."
            else:
                message = f"WARNING: {name} at line {line}. Consider using secrets manager."

            violations.append(
                SecretViolation(
                    pattern=name,
                    match=masked,
                    line=line,
                    severity=severity,
                    message=message,
                )
            )

    return violations


# -------------------------------------------------------------------------
# Security: LLM locked zone detection
# -------------------------------------------------------------------------


@dataclass
class LockedZoneWarning:
    """Result of locked zone detection."""

    zone: str
    matched: str
    message: str


LOCKED_ZONE_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    # Auth/Authz
    (re.compile(r"\bauth(?:entication|orization|enticate|orize)?\b", re.I), "auth"),
    (re.compile(r"\blogin\b|\blogout\b|\bsignin\b|\bsignout\b", re.I), "auth"),
    (re.compile(r"\brbac\b|\bacl\b|\bpermission", re.I), "auth"),
    # Crypto
    (re.compile(r"\bcrypto\b|\bencrypt\b|\bdecrypt\b|\bhash\b", re.I), "crypto"),
    (re.compile(r"\bsign(?:ature)?\b|\bverify\b", re.I), "crypto"),
    (re.compile(r"\bcipher\b|\baes\b|\brsa\b", re.I), "crypto"),
    # Patient/Medical data (HIPAA)
    (re.compile(r"\bpatient\b|\bmedical\b|\bhealth\b", re.I), "patient-data"),
    (re.compile(r"\bphi\b|\bhipaa\b", re.I), "patient-data"),
    # Deployment/Infrastructure
    (re.compile(r"\bdeploy\b|\binfra(?:structure)?\b", re.I), "deploy"),
    (re.compile(r"\bkubernetes\b|\bk8s\b|\bhelm\b", re.I), "deploy"),
    (re.compile(r"\btls\b|\bssl\b|\bcert(?:ificate)?\b", re.I), "deploy"),
    (re.compile(r"\bnetwork\s?policy\b", re.I), "deploy"),
]


def check_locked_zone(file_path: str, function_name: Optional[str] = None) -> Optional[LockedZoneWarning]:
    """Check if file/function is in an LLM locked zone."""
    target = f"{file_path} {function_name or ''}"

    for pattern, zone in LOCKED_ZONE_PATTERNS:
        match = pattern.search(target)
        if match:
            return LockedZoneWarning(
                zone=zone,
                matched=match.group(),
                message=f"LOCKED ZONE: {zone}. LLM modification forbidden. Human approval required.",
            )

    return None


# -------------------------------------------------------------------------
# Combined check
# -------------------------------------------------------------------------


@dataclass
class InvariantCheckResult:
    """Result of all invariant checks."""

    cognitive: CognitiveViolation
    secrets: list[SecretViolation] = field(default_factory=list)
    locked_zone: Optional[LockedZoneWarning] = None
    passed: bool = True
    summary: str = ""


def check_all_invariants(
    code: str,
    file_path: str,
    function_name: Optional[str],
    state_mutations: int,
    state_machine_patterns: int,
    async_boundaries: int,
    promise_chains: int,
    retry_patterns: int,
) -> InvariantCheckResult:
    """Perform all invariant checks."""
    cognitive = check_cognitive_invariant(
        state_mutations=state_mutations,
        state_machine_patterns=state_machine_patterns,
        async_boundaries=async_boundaries,
        promise_chains=promise_chains,
        retry_patterns=retry_patterns,
    )
    secrets = detect_secrets(code)
    locked_zone = check_locked_zone(file_path, function_name)

    has_error = (
        cognitive.violation
        or any(s.severity == "error" for s in secrets)
        or locked_zone is not None
    )

    passed = not has_error

    issues: list[str] = []
    if cognitive.violation:
        issues.append("Cognitive violation")
    if secrets:
        issues.append(f"{len(secrets)} secret(s)")
    if locked_zone:
        issues.append(f"Locked zone: {locked_zone.zone}")

    summary = "All invariants passed" if passed else f"Issues: {', '.join(issues)}"

    return InvariantCheckResult(
        cognitive=cognitive,
        secrets=secrets,
        locked_zone=locked_zone,
        passed=passed,
        summary=summary,
    )
