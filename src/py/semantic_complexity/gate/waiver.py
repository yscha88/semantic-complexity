"""
Essential Complexity Waiver System

본질적 복잡도 면제 시스템:
- __essential_complexity__ 파싱 (인라인)
- .waiver.json 외부 파일 지원
- ADR 존재 여부 검증
- ComplexityContext (토대 정보) 생성

사용법 1 - 인라인:
    # 모듈에서 선언
    __module_type__ = "lib/domain"
    __essential_complexity__ = {
        "adr": "docs/adr/003-inference-complexity.md",
    }

사용법 2 - 외부 파일 (.waiver.json):
    {
      "$schema": "https://semantic-complexity.dev/schemas/waiver.json",
      "version": "1.0",
      "waivers": [
        {
          "pattern": "src/crypto/*.py",
          "adr": "ADR-007",
          "justification": "AES-256 암호화 알고리즘",
          "approved_at": "2025-01-15",
          "expires_at": "2025-12-31",
          "approver": "security-team"
        },
        {
          "pattern": "src/regulations/hipaa.py",
          "adr": "ADR-012",
          "justification": "HIPAA 규제 준수 로직",
          "approved_at": "2025-01-01",
          "expires_at": null,
          "approver": "compliance-team"
        }
      ]
    }

    # Gate에서 체크
    waiver = check_waiver(source, file_path)
    if waiver.waived:
        # 복잡도 검사 유예
"""

__module_type__ = "lib/domain"

import ast
import fnmatch
import json
import re
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path


# ============================================================
# 타입 정의
# ============================================================

@dataclass
class EssentialComplexityConfig:
    """__essential_complexity__ 설정

    사용 예시:
        __essential_complexity__ = {
            "adr": "docs/adr/001-ast-analyzer-complexity.md",
            "nesting": 7,
            "concepts": {"total": 15},
            "reason": "AST Visitor 패턴 - 본질적 복잡도",  # 문서용 (파싱 안함)
        }
    """
    adr: str | None = None                    # ADR 파일 경로
    nesting: int | None = None                # 중첩 허용치
    concepts_total: int | None = None         # 개념 수 허용치
    concepts_params: int | None = None        # 파라미터 허용치 (기본 5)


@dataclass
class ComplexitySignal:
    """본질적 복잡도 신호"""
    category: str       # "math", "algorithm", "domain"
    pattern: str        # 탐지된 패턴
    description: str    # 설명


@dataclass
class ComplexityContext:
    """토론을 위한 토대 정보"""
    signals: list[ComplexitySignal]     # 탐지된 신호
    imports: list[str]                   # 복잡 도메인 라이브러리
    metrics: dict                        # nesting, concepts 등 수치
    questions: list[str]                 # 검토 질문


@dataclass
class WaiverResult:
    """면제 검사 결과"""
    waived: bool
    reason: str | None = None
    adr_path: str | None = None
    config: EssentialComplexityConfig | None = None
    # 외부 파일 waiver 정보
    external_waiver: "ExternalWaiverEntry | None" = None


@dataclass
class ExternalWaiverEntry:
    """외부 .waiver.json 파일의 waiver 항목

    SDS 3.9.3 스키마 필드:
        - pattern: 파일 패턴 (글롭)
        - adr: ADR 문서 참조
        - justification: 면제 정당화 근거
        - approved_at: 승인일 (YYYY-MM-DD)
        - expires_at: 만료일 (YYYY-MM-DD, null=영구)
        - approver: 승인자/팀
    """
    pattern: str
    adr: str
    justification: str | None = None
    approved_at: str | None = None   # YYYY-MM-DD 형식
    expires_at: str | None = None    # YYYY-MM-DD 형식, None=영구
    approver: str | None = None

    def is_expired(self) -> bool:
        """만료 여부 확인"""
        if not self.expires_at:
            return False
        try:
            expire_date = date.fromisoformat(self.expires_at)
            return date.today() > expire_date
        except ValueError:
            return False  # 파싱 실패 시 만료되지 않은 것으로


@dataclass
class WaiverFile:
    """외부 .waiver.json 파일 구조

    SDS 3.9.3 스키마:
        {
          "$schema": "https://semantic-complexity.dev/schemas/waiver.json",
          "version": "1.0",
          "waivers": [
            {
              "pattern": "src/crypto/*.py",
              "adr": "ADR-007",
              "justification": "...",
              "approved_at": "2025-01-15",
              "expires_at": "2025-12-31",
              "approver": "security-team"
            }
          ]
        }
    """
    version: str
    waivers: list[ExternalWaiverEntry] = field(default_factory=list)
    schema_url: str | None = None  # $schema 필드


# ============================================================
# 본질적 복잡도 신호 패턴
# ============================================================

