# 🧀 Cheese Gate — 코드 인지 가능성 판단

> 코드를 작성하거나 리뷰할 때, 사람과 LLM 모두가 이해할 수 있는 코드인지 판단한다.
> Module type과 Gate 단계에 따라 다른 기준을 적용한다.

## 불변조건 (위반 시 무조건 실패)

| # | 규칙 | 근거 |
|---|------|------|
| C1 | **함수당 개념 수 ≤ 9** | Miller 1956: 작업기억 7±2. EXP-01v에서 5모델 검증 |
| C2 | **state × async × retry 2개 이상 공존 금지** | 3가지 관심사가 동시 존재하면 사람도 LLM도 추론 불가 |
| C3 | **중첩 깊이 ≤ threshold** (아래 표 참조) | Campbell 2017: 중첩 시 인지 비용 비선형 증가 |
| C4 | **숨겨진 의존성 최소화** | 함수 시그니처에 나타나지 않는 의존성은 추론을 방해 |

## Module Type × Gate 임계값

| architecture_role | Gate | nesting | concepts | hidden_deps |
|---|---|---|---|---|
| api/external | PoC | ≤ 5 | ≤ 10 | ≤ 3 |
| api/external | MVP | ≤ 3 | ≤ 7 | ≤ 1 |
| api/external | Prod | ≤ 2 | ≤ 5 | ≤ 0 |
| api/internal | PoC | ≤ 6 | ≤ 12 | ≤ 4 |
| api/internal | MVP | ≤ 4 | ≤ 9 | ≤ 2 |
| api/internal | Prod | ≤ 3 | ≤ 7 | ≤ 1 |
| lib/domain | PoC | ≤ 6 | ≤ 12 | ≤ 4 |
| lib/domain | MVP | ≤ 4 | ≤ 9 | ≤ 2 |
| lib/domain | Prod | ≤ 3 | ≤ 7 | ≤ 1 |
| app/workflow | PoC | ≤ 7 | ≤ 14 | ≤ 5 |
| app/workflow | MVP | ≤ 5 | ≤ 9 | ≤ 3 |
| app/workflow | Prod | ≤ 4 | ≤ 7 | ≤ 2 |

## 판단 워크플로우

```
1. architecture_role 확인
   → 미선언 시 "app" 기본 적용

2. Gate 단계 확인 (PoC / MVP / Production)
   → 미선언 시 "MVP" 기본 적용

3. 불변조건 C1~C4 체크
   → 하나라도 위반 시 즉시 실패 보고

4. threshold 비교
   → 임계값 테이블에서 해당 role × gate 참조

5. 정량 확인 필요 시
   → MCP 도구 호출: analyze_cheese(source_code)
```

## 개념 수 세는 법

하나의 함수 안에서 독립적으로 이해해야 하는 항목을 센다:

| 개념으로 세는 것 | 예시 |
|----------------|------|
| 외부 함수/메서드 호출 | `fs.run()`, `exec_sql()`, `model.predict()` |
| 상태 변경 | DB UPDATE, 파일 쓰기/삭제, 플래그 설정 |
| 분기별 에러 처리 | 각 try/except 블록 |
| 데이터 변환 | `pd.Series(...)`, dict comprehension |
| I/O 작업 | 파일 읽기, 큐 put/get |

| 개념으로 세지 않는 것 | 예시 |
|--------------------|------|
| 변수 할당 | `x = data["key"]` |
| 로깅 | `logger.info(...)` |
| 반환문 | `return result` |

## state × async × retry 판정

| 관심사 | 탐지 패턴 |
|--------|----------|
| **State** | 가변 상태 관리: 파일 생성/삭제, DB 상태 갱신, 플래그, 캐시 |
| **Async** | 비동기/병렬: async/await, multiprocessing, threading, Queue |
| **Retry** | 재시도/복구: while + retry, 자동 재시작, backoff, 재연결 |

2개 이상이 **같은 함수**에 존재하면 위반. 다른 함수로 분리되어 있으면 허용.

## 위반 시 리팩토링 방향

| 위반 | 방향 |
|------|------|
| 개념 수 초과 | **단계 함수 추출**: 각 단계를 독립 함수로 분리. 오케스트레이터는 호출만 |
| SAR 공존 | **관심사 분리**: state 관리 함수, async 브릿지 함수, retry 감시 함수를 각각 분리 |
| 중첩 초과 | **early return, guard clause**: 예외 조건 먼저 처리 후 정상 흐름 평탄화 |
| 숨겨진 의존성 | **명시적 주입**: 함수 인자로 의존성 전달 또는 dataclass로 컨텍스트 묶기 |

## 금지 사항

- `*args/**kwargs`로 파라미터 수를 숨겨서 개념 수를 회피하지 말 것
- 하나의 config 객체에 무관한 파라미터를 모두 담지 말 것
- `__essential_complexity__` 마커를 직접 추가/수정하지 말 것
- auth, crypto, trust boundary 로직을 변경하지 말 것
