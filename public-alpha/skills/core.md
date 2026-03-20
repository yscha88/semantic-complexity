# core skill template (alpha)

## Purpose

Use this when you want a model to do more than free-form commentary, but you do **not** yet have a strong domain-specific prompt.

## Template

```text
Analyze the following code for any issues — security, quality, correctness, or design concerns.
Rate each finding by severity.

Use the following checklist:
- R1: Input validation — is every external input validated before use?
- R2: Error handling — are all error paths handled? Can errors leak sensitive info?
- R3: Resource management — are resources properly acquired and released?
- R4: Design correctness — does the logic handle all edge cases?

For each rule, provide:
1. Finding (specific location)
2. Rating: pass / warning / fail
3. Fix recommendation if needed

After completing the checklist, identify any issues NOT covered above.
```

## Why this shape

Phase α found that:

- checklist-only prompts often create premature completion
- adding the final free-form search restores missed findings

## Validation scope

- useful as a fallback template
- not shown to outperform domain-specific skills in domains where specialization matters

## Limitations

- too generic for some domains
- may miss domain-specific risks unless specialized further
- should be treated as a fallback template, not a final skill
