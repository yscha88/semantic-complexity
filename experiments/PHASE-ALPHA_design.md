# Phase α — 실험 설계서 (v3)

> 이전 v1(2026-03-17 #1), v2(2026-03-17 #2)는 모델 변인 미통제로 **무효**.
> 이 문서는 EXPERIMENT_PROTOCOL.md 체크리스트를 완전히 충족하는 재설계이다.

---

## 1. 가설

**H**: 동일한 보안 분석 지시에서, SKILL 체크리스트(B1-B4)가 포함되면
LLM의 보안 분석 품질(정밀도, 구체성, 구조화)이 향상된다.

반증 형태: SKILL 유무에 따른 분석 품질 차이가 통계적으로 유의하지 않으면 H를 기각한다.

---

## 2. 변인 설계

### 독립변인 (정확히 1개)

| 독립변인 | 값 |
|---------|---|
| **가이드 구체성 수준** | A: 간략 가이드 / B: 체크리스트 / C: SKILL (상세 가이드) |

### 종속변인 (측정 대상)

| 종속변인 | 측정 방법 | 판정 기준 |
|---------|----------|----------|
| 이슈 탐지 수 | LLM 응답에서 식별된 이슈 수를 수동 카운트 | — |
| 진양성(TP) | 수동 검증: LLM이 지적한 것이 실제 보안 이슈인가 | 해당 코드에서 재현 가능하거나 알려진 패턴인가 |
| 오탐(FP) | 수동 검증: 지적했으나 실제로는 문제가 아닌 것 | — |
| 정밀도 | TP / (TP + FP) | — |
| 구체성 점수 | 0: 일반적 서술 / 1: 함수명 지정 / 2: 줄번호+코드 인용 | 사전 정의, 실험 후 변경 금지 |
| 구조화 점수 | 0: 서술형 나열 / 1: 카테고리별 분류 / 2: 규칙별 판정+근거 | 사전 정의, 실험 후 변경 금지 |

### 통제변인 (동일하게 유지하는 것)

| 통제변인 | 통제 방법 | 검증 방법 |
|---------|----------|----------|
| **프롬프트 지시문** | 양 그룹 모두 동일한 1-2문장 지시로 시작: "Analyze the security of the following code. Identify any vulnerabilities, authentication issues, or secret management problems. Rate each finding by severity." | 프롬프트 전문을 실험 기록에 첨부하여 diff 가능하게 |
| **코드** | 동일 코드 스니펫, 동일 포맷 | 코드 해시(SHA-256) 기록 |
| **모델 ID** | 실험 단위마다 정확한 모델 ID를 고정 | 응답 메타데이터에서 모델 ID 추출 기록 |
| **temperature** | 0 (결정론적) 또는 시스템 기본값 — **반드시 기록** | 설정값 기록. 기본값인 경우 "시스템 기본값(미지정)"으로 명시 |
| **max_tokens** | 시스템 기본값 — **반드시 기록** | 동일 |
| **system prompt** | 없음 (bare prompt). oh-my-opencode의 Sisyphus-Junior system prompt **사용 금지** | 프롬프트 전문에 system prompt 포함 여부 명시 |
| **context window** | 모델별 기본 context size — **기록** | 모델 스펙에서 확인하여 기록 |
| **프롬프트 길이** | A와 C의 지시문 부분 길이 차이를 기록. 길이 차이가 유의미한 교란 변인인지 사후 분석 | 토큰 수 기록 |
| **코드 언어** | Python (Phase α 고정) | — |
| **실험 시점** | 동일 세션에서 A/C를 연속 실행 | 타임스탬프 기록 |

### 교란 변인 점검

| 교란 변인 | 위험 | 통제 방법 |
|----------|------|----------|
| **프롬프트 길이 차이** | C가 체크리스트만큼 길어서 "더 많은 정보" 효과 | A/C 길이 차이를 기록하고 사후 분석. 유의미하면 B그룹(동일 길이 일반 지시) 추가 |
| **체크리스트 항목의 직접 힌트 효과** | B2에 "AUTH_FLOW 명시"가 있으면 당연히 AUTH_FLOW를 언급 | "체크리스트에만 있는 이슈"와 "양쪽 모두 찾는 이슈"를 구분 집계. 체크리스트 전용 이슈는 SKILL 효과가 아닌 "지시 효과"로 분류 |
| **모델의 사전 학습 편향** | 특정 모델이 특정 레포를 학습했을 가능성 | 2개 이상 벤더 사용으로 완화. 완전 배제는 불가 — 한계로 기록 |
| **코드 난이도** | 쉬운 코드에서는 A도 잘 찾음, 어려운 코드에서만 차이 | 2개 이상 레포(난이도 상이)로 완화 |
| **system prompt 오염** | task() 사용 시 oh-my-opencode가 기본 system prompt를 주입 | task() 사용 금지. 직접 API 호출 또는 bare prompt만 사용 |
| **비결정성 (temperature > 0)** | 같은 입력에 다른 출력 | Phase α에서는 반복 1회(수용). β에서 3회 반복으로 통제 |

---

## 3. 입력 코드 (Input Code)

### R1

| 항목 | 값 |
|------|---|
| 레포 | `nsidnev/fastapi-realworld-example-app` |
| URL | https://github.com/nsidnev/fastapi-realworld-example-app |
| 커밋 해시 | `029eb7781c60d5f563ee8990a0cbfb79b244538c` |
| 파일 | `app/api/routes/authentication.py` |
| 라인 범위 | **1~93** (전체 파일) |
| 줄 수 | 93 |
| 라이선스 | MIT |
| 코드 SHA-256 | `f8712fe91435653c8cc35c66e0249277e8eb9db8cba33149a9af546d05938aad` |
| 재현 방법 | `git clone --depth 1 https://github.com/nsidnev/fastapi-realworld-example-app.git && git checkout 029eb778 && cat app/api/routes/authentication.py` |

### R2

| 항목 | 값 |
|------|---|
| 레포 | `Neoteroi/BlackSheep` |
| URL | https://github.com/Neoteroi/BlackSheep |
| 커밋 해시 | `4c8a4998fac810b9ae6aff72f577a906da92436d` |
| 파일 | `blacksheep/server/authentication/jwt.py` |
| 라인 범위 | **1~217** (전체 파일) |
| 줄 수 | 217 |
| 라이선스 | MIT |
| 코드 SHA-256 | `4694892bd4b22c6dc03253d522374cff392f63b93eb393ed0ec78870261c48fa` |
| 재현 방법 | `git clone --depth 1 https://github.com/Neoteroi/BlackSheep.git && git checkout 4c8a4998 && cat blacksheep/server/authentication/jwt.py` |

---

## 4. 모델

### 역할 분리

| 역할 | 모델 ID | 벤더 | context window | 비고 |
|------|---------|------|---------------|------|
| **총괄** | `anthropic/claude-opus-4-6` | Anthropic | 200K | 실험 설계/분석/판정. 실험 대상이 아님 |
| **실험 모델 1** | `openai/gpt-5.4` | OpenAI | 1M | 실험 대상 |
| **실험 모델 2** | `anthropic/claude-sonnet-4-6` | Anthropic | 200K | 실험 대상 |
| **교차 검증** | `google/gemini-3-pro` | Google | 1M | A/B 결과 분기 시에만 사용 |

### 실행 방법

`experiments/run_experiment.py` 스크립트로 API 직접 호출.
- oh-my-opencode `task()` 사용 금지 — system prompt 오염, 모델 간접 배정 방지
- `.env`에 API 키 설정
- temperature=0, seed=42(OpenAI) 고정
- 응답에서 `model_id_actual`을 추출하여 실제 사용된 모델 기록

---

## 5. 입력 프롬프트 (Input Prompt)

각 실험 단위의 입력은 **프롬프트 지시문 + 코드**로 구성된다.
코드는 §3에서 정의한 입력 코드의 전체 내용을 `{code}` 자리에 삽입한다.
system prompt는 사용하지 않는다 (빈 문자열 또는 미지정).

### Group A 프롬프트 템플릿 (SKILL 없음)

```
Analyze the security of the following code.
Identify any vulnerabilities, authentication issues, or secret management problems.
Rate each finding by severity.

```python
{code — §3에서 정의한 레포의 해당 파일 L1~L{n} 전체}
```
```

- 입력 코드 참조: R1이면 `nsidnev/fastapi-realworld-example-app@029eb778:app/api/routes/authentication.py L1-93`
- 입력 코드 참조: R2이면 `Neoteroi/BlackSheep@4c8a4998:blacksheep/server/authentication/jwt.py L1-217`

### Group C 프롬프트 템플릿 (SKILL 있음)

```
Analyze the security of the following code.
Identify any vulnerabilities, authentication issues, or secret management problems.
Rate each finding by severity.

Use the following checklist:
- B1: Trust boundary — is input validation present at every entry point?
- B2: Auth flow — is authentication/authorization correctly implemented? Is AUTH_FLOW explicitly declared (including NONE)?
- B3: Secret management — are credentials hardcoded? Are secrets properly externalized?
- B4: Sensitive data exposure — is sensitive information logged or returned in responses?

For each rule (B1-B4), provide:
1. Finding (specific location)
2. Rating: ✅ pass / ⚠️ warning / ❌ fail
3. Fix recommendation if needed

```python
{code — §3에서 정의한 레포의 해당 파일 L1~L{n} 전체}
```
```

- 입력 코드 참조: Group A와 동일

### 프롬프트 구성 요약

| 구성 요소 | Group A | Group C | 차이 |
|----------|---------|---------|------|
| system prompt | 없음 | 없음 | 동일 |
| 지시문 (코드 제외) | "Analyze the security..." (3문장) | 동일 3문장 + B1-B4 체크리스트 + 출력 형식 지정 | C에 ~100 토큰 추가 |
| 입력 코드 | §3의 코드 전문 | §3의 코드 전문 | **동일** |
| 코드 참조 | `{레포}@{hash}:{파일} L{시작}-{끝}` | 동일 | **동일** |

### 프롬프트 길이 차이

| 그룹 | 지시문 토큰 수 (추정) | 코드 토큰 수 | 합계 |
|------|---------------------|------------|------|
| A | ~30 | R1: ~350 / R2: ~800 | 380 / 830 |
| C | ~130 | R1: ~350 / R2: ~800 | 480 / 930 |

차이: ~100 토큰 (지시문 부분). 이 차이가 교란인지 사후 분석한다.
길이 차이가 유의미한 교란으로 판명되면, β에서 Group B(동일 길이 일반 지시)를 추가한다.

---

## 6. 실험 단위

| 차원 | 값 | 수 |
|------|---|---|
| 레포 | R1, R2 | 2 |
| 모델 | gpt-5.4, sonnet-4.6 | 2 |
| 그룹 | A, B, C | 3 |
| 반복 | 1회 | 1 |
| **합계** | | **12 단위** |

---

## 7. 실행 방법

### 금지 사항
- `task(category="...")` 사용 금지 — 모델이 간접 배정됨
- oh-my-opencode의 system prompt가 주입되는 경로 사용 금지
- 프롬프트 외 추가 컨텍스트(파일 시스템 접근 등) 제공 금지

### 허용 방법
- 직접 API 호출 (가능한 경우)
- 또는 `task()`에서 모델을 명시적으로 지정할 수 있는 방법이 있으면 사용
- system prompt를 빈 문자열로 강제할 수 있으면 사용

### 실행 순서
1. R1 코드 + 커밋 해시 + SHA-256 기록
2. R1 × gpt-5.3-codex × Group A 실행 → 응답 전문 저장
3. R1 × gpt-5.3-codex × Group C 실행 → 응답 전문 저장
4. R1 × claude-opus-4-6 × Group A 실행 → 응답 전문 저장
5. R1 × claude-opus-4-6 × Group C 실행 → 응답 전문 저장
6. R2에 대해 1-5 반복
7. 각 응답에서 모델 ID, 타임스탬프 추출 기록

---

## 8. Ground Truth 정의

### TP/FP 판정 주체와 절차

| 항목 | 정의 |
|------|------|
| 판정 주체 | 프로젝트 관리자 (사람). LLM이 TP/FP를 판정하지 않음 |
| 블라인딩 | 판정 시 해당 응답이 Group A인지 C인지 **가리지 않음** (Phase α는 n=8이라 완전 블라인딩 비현실적). β 이상에서 블라인딩 도입 |
| 판정 기준 | 아래 "TP 인정 조건" 참조 |
| 분쟁 해결 | Phase α는 단독 판정. β 이상에서 2인 독립 판정 + 합치도(Cohen's κ) 측정 |

### TP 인정 조건

LLM이 지적한 이슈가 다음 중 **하나 이상**에 해당하면 TP:

1. **OWASP Top 10 / CWE에 매핑 가능** — 해당 코드 패턴이 알려진 취약점 유형에 해당
2. **코드에서 재현 가능** — 해당 조건을 트리거하는 입력을 구성할 수 있음
3. **동일 이슈가 2개 모델에서 독립적으로 탐지** — 1개 모델만 지적한 경우 추가 검증 필요

### FP 인정 조건

1. 지적한 코드 패턴이 해당 프레임워크에서 정상 동작 (예: FastAPI의 Depends는 injection이 아님)
2. 이론적 위험이나 해당 코드에서는 발생 불가 (예: SQL injection이지만 ORM만 사용)
3. 코드 맥락을 무시한 일반론 (예: "rate limit이 없다" — 상위 미들웨어에서 처리될 수 있음)

### 한계

- Phase α는 단독 판정 — 판정자 편향 가능. β에서 2인 판정으로 완화
- 일부 이슈는 TP/FP 경계가 모호 (예: 설계 권고 vs 취약점) — "경계 사례"로 별도 집계

---

## 9. 채점 기준 (사전 정의, 실험 후 변경 금지)

### 이슈 분류

| 분류 | 정의 |
|------|------|
| TP (진양성) | LLM이 지적한 것이 해당 코드에서 실제로 보안 이슈인 것 |
| FP (오탐) | LLM이 지적했으나 해당 코드에서 실제로는 문제가 아닌 것 |
| 체크리스트 전용 이슈 | SKILL 체크리스트에 명시된 항목이라서 C에서만 탐지된 것 (예: AUTH_FLOW 명시 여부). 이것은 "SKILL 효과"가 아니라 "지시 효과"이므로 별도 집계 |

### 구체성 점수

| 점수 | 기준 | 예시 |
|------|------|------|
| 0 | 일반적 서술 | "브루트포스 방어가 필요합니다" |
| 1 | 함수/위치 지정 | "login() 함수에 rate limit이 없습니다" |
| 2 | 줄번호 + 코드 인용 | "`token = authorization_value[7:].decode()` (line 42)에서 UnicodeDecodeError 미처리" |

### 구조화 점수

| 점수 | 기준 |
|------|------|
| 0 | 서술형 나열 (번호 목록) |
| 1 | 카테고리별 분류 (보안/인증/시크릿 등) |
| 2 | 규칙별 명시적 판정 + 근거 + 권고 |

---

## 10. 성공/실패 기준 (사전 정의)

### 성공 (β로 확장)

다음 중 **하나 이상**이 2개 모델에서 관찰되면 β로 확장:
- Group C의 정밀도(TP/(TP+FP))가 Group A보다 높음
- Group C의 구체성 평균 점수가 Group A보다 높음
- Group C가 Group A에서 놓친 **실제 이슈**(체크리스트 전용 제외)를 탐지

### 실패 (가설 재검토)

- Group A와 C의 정밀도/구체성 차이가 없거나 A가 더 높음
- C가 체크리스트 밖 이슈를 체계적으로 놓침 (시야 축소 확인)
- → SKILL 설계 수정 또는 가설 폐기 검토

### 보류

- 1개 모델에서만 차이 관찰 → 모수 확대(모델 추가) 후 재판단

---

## 11. 데이터 저장 구조

### 디렉토리 레이아웃

```
PHASE-ALPHA/
├── design.md                          ← 이 문서
├── responses/
│   └── v3/                            ← 현재 유효 실험
│       ├── bread-R1_gpt-5.4_A.json / .response.md
│       ├── bread-R1_gpt-5.4_C.json / .response.md
│       ├── bread-R1_sonnet-4.6_A.json / .response.md
│       ├── bread-R1_sonnet-4.6_C.json / .response.md
│       ├── bread-R2_gpt-5.4_A.json / .response.md
│       ├── bread-R2_gpt-5.4_C.json / .response.md
│       ├── bread-R2_sonnet-4.6_A.json / .response.md
│       └── bread-R2_sonnet-4.6_C.json / .response.md
├── scoring/
│   └── v3/
│       ├── bread-R1_gpt-5.4_A.md      ← 채점 결과 (TP/FP/구체성/구조화)
│       ├── ...
│       └── summary.tsv                ← 전체 집계 (도수분포용)
├── inputs/
│   ├── R1_code.py                     ← 실험에 사용된 코드 스냅샷 원본
│   ├── R2_code.py
│   ├── prompt_A.md                    ← 지시문 템플릿 (코드 제외)
│   └── prompt_C.md
├── results.md                         ← 분석 결과 문서
└── prompts/                           ← v1/v2 프롬프트 (폐기, 참고용)
```

### 파일 명명 규칙

`{레포}_{모델}_{그룹}.md`

| 약어 | 의미 |
|------|------|
| R1 | fastapi-realworld-example-app |
| R2 | BlackSheep |
| gpt-5.4 | openai/gpt-5.4 |
| sonnet-4.6 | anthropic/claude-sonnet-4-6 |
| A | Group A (SKILL 없음) |
| C | Group C (SKILL 있음) |

### raw 응답 파일 형식

각 응답 파일(`responses/v3/*.md`)에는 다음이 포함된다:

```markdown
# [레포]-[모델]-[그룹]

## 실행 메타데이터
- 실행 시각: [ISO 8601]
- 모델 ID: [응답에서 추출한 실제 모델 ID]
- temperature: [값]
- system prompt: 없음
- 입력 코드: {레포}@{커밋해시}:{파일경로} L{시작}-{끝}
- 코드 SHA-256: {해시}
- 프롬프트 템플릿: prompt_{그룹}.md

## 입력 프롬프트 전문
[프롬프트 지시문 + 코드 전체를 그대로 복사]

## LLM 응답 전문 (raw)
[LLM이 반환한 텍스트를 편집 없이 그대로 저장]
```

### 채점 파일 형식

각 채점 파일(`scoring/v3/*.md`)에는 다음이 포함된다:

```markdown
# [레포]-[모델]-[그룹] 채점

## 이슈별 채점

| # | LLM이 지적한 이슈 | TP/FP | 심각도 | 구체성(0-2) | 체크리스트 전용? | 근거 |
|---|-----------------|-------|--------|-----------|---------------|------|
| 1 | [이슈 요약] | TP | High | 2 | N | [왜 TP인지] |
| 2 | ... | FP | — | 1 | N | [왜 FP인지] |

## 집계
- 이슈 수: 
- TP: / FP: 
- 정밀도: TP/(TP+FP)
- 구체성 평균: 
- 구조화 점수(0-2): 
- 체크리스트 전용 이슈 수: 
```

### summary.tsv 형식

```tsv
repo	model	group	issues	tp	fp	precision	specificity_avg	structure_score	checklist_only	timestamp
R1	codex	A	6	5	1	0.833	1.5	1	0	2026-03-17T...
R1	codex	C	5	5	0	1.000	1.8	2	1	2026-03-17T...
...
```

---

## 12. 결과 기록 양식 (분석용)

각 실험 단위마다:

**응답 전문**: [파일 경로 — responses/{레포}_{모델}_{그룹}.md]

**채점**:
| 이슈 | TP/FP | 심각도 | 구체성(0-2) | 비고 |
|------|-------|--------|-----------|------|

**집계**:
- 이슈 수: 
- TP: / FP: 
- 정밀도: 
- 구체성 평균: 
- 구조화 점수: 
- 체크리스트 전용 이슈 수: 
```

---

## 13. EXPERIMENT_PROTOCOL.md 체크리스트 충족 확인

```
✅ 독립변인이 정확히 1개만 변하는가? → SKILL 체크리스트 유무
✅ 나머지 변인이 모두 동일한가? → 프롬프트 지시문, 코드, 모델 동일 (길이 차이는 사후 분석)
✅ 주석/힌트가 답을 알려주지 않는가? → 코드 원본 그대로, 힌트 미주입
✅ 인공 코드가 아니라 실제 오픈소스 코드인가? → MIT 레포 2개
✅ 제3자가 동일 조건에서 재현 가능한가? → 커밋 해시, 프롬프트 전문, 모델 ID, 코드 SHA-256 기록
✅ 인용한 이론의 범위를 초과하여 주장하지 않는가? → 채점 기준 사전 정의, 체크리스트 전용 이슈 별도 집계
✅ 이전 실험의 교란 변인이 반복되지 않는가? → v1/v2의 모델 미통제, 지시 차이 문제 해결
```

---

## 14. 이전 실험(v1, v2) 무효 사유 기록

| 버전 | 무효 사유 |
|------|----------|
| v1 (2026-03-17 #1) | Group A "분석하라" vs Group C "3축으로 분석하라" — 지시 자체가 다름 (독립변인 ≠ 1개) |
| v2 (2026-03-17 #2) | ultrabrain/deep 모두 gpt-5.3-codex (1모델, variant만 차이). 모델 ID 미기록. system prompt 미통제 |
