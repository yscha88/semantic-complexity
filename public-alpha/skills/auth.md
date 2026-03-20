# auth skill draft (alpha)

## Status

Experimental alpha.

Supported only by limited experiments on authentication-oriented Python modules.

## Validation scope

- Strongest evidence: `fastapi-realworld`, `BlackSheep`, `icloud-photos-downloader`
- Models: `gpt-5.4`, `claude-sonnet-4-6`
- Compared against: plain checklist prompts and less structured prompts

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

- better structure than plain checklist prompts
- helped surface auth-specific issues in tested modules
- without the final autonomous step, models often stopped too early

## Failure case

Checklist-only auth prompts tended to miss issues outside the named checklist and showed attention narrowing.

Also, some findings in auth code depend on framework or deployment context, so TP/FP judgment can still be disputed.

## Current claim

This draft is a **candidate** auth review skill, not a validated production standard.
