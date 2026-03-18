# 검증 대기 중인 이론 (Tier 3 — 탐구)

> 본 문서의 모든 내용은 **가설(hypothesis)** 상태입니다.
> 각 가설에는 승격 조건(Tier 2로 이동)과 폐기 조건이 명시되어 있습니다.
> 통제 가능하고 재현 가능한 실험을 통해서만 상태가 변경됩니다.

---

## 가설 관리 규칙

```
상태 전이:

  Tier 3 (가설)
    │
    ├── 실험 통과 → Tier 2 (반증 가능한 근거) 승격
    ├── 실험 실패 → 폐기 (git history에만 보존)
    └── 실험 미실시 → Tier 3 유지 (6개월 후 재검토)
```

| 원칙 | 설명 |
|------|------|
| **반증 가능성** | 모든 가설은 "이것이 거짓이 되는 조건"이 명시되어야 함 |
| **재현 가능성** | 실험은 제3자가 동일 환경에서 반복 가능해야 함 |
| **통제 변인** | 베이스라인(기존 도구 또는 제어군) 대비 비교해야 함 |
| **최소 표본** | 골든세트 최소 20개 케이스, 동일 케이스 3회 반복 |
| **다변량 커버리지** | 언어×도메인×모델 조합을 교차하여 특정 조건 편향 방지 |

---

## 대규모 검증 프레임워크 (Tier 2 승격 요건)

> 개별 실험(EXP-01~04)은 파일럿/예비 관찰이다.
> Tier 2 승격에는 아래 프레임워크를 충족하는 대규모 실험이 필요하다.

### 표본 설계

| 차원 | 값 | 목적 |
|------|---|------|
| **언어** | Python, TypeScript, Go, C/C++, Rust, Ruby, Java, Kotlin (최소 8개) | 메모리 모델(GC/ARC/수동/소유권), 타입 시스템(동적/정적), 패러다임(OOP/함수형/구조체) 교차 |
| **도메인** | 웹 API, ML/데이터, CLI, 라이브러리, 인프라, 정보보안, 연구/과학, 데브옵스 (최소 8개) | 도메인 특화 편향 배제 |
| **레포 수** | 언어×도메인 조합당 최소 2개 = **128+ 레포** (빈 셀 감안 100+) | 개별 레포 특성 흡수 |
| **모델** | **필수**: openai/gpt-5.4, anthropic/claude-sonnet-4-6 (최소 2개). 교차 검증: google/gemini-3-pro. 총괄: anthropic/claude-opus-4-6 | 벤더별 편향 배제, 모델 ID+버전 고정 기록 필수 |
| **반복** | 동일 조건 3회 | 비결정성 흡수 |
| **라이선스** | MIT/BSD만 | 제3자 재현 가능 |

### 측정 및 통계

| 단계 | 방법 |
|------|------|
| **기술 통계** | 축별(🍞🧀🥓) 판정 도수분포표 — SKILL 유/무 × 언어 × 도메인 |
| **유의성 검정** | SKILL 유무 효과: χ² 검정 또는 Fisher exact test (기대 빈도 < 5 시) |
| **효과 크기** | Cohen's h 또는 odds ratio — "통계적으로 유의"할 뿐 아니라 "실질적으로 의미 있는" 차이인지 |
| **교차 분석** | 언어별 × 도메인별 하위 그룹 분석 — 특정 조건에서만 유효한지 확인 |
| **다중 비교 보정** | Bonferroni 또는 FDR — 하위 그룹 다수 비교 시 false positive 방지 |

### 도수분포표 예시 (목표 형식)

```
🧀 Cheese SKILL 효과 — 의미적 배치 vs 근접 배치 (Python 웹 API)

                    의미적 배치    근접 배치    계
SKILL 있음 (B)        27            3         30
SKILL 없음 (A)         8           22         30
계                    35           25         60

χ² = 24.3, p < 0.001, Cohen's h = 1.32 (large effect)
```

### 현재 실험의 위치

| 실험 | 위치 | 부족한 것 |
|------|------|----------|
| EXP-02 (Cheese 배치) | **파일럿** — 1 레포, 3 모델, 1회 | 44+ 레포, 3회 반복, 도수분포 |
| EXP-03 (Bread SKILL) | **파일럿** — 6 레포, 3 모델, Python만 | TS/Go 추가, 도메인 다변화 |
| Ham SKILL 실험 | **파일럿** — 2 레포, 1 모델 | 43+ 레포, 3 모델, 3회 반복 |
| H-07 (C1 개념 수) | **설계 완료** — 미실행 | 50+ 함수, 3 모델, 3회 반복 |

### 실행 계획

