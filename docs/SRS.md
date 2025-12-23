# Software Requirements Specification (SRS)
# semantic-complexity v1.0

[한국어](./SRS.ko.md) | English

---

## 1. Introduction

### 1.1 Purpose

This document defines the software requirements for **semantic-complexity**, a multi-dimensional code complexity analysis system based on the **Ham Sandwich Theorem (🍞🧀🥓)** and **Sperner's Lemma**.

The system provides:
- **Existence guarantee** of balanced design points (Sperner)
- **Convergence path** to equilibrium (Lyapunov)
- **Practical procedure** for incremental refactoring

### 1.2 Scope

semantic-complexity is NOT:
- A single-number complexity metric
- A global optimization tool
- A replacement for human judgment

semantic-complexity IS:
- A 3-axis labeling system (🍞🧀🥓)
- A local change guidance system
- A gate condition verifier for PoC → MVP → Production

### 1.3 Definitions

| Term | Definition |
|------|------------|
| 🍞 Bread (Security) | Structural stability: auth, crypto, trust boundaries, compliance |
| 🧀 Cheese (Cognitive) | Context density: nesting, state×async×retry, hidden coupling |
| 🥓 Ham (Behavioral) | Maintainability equilibrium: changeability, test coverage, refactor safety |
| Canonical Profile | Expected 🍞🧀🥓 ratio for each module type |
| Change Budget | Allowed delta per commit/PR for each dimension |
| Protected Zone | Files requiring ADR + review for any modification |
| Simplex | 2-simplex (triangle) spanned by 🍞🧀🥓 vertices |
| Equilibrium Point | A point where all three axes are meaningfully balanced |

### 1.4 References

- McCabe, T. (1976). A Complexity Measure
- Huntsman, S. (2020). Generalizing cyclomatic complexity via path homology
- SonarSource (2017). Cognitive Complexity
- Muñoz Barón et al. (2020). Empirical Validation of Cognitive Complexity
- Ham Sandwich Theorem (Borsuk-Ulam)
- Sperner's Lemma

---

## 2. System Overview

### 2.1 Core Theorem: Ham Sandwich (🍞🧀🥓)

```
Maintainability (🥓) exists meaningfully only between
Security structure (🍞) and Context density (🧀).

Neither can be maximized alone without system degradation.
```

### 2.2 Stability Guarantee: Sperner's Lemma

```
Given a triangulated simplex with proper boundary labeling,
there NECESSARILY EXISTS at least one complete simplex
containing all three labels (🍞🧀🥓).

Engineering interpretation:
If we control each axis locally with proper labeling,
a globally balanced design point is GUARANTEED to exist.
```

### 2.3 Convergence: Lyapunov Stability

```
Energy function: E(v) = vᵀMv + ⟨v,w⟩
Stable point:    ∂E/∂v = 0 (canonical centroid)
Stability:       M ≥ 0 (positive semidefinite)

Any refactoring that reduces E(v) moves toward stability.
```

### 2.4 Architecture Diagram

```
                    ┌─────────────────────────────────────┐
                    │         semantic-complexity          │
                    └─────────────────────────────────────┘
                                     │
            ┌────────────────────────┼────────────────────────┐
            │                        │                        │
            ▼                        ▼                        ▼
    ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
    │   🍞 Security  │       │  🧀 Cognitive  │       │ 🥓 Behavioral  │
    │    Analyzer    │       │    Analyzer    │       │   Analyzer    │
    └───────────────┘       └───────────────┘       └───────────────┘
            │                        │                        │
            └────────────────────────┼────────────────────────┘
                                     │
                                     ▼
                    ┌─────────────────────────────────────┐
                    │        Simplex Coordinator          │
                    │   (Labeling + Equilibrium Search)   │
                    └─────────────────────────────────────┘
                                     │
            ┌────────────────────────┼────────────────────────┐
            │                        │                        │
            ▼                        ▼                        ▼
    ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
    │  Gate System  │       │ Change Budget │       │  Recommender  │
    │  (PoC→MVP)    │       │    Tracker    │       │   (Gradient)  │
    └───────────────┘       └───────────────┘       └───────────────┘
```

---

## 3. Functional Requirements

### 3.1 Three-Axis Analysis System

#### FR-3.1.1 Security Axis (🍞) Analysis

**Input:** Source code, configuration files, deployment manifests

