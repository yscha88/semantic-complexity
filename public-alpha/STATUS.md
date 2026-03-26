# validation status

## Verified

### 1. SAR compound anti-patterns

- 9 patterns
- verified by unit tests
- file: `docs/verified/COMPOUND_ANTI_PATTERNS.md`

### 2. SKILL format effect (limited)

Within limited experiments, the following pattern repeatedly helped:

```text
decision criteria
+ explicit output format
+ autonomous follow-up search
```

## Limited evidence only

### SKILL format effect (D format: checklist + autonomous step)

- Phase α: D > B +33% TP on auth code (3 repos, 2 models) — format effect confirmed
- Phase β: D > B in 4/12, D precision > B in 8/12 — **format effect persists, weaker than α**
- Interpretation: format (not domain-specific content) is the primary driver of the effect

### ORM

- Phase γ: D-specific precision 0.33→0.67 (gpt-5.4), +2 TP — **strongest domain-specific evidence**
- Phase γ cost-tier: gpt-5.4-mini D-specific 4 TP (precision 0.50) vs general 1 TP (0.14)
- Sonnet also showed gain (+1 TP)
- Evidence: domain-specific content adds value for ORM/expression-evaluation code

### Filesystem

- Phase γ: D-specific +1 TP, precision 0.29→0.50 — **GPT only**, Sonnet showed no gain
- Phase γ cost-tier: gpt-5.4-mini D-specific precision 0.07→0.43, gpt-5.4-nano similar
- Caveat: effect is GPT-family specific; Sonnet effect unconfirmed

## Failed or weakened claims

- Checklist-only SKILLs narrow model attention — confirmed (α)
- General SKILLs do not dominate in every domain — confirmed (β)
- **Auth B1-B4 domain-specific content does NOT outperform general R1-R4 in TP** — confirmed (γ)
- Crypto/Fernet: both general and specific SKILL failed (TP=0) — SKILL has no effect here
- Domain-specific SKILLs are not universally better — confirmed (auth, crypto)

## Current confidence

| item | confidence | 근거 |
|---|---|---|
| SAR bug patterns exist | high | unit test 18/18 |
| SKILL **format** effect (checklist + autonomous) | medium | α 3 repos, β 8/12 precision |
| ORM domain-specific SKILL adds TP | medium | γ gpt+sonnet 모두 |
| Filesystem domain-specific SKILL adds TP | low | γ GPT에서만, Sonnet 미확인 |
| Auth B1-B4 content adds value over general | **none** | γ에서 부정됨 |
| **🧀 Cheese SKILL (B vs D)** | **medium** | **5레포 4/5(80%) D>B — CC 등급 정확도, 추가 발견 3-4개. h2(B급) 예외** |
| **🥓 Ham SKILL (B vs D)** | **medium** | **5레포 5/5(100%) D>B — critical path +1-3개, 추가 발견 3-4개** |
| these specific drafts are broadly production-ready | low | β/γ에서만 제한적 계시 |

## 실험 이력 (2026-03-26 갱신)

| Phase | 실험 | 레포/모델 | 핵심 발견 |
|-------|------|-----------|----------|
| α | D vs B (보안 코드) | 3레포, 2모델 | D > B +33% TP, 자율탐색 필수 |
| β | D vs B (다양한 코드) | 12레포, 2모델 | D > B 4/12 TP, 8/12 precision |
| γ | D-general vs D-specific | 4도메인, 2모델 | ORM↑, filesystem(GPT만)↑, auth 동등, crypto 실패 |
| cost-tier | 소형모델 D-specific | 3도메인, mini/nano/flash | ORM/filesystem: mini 유효, nano 유사 |
| **🧀 Cheese B vs D** | **🧀 CC 품질 분석** | **5레포, 2모델(sonnet/opus)** | **D>B 4/5(80%) — h2(B급)만 동등. CC 등급 정확도, C1-C4 구조화, 추가 발견 3-4개** |
| **🥓 Ham B vs D** | **🥓 행동 보존 분석** | **5레포, 2모델(sonnet/opus)** | **D>B 5/5(100%) — H1-H4 구조화, critical path +1-3개, 추가 발견 3-4개** |
