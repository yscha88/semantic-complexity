# auth skill draft (alpha)

## Status

Experimental alpha.

Supported only by limited experiments on authentication-oriented Python modules.

## Validation scope

- Phase α evidence: `fastapi-realworld`, `BlackSheep`, `icloud-photos-downloader`
- Phase γ evidence: `fastapi-realworld` (domain-specific vs general comparison)
- Models: `gpt-5.4`, `claude-sonnet-4-6`
- Compared against (α): plain checklist prompts → D format showed +33% TP
- Compared against (γ): D-general (core R1-R4) vs D-specific (B1-B4) → **no TP gain**

## Prompt draft

```text
Analyze the security of the following code.
Identify any vulnerabilities, authentication issues, or secret management problems.
Rate each finding by severity.

Use the following checklist:
- B1: Trust boundary — is input validation present at every entry point?
- B2: Auth flow — is authentication/authorization correctly implemented?
- B3: Secret management — are credentials hardcoded? Are secrets properly externalized?
- B4: Sensitive data exposure — is sensitive information logged or returned in responses?

For each rule, provide:
1. Finding (specific location)
2. Rating: pass / warning / fail
3. Fix recommendation if needed

After completing the checklist, identify any security issues NOT covered by B1-B4 above.
```

## Observed effect

- Better structure than plain checklist prompts (α)
- Helped surface auth-specific issues in tested modules (α)
- Without the final autonomous step, models often stopped too early (α)

## γ 결과 — 도메인 특화 효과 부재 (2026-03-18)

| Response | TP | FP | Precision |
|---|---:|---:|---:|
| gpt-5.4 D-general | 4 | 3 | 0.57 |
| gpt-5.4 D-specific (B1-B4) | 4 | 2 | 0.67 |
| sonnet-4.6 D-general | 2 | 6 | 0.25 |
| sonnet-4.6 D-specific (B1-B4) | 2 | 5 | 0.29 |

**결론**: D-specific이 D-general 대비 추가 TP를 찾지 못했다.
GPT에서 FP가 1개 줄었으나 TP는 동일. Sonnet에서는 차이 없음.

**해석**: Phase α에서 관찰한 D > B 효과는 "B1-B4 도메인 특화 내용" 때문이 아니라
"체크리스트 + 자율탐색" 형식 자체에서 나온 것일 가능성이 높다.
즉, `core.md`의 R1-R4 형식으로도 auth 분석에서 동등한 TP를 얻을 수 있다.

## Failure case

- Checklist-only prompts (without autonomous step) narrow model attention — confirmed in α
- Domain-specific B1-B4 content did **not** outperform general R1-R4 in TP — confirmed in γ
- Some findings depend on framework/deployment context, so TP/FP judgment can still be disputed

## Current claim

이 draft의 **형식** (판정기준 + 자율탐색)은 유효하다 — α에서 확인.
그러나 **B1-B4 도메인 특화 내용**이 범용 R1-R4 대비 추가 가치를 제공한다는 주장은
γ 결과에 의해 **지지되지 않는다**.

실용적 권고: `core.md`의 형식에 보안 도메인 지시를 결합하는 것으로 충분할 수 있다.
B1-B4 특화 내용의 가치는 추가 실험 없이는 확인 불가.
