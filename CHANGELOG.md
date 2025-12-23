# Changelog

[한국어](./CHANGELOG.ko.md) | English

---

## [0.0.7] - 2024-12-24

### Native Tensor/Canonical Integration (Architecture Fix)

#### Bug Fix: Cross-Language Architecture

**Problem**: Python and Go CLIs were returning only basic analysis results, while MCP recalculated tensor/canonical using TypeScript core. This was architecturally incorrect since each language has its own AST parser and analysis patterns.

**Solution**: Each language now returns native tensor/canonical/hodge results.

| Component | Before | After |
|-----------|--------|-------|
| Python CLI | Basic analysis only | Full: tensor, canonical, hodge, recommendations |
| Go CLI | Basic analysis only | Full: tensor, canonical, hodge, recommendations |
| MCP | Recalculated using TS core | Uses native results from each language |

#### Python CLI (`py/semantic_complexity/cli`)

Now includes in response:
```json
{
  "tensor": { "score": 12.5, "zone": "review", "rawSum": 8, ... },
  "moduleType": { "inferred": "lib", "confidence": 0.85 },
  "canonical": { "profile": "lib", "deviation": 0.12, ... },
  "hodge": { "algorithmic": 3, "balanced": 2, "architectural": 3 },
  "recommendations": [{ "priority": 1, "suggestion": "..." }]
}
```

#### Go CLI (`go/semanticcomplexity`)

Extended `FunctionResult` struct:
```go
type FunctionResult struct {
    // ... existing fields
    Tensor          TensorScoreOutput      `json:"tensor"`
    ModuleType      ModuleTypeOutput       `json:"moduleType"`
    Canonical       CanonicalOutput        `json:"canonical"`
    Hodge           HodgeOutput            `json:"hodge"`
    Recommendations []RecommendationOutput `json:"recommendations"`
}
```

#### MCP Server

- Uses native tensor/canonical from Python/Go results
- TypeScript core only used as fallback when native results unavailable
- Eliminates redundant recalculation for non-TypeScript languages

---

## [0.0.6] - 2024-12-23

### MCP Tool Consolidation & LLM-Optimized Descriptions

#### Tool Consolidation (9 → 6 tools)

| Before | After | Change |
|--------|-------|--------|
| `compare_mccabe_dimensional` | → `analyze_function` | Merged (comparison field) |
| `get_dimension_breakdown` | → `analyze_function` | Merged (dimensions field) |
| `infer_module_type` | → `validate_complexity` | Merged |
| `check_canonical` | → `validate_complexity` | Merged |

**New consolidated tools:**
1. `get_hotspots` - [ENTRY POINT] Find complexity hotspots
2. `analyze_file` - File-level analysis
3. `analyze_function` - Deep function analysis (includes breakdown + comparison)
4. `suggest_refactor` - Refactoring suggestions
5. `generate_graph` - Dependency/call graph visualization
6. `validate_complexity` - Canonical bounds validation (includes module type inference)

#### LLM-Optimized Tool Descriptions

Added contextual usage hints for autonomous tool selection:
```
USE THIS FIRST when user mentions:
- "refactoring", "리팩토링", "개선"
- "code quality", "코드 품질"
- "what should I improve?", "뭐 고쳐야 해?"
```

---

## [0.0.5] - 2024-12-23

### Build & Security Fixes

#### Build
- Sequential build: core → cli/mcp (parallel)
- Fixes CI build failure where cli/mcp tried to import core before it was built

#### Security
- Go 1.22 → 1.23 (CVE-2024-45336, CVE-2024-45341 fixes)

#### CI
- Dynamic Go tag versioning (removes hardcoded `go/v0.0.1`)

---

## [0.0.4] - 2024-12-23

### Go Support, Comprehensive Testing & New MCP Tools

#### Test Coverage Expansion

| Package | Tests | Coverage |
|---------|-------|----------|
| npm | 119 | - |
| Python | 154 | 96% |
| Go | 94 | - |
| **Total** | **367** | - |

- Go: 94 tests covering analyzer, tensor, canonical, scoring
- Python CLI: 33 new tests (0% → 96% coverage)
- Cross-language compatibility tests (TS/Python/Go)

#### Security

- Fixed CVE in esbuild (vitest 2.x → 4.x upgrade)

#### Documentation

- Added package-specific READMEs (cli, core, mcp)
- Added Korean documentation (README.ko.md, CHANGELOG.ko.md)

#### CDR-Inspired Dual Metrics

