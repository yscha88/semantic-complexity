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
| 개념 수 ≤ 9 | Cowan 2001 [1], Sweller et al. 2019 [5] | 작업기억 용량 4±1(Cowan). 코드 이해에서 요소 간 상호작용(element interactivity)이 증가하면 인지 부하가 비선형 증가(Sweller CLT). 9는 경험적 상한 — **실험적 검증 대상** | 개념 수 10+ 함수의 리뷰 오류율을 ≤9 함수와 비교 |
| SAR 3가지 공존 금지 (hard fail) | Eaddy et al. 2008 [8], Stoica et al. 2024 [9], Sweller et al. 2019 [5], n=94 SURVEY | 관심사 분산도(scattering)가 높을수록 결함 밀도 증가(Eaddy, 실증). Retry+state → 멱등성 위반·상태 오염(Stoica, 실증). 3가지 조합 시 element interactivity가 곱셈적 증가(Sweller, 이론). **직접적 SAR 조합 연구는 없음 — 간접 근거 기반 추론** | SAR 위반 코드의 버그 발생률을 준수 코드와 비교 |
| 복합 안티패턴 9종 | **unit test 재현 (18/18 pass)** [T1] | 9개 패턴 각각이 실제 버그를 만들고, 안전한 대안은 만들지 않음을 unit test로 증명. SA-CROSS(interleaving race), SA-LOOP(stop 후 처리), SA-ACCUM(불완전 상태 노출), SR-LEAK(상태 잔존), SR-ACCUM(비멱등 카운팅), SR-PARTIAL(상태 불일치), AR-SWALLOW(CancelledError 삼킴), AR-INFINITE(무제한 재시도), AR-STORM(uniform interval). 상세 정의: [COMPOUND_ANTI_PATTERNS.md](COMPOUND_ANTI_PATTERNS.md) | ✅ **증명 완료**: `tests/test_compound_anti_patterns.py` (18/18 pass) |
| SA/SR/AR 조건부 경고 | Sutter & Alexandrescu 2004 [6], n=94 SURVEY, **unit test [T1]** | 2가지 조합은 파일 수준 90%에서 발견(보편적). 함수 수준에서 경계 조건 충족 시에만 위험 — unit test로 "위험한 경우"와 "안전한 경우"를 모두 증명 | ✅ **증명 완료**: 위반 코드 6건 버그 재현, 안전한 대안 6건 버그 없음 |
| 중첩 깊이 ≤ N | Muñoz Barón et al. 2020 [2a], Campbell 2017 [2] | 중첩이 깊을수록 인지 비용이 비선형 증가. Campbell의 Cognitive Complexity 메트릭이 이해 시간과 유의미한 상관(r=0.654, 독립 검증) | SonarQube Cognitive Complexity와 상관 분석 |

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

**실험적 근거**:
- ✅ **EXP-02** [S2]: 🧀 Cheese SKILL → 의미적 배치 (openpilot 3모델 재현)
- ✅ **EXP-03** [S3]: 🍞 Bread SKILL → 오탐 감소, 누락 감소, 우선순위 자동 결정 (fastapi-realworld 3모델 재현)
- SKILL 없으면: 위험 나열 + 오탐 포함 + 모델마다 다른 구조
- SKILL 있으면: 체계적 분류 + 정확한 판정 + 3모델 동일 프레임

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

### 인지 과학

