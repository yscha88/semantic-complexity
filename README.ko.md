# semantic-complexity

기존 정적 분석(McCabe 등)의 한계를 LLM의 의미론적 추론 + SKILLS(정책 프레임) + MCP(정량 측정) 조합으로 극복할 수 있는지 탐구한다.

현재 가설 검증 단계. 검증된 것: SAR 복합 안티패턴 9종 (unit test 18/18).

## 문서

- [이론적 토대](docs/THEORY.ko.md) — 검증된 근거 (SAR 안티패턴, 외부 논문 인용)
- [가설 및 실험](docs/RESEARCH.md) — 미검증 가설 + 실험 설계
- [실험 프로토콜](docs/EXPERIMENT_PROTOCOL.md) — 실험 설계 규칙
- [복합 안티패턴](docs/COMPOUND_ANTI_PATTERNS.md) — SAR 9개 패턴 정의 (검증됨)
