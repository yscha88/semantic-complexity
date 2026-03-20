# 모듈 타입 분류 체계

## 개요

> ⚠️ **이 문서의 분류 체계와 가중치는 전부 가설이다.**
> 실험으로 검증되기 전까지 확정값으로 사용하면 안 된다.
> 대규모 실험(RESEARCH.md Phase α~δ)의 부산물로 도메인별 프로파일이 확인되면 수정한다.

모듈 타입별로 🍞🧀🥓 비율이 다를 것이라는 **가설**이다.

```
현재 측정값 vs Canonical Ratio → 편차 → 리팩토링 방향
```

---

## 분류 체계

### 1차: 구조 축 (Structural Axis)

아키텍처/기술적 분류. 베이스라인 🍞🧀🥓 결정.

| 1차 타입 | 정의 | 특성 |
|----------|------|------|
| `api` | UI 없이 endpoint만 노출 | 경계면 역할, 검증 집중 |
| `web` | 자체 Web UI + endpoint 가능 | 프레젠테이션 + API |
| `app` | 핵심 비즈니스 로직 | 상태/비동기/워크플로우 |
| `job` | 일회성/주기적 실행 | Batch, Cron, Worker |
| `lib` | 라이브러리 형태 | 재사용, 순수성 지향 |
| `deploy` | 배포/인프라 구성 | 선언적, 보안 중심 |
| `data` | 데이터/스토리지 | 스키마, 마이그레이션 |

### 2차: 도메인 축 (Domain Axis)

비즈니스/컨텍스트 분류. 베이스라인에서 가감(delta).

---

## 상세 분류

### `api` (경계면)

| 2차 타입 | 정의 | 🍞🧀🥓 특성 |
|----------|------|-------------|
| `api/external` | 외부 노출 API (고객, 3rd-party) | 🍞↑↑ authn/authz, rate limit, audit, 계약테스트 |
| `api/internal` | 내부 서비스간 API | 🍞↑ 계약 필요하지만 유연 |
| `api/gateway` | API Gateway, BFF | 🍞↑↑ 라우팅, 인증 집중 |

### `web` (웹 UI)

| 2차 타입 | 정의 | 🍞🧀🥓 특성 |
|----------|------|-------------|
| `web/public` | 공개 웹사이트 | 🍞↑ XSS/CSRF, 접근성 |
| `web/admin` | 관리자 대시보드 | 🍞↑↑ 권한 관리, 감사 |
| `web/internal` | 내부 도구 | 🍞↓ 상대적으로 유연 |

### `app` (비즈니스 로직)

| 2차 타입 | 정의 | 🍞🧀🥓 특성 |
|----------|------|-------------|
| `app/workflow` | 상태머신, saga, orchestration | 🧀↑↑↑ retry/timeout, 맥락밀도 폭발 |
| `app/adapter` | 외부 시스템 연결 (PACS/EHR/S3) | 🧀↑ hidden coupling 위험 |
| `app/service` | 일반 비즈니스 서비스 | 균형 |

### `job` (배치/작업)

| 2차 타입 | 정의 | 🍞🧀🥓 특성 |
|----------|------|-------------|
| `job/batch` | 대량 데이터 처리 | 🧀↑ 상태 관리, 재시작 |
| `job/cron` | 주기적 스케줄 작업 | 🧀↑ 멱등성 필요 |
| `job/worker` | 큐 기반 비동기 워커 | 🧀↑ retry, dead letter |
| `job/migration` | 데이터 마이그레이션 | 🍞↑ 롤백, 검증 |

### `lib` (라이브러리)

| 2차 타입 | 정의 | 🍞🧀🥓 특성 |
|----------|------|-------------|
| `lib/domain` | 도메인 규칙, 정책, 검증 | 🥓↑↑ 순수, 테스트 용이 |
| `lib/infra` | 공용 클라이언트, 미들웨어 | 🍞↑ 보안 유틸 포함 |
| `lib/ai-imaging` | DICOM, preprocessing, inference | 🧀↑ 상태/IO 혼합 위험 |
| `lib/common` | 공용 유틸리티 | 🥓↑ 순수 함수 지향 |

