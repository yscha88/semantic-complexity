# Software Requirements Specification (SRS)
# semantic-complexity v1.0

---

## 1. Introduction

### 1.1 Purpose

This document defines software requirements for **semantic-complexity**, a multi-dimensional code complexity analysis system based on the **Ham Sandwich Theorem (🍞🧀🥓)** and **Sperner's Lemma**.

The system provides:
- **Existence guarantee** of balanced design points (Sperner)
- **Convergence path** to equilibrium (Lyapunov)
- **Practical procedures** for incremental refactoring

### 1.2 Scope

What semantic-complexity is **NOT**:
- A single-number complexity metric
- A global optimization tool
- A replacement for human judgment

What semantic-complexity **IS**:
- A 3-axis labeling system (🍞🧀🥓)
- A local change guidance system
- A PoC → MVP → Production gate condition verifier

### 1.3 Terminology

| Term | Definition |
|------|------------|
| 🍞 Bread (Security) | Structural stability: authentication, encryption, trust boundaries, compliance |
| 🧀 Cheese (Cognitive) | Context density: nesting, state×async×retry, hidden coupling |
| 🥓 Ham (Behavioral) | Maintainability balance: changeability, test coverage, refactoring safety |
| Canonical Profile | Expected 🍞🧀🥓 ratio for each module type |
| Change Budget | Allowed delta per dimension per commit/PR |
| Protected Zone | Files requiring ADR + review for modification |
| Simplex | 2-simplex (triangle) with 🍞🧀🥓 vertices |
| Equilibrium Point | Point where all three axes are meaningfully balanced |

---

## 2. System Overview

### 2.1 Core Theorem: Ham Sandwich (🍞🧀🥓)

```
Maintainability (🥓) only has meaning
between Security structural stability (🍞) and Context density (🧀).

Maximizing any single axis degrades the system.
```

### 2.2 Stability Guarantee: Sperner's Lemma

```
In a properly labeled subdivided simplex,
there exists at least one complete simplex
containing all three labels (🍞🧀🥓).

Engineering interpretation:
With proper local labeling of each axis,
a globally balanced design point necessarily exists.
```

### 2.3 Theory Layer Structure

The system follows an ML pipeline-like processing structure:

```
╔═══════════════════════════════════════════════════════════════════╗
║  INPUT (Feature Extraction)                          [Data Collection] ║
╠═══════════════════════════════════════════════════════════════════╣
║  5D Vector: [C, N, S, A, Λ]                                       ║
║  AST static analysis (deterministic, context-free)                 ║
║  Pattern detection (Trust Boundary, Secret, Test, etc.)            ║
╚═══════════════════════════════════════════════════════════════════╝
                                 │
                                 ▼
┌───────────────────────────────────────────────────────────────────┐
│  PROCESSING (Preprocessing + Parameters)         [Preprocessing]  │
├───────────────────────────────────────────────────────────────────┤
│  L2: Normalization                                                 │
│    - Simplex projection (5D → 3-axis)                             │
│    - Anti-pattern Penalty                                          │
│    - Exclusion filters (self/cls, built-in)                       │
├───────────────────────────────────────────────────────────────────┤
│  L3: Judgment [LLM/Human intervention]                            │
│    - Essential Complexity Waiver                                   │
│    - Module type Context injection                                 │
│    - Essential vs Accidental complexity judgment                   │
└───────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
╔═══════════════════════════════════════════════════════════════════╗
║  OUTPUT (Inference)                                    [Inference] ║
╠═══════════════════════════════════════════════════════════════════╣
║  3-axis scores: [🍞 Bread, 🧀 Cheese, 🥓 Ham]                     ║
║  Gate results (PoC/MVP/Production)                                 ║
║  Refactoring recommendations (-∇E)                                 ║
║  Canonical deviation report                                        ║
╚═══════════════════════════════════════════════════════════════════╝
```

**Core Principle**: INPUT is context-free measurement, PROCESSING injects context, OUTPUT is context-aware.

---

## 3. Functional Requirements

### 3.1 3-Axis Analysis System

#### FR-3.1.1 Security Axis (🍞) Analysis

**Input:** Source code, config files, deployment manifests

**Output:** Security stability score and violations

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.1.1.1 | Trust boundary definition detection | MUST |
| FR-3.1.1.2 | Authentication/authorization flow pattern identification | MUST |
| FR-3.1.1.3 | Secret/credential pattern detection | MUST |
| FR-3.1.1.7 | Sensitive information output detection (print/logger) | MUST |
| FR-3.1.1.8 | AUTH_FLOW explicit declaration recognition | MUST |

#### FR-3.1.2 Cognitive Axis (🧀) Analysis

**Core Definition:**

