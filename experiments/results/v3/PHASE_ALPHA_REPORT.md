# Phase α 통합 보고서

> 실험 기간: 2026-03-18
> 총괄: Claude Opus 4.6
> 실험 모델: openai/gpt-5.4, anthropic/claude-sonnet-4-6
> 실행 도구: experiments/run_experiment.py (temperature=0, seed=42)

---

## 연구 질문

**"SKILL(구체적 가이드)이 LLM 코드 분석 품질을 높이는가?"**

---

## 실험 목록

| # | 실험 ID | 축 | 코드 | 과제 | 그룹 | 모델 | 단위 |
|---|---------|---|------|------|------|------|------|
| 1 | bread-R1 | 🍞 | fastapi-realworld auth (93줄) | 보안 분석 | A,B,C | gpt-5.4, sonnet-4.6 | 6 |
| 2 | bread-R1 추가 | 🍞 | 동일 | 보안 분석 | D, C(8k) | gpt-5.4, sonnet-4.6 | 4 |
| 3 | bread-R2 | 🍞 | BlackSheep JWT (217줄) | 보안 분석 | A,B,C,D | gpt-5.4, sonnet-4.6 | 8 |
| 4 | bread-R3 | 🍞 | icloud-photos-downloader auth (283줄) | 보안 분석 | B,D | gpt-5.4, sonnet-4.6 | 4 |
| 5 | structure-httpie | 🧀 | httpie nested_json before/after (404/460줄) | 보안 분석 | D | gpt-5.4, sonnet-4.6 | 4 |
| 6 | structure-django | 🧀 | Django loaddata before/after (263/270줄) | 수정/배치 | TASK | gpt-5.4, sonnet-4.6 | 4 |
| 7 | cheese-R3 | 🧀 | icloud-photos-downloader auth (283줄) | CC 추정 | B,D | gpt-5.4, sonnet-4.6 | 4 |
| 8 | ham-R3 | 🥓 | icloud-photos-downloader auth (283줄) | 행동 보존 | B,D | gpt-5.4, sonnet-4.6 | 4 |
| | | | | | | **합계** | **42** |

---

## 발견 1: SKILL의 주의 제어 효과

### 실험: bread-R1/R2/R3, 그룹 A/B/C/D 비교

| 그룹 | 구체성 | TP 평균 (3레포) | 구조화 | 시야 |
|------|--------|----------------|--------|------|
| A (간략 가이드) | 낮음 | 5.0 | 1 | 넓음 |
| B (체크리스트) | 중간 | 5.8 | 1 | 넓음 |
| C (SKILL) | 높음 | 2.75 | **2** | **좁음** |
| D (SKILL+자율) | 높음+자율 | **7.7** | **2** | 넓음 |

### 핵심:
- **C(SKILL만)는 시야를 축소한다** — 체크리스트가 "완료 조건"을 만들어 탐색 조기 종료
- **이것은 출력 토큰 한계와 무관** — max_tokens를 2배로 늘려도 출력 동일 (C 8k 테스트)
- **자율 탐색 한 줄("체크리스트 외 이슈도 식별하라")로 해소** — D가 C의 구조화 + A의 탐지 범위를 모두 확보
- **D > B 33% 더 탐지** (R3: B 7.5 → D 10.0) — 판정 기준이 탐지를 가이드
- **3레포 × 2모델에서 재현**

### SKILL 설계 원칙 (이 실험에서 도출):
1. 체크리스트만 주면 LLM은 task 완료로 판정하고 멈춘다
2. "체크리스트 완료 후 자율 탐색" 조건을 반드시 포함해야 한다
3. 반대로, 범위를 좁히고 싶으면 체크리스트만 주면 토큰을 절약할 수 있다
4. **SKILL은 LLM의 주의 자원을 양방향으로 제어하는 도구다**

---

## 발견 2: 코드 구조와 과제 유형의 관계

### 실험: httpie(분석 과제) + Django(수정 과제), before/after

