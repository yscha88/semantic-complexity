# Software Design Specification (SDS)
# semantic-complexity v1.0

---

## 1. Overview

### 1.1 Purpose

This document specifies the **design decisions and algorithms** for implementing the requirements in [SRS.md](./SRS.md).

### 1.2 Related Documents

| Document | Role |
|----------|------|
| [THEORY.md](./THEORY.md) | Theoretical foundation (why) |
| [SRS.md](./SRS.md) | Requirements (what) |
| This document | Design (how) |

---

## 2. System Architecture

### 2.1 ML Pipeline Structure

The system follows a 3-stage processing structure similar to ML pipelines:

```
╔═══════════════════════════════════════════════════════════════════╗
║  INPUT (Feature Extraction)                                        ║
╠═══════════════════════════════════════════════════════════════════╣
║  ┌──────────────┐    ┌──────────────────────────────────────────┐ ║
║  │   Source     │───▶│           Language Parsers               │ ║
║  │    Code      │    ├──────────────────────────────────────────┤ ║
║  └──────────────┘    │ py_parser │ go_parser │ ts_parser │ ...  │ ║
║                      └──────────────────────────────────────────┘ ║
║                                     │                              ║
║                                     ▼                              ║
║  ┌─────────────────────────────────────────────────────────────┐  ║
║  │  5D Vector: [C, N, S, A, Λ]                                 │  ║
║  │  + Pattern Detection (Trust Boundary, Secret, Test, etc.)   │  ║
║  └─────────────────────────────────────────────────────────────┘  ║
╚═══════════════════════════════════════════════════════════════════╝
                                    │
                                    ▼
┌───────────────────────────────────────────────────────────────────┐
│  PROCESSING (Preprocessing + Parameters)                          │
├───────────────────────────────────────────────────────────────────┤
│  L2: Normalization                                                 │
│    - Simplex projection (5D → 3-axis)                             │
│    - Anti-pattern Penalty (*args/kwargs: +3 each)                 │
│    - Exclusion filter (self/cls, built-in)                        │
├───────────────────────────────────────────────────────────────────┤
│  L3: Judgment [LLM/Human intervention]                            │
│    - Essential Complexity Waiver                                   │
│    - Module type Context injection                                 │
└───────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
╔═══════════════════════════════════════════════════════════════════╗
║  OUTPUT (Inference)                                                ║
╠═══════════════════════════════════════════════════════════════════╣
║  ┌─────────────────────────────────────────────────────────────┐  ║
║  │  3-axis scores: [🍞 Bread, 🧀 Cheese, 🥓 Ham]               │  ║
║  │  Gate results (PoC/MVP/Production)                           │  ║
║  │  Refactoring recommendations (-∇E)                           │  ║
║  │  Canonical deviation report                                   │  ║
║  └─────────────────────────────────────────────────────────────┘  ║
╚═══════════════════════════════════════════════════════════════════╝
```

**Core Principle**: INPUT is context-free (deterministic), PROCESSING injects context, OUTPUT is context-aware.

### 2.2 Module Structure

```
src/
├── analyzers/               # 3-axis analyzers
│   ├── bread/               # 🍞 Security Analyzer
│   │   ├── trust-boundary
│   │   ├── auth-flow
│   │   └── secret-detector
│   ├── cheese/              # 🧀 Cognitive Analyzer
│   │   ├── nesting
│   │   ├── hidden-coupling
│   │   └── state-async-retry
│   └── ham/                 # 🥓 Behavioral Analyzer
│       ├── golden-test
│       ├── contract-test
│       └── critical-path
│
├── simplex/                 # Simplex normalization
│   ├── normalizer           # 3-axis → Simplex conversion
│   ├── labeler              # Dominant axis labeling
│   └── equilibrium          # Equilibrium detection
│
├── gate/                    # Gate System
│   ├── poc-gate
│   ├── mvp-gate
│   └── production-gate
│
├── budget/                  # Change Budget
│   ├── tracker
│   └── delta
│
└── recommend/               # Gradient Recommender
    ├── gradient
    └── actions
```

---

## 3. Algorithm Design

### 3.1 🧀 Cheese: Accessibility Determination

#### 3.1.1 Definition

