# 이론적 토대 (Tier 2 — 반증 가능한 근거)

> 본 문서는 **반증 가능한(falsifiable) 주장만** 포함합니다.
> 검증 대기 중인 탐구적 이론은 [RESEARCH.md](RESEARCH.md)에 별도 관리됩니다.
> 각 주장에는 검증 실험 설계가 명시되어 있으며, 실험 결과에 따라 승격 또는 폐기됩니다.

---

## 1. 핵심 명제

McCabe 순환복잡도(1976)는 제어 흐름의 독립 사이클 수(H₁)만 측정하며,
상태 관리, 비동기, 결합도, 보안 구조, 행동 보존은 측정하지 못합니다.

이 시스템은 McCabe가 측정하지 못하는 차원을 추가하여
**맥락 기반 판단**(module type, gate 단계)을 제공하고,
**LLM의 판단 일관성**을 SKILLS(정책 고정) + MCP(결정론적 측정) 조합으로 확보합니다.

**반증 조건**: module type별 기준 적용이 단일 기준 대비 리팩토링 품질을 개선하지 못하면 폐기.

---

## 2. 3축 분해와 근거

| 축 | 측정 대상 | 인용 근거 |
|----|----------|----------|
| 🍞 **Bread** (Security) | Trust boundary, 인증, secret | OWASP Secure Coding Practices |
| 🧀 **Cheese** (Cognitive) | 중첩, 개념 수, state×async×retry | Miller 1956 [1], Campbell 2017 [2] |
| 🥓 **Ham** (Behavioral) | Golden test, contract test | Contract Testing 표준 관행 |

### 🧀 Cheese 불변조건의 근거

| 규칙 | 인용 | 주장 | 반증 실험 |
|------|------|------|----------|
| 개념 수 ≤ 9 | Miller 1956 [1] | 작업기억 용량 7±2가 코드 이해에도 적용 | 개념 수 10+ 함수의 리뷰 오류율을 ≤9 함수와 비교 |
| state×async×retry 공존 금지 | Cousot & Cousot 1977 [3] | 3가지 관심사가 동시 존재하면 정적 추론이 불가능해짐 | SAR 위반 코드의 버그 발생률을 준수 코드와 비교 |
| 중첩 깊이 ≤ N | Campbell 2017 [2] | 중첩이 깊을수록 인지 비용이 비선형 증가 | SonarQube Cognitive Complexity와 상관 분석 |

### Module Type별 Canonical Profile

- **구조**: 프레임워크(5D→3축 사영)는 수학적 정의, 구체적 수치(50/20/30 등)는 경험적 파라미터
- **비유**: Maxwell 방정식(구조) + 투자율/유전율(매질 상수) — 구조는 고정, 상수는 보정 대상
- **반증 실험**: api/external에 lib/domain 기준을 적용했을 때 더 나은 결과가 나오면 프로필 수정

---

## 3. SKILLS + MCP 분리 구조

```
SKILLS (정책 고정)              MCP (결정론적 측정)
├── 판단 규칙                    ├── AST 기반 분석
├── Module type 맥락              ├── 중첩, 개념 수, SAR 탐지
├── Gate 워크플로우               ├── Gate pass/fail 판정
├── Anti-pattern 금지             ├── before/after delta
└── LLM 금지 영역                └── 결정론적 스코어링
```

**주장**: SKILLS가 정책을 고정하면 LLM의 판단 일관성이 향상된다.

**반증 실험 (EXP-01)**:
- 동일 코드 20개에 대해 MCP 단독 vs SKILLS+MCP 조합으로 3회 반복 판정
- 측정: 판단 일관성(동일 결과 비율), 설명 품질(평가자 채점), FP/FN 비율
- **폐기 조건**: 조합이 MCP 단독 대비 일관성 +20% 미만이면 SKILLS 가치 재검토

---

## 4. 기존 도구 대비 차별화

SonarQube + ESLint + Semgrep 조합으로 **달성할 수 없는** 것만 주장합니다:

