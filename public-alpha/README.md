# semantic-complexity public alpha

This folder contains **experimental alpha** SKILL drafts derived from limited internal experiments.

## What is actually supported

- Verified in this repository:
  - 9 SAR (state × async × retry) compound anti-patterns reproduce real bugs in unit tests (`18/18 pass`)
- Observed in constrained experiments:
  - SKILLs with **explicit decision criteria + autonomous follow-up** outperform plain checklists in some settings
  - Domain-specific SKILLs can outperform general SKILLs in some domains (filesystem, ORM)

## What is NOT supported

- These drafts are **not** general-purpose production-ready skills
- They are **not** validated across all languages, domains, or model families
- They do **not** prove that code quality is "3 axes"

## Included drafts

- `skills/core.md` — minimal SKILL template that survived Phase α
- `skills/auth.md` — auth/security draft
- `skills/filesystem.md` — filesystem/path-handling draft
- `skills/orm.md` — ORM/expression-evaluation draft
- `STATUS.md` — what is validated vs unvalidated
- `SCOPE.md` — what this public alpha does and does not claim

## Design principle that survived experiments

Bad pattern:

1. checklist only
2. model marks checklist done
3. model stops searching

Better pattern:

1. explicit decision criteria
2. structured output
3. **after the checklist, continue with free-form search for issues not covered above**

## Use with caution

Treat these as:

- reproducible research artifacts
- prompt engineering drafts
- candidates for further ablation testing

Not as:

- security guarantees
- complete review standards
- validated universal best practices