**Output:** Security stability score and violations

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.1.1.1 | Detect trust boundary definitions | MUST |
| FR-3.1.1.2 | Identify auth/authz flow patterns | MUST |
| FR-3.1.1.3 | Detect secret/credential patterns | MUST |
| FR-3.1.1.4 | Identify crypto usage patterns | SHOULD |
| FR-3.1.1.5 | Calculate blast radius for security changes | SHOULD |
| FR-3.1.1.6 | Detect compliance-sensitive code regions | MAY |

**Metrics:**
- Trust boundary count
- Auth layer explicitness score
- Secret lifecycle automation score
- Security change blast radius

#### FR-3.1.2 Cognitive Axis (🧀) Analysis

**Input:** Source code AST

**Output:** Context density score and hotspots

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.1.2.1 | Calculate Cognitive Complexity (SonarSource method) | MUST |
| FR-3.1.2.2 | Detect state×async×retry co-location | MUST |
| FR-3.1.2.3 | Count hidden dependencies (implicit I/O, globals) | MUST |
| FR-3.1.2.4 | Measure nesting with depth penalty (not count) | MUST |
| FR-3.1.2.5 | Detect concept count per function (> 5 = warning) | SHOULD |
| FR-3.1.2.6 | Calculate Persistent Homology (structure survival) | MAY |

**Metrics:**
- Cognitive Complexity score
- State×Async×Retry violation flag
- Hidden dependency count
- Nesting depth penalty (Σdepth, not count)
- Concept density score

**Critical Change from Current Implementation:**

```
CURRENT (McCabe):
  switch with 10 cases → control += 10

REQUIRED (Cognitive):
  switch with 10 cases → control += 1 (single branching structure)
  nested if 3 levels   → control += 1 + 2 + 3 = 6 (depth penalty)
```

#### FR-3.1.3 Behavioral Axis (🥓) Analysis

**Input:** Source code, test files, git history

**Output:** Maintainability equilibrium score

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.1.3.1 | Detect golden test existence for critical paths | MUST |
| FR-3.1.3.2 | Detect contract test existence for APIs | MUST |
| FR-3.1.3.3 | Calculate test coverage for critical paths | SHOULD |
| FR-3.1.3.4 | Analyze change lead time from git history | MAY |
| FR-3.1.3.5 | Analyze defect injection rate | MAY |
| FR-3.1.3.6 | Detect PR size patterns | MAY |

**Metrics:**
- Golden test coverage ratio
- Contract test existence flag
- Critical path protection ratio
- Change lead time (from git)
- Defect injection rate (from git)

### 3.2 Module Type Classification

#### FR-3.2.1 Primary Module Types

| Type | Description | Default 🍞🧀🥓 Ratio |
|------|-------------|---------------------|
| `deploy` | K8s, Helm, ArgoCD, secrets, network policy | 70 / 10 / 20 |
| `api-external` | Customer/3rd-party facing, contract-bound | 50 / 20 / 30 |
| `api-internal` | Service-to-service, internal stability | 30 / 30 / 40 |
| `app` | Workflow, orchestration, state machines | 20 / 50 / 30 |
| `lib-domain` | Pure domain logic, rules, validation | 10 / 30 / 60 |
| `lib-infra` | Common clients, middleware, utilities | 20 / 30 / 50 |

#### FR-3.2.2 Module Type Detection

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.2.2.1 | Auto-detect module type from file path patterns | MUST |
| FR-3.2.2.2 | Allow manual override via configuration | MUST |
| FR-3.2.2.3 | Support custom module types with custom ratios | SHOULD |

### 3.3 Canonical Profile System

#### FR-3.3.1 Profile Definition

Each module type has a canonical profile defining:

```typescript
interface CanonicalProfile {
  moduleType: ModuleType;

  // Expected 🍞🧀🥓 ratio (must sum to 100)
  bread: number;    // Security weight
  cheese: number;   // Cognitive weight
  ham: number;      // Behavioral weight

  // Thresholds for each axis
  thresholds: {
    bread: { min: number; max: number };
    cheese: { min: number; max: number };
    ham: { min: number; max: number };
  };

  // Change budget per PR
  changeBudget: {
    deltaCognitive: number;
    deltaStateTransitions: number;
    deltaPublicApi: number;
    breakingChangesAllowed: boolean;
  };
}
```

#### FR-3.3.2 Deviation Analysis

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.3.2.1 | Calculate current 🍞🧀🥓 ratio for module | MUST |
| FR-3.3.2.2 | Compare against canonical profile | MUST |
| FR-3.3.2.3 | Identify which axis is over/under weight | MUST |
| FR-3.3.2.4 | Calculate distance to canonical centroid | SHOULD |
| FR-3.3.2.5 | Suggest direction to move toward equilibrium | MUST |

