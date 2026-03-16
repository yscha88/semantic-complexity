# semantic-complexity 프로젝트 컨텍스트

## 프로젝트 목표

기존 정적 분석(McCabe 등)의 한계 — 맥락 무시, 단일 차원, 조합 위험 탐지 불가 — 를
LLM의 의미론적 추론 + SKILLS(정책 프레임) + MCP(정량 측정) 조합으로 극복한다.

코드를 **발전 가능한 객체**로 취급:
- 같은 코드도 PoC에서는 OK, Production에서는 위반
- architecture_role에 따라 같은 복잡도도 다르게 판단

## 3축 분석 (🍞🧀🥓)

| 축 | 측정 대상 | 핵심 |
|----|----------|------|
| 🍞 **Bread** (Security) | Trust boundary, 인증, secret | 구조 안정성 |
| 🧀 **Cheese** (Cognitive) | 중첩, 개념 수, state×async×retry | 인지 가능성 |
| 🥓 **Ham** (Behavioral) | Golden test, contract test, critical path | 행동 보존 |

정규화: `bread + cheese + ham = 100` (simplex)

## 불변조건

### 🧀 Cheese 인지 가능 조건 (4가지 모두 충족)
1. 중첩 깊이 ≤ N (module type별)
2. 개념 수 ≤ 9개/함수 (Miller's Law 7±2)
3. 숨겨진 의존성 최소화
4. state×async×retry 2개 이상 공존 금지

### 🍞 Bread 보안 조건
- Trust Boundary 명시적 정의
- AUTH_FLOW 선언 (NONE 포함 가능)
- Secret 하드코딩 금지, 민감정보 출력 금지

### 🥓 Ham 행동 보존 조건
- Critical Path에 Golden Test 존재
- API에 Contract Test 존재
- 핵심 경로 보호율 측정

## Gate 시스템

| 단계 | 엄격도 | Waiver | 핵심 |
|------|--------|--------|------|
| PoC | 느슨 | ❌ | 돌아가면 OK |
| MVP | 표준 | ❌ | 처음부터 제대로 |
| Production | 엄격 | ✅ (ADR 필요) | 본질적 복잡도만 면제 |

## 문서 구조 (3-Tier)

- **Tier 2** `docs/THEORY.ko.md`: 반증 가능한 이론적 근거 + 실험 설계
- **Tier 3** `docs/RESEARCH.md`: 검증 대기 중인 가설 (승격/폐기 기준 명시)
- `docs/STABILITY_INVARIANTS.md`: 불변조건 전체 스펙
- `docs/LLM_REFACTORING_PROTOCOL.md`: LLM 운용 규칙 (금지 영역)
- `docs/MODULE_TYPES.ko.md`: 모듈 타입 분류 체계
- `src/py/`: Python 구현 (MCP 서버)
- `src/ts/`: TypeScript 구현
- `src/go/`: Go 구현

## LLM 작업 규칙

1. 이론 계층 혼동 금지 (측정은 context-free, 판단은 context-aware)
2. auth, crypto, trust boundary 로직 변경 금지
3. `*args/**kwargs`로 메트릭 회피 금지
4. `__essential_complexity__` 직접 추가/수정 금지