```
Phase 1 — 레포 수집 (2주)
  8개 언어 × 5개 도메인 = 40개 셀
  셀당 최소 2개 레포 = 80+ 레포
  MIT/BSD 라이선스, 커밋 해시 고정, 스타 500+

  | 언어 | 패러다임 | 웹 | ML/데이터 | CLI | 라이브러리 | 인프라 | 정보보안 | 연구/과학 | 데브옵스 |
  |------|---------|----|---------|----|----------|-------|--------|---------|---------|
  | Python | 동적/OOP | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 |
  | TypeScript | 정적/OOP | 2 | 2 | 2 | 2 | 2 | 2 | — | 2 |
  | Go | 정적/구조체 | 2 | — | 2 | 2 | 2 | 2 | — | 2 |
  | C/C++ | 수동 메모리 | — | 2 | 2 | 2 | 2 | 2 | 2 | — |
  | Rust | 소유권/정적 | 2 | — | 2 | 2 | 2 | 2 | — | 2 |
  | Ruby | 동적/OOP | 2 | — | 2 | 2 | 2 | — | — | 2 |
  | Java | 정적/OOP | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 |
  | Kotlin | 정적/함수형 | 2 | 2 | 2 | 2 | — | — | — | 2 |

  — = 해당 언어 생태계에서 자연스럽지 않은 조합 (빈 셀)
  → 빈 셀 제외 후 최소 100+ 레포 확보 목표
  → 언어당 최소 8개 레포, 도메인당 최소 10개 레포

Phase 2 — 베이스라인 측정 (3주)
  각 레포에서 대표 모듈 1개 선정
  3-그룹 실험 설계 — 가이드 구체성의 단계별 효과 측정:

  | 그룹 | 조건 | 구체성 수준 | 예시 (보안 축) |
  |------|------|-----------|-------------|
  | A | 간략한 가이드 | 낮음 | "이 코드의 보안을 분석하라. 취약점, 인증, 시크릿 문제를 찾아라." |
  | B | 체크리스트 | 중간 | A + "다음을 확인하라: 입력 검증, 인증 흐름, 시크릿 관리, 민감 데이터 노출" |
  | C | SKILL (상세 가이드) | 높음 | A + B1~B4 규칙별 판정 기준, 출력 형식, pass/warning/fail 판정 요구 |

  구체성 단계:
  ```
  A (간략) ⊂ B (체크리스트) ⊂ C (상세 가이드)
  
  A: "보안을 분석하라"
  B: A + "입력 검증, 인증, 시크릿, 민감 데이터를 확인하라"
  C: A + B + "B1: Trust boundary — 진입점마다 검증 존재?
               B2: Auth flow — 인증 정확? AUTH_FLOW 선언?
               B3: Secret — 하드코딩? 외부화?
               B4: 민감 데이터 — 로그/응답에 노출?
               각 규칙마다: 위치, pass/warning/fail, 수정 권고"
  ```

  핵심 비교:

  | 비교 | 분리하는 변인 | 질문 |
  |------|------------|------|
  | A vs B | 체크리스트 항목 나열 효과 | "뭘 봐야 하는지" 알려주면 달라지는가? |
  | B vs C | 판정 기준/형식의 상세화 효과 | "어떻게 판정하는지"까지 알려주면 달라지는가? |
  | A vs C | 전체 효과 (구체성 낮음 → 높음) | 간략 가이드 대비 상세 SKILL의 총 효과 |

  가능한 결론:
  - A < B < C → 구체성이 높을수록 분석 품질 향상 (SKILL 효용성 지지)
  - A < B ≈ C → 체크리스트만으로 충분, 상세 가이드는 추가 효과 없음
  - A ≈ B < C → 체크리스트 나열은 효과 없고, 판정 기준이 핵심
  - A ≈ B ≈ C → 가이드 구체성과 무관 (폐기)

  MCP/도구 조합 실험은 SKILL 효용성이 확인된 후 별도 단계로 진행.

  ### 점진적 확장 전략 (모수를 줄여서 시작, 유의미하면 확장)

  | 단계 | 언어 | 도메인 | 레포 | 모델 | 그룹 | 반복 | 실험 단위 | 목적 |
  |------|------|--------|------|------|------|------|----------|------|
  | **α (파일럿)** | 1 (Python) | 1 (웹 API) | 2 | 2 (gpt-5.4, sonnet-4.6) | A, C | 1 | **8** | 파이프라인 검증, 재현성 확인 |
  | **β (소규모)** | 4 (+Go, Java) | 4 (+CLI, 인프라) | 24 | 2 | A, B, C | 2 | **288** | 형식 vs 내용 분리, 유의성 초기 검증 |
  | **γ (중규모)** | 8 (전체) | 6 (+보안, 과학) | 60 | 3 (+gemini) | A, B, C | 3 | **1,620** | 교차 분석, 3벤더 재현 |
  | **δ (전체)** | 8 | 8 (전체) | 100+ | 3+ | A, B, C | 3 | **2,700+** | Tier 2 승격 판정 |

  진행 규칙:
  - α에서 A vs C vs E 간 방향성이 보이면 → β로 확장
  - α에서 A ≈ C ≈ E이면 → SKILL/도구 설계를 수정하거나, 가설 재검토
  - β에서 p < 0.1이면 → γ로 확장 (유의 수준 미달이지만 경향 존재)
  - β에서 p > 0.3이면 → 가설 폐기 검토
  - γ에서 p < 0.05 + 중간 효과 크기 + 3언어 재현 → δ로 확장
  - δ 완료 → Tier 2 승격/폐기 최종 판정

  단계 간 적응적 조정:
  - 각 단계 완료 시 중간 분석을 수행하고 다음 단계 설계를 조정
  - 특정 언어/도메인에서 효과가 집중되면 → 해당 축에 모수 집중 배분
  - 효과가 없는 축은 최소 유지 (반증 근거로 보존) — 삭제하지 않음
  - SKILL 자체의 문제가 의심되면 → SKILL 개선 후 동일 표본으로 재실행
  - 예상과 다른 경향 (예: 도구 단독이 조합보다 나음) → 즉시 원인 분석 후 설계 반영

  기록 의무:
  - 단계 간 조정 사항은 전부 RESEARCH.md에 기록 (사후 해석 방지)
  - "왜 이 축을 늘렸는가/줄였는가"의 판단 근거를 중간 분석 데이터와 함께 명시
  - 조정 전 설계 vs 조정 후 설계를 diff로 보존

Phase 3 — 데이터 분석 (1주)
  도수분포표 작성 (언어별, 도메인별, 모델별, 그룹별)
  3-그룹 비교: A vs B vs C (Kruskal-Wallis 또는 χ²)
  쌍별 비교: A-C (SKILL 전체 효과), A-B (형식 효과), B-C (내용 실효성)
  효과 크기 계산 (Cohen's h, odds ratio)
  교차 분석: 언어×도메인, 언어×모델, 도메인×모델, 벤더×축

Phase 4 — 결론 (1주)
  승격: p < 0.05 + 중간 이상 효과 크기 + 3개 이상 언어 + 2개 이상 모델 벤더에서 재현
  보류: p < 0.05이나 효과 크기 작음 또는 특정 언어/벤더에서만 유효
  폐기: p ≥ 0.05
```

---

## H-01: discrete HST 균형점의 실용적 가치

### 가설
코드베이스의 모듈들을 3축(🍞🧀🥓) 공간의 이산 점집합으로 취급하면,
discrete Ham Sandwich Theorem에 의해 3축을 동시 이등분하는 분할점이 존재하며,
이 분할점 정보가 리팩토링 우선순위 결정에 유의미한 신호를 제공한다.

### 현재 상태
- 정리의 적용 가능성: ✅ (코드→오토마타→이산 점집합 논증 체인 유효)
- 코드에서의 활용: ❌ (canonical profile과의 L2 거리만 계산, 정리 자체는 미활용)

### 승격 실험 (EXP-H01)
1. 오픈소스 프로젝트 3개에서 모듈별 [🍞,🧀,🥓] 벡터 계산
2. discrete HST 알고리즘으로 bisecting hyperplane 계산
3. hyperplane 기준으로 분류한 "우선 리팩토링 군"과 "후순위 군" 추출
4. 실제 git log에서 6개월 내 버그 수정/리팩토링이 발생한 모듈과 비교
5. **승격 조건**: HST 분류가 랜덤 분류 대비 유의미한 상관(p < 0.05)
6. **폐기 조건**: 상관이 없거나, 단순 에너지 거리 정렬과 동등하면 폐기

### 인용
- Stone & Tukey (1942). "Generalized 'sandwich' theorems". Duke Math. J., 9(2), 356–359.

---

## H-02: Hodge 분해를 통한 리팩토링 우선순위 분류

### 가설
코드 의존성 그래프에서 모듈 간 "품질 차이"를 1-cochain으로 정의하고
이산 Hodge 분해(Jiang et al. 2011)를 적용하면:
- **gradient 성분**: 전역적으로 일관된 개선 방향 (최우선 리팩토링)
- **harmonic 성분**: 본질적 복잡도 (Essential Complexity Waiver 대상)
- **curl 성분**: 순환 의존성 / trade-off (아키텍처 재설계 필요)

이 분류가 단순 에너지 정렬보다 리팩토링 효과를 유의미하게 개선한다.

### 현재 상태
- 이론적 기반: ✅ (HodgeRank는 검증된 알고리즘, O(|E| log(1/ε)))
- 코드 적용: ❌ (hodge.py는 단순 그룹핑, 실제 Hodge Laplacian 미구현)

### 승격 실험 (EXP-H02)

**전제 조건**: 쌍별 비교 데이터 수집 방법 정의 필요

```
실험 설계:
1. 대상: 오픈소스 프로젝트 1개 (50+ 모듈)
2. 입력: 의존성 그래프 + 모듈별 에너지(canonical 거리)
3. 1-cochain 정의: omega[(src,dst)] = energy(dst) - energy(src)
4. PyDEC로 Hodge 분해 실행
5. gradient 상위 20% 모듈에 리팩토링 적용
6. 대조군: 에너지 정렬 상위 20% 모듈에 리팩토링 적용
7. 측정: 리팩토링 후 전체 에너지 감소량, 토큰 사용량

승격 조건: Hodge gradient 기반 선택이 에너지 정렬 대비
           ΔQ/C (효율) +15% 이상
폐기 조건: 차이 없거나 에너지 정렬이 우수하면 폐기
```

### 인용
- Jiang, X. et al. (2011). "Statistical ranking and combinatorial Hodge theory". Mathematical Programming, 127(1), 203–244.
- Lim, L.-H. (2015). "Hodge Laplacians on Graphs". SIAM Review, 62(3), 685–715.

---

## H-03: OWL 온톨로지로 Gate 판정의 decidability 보장

### 가설
MODULE_TYPES.ko.md의 모듈 타입 분류를 OWL 2 DL 온톨로지로 형식화하면,
"이 모듈이 MVP Gate를 통과하는가?"를 OWL Reasoner(HermiT/Pellet)로
판정 가능(decidable)하게 만들 수 있다.

### 현재 상태
- 이론적 기반: ✅ (Description Logic은 판정 가능성 증명됨)
- 코드 적용: ❌ (온톨로지 파일 없음, Reasoner 연동 없음)

