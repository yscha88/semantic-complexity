# Theoretical Foundations

[한국어](./THEORY.ko.md) | English

This document establishes the mathematical and engineering foundations for semantic-complexity as a **stability verification system**, not merely a metrics tool.

---

## Core Thesis

> Code complexity analysis is not an optimization problem.
> It is a **stability verification problem** with defined invariants.

The system guarantees that code changes flow toward stable regions (canonical profiles), with violations automatically detected and rejected.

---

## 1. Stability Invariants (🍞🧀🥓)

The system's stability decomposes into three orthogonal axes:

| Axis | Metaphor | Meaning | Verification |
|------|----------|---------|--------------|
| 🍞 **Security** | Structural Stability | Trust boundaries, auth, crypto, deployment | Policy-as-code, SBOM, signatures |
| 🧀 **Cognitive** | Context Density | Human/LLM comprehensible structure | Tensor score, canonical deviation |
| 🥓 **Behavioral** | Behavior Preservation | Semantics unchanged after refactoring | Golden tests, contract tests |

**Key constraint**: `state × async × retry` must never coexist in the same function/module.

> 📄 Full specification: [docs/STABILITY_INVARIANTS.md](./docs/STABILITY_INVARIANTS.md)

---

## 2. LLM Refactoring Protocol

LLM is treated as a **constrained transformer**, not a free generator.

### Allowed Operations

| ✅ Allowed | ❌ Forbidden |
|-----------|-------------|
| Function extraction | Auth/authz logic changes |
| Naming improvements | Trust boundary modifications |
| Adapter separation | Security policy changes |
| Nesting flattening | External API contract changes |
| Test reinforcement | Release metadata changes |

### Gate Conditions

Every LLM-generated change must pass:

```
🧀 Cognitive Gate: ΔComplexity ≤ budget, no state×async×retry
🥓 Behavioral Gate: All golden/contract tests pass
🍞 Security Gate: No policy violations, no secret exposure
```

**Failure rule**: Gate failure → discard result, retry only with reduced scope.

> 📄 Full specification: [docs/LLM_REFACTORING_PROTOCOL.md](./docs/LLM_REFACTORING_PROTOCOL.md)

---

## 3. Release Evidence Theory

This is an **engineering proof**, not a mathematical proof.

### Definitions

| Term | Definition |
|------|------------|
| **ReleaseID** | Authorized Git commit hash prefix |
| **Canonical Artifact** | Deterministically generated output from ReleaseID |
| **Invariant** | Condition that, if violated, blocks release |

### Engineering Claim

> All release specs automatically verify defined invariants (🍞🧀🥓).
> Violated states cannot be deployed to production.

This claims **stability guarantee**, not optimality.

### Evidence Chain

Every release generates:

```
CommitHash / ReleaseID
Image Digest
SBOM Digest
Tensor Score / RawSum / Canonical Deviation
Gate pass/fail results
Approval records
```

This evidence bundle is **reproducible** and **interpreter-independent**.

> 📄 Full specification: [docs/RELEASE_EVIDENCE_THEORY.md](./docs/RELEASE_EVIDENCE_THEORY.md)

---

## 4. Mathematical Framework

### Lyapunov Stability Interpretation

The 5D complexity space admits a Lyapunov stability interpretation:

```
Energy function:  E(v) = vᵀMv + ⟨v,w⟩
Stable point:     ∂E/∂v = 0  (canonical centroid)
Stability:        M ≥ 0      (positive semidefinite)
```

Where:
- `v = [Control, Nesting, State, Async, Coupling] ∈ ℝ⁵`
- `M` = Module-type interaction matrix
- `w` = Weight vector

### Convergence Guarantee

Since `M` is positive semidefinite for all module types:
1. The energy function has a global minimum at the canonical centroid
2. Any refactoring that reduces E(v) moves toward stability
3. The `suggest_refactor` tool provides gradient descent directions

This provides a **mathematical guarantee** that following recommendations leads to stable, minimal-complexity code.

---

## 5. Scope & Boundaries

**semantic-complexity** is a **static analysis signal provider**, not a complete enforcement system.

| Responsibility | semantic-complexity | CI/CD Pipeline |
|----------------|---------------------|----------------|
| Tensor score calculation | ✅ | - |
| Canonical deviation analysis | ✅ | - |
| Cognitive invariant detection (state×async×retry) | ✅ | - |
| Secret pattern detection | ✅ | - |
| LLM locked zone warning | ✅ | - |
| Refactoring suggestions | ✅ | - |
| Gate logic (pass/warn/fail decision) | ✅ | - |
| Gate pipeline (dev → qa → ra) | ✅ | - |
| Delta analysis (baseline vs current) | ✅ | - |
| **Actual blocking/enforcement** | - | ✅ |
| SBOM generation/signing | - | ✅ |
| Test execution (golden/contract) | - | ✅ |
| Deployment blocking | - | ✅ |

### What We Provide (per Gate)

> Gate conditions defined in [docs/LLM_REFACTORING_PROTOCOL.md](./docs/LLM_REFACTORING_PROTOCOL.md#4-gate-conditions)

| Gate | semantic-complexity Provides | CI/CD Provides |
|------|------------------------------|----------------|
| 🧀 **Cognitive** | `checkCognitiveInvariant()`, tensor/rawSum tracking | Budget enforcement, blocking |
| 🥓 **Behavioral** | `suggest_refactor` (behavior-preserving) | Test execution, reduction check |
| 🍞 **Security** | `detectSecrets()`, `checkLockedZone()` | Full security scan, policy enforcement |

### What We Do NOT Provide

- **Enforcement/Blocking**: We detect and signal, CI/CD enforces
- **Test execution**: We suggest, testing frameworks execute golden/contract tests
- **Security scanning**: We detect patterns, dedicated security tools do full scans
- **SBOM/Signing**: We analyze code, security tooling handles artifacts

---

## 6. Implementation Mapping

| Theory | Implementation | Notes |
|--------|----------------|-------|
| 🧀 Cognitive Invariants | `checkCognitiveInvariant()` | state×async×retry detection |
| 🧀 Cognitive Score | `tensor.score`, `canonical.deviation` | Static analysis |
| 🍞 Security Signals | `detectSecrets()`, `checkLockedZone()` | Warning only |
| 🥓 Behavioral Gate | `suggest_refactor` | Behavior-preserving recommendations |
| Gate Logic | `checkGate()`, `runGatePipeline()` | pass/warn/fail decision |
| Delta Analysis | `analyzeDelta()`, `detectViolations()` | baseline vs current |
| Lyapunov Energy | `calculateTensorScore()` | Mathematical framework |
| Canonical Centroid | `CANONICAL_5D_PROFILES[moduleType]` | Target profiles |
| Gradient Descent | `recommendRefactoring()` | Direction suggestions |

---

## 7. Limitations

1. This theory does **not** claim a unique optimal solution
2. Invariants may be updated as environments/domains change
3. Stability is the result of **structure + process**, not code alone
4. The system verifies constraints, it does not guarantee correctness

---

## References

- [STABILITY_INVARIANTS.md](./docs/STABILITY_INVARIANTS.md) - Full invariant specifications
- [LLM_REFACTORING_PROTOCOL.md](./docs/LLM_REFACTORING_PROTOCOL.md) - LLM operation rules
- [RELEASE_EVIDENCE_THEORY.md](./docs/RELEASE_EVIDENCE_THEORY.md) - Evidence framework