```
🧀 Cheese = Is it within the range that humans and LLMs can comprehend?
```

**Accessibility Conditions (ALL must be met):**

| Condition | Threshold | Rationale |
|-----------|-----------|-----------|
| Nesting depth | ≤ N (configurable) | Structure visible at a glance |
| Concept count | ≤ 9 per function | Working Memory limit (Miller's Law: 7±2) |
| Hidden dependencies | Minimized | Context completeness |
| state×async×retry | No 2+ coexistence | Cannot reason simultaneously |

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.1.2.1 | Accessibility determination (4 conditions) | MUST |
| FR-3.1.2.2 | state×async×retry coexistence detection | MUST |
| FR-3.1.2.3 | Hidden dependency detection | MUST |
| FR-3.1.2.6 | Exclusion items for concept counting | MUST |
| FR-3.1.2.7 | Anti-pattern penalty application | MUST |

#### FR-3.1.3 Behavioral Axis (🥓) Analysis

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.1.3.1 | Golden test existence detection for critical paths | MUST |
| FR-3.1.3.2 | Contract test existence detection for APIs | MUST |
| FR-3.1.3.7 | Test file auto-discovery | MUST |
| FR-3.1.3.8 | Critical path pattern detection | MUST |

### 3.2 Module Type Classification

| Type | Description | Default 🍞🧀🥓 Ratio |
|------|-------------|---------------------|
| `deploy` | K8s, Helm, ArgoCD, secrets, network policy | 70 / 10 / 20 |
| `api-external` | Customer/3rd-party facing, contract bound | 50 / 20 / 30 |
| `api-internal` | Inter-service communication, internal stability | 30 / 30 / 40 |
| `app` | Workflows, orchestration, state machines | 20 / 50 / 30 |
| `lib-domain` | Pure domain logic, rules, validation | 10 / 30 / 60 |
| `lib-infra` | Common clients, middleware, utilities | 20 / 30 / 50 |

### 3.3 Gate System (3-Stage)

| Stage | Strictness | Waiver | Purpose |
|-------|------------|--------|---------|
| **PoC** | Loose | ❌ | Quick validation, OK if it runs |
| **MVP** | Tight | ❌ | First release, enforce proper design |
| **Production** | Strict | ✅ | Operations, allow proven tech debt |

**Threshold Comparison:**

| Condition | PoC | MVP | Production |
|-----------|-----|-----|------------|
| nesting_max | 6 | 4 | 3 |
| concepts_per_function | 12 | 9 | 7 |
| test_coverage | 50% | 80% | 95% |

---

## 4. Interface Requirements

### 4.1 CLI Interface

```bash
# Analyze with 🍞🧀🥓 output
semantic-complexity analyze ./src --format sandwich

# MVP gate check
semantic-complexity gate mvp ./src

# PR budget check
semantic-complexity budget ./src --base main --head feature
```

### 4.2 MCP (Model Context Protocol) Interface

```typescript
// Tools
- analyze_sandwich(source, file_path?)
- analyze_cheese(source)
- check_gate(source, gate_type?, file_path?, project_root?)
- check_budget(before_source, after_source, module_type?)
- get_label(source)
- suggest_refactor(source, module_type?)
- check_degradation(before_source, after_source)

// Resources
- docs://usage-guide      // Usage guide (3-axis model, tool scenarios)
- docs://theory           // Theoretical foundation
- docs://srs              // Software requirements
- docs://sds              // Software design
```

#### 4.2.1 MCP Resource Requirements

**REQ-MCP-RES-001**: LLMs must be able to understand usage after MCP server installation.

| Resource | Content | Required |
|----------|---------|----------|
| `docs://usage-guide` | 3-axis model, tool scenarios, cognitive complexity definition | ✅ |
| `docs://theory` | Theoretical foundation | Optional |
| `docs://srs` | Requirements specification | Optional |
| `docs://sds` | Design specification | Optional |

**REQ-MCP-RES-002**: All language implementations must provide the same resources.

---

## 5. Non-functional Requirements

### 5.1 Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-4.1.1 | Single file analysis | < 100ms |
| NFR-4.1.2 | Full project analysis (1000 files) | < 30s |
| NFR-4.1.3 | PR delta analysis | < 5s |

### 5.2 Language Support

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-4.4.1 | TypeScript/JavaScript | MUST |
| NFR-4.4.2 | Python | MUST |
| NFR-4.4.3 | Go | MUST |

---

## References

- [THEORY.md](./THEORY.md) - Theoretical foundation
- [SDS.md](./SDS.md) - Software design specification
- [SRS.ko.md](./SRS.ko.md) - Korean version (detailed)

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-24 | semantic-complexity team | Initial SRS |
| 1.1 | 2026-01-03 | semantic-complexity team | English translation |