### 승격 실험 (EXP-H03)

```
실험 설계:
1. MODULE_TYPES.ko.md → OWL 2 DL 온톨로지 변환 (Protégé)
2. Gate 규칙을 SWRL 규칙 또는 DL 공리로 표현
3. 20개 모듈에 대해:
   a. 현재 if/threshold 코드의 판정 결과
   b. OWL Reasoner의 판정 결과
   c. 일치율 측정
4. DL로 표현 불가능한 규칙 식별 (LLM 판단이 필요한 영역)

승격 조건: Gate 규칙의 80% 이상이 DL로 표현 가능하고
           Reasoner 판정이 현재 코드와 100% 일치
폐기 조건: 50% 미만이 DL로 표현 가능하면 폐기
           (규칙이 너무 복잡하여 DL의 표현력을 초과)
```

### 인용
- Baader, F. et al. (2003). "The Description Logic Handbook". Cambridge University Press.

---

## H-04: 토큰 에너지 최적화 (ΔQ/C 효율 스코어)

### 가설
리팩토링 후보 각각에 대해 "품질 개선량(ΔQ) / 토큰 비용(C)"을 계산하면,
ΔQ/C가 높은 순서로 리팩토링하는 것이 랜덤 순서 또는 에너지 순서보다
총 비용 대비 총 품질 개선이 유의미하게 우수하다.

### 현재 상태
- 이론적 기반: ✅ (비용-효과 분석의 표준 프레임)
- 코드 적용: ❌ (ΔQ 추정, C 측정, 피드백 루프 모두 미구현)

### 승격 실험 (EXP-H04)

```
실험 설계:
1. 코드 20개, 각각에 3가지 순서로 리팩토링:
   a. ΔQ/C 효율 순서
   b. 에너지(canonical 거리) 순서
   c. 랜덤 순서
2. 각 순서별: 총 토큰 소비, 총 에너지 감소, 총 Gate 통과율 측정
3. LLM 모델 고정 (Claude Sonnet 4, temperature=0)

승격 조건: ΔQ/C 순서가 다른 두 순서 대비
           동일 토큰 예산에서 에너지 감소 +20% 이상
폐기 조건: 에너지 순서와 유의미한 차이 없으면 ΔQ/C 불필요 (에너지만 사용)
```

---

## H-05: 소형→대형 LLM 라우팅으로 토큰 비용 절감

### 가설
semantic-complexity의 분석 결과를 기반으로 리팩토링 난이도를 분류하고,
간단한 작업은 소형 LLM, 복잡한 작업만 대형 LLM에 라우팅하면
대형 LLM 단독 사용 대비 총 비용 70% 이상 절감, 품질 동등.

### 현재 상태
- 이론적 기반: ✅ (RouteLLM 85% 절감, Shepherding 42-94% 절감 실증)
- 코드 적용: ❌ (라우팅 로직 미구현)

### 승격 실험 (EXP-H05)

```
실험 설계:
1. 리팩토링 작업 30개 (난이도 상/중/하 각 10개)
2. 조건 A: 모두 대형 LLM (Claude Opus) → 토큰/비용/품질 측정
3. 조건 B: semantic-complexity 기반 라우팅
   - 🧀 violation만 있고 nesting만 초과 → 소형 (Haiku)
   - 🍞 trust boundary 추가 필요 → 대형 (Opus)
   - 🥓 golden test 작성 필요 → 대형 (Opus)
4. 품질 측정: Gate 통과율, 리뷰어 채점(1-5)

승격 조건: 비용 70% 이상 절감 + 품질 차이 0.5점 이내
폐기 조건: 비용 절감 50% 미만이면 라우팅 오버헤드 대비 가치 부족
```

### 인용
- Ding, D. et al. (2024). "RouteLLM: Learning to Route LLMs with Preference Data". arXiv:2406.18665.
- Saha, S. et al. (2026). "LLM Shepherding". arXiv:2601.22132.

---

## H-06: Vector DB에 품질 벡터 저장 시 유사도 검색의 실용적 가치

### 가설
모듈별 [🍞,🧀,🥓] 벡터를 Vector DB에 저장하면,
"canonical에서 가장 먼 모듈"을 즉시 검색할 수 있고,
"유사한 품질 프로필을 가진 모듈"을 클러스터링하여
일괄 리팩토링 전략을 수립할 수 있다.

### 현재 상태
- 이론적 기반: ⚠️ (코드 품질 벡터 DB 저장의 선행 사례 없음)
- 코드 적용: ❌ (Vector DB 미연동)

### 승격 실험 (EXP-H06)

```
실험 설계:
1. 오픈소스 프로젝트 1개 (100+ 모듈) 전체 분석
2. Qdrant에 모듈별 [🍞,🧀,🥓] + metadata 저장
3. 테스트:
   a. "canonical에서 가장 먼 모듈 5개" 검색 → 실제 기술부채와 일치?
   b. 유사 프로필 클러스터링 → 일괄 리팩토링이 개별보다 효율적?
   c. 검색 지연시간 측정 (100, 1K, 10K 모듈)

승격 조건: 검색 결과가 수동 분석(시니어 SQA)과 80% 이상 일치
폐기 조건: 단순 정렬(energy 내림차순)과 결과 동일하면 Vector DB 불필요
```

---

## H-07: 🧀 C1 — 개념 수와 LLM 결함 분석 능력 (EXP-04 재설계)

### 가설
하나의 함수에 포함된 의미론적 개념의 수가 증가하면,
LLM의 결함 분석 능력(정밀도, 수량 정확성)이 저하된다.

### EXP-04 무효화 교훈 반영

| EXP-04 실패 원인 | H-07 대응 |
|-----------------|----------|
| 인공 코드 → 실험자 의도 반영 | 다양한 MIT 레포의 실제 코드 사용 |
| "버그가 있다"고 알려줌 → 힌트 | **힌트 없음**: "이 코드를 분석하라" |
| fix 커밋을 정답지로 전제 | **정답지 없음**: LLM 주장을 unit test로 독립 검산 |
| 버그 유형 1가지만 | 다양한 도메인, 다양한 함수 |

### 핵심 원칙: 정답지 대조가 아니라 주장의 검산

```
기존 (폐기): fix 커밋 = 정답 → LLM이 정답을 맞추는지 채점
수정:        정답지 없음 → LLM이 자유 분석 → 주장을 unit test로 검산
```

### 실험 설계

```
전제 조건: MIT 라이선스 Python 레포 5+개에서 함수 수집
          (BugsInPy는 보조 소스로 활용 가능)

1. 코드 수집
   - MIT 레포에서 다양한 개념 수(5~20+)의 함수를 수집
   - 함수당 개념 수를 cheese-gate SKILL 기준으로 사전 측정
   - 최소 50개 함수 (개념 수 분포가 고르게)

2. LLM 자유 분석
   - 프롬프트: "이 함수를 분석하라. 버그가 있으면 지적하고, 없으면 없다고 하라."
   - 모델: quick, ultrabrain, deep (3 카테고리)
   - 각 함수 × 각 모델 1회
   - "버그가 있다"는 힌트를 주지 않음

3. LLM 주장 검산 (독립 검증)
   LLM의 각 주장에 대해:

   a) "버그가 있다" 주장 → unit test로 재현 가능한가?
      - 재현 성공: 진양성(TP)
      - 재현 실패 (버그가 아님): 오탐(FP)

   b) "버그가 없다" 주장 → 실제로 버그가 없는가?
      - 알려진 버그가 있는 함수(BugsInPy 등)를 일부 포함하여 검증
      - 진음성(TN) vs 미탐(FN) 분류

   c) "수정이 필요하다" 주장 → 어디를 수정해야 하는가?
      - 수정 위치의 정확성을 unit test 기반으로 평가

4. 측정 지표

   | 지표 | 정의 |
   |------|------|
   | 정밀도 | LLM이 "버그"라고 주장한 것 중 실제 버그 비율 (TP / (TP+FP)) |
   | 수량 정확성 | LLM이 보고한 버그 수 vs 검산된 실제 버그 수 |
   | 위치 정확성 | "여기를 수정하라"가 실제로 올바른 수정 위치인 비율 |
   | 미탐율 | 알려진 버그를 놓친 비율 (FN / (TP+FN)) — BugsInPy 표본으로 측정 |

5. 상관 분석
   - X축: 함수의 개념 수
   - Y축: 정밀도, 수량 정확성, 위치 정확성
   - 모델별 회귀 또는 상관계수

승격 조건: 개념 수와 분석 정확도 사이에 유의미한 음의 상관 (p < 0.05)
폐기 조건: 상관이 없거나, 코드 줄 수(길이)와의 상관이 더 강하면
          "개념 수"가 아니라 "길이"가 원인 → C1 근거 약화
```

