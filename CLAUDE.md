# semantic-complexity 프로젝트 컨텍스트

## 핵심 이론: ML 파이프라인 구조

```
╔═════════════════════════════════════════════════════════════╗
║  INPUT (5D)                                    [데이터 수집] ║
║  5D Vector: [C, N, S, A, Λ] + 패턴 탐지                     ║
╚═════════════════════════════════════════════════════════════╝
                              │
┌─────────────────────────────────────────────────────────────┐
│  PROCESSING                                   [전처리/가중치] │
│  L2: 정규화 (Simplex, Penalty, 필터)                        │
│  L3: 판단 (Waiver, Context) [LLM/Human]                     │
└─────────────────────────────────────────────────────────────┘
                              │
╔═════════════════════════════════════════════════════════════╗
║  OUTPUT (3축)                                       [추론]  ║
║  🍞 Bread / 🧀 Cheese / 🥓 Ham + Gate 결과                  ║
╚═════════════════════════════════════════════════════════════╝
```

### 축별 처리 경로
- **🧀 Cheese**: 5D(C,N) → Penalty → state×async×retry 판단 → accessible
- **🍞 Bread**: 5D(S,A,Λ)+patterns → leak필터 → AUTH_FLOW 판단 → violations
- **🥓 Ham**: tests탐색 → 매칭 → coverage 판단 → protected/total

### Context-aware 해석
| Context | 🧀 Cheese | 🍞 Bread | 🥓 Ham |
|---------|-----------|----------|--------|
| api/external | 엄격 | 최엄격 | Contract 필수 |
| lib/domain | 중간 | 완화 | Golden 필수 |

**핵심**: INPUT은 context-free, PROCESSING에서 context 주입, OUTPUT은 context-aware.

## 불변조건

### 🧀 Cheese 인지 가능 조건 (4가지 모두 충족)
1. 중첩 깊이 ≤ N
2. 개념 수 ≤ 9개/함수 (Miller's Law 7±2)
3. 숨겨진 의존성 최소화
4. state×async×retry 2개 이상 공존 금지

### 🍞 Bread 보안 조건
- Trust Boundary 명시적 정의
- AUTH_FLOW 선언 (NONE 포함 가능)
- Secret 하드코딩 금지
- 민감정보 출력 금지 (SECRET_LEAK_PATTERNS)

### 🥓 Ham 행동 보존 조건
- Critical Path에 Golden Test 존재
- API에 Contract Test 존재
- 핵심 경로 보호율 측정

## Gate 시스템 (3단계)

| 단계 | 용도 | Waiver |
|------|------|--------|
| PoC | 빠른 검증 | ❌ |
| MVP | 첫 릴리스 | ❌ |
| Production | 운영 | ✅ (ADR 필요) |

## 파일 구조

- `docs/THEORY.ko.md`: 이론적 토대 (왜)
- `docs/SRS.ko.md`: 요구사항 (무엇을)
- `docs/SDS.ko.md`: 설계 (어떻게)
- `src/py/`: Python 구현
- `src/ts/`: TypeScript 구현

## LLM 작업 규칙

1. SRS/SDS 없는 기능 구현 금지
2. 문서 변경 시 CHANGELOG.ko.md 업데이트
3. 이론 계층 혼동 금지 (5D는 측정, 3축은 해석)
