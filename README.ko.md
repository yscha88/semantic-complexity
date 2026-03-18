# semantic-complexity

기존 정적 분석(McCabe 등)의 한계를 LLM의 의미론적 추론 + SKILLS(정책 프레임) + MCP(정량 측정) 조합으로 극복할 수 있는지 탐구한다.

현재 연구 질문: **"SKILL(구체적 가이드)이 LLM 코드 분석 품질을 높이는가?"**
검증된 것: SAR 복합 안티패턴 9종 (unit test 18/18). 나머지는 미검증 가설.

## 문서

- [이론적 토대](docs/verified/THEORY.ko.md) — 검증된 근거 (SAR 안티패턴)
- [복합 안티패턴](docs/verified/COMPOUND_ANTI_PATTERNS.md) — SAR 9개 패턴 정의 (검증됨)
- [가설](docs/hypothesis/RESEARCH.md) — 미검증 가설
- [실험 설계](experiments/EXPERIMENT_MATRIX.md) — 실험 목록 + 프로토콜 + 진행 규칙
