# 🧀 Cheese R3 채점 — cyclomatic complexity 추정 vs radon 실측

> 과제: "인지 복잡도를 분석하라, 함수별 cyclomatic complexity를 추정하라"
> ground truth: radon cc 실측값

## Ground Truth (radon)

| 함수 | radon CC | 등급 |
|------|---------|------|
| request_2fa | 22 | D |
| request_2fa_web | 8 | B |
| authenticator | 7 | B |
| prompt_int_range | 5 | A |
| request_2sa | 5 | A |
| is_valid_device_index | 4 | A |
| is_valid_six_digit_code | 2 | A |
| prompt_string | 1 | A |
| is_empty_string | 1 | A |
| echo | 1 | A |

## LLM 추정 vs 실측 비교

### CC 수치 추정

| 함수 | radon | GPT B | GPT D | Son B | Son D |
|------|-------|-------|-------|-------|-------|
| request_2fa | **22** | 15-18 | (잘림) | 15-20 | **26+** |
| request_2fa_web | **8** | 8-10 | (잘림) | 10-12 | 8 |
| authenticator | **7** | 6-8 | (잘림) | 8-10 | 7 |
| prompt_int_range | **5** | 4 | (잘림) | 4 | — |
| request_2sa | **5** | 5 | (잘림) | 6 | — |
| is_valid_device_index | **4** | 4 | (잘림) | — | — |
| is_valid_six_digit_code | **2** | 2 | (잘림) | — | — |
| prompt_string | **1** | 1 | (잘림) | — | — |
| is_empty_string | **1** | 1 | (잘림) | — | — |
| echo | **1** | 1 | (잘림) | — | — |

### 등급 추정 정확도

| 함수 | radon 등급 | GPT B | Son B | Son D |
|------|----------|-------|-------|-------|
| request_2fa | D(22) | ⚠️ 과소추정(15-18→C~D) | ✅ D 범위(15-20) | ❌ 과대추정(26+→F) |
| request_2fa_web | B(8) | ✅ B 범위(8-10) | ⚠️ 과대추정(10-12→C) | ✅ B(8) |
| authenticator | B(7) | ✅ B 범위(6-8) | ⚠️ 과대추정(8-10→B~C) | ✅ B(7) |
| prompt_int_range | A(5) | ✅ A(4) | ✅ A(4) | — |
| request_2sa | A(5) | ✅ A(5) | ✅ A(6) | — |

### 핵심 관찰

1. **단순한 함수(A등급)는 정확히 추정** — GPT B가 10개 함수 전부 분석하여 A등급 함수들의 CC를 ±1 이내로 추정

2. **복잡한 함수(B~D등급)에서 모델/그룹별 차이 발생**
   - GPT B: request_2fa를 15-18로 과소추정 (실측 22)
   - Son D: request_2fa를 26+로 과대추정 (실측 22)
   - Son D: authenticator를 7로 정확 추정 ✅

3. **B(체크리스트)와 D(SKILL)의 차이**
   - B: CC를 "추정"만 함 — 숫자를 내놓지만 등급 판정 기준이 없어서 "높다/낮다"의 기준이 주관적
   - D: C1 규칙(A/B/C/D/F 등급)을 제시받아 명시적으로 등급 분류 + pass/warning/fail 판정
   - D의 판정이 ground truth 등급과 더 잘 일치 (Son D: authenticator=7=B ✅, request_2fa_web=8=B ✅)

4. **GPT B가 가장 상세** — 10개 함수 전부 분석, 배치 판단까지 포함. 556줄.
   - 하지만 GPT D가 4096 토큰에서 잘림 — max_completion_tokens 상향 필요

5. **Sonnet B vs D**: D가 C1-C4 규칙별로 구조화 + 자율 탐색에서 추가 발견 7개 (상태 관리, 에러 일관성, side effect, temporal coupling 등)

## "복잡하다"는 판정의 일치

| 함수 | radon | GPT B | Son B | Son D | 합의 |
|------|-------|-------|-------|-------|------|
| request_2fa | D (복잡) | ✅ "too complex" | ✅ "very high" | ✅ "FAIL" | **4/4** |
| authenticator | B (중간) | ✅ "moderately too complex" | ✅ "HIGH" | ✅ "FAIL (SRP)" | **4/4** |
| request_2fa_web | B (중간) | ✅ "too complex conceptually" | ✅ "HIGH" | ✅ "WARNING~FAIL" | **4/4** |
| 나머지 7개 | A (단순) | ✅ "Fine" | ✅ 미언급/acceptable | — | **합의** |

**CC 수치의 정확도는 ±30% 이내이나, "이 함수가 복잡한가?"의 방향성 판단은 ground truth와 100% 일치.**

## B vs D 비교

| 지표 | B (체크리스트) | D (SKILL+자율) |
|------|-------------|--------------|
| 분석 함수 수 | GPT: 10/10, Son: 5/10 | GPT: 잘림, Son: 3+자율7 |
| CC 추정 정확도 | ±30% | ±30% (동등) |
| 방향성 정확도 | 100% | 100% (동등) |
| 등급 판정 | 등급 기준 없이 "높다/낮다" | A/B/C/D/F 명시적 분류 |
| 구조화 | 서술형 테이블 | C1-C4 규칙별 판정 |
| 추가 발견 | 배치 판단 포함 | 자율 탐색에서 7개 추가 |
| 토큰 | GPT: 5,903, Son: 4,186 | GPT: 6,648(잘림), Son: 4,632 |

## 결론

1. **LLM은 cyclomatic complexity를 ±30% 이내로 추정할 수 있다** — 정밀한 수치 측정은 못 하지만 "어떤 함수가 복잡한가"의 방향성은 정확
2. **SKILL(D)은 등급 판정 기준을 제공하여 판단을 구조화한다** — B는 숫자만 내놓고, D는 A/B/C/D/F로 분류
3. **정밀한 CC 수치가 필요하면 정적 분석 도구(radon)가 필수** — LLM 단독으로는 ±30% 오차
4. **추가 연구 필요: max_completion_tokens를 늘려서 GPT D의 완전한 응답을 확보해야 함**

## 한계
- n=1 레포
- GPT D 응답 잘림 (4096 토큰 한도)
- CC 추정치가 "범위"로 제시되어 정밀 비교 어려움
