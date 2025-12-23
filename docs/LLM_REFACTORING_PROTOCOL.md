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

## 5. Failure Handling

- Gate failure → LLM output discarded
- Retries allowed only with **reduced task scope**

---

## 6. Summary

> An LLM is not a judge.  
> It is a tool that performs **invariant-preserving transformations only**.
