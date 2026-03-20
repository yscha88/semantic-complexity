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

### Auth/security

- limited repo/model set
- effect observed, but not universal

### Filesystem

- domain-specific prompt beat general prompt in at least one tested module

### ORM

- domain-specific prompt beat general prompt in at least one tested module

## Failed or weakened claims

- checklist-only SKILLs can narrow model attention too aggressively
- general SKILLs do not dominate in every domain
- domain-specific SKILLs are not always better (example: crypto/Fernet case showed no gain)

## Current confidence

| item | confidence |
|---|---|
| SAR bug patterns exist | high |
| good SKILL format exists | medium |
| domain-specific SKILLs can help | medium |
| these specific drafts are broadly production-ready | low |