### `deploy` (배포/인프라)

| 2차 타입 | 정의 | 🍞🧀🥓 특성 |
|----------|------|-------------|
| `deploy/cluster` | ingress, cert-manager, netpol | 🍞↑↑↑ 인프라 보안 |
| `deploy/app` | values, env, secret refs, HPA | 🍞↑↑ 앱 배포 구성 |
| `deploy/security` | mTLS, PKI, IAM/RBAC, OPA | 🍞↑↑↑ 보안 정책 |
| `deploy/ci-cd` | 파이프라인, 빌드 구성 | 🍞↑ 공급망 보안 |

### `data` (데이터)

| 2차 타입 | 정의 | 🍞🧀🥓 특성 |
|----------|------|-------------|
| `data/schema` | DB 스키마, 테이블 정의 | 🍞↑ 데이터 무결성 |
| `data/migration` | 스키마 마이그레이션 | 🍞↑ 🥓↑ 롤백, 검증 |
| `data/seed` | 초기/테스트 데이터 | 🥓↑ 재현성 |
| `data/etl` | 데이터 파이프라인 | 🧀↑ 상태/변환 |

---

## 가중치 구조

### 베이스라인 + Delta 방식

```
최종 가중치 = 1차 베이스라인 + 2차 Delta

예시:
  api (1차 베이스)     → 🍞 45 / 🧀 25 / 🥓 30
  + external (2차 delta) → 🍞 +10
  ─────────────────────────────────────────
  api/external (최종)   → 🍞 55 / 🧀 20 / 🥓 25  (정규화)
```

### 1차 베이스라인 (TBD)

> ⚠️ 구체적 수치는 규제 기준 및 경험적 데이터 기반으로 결정 예정

| 1차 타입 | 🍞 Bread | 🧀 Cheese | 🥓 Ham | 근거 |
|----------|----------|-----------|--------|------|
| `api` | ? | ? | ? | TBD |
| `web` | ? | ? | ? | TBD |
| `app` | ? | ? | ? | TBD |
| `job` | ? | ? | ? | TBD |
| `lib` | ? | ? | ? | TBD |
| `deploy` | ? | ? | ? | TBD |
| `data` | ? | ? | ? | TBD |

### 2차 Delta (TBD)

> ⚠️ 각 도메인 축에서 베이스라인 대비 가감

---

## 가중치 결정 기준 (참조)

가중치는 다음 기준을 참조하여 결정:

### 규제/표준
- FDA Cybersecurity Guidance (의료기기)
- HIPAA (의료 데이터)
- SOC 2 Type II
- ISO 27001
- OWASP ASVS

### 도메인 특성
- 경계면 노출 정도
- 데이터 민감도 (PHI/PII)
- 가용성 요구사항
- 감사 요구사항

### 기술 특성
- 상태 복잡도
- 비동기/동시성
- 외부 의존성
- 변경 빈도

---

## 확장

### 커스텀 모듈 타입

`.semantic-complexity.yaml`에서 정의:

```yaml
architecture_roles:
  # 1차 추가
  ml:
    baseline:
      bread: 20
      cheese: 50
      ham: 30

  # 2차 추가
  lib/ml-inference:
    parent: lib
    delta:
      cheese: +15
    patterns:
      - "**/inference/**"
      - "**/models/**"
```

---

## 분석 제외 대상

### 제외 모듈 타입

복잡도 분석에서 제외되는 모듈 타입:

| 모듈 타입 | 정의 | 제외 사유 |
|----------|------|----------|
| `test` | 테스트 코드 | 🥓 Ham 계산에만 사용, 복잡도 측정 불필요 |
| `config` | 설정 파일 | 선언적, 로직 없음 |
| `types` | 타입 정의만 | 구조 정의, 실행 로직 없음 |
| `generated` | 자동 생성 코드 | protobuf, openapi 등 수정 불가 |
| `script` | 일회성 스크립트 | 유지보수 대상 아님 |
| `vendor` | 외부 라이브러리 복사본 | 우리 코드 아님 |