### 3.4 Simplex Labeling System

#### FR-3.4.1 Module/PR Labeling

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.4.1.1 | Assign dominant label (🍞/🧀/🥓) to each module | MUST |
| FR-3.4.1.2 | Assign dominant label to each PR based on changes | MUST |
| FR-3.4.1.3 | Track label distribution across codebase | SHOULD |

**Labeling Rules:**

```
🍞 Label: Security constraint is dominant
  - Auth/authz changes
  - Crypto changes
  - Trust boundary modifications
  - Compliance-sensitive code

🧀 Label: Context density is dominant
  - High cognitive complexity
  - State×async×retry co-location
  - Hidden coupling increase

🥓 Label: Maintainability is dominant
  - Refactoring PRs
  - Test additions
  - API surface changes
  - Documentation
```

#### FR-3.4.2 Equilibrium Detection

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.4.2.1 | Detect if module is in equilibrium zone | MUST |
| FR-3.4.2.2 | Detect if codebase has at least one 🍞🧀🥓 complete simplex | SHOULD |
| FR-3.4.2.3 | Provide gradient direction toward equilibrium | MUST |

### 3.5 Gate System

#### FR-3.5.1 MVP Entry Gate

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.5.1.1 | Check 🍞: Trust boundary explicitly defined | MUST |
| FR-3.5.1.2 | Check 🍞: Auth/authz flow fixed | MUST |
| FR-3.5.1.3 | Check 🧀: Core modules below cognitive threshold | MUST |
| FR-3.5.1.4 | Check 🧀: No state×async×retry violations | MUST |
| FR-3.5.1.5 | Check 🥓: Golden tests exist for critical flows | MUST |
| FR-3.5.1.6 | Return "sandwich not formed" if any fails | MUST |

**Gate Result:**

```typescript
interface GateResult {
  canEnterMvp: boolean;

  bread: {
    passed: boolean;
    trustBoundaryDefined: boolean;
    authFlowFixed: boolean;
    violations: string[];
  };

  cheese: {
    passed: boolean;
    maxCognitive: number;
    threshold: number;
    stateAsyncRetryViolations: string[];
  };

  ham: {
    passed: boolean;
    goldenTestCoverage: number;
    criticalPathsProtected: string[];
    unprotectedPaths: string[];
  };

  sandwichFormed: boolean;
}
```

#### FR-3.5.2 PR Gate

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.5.2.1 | Check change budget for PR | MUST |
| FR-3.5.2.2 | Detect protected zone modifications | MUST |
| FR-3.5.2.3 | Require ADR for 🍞 changes | MUST |
| FR-3.5.2.4 | Require single-purpose for 🥓 behavior changes | SHOULD |
| FR-3.5.2.5 | Allow 🧀 reduction PRs freely | MUST |

### 3.6 Change Budget System

#### FR-3.6.1 Budget Definition

| Module Type | ΔCognitive | ΔState | ΔPublicAPI | Breaking |
|-------------|------------|--------|------------|----------|
| api-external | ≤ 3 | ≤ 1 | ≤ 2 | NO |
| api-internal | ≤ 5 | ≤ 2 | ≤ 3 | with ADR |
| app | ≤ 8 | ≤ 3 | N/A | N/A |
| lib-domain | ≤ 5 | ≤ 2 | ≤ 5 | with ADR |
| lib-infra | ≤ 8 | ≤ 3 | ≤ 3 | with ADR |
| deploy | ≤ 2 | N/A | N/A | ADR + Security Review |

#### FR-3.6.2 Budget Tracking

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.6.2.1 | Calculate delta for each axis per PR | MUST |
| FR-3.6.2.2 | Compare against module type budget | MUST |
| FR-3.6.2.3 | Report budget violations | MUST |
| FR-3.6.2.4 | Track cumulative budget over time | MAY |

### 3.7 Protected Zone System

#### FR-3.7.1 Zone Definition

**Deploy Repository Protected Zones:**
- `*/rbac/*`
- `*/network-policy/*`
- `*/ingress/*`
- `*/tls/*`
- `*/secrets/*`
- `*/sealed-secrets/*`

