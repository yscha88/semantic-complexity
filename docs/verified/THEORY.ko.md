# 이론적 토대 (Tier 2 — 검증된 근거만)

> 이 문서에는 **실험으로 검증된 주장만** 포함한다.
> 외부 논문 인용은 "인용일 뿐"이므로 참고 문헌 섹션에만 둔다.
> 미검증 가설은 [RESEARCH.md](../hypothesis/RESEARCH.md)에서 관리한다.

---

## 검증된 것

### SAR 복합 안티패턴 9종 — unit test 검증 [T1]

state × async × retry의 2가지 이상 조합에서 발생하는 9개 버그 패턴.
각 패턴이 실제 버그를 만든다는 것을 unit test로 증명 (18/18 pass).

| 패턴 | 조합 | 버그 유형 | 검증 |
|------|------|----------|------|
| SA-CROSS | state+async | interleaving race | ✅ test pass |
| SA-LOOP | state+async | stop 후 처리 | ✅ test pass |
| SA-ACCUM | state+async | 불완전 상태 노출 | ✅ test pass |
| SR-LEAK | state+retry | 상태 잔존 | ✅ test pass |
| SR-ACCUM | state+retry | 비멱등 카운팅 | ✅ test pass |
| SR-PARTIAL | state+retry | 상태 불일치 | ✅ test pass |
| AR-SWALLOW | async+retry | CancelledError 삼킴 | ✅ test pass |
| AR-INFINITE | async+retry | 무제한 재시도 | ✅ test pass |
| AR-STORM | async+retry | uniform interval | ✅ test pass |

검증 파일: `tests/test_compound_anti_patterns.py`
상세 정의: [COMPOUND_ANTI_PATTERNS.md](COMPOUND_ANTI_PATTERNS.md)

### 검증 범위와 한계

| 검증된 것 | 검증 안 된 것 |
|----------|------------|
| 이 9개 패턴이 버그를 만든다 (unit test 재현) | 이 패턴이 실제 오픈소스 레포에서 얼마나 존재하는가 |
| 안전한 대안은 버그를 만들지 않는다 | LLM이 이 패턴을 탐지할 수 있는가 |
| | "2가지=경고, 3가지=실패" 임계값이 적절한가 |
| | 이 패턴 외에 다른 위험한 조합이 있는가 |

### 실험 체크리스트 (experiments/EXPERIMENT_MATRIX.md)

```
✅ 독립변인 1개: 각 패턴의 취약/안전 코드 쌍
✅ 통제변인 동일: 동일 구조, 패턴만 차이
✅ 힌트 없음: 코드에 답을 알려주는 주석 없음
⚠️ 인공 코드: 일반적 패턴을 재현한 인공 코드 — Tier 2 근거로 인정하되 한계 명시
✅ 재현 가능: `pytest tests/test_compound_anti_patterns.py`
✅ 범위 초과 주장 없음: "버그를 만든다"만 주장, "LLM이 탐지한다"는 주장 안 함
✅ 교란 변인: 이전 실험의 교란 변인 해당 없음 (unit test)
```

---

## 참고 문헌

외부 인용은 논문 자체의 주장을 참조하는 것일 뿐, 본 프로젝트에 동일하게 적용된다는 검증은 아님.

### 인지 과학
- [1] Cowan, N. (2001). *Behavioral and Brain Sciences*, 24(1), 87–114.
- [5] Sweller, J. et al. (2019). *Educational Psychology Review*, 31, 261–292.

### 소프트웨어 복잡도
- [2] Campbell, G.A. (2017). SonarSource 백서. — 동료 심사 없음.
- [2a] Muñoz Barón, M. et al. (2020). *ESEM 2020*. — [2]의 독립 검증.
- [4] McCabe, T.J. (1976). *IEEE TSE*, SE-2(4), 308–320.

### 관심사 분리와 결함
- [8] Eaddy, M. et al. (2008). *IEEE TSE*, 34(4), 497–515.
- [9] Stoica, B.A. et al. (2024). *SOSP 2024*.
- [10] Herzig, K. et al. (2015). *ESE*, 21(2), 303–336.

### 본 프로젝트 실험
- [S1] n=94 SURVEY (2026). `.sisyphus/experiments/SURVEY/unified-data.tsv`
- [T1] 복합 안티패턴 버그 재현 (2026). `tests/test_compound_anti_patterns.py` — 18/18 pass.

### 인용 정정 이력
1. ~~Cousot 1977을 SAR 근거로 인용~~ → 삭제.
2. ~~Miller 1956을 "작업기억 7±2"로 인용~~ → Cowan 2001로 대체.
3. ~~Lee 2006을 async/await 근거로 인용~~ → 범위 축소.
4. ~~Helland 2012를 retry 근거로 인용~~ → Stoica 2024로 대체.
5. ~~"개념 수 ≤ 9" 확정값~~ → hypothesis/RESEARCH.md로 이동.
6. ~~SKILL 파일~~ → 삭제 (가설 단계에서 부적절).
7. ~~"외부 인용"을 "검증된 것"에 포함~~ → 참고 문헌으로 분리 (인용 ≠ 검증).

---

## 관련 문서
- [RESEARCH.md](../hypothesis/RESEARCH.md) — 미검증 가설
- [COMPOUND_ANTI_PATTERNS.md](COMPOUND_ANTI_PATTERNS.md) — 9개 패턴 상세
- [EXPERIMENT_MATRIX.md](../../experiments/EXPERIMENT_MATRIX.md) — 실험 설계 + 프로토콜