ESSENTIAL_COMPLEXITY_SIGNALS: dict[str, list[tuple[str, str]]] = {
    "math": [
        (r"np\.(linalg|fft|einsum)", "linear algebra / signal processing"),
        (r"torch\.(matmul|einsum|conv\dd)", "tensor operations"),
        (r"scipy\.(optimize|integrate|interpolate)", "scientific computing"),
        (r"\b(gradient|jacobian|hessian)\b", "calculus"),
        (r"\b(eigenvalue|eigenvector|svd)\b", "matrix decomposition"),
    ],
    "algorithm": [
        (r"def\s+(\w+)\([^)]*\)[^:]*:[\s\S]*?\1\(", "recursion"),  # 재귀 패턴 자동 감지
        (r"(memo|dp|cache)\[", "dynamic programming"),
        (r"(visited|seen)\s*=\s*(set|\{\})", "graph traversal"),
        (r"heapq\.(push|pop)", "heap/priority queue"),
        (r"deque\(", "BFS/sliding window"),
        (r"bisect\.", "binary search"),
    ],
    "domain": [
        (r"(voxel|slice|volume|segmentation)", "3D imaging"),
        (r"(encrypt|decrypt|cipher|hash)", "cryptography"),
        (r"(tokenize|parse|ast\.)", "parsing/compilation"),
        (r"(patient|diagnosis|medical)", "healthcare"),
        (r"(tensor|embedding|attention)", "ML/deep learning"),
    ],
}

# 복잡 도메인 라이브러리
COMPLEX_DOMAIN_LIBRARIES = frozenset({
    "torch", "tensorflow", "jax",
    "scipy", "numpy.linalg", "numpy.fft",
    "cryptography", "hashlib",
    "networkx", "igraph",
    "nibabel", "SimpleITK", "monai",
    "transformers", "huggingface",
})


# ============================================================
# __essential_complexity__ 파싱
# ============================================================

def parse_essential_complexity(source: str) -> EssentialComplexityConfig | None:
    """
    소스 코드에서 __essential_complexity__ 파싱

    Args:
        source: Python 소스 코드

    Returns:
        EssentialComplexityConfig 또는 None
    """
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return None

    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "__essential_complexity__":
                    return _parse_config_value(node.value)

    return None


def _parse_config_value(node: ast.expr) -> EssentialComplexityConfig | None:
    """AST 노드에서 설정값 추출"""
    if isinstance(node, ast.Dict):
        config = EssentialComplexityConfig()

        for key, value in zip(node.keys, node.values):
            if isinstance(key, ast.Constant) and isinstance(key.value, str):
                key_name = key.value

                if key_name == "adr" and isinstance(value, ast.Constant):
                    config.adr = value.value
                elif key_name == "nesting" and isinstance(value, ast.Constant):
                    config.nesting = value.value
                elif key_name == "concepts":
                    if isinstance(value, ast.Constant):
                        config.concepts_total = value.value
                    elif isinstance(value, ast.Dict):
                        for ck, cv in zip(value.keys, value.values):
                            if isinstance(ck, ast.Constant) and isinstance(cv, ast.Constant):
                                if ck.value == "total":
                                    config.concepts_total = cv.value
                                elif ck.value == "params":
                                    config.concepts_params = cv.value
                # reason은 문서용 - 파싱하지 않음

        return config

    return None


# ============================================================
# 신호 탐지
# ============================================================

def detect_complexity_signals(source: str) -> list[ComplexitySignal]:
    """
    본질적 복잡도 신호 탐지

    Args:
        source: Python 소스 코드

    Returns:
        탐지된 신호 목록
    """
    signals: list[ComplexitySignal] = []
    seen: set[str] = set()

    for category, patterns in ESSENTIAL_COMPLEXITY_SIGNALS.items():
        for pattern, description in patterns:
            if pattern in seen:
                continue

            if re.search(pattern, source, re.IGNORECASE):
                signals.append(ComplexitySignal(
                    category=category,
                    pattern=pattern,
                    description=description,
                ))
                seen.add(pattern)

    return signals


def detect_complex_imports(source: str) -> list[str]:
    """복잡 도메인 라이브러리 import 탐지"""
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return []

    imports: list[str] = []

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name in COMPLEX_DOMAIN_LIBRARIES:
                    imports.append(alias.name)
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                # torch, scipy.optimize 등
                base = node.module.split(".")[0]
                if base in COMPLEX_DOMAIN_LIBRARIES or node.module in COMPLEX_DOMAIN_LIBRARIES:
                    imports.append(node.module)

    return list(set(imports))


# ============================================================
# 질문 생성
# ============================================================

