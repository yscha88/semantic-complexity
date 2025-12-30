# LLM_REFACTORING_PROTOCOL.md

## LLM-Guided Refactoring Protocol
### Allowed Scope · Locked Zones · Gate Conditions

---

## 1. Purpose

This document defines how LLMs are used as **constrained transformers**,  
not autonomous decision-makers.

LLMs operate strictly within predefined safety and stability boundaries.

---

## 2. Allowed Task Units

LLMs may perform only the following transformations:

### Allowed
- Function extraction and decomposition
- Naming improvements
- Adapter separation
- Nesting flattening
- Test augmentation for behavior preservation

### Prohibited
- Authentication or authorization logic changes
- Trust boundary modification
- Deployment or security policy changes
- External API contract modification
- Digest, tag, or artifact reference changes
- **`__essential_complexity__` 추가/수정** (complexity waiver는 사람만)
- **ADR 파일 생성/수정** (복잡도 면제 문서는 사람만)

---

## 3. Locked Zones (No LLM Access)

The following areas are strictly off-limits:

- Cryptography, authentication, patient-data handling
- RBAC, NetworkPolicy, TLS configuration in deploy repositories
- Release approval metadata

Changes require **human approval + ADR-lite**.

---

## 4. Gate Conditions

All LLM-generated changes must pass **all** gates.

### 🧀 Cognitive Gate
- Cognitive Complexity Δ ≤ allowed budget
- No state × async × retry co-location

### 🥓 Behavioral Gate
- All golden and contract tests pass
- No test reduction

### 🍞 Security Gate
- No security scan regression
- No policy violations

---

## 5. Anti-Patterns (Prohibited Refactoring Tricks)

LLMs must **NOT** use the following shortcuts to reduce complexity metrics without actually reducing cognitive load:

### 🚫 Parameter Bundling Anti-Patterns

| Anti-Pattern | Example | Why Prohibited |
|--------------|---------|----------------|
| **`*args` / `**kwargs` wrapping** | `def process(*args, **kwargs)` | Hides actual parameter count, reduces type safety |
| **Config object bundling** | `def process(config: Config)` where Config has 10+ fields | Moves complexity to Config class, doesn't reduce it |
| **Tuple/Dict parameter packing** | `def process(params: tuple)` | Obscures parameter semantics |
| **Dataclass escape hatch** | Creating a dataclass just to bundle unrelated parameters | Artificial grouping without semantic cohesion |

### 🚫 Concept Count Evasion

| Anti-Pattern | Example | Why Prohibited |
|--------------|---------|----------------|
| **Inline everything** | Replacing named variables with inline expressions | Reduces concept count but hurts readability |
| **Magic constants** | `if x > 42` instead of `if x > MAX_RETRIES` | Fewer names but less understandable |
| **Single-letter variables** | `def f(a, b, c, d)` | Technically fewer "concepts" but unreadable |

### 🚫 Complexity Waiver Evasion

| Anti-Pattern | Example | Why Prohibited |
|--------------|---------|----------------|
| **ADR 자동 생성** | Gate 실패 시 ADR 작성으로 회피 | 복잡도 면제는 사람의 판단 영역 |
| **`__essential_complexity__` 수정** | waiver 설정 추가/변경 | 리팩토링 대신 면제로 도망 금지 |

### ✅ Valid Refactoring Approaches

| Approach | Description |
|----------|-------------|
| **Extract cohesive function** | Group related logic into a function with clear responsibility |
| **Early return** | Flatten nesting with guard clauses |
| **Separate concerns** | Split state, async, retry into distinct functions |
| **Domain modeling** | Create meaningful domain objects (not just parameter bags) |

### Detection

The analyzer applies **penalty scoring** to detect anti-patterns:
- `*args` / `**kwargs` usage: +3 concept penalty each
- Config object with 5+ fields: +field_count penalty
- Functions with only bundled parameters: warning flag

---

## 6. Failure Handling

- Gate failure → LLM output discarded
- Retries allowed only with **reduced task scope**

---

## 7. Summary

> An LLM is not a judge.
> It is a tool that performs **invariant-preserving transformations only**.
>
> Metric evasion is not refactoring—it is obfuscation.
