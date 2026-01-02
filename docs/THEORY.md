# Theoretical Foundation

This document establishes the mathematical and engineering foundation for **semantic-complexity** as a **stability verification system**, not just a metric tool.

---

## 0. Algebraic Foundation: From McCabe to Multi-dimensional

### 0.1 Problem Recognition: McCabe's Limitations

McCabe Cyclomatic Complexity is defined for Control Flow Graphs (CFG):

```
V(G) = E − N + 2P
```

Where:
- `E` = number of edges
- `N` = number of nodes
- `P` = number of connected components

This is isomorphic to the **first Betti number**:

```
McCabe Complexity = dim H₁(G) + 1
```

It measures "the number of independent cycles."

### 0.2 Perspective Shift: Homology Interpretation

Extending CFG as a **simplicial complex** or **CW complex**:

| Homology | Meaning | Software Interpretation |
|----------|---------|------------------------|
| H₀ | Connected components | Module/package separation |
| H₁ | 1D holes (cycles) | Conditional branches, loops |
| H₂+ | Higher-dimensional holes | State space + control flow structure |

**Key Insight**: Cyclomatic complexity only sees H₁ - a **very low-dimensional invariant**.

### 0.3 Solution: Multi-dimensional Complexity

Actual "dimensions" in software:

| Dimension | Example | Measured by McCabe? |
|-----------|---------|---------------------|
| **Control** | if / for / while | ✅ (H₁ level) |
| **State** | State machines, enums, flags | ❌ |
| **Data** | Input combinations, type complexity | ❌ |
| **Time** | Async, concurrency | ❌ |
| **Space** | Distributed nodes, microservices | ❌ |

McCabe measures **only 1D of control dimension**.

### 0.4 Ham Sandwich Integration

Multi-dimensional complexity is **renormalized** into 🍞🧀🥓 3-axis:

```
Control + Nesting + Hidden Coupling → 🧀 Cognitive (context density)
State + Async + Time               → 🍞 Security (structural stability) partial
Test + Changeability               → 🥓 Behavioral (behavior preservation)
```

This projects high-dimensional complexity onto a **3D simplex**:
- Sperner's Lemma guarantees equilibrium existence
- Lyapunov function provides convergence path
- Converts to practical gate conditions

---

## 1. Stability Invariants (🍞🧀🥓)

System stability decomposes into three orthogonal axes:

| Axis | Metaphor | Meaning | Verification |
|------|----------|---------|--------------|
| 🍞 **Security** | Structural stability | Trust boundaries, auth, crypto, deployment | Policy-as-code, SBOM, signatures |
| 🧀 **Cognitive** | Context density | Human/LLM comprehensible range | Accessibility conditions |
| 🥓 **Behavioral** | Behavior preservation | Semantic preservation after refactoring | Golden test, contract test |

### 🧀 Accessibility Conditions

Code is accessible when **ALL** of these are met:

| Condition | Threshold | Rationale |
|-----------|-----------|-----------|
| Nesting depth | ≤ N (configurable) | Structure visible at a glance |
| Concept count | ≤ 9 per function | Working Memory limit (Miller's Law: 7±2) |
| Hidden dependencies | Minimized | Context completeness |
| state×async×retry | No 2+ coexistence | Cannot reason simultaneously |

**Core Constraint**: `state × async × retry` cannot coexist in the same function/module.

### Quality Attribute Mapping (ISO/IEC 25010 SQuaRE)

| 🍞🧀🥓 Axis | ISO/IEC 25010 Quality | Coverage |
|-------------|----------------------|----------|
| **🍞 Bread (Security)** | Security, Reliability | Direct |
| **🧀 Cheese (Cognitive)** | Maintainability, Usability | Direct |
| **🥓 Ham (Behavioral)** | Functional Suitability, Reliability | Direct |

---

## 2. LLM Refactoring Protocol

LLMs are treated as **constrained transformers**, not free generators.

### Allowed Operations

| ✅ Allowed | ❌ Forbidden |
|-----------|--------------|
| Function extraction | Auth/authz logic changes |
| Naming improvements | Trust boundary movement |
| Adapter separation | Security policy modification |
| Nesting flattening | External API contract changes |
| Test strengthening | Release metadata changes |

### Gate Conditions

All LLM-generated changes must pass:

```
🧀 Cognitive Gate: Δcomplexity ≤ budget, no state×async×retry
🥓 Behavioral Gate: All golden/contract tests pass
🍞 Security Gate: No policy violations, no secret exposure
```

**Failure Rule**: Gate failure → discard result, retry only with reduced scope.

---

## 3. Mathematical Framework

### Lyapunov Stability Analysis

🍞🧀🥓 3-axis simplex space admits Lyapunov stability analysis:

```
Energy function:  E(v) = ||v - c||²
Stable point:     c = canonical centroid (expected ratio per module type)
Stability:        E(v) → 0 means stable
```

Where:
- `v = [🍞, 🧀, 🥓] ∈ simplex` (current ratio)
- `c = [🍞ₒ, 🧀ₒ, 🥓ₒ]` (canonical ratio)
- `🍞 + 🧀 + 🥓 = 100` (simplex constraint)

### Convergence Guarantee

1. Energy function E(v) has minimum 0 at canonical centroid c
2. Any refactoring that decreases E(v) moves toward stability
3. `suggest_refactor` provides -∇E direction (gradient descent)

This provides **mathematical guarantee** that following recommendations converges to balanced state for the module type.

---

## 4. Scope and Boundaries

**semantic-complexity** is a **static analysis signal provider**, not a complete enforcement system.

| Responsibility | semantic-complexity | CI/CD Pipeline |
|----------------|---------------------|----------------|
| Tensor score calculation | ✅ | - |
| Canonical deviation analysis | ✅ | - |
| Cognitive invariant detection (state×async×retry) | ✅ | - |
| Secret pattern detection | ✅ | - |
| LLM forbidden zone warnings | ✅ | - |
| Refactoring suggestions | ✅ | - |
| Gate logic (pass/warn/fail decision) | ✅ | - |
| **Actual blocking/enforcement** | - | ✅ |
| SBOM generation/signing | - | ✅ |
| Test execution (golden/contract) | - | ✅ |
| Deployment blocking | - | ✅ |

---

## 5. Limitations

1. This theory does not claim a **unique optimal solution**
2. Invariants may be updated with environment/domain changes
3. Stability is a result of **structure + process**, not code alone
4. The system verifies constraints, not correctness

---

## References

- [THEORY.ko.md](./THEORY.ko.md) - Korean version (detailed)
- [SRS.md](./SRS.md) - Software Requirements Specification
- [SDS.md](./SDS.md) - Software Design Specification