def generate_review_questions(
    source: str,
    signals: list[ComplexitySignal],
    imports: list[str],
) -> list[str]:
    """
    복잡도 검토를 위한 질문 생성

    Args:
        source: 소스 코드
        signals: 탐지된 신호
        imports: 복잡 도메인 라이브러리

    Returns:
        검토 질문 목록
    """
    questions: list[str] = []

    # 신호 기반 질문
    for signal in signals:
        if signal.category == "math":
            questions.append(f"{signal.description} - 라이브러리 함수로 대체 가능?")
        elif signal.category == "algorithm":
            questions.append(f"{signal.description} - 표준 라이브러리/더 간단한 대안?")
        elif signal.category == "domain":
            questions.append(f"{signal.description} - 기존 프레임워크 컴포넌트 재사용 가능?")

    # import 기반 질문
    if "torch" in imports or "tensorflow" in imports:
        questions.append("ML 파이프라인 - 고수준 API (Lightning, Keras) 사용 가능?")

    # 일반 질문
    if not signals and not imports:
        questions.append("복잡도 신호 없음 - 리팩토링으로 해결 가능?")

    return questions


# ============================================================
# 토대 정보 생성
# ============================================================

def build_complexity_context(
    source: str,
    metrics: dict | None = None,
) -> ComplexityContext:
    """
    토론을 위한 토대 정보 생성

    Args:
        source: 소스 코드
        metrics: 복잡도 수치 (nesting, concepts 등)

    Returns:
        ComplexityContext
    """
    signals = detect_complexity_signals(source)
    imports = detect_complex_imports(source)
    questions = generate_review_questions(source, signals, imports)

    return ComplexityContext(
        signals=signals,
        imports=imports,
        metrics=metrics or {},
        questions=questions,
    )


# ============================================================
# Layer 1: 외부 Waiver 파일 파싱
# ============================================================

def parse_waiver_file(waiver_path: Path) -> WaiverFile | None:
    """
    .waiver.json 파일 파싱

    Args:
        waiver_path: waiver 파일 경로

    Returns:
        WaiverFile 또는 None (파싱 실패 시)
    """
    try:
        content = waiver_path.read_text(encoding="utf-8")
        data = json.loads(content)

        waivers = []
        for entry in data.get("waivers", []):
            waivers.append(ExternalWaiverEntry(
                pattern=entry.get("pattern", ""),
                adr=entry.get("adr", ""),
                justification=entry.get("justification"),
                approved_at=entry.get("approved_at"),
                expires_at=entry.get("expires_at"),
                approver=entry.get("approver"),
            ))

        return WaiverFile(
            version=data.get("version", "1.0"),
            waivers=waivers,
            schema_url=data.get("$schema"),
        )
    except (json.JSONDecodeError, OSError, KeyError):
        return None


# ============================================================
# Layer 2: Waiver 파일 탐색
# ============================================================

def find_waiver_file(
    file_path: Path,
    project_root: Path | None = None,
) -> Path | None:
    """
    .waiver.json 파일 탐색 (상위 디렉토리 순회)

    탐색 순서:
    1. 파일과 같은 디렉토리
    2. 상위 디렉토리들 (project_root까지)
    3. project_root

    Args:
        file_path: 대상 파일 경로
        project_root: 프로젝트 루트 (탐색 상한)

    Returns:
        .waiver.json 경로 또는 None
    """
    current = file_path.parent.resolve()
    root = project_root.resolve() if project_root else None

    # 상위 디렉토리 순회
    while True:
        waiver_path = current / ".waiver.json"
        if waiver_path.exists():
            return waiver_path

        # 루트 도달 또는 파일시스템 루트
        if root and current == root:
            break
        if current.parent == current:
            break

        current = current.parent

    return None


# ============================================================
# Layer 3: 파일 패턴 매칭
# ============================================================

def match_file_pattern(file_path: str, pattern: str) -> bool:
    """
    파일 경로가 패턴에 매칭되는지 확인

    지원 패턴:
    - 글롭 패턴: "src/crypto/*.py", "**/*.py"
    - 정확한 경로: "src/auth/login.py"

    Args:
        file_path: 대상 파일 경로
        pattern: 매칭 패턴

    Returns:
        매칭 여부
    """
    # 경로 정규화 (윈도우/유닉스 호환)
    normalized_path = file_path.replace("\\", "/")
    normalized_pattern = pattern.replace("\\", "/")

    return fnmatch.fnmatch(normalized_path, normalized_pattern)


# ============================================================
# Layer 4: 외부 Waiver 체크
# ============================================================

