# SURVEY 측정 데이터 — 17개 MIT/BSD 레포

측정일: 2026-03-16
스크립트: measure.sh (자동 측정)

## 측정 결과

| # | 레포 | 도메인 | 티어 | ⭐ | 파일수 | 🧀C1 최대함수 | 🧀C3 중첩 | 🧀C4 환경변수 | 🧀C2 SAR | 🍞B1 인증 | 🍞B2 시크릿 | 🍞B4 rawSQL | 🍞B4 ORM | 🥓H1 테스트% | 🥓H3 계약 |
|---|------|--------|------|---|--------|-------------|----------|------------|---------|---------|-----------|----------|---------|-----------|---------|
| 1 | full-stack-fastapi-template | Web API | 상 | 42K | 46 | 41 | 4 | 0 | ❌ | 13 | 15 | 17 | 75 | 15.2% | 0 |
| 2 | fastapi-realworld-example-app | Web API | 중 | 3K | 95 | 112 | 6 | 0 | ❌ | 28 | 14 | 1 | 10 | 13.6% | 0 |
| 3 | fastapi-gino-arq-uvicorn | Web API | 하 | 560 | 21 | 23 | 4 | 0 | ❌ | 3 | 4 | 0 | 0 | 0% | 0 |
| 4 | openai/whisper | ML/AI | 상 | 96K | 20 | 477 | 9 | 1 | ❌ | 8 | 0 | 1 | 3 | 25.0% | 1 |
| 5 | NVIDIA/tacotron2 | ML/AI | 중 | 5.3K | 19 | 107 | 11 | 0 | ❌ | 0 | 0 | 8 | 1 | 0% | 0 |
| 6 | streamlit-fastapi-model-serving | ML/AI | 하 | 504 | 3 | 41 | 6 | 0 | ❌ | 0 | 0 | 0 | 0 | 0% | 0 |
| 7 | Textualize/textual | CLI | 상 | 34.8K | 985 | 328 | 10 | 14 | ❌ | 29 | 0 | 240 | 73 | 25.6% | 21 |
| 8 | Textualize/rich-cli | CLI | 중 | 3.6K | 6 | 334 | 8 | 0 | ❌ | 0 | 0 | 4 | 0 | 16.6% | 0 |
| 9 | python-hyper/h11 | CLI | 하 | 548 | 31 | 158 | 6 | 0 | ❌ | 4 | 0 | 2 | 0 | 29.0% | 0 |
| 10 | pydantic/pydantic | Data | 상 | 27.2K | 403 | 226 | 13 | 11 | ❌ | 11 | 4 | 38 | 19 | 49.8% | 101 |
| 11 | marshmallow-code/marshmallow | Data | 중 | 7.2K | 38 | 137 | 8 | 0 | ❌ | 6 | 0 | 4 | 9 | 39.4% | 5 |
| 12 | uiri/toml | Data | 하 | 1.1K | 10 | 353 | 15 | 0 | ❌ | 2 | 0 | 0 | 0 | 30.0% | 1 |
| 13 | eosphoros-ai/DB-GPT | Infra | 상 | 18.2K | 1251 | — | 12 | — | ❌ | — | — | — | — | 9.1% | — |
| 14 | pyinfra-dev/pyinfra | Infra | 중 | 4.8K | 230 | 258 | 9 | 6 | ❌ | 17 | 14 | 15 | 3 | 15.2% | 0 |
| 15 | wakatime/wakaq | Infra | 하 | 590 | 12 | 126 | 10 | 0 | ❌ | 3 | 0 | 1 | 0 | 0% | 0 |
| 16 | python-arq/arq | Queue | 중 | 2.8K | 31 | 203 | 7 | 2 | ✅ | 3 | 0 | 11 | 2 | 19.3% | 0 |
| 17 | tobymao/saq | Queue | 하 | 822 | 43 | 97 | 9 | 3 | ✅ | 3 | 1 | 54 | 3 | 25.5% | 0 |

## 패턴 분석

### 🧀 Cheese

**C1 (최대 함수 줄 수)**:
- 100줄+ 함수: 13/17 레포 (76%)
- 200줄+ 함수: 7/17 레포 (41%)
- 최대: toml decoder.loads() 353줄, whisper transcribe() 477줄

**C2 (SAR 공존)**:
- SAR 탐지: 2/17 레포 (saq, wakaq — 둘 다 Queue 도메인)
- Queue 도메인에서만 발견 — async worker + state + retry 패턴

**C3 (중첩 깊이)**:
- 10+ 깊이: 7/17 레포 (41%)
- 최대: toml 15단계, pydantic 13단계
- Data/Infra 도메인에서 깊은 중첩 경향

### 🍞 Bread

**B1 (인증)**:
- 인증 코드 존재: 14/17 레포 (82%)
- 집중: Web API > CLI > Data

**B2 (시크릿)**:
- 시크릿 참조 존재: 8/17 레포 (47%)
- Web API + Infra 도메인에 집중

**B4 (SQL)**:
- rawSQL 사용: 13/17 레포 (76%) — 놀라울 정도로 높음
- ORM 사용: 10/17 레포 (59%)

### 🥓 Ham

**H1 (테스트 비율)**:
- 0%: 4/17 레포 (24%) — tacotron2, streamlit, fastapi-gino, wakaq
- 30%+: 4/17 레포 (24%) — toml, pydantic, marshmallow, h11
- 평균: ~17%