**Source Repository Protected Zones:**
- `*/auth/*`, `*/authn/*`, `*/authz/*`
- `*/crypto/*`, `*/encryption/*`
- `*/patient-data/*`, `*/phi/*`, `*/pii/*`
- `*/audit/*`, `*/logging/audit*`

#### FR-3.7.2 Zone Enforcement

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.7.2.1 | Detect modifications to protected zones | MUST |
| FR-3.7.2.2 | Require ADR reference for protected zone changes | MUST |
| FR-3.7.2.3 | Require additional test evidence | SHOULD |
| FR-3.7.2.4 | Support custom protected zone patterns | MUST |

### 3.8 Cognitive Degradation Detection

#### FR-3.8.1 Degradation Checklist

The system SHALL detect cognitive degradation when **2 or more** of these conditions are met:

| # | Condition | Detection Method |
|---|-----------|------------------|
| 1 | Implicit context dependencies ≥ 2 | Hidden coupling analysis |
| 2 | state×async×retry co-location | AST pattern detection |
| 3 | PR touches ≥ 25 core files | Git diff analysis |
| 4 | Missing golden/contract tests | Test file detection |
| 5 | Behavior hard to explain | (Manual flag) |
| 6 | Onboarding > 30min to explain | (Manual flag) |

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.8.1.1 | Check all automatable conditions (1-4) | MUST |
| FR-3.8.1.2 | Count violations and threshold at ≥ 2 | MUST |
| FR-3.8.1.3 | Report degradation zone status | MUST |
| FR-3.8.1.4 | Support manual flags for conditions 5-6 | MAY |

### 3.9 Recommendation System

#### FR-3.9.1 Gradient-Based Recommendations

**Requirements:**

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-3.9.1.1 | Calculate gradient direction toward equilibrium | MUST |
| FR-3.9.1.2 | Suggest specific refactoring actions | MUST |
| FR-3.9.1.3 | Prioritize by expected impact | SHOULD |
| FR-3.9.1.4 | Respect module type constraints | MUST |

**Recommendation Format:**

```typescript
interface Recommendation {
  axis: '🍞' | '🧀' | '🥓';
  priority: number;
  action: string;
  expectedImpact: {
    deltaBread: number;
    deltaCheese: number;
    deltaHam: number;
  };
  targetEquilibrium: boolean;
}
```

---

## 4. Non-Functional Requirements

### 4.1 Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-4.1.1 | Single file analysis | < 100ms |
| NFR-4.1.2 | Full project analysis (1000 files) | < 30s |
| NFR-4.1.3 | PR delta analysis | < 5s |

### 4.2 Accuracy

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-4.2.1 | Cognitive Complexity matches SonarSource | 95% |
| NFR-4.2.2 | Module type auto-detection accuracy | 90% |
| NFR-4.2.3 | False positive rate for violations | < 10% |

### 4.3 Extensibility

| ID | Requirement |
|----|-------------|
| NFR-4.3.1 | Support custom module types |
| NFR-4.3.2 | Support custom canonical profiles |
| NFR-4.3.3 | Support custom protected zone patterns |
| NFR-4.3.4 | Plugin architecture for new analyzers |

### 4.4 Language Support

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-4.4.1 | TypeScript/JavaScript | MUST |
| NFR-4.4.2 | Python | MUST |
| NFR-4.4.3 | Go | MUST |
| NFR-4.4.4 | Other languages via LSP | MAY |

---

## 5. Interface Requirements

### 5.1 CLI Interface

```bash
# Analyze with 🍞🧀🥓 output
semantic-complexity analyze ./src --format sandwich

# Check MVP gate
semantic-complexity gate mvp ./src

# Check PR budget
semantic-complexity budget ./src --base main --head feature

# Label module
semantic-complexity label ./src/auth
```

### 5.2 MCP (Model Context Protocol) Interface

```typescript
// Tools
- analyze_sandwich(path, moduleType)
- check_gate(path, gateType)
- check_budget(baseBranch, headBranch)
- get_label(path)
- suggest_refactor(path)
- check_degradation(path)
```

### 5.3 Output Formats

#### 5.3.1 Sandwich Format

```json
{
  "module": "src/auth",
  "moduleType": "api-external",
  "sandwich": {
    "bread": 45,
    "cheese": 25,
    "ham": 30,
    "canonical": { "bread": 50, "cheese": 20, "ham": 30 },
    "deviation": { "bread": -5, "cheese": +5, "ham": 0 },
    "label": "🧀",
    "inEquilibrium": false
  },
  "recommendations": [
    {
      "axis": "🧀",
      "action": "Extract state machine to separate module",
      "expectedImpact": { "cheese": -8 }
    }
  ]
}
```