```
🧀 Cheese = Is it within the range that humans and LLMs can comprehend?

Accessibility Conditions (ALL must be met):
┌─────────────────────────────────────────────────────────────┐
│ Condition           │ Threshold          │ Rationale        │
├─────────────────────┼────────────────────┼──────────────────┤
│ 1. Nesting depth    │ ≤ N (configurable) │ Structure visible│
│ 2. Concept count    │ ≤ 9 per function   │ Miller's Law 7±2 │
│ 3. Hidden deps      │ Minimized          │ Context complete │
│ 4. state×async×retry│ No 2+ coexistence  │ Cannot reason    │
└─────────────────────────────────────────────────────────────┘

Exclusions from concept count:
- self/cls parameters: Class method convention, no cognitive load
- Built-in functions: str, int, len, list, dict, etc.
- numpy basics: array, asanyarray, zeros, etc.
```

#### 3.1.2 state×async×retry Invariant

```typescript
interface CognitiveInvariant {
  hasState: boolean;
  hasAsync: boolean;
  hasRetry: boolean;
  violated: boolean;  // true if count >= 2
}

function checkStateAsyncRetry(code: string): CognitiveInvariant {
  const hasState = detectStateMutation(code);
  const hasAsync = detectAsyncPattern(code);
  const hasRetry = detectRetryPattern(code);

  const count = [hasState, hasAsync, hasRetry].filter(Boolean).length;

  return {
    hasState,
    hasAsync,
    hasRetry,
    violated: count >= 2,
  };
}
```

### 3.2 🍞 Bread: Security Trust Boundary

```
🍞 Bread = Are security trust boundaries clearly defined?

Analysis targets:
┌─────────────────────────────────────────────────────────────┐
│ Element           │ Detection Method      │ Severity        │
├───────────────────┼───────────────────────┼─────────────────┤
│ Trust Boundary    │ Decorators, markers   │ Required        │
│ Auth Explicitness │ AUTH_FLOW declaration │ Required        │
│ Secret Pattern    │ Hardcoding check      │ high/medium/low │
│ Secret Leak       │ print/logger output   │ high            │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 🥓 Ham: Behavioral Protection Coverage

```
🥓 Ham = Are critical paths protected by golden tests?

Analysis targets:
┌─────────────────────────────────────────────────────────────┐
│ Element           │ Description           │ Protection      │
├───────────────────┼───────────────────────┼─────────────────┤
│ Critical Path     │ payment, auth, data   │ 100% recommended│
│ Golden Test       │ Expected result assert│ PoC: 60%+       │
│ Contract Test     │ API contract verify   │ For external API│
│ Test Discovery    │ Auto test file search │ test_*.py etc.  │
└─────────────────────────────────────────────────────────────┘
```

### 3.4 Simplex Normalization

```typescript
interface SandwichScore {
  bread: number;    // 0 ~ 100
  cheese: number;   // 0 ~ 100
  ham: number;      // 0 ~ 100
  // bread + cheese + ham = 100
}

function normalizeToSimplex(raw: RawScores): SandwichScore {
  const total = raw.bread + raw.cheese + raw.ham;

  if (total === 0) {
    return { bread: 33.33, cheese: 33.33, ham: 33.34 };
  }

  return {
    bread: (raw.bread / total) * 100,
    cheese: (raw.cheese / total) * 100,
    ham: (raw.ham / total) * 100,
  };
}
```

### 3.5 Canonical Profile Deviation

```typescript
const CANONICAL_PROFILES: Record<ModuleType, SandwichScore> = {
  'deploy':       { bread: 70, cheese: 10, ham: 20 },
  'api-external': { bread: 50, cheese: 20, ham: 30 },
  'api-internal': { bread: 30, cheese: 30, ham: 40 },
  'app':          { bread: 20, cheese: 50, ham: 30 },
  'lib-domain':   { bread: 10, cheese: 30, ham: 60 },
  'lib-infra':    { bread: 20, cheese: 30, ham: 50 },
};

function calculateDeviation(current: SandwichScore, canonical: SandwichScore): Deviation {
  const dB = current.bread - canonical.bread;
  const dC = current.cheese - canonical.cheese;
  const dH = current.ham - canonical.ham;

  return {
    bread: dB,
    cheese: dC,
    ham: dH,
    distance: Math.sqrt(dB*dB + dC*dC + dH*dH),
  };
}
```

### 3.6 Gradient Direction (Lyapunov Energy)

```typescript
// E(v) = ||v - c||² = (v - c)ᵀ(v - c)
// v = current point, c = canonical centroid

