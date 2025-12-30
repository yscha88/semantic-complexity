"""
Essential Complexity Waiver System

본질적 복잡도 면제 시스템:
- __essential_complexity__ 파싱
- ADR 존재 여부 검증
- ComplexityContext (토대 정보) 생성

사용법:
    # 모듈에서 선언
    __module_type__ = "lib/domain"
    __essential_complexity__ = {
        "adr": "docs/adr/003-inference-complexity.md",
    }

    # Gate에서 체크
    waiver = check_waiver(source, file_path)
    if waiver.waived:
        # 복잡도 검사 유예
"""

__module_type__ = "lib/domain"

import ast
import re
from dataclasses import dataclass, field
from pathlib import Path


# ============================================================
# 타입 정의
# ============================================================

@dataclass
class EssentialComplexityConfig:
    """__essential_complexity__ 설정"""
    adr: str | None = None                    # ADR 파일 경로
    nesting: int | None = None                # 중첩 허용치 (기본값 대신)
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
# Waiver 체크
# ============================================================

def check_waiver(
    source: str,
    file_path: str | Path | None = None,
    project_root: str | Path | None = None,
) -> WaiverResult:
    """
    복잡도 면제 여부 체크

    Args:
        source: 소스 코드
        file_path: 파일 경로 (ADR 상대 경로 해석용)
        project_root: 프로젝트 루트 (ADR 경로 해석용)

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
    "EssentialComplexityConfig",
    "ComplexitySignal",
    "ComplexityContext",
    "WaiverResult",
    "parse_essential_complexity",
    "detect_complexity_signals",
    "detect_complex_imports",
    "build_complexity_context",
    "check_waiver",
]
