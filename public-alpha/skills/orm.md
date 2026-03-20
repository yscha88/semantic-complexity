# ORM skill draft (alpha)

## Status

Experimental alpha.

This draft has the strongest evidence for domain-specific benefit in the current set.

## Validation scope

- Primary evidence: SQLAlchemy evaluator experiment
- Models: `gpt-5.4`, `claude-sonnet-4-6`
- Compared against: general R1-R4 prompt

## Prompt draft

```text
Analyze the following code for any issues — security, quality, correctness, or design concerns.
Rate each finding by severity.

Use the following checklist:
- ORM1: SQL injection — can user values reach raw SQL through the evaluator?
- ORM2: Expression evaluation safety — can malicious expressions cause code execution, infinite loops, or memory exhaustion?
- ORM3: Type coercion — are comparisons correct for NULL, dates, enums, JSON, and other SQL types?
- ORM4: Operator completeness — what happens with unsupported operators?
- ORM5: State consistency — does the evaluator handle detached/expired/pending ORM objects correctly?

For each rule, provide:
1. Finding (specific location)
2. Rating: pass / warning / fail
3. Fix recommendation if needed

After completing the checklist, identify any issues NOT covered above.
```

## Observed effect

In the tested SQLAlchemy evaluator module, the ORM-specific version outperformed the general version by:

- +2 true positives
- substantially better precision

The additional findings were tied to ORM-specific semantics, not generic secure-coding advice.

## Why this matters

This is the clearest current evidence that:

- a general SKILL can provide baseline value
- a domain-specific SKILL can add meaningful extra coverage

## Current claim

This draft is the best current candidate for a publishable example of a domain-specific SKILL, but it is still alpha.

## Failure case

It improved results on ORM/expression-evaluation code, but that does **not** imply transfer to every database or ORM codebase.