- [1] Cowan, N. (2001). "The Magical Number 4 in Short-Term Memory:
  A Reconsideration of Mental Storage Capacity."
  *Behavioral and Brain Sciences*, 24(1), 87–114.
  doi:[10.1017/S0140525X01003922](https://doi.org/10.1017/S0140525X01003922)
  — 작업기억 용량 4±1. Miller 1956의 7±2를 수정.
    리허설 전략 없이 순수 저장 용량을 재측정.

- [1b] Miller, G.A. (1956). "The Magical Number Seven, Plus or Minus Two."
  *Psychological Review*, 63(2), 81–97.
  doi:[10.1037/h0043158](https://doi.org/10.1037/h0043158)
  — 역사적 참고. **주의**: 단기기억 즉각 회상 측정치이며,
    작업기억(working memory)이 아님. Cowan 2001/2015에서 과잉 해석 경고.
    코드 개념 수에 직접 적용한 선행 연구는 없음.
    C1의 상한 9는 Miller가 아닌 **경험적 파라미터**로 취급.

- [5] Sweller, J., van Merriënboer, J.J.G., & Paas, F. (2019).
  "Cognitive Architecture and Instructional Design: 20 Years Later."
  *Educational Psychology Review*, 31, 261–292.
  doi:[10.1007/s10648-019-09465-5](https://doi.org/10.1007/s10648-019-09465-5)
  — 인지 부하 이론(CLT) 20년 종합 리뷰. **Element interactivity**
    (요소 간 상호작용성)가 intrinsic load의 핵심 결정 요인.
    SAR 조합은 element interactivity가 곱셈적으로 증가하는 사례.

- [5a] Duran, R.S., Rurenko, A., & Sorva, J. (2022).
  "Cognitive Load Theory in Computing Education Research: A Review."
  *ACM Transactions on Computing Education*, 22(4), Article 43.
  doi:[10.1145/3483843](https://doi.org/10.1145/3483843)
  — CLT의 프로그래밍 교육 적용 체계적 리뷰. CLT가 코드 이해,
    디버깅, 프로그래밍 학습에서 실증적으로 유효함을 확인.

### 소프트웨어 복잡도

- [2] Campbell, G.A. (2017). "Cognitive Complexity: A New Way of
  Measuring Understandability." SonarSource 백서.
  https://www.sonarsource.com/resources/cognitive-complexity/
  — **주의**: 동료 심사를 거치지 않은 상업 백서. 독립 검증 [2a] 참조.

- [2a] Muñoz Barón, M., Wyrich, M., & Wagner, S. (2020).
  "An Empirical Validation of Cognitive Complexity as a Measure
  of Source Code Understandability." *Proceedings of the 14th ACM/IEEE
  International Symposium on Empirical Software Engineering and
  Measurement (ESEM)*, Article 29.
  doi:[10.1145/3382494.3410636](https://doi.org/10.1145/3382494.3410636)
  — Campbell의 Cognitive Complexity 메트릭을 **독립 검증**.
    이해 시간과 유의미한 상관(r=0.654). C3(중첩 깊이)의 실증 근거.

- [4] McCabe, T.J. (1976). "A Complexity Measure."
  *IEEE Transactions on Software Engineering*, SE-2(4), 308–320.
  doi:[10.1109/TSE.1976.233837](https://doi.org/10.1109/TSE.1976.233837)
  — 순환복잡도. 제어 흐름의 독립 경로 수(H₁)만 측정하는 한계를
    본 프로젝트가 다차원으로 극복하려 함.

### 관심사 분리와 결함 밀도

- [8] Eaddy, M., Zimmermann, T., Sherwood, K.D., Garg, V., Murphy, G.C.,
  Nagappan, N., & Aho, A.V. (2008). "Do Crosscutting Concerns Cause
  Defects?" *IEEE Transactions on Software Engineering*, 34(4), 497–515.
  doi:[10.1109/TSE.2008.27](https://doi.org/10.1109/TSE.2008.27)
  — 관심사 분산도(scattering degree)와 결함 수 사이에
    **중간~강한 통계적 상관관계** (3개 대규모 케이스 스터디).
    SAR 조합의 결함 위험에 대한 가장 직접적인 실증 근거.

- [9] Stoica, B.A., et al. (2024). "If At First You Don't Succeed,
  Try, Try, Again...? Insights and LLM-informed Tooling for
  Detecting Retry Bugs." *Proceedings of the 30th ACM Symposium on
  Operating Systems Principles (SOSP)*.
  doi:[10.1145/3694715.3695971](https://doi.org/10.1145/3694715.3695971)
  — Retry 로직 자체가 복잡한 버그 패턴을 만듦.
    특히 state와 결합 시 멱등성 위반, 상태 오염, cascading failure.
    Microsoft Research + University of Chicago 공동 연구.

- [10] Herzig, K., Just, S., & Zeller, A. (2015).
  "The Impact of Tangled Code Changes on Defect Prediction Models."
  *Empirical Software Engineering*, 21(2), 303–336.
  doi:[10.1007/s10664-015-9376-6](https://doi.org/10.1007/s10664-015-9376-6)
  — 여러 무관한 변경이 섞인(tangled) 커밋이 결함 예측을
    크게 저하시킴. 관심사 분리 실패의 유지보수 비용.

### 관심사 분리 원칙

- [11] Dijkstra, E.W. (1974). "On the Role of Scientific Thought."
  EWD 447. https://www.cs.utexas.edu/~EWD/ewd04xx/EWD447.PDF
  — Separation of Concerns의 원전.
    "one is willing and able to study in depth an aspect of one's
    subject matter *in isolation*"

- [12] Parnas, D.L. (1972). "On the Criteria To Be Used in Decomposing
  Systems into Modules." *Communications of the ACM*, 15(12), 1053–1058.
  doi:[10.1145/361598.361623](https://doi.org/10.1145/361598.361623)
  — 정보 은닉(information hiding) 원칙. 모듈 분해의 기준.

### 공유 상태와 동시성

- [6] Sutter, H. & Alexandrescu, A. (2004). *C++ Coding Standards:
  101 Rules, Guidelines, and Best Practices.* Addison-Wesley.
  ISBN 0-321-11358-6.
  Rule 10: "Minimize shared data." Rule 12: "Prefer immutable data."
  — 공유 가변 상태 최소화 원칙. 범용 실무 가이드라인.

- [3] Lee, E.A. (2006). "The Problem with Threads."
  *IEEE Computer*, 39(5), 33–42.
  doi:[10.1109/MC.2006.180](https://doi.org/10.1109/MC.2006.180)
  — **적용 범위 주의**: 멀티스레드 환경에서 공유 가변 상태의
    비결정적 interleaving 문제. 단일 스레드 async/await에는
    직접 적용 불가하나, 코루틴 interleaving에서 유사한 문제 발생.

### 추상 해석과 LLM (구조적 유사성에 의한 인용, cf. [14])

- [13] Cousot, P. & Cousot, R. (1977). "Abstract Interpretation:
  A Unified Lattice Model for Static Analysis of Programs by
  Construction or Approximation of Fixpoints."
  *Conference Record of the 4th ACM POPL*, 238–252.
  doi:[10.1145/512950.512973](https://doi.org/10.1145/512950.512973)
  — **인용 범위와 한계**: 원 논문은 1977년에 결정론적 정적 분석을
    위해 제시된 이론이며, LLM을 다루지 않는다. SAR 규칙의 직접 근거가 **아니다.**
    본 프로젝트에서는 다음의 **구조적 유사성(structural analogy)**에 의해 인용한다:

    | Abstract Interpretation (Cousot) | SKILLS + MCP (본 프로젝트) |
    |---|---|
    | 구체 의미론(C)을 추상 도메인(A)으로 요약 | 코드의 실제 동작을 🍞🧀🥓 3축으로 요약 |
    | α(추상화): C → A | SKILLS가 "어떤 관점으로 요약할지" 정의 |
    | 검증기가 soundness 보장 | MCP가 결정론적 측정으로 판정 보강 |
    | 정밀도↑ → 계산 비용↑ | 의미론적 결합도↑ → LLM 토큰 효율↓ |

    이 유사성은 EXP-02(openpilot, 3모델)에서 실험적으로 관찰됨:
    결합도 높은 코드(A)에서 LLM은 "근접 배치"(토큰 비효율적 추론),
    결합도 낮은 코드(B)에서는 "의미적 배치"(토큰 효율적 추론).

    **원 논문과의 차이**: Cousot의 Abstract Interpretation은
    soundness(false negative 없음)를 수학적으로 보장한다.
    LLM은 확률적 추정기이므로 이 보장이 없다.
    따라서 "LLM이 추상 해석기다"가 아니라,
    "LLM의 코드 요약 과정이 추상 해석과 **구조적으로 유사하며**,
    추상 해석에서 알려진 정밀도-비용 trade-off가
    LLM에서도 관찰된다"는 범위로 제한한다.
    Mitchell et al. 2025 [14]가 이 관점을 학술적으로 선행 탐구.

- [14] Mitchell, J.L., Kim, B.H., Zhou, C., & Wang, C. (2025).
  "Understanding Formal Reasoning Failures in LLMs as Abstract
  Interpreters." *Proceedings of the 1st ACM SIGPLAN International
  Workshop on Language Models and Programming Languages (LMPL '25)*,
  Singapore. ACM.
  doi:[10.1145/3759425.3763389](https://doi.org/10.1145/3759425.3763389)
  — **학회 논문 (ACM SIGPLAN 워크숍, peer reviewed)**.
    LLM에게 abstract interpretation 기반 추론으로 프로그램 불변식을
    생성하게 하는 프롬프트 전략을 제안. SV-COMP 벤치마크 22개
    프로그램에서 soundness와 추론 오류 패턴을 분석.
    **Cousot & Cousot 1977 [13]을 직접 인용**하여
    "LLM을 추상 해석기 관점에서 분석"하는 프레임워크를 제시.
    본 프로젝트의 [13] 구조적 유사성 인용과 동일한 방향의 학술적 선행 연구.

### 실험적 근거 (본 프로젝트)

- [S1] n=94 SURVEY (2026). 94개 MIT/BSD 오픈소스 레포 측정.
  `.sisyphus/experiments/SURVEY/unified-data.tsv`
  — SA 조합이 파일 수준 90%에서 발견. 2가지 조합은 보편적이므로
    함수 수준 + 경계 조건에서만 경고하는 것이 실용적.
  — 프로젝트 규모별 단조 패턴: 테스트 0% 비율이 소규모 49% → 대규모 0%.

- [S2] EXP-02 (2026). openpilot/MIT 실제 수정 과제, 3모델 재현.
  `.sisyphus/experiments/EXP-02/design.md`
  — 의미론적 결합도가 높은 코드(A)에서 LLM은 "근접 배치"(토큰 비효율),
    결합도가 낮은 코드(B)에서는 "의미적 배치"(토큰 효율). 3모델 재현.

- [T1] 복합 안티패턴 버그 재현 테스트 (2026).
  `tests/test_compound_anti_patterns.py` — **18/18 pass**.
  9개 복합 안티패턴(SA-CROSS, SA-LOOP, SA-ACCUM, SR-LEAK, SR-ACCUM,
  SR-PARTIAL, AR-SWALLOW, AR-INFINITE, AR-STORM) 전체가 실제 버그를
  만드는지 unit test로 증명. 각 패턴에 대해
  "취약 코드 → 버그 재현" + "안전한 대안 → 버그 없음"을 쌍으로 검증.
  상세 정의: [COMPOUND_ANTI_PATTERNS.md](COMPOUND_ANTI_PATTERNS.md)

- [S3] EXP-03 (2026). fastapi-realworld/MIT 보안 분석, 4회(A 1 + B 3모델).
  🍞 Bread SKILL(B1-B4)이 보안 분석 품질을 개선함을 확인:
  - A(SKILL 없음): 위험 16개 나열, B4 오탐(.format→injection), pyproject.toml 누락
  - B(SKILL 있음): B1-B4 체계 평가, B4 정확 PASS, pyproject.toml+test_secret 추가 발견
  - 3모델(quick/ultrabrain/deep) 전원 동일 핵심 판정(B3 CRITICAL, B4 PASS)

### 인용 정정 이력

1. ~~Cousot 1977을 SAR 규칙의 근거로 인용~~ (v0.1)
   → 원 논문은 관심사 조합의 불가능성을 주장하지 않음.
   **삭제 후 "구조적 유사성(structural analogy)"으로 재인용** [13]:
   원 논문의 "정밀도-비용 trade-off"가 LLM의 "결합도-토큰 효율 trade-off"와
   구조적으로 유사함을 참조. 원 논문이 LLM을 다루지 않으며
   soundness 보장이 LLM에 없다는 차이를 명시.

2. ~~Miller 1956을 "작업기억 7±2"로 인용~~ (v0.1)
   → 단기기억 측정치이며 코드 적용 선행연구 없음. **Cowan 2001로 대체, Miller는 역사적 참고** [1][1b].

3. ~~Lee 2006을 "async/await의 직접 근거"로 인용~~ (v0.2)
   → 멀티스레드 논문이며 단일 스레드 async에 직접 적용 불가. **범위 축소** [3].

4. ~~Helland 2012를 "함수 내 retry의 근거"로 인용~~ (v0.2)
   → 분산 시스템 간 통신 논문. 함수 내 retry에는 직접 적용 불가.
   **Stoica 2024(SOSP)로 대체** — retry + state 조합의 직접 실증 근거 [9].

5. ~~Campbell 2017만 인용~~ (v0.1)
   → 동료 심사 없는 백서. **Muñoz Barón 2020(ESEM) 독립 검증 추가** [2a].

---

## 관련 문서

- [STABILITY_INVARIANTS.md](STABILITY_INVARIANTS.md) — 불변조건 전체 스펙
- [LLM_REFACTORING_PROTOCOL.md](LLM_REFACTORING_PROTOCOL.md) — LLM 운용 규칙
- [MODULE_TYPES.ko.md](MODULE_TYPES.ko.md) — 모듈 타입 분류 체계
- [RESEARCH.md](RESEARCH.md) — 검증 대기 중인 탐구적 이론 (Tier 3)
