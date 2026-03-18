# SURVEY: 다분야 MIT 레포 🍞🧀🥓 지표 수집

## 목적

다양한 분야/규모의 MIT 오픈소스에서 🍞Bread/🧀Cheese/🥓Ham 지표를
반복 측정 가능하게 수집하여, 규칙의 보편성을 검증한다.

## 레포 선출 기준

| 축 | 값 |
|---|---|
| 도메인 | Web API, ML/AI, CLI, Data Processing, Infra/DevOps, Queue/Messaging |
| 티어 | 상위(10K+), 중위(1K-10K), 하위(500-1K) |
| 라이선스 | MIT 또는 BSD (허용적 라이선스) |
| 언어 | Python |
| 목표 수 | 6 도메인 × 3 티어 = 18개 (중복/미달 시 조정) |

## 측정 지표

### 🧀 Cheese (인지 가능성) — 자동 측정 가능

| ID | 지표 | 측정 방법 | 단위 |
|---|---|---|---|
| C1 | 최대 개념 수/함수 | 가장 큰 함수의 개념 카운트 | 개 |
| C2 | SAR 공존 | state×async×retry 동시 존재 함수 유무 | T/F |
| C3 | 최대 중첩 깊이 | 가장 깊은 들여쓰기 | 단계 |
| C4 | 숨겨진 의존성 | 전역변수/os.environ 직접 참조 수 | 개 |

### 🍞 Bread (보안 구조) — 반자동 측정

| ID | 지표 | 측정 방법 | 단위 |
|---|---|---|---|
| B1 | 인증 존재 | auth/login/token 키워드 검색 | T/F |
| B2 | 시크릿 관리 | 환경변수/하드코딩/vault 분류 | enum |
| B3 | Trust Boundary 명시 | 명시적 경계 정의 존재 | T/F |
| B4 | SQL injection 위험 | raw SQL vs ORM vs 없음 | enum |

### 🥓 Ham (테스트 보존) — 자동 측정 가능

| ID | 지표 | 측정 방법 | 단위 |
|---|---|---|---|
| H1 | 테스트 파일 비율 | test*.py 수 / 전체 .py 수 | % |
| H2 | Critical path 테스트 | 가장 큰 모듈에 대응 테스트 존재 | T/F |
| H3 | Contract test 존재 | API 스키마/contract 테스트 존재 | T/F |

## 데이터 형식

`data.json`:
```json
[
  {
    "repo": "owner/name",
    "url": "https://github.com/...",
    "stars": 42000,
    "license": "MIT",
    "domain": "web-api",
    "tier": "upper",
    "cheese": {"c1": 15, "c2": false, "c3": 4, "c4": 3, "c1_file": "path/to/file.py", "c1_function": "func_name"},
    "bread": {"b1": true, "b2": "env", "b3": false, "b4": "orm"},
    "ham": {"h1": 5.2, "h2": true, "h3": false}
  }
]
```