#### 5.3.2 Gate Format

```json
{
  "gate": "mvp",
  "passed": false,
  "sandwichFormed": false,
  "axes": {
    "bread": { "passed": true, "details": "..." },
    "cheese": { "passed": false, "violations": ["state×async×retry in OrderService"] },
    "ham": { "passed": true, "details": "..." }
  }
}
```

---

## 6. Data Model

### 6.1 Core Types

```typescript
type Axis = '🍞' | '🧀' | '🥓';

type ModuleType =
  | 'deploy'
  | 'api-external'
  | 'api-internal'
  | 'app'
  | 'lib-domain'
  | 'lib-infra';

interface SandwichScore {
  bread: number;      // 0-100
  cheese: number;     // 0-100
  ham: number;        // 0-100
  // bread + cheese + ham = 100
}

interface CanonicalProfile {
  moduleType: ModuleType;
  canonical: SandwichScore;
  thresholds: Record<Axis, { min: number; max: number }>;
  changeBudget: ChangeBudget;
}

interface ModuleAnalysis {
  path: string;
  moduleType: ModuleType;
  current: SandwichScore;
  canonical: SandwichScore;
  deviation: SandwichScore;
  label: Axis;
  inEquilibrium: boolean;
  violations: Violation[];
  recommendations: Recommendation[];
}
```

### 6.2 Invariant Types

```typescript
interface CognitiveInvariant {
  // state × async × retry must not co-exist
  hasState: boolean;
  hasAsync: boolean;
  hasRetry: boolean;
  violated: boolean;
}

interface HiddenCoupling {
  globalAccess: string[];
  implicitIO: string[];
  envDependency: string[];
  closureCaptures: string[];
  total: number;
  threshold: number;
  violated: boolean;
}
```

---

## 7. Constraints

### 7.1 Mathematical Constraints

1. **Simplex Constraint**: bread + cheese + ham = 100
2. **Non-negativity**: All axes ≥ 0
3. **Sperner Condition**: Boundary labeling must be consistent

### 7.2 Engineering Constraints

1. **Cognitive Invariant**: state × async × retry CANNOT co-exist in same function/module
2. **Protected Zone**: Changes require ADR + evidence
3. **Change Budget**: Deltas must not exceed module type limits

### 7.3 Implementation Constraints

1. Must use Cognitive Complexity (not McCabe) for 🧀 axis
2. Must support incremental analysis (PR-level)
3. Must integrate with git for delta analysis

---

## 8. Appendix

### A. Cognitive Complexity Calculation (Required)

Unlike McCabe's cyclomatic complexity:

```
McCabe: Each decision point = +1
        switch with 10 cases = +10

Cognitive:
  - Structural increment: +1 for control structures
  - Nesting penalty: +N for depth N
  - No increment for: switch cases (fan-out, not cycles)

        switch with 10 cases = +1 (single structure)
        nested if (depth 3) = +1 + +2 + +3 = +6
```

### B. Sperner's Lemma Application

```
2-Simplex: Triangle with vertices 🍞, 🧀, 🥓

Triangulation: Each module/PR is a sub-triangle

Labeling: Each sub-triangle vertex gets dominant axis label

Theorem: At least one sub-triangle contains all three labels

Engineering: Balanced design point NECESSARILY EXISTS
```

### C. Module Type Detection Patterns

```typescript
const MODULE_PATTERNS = {
  'deploy': [
    '**/k8s/**', '**/helm/**', '**/deploy/**',
    '**/manifests/**', '**/.github/workflows/**'
  ],
  'api-external': [
    '**/api/external/**', '**/api/public/**',
    '**/routes/v*/**'
  ],
  'api-internal': [
    '**/api/internal/**', '**/grpc/**',
    '**/events/**'
  ],
  'app': [
    '**/app/**', '**/services/**',
    '**/workflows/**', '**/jobs/**'
  ],
  'lib-domain': [
    '**/domain/**', '**/models/**',
    '**/rules/**', '**/validators/**'
  ],
  'lib-infra': [
    '**/lib/**', '**/utils/**',
    '**/common/**', '**/shared/**'
  ]
};
```

---

## Document History

| Version | Date       | Author | Changes |
|---------|------------|--------|---------|
| 1.0 | 2025-12-24 | semantic-complexity team | Initial SRS based on theoretical foundations |