### 검산 방법: unit test 기반 독립 검증

| LLM 주장 | 검산 방법 | 판정 |
|----------|----------|------|
| "X 줄에 off-by-one 버그" | 해당 조건의 경계값 unit test 작성 → 실패하면 진양성 | TP 또는 FP |
| "race condition 가능" | 동시성 시나리오 unit test → 재현되면 진양성 | TP 또는 FP |
| "버그 없음" | 알려진 버그 함수(대조군)에서 놓쳤으면 미탐 | TN 또는 FN |
| "N개 버그" | 각각을 개별 검산 후 검증된 수와 비교 | 수량 정확성 |

### 한계

| 한계 | 설명 |
|------|------|
| **검산자 능력** | unit test 작성자(사람 또는 LLM)의 능력에 따라 검산 품질이 달라짐 |
| **검산 비용** | 각 주장을 개별 unit test로 검증하는 것은 시간 집약적 |
| **재현 불가 버그** | 환경 의존적 버그(타이밍, OS 차이)는 unit test로 재현이 어려울 수 있음 |
| **미탐 측정의 불완전성** | "진짜 버그가 없는 함수"를 확정하기 어려움 — BugsInPy 대조군으로 부분 완화 |

### 인용
- Widyasari, R. et al. (2020). "BugsInPy: A Database of Existing Bugs in Python Programs to Enable Controlled Testing and Debugging Studies." *ESEC/FSE 2020*, 1556–1560.
  — 대조군(알려진 버그 함수) 소스로 활용. 정답지 대조가 아닌 미탐율 측정 보조.

---

## 실험 우선순위

| 순서 | 실험 | 전제 조건 | 예상 기간 |
|------|------|----------|----------|
| **0** | **EXP-H07** (C1 임계값 재실험) | BugsInPy 클론 + 파싱 | **1-2주** |
| 1 | **EXP-01** (SKILL+MCP 일관성) | SKILL.md 1개 완성 | 2-3일 |
| 2 | **EXP-H04** (ΔQ/C 효율) | MCP log_refactoring 도구 | 3-5일 |
| 3 | **EXP-H05** (LLM 라우팅) | 라우팅 로직 프로토 | 1주 |
| 4 | **EXP-H02** (Hodge 분해) | PyDEC 연동 | 1-2주 |
| 5 | **EXP-H06** (Vector DB) | Qdrant 연동 | 1-2주 |
| 6 | **EXP-H03** (OWL decidability) | 온톨로지 변환 | 2-3주 |
| 7 | **EXP-H01** (HST 균형점) | 대규모 데이터셋 | 3-4주 |

---

## ⚠️ EXP-01: 🧀 Cheese 개념 축소 — Whisper/MIT (보류)

> **상태: ⚠️ 보류 — 천장 효과로 변별 불가**
> **실험일: 2026-03-16**
> **상세: `.sisyphus/experiments/EXP-01/`**

### 실험 설계

| 항목 | 값 |
|------|---|
| 대상 코드 | OpenAI Whisper `transcribe()` (477줄, MIT, 커밋 c0d2f62) |
| 독립변인 | A(원본 단일함수) vs B(리팩토링 다수 함수) |
| 모델 | ultrabrain, quick, deep |
| 채점 기준 | /25 (4모델 검증 + Oracle 최종 승인, design.md 참조) |
| 채점 기준 검증 | ultrabrain, quick, deep, Oracle(Opus 4)로 교차 검증 |

### 결과

| 모델 | A 총점 | B 총점 | B-A |
|------|--------|--------|-----|
| ultrabrain | 25 | 25 | 0 |
| quick | 21 | 24 | +3 |
| deep | 25 | 25 | 0 |

### 판정

- 승격 조건 미충족 (1/3 모델만 B>A)
- 폐기 조건 기술적 충족 (2/3 모델 동점 = A≥B)
- **원인**: 천장 효과 — 강한 모델이 25/25 만점으로 변별 불가
- **Oracle이 예측한 "사전지식 오염" 가능성**: Whisper는 유명 코드
- **실질 판정**: 보류. 채점 기준 변별력 부족이 원인이지 가설 부정이 아님

### 정성적 관찰 (점수에 안 잡히는 차이)

- M1-B만 발견: `decode_options` in-place mutation (미묘하고 실용적인 리스크)
- M2-B: Q1에서 부가 기능 3개 명시, Q4에서 콜백 패턴 대안 제시
- M3-A: **"단일 함수 과복잡도"를 스스로 최대 위험으로 지적** (프로젝트 가설과 일치)

### 교훈

- Q&A 분석만으로는 강한 모델의 차이를 측정할 수 없음
- 유명한 코드는 사전지식이 개입하여 코드 구조 효과를 흐림
- **→ EXP-02에서 실제 수정 과제 + 덜 유명한 코드로 개선**

---

## ✅ EXP-02: 🧀 Cheese 실제 수정 — openpilot/MIT

> **상태: ✅ 3모델 재현 확인**
> **실험일: 2026-03-16 (quick), 2026-03-17 (ultrabrain, deep 추가)**
> **상세: `.sisyphus/experiments/EXP-02/`**

### 실험 설계

| 항목 | 값 |
|------|---|
| 대상 코드 | commaai/openpilot `update_events()` (261줄, MIT, 커밋 a68ea44) |
| 독립변인 | A(원본 261줄 단일 메서드) vs B(리팩토링 11개 메서드) |
| 과제 | TPMS 이벤트 체크 추가 (CS.tirePressureLow → EventName.tirePressureWarning) |
| 측정 | 자동 지표: 추가 위치, 기존 코드 변경량, 함수 길이 변화, 배치 판단 방식 |
| 모델 | quick, ultrabrain, deep (3 카테고리) |
| EXP-01 대비 개선 | Q&A→실제 수정, 유명→덜 유명, 주관 채점→자동 측정 |

### 결과 (3모델)

| 지표 | A (원본) | B (리팩토링) |
|------|---------|------------|
| **quick** | | |
| 추가 위치 | `if CS.canValid:` 블록 내부 | `_check_vehicle_specific()` 메서드 |
| 위치 결정 방식 | **근접 배치** (CAN 의존) | **의미적 배치** (함수명 가이드) |
| **ultrabrain** | | |
| 추가 위치 | `if CS.canValid:` 블록 내부 (pedalPressed 뒤) | `_check_vehicle_specific()` 내 steerSaturated 뒤 |
| 위치 결정 방식 | **근접 배치** (CAN 의존) | **의미적 배치** (함수명 가이드) |
| **deep** | | |
| 추가 위치 | `canTimeout/canValid` 체크 뒤 (CAN 블록 밖) | `_check_vehicle_specific()` 내 fcw 뒤 |
| 위치 결정 방식 | **근접 배치** (CAN 독립이지만 같은 구간) | **의미적 배치** (함수명 가이드) |
| **공통** | | |
| 기존 코드 변경 | 0줄 (3모델 동일) | 0줄 (3모델 동일) |
| 추가 줄 수 | 2줄 (3모델 동일) | 2줄 (3모델 동일) |
| 추가 후 최대 함수 길이 | 263줄 (더 커짐) | ~40줄 (변화 없음) |

