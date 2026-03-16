# 🍞 Bread Gate — 코드 보안 구조 판단

> 코드를 작성하거나 리뷰할 때, 보안 구조가 적절한지 판단한다.
> Module type과 Gate 단계에 따라 다른 기준을 적용한다.

## 불변조건 (위반 시 무조건 실패)

| # | 규칙 |
|---|------|
| B1 | **인증 메커니즘이 존재하고 명시적인가** — API 엔드포인트에 인증/인가 없으면 위반 (api/internal은 `AUTH_FLOW: GATEWAY_DELEGATED` 선언으로 충족 가능) |
| B2 | **시크릿이 하드코딩되지 않았는가** — API 키, 토큰, 비밀번호가 소스 코드에 직접 포함되면 위반 |
| B3 | **Trust Boundary가 명시적인가** — 외부 입력 경계, 네트워크 경계, 프로세스 간 경계가 식별 가능해야 함 |
| B4 | **Injection 위험이 방어되었는가** — SQL, 명령어, 경로 조작에 대한 방어 (파라미터화 쿼리, 입력 검증) |

## Module Type × Gate 임계값

| architecture_role | Gate | B1 auth | B2 secret | B3 boundary | B4 injection |
|---|---|---|---|---|---|
| api/external | PoC | 권장 | 필수 | 권장 | 권장 |
| api/external | MVP | **필수** | 필수 | **필수** | **필수** |
| api/external | Prod | 필수+MFA | 필수+rotation | 필수+문서화 | 필수+WAF |
| api/internal | PoC | 불필요 | 필수 | 불필요 | 권장 |
| api/internal | MVP | GATEWAY_DELEGATED | 필수 | 권장 | **필수** |
| api/internal | Prod | GATEWAY_DELEGATED | 필수+rotation | **필수** | 필수 |
| lib/domain | 모든 Gate | 불필요 | 필수 | 불필요 | 해당 시 필수 |
| app/workflow | PoC | 불필요 | 필수 | 불필요 | 권장 |
| app/workflow | MVP | 권장 | 필수 | 권장 | **필수** |

## 판단 워크플로우

```
1. architecture_role 확인
   → api/external이면 B1-B4 모두 적용
   → api/internal이면 B1은 GATEWAY_DELEGATED 허용
   → lib/domain이면 B1/B3 면제

2. Gate 단계 확인
   → PoC: B2(시크릿 하드코딩)만 필수, 나머지 권장
   → MVP: B1-B4 대부분 필수
   → Prod: 모든 항목 필수 + 강화 조치

3. 각 규칙 체크
   B1: 인증 코드 또는 AUTH_FLOW 선언 존재?
   B2: grep SECRET|API_KEY|PASSWORD → 환경변수/vault인지 하드코딩인지?
   B3: 외부 입력이 들어오는 지점이 식별 가능한가?
   B4: SQL이 파라미터화? 파일 경로가 검증? 명령어 실행이 화이트리스트?

4. 정량 확인 필요 시
   → MCP 도구 호출 또는 Semgrep/Bandit 결과 참조
```

## B1-B4 상세 판정

### B1: 인증

| 패턴 | 판정 |
|------|------|
| FastAPI `Depends(get_current_user)` | ✅ 명시적 |
| Flask `@login_required` | ✅ 명시적 |
| `# AUTH_FLOW: GATEWAY_DELEGATED` 선언 | ✅ 내부 서비스 |
| `# AUTH_FLOW: NONE` 선언 | ✅ 의도적 (공개 엔드포인트) |
| 인증 코드 없음, 선언도 없음 | ❌ 위반 |

### B2: 시크릿

| 패턴 | 판정 |
|------|------|
| `os.environ["API_KEY"]` | ✅ 환경변수 |
| `config.get("secret")` | ✅ 설정 파일 (gitignore 확인 필요) |
| `API_KEY = "sk-1234abcd"` | ❌ 하드코딩 |
| `password = "test123"` | ❌ 하드코딩 (테스트 코드에서도 경고) |

### B3: Trust Boundary

| 경계 | 식별 방법 |
|------|----------|
| HTTP 요청 → 서버 | 엔드포인트 함수의 파라미터 |
| 서버 → DB | DB 쿼리 함수 |
| 메인 프로세스 → 워커 | Queue/IPC |
| 사용자 입력 → 파일 시스템 | 파일 경로 생성 |

### B4: Injection

| 유형 | 안전 | 위험 |
|------|------|------|
| SQL | `cursor.execute("... WHERE id=%s", (id,))` | `f"... WHERE id={id}"` |
| 경로 | `pathlib.Path(base) / validated_name` | `os.path.join(base, user_input)` |
| 명령어 | `subprocess.run(["cmd", arg])` | `os.system(f"cmd {user_input}")` |

## 금지 사항

- auth, crypto, trust boundary 로직을 LLM이 직접 변경하지 말 것
- 시크릿을 로그에 출력하지 말 것
- 테스트 코드에서도 실제 시크릿을 사용하지 말 것
