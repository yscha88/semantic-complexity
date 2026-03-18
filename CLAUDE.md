# semantic-complexity 프로젝트 컨텍스트

## 프로젝트 목표

기존 정적 분석(McCabe 등)의 한계를
LLM의 의미론적 추론 + SKILLS(정책 프레임) + MCP(정량 측정) 조합으로 극복할 수 있는지 **탐구한다.**

> 현재 가설 검증 단계. 검증된 것: SAR 복합 안티패턴 9종 (unit test 18/18).
> 나머지는 전부 미검증 가설 — RESEARCH.md 참조.

## 현재 연구 질문

**"SKILL(구체적 가이드)이 LLM 코드 분석 품질을 높이는가?"**
- 보안 축을 첫 번째 사례로 실험 중
- 🍞🧀🥓는 가이드의 예시이지, "코드 품질이 3축이다"라는 주장이 아님

## LLM 작업 규칙

1. 미검증 가설을 확정 사실처럼 서술 금지
2. auth, crypto, trust boundary 로직 변경 금지
3. `*args/**kwargs`로 메트릭 회피 금지
4. `__essential_complexity__` 직접 추가/수정 금지