### 핵심 발견: 근접 배치 vs 의미적 배치 — **3모델 재현**

| 패턴 | quick | ultrabrain | deep | 합의 |
|------|-------|-----------|------|------|
| A: 근접 배치 | ✅ | ✅ | ✅ | **3/3** |
| B: 의미적 배치 (`_check_vehicle_specific`) | ✅ | ✅ | ✅ | **3/3** |

- **A (근접 배치)**: 3모델 모두 전체 스캔 후 "비슷한 안전 관련 코드 근처"에 삽입.
  quick/ultrabrain은 `if CS.canValid:` 안에 배치 (CAN 의존적), deep은 CAN 블록 밖이지만 같은 구간.
- **B (의미적 배치)**: 3모델 모두 `_check_vehicle_specific` 함수명이 즉시 배치를 가이드.
  steerSaturated/fcw 등 차량 안전 체크와 함께 배치.

> 개념 수가 줄고 함수명이 의미를 가지면, LLM은 구조로부터 "어디에 넣을지"를 읽는다.
> 단일 거대 함수에서는 "가까운 비슷한 코드 근처"에 넣는다.
> **이 패턴은 모델 추론 능력과 무관하게 3개 모델 카테고리에서 재현된다.**

### 한계

- 과제 1개만 실행 — Task 2(버그 탐지), Task 3(테스트 작성) 미실행
- A의 `CS.canValid` 내 배치가 기술적으로 올바를 수도 있음 (TPMS는 실제로 CAN 의존)
- ~~quick 모델 1개만 실행~~ → **해소: 3모델 재현 확인 (2026-03-17)**

---

## 🧀 Cheese 실험 통합 해석 (EXP-01 ~ EXP-02)

| 실험 | 코드 (MIT) | 과제 | 모델 | 핵심 결과 |
|------|-----------|------|------|----------|
| EXP-01 | Whisper `transcribe()` | Q&A 분석 | 3모델 | 천장 효과. quick만 B>A(+3) |
| EXP-02 | openpilot `update_events()` | 실제 수정 | **3모델** | A: 근접 배치, B: 의미적 배치 — **3모델 재현** |

### 관찰된 패턴

1. **수정 시 구조가 배치 판단을 결정** — A는 근접 배치, B는 의미적 배치 (EXP-02, **3모델 재현**)
2. **이 패턴은 모델 추론 능력과 무관** — quick, ultrabrain, deep 모두 동일 패턴 (EXP-02)
3. **소형 모델에서 Q&A 차이가 가장 큼** — quick 모델만 B>A +3 (EXP-01)
4. **강한 모델은 Q&A에서 천장 효과** — 유명 코드 + Q&A 분석에서는 차이 안 남 (EXP-01)
5. **deep 모델이 원본 코드의 "과복잡도"를 독립적으로 지적** (EXP-01 정성 관찰)

### 미해결

- MIT 오픈소스에서 EXP-01의 천장 효과를 극복하는 실험 필요
- 🥓 Ham 축은 미검증
- ~~실제 수정 과제(EXP-02)를 다수 모델로 재현 필요~~ → **해소 (2026-03-17)**

---

## ❌ EXP-04: 🧀 C1 임계값 탐색 — 개념 수와 LLM 결함 탐지 정확도

> **상태: ❌ 무효 — 변인 통제 실패**
> **실험일: 2026-03-17**
> **무효 판정일: 2026-03-17 (동일 세션 내 사후 검증)**

### 무효 사유

EXPERIMENT_PROTOCOL.md 체크리스트 **4/7 미충족**으로 무효.

| 체크리스트 항목 | 충족 | 상세 |
|---------------|------|------|
| 독립변인이 정확히 1개만 변하는가? | ❌ | V7→V15에서 개념 수와 **스펙 복잡도(기능 명세)가 동시에 변함** |
| 나머지 변인이 모두 동일한가? | ❌ | V15는 쿠폰/세금/배송/로열티/알림/감사로그를 **추가** — 기능 자체가 다름 |
| 주석/힌트가 답을 알려주지 않는가? | ❌ | `# BUG: should be >= 10` 주석이 답을 직접 제공 |
| 인공 코드가 아니라 실제 오픈소스 코드인가? | ❌ | 인공 코드(주문 처리 시나리오) 사용 |
| 제3자가 동일 조건에서 재현 가능한가? | ✅ | 코드 전문 기록됨 |
| 인용한 이론의 범위를 초과하여 주장하지 않는가? | ✅ | "관찰된 것"/"관찰되지 않은 것" 구분 |
| 이전 실험의 교란 변인이 반복되지 않는가? | ✅ | 첫 실험 |

### 변인 통제 실패 상세

**1. 개념 수 ≠ 독립변인 (스펙 복잡도와 교란)**

```
V7:  주문 처리 기본 (5줄 스펙)
V15: 주문 처리 + 쿠폰 + 세금 + 배송 + 로열티 + 알림 + 감사로그 (12줄 스펙)

→ V15가 더 어려운 이유가 "개념 수"인지 "기능이 더 많아서"인지 분리 불가
→ EXPERIMENT_PROTOCOL.md §5 "개념 수 실험 > 잘못된 설계"에 해당
```

**2. 주석 힌트 오염 (EXP-04a)**

```python
# BUG: should be >= 10  ← LLM이 주석을 읽고 "찾은 것"처럼 보임
```

주석 제거 후 재실험(EXP-04c)도 시도했으나, 문제 1(스펙 복잡도 교란)이
해소되지 않아 여전히 무효.

**3. 인공 코드 한계**

인공 코드는 실험자의 의도가 코드 구조에 반영되어, 자연 발생 복잡도와 다름.
Tier 2 승격 근거로 인정 불가 (EXPERIMENT_PROTOCOL.md §4).

### 실험 데이터 (참고용 — Tier 2 근거로 사용 금지)

원본 데이터는 기록 보존 목적으로만 남깁니다.

| 버전 | 개념 | 줄 수 | quick | ultrabrain | 비고 |
|------|------|------|-------|-----------|------|
| V7 | 7 | 17 | ✅ | ✅ | |
| V7+패딩 | 7 | 65 | ✅ | ✅ | 길이 통제용 |
| V15 | 15 | 45 | ❌ 오탐 | ✅ | **스펙 복잡도 교란** |
| V9 | 9 | — | ❌ 오탐 | — | n=1, 비결정성 |
| V12 | 12 | — | ❌ 오탐 | — | n=1, 비결정성 |

### 시사점 (가설 수준 — 검증 필요)

무효 실험이지만 방향성은 시사함:
- 개념 수 증가 시 경량 모델의 정확도 저하 **경향**이 관찰됨
- 코드 길이(V7+패딩)보다 개념 수(V15)가 더 영향하는 **경향**
- 그러나 스펙 복잡도 교란으로 인해 **인과 관계 미확립**

### 재설계 방향 → EXP-04v2 (RESEARCH.md H-07 참조)

올바른 설계:
1. **실제 오픈소스 코드** 사용 (BugsInPy 493개 실제 Python 버그)
2. 실제 버그 + fix 커밋 쌍에서 함수별 개념 수 측정
3. LLM 탐지 정확도 vs 개념 수 상관 분석
4. 독립변인: 자연 발생 개념 수 (실험자가 조작하지 않음)
5. 스펙 복잡도: 각 버그의 fix 커밋이 "정답 스펙" 역할

---

## ✅ EXP-03: 🍞 Bread SKILL → 보안 분석 품질 (fastapi-realworld/MIT)

> **상태: ✅ Tier 2 승격**
> **실험일: 2026-03-17**
> **대상: nsidnev/fastapi-realworld-example-app (3K⭐, MIT)**

### 실험 설계

