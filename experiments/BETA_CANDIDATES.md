# Phase β 후보 레포 목록

> Phase α에서 다룬 것: Python 웹 인증(3레포), Python 파서(httpie), Python CLI(Django loaddata)
> β에서 다루지 않은 패턴을 최대한 넓게 커버

---

## 후보 목록

### 동시성/병렬

| # | 레포 | 언어 | 스타 | 라이선스 | 후보 모듈 | 고유 이슈 |
|---|------|------|------|---------|----------|----------|
| 1 | pocketbase/pocketbase | Go | 44K | MIT | core/db.go 또는 apis/record_auth.go | goroutine 안전성, context 전파, 트랜잭션 |
| 2 | asynkron/protoactor-go | Go | 5K | Apache-2.0 | actor/pid.go | actor 모델 동시성, 메시지 패싱 레이스 |
| 3 | python-hyper/h2 | Python | 1.3K | MIT | h2/connection.py | HTTP/2 상태 머신, 프레임 파싱, 프로토콜 복잡도 |

### 직렬화/데이터 검증

| # | 레포 | 언어 | 스타 | 라이선스 | 후보 모듈 | 고유 이슈 |
|---|------|------|------|---------|----------|----------|
| 4 | pydantic/pydantic | Python | 27K | MIT | pydantic/_internal/_validators.py | 역직렬화 안전성, 타입 강제 변환, 입력 검증 우회 |
| 5 | marshmallow-code/marshmallow | Python | 7K | MIT | marshmallow/fields.py | 필드 검증, 중첩 스키마, 에러 노출 |
| 6 | jazzband/djangorestframework-simplejwt | Python | 4K | MIT | rest_framework_simplejwt/tokens.py | JWT 생성/검증, 토큰 블랙리스트, 시크릿 로테이션 |

### 암호화/보안

| # | 레포 | 언어 | 스타 | 라이선스 | 후보 모듈 | 고유 이슈 |
|---|------|------|------|---------|----------|----------|
| 7 | pyca/cryptography | Python | 7K | BSD/Apache | src/cryptography/fernet.py | 키 파생, IV 생성, 타이밍 공격 방어 |
| 8 | mpdavis/python-jose | Python | 1.6K | MIT | jose/jwt.py 또는 jose/jws.py | JWT 서명 검증, 알고리즘 혼동, none 알고리즘 |
| 9 | nickel-org/nickel.rs | Rust | 3K | MIT | src/middleware/session.rs 또는 ssl.rs | Rust 메모리 안전성, FFI, 세션 관리 |

### 권한/접근 제어

| # | 레포 | 언어 | 스타 | 라이선스 | 후보 모듈 | 고유 이슈 |
|---|------|------|------|---------|----------|----------|
| 10 | dfunckt/django-rules | Python | 1.9K | MIT | rules/predicates.py | 규칙 기반 권한, 조합 로직, 우회 가능성 |
| 11 | vimalloc/flask-jwt-extended | Python | 1.6K | MIT | flask_jwt_extended/view_decorators.py | JWT 데코레이터, 권한 검사 미들웨어, 우회 경로 |

### 인프라/설정

| # | 레포 | 언어 | 스타 | 라이선스 | 후보 모듈 | 고유 이슈 |
|---|------|------|------|---------|----------|----------|
| 12 | pyinfra-dev/pyinfra | Python | 5K | MIT | pyinfra/connectors/ssh.py | 원격 명령어 인젝션, SSH 키 관리, 호스트 검증 |
| 13 | theskumar/python-dotenv | Python | 7K | BSD | src/dotenv/main.py | .env 파싱 안전성, 변수 확장, 파일 경로 |

### 파일 시스템/경로

| # | 레포 | 언어 | 스타 | 라이선스 | 후보 모듈 | 고유 이슈 |
|---|------|------|------|---------|----------|----------|
| 14 | mitsuhiko/flask | Python | 71K | BSD | flask/helpers.py (send_file/send_from_directory) | 경로 탈출, 디렉토리 트래버설, 심링크 |
| 15 | kellyjonbrazil/jc | Python | 8.5K | MIT | jc/parsers/ 중 복잡한 것 1개 | 비신뢰 입력 파싱, 메모리 폭발, 정규식 DoS |

### TypeScript/프론트엔드

| # | 레포 | 언어 | 스타 | 라이선스 | 후보 모듈 | 고유 이슈 |
|---|------|------|------|---------|----------|----------|
| 16 | honojs/hono | TS | 22K | MIT | src/middleware/jwt/index.ts | TS JWT 미들웨어, 타입 안전성, 헤더 파싱 |
| 17 | lucia-auth/lucia | TS | 10K | MIT | src/core.ts 또는 src/session.ts | 세션 관리, CSRF, 쿠키 보안 |

### 큐/비동기 워커

| # | 레포 | 언어 | 스타 | 라이선스 | 후보 모듈 | 고유 이슈 |
|---|------|------|------|---------|----------|----------|
| 18 | wakatime/wakaq | Python | 590 | BSD | wakaq/worker.py | 큐 메시지 안전성, 재처리 공격, dead letter |
| 19 | celery/celery | Python | 25K | BSD | celery/app/task.py 또는 worker/consumer.py | 태스크 직렬화, 원격 코드 실행, 재시도 로직 |

### OOP 복잡도/상속

| # | 레포 | 언어 | 스타 | 라이선스 | 후보 모듈 | 고유 이슈 |
|---|------|------|------|---------|----------|----------|
| 20 | sqlalchemy/sqlalchemy | Python | 10K | MIT | lib/sqlalchemy/orm/session.py | 세션 생명주기, 트랜잭션 격리, ORM 복잡도 |

---

## 패턴 커버리지

| 패턴 | α에서 다룸? | β 후보 |
|------|-----------|--------|
| 인증 로직 | ✅ | #6, #11 (다른 프레임워크) |
| JWT 검증 | ✅ | #8 (알고리즘 혼동), #16 (TS) |
| CLI 입력 | ✅ | — |
| 파서 | ✅ | #15 (다른 파서) |
| 동시성/goroutine | ❌ | #1, #2 |
| HTTP/2 상태 머신 | ❌ | #3 |
| 역직렬화 | ❌ | #4, #5 |
| 암호화 구현 | ❌ | #7, #8 |
| Rust 메모리 | ❌ | #9 |
| 권한/RBAC | ❌ | #10, #11 |
| 원격 실행 | ❌ | #12 |
| 설정/시크릿 로딩 | ❌ | #13 |
| 경로 탈출 | ❌ | #14 |
| TS 미들웨어 | ❌ | #16, #17 |
| 큐/워커 | ❌ | #18, #19 |
| ORM 복잡도 | ❌ | #20 |

---

## 선정 기준 (β 12실험에서 선택 시)

1. **α와 겹치지 않는 패턴 우선** — 새로운 유형의 이슈를 발견해야 SKILL 규칙이 확장됨
2. **언어 다양성** — Python만이 아닌 Go, TS, Rust 포함
3. **모듈 크기 100-400줄** — 실험 스크립트의 토큰 한도 내
4. **MIT/BSD** — 제3자 재현 가능