Inspired by [Clinical Dementia Rating (CDR)](https://knightadrc.wustl.edu/professionals-clinicians/cdr-dementia-staging-instrument/), two complementary metrics:

| Metric | CDR Equivalent | Calculation | Use Case |
|--------|----------------|-------------|----------|
| **Tensor Score** | CDR Global | `vᵀMv + ⟨v,w⟩ + ε‖v‖²` | Staging |
| **Raw Sum** | CDR-SOB | `C + N + S + A + Λ` | Change tracking |

- `rawSum`: Simple sum of complexity domains (C + N + S + A + Λ)
- `rawSumThreshold`: Sum of canonical profile upper bounds
- `rawSumRatio`: `rawSum / rawSumThreshold` (0-0.7: safe, 0.7-1.0: review, >1.0: violation)

#### MCP Cross-Platform Support

- Cross-platform Python command fallback (`python3` / `python` / `py`)
- Linux, Mac, Windows all supported

#### Go Language Support

- Go AST-based analyzer
- MCP server auto-detection for `.go` files
- Full complexity domain analysis for Go code

---

## [0.0.3] - 2024-12-23

### 2nd-Order Tensor Framework

Extended mathematical foundations with 2nd-order tensor analysis capturing cross-dimension interactions.

#### Core Changes

**Second-Order Tensor**
```
score = vᵀMv + ⟨v,w⟩ + ε‖v‖²

v = [Control, Nesting, State, Async, Coupling] ∈ ℝ⁵
M = 5×5 Interaction Matrix (per module type)
ε = Regularization parameter
```

**ε-Regularization**
- Resolves convergence instability at hard boundary (threshold=10)
- Convergence guarantee via Banach fixed-point theorem
- Convergence score: `(current - target) / ε`

**Hodge Decomposition**
```
H^{2,0} (algorithmic)  : Control + Nesting
H^{1,1} (balanced)     : Async
H^{0,2} (architectural): State + Coupling
```

#### Module Types Extended: 8 Types

| Type | Role | Characteristics |
|------|------|-----------------|
| `api` | REST/GraphQL endpoints | C:low, Λ:low |
| `lib` | Pure functions, utilities | C:med, S:low |
| `app` | Business logic | S:med, A:med |
| `web` | UI components | N:high |
| `data` | Entities, schemas, DTOs | S:high, Λ:med |
| `infra` | Repository, DB/IO | A:high, Λ:high |
| `deploy` | Configuration, infrastructure | all:low |
| `unknown` | Unclassified | permissive |

#### MCP Server

- Auto language detection (TypeScript/JavaScript + Python)
- All 6 tools support Python
- Added `language` filter parameter

#### Python Package

`semantic-complexity` PyPI package added:
- Python 3.10+ support
- AST-based analyzer
- CLI tool included

#### New Files

```
packages/core/src/tensor/
├── types.ts      # Vector5D, TensorScore, etc.
├── matrix.ts     # InteractionMatrix, MODULE_MATRICES
├── scoring.ts    # calculateTensorScore, hodgeDecomposition
├── canonical.ts  # CANONICAL_5D_PROFILES
└── index.ts

py/semantic_complexity/core/
├── tensor.py      # ModuleType, Vector5D, InteractionMatrix
├── convergence.py # ConvergenceResult, analyze_convergence
└── canonical.py   # CanonicalProfile, HodgeDecomposition
```

---

## [0.0.2] - 2024-12-23

### Canonical Profiles & Meta-dimensions

Introduced module type-based canonicality framework.

#### Core Changes

**Canonical Forms per Module Type**
```typescript
type ModuleType = 'api' | 'app' | 'lib' | 'deploy';

Φ: ModuleType → CanonicalProfile
```

**Meta-dimensions (Ham Sandwich)**
| Axis | Composition | Meaning |
|------|-------------|---------|
| 🍞 Security | coupling + globalAccess | Structural stability |
| 🧀 Context | cognitive + nesting | Context density |
| 🥓 Behavior | state + async | Behavior preservation |

**Convergence Analysis**
- Distance measurement from current state to canonical form
- Deviation metric: L2 norm

**Delta Gates**
- Change-based quality verification
- Stage-specific gates: Dev/QA/RA

#### New Files

```
packages/core/src/
├── canonical/
│   ├── types.ts
│   ├── profiles.ts
│   └── convergence.ts
└── gates/
    ├── types.ts
    └── delta.ts
```

---

## [0.0.1] - 2024-12-23

### Initial Release

First public version of the multi-dimensional code complexity analyzer.

#### Complexity Domains

| Domain | Weight | Measures |
|-----------|--------|----------|
| Control (C) | ×1.0 | if, switch, loop, logical operators |
| Nesting (N) | ×1.5 | Nesting depth, callbacks |
| State (S) | ×2.0 | State mutations, hooks |
| Async (A) | ×2.5 | async/await, Promise |
| Coupling (Λ) | ×3.0 | Global access, I/O, side effects |

#### Package Structure

```
semantic-complexity-monorepo/
├── packages/
│   ├── core/     # semantic-complexity (npm)
│   ├── cli/      # semantic-complexity-cli
│   └── mcp/      # semantic-complexity-mcp
```

#### Core API

```typescript
analyzeFilePath(filePath: string): FileAnalysisResult
analyzeSource(source: string): FileAnalysisResult
analyzeFunctionExtended(node, sourceFile): ExtendedComplexityResult
```

#### CLI Commands

```bash
semantic-complexity summary ./src
semantic-complexity analyze ./src -o report -f html
```

#### MCP Tools

| Tool | Description |
|------|-------------|
| `analyze_file` | Analyze file complexity |
| `analyze_function` | Analyze function complexity |
| `get_hotspots` | Find complexity hotspots |
| `suggest_refactor` | Get refactoring suggestions |

---