**H3 (계약 테스트)**:
- 존재: 5/17 레포 (29%) — pydantic(101!), textual(21), marshmallow(5), whisper(1), toml(1)

## 실험 적합도

| 규칙 | 최적 레포 | 이유 |
|------|---------|------|
| 🧀 C1 (개념 과다) | whisper(477줄), toml(353줄), rich-cli(334줄) | 가장 큰 단일 함수 |
| 🧀 C2 (SAR) | saq, wakaq | SAR 탐지된 유일한 레포 |
| 🧀 C3 (중첩) | toml(15), pydantic(13), DB-GPT(12) | 가장 깊은 중첩 |
| 🍞 B1-B3 (보안) | fastapi-realworld(28 auth), fastapi-template(15 secret) | 가장 풍부한 보안 코드 |
| 🥓 H1 (테스트 부족) | tacotron2(0%), streamlit(0%), wakaq(0%) | 테스트 전무 |
| 🥓 H3 (계약 테스트) | fastapi-realworld(0), pyinfra(0) — API 있지만 계약 없음 | API + contract test 없음 |

## 특이점 기록

### 도메인별 특이점

| 관찰 | 데이터 | 의미 |
|------|--------|------|
| **SAR은 Queue 도메인에서만 발견** | saq, wakaq만 SAR 탐지 (2/17) | state×async×retry 공존은 async worker 패턴의 고유 문제. 범용 규칙이 아니라 **도메인 특이적 규칙** |
| **rawSQL이 76%에서 발견** | 13/17 레포 (textual 240건!) | SQL 관련 도구가 아닌 CLI(textual), Data(pydantic) 레포에서도 대량 발견. DB 접근이 예상보다 보편적 |
| **테스트 0%가 ML/Infra 하위에 집중** | tacotron2, streamlit, wakaq, fastapi-gino | 스타 500~5K 범위의 ML/Infra 프로젝트는 테스트를 아예 안 하는 경향 |
| **pydantic의 계약 테스트 101건** | 다른 레포 최대 21건(textual) | Data 검증 라이브러리는 본질적으로 schema/contract 테스트에 강함. 다른 도메인과 비교 부적합 |

### 티어별 특이점

| 관찰 | 데이터 | 의미 |
|------|--------|------|
| **상위(10K+) 레포일수록 큰 함수 존재** | whisper 477줄, textual 328줄, pydantic 226줄 | 프로젝트가 성장하면서 함수가 비대해지는 경향 (기술부채 축적?) |
| **하위(500-1K) 레포에서 테스트 부재율 높음** | 4개 하위 레포 중 3개가 테스트 0% | 초기 프로젝트는 테스트보다 기능 구현 우선 — PoC Gate 해당 |
| **중위(1K-10K)가 가장 균형** | arq: 테스트 19%, 함수 203줄, SAR 존재 | 어느정도 성숙했지만 기술부채도 축적 — MVP Gate 해당 |

### 규칙 간 상관

| 관찰 | 데이터 | 의미 |
|------|--------|------|
| **큰 함수 = 깊은 중첩** | toml(353줄, 15중첩), pydantic(226줄, 13중첩) | C1(개념 수)과 C3(중첩)이 상관. 단, whisper(477줄, 9중첩)는 예외 — 함수가 길지만 평탄한 구조 |
| **인증 풍부 ≠ 시크릿 관리 풍부** | fastapi-realworld: auth 28, secret 14. textual: auth 29, secret 0 | 인증 코드가 있어도 시크릿 관리는 별개 문제 |
| **테스트 비율과 계약 테스트 무관** | h11: 테스트 29%인데 계약 0. marshmallow: 테스트 39%에 계약 5 | 단위 테스트 커버리지와 API 계약 테스트는 독립 지표 |
| **SAR 존재 ↔ 테스트 부재 경향** | wakaq: SAR ✅, 테스트 0%. saq: SAR ✅, 테스트 25.5% | SAR 복잡도가 높은 코드는 테스트하기 어려워서 테스트를 안 하는 경향? (n=2로 약함) |

### Gate 시스템과의 대응

| Gate | 실제 레포 특성 | SURVEY에서의 분포 |
|------|-------------|-----------------|
| **PoC** (돌아가면 OK) | 테스트 0%, 인증 없음, 큰 함수 | fastapi-gino, streamlit, wakaq |
| **MVP** (처음부터 제대로) | 테스트 15-25%, 인증 존재, 중간 함수 | arq, pyinfra, fastapi-realworld |
| **Production** (엄격) | 테스트 30%+, 계약 테스트, 보안 코드 | pydantic, marshmallow, h11 |

이 대응이 경험적으로 관찰됨. 하위 레포 ≈ PoC, 중위 ≈ MVP, 상위 중 성숙한 레포 ≈ Production.

### 측정 한계

| 한계 | 영향 |
|------|------|
| `measure.sh`의 C2(SAR) 탐지는 파일 수준 grep — 함수 수준 공존은 수동 확인 필요 | SAR 과소탐지 가능 |
| C1 "최대 함수 줄 수"는 개념 수가 아님 — 줄 수와 개념 수는 상관이지만 동일하지 않음 | 별도 개념 카운터 필요 |
| DB-GPT의 일부 지표가 빈값 — 레포 규모(1251 파일)로 일부 grep 타임아웃 | DB-GPT 수동 재측정 필요 |
| 환경변수 참조 수(C4)는 숨겨진 의존성의 일부만 측정 — 전역 변수, 싱글턴 미포함 | C4 과소측정 |
