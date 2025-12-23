"""
🍞 Bread (Security) Analyzer

보안 구조 안정성 분석:
- Trust boundary 탐지
- Auth/Authz 흐름 분석
- Secret 패턴 탐지
- Blast radius 계산
"""

__module_type__ = "lib/domain"

import re
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class BreadResult:
    """🍞 Security 분석 결과"""
    trust_boundary_count: int
    trust_boundaries: list["TrustBoundary"]
    auth_explicitness: float  # 0.0 ~ 1.0
    auth_patterns: list[str]
    secret_patterns: list["SecretPattern"]
    blast_radius: float  # 영향받는 모듈 비율
    violations: list[str]


@dataclass
class TrustBoundary:
    """신뢰 경계 정의"""
    name: str
    line: int
    boundary_type: str  # "api", "auth", "network", "data"
    description: str


@dataclass
class SecretPattern:
    """Secret 패턴 탐지 결과"""
    line: int
    pattern_type: str  # "api_key", "password", "token", "credential"
    snippet: str
    severity: str  # "high", "medium", "low"


# ============================================================
# Trust Boundary 패턴
# ============================================================

TRUST_BOUNDARY_PATTERNS = {
    "api": [
        (r'@(app|router)\.(get|post|put|delete|patch)', "API endpoint"),
        (r'@api_view\(', "Django REST API"),
        (r'class.*\(APIView\)', "Django APIView"),
        (r'@require_http_methods', "HTTP method restriction"),
    ],
    "auth": [
        (r'@(login_required|authenticated)', "Authentication required"),
        (r'@permission_required', "Permission check"),
        (r'@requires_auth', "Auth decorator"),
        (r'verify_token\(', "Token verification"),
        (r'check_permission\(', "Permission check"),
    ],
    "network": [
        (r'@rate_limit', "Rate limiting"),
        (r'@throttle', "Throttling"),
        (r'CORS', "CORS policy"),
        (r'firewall', "Firewall rule"),
    ],
    "data": [
        (r'@validate', "Input validation"),
        (r'sanitize\(', "Data sanitization"),
        (r'escape\(', "Output escaping"),
        (r'Validator\(', "Validator class"),
    ],
}

# ============================================================
# Auth 패턴 (명시성 점수 계산용)
# ============================================================

AUTH_EXPLICIT_PATTERNS = [
    (r'def\s+authenticate\(', 10, "explicit authenticate function"),
    (r'def\s+authorize\(', 10, "explicit authorize function"),
    (r'class.*Auth.*:', 8, "Auth class"),
    (r'@login_required', 8, "login_required decorator"),
    (r'@authenticated', 8, "authenticated decorator"),
    (r'verify_token\(', 7, "token verification"),
    (r'check_permission\(', 7, "permission check"),
    (r'JWT', 5, "JWT usage"),
    (r'OAuth', 5, "OAuth usage"),
    (r'session\[', 3, "session access"),
]

# ============================================================
# Secret 패턴 (보안 위험)
# ============================================================

SECRET_PATTERNS = [
    # High severity
    (r'["\']?password["\']?\s*[:=]\s*["\'][^"\']+["\']', "password", "high"),
    (r'["\']?api_key["\']?\s*[:=]\s*["\'][^"\']+["\']', "api_key", "high"),
    (r'["\']?secret["\']?\s*[:=]\s*["\'][^"\']+["\']', "secret", "high"),
    (r'["\']?private_key["\']?\s*[:=]\s*["\'][^"\']+["\']', "private_key", "high"),
    (r'-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----', "private_key", "high"),

    # Medium severity
    (r'["\']?token["\']?\s*[:=]\s*["\'][^"\']+["\']', "token", "medium"),
    (r'["\']?auth["\']?\s*[:=]\s*["\'][^"\']+["\']', "auth_string", "medium"),
    (r'Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+', "jwt_token", "medium"),

    # Low severity (환경변수 참조는 OK)
    (r'os\.environ\.get\(["\'].*KEY', "env_key_access", "low"),
    (r'os\.getenv\(["\'].*SECRET', "env_secret_access", "low"),
]


