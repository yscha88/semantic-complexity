# 코드 구조 실험 — Django loaddata 수정/배치 과제

> 과제: "fixture 로드 시 진행률 로깅을 추가하라"
> 독립변인: 코드 구조 (before: handle() 단일 함수 / after: load_label() + process_dir() 추출)
> 동일: 로직, 모델, 프롬프트

## 레포 선정 사유

| 기준 | Django loaddata | 선정 이유 |
|------|----------------|----------|
| 리팩토링 유형 | 단일 파일 내 함수 추출 | httpie(파일 분리만)와 달리 **함수 추출** — 배치 판단에 영향 |
| 줄 수 | 263→270줄 | Phase α 규모에 적합 (100~300줄) |
| 로직 변경 | 없음 (구조만 변경) | 로직 변인 통제됨 |
| 리팩토링 커밋 | `9e7723f` "Refactor loaddata for readability" | 커밋 메시지가 명시적으로 가독성 리팩토링 |
| 라이선스 | BSD-3-Clause | ✅ |
| 스타 | 87K | 실제 프로덕션 코드 |
| 과제 적합성 | "어디에 넣을지"가 구조에 따라 달라지는 과제 필요 | handle()에 넣을지 process_dir()에 넣을지 — 구조가 가이드 |

---

## 결과 비교

### 배치 위치

| | Before (handle() 단일) | After (함수 추출) |
|---|---|---|
| **GPT-5.4** | `label_found = True` 뒤 (handle() 안, 중첩 루프 깊숙이) | `self.fixture_count += 1` 뒤 (**process_dir()** 안) |
| **Sonnet** | `label_found = True` 뒤 (handle() 안) | `self.fixture_count += 1` 뒤 (**process_dir()** 안) |

### 배치 전략

| | Before | After |
|---|---|---|
| 전략 | **근접 배치** — handle() 261줄을 스캔하여 "fixture 로드 성공 직후" 위치를 직접 탐색 | **의미적 배치** — process_dir()라는 함수명이 "fixture 처리" 책임을 명시, 그 안에서 배치 |
| 배치 근거 설명 | "label_found = True 뒤" (코드 흐름 기반) | "process_dir() 안의 fixture_count += 1 뒤" (함수 책임 기반) |
| 참조 방식 | 줄 번호 ("around line 194") | 함수명 ("in the process_dir method") |

### 정량 비교

| 지표 | Before | After |
|------|--------|-------|
| GPT 토큰 | 4,439 | 4,665 (+5%) |
| Sonnet 토큰 | 6,037 | 6,136 (+2%) |
| 배치 정확도 | ✅ 정확 | ✅ 정확 |
| 기존 코드 수정 | 0줄 | 0줄 |
| 추가 줄 수 | 1줄 | 1줄 |

---

## EXP-02(openpilot)와 비교

| | EXP-02 openpilot | 이 실험 Django |
|---|---|---|
| 코드 크기 | 261줄 vs 11메서드 | 263줄 vs 270줄(2함수 추출) |
| Before 배치 | 근접 배치 (canValid 안) | 근접 배치 (label_found 뒤) |
| After 배치 | 의미적 배치 (_check_vehicle_specific) | 의미적 배치 (process_dir) |
| **패턴 재현** | **✅** | **✅** |
| 차이점 | openpilot After는 함수명이 과제를 직접 가이드 | Django After도 동일하지만 더 미묘 |

---

## 결론

**EXP-02 패턴이 Django loaddata에서 재현됨:**
- Before(단일 함수): LLM이 전체 코드를 스캔하여 **코드 흐름 기반으로 근접 배치**
- After(함수 추출): LLM이 함수명으로부터 **책임 기반으로 의미적 배치**

**양 모델(GPT-5.4, Sonnet-4.6)에서 동일 패턴.**

단, 이 경우 양쪽 모두 **정확한 위치에 배치**했기 때문에 "품질 차이"보다는 **"판단 경로의 차이"**가 핵심 관찰:
- Before: 261줄을 읽고 문맥에서 "여기가 맞다" 판단 (더 어려운 작업)
- After: 함수명이 "여기를 봐라" 가이드 (더 쉬운 작업)

코드가 잘 분리되면 LLM의 **인지 비용이 줄어든다** — 같은 결과를 더 적은 추론으로 달성.