| 차별점 | 기존 도구에 없는 이유 | 반증 조건 |
|--------|------------------|----------|
| state×async×retry 조합 탐지 | 기존 도구는 개별 패턴만 탐지 | 기존 도구 커스텀 규칙으로 동등 탐지 가능하면 폐기 |
| module type별 다른 임계값 | 기존 도구는 전역 설정만 | 전역 임계값이 동등한 결과를 내면 폐기 |
| PoC→MVP→Prod 단계별 기준 | 기존 도구에 개념 없음 | 단일 기준이 단계별 기준보다 효과적이면 폐기 |
| LLM 리팩토링 금지 영역 | 기존 도구는 LLM을 전제하지 않음 | LLM이 금지 영역 없이도 안전하면 폐기 |
| 맥락 기반 설명 | 기존 도구는 수치만 보고 | 수치만으로 동등한 리팩토링 품질이면 폐기 |

---

## 5. Gate 시스템

코드를 **발전 가능한 객체**로 취급합니다.

| Gate | 엄격도 | Waiver | 핵심 |
|------|--------|--------|------|
| PoC | 느슨 | ❌ | 돌아가면 OK |
| MVP | 표준 | ❌ | 처음부터 제대로 |
| Production | 엄격 | ✅ (ADR 필요) | 본질적 복잡도만 면제 |

### Gate별 임계값 (🧀 Cheese 기준)

| 지표 | PoC | MVP | Production |
|------|-----|-----|-----------|
| 중첩 깊이 | ≤ 6 | ≤ 4 | ≤ 3 |
| 개념 수 | ≤ 12 | ≤ 9 | ≤ 7 |
| 숨겨진 의존성 | ≤ 4 | ≤ 2 | ≤ 1 |
| Golden test 커버리지 | ≥ 50% | ≥ 80% | ≥ 95% |

**반증 조건**: 이 임계값이 실제 프로젝트에서 리뷰 시간/버그 발생률과 상관 없으면 수치 재보정.

---

## 6. 범위와 경계

semantic-complexity는 **정적 분석 신호 제공자**이지, 강제 시스템이 아닙니다.

| 이 시스템이 하는 것 | 이 시스템이 하지 않는 것 |
|---|---|
| 3축 복잡도 측정 | 실제 차단/강제 (CI/CD) |
| Gate pass/fail 판정 | 테스트 실행 (test framework) |
| 리팩토링 방향 제안 | 보안 스캐닝 (전용 도구) |
| LLM 금지 영역 경고 | SBOM/서명 (보안 도구) |

---

## 7. 명시적 한계

1. **정적 분석의 본질적 한계**: 런타임 행동, 동적 디스패치, 리플렉션 탐지 불가
2. **Canonical Profile 보정 필요**: 경험적 수치이며 도메인/조직에 따라 조정 필요
3. **LLM 판단의 잔여 비결정성**: 측정·판정은 결정론화 가능하나 후보 생성에 비결정성 잔존
4. **보안 판정의 범위**: 🍞 Bread는 보안 구조 존재 여부를 체크하며, 취약점 탐지는 전용 도구 보완
5. **Python AST만 완전 구현**: TypeScript/Go는 제한적

---

## 참고 문헌

- [1] Miller, G.A. (1956). "The Magical Number Seven, Plus or Minus Two". Psychological Review, 63(2), 81–97.
- [2] Campbell, G.A. (2017). "Cognitive Complexity: A new way of measuring understandability". SonarSource.
- [3] Cousot, P. & Cousot, R. (1977). "Abstract interpretation: a unified lattice model for static analysis of programs". POPL '77, 238–252.
- [4] McCabe, T.J. (1976). "A Complexity Measure". IEEE Transactions on Software Engineering, SE-2(4), 308–320.

---

## 관련 문서

- [STABILITY_INVARIANTS.md](STABILITY_INVARIANTS.md) — 불변조건 전체 스펙
- [LLM_REFACTORING_PROTOCOL.md](LLM_REFACTORING_PROTOCOL.md) — LLM 운용 규칙
- [MODULE_TYPES.ko.md](MODULE_TYPES.ko.md) — 모듈 타입 분류 체계
- [RESEARCH.md](RESEARCH.md) — 검증 대기 중인 탐구적 이론 (Tier 3)