def check_external_waiver(
    file_path: Path,
    project_root: Path | None = None,
) -> WaiverResult:
    """
    외부 .waiver.json 파일에서 waiver 체크

    Args:
        file_path: 대상 파일 경로
        project_root: 프로젝트 루트

    Returns:
        WaiverResult
    """
    waiver_file_path = find_waiver_file(file_path, project_root)

    if not waiver_file_path:
        return WaiverResult(waived=False, reason=".waiver.json 파일 없음")

    waiver_file = parse_waiver_file(waiver_file_path)

    if not waiver_file:
        return WaiverResult(waived=False, reason=".waiver.json 파싱 실패")

    # 상대 경로 계산 (project_root 기준)
    if project_root:
        try:
            relative_path = str(file_path.resolve().relative_to(project_root.resolve()))
        except ValueError:
            relative_path = str(file_path)
    else:
        relative_path = str(file_path)

    # 매칭되는 waiver 찾기
    for entry in waiver_file.waivers:
        if match_file_pattern(relative_path, entry.pattern):
            # 만료 체크
            if entry.is_expired():
                return WaiverResult(
                    waived=False,
                    reason=f"Waiver 만료됨: {entry.expires_at}",
                    external_waiver=entry,
                )

            # 유효한 waiver
            return WaiverResult(
                waived=True,
                reason=entry.justification,
                adr_path=entry.adr,
                external_waiver=entry,
            )

    return WaiverResult(waived=False, reason="매칭되는 waiver 패턴 없음")


# ============================================================
# Layer 5: 통합 Waiver 체크
# ============================================================

def check_waiver(
    source: str,
    file_path: str | Path | None = None,
    project_root: str | Path | None = None,
) -> WaiverResult:
    """
    복잡도 면제 여부 체크 (외부 파일 우선, 인라인 후순위)

    체크 순서:
    1. 외부 .waiver.json 파일 (file_path 필요)
    2. 인라인 __essential_complexity__ 선언

    Args:
        source: 소스 코드
        file_path: 파일 경로 (외부 waiver 및 ADR 경로 해석용)
        project_root: 프로젝트 루트 (외부 waiver 탐색 상한)

    Returns:
        WaiverResult
    """
    # 1. 외부 .waiver.json 체크 (file_path 있을 때만)
    if file_path:
        file_path_obj = Path(file_path)
        project_root_obj = Path(project_root) if project_root else None
        external_result = check_external_waiver(file_path_obj, project_root_obj)

        # 외부 waiver가 유효하면 반환
        if external_result.waived:
            return external_result

    # 2. 인라인 __essential_complexity__ 체크
    return _check_inline_waiver(source, file_path, project_root)


def _check_inline_waiver(
    source: str,
    file_path: str | Path | None = None,
    project_root: str | Path | None = None,
) -> WaiverResult:
    """
    인라인 __essential_complexity__ 체크

    Args:
        source: 소스 코드
        file_path: 파일 경로
        project_root: 프로젝트 루트

    Returns:
        WaiverResult
    """
    config = parse_essential_complexity(source)

    if not config:
        return WaiverResult(waived=False, reason="__essential_complexity__ 없음")

    if not config.adr:
        return WaiverResult(
            waived=False,
            reason="ADR 경로 없음",
            config=config,
        )

    # ADR 경로 해석
    adr_path = Path(config.adr)

    if project_root:
        adr_full_path = Path(project_root) / adr_path
    elif file_path:
        # 파일 기준 상대 경로
        adr_full_path = Path(file_path).parent / adr_path
    else:
        adr_full_path = adr_path

    # ADR 존재 여부 체크
    if not adr_full_path.exists():
        return WaiverResult(
            waived=False,
            reason=f"ADR 파일 없음: {config.adr}",
            adr_path=config.adr,
            config=config,
        )

    # ADR 최소 내용 체크 (빈 파일 방지)
    adr_content = adr_full_path.read_text(encoding="utf-8")
    if len(adr_content.strip()) < 50:
        return WaiverResult(
            waived=False,
            reason="ADR 파일이 너무 짧음 (< 50자)",
            adr_path=config.adr,
            config=config,
        )

    # 유예 승인
    return WaiverResult(
        waived=True,
        adr_path=config.adr,
        config=config,
    )


# ============================================================
# 공개 API
# ============================================================

__all__ = [
    # 타입
    "EssentialComplexityConfig",
    "ComplexitySignal",
    "ComplexityContext",
    "WaiverResult",
    "ExternalWaiverEntry",
    "WaiverFile",
    # 인라인 waiver
    "parse_essential_complexity",
    "detect_complexity_signals",
    "detect_complex_imports",
    "build_complexity_context",
    # 외부 waiver
    "parse_waiver_file",
    "find_waiver_file",
    "match_file_pattern",
    "check_external_waiver",
    # 통합 API
    "check_waiver",
]