| 항목 | 값 |
|------|---|
| 독립변인 | 🍞 Bread SKILL B1-B4 규칙 유무 |
| 종속변인 | 보안 분석의 구조화, 오탐률, 누락률, Trust Boundary 판정 |
| 모델 | quick(A+B), ultrabrain(B), deep(B) = 4회 |

### 결과

| 지표 | A (SKILL 없음) | B (3모델 합의) |
|------|---|---|
| 구조 | 16개 위험 번호 나열 | B1-B4별 체계적 평가 |
| B3 Trust Boundary | 16개 중 하나로 나열 | **CRITICAL로 최우선 승격** (3모델 합의) |
| B4 오탐 | `.format()`을 SQL injection으로 오판 | **정확히 PASS** (파라미터화 확인, 3모델 합의) |
| B2 누락 | SECRET_KEY=secret만 발견 | **pyproject.toml + test_secret 추가 발견** |
| 개선안 우선순위 | 불명확 | B1-B4 프레임이 자동 결정 |

### 3모델 재현

| 판정 | quick | ultrabrain | deep |
|------|-------|-----------|------|
| B1 인증 | 충족 (부분) | 충족 (부분) | 충족 (부분) |
| B2 시크릿 | HIGH | HIGH | HIGH |
| B3 Trust Boundary | **CRITICAL** | **CRITICAL** | **CRITICAL** |
| B4 Injection | PASS | PASS | PASS |

**3모델 전원 동일 핵심 판정에 도달.**

### 승격 판정

> **→ "🍞 Bread SKILL(B1-B4)이 보안 분석의 구조화·정확도·누락 방지를 개선한다" Tier 2 승격.**
> - A: 위험 나열 + 오탐(B4) + 누락(pyproject.toml)
> - B: 체계적 평가 + 정확 판정(B4 PASS) + 추가 발견 + 우선순위 자동 결정
> - 3모델 재현 확인

---

## ✅ EXP-03 확장: 🍞 Bread SKILL B1-B4 배치 검증 (5개 추가 MIT 레포)

> **상태: ✅ 배치 확인 — B3 100% 발견, 프레임 일관성 확인**
> **실험일: 2026-03-17**

### 대상 레포 (커밋 해시 기록)

| 레포 | ⭐ | 도메인 | 커밋 | 날짜 |
|------|---|--------|------|------|
| frappe/frappe | 18K | Web Framework | `2b37d4770f97` | 2026-03-16 |
| MasoniteFramework/masonite | 2.3K | Web Framework | `28cf12194a43` | 2025-03-20 |
| miguelgrinberg/microdot | 1.8K | Micro Framework | `49f16bb9ed94` | 2026-03-10 |
| claffin/cloudproxy | 1.2K | Proxy Tool | `06f8a9d8f6f1` | 2025-09-09 |
| icloud-photos-downloader | 7.5K | CLI | `3a97872f9f44` | 2026-01-05 |

### 결과

| 레포 | B1 인증 | B2 시크릿 | B3 Trust Boundary | B4 Injection |
|------|---------|----------|-------------------|-------------|
| frappe | ✅ Low | ✅ Low | ⚠️ **MEDIUM** | ✅ Low |
| masonite | ✅ Low | ❌ **HIGH** (에러에 시크릿 평문 출력) | ❌ **HIGH** | ⚠️ MEDIUM |
| microdot | ✅ Low | ⚠️ MEDIUM | ❌ **HIGH** | ✅ Low |
| cloudproxy | ❌ **CRITICAL** (인증 없음) | ⚠️ HIGH | ❌ **HIGH** | ✅ Low |
| icloud_photos | ✅ Low | ✅ Low | ⚠️ MEDIUM | ⚠️ MEDIUM |

### 패턴 (EXP-03 포함 6개 레포 종합)

| 패턴 | 빈도 | 의미 |
|------|------|------|
| B3 Trust Boundary 미정의 | **6/6 (100%)** | 오픈소스 보편적 문제. SKILL의 최대 가치 영역 |
| B4 Injection 안전 | 4/6 (67%) | ORM/파라미터화 보편화 |
| B2 시크릿 노출 경로 | 4/6 (67%) | 하드코딩은 드물지만 노출 경로 존재 |
| B1 인증 부재 | 1/6 (17%) | 도구류에서만 발생 |

### 고유 발견 (SKILL이 식별한 Critical 이슈)

- **masonite**: `Sign.py:52-54` — 시크릿 키를 에러 메시지에 **평문 출력**
- **cloudproxy**: `main.py:468-480` — 인증 없는 엔드포인트가 **credentials 반환**

---

## 실험 레포 전체 커밋 해시 기록

| 실험 | 레포 | 커밋 | 날짜 |
|------|------|------|------|
| EXP-01 | openai/whisper | `c0d2f624c09d` | 2025-06-25 |
| EXP-02 | commaai/openpilot | `a68ea44af341` | 2026-03-14 |
| EXP-02 | Neoteroi/BlackSheep | `4c8a4998fac8` | 2026-03-14 |
| EXP-03 | nsidnev/fastapi-realworld | `029eb7781c60` | 2022-08-21 |
| EXP-03 | jasonacox/tinytuya | `6120875d1cee` | 2026-03-15 |
| EXP-03 확장 | frappe/frappe | `2b37d4770f97` | 2026-03-16 |
| EXP-03 확장 | MasoniteFramework/masonite | `28cf12194a43` | 2025-03-20 |
| EXP-03 확장 | miguelgrinberg/microdot | `49f16bb9ed94` | 2026-03-10 |
| EXP-03 확장 | claffin/cloudproxy | `06f8a9d8f6f1` | 2025-09-09 |
| EXP-03 확장 | icloud-photos-downloader | `3a97872f9f44` | 2026-01-05 |

---

## 🧀🍞 실험 통합 해석 (EXP-01 ~ EXP-04)

| 실험 | 축 | 코드 (MIT) | 레포 수 | 핵심 결과 |
|------|---|-----------|--------|----------|
| EXP-01 | 🧀 | Whisper | 1 | 천장효과 (보류) |
| EXP-02 | 🧀 | openpilot, BlackSheep | 2 | 의미적 배치, 상태 격리 (3모델 재현) |
| EXP-03 | 🍞 | fastapi-realworld | 1 | 오탐 감소, 누락 감소 (3모델 재현) |
| **EXP-03 확장** | **🍞** | **frappe, masonite, microdot, cloudproxy, icloud** | **5** | **B3 100% 발견, Critical 이슈 2건 식별** |
| EXP-04 | 🧀 | 인공 코드 | — | **❌ 무효** (변인 통제 실패 — 스펙 복잡도 교란, 주석 힌트, 인공 코드) |
| — | 🧀 | unit test (9 패턴) | — | **18/18 pass** (버그 재현 증명) |

### SKILL의 일관된 효과

| SKILL 없음 | SKILL 있음 |
|---|---|
| 위험/문제를 **나열** | **분류**하고 **우선순위**를 매김 |
| 오탐 포함 | 정확한 판정 (false positive 감소) |
| 일부 누락 | 체계적 커버리지 (false negative 감소) |
| 모델마다 다른 구조 | **3모델 동일 프레임** (일관성) |

---

## 폐기된 이론 (git history 참조)

| 이론 | 폐기 이유 | 폐기 시점 |
|------|----------|----------|
| 연속 Lyapunov 수렴 보장 | 이산 리팩토링에 부적합 | v0.1 분석 |
| Sperner's Lemma 균형점 | 코드와의 연결고리 미확립 | v0.1 분석 |
| Banach Fixed-Point 수렴 | 이산 리팩토링에 부적합 | v0.1 분석 |
| 3차 텐서 W ∈ ℝ⁴ˣ⁵ˣ⁵ | 과잉 엔지니어링 | v0.1 분석 |
| 규제 매핑 (FDA/HIPAA/NIS2) | 도구 범위 초과 | v0.1 분석 |
| 3-DB 저장소 아키텍처 | 과잉 엔지니어링 | v0.1 분석 |
| Hodge Decomposition (단순 덧셈 버전) | 위상학적 분해가 아님 | v0.1 분석 |