```python
# tests/test_user.py
__architecture_role__ = "test"

# src/config/settings.py
__architecture_role__ = "config"

# src/types/user.py
__architecture_role__ = "types"

# src/generated/api_pb2.py
__architecture_role__ = "generated"
```

### 숨겨진 의존성 허용 목록

다음 패턴은 숨겨진 의존성 계산에서 **제외**:

| 패턴 | 언어 | 제외 사유 |
|------|------|----------|
| `logging.*`, `logger.*` | Python | 관측성 필수 |
| `print()` | Python | 디버깅 |
| `console.log()`, `console.*` | JS/TS | 디버깅 |
| `log.*`, `slog.*` | Go | 관측성 필수 |
| `assert` | 공통 | 검증 로직 |
| `raise`, `throw` | 공통 | 예외 처리 |
| `@dataclass`, `TypedDict` | Python | 타입 선언 |
| `interface`, `type` | TS | 타입 선언 |

### 설정 파일

```yaml
# .semantic-complexity.yaml
exclude:
  # 분석 제외 모듈 타입
  architecture_roles:
    - test
    - config
    - types
    - generated
    - script
    - vendor

  # 숨겨진 의존성 허용 목록
  hidden_dependency_allowlist:
    - logging
    - logger
    - print
    - console.log
    - console.error
    - console.warn
    - log.Info
    - log.Error
    - slog.*

  # 파일 패턴 제외
  file_patterns:
    - "**/__generated__/**"
    - "**/node_modules/**"
    - "**/vendor/**"
    - "**/*.pb.go"
    - "**/*_pb2.py"
```

---

## 명시적 선언 규칙

### 원칙

모듈 타입은 **명시적으로 선언**되어야 한다.

- ❌ 경로/내용 기반 추정 (inference)
- ✅ 파일 상단에 명시적 선언

### 언어별 선언 방식

#### Python

```python
__architecture_role__ = "api/external"

def create_user():
    ...
```

#### TypeScript / JavaScript

```typescript
/** @module api/external */

export function createUser() { ... }
```

또는:

```typescript
export const MODULE_TYPE = "api/external" as const;
```

#### Go

```go
// @module-type: api/external
package users

func CreateUser() { ... }
```

#### Java

```java
@ArchitectureRole("api/external")
public class UserController { }
```

#### Rust

```rust
//! @module-type: api/external

pub fn create_user() { ... }
```

### 규칙

| 규칙 | 설명 |
|------|------|
| 파일 단위 | 한 파일 = 한 모듈 타입 |
| 파일 상단 | 모듈 타입 선언은 파일 최상단에 위치 |
| 필수 | 분석 대상 파일은 반드시 모듈 타입 선언 필요 |
| 1차만 가능 | `"app"`, `"deploy"` 등 1차 구조축만 선언 가능 |
| 2차 포함 가능 | `"api/external"`, `"lib/domain"` 등 2차까지 선언 가능 |

### 미선언 파일 처리

모듈 타입이 선언되지 않은 파일은:
- 분석 대상에서 제외
- 또는 경고 출력 후 기본값 적용 (설정 가능)

```yaml
# .semantic-complexity.yaml
undefined_module:
  action: "warn"  # skip | warn | error
  default: "app"  # 기본값 (warn 시 적용)
```

---

## 문서 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|-----------|
| 0.1 | 2025-12-24 | 초안 - 1차/2차 분류 체계 정의 |
| 0.2 | 2025-12-24 | 명시적 선언 규칙 추가 - 경로/내용 기반 추정 폐기 |
| 0.3 | 2025-12-24 | 분석 제외 대상 추가 - test/config/types/generated, 허용 목록 |
