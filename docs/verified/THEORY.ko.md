# 이론적 토대 (Tier 2 — 검증된 근거만)

> 이 문서에는 **실험 또는 외부 동료 심사로 검증된 주장만** 포함한다.
> 미검증 가설은 [RESEARCH.md](../hypothesis/RESEARCH.md)에서 관리한다.
> Tier 2 승격 기준: unit test 재현, 외부 동료 심사 논문의 직접 인용, 또는 통제된 실험 결과.

---

## 1. 검증된 것

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

- 검증 파일: `tests/test_compound_anti_patterns.py`
- 상세 정의: [COMPOUND_ANTI_PATTERNS.md](COMPOUND_ANTI_PATTERNS.md)
- 근거: Eaddy et al. 2008 [8], Stoica et al. 2024 [9], Sweller et al. 2019 [5]
- SA 2가지 조합이 파일 수준 90%에서 보편적임을 n=94 SURVEY [S1]에서 확인

---

## 2. 외부 인용 (타인의 검증된 연구)

본 프로젝트의 실험이 아니라 외부 동료 심사 논문의 결론을 참조하는 것.
이 논문들의 주장이 본 프로젝트에 그대로 적용되는지는 별도 검증 필요.

| 주장 | 인용 | 적용 범위 제한 |
|------|------|--------------|
| 중첩 깊이↑ → 인지 비용 비선형 증가 | Campbell 2017 [2], Muñoz Barón et al. 2020 [2a] (r=0.654) | 사람 대상 측정. LLM에 동일하게 적용되는지 미확인 |
| 관심사 분산도↑ → 결함↑ | Eaddy et al. 2008 [8] | SAR 조합에 직접 적용한 것은 본 프로젝트의 추론 |
| Tangled 커밋 → 결함 예측 저하 | Herzig et al. 2015 [10] | PR 분리 가설의 간접 근거 |
| Retry+state → 멱등성 위반 | Stoica et al. 2024 [9] | SOSP 논문, 직접 실증 |
| 작업기억 용량 4±1 | Cowan 2001 [1] | 사람 대상. 코드 개념 수에 직접 적용한 선행연구 없음 |

---

## 3. 참고 문헌

### 인지 과학

- [1] Cowan, N. (2001). "The Magical Number 4 in Short-Term Memory."
  *Behavioral and Brain Sciences*, 24(1), 87–114.
  doi:[10.1017/S0140525X01003922](https://doi.org/10.1017/S0140525X01003922)

- [1b] Miller, G.A. (1956). "The Magical Number Seven, Plus or Minus Two."
  *Psychological Review*, 63(2), 81–97.
  doi:[10.1037/h0043158](https://doi.org/10.1037/h0043158)
  — 역사적 참고. 단기기억 측정치이며 작업기억(working memory)이 아님.

- [5] Sweller, J., van Merriënboer, J.J.G., & Paas, F. (2019).
  "Cognitive Architecture and Instructional Design: 20 Years Later."
  *Educational Psychology Review*, 31, 261–292.
  doi:[10.1007/s10648-019-09465-5](https://doi.org/10.1007/s10648-019-09465-5)

- [5a] Duran, R.S., Rurenko, A., & Sorva, J. (2022).
  "Cognitive Load Theory in Computing Education Research: A Review."
  *ACM Transactions on Computing Education*, 22(4), Article 43.
  doi:[10.1145/3483843](https://doi.org/10.1145/3483843)

### 소프트웨어 복잡도

- [2] Campbell, G.A. (2017). "Cognitive Complexity." SonarSource 백서.
  — 동료 심사 없음. 독립 검증 [2a] 참조.

- [2a] Muñoz Barón, M., Wyrich, M., & Wagner, S. (2020).
  "An Empirical Validation of Cognitive Complexity." *ESEM 2020*.
  doi:[10.1145/3382494.3410636](https://doi.org/10.1145/3382494.3410636)

- [4] McCabe, T.J. (1976). "A Complexity Measure."
  *IEEE TSE*, SE-2(4), 308–320.
  doi:[10.1109/TSE.1976.233837](https://doi.org/10.1109/TSE.1976.233837)

### 관심사 분리와 결함

- [8] Eaddy, M. et al. (2008). "Do Crosscutting Concerns Cause Defects?"
  *IEEE TSE*, 34(4), 497–515.
  doi:[10.1109/TSE.2008.27](https://doi.org/10.1109/TSE.2008.27)

- [9] Stoica, B.A. et al. (2024). "If At First You Don't Succeed..."
  *SOSP 2024*.
  doi:[10.1145/3694715.3695971](https://doi.org/10.1145/3694715.3695971)

- [10] Herzig, K., Just, S., & Zeller, A. (2015).
  "The Impact of Tangled Code Changes on Defect Prediction Models."
  *ESE*, 21(2), 303–336.
  doi:[10.1007/s10664-015-9376-6](https://doi.org/10.1007/s10664-015-9376-6)

### 실험적 근거 (본 프로젝트)

- [S1] n=94 SURVEY (2026). `.sisyphus/experiments/SURVEY/unified-data.tsv`
- [T1] 복합 안티패턴 버그 재현 (2026). `tests/test_compound_anti_patterns.py` — 18/18 pass.

### 인용 정정 이력

1. ~~Cousot 1977을 SAR 근거로 인용~~ → 삭제. 구조적 유사성은 가설로 RESEARCH.md 이동.
2. ~~Miller 1956을 "작업기억 7±2"로 인용~~ → Cowan 2001로 대체, Miller는 역사적 참고.
3. ~~Lee 2006을 async/await 근거로 인용~~ → 멀티스레드 논문, 범위 축소.
4. ~~Helland 2012를 retry 근거로 인용~~ → Stoica 2024(SOSP)로 대체.
5. ~~Campbell 2017만 인용~~ → Muñoz Barón 2020 독립 검증 추가.
6. ~~"개념 수 ≤ 9" 확정값~~ → 미검증 경험적 파라미터, hypothesis/RESEARCH.md로 이동.
7. ~~SKILL 파일 3개~~ → 가설 단계에서 검증 전 SKILL 존재 부적절, 삭제.

---

## 관련 문서

- [RESEARCH.md](../hypothesis/RESEARCH.md) — 미검증 가설 전체 (THEORY에서 강등된 것 포함)
- [COMPOUND_ANTI_PATTERNS.md](COMPOUND_ANTI_PATTERNS.md) — 9개 패턴 상세 정의 (같은 디렉토리)
- [EXPERIMENT_PROTOCOL.md](../EXPERIMENT_PROTOCOL.md) — 실험 설계 프로토콜
- [STABILITY_INVARIANTS.md](../hypothesis/STABILITY_INVARIANTS.md) — 불변조건 스펙 (가설)