> 폐기된 이론의 전체 내용은 git history에 보존되어 있습니다.
> `git log --all -- docs/` 로 확인 가능합니다.

---

## META-01: 3축(🍞🧀🥓) 분해의 학술적 근거 조사

> **상태: 조사 완료 — 결론: 3축은 자의적 선택이며 학술적 선행 근거 없음**
> **조사일: 2026-03-18**
> **목적: 3축 분해에 대한 반론 근거 수집 및 대안 프레임워크 비교**

---

### 1. 누락된 차원: 3축으로 커버되지 않는 코드 품질 측면

| 누락 차원 | 설명 | 커버 여부 |
|----------|------|----------|
| **성능/효율** | 실행 시간, 메모리 사용, 처리량 | ❌ 미커버 |
| **접근성(Accessibility)** | 장애인 포함 사용자 접근성 | ❌ 미커버 (UI 레이어 문제이나 코드 수준에서도 존재) |
| **문서화** | 주석, docstring, API 문서 품질 | ❌ 미커버 |
| **API 설계** | 인터페이스 일관성, 명명 규칙, 버전 호환성 | ❌ 미커버 |
| **동시성 정확성** | race condition, deadlock, thread safety | ⚠️ 부분 커버 (🍞 trust boundary에 일부 포함 가능하나 명시 없음) |
| **데이터 무결성** | 트랜잭션 일관성, 불변식 보존 | ⚠️ 부분 커버 (🥓 behavioral preservation에 일부 포함) |
| **운영(Observability)** | 로깅, 모니터링, 추적 가능성 | ❌ 미커버 |
| **법적 준수** | 라이선스, GDPR, 규제 준수 | ❌ 미커버 |
| **유지보수성** | 결합도, 응집도, 모듈화 | ⚠️ 부분 커버 (🧀 cognitive complexity에 간접 포함) |
| **이식성/유연성** | 환경 독립성, 설정 가능성 | ❌ 미커버 |
| **신뢰성** | 장애 허용, 복구 가능성 | ❌ 미커버 |
| **안전성(Safety)** | 기능 안전, 치명적 오류 방지 | ❌ 미커버 |

**결론**: 3축은 코드 품질의 **일부 단면**만 커버한다. 특히 성능, 운영, 법적 준수, 동시성은 완전히 누락되어 있다.

---

### 2. 중복 가능성: 3축 중 합칠 수 있는가?

| 비교 쌍 | 중복 가능성 | 근거 |
|---------|-----------|------|
| 🍞 Security ↔ 🥓 Behavioral Preservation | **낮음** | 보안은 "외부 공격자로부터의 보호", 행동 보존은 "리팩토링 후 동일 동작 유지" — 목적이 다름 |
| 🧀 Cognitive Complexity ↔ 🍞 Security | **낮음** | 복잡한 코드가 보안 취약점을 유발하는 상관관계는 있으나 [미검증], 측정 대상이 다름 |
| 🧀 Cognitive Complexity ↔ 🥓 Behavioral Preservation | **중간** | 복잡한 코드는 리팩토링 시 행동 변경 위험이 높음 — 간접 연관. 그러나 측정 방법이 다름 |

**결론**: 3축 간 완전한 중복은 없으나, 🧀와 🥓 사이에 **간접 상관**이 존재할 수 있다. [미검증]

---

### 3. 기존 대안 프레임워크

#### 3-1. ISO/IEC 25010:2023 — 9개 특성

> **출처**: ISO/IEC 25010:2023, "Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — Product quality model", 2023-11-15.

ISO/IEC 25010:2023은 소프트웨어 제품 품질을 **9개 최상위 특성**으로 정의한다 (2011년 버전의 8개에서 Safety 추가):

| # | 특성 | 설명 |
|---|------|------|
| 1 | **Functional Suitability** | 기능 완전성, 정확성, 적절성 |
| 2 | **Performance Efficiency** | 시간 동작, 자원 활용, 용량 |
| 3 | **Compatibility** | 공존성, 상호운용성 |
| 4 | **Interaction Capability** | (구 Usability) 접근성, 자기기술성, 사용 용이성 |
| 5 | **Reliability** | 성숙도, 가용성, 장애 허용, 복구 가능성 |
| 6 | **Security** | 기밀성, 무결성, 부인 방지, 책임 추적성, 진위성, 저항성 |
| 7 | **Maintainability** | 모듈성, 재사용성, 분석 가능성, 수정 가능성, 테스트 가능성 |
| 8 | **Flexibility** | (구 Portability) 적응성, 설치 가능성, 대체 가능성, 확장성 |
| 9 | **Safety** | 운영 제약, 위험 식별, 안전 실패, 경고, 안전 구성 |

**3축과의 매핑**:
- 🍞 Security → ISO Security (6번) 의 일부만 커버
- 🧀 Cognitive Complexity → ISO Maintainability (7번) 의 일부 (분석 가능성)
- 🥓 Behavioral Preservation → ISO Reliability (5번) + Functional Suitability (1번) 의 일부

**결론**: ISO 25010은 3축보다 **3배 더 많은 차원**을 정의하며, 3축은 ISO 25010의 부분집합에 해당한다. 3축이 ISO 25010을 근거로 선택되었다는 증거는 없다.

---

#### 3-2. DORA 4 Key Metrics

> **출처**: Forsgren, N., Humble, J., & Kim, G. (2018). *Accelerate: The Science of Lean Software and DevOps*. IT Revolution Press. / DORA State of DevOps Report 2024 (Google Cloud, 39,000+ 응답자).

DORA는 소프트웨어 **전달 성능**을 4개 지표로 측정한다:

| 지표 | 측정 대상 | 분류 |
|------|----------|------|
| **Deployment Frequency** | 배포 빈도 | 처리량(Throughput) |
| **Lead Time for Changes** | 코드 커밋→배포 소요 시간 | 처리량(Throughput) |
| **Change Failure Rate** | 배포 후 장애 발생률 | 안정성(Stability) |
| **Failed Deployment Recovery Time** | 장애 복구 시간 | 안정성(Stability) |

**3축과의 관계**: DORA는 **프로세스/운영 지표**이며, 코드 품질 자체를 측정하지 않는다. 3축(코드 수준 품질)과 DORA(배포 프로세스 성능)는 **측정 레이어가 다르다**. 직접 비교 불가.

---

#### 3-3. SPACE Framework — 5개 차원

> **출처**: Forsgren, N., Storey, M.-A., Maddila, C., Zimmermann, T., Houck, B., & Butler, J. (2021). "The SPACE of Developer Productivity: There's more to it than you think." *ACM Queue*, 19(1), 20–48.

SPACE는 **개발자 생산성**을 5개 차원으로 측정한다:

| 차원 | 설명 |
|------|------|
| **S**atisfaction | 개발자 만족도, 웰빙 |
| **P**erformance | 결과물의 품질과 신뢰성 |
| **A**ctivity | 활동량 (커밋, PR, 코드 리뷰 수) |
| **C**ommunication | 팀 협업, 지식 공유 |
| **E**fficiency | 흐름 상태, 방해 요소 최소화 |

**3축과의 관계**: SPACE는 **개발자 경험/생산성** 프레임이며, 코드 품질 자체를 측정하지 않는다. 3축과 측정 대상이 다르다.

---

#### 3-4. CK Metrics Suite — 6개 OO 설계 지표

> **출처**: Chidamber, S. R., & Kemerer, C. F. (1994). "A Metrics Suite for Object Oriented Design." *IEEE Transactions on Software Engineering*, 20(6), 476–493.

CK 메트릭은 **객체지향 설계 복잡도**를 6개 지표로 측정한다:

| 지표 | 설명 |
|------|------|
| **WMC** | Weighted Methods per Class — 클래스 복잡도 |
| **DIT** | Depth of Inheritance Tree — 상속 깊이 |
| **NOC** | Number of Children — 자식 클래스 수 |
| **CBO** | Coupling Between Object classes — 결합도 |
| **RFC** | Response For a Class — 응답 집합 크기 |
| **LCOM** | Lack of Cohesion in Methods — 응집도 부족 |