function calculateGradient(
  current: SandwichScore,
  canonical: SandwichScore
): GradientDirection[] {
  const deviation = calculateDeviation(current, canonical);
  const gradients: GradientDirection[] = [];

  // Sort by magnitude, largest deviation first
  if (Math.abs(deviation.bread) > 0) {
    gradients.push({
      axis: '🍞',
      direction: deviation.bread > 0 ? 'decrease' : 'increase',
      magnitude: Math.abs(deviation.bread),
    });
  }
  // ... similar for cheese and ham

  return gradients.sort((a, b) => b.magnitude - a.magnitude);
}
```

---

## 4. 3-Stage Gate System

```
Gate System = Code quality entry conditions (progressively stricter)

┌─────────────────────────────────────────────────────────────┐
│ Stage        │ 🍞 Bread      │ 🧀 Cheese   │ 🥓 Ham        │
├──────────────┼───────────────┼─────────────┼───────────────┤
│ PoC          │ SKIP          │ WARN only   │ coverage≥60% │
│ (Experiment) │               │             │               │
├──────────────┼───────────────┼─────────────┼───────────────┤
│ MVP          │ boundary def  │ accessible  │ coverage≥80% │
│ (Product)    │ AUTH_FLOW req │ no secrets  │ contract req  │
├──────────────┼───────────────┼─────────────┼───────────────┤
│ Production   │ MVP conditions│ MVP cond.   │ coverage≥95% │
│ (Operations) │ + audit logs  │ + waiver OK │ + 100% ideal  │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Interface Design

### 5.1 MCP Tools

```typescript
const MCP_TOOLS = [
  {
    name: 'analyze_sandwich',
    description: '🍞🧀🥓 3-axis complexity analysis',
    parameters: { source: string, file_path?: string },
  },
  {
    name: 'analyze_cheese',
    description: '🧀 Cognitive accessibility analysis',
    parameters: { source: string },
  },
  {
    name: 'check_gate',
    description: 'MVP/Production gate condition check',
    parameters: { source: string, gate_type?: string, file_path?: string, project_root?: string },
  },
  {
    name: 'check_budget',
    description: 'PR change budget check',
    parameters: { before_source: string, after_source: string, module_type?: string },
  },
  {
    name: 'get_label',
    description: 'Get module dominant axis label',
    parameters: { source: string },
  },
  {
    name: 'suggest_refactor',
    description: 'Equilibrium direction refactoring suggestions',
    parameters: { source: string, module_type?: string },
  },
  {
    name: 'check_degradation',
    description: 'Cognitive degradation detection',
    parameters: { before_source: string, after_source: string },
  },
];
```

### 5.2 MCP Resources

LLM can access documentation through MCP resources:

```typescript
const MCP_RESOURCES = [
  {
    uri: 'docs://usage-guide',
    name: 'Usage Guide',
    description: 'semantic-complexity MCP server usage guide',
    mimeType: 'text/markdown',
  },
  {
    uri: 'docs://theory',
    name: 'Theoretical Foundation',
    description: 'Ham Sandwich Theorem based theory',
    mimeType: 'text/markdown',
  },
  {
    uri: 'docs://srs',
    name: 'Requirements Specification',
    description: 'Software requirements specification',
    mimeType: 'text/markdown',
  },
  {
    uri: 'docs://sds',
    name: 'Design Specification',
    description: 'Software design specification',
    mimeType: 'text/markdown',
  },
];
```

**Implementation by Language:**

| Language | Implementation |
|----------|----------------|
| Python | `@mcp.resource("docs://...")` decorator |
| TypeScript | `ListResourcesRequestSchema` + `ReadResourceRequestSchema` handlers |
| Go | `mcp.NewResource()` + `s.AddResource()` |

---

## References

- [THEORY.md](./THEORY.md) - Theoretical foundation
- [SRS.md](./SRS.md) - Requirements specification
- [SDS.ko.md](./SDS.ko.md) - Korean version (detailed)

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-24 | Initial design specification |
| 1.1 | 2026-01-03 | English translation, MCP Resources section |