class BreadAnalyzer:
    """🍞 Security Analyzer"""

    def __init__(self, source: str, file_path: str | None = None):
        self.source = source
        self.file_path = file_path
        self.lines = source.splitlines()

    def analyze(self) -> BreadResult:
        """전체 분석 실행"""
        trust_boundaries = self._detect_trust_boundaries()
        auth_result = self._analyze_auth_explicitness()
        secrets = self._detect_secrets()
        violations = self._collect_violations(trust_boundaries, auth_result, secrets)

        return BreadResult(
            trust_boundary_count=len(trust_boundaries),
            trust_boundaries=trust_boundaries,
            auth_explicitness=auth_result[0],
            auth_patterns=auth_result[1],
            secret_patterns=secrets,
            blast_radius=self._calculate_blast_radius(),
            violations=violations,
        )

    def _detect_trust_boundaries(self) -> list[TrustBoundary]:
        """Trust boundary 탐지"""
        boundaries: list[TrustBoundary] = []

        for line_num, line in enumerate(self.lines, 1):
            for boundary_type, patterns in TRUST_BOUNDARY_PATTERNS.items():
                for pattern, description in patterns:
                    if re.search(pattern, line, re.IGNORECASE):
                        boundaries.append(TrustBoundary(
                            name=self._extract_name(line),
                            line=line_num,
                            boundary_type=boundary_type,
                            description=description,
                        ))

        return boundaries

    def _analyze_auth_explicitness(self) -> tuple[float, list[str]]:
        """Auth 명시성 점수 계산 (0.0 ~ 1.0)"""
        total_score = 0
        max_possible = sum(score for _, score, _ in AUTH_EXPLICIT_PATTERNS)
        patterns_found: list[str] = []

        for pattern, score, description in AUTH_EXPLICIT_PATTERNS:
            if re.search(pattern, self.source, re.IGNORECASE):
                total_score += score
                patterns_found.append(description)

        explicitness = min(1.0, total_score / max_possible) if max_possible > 0 else 0.0
        return (explicitness, patterns_found)

    def _detect_secrets(self) -> list[SecretPattern]:
        """Secret 패턴 탐지"""
        secrets: list[SecretPattern] = []

        for line_num, line in enumerate(self.lines, 1):
            for pattern, pattern_type, severity in SECRET_PATTERNS:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    # 환경변수 참조는 낮은 심각도로 처리
                    if severity == "low":
                        continue  # 환경변수 사용은 OK

                    secrets.append(SecretPattern(
                        line=line_num,
                        pattern_type=pattern_type,
                        snippet=self._mask_secret(match.group()),
                        severity=severity,
                    ))

        return secrets

    def _calculate_blast_radius(self) -> float:
        """
        Blast radius 계산

        이 파일 변경 시 영향받는 범위 추정.
        실제 구현에서는 import 그래프 분석 필요.
        """
        # 의사 구현: 파일 크기와 import 수 기반 추정
        import_count = len(re.findall(r'^(?:from|import)\s+', self.source, re.MULTILINE))
        line_count = len(self.lines)

        # 정규화된 blast radius (0.0 ~ 1.0)
        normalized = min(1.0, (import_count * 0.05) + (line_count * 0.001))
        return normalized

    def _collect_violations(
        self,
        boundaries: list[TrustBoundary],
        auth_result: tuple[float, list[str]],
        secrets: list[SecretPattern],
    ) -> list[str]:
        """보안 위반 사항 수집"""
        violations: list[str] = []

        # Trust boundary 없음
        if not boundaries:
            violations.append("No trust boundary defined")

        # Auth 명시성 낮음
        if auth_result[0] < 0.3:
            violations.append(f"Low auth explicitness: {auth_result[0]:.2f}")

        # High severity secrets
        high_secrets = [s for s in secrets if s.severity == "high"]
        if high_secrets:
            violations.append(f"High severity secrets detected: {len(high_secrets)}")

        return violations

    def _extract_name(self, line: str) -> str:
        """라인에서 이름 추출"""
        # 함수/클래스 이름 추출 시도
        match = re.search(r'def\s+(\w+)|class\s+(\w+)', line)
        if match:
            return match.group(1) or match.group(2)

        # 데코레이터에서 추출
        match = re.search(r'@(\w+)', line)
        if match:
            return match.group(1)

        return line.strip()[:30]

    def _mask_secret(self, secret: str) -> str:
        """Secret 마스킹 (처음 4자만 표시)"""
        if len(secret) <= 8:
            return "*" * len(secret)
        return secret[:4] + "*" * (len(secret) - 4)


# ============================================================
# 공개 API
# ============================================================

def analyze_bread(source: str, file_path: str | None = None) -> BreadResult:
    """
    🍞 Security 분석

    Args:
        source: Python 소스 코드
        file_path: 파일 경로 (선택)

    Returns:
        BreadResult: 분석 결과
    """
    analyzer = BreadAnalyzer(source, file_path)
    return analyzer.analyze()