CK 메트릭은 결함 발생률, 유지보수 노력, 재사용성과 상관관계가 있음이 실증되었다.

**3축과의 관계**: 🧀 Cognitive Complexity는 CK의 WMC(메서드 복잡도)와 개념적으로 유사하나, CK는 클래스 수준 설계 지표이고 Cognitive Complexity는 함수 수준 제어 흐름 지표다. 3축이 CK를 근거로 선택되었다는 증거는 없다.

---

### 4. "3축"을 뒷받침하는 실증 연구가 있는가?

**없다.**

현재까지 조사한 결과, "Security + Cognitive Complexity + Behavioral Preservation"의 조합이 코드 품질의 최적 분해임을 주장하는 학술 연구는 발견되지 않았다.

관련 개별 연구는 존재한다:

| 연구 | 내용 | 3축과의 관련성 |
|------|------|--------------|
| Campbell, G. A. (2018). "Cognitive Complexity: A new way of measuring understandability." SonarSource White Paper. | Cognitive Complexity 지표 제안 — McCabe 대비 유지보수성 예측력 개선 주장 | 🧀 축의 측정 도구 근거 |
| Lavazza, L. et al. (2022). "An empirical evaluation of the 'Cognitive Complexity' measure as a predictor of code understandability." *Journal of Systems and Software*, 197, 111561. | Cognitive Complexity가 코드 이해도의 예측 변수로서 전통 지표보다 **약간** 우수함 — 그러나 "명확하고 검증된 측정 기준이 아직 없다"고 결론 | 🧀 축의 측정 도구 근거 (부분적) |
| Lenarduzzi, V. et al. (2023). "Does Cyclomatic or Cognitive Complexity Better Represents Code Understandability?" arXiv:2303.07722. | 216명 주니어 개발자 대상 실험 — Cognitive Complexity가 Cyclomatic보다 **약간** 우수하나, 둘 다 코드 이해도의 좋은 예측 변수가 아님 | 🧀 축의 측정 도구에 대한 **반론** |
| AlOmar, E. A. et al. (2021). "On Preserving the Behavior in Software Refactoring: A Systematic Mapping Study." arXiv:2106.13900. | 행동 보존이 리팩토링의 핵심 개념임을 확인 — 다양한 접근법 분류 | 🥓 축의 개념적 근거 |
| Sun, X. et al. (2025). "Quality Assurance of LLM-generated Code: Addressing Non-Functional Quality Characteristics." arXiv:2511.10271. | ISO 25010 기반 109편 논문 리뷰 — 학계는 Security, Performance, Maintainability를 주요 코드 품질 속성으로 강조; 실무자는 Maintainability와 가독성을 최우선시 | 3축 선택의 **부분적 지지** (Security, Maintainability는 일치) |

**결론**: 3축의 조합 자체를 정당화하는 실증 연구는 없다. 각 축의 개별 측정 도구에 대한 연구는 존재하나, "이 3개가 최적 분해"라는 주장은 [미검증]이다.

---

### 5. 차원 수 선택의 트레이드오프

> 이 섹션의 내용은 소프트웨어 측정 이론의 일반 원칙에서 도출된 것이며, 3축에 특화된 실증 연구는 없다. [미검증]

| 차원 수 | 장점 | 단점 |
|---------|------|------|
| **적음 (1-3개)** | 측정 비용 낮음, 해석 용이, 도구 구현 단순 | 중요한 품질 속성 누락 위험, 과도한 단순화 |
| **많음 (9개+)** | 포괄적 커버리지, 표준화 가능 | 측정 비용 높음, 차원 간 상관관계 처리 복잡, 실무 적용 어려움 |
| **중간 (4-6개)** | 균형점 — 그러나 "몇 개가 최적인가"에 대한 실증 근거 없음 | 여전히 자의적 선택 |

**Fenton & Bieman (2014)의 관점**: 소프트웨어 메트릭은 측정하려는 속성과 측정 도구 사이의 **표현 조건(representation condition)**을 충족해야 한다. 차원 수 자체보다 각 차원이 독립적이고 측정 가능한지가 더 중요하다.

> **출처**: Fenton, N., & Bieman, J. (2014). *Software Metrics: A Rigorous and Practical Approach* (3rd ed.). CRC Press.

**ISO 25010의 교훈**: 2011년 8개 → 2023년 9개로 Safety가 추가되었다. 이는 "차원 수는 고정이 아니며, 도메인 요구에 따라 진화한다"는 것을 보여준다.

---

### 6. 종합 판단

| 질문 | 판단 |
|------|------|
| 3축은 학술적으로 정당화된 선택인가? | **아니다** — 선행 연구에서 이 조합을 최적으로 제안한 사례 없음 |
| 3축은 자의적 선택인가? | **그렇다** — 프로젝트 목적(LLM 기반 코드 분석)에 맞게 실용적으로 선택된 것으로 보임 |
| 3축이 틀렸는가? | **판단 불가** — 자의적이라는 것이 틀렸다는 의미는 아님. 실용적 목적에 부합할 수 있음 |
| 더 나은 대안이 있는가? | ISO 25010(9개)이 더 포괄적이나, 모든 차원을 LLM으로 측정하는 것이 실용적인지는 [미검증] |
| 3축을 유지해야 하는가? | 현재 실험(EXP-02, EXP-03)은 🍞🧀 축의 유용성을 부분 확인. 🥓 축은 미검증. 3축의 **조합**이 최적인지는 미검증 |

**권고**: RESEARCH.md에 "3축은 실용적 선택이며 학술적 최적성은 미검증"임을 명시하고, 향후 실험에서 누락 차원(특히 성능, 동시성)의 포함 여부를 검토할 것.

---

### 참고문헌 (이 섹션)

1. ISO/IEC 25010:2023. *Systems and software engineering — Systems and software Quality Requirements and Evaluation (SQuaRE) — Product quality model*. ISO, 2023-11-15.
2. Chidamber, S. R., & Kemerer, C. F. (1994). "A Metrics Suite for Object Oriented Design." *IEEE Transactions on Software Engineering*, 20(6), 476–493.
3. Forsgren, N., Humble, J., & Kim, G. (2018). *Accelerate: The Science of Lean Software and DevOps*. IT Revolution Press.
4. Forsgren, N., Storey, M.-A., Maddila, C., Zimmermann, T., Houck, B., & Butler, J. (2021). "The SPACE of Developer Productivity: There's more to it than you think." *ACM Queue*, 19(1), 20–48.
5. Campbell, G. A. (2018). *Cognitive Complexity: A new way of measuring understandability*. SonarSource White Paper. https://www.sonarsource.com/resources/cognitive-complexity/
6. Lavazza, L., Abualkishik, A. Z., Liu, G., & Morasca, S. (2022). "An empirical evaluation of the 'Cognitive Complexity' measure as a predictor of code understandability." *Journal of Systems and Software*, 197, 111561. DOI: 10.1016/j.jss.2022.111561
7. Lenarduzzi, V., Kilamo, T., & Janes, A. (2023). "Does Cyclomatic or Cognitive Complexity Better Represents Code Understandability? An Empirical Investigation on the Developers Perception." arXiv:2303.07722.
8. AlOmar, E. A., Mkaouer, M. W., Newman, C., & Ouni, A. (2021). "On Preserving the Behavior in Software Refactoring: A Systematic Mapping Study." arXiv:2106.13900.
9. Sun, X., Ståhl, D., Sandahl, K., & Kessler, C. (2025). "Quality Assurance of LLM-generated Code: Addressing Non-Functional Quality Characteristics." arXiv:2511.10271.
10. Fenton, N., & Bieman, J. (2014). *Software Metrics: A Rigorous and Practical Approach* (3rd ed.). CRC Press.