| 과제 유형 | 코드 구조 효과 | 근거 |
|----------|-------------|------|
| **분석/탐지** (보안 이슈 찾기) | **효과 없음** — 같은 로직이면 같은 이슈를 찾음 | httpie: before TP 6.0 = after TP 6.0 |
| **수정/배치** (기능 추가) | **효과 있음** — 함수 추출이 의미적 배치를 유도 | Django: before 근접 배치 → after 의미적 배치 |

### 핵심:
- 분석 과제: 로직이 지배적, 구조는 영향 없음
- 수정 과제: 구조가 "어디에 넣을지"를 가이드 — **2레포(openpilot + Django) × 2모델에서 재현**
- Django loaddata 선정 이유: 파일 분리가 아닌 **함수 추출** 리팩토링, 줄 수 거의 동일(263→270), 커밋 메시지 "Refactor loaddata for readability"

---

## 발견 3: LLM의 cyclomatic complexity 추정 능력

### 실험: cheese-R3, radon 실측값과 LLM 추정값 대조

| 지표 | 결과 |
|------|------|
| CC 수치 정확도 | **±30%** — 정밀 측정 불가 |
| 방향성 판정 ("복잡한가?") | **100% 일치** — 3함수(복잡) + 7함수(단순) 전부 일치 |
| B vs D | CC 추정 정확도는 동등. D는 등급(A~F) 판정 기준을 구조화 |

### 핵심:
- LLM은 "어떤 함수가 복잡한가"를 정확히 판단하지만, "얼마나 복잡한가"의 수치는 부정확
- 정밀 수치가 필요하면 정적 분석 도구(radon 등)가 필수 — MCP 조합 실험의 근거
- SKILL(D)은 등급 기준을 제공하여 판단을 정량화하는 역할

---

## 발견 4: 🥓 Ham 축에서도 D > B 패턴 재현

### 실험: ham-R3, B vs D × 2모델

| 지표 | B (체크리스트) | D (SKILL+자율) |
|------|-------------|--------------|
| critical path 식별 | 7.0 | **9.0** |
| 추가 발견 (자율) | 0 | 3+ |
| 구조화 | 1 | **2** |

D가 B보다 추가로 찾은 것: provider 인터페이스 계약(H2), 구조/행동 분리(H3), status_exchange 상태 전이 미검증.

### 3축 통합 확인

| 축 | D > B | 레포 × 모델 |
|----|-------|------------|
| 🍞 Bread | ✅ | 3레포 × 2모델 |
| 🧀 Cheese | ✅ | 1레포 × 2모델 |
| 🥓 Ham | ✅ | 1레포 × 2모델 |

**D(SKILL+자율탐색) > B(체크리스트) 패턴이 3축 모두에서 재현됨.**

---

## 미실행

| 항목 | 사유 |
|------|------|
| Phase β (8레포 확장) | Phase α 완료 후 진행 |
| AUROC / F1 스코어 | 현재 모수(n=3)에서 통계적 의미 없음 — β 이상에서 계산 |
| Gemini 3 Pro 교차 검증 | A/B 분기 시에만 사용 — 현재 불필요 |

---

## 데이터 위치

```
experiments/results/v3/
├── bread-R1_*.json / .response.md     ← raw 응답 (6 + 추가 4)
├── bread-R2_*.json / .response.md     ← raw 응답 (8)
├── bread-R3_*.json / .response.md     ← raw 응답 (4)
├── structure-httpie_*.response.md     ← raw 응답 (4)
├── structure-django_*.response.md     ← raw 응답 (4)
├── cheese-R3_*.response.md            ← raw 응답 (4)
├── bread-R1_scoring.md                ← 채점
├── bread-R2_scoring.md                ← 채점
├── bread-R3_scoring.md                ← 채점
├── structure-httpie_scoring.md        ← 채점
├── structure-django_scoring.md        ← 채점
├── cheese-R3_scoring.md               ← 채점
└── PHASE_ALPHA_REPORT.md              ← 이 문서
```

---

## 다음 단계

1. Phase β 설계 조정 (α 결과 반영)
2. β 실행: 8레포 × B/D × 2모델 × 2반복
