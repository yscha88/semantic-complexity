# semantic-complexity

[한국어](./README.ko.md) | English

**Multi-dimensional Code Complexity Analyzer** — Quantifies actual maintenance difficulty using algebraic topology and tensor analysis.

## v0.0.7: Native Tensor/Canonical Integration

### Architecture Fix
Python and Go CLIs now return native tensor/canonical/hodge results instead of basic analysis only. MCP uses these native results directly.

| Component | Before | After |
|-----------|--------|-------|
| Python CLI | Basic analysis | Full: tensor, canonical, hodge, recommendations |
| Go CLI | Basic analysis | Full: tensor, canonical, hodge, recommendations |
| MCP | Recalculated with TS | Uses native results from each language |

### MCP Tools (6 tools)
| Tool | Description |
|------|-------------|
| `get_hotspots` | [ENTRY POINT] Find complexity hotspots |
| `analyze_file` | File-level analysis |
| `analyze_function` | Deep function analysis (includes breakdown + comparison) |
| `suggest_refactor` | Refactoring suggestions |
| `generate_graph` | Dependency/call graph visualization |
| `validate_complexity` | Canonical bounds validation (includes module type inference) |

---

## v0.0.6: MCP Tool Consolidation

- **Tool Consolidation (9 → 6)**: Merged redundant tools for cleaner API
- **LLM-Optimized Descriptions**: Added contextual usage hints for autonomous tool selection

---

## v0.0.5: Build & Security Fixes

### What's New
- **Build Order Fix**: Sequential build (core → cli/mcp) for CI compatibility
- **Go 1.23**: Security update (CVE-2024-45336, CVE-2024-45341)
- **Dynamic Go Tags**: CI reads version from package.json

---

## v0.0.4: Go Support & Comprehensive Testing

### What's New
- **Go Language Support**: Full AST-based analyzer with tensor framework
- **367 Total Tests**: npm(119) + Python(154) + Go(94)
- **96% Python Coverage**: CLI module fully tested
- **New MCP Tools**: `generate_graph`, `infer_module_type`, `check_canonical`

---

## v0.0.3: Mathematical Framework

### Problem Definition

#### Limitations up to v0.0.2

```
score = Σ(dᵢ × wᵢ) = d₁w₁ + d₂w₂ + ... + d₅w₅
```

This is a **linear sum** with the following issues:

| Problem | Description |
|---------|-------------|
| Ignores cross-dimension interaction | Cannot capture `nesting × async` synergy |
| Single weight | Same weights for all module types |
| Hard boundary | Convergence instability at `score = 10.0` |
| No topological structure | Ignores geometric properties of code space |

---

## Mathematical Foundations

### 1. Domain Space Definition

Code complexity is defined in a space `D` composed of 5 **domains**:

```
D = D_control × D_nesting × D_state × D_async × D_coupling ⊂ ℝ⁵
```

Each domain is not an independent measurement space but has an **interacting fiber bundle** structure.

#### Domain Definitions

| Domain | Symbol | Mathematical Definition | Measures |
|--------|--------|-------------------------|----------|
| **Control** | `C` | `dim H₁(G) + 1` (First Betti number) | Branches, loops, conditionals |
| **Nesting** | `N` | `Σᵢ depth(nodeᵢ)` (Depth integral) | Nesting depth, callbacks |
| **State** | `S` | `|∂Γ/∂t|` (State transition rate) | State mutations, transitions |
| **Async** | `A` | `π₁(async-flow)` (Fundamental group) | Async boundaries, await |
| **Coupling** | `Λ` | `deg(v) in G_dep` (Dependency degree) | Global access, I/O, side effects |

---

### 2. Tensor Structure

#### 2.1 First-Order (v0.0.2)

```
score⁽¹⁾ = ⟨v, w⟩ = Σᵢ vᵢwᵢ

v = [C, N, S, A, Λ] ∈ ℝ⁵
w = [1.0, 1.5, 2.0, 2.5, 3.0]
```

Linear model. Assumes dimension independence.

#### 2.2 Second-Order Tensor (v0.0.3)

Second-order tensor capturing **cross-dimension interactions**:

```
score⁽²⁾ = vᵀMv + ⟨v, w⟩

M ∈ ℝ⁵ˣ⁵ (Interaction Matrix)
```

**Interaction Matrix M:**

```
        C     N     S     A     Λ
    ┌─────────────────────────────┐
C   │ 1.0   0.3   0.2   0.2   0.3 │  Control
N   │ 0.3   1.0   0.4   0.8   0.2 │  Nesting × Async ↑
S   │ 0.2   0.4   1.0   0.5   0.9 │  State × Coupling ↑↑
A   │ 0.2   0.8   0.5   1.0   0.4 │  Async × Nesting ↑
Λ   │ 0.3   0.2   0.9   0.4   1.0 │  Coupling × State ↑↑
    └─────────────────────────────┘
```

**Interpretation:**
- `M[N,A] = 0.8`: Deep nesting with async → high interaction
- `M[S,Λ] = 0.9`: State mutation + hidden dependencies → critical

#### 2.3 Third-Order Tensor (Module Type Specific)

Different **interaction matrices** applied per module type:

```
W ∈ ℝ⁸ˣ⁵ˣ⁵

W[module_type, i, j] = module-specific interaction weight
```

```python
# API module: Emphasize Coupling interactions
M_api[S,Λ] = 1.5  # State × Coupling very dangerous

# Lib module: Emphasize Control/Nesting interactions
M_lib[C,N] = 1.2  # Control × Nesting important

# App module: Emphasize State/Async interactions
M_app[S,A] = 1.3  # State × Async important
```

---

### 3. ε-Regularization and Convergence

#### Problem: Hard Boundary Instability

```
threshold = 10.0

iteration 1: score = 10.5 → fix
iteration 2: score = 9.8  → ok
iteration 3: score = 10.1 → fix
iteration 4: score = 9.9  → ok
...
Oscillation at boundary, no convergence
```

#### Solution: ε-Lifted Space

Define complexity space as **lifted by ε** from threshold:

```
target = threshold - ε

         ┌─────────────────────┐
    ε    │   Safe Zone         │  ← converge here
         ├─────────────────────┤
  ──────▶│   threshold = 10    │  ← unstable boundary
         ├─────────────────────┤
   -ε    │   Violation Zone    │
         └─────────────────────┘
```

#### Contraction Mapping Theorem

To guarantee convergence:

```
‖f(x) - f(y)‖ ≤ k‖x - y‖,  where k < 1
```

ε-regularization satisfies this condition:

```
score_reg = score + ε‖v‖²

∇score_reg = ∇score + 2εv
```

**Result:**
- ε = 0: k → 1, no convergence guarantee
- ε > 0: k < 1, Banach fixed-point theorem applicable

---

### 4. Hodge Decomposition of Code Space

Apply **Hodge-like decomposition** to code complexity space:

```
H^k(Code) = ⊕_{p+q=k} H^{p,q}(Code)
```

Hodge structure of complexity domain space:

| Hodge Component | Dominant Domain | Characteristic | Interpretation |
|-----------------|-----------------|----------------|----------------|
| `H^{2,0}` | Control, Nesting | Algorithmic | Pure algorithmic complexity |
| `H^{0,2}` | Coupling, State | Architectural | Structural/dependency complexity |
| `H^{1,1}` | Async (mixed) | Balanced | Mixed complexity |

---

### 5. Module Type Canonical Forms

#### Canonical Profile per Module Type

Each module type has an **ideal complexity profile**:

```
Φ: ModuleType → CanonicalProfile

Φ(api)    = (C: low,  N: low,  S: low,  A: low,  Λ: low)
Φ(lib)    = (C: med,  N: med,  S: low,  A: low,  Λ: low)
Φ(app)    = (C: med,  N: med,  S: med,  A: med,  Λ: low)
Φ(web)    = (C: med,  N: high, S: med,  A: med,  Λ: low)
Φ(data)   = (C: low,  N: low,  S: high, A: low,  Λ: med)
Φ(infra)  = (C: low,  N: low,  S: low,  A: high, Λ: high)
Φ(deploy) = (C: low,  N: low,  S: low,  A: low,  Λ: low)
```

#### Module Types

| Type | Role | Examples |
|------|------|----------|
| `api` | REST/GraphQL endpoints | controllers, views |
| `lib` | Pure functions, utilities | utils/, helpers/ |
| `app` | Business logic | services/ |
| `web` | UI components | React/Vue components |
| `data` | Entities, schemas | models/, DTOs |
| `infra` | DB/IO access | repositories/, DAOs |
| `deploy` | Configuration | settings, configs |

#### Deviation Metric

Distance between current state and canonical form:

```
δ(v, Φ(type)) = ‖v - Φ(type)‖_M

where ‖·‖_M is the M-weighted norm (Mahalanobis-like)
```

---

### 6. Dual-Metric Approach (CDR-inspired)

Inspired by [Clinical Dementia Rating (CDR)](https://knightadrc.wustl.edu/professionals-clinicians/cdr-dementia-staging-instrument/), we use two complementary metrics:

| Metric | CDR Equivalent | Calculation | Use Case |
|--------|----------------|-------------|----------|
| **Tensor Score** | CDR Global | `vᵀMv + ⟨v,w⟩ + ε‖v‖²` | Staging, captures interactions |
| **Raw Sum** | CDR-SOB | `C + N + S + A + Λ` | Tracking changes over time |

#### Why Two Metrics?

| Property | Tensor Score | Raw Sum |
|----------|--------------|---------|
| Calculation | Algorithm-based | Simple sum |
| Data type | Ordinal (staging) | Interval (continuous) |
| Interaction capture | Yes (M matrix) | No |
| Change sensitivity | Low | High |
| Best for | Classification | Progress tracking |

#### Raw Sum Threshold

Raw Sum threshold is derived from canonical profile upper bounds:

```
rawSumThreshold(module_type) = Σ canonical_upper_bounds

Example (api):
  control[1] + nesting[1] + state[1] + async[1] + coupling[1]
  = 5 + 3 + 2 + 3 + 3 = 16
```

| Module | Raw Sum Threshold |
|--------|-------------------|
| api | 16 |
| lib | 21 |
| app | 36 |
| web | 31 |
| data | 22 |
| infra | 26 |
| deploy | 12 |
| unknown | 55 |

#### Interpretation

```
rawSumRatio = rawSum / rawSumThreshold

0.0 - 0.7: Safe zone
0.7 - 1.0: Review needed
    > 1.0: Violation
```

---

## Implementation

### Score Calculation (v0.0.3)

```python
def calculate_score(
    v: Vector5D,
    module_type: ModuleType,
    epsilon: float = 2.0
) -> ComplexityScore:
    # Linear term
    linear = dot(v, get_weights(module_type))

    # Quadratic term (interaction)
    M = get_interaction_matrix(module_type)
    quadratic = v.T @ M @ v

    # ε-regularization
    regularization = epsilon * norm(v) ** 2

    return ComplexityScore(
        raw=linear + quadratic,
        regularized=linear + quadratic + regularization,
        epsilon=epsilon
    )
```

---

## Package Structure

```
semantic-complexity/
├── packages/           # TypeScript (JS/TS analysis)
│   ├── core/          # Analysis engine
│   ├── cli/           # CLI tool
│   └── mcp/           # Claude Code integration
├── py/                # Python (Python analysis)
│   └── semantic_complexity/
└── go/                # Go analysis
    └── semanticcomplexity/
```

## Installation

```bash
# TypeScript/JavaScript
npm install semantic-complexity

# Python
pip install semantic-complexity

# Go
go get github.com/yscha88/semantic-complexity/go/semanticcomplexity
```

## MCP Server

Auto language detection for TypeScript/JavaScript, Python, and Go.

**Cross-platform support:** Linux, Mac, Windows (automatic Python command fallback: `python3` → `python` → `py`)

```json
{
  "mcpServers": {
    "semantic-complexity": {
      "command": "npx",
      "args": ["semantic-complexity-mcp"]
    }
  }
}
```

### Available Tools

| Tool | Description |
|------|-------------|
| `analyze_file` | Analyze file complexity (TS/JS, Python, Go) |
| `analyze_function` | Analyze function complexity |
| `get_hotspots` | Find complexity hotspots |
| `compare_mccabe_dimensional` | Compare McCabe vs dimensional |
| `suggest_refactor` | Get refactoring suggestions |
| `get_dimension_breakdown` | Detailed dimension analysis |
| `generate_graph` | Generate dependency/call graph (v0.0.4) |
| `infer_module_type` | Infer module type from complexity profile (v0.0.4) |
| `check_canonical` | Check canonical bounds compliance (v0.0.4) |

## CLI

```bash
# Analyze project
npx semantic-complexity scan ./src

# Generate dependency graph
npx semantic-complexity graph ./src --format mermaid

# Generate call graph for a file
npx semantic-complexity graph ./src/index.ts --type call
```

## Roadmap

| Version | Features |
|---------|----------|
| v0.0.1 | Multi-domain complexity analysis, linear weighted sum |
| v0.0.2 | Canonical profiles, Meta-dimensions, Delta gates |
| v0.0.3 | 2nd-order Tensor, ε-regularization, 8 module types, Python/MCP |
| **v0.0.4** | **Go support, Graph generation, Module type inference, CLI enhancements** |
| v0.0.5 | Advanced topological analysis (Betti numbers) |
| v0.0.6 | IDE plugins (VSCode), CI/CD integration |

## References

### Complexity Theory
1. McCabe, T.J. (1976). "A Complexity Measure" - IEEE TSE
2. Halstead, M.H. (1977). "Elements of Software Science"

### Algebraic Topology
3. Borsuk-Ulam Theorem - Topological Fixed Point
4. Sperner's Lemma - Combinatorial Topology
5. Betti Numbers & Homology Groups - `H_n(X)` invariants

### Hodge Theory
6. Hodge, W.V.D. (1941). "The Theory and Applications of Harmonic Integrals"
7. Hodge Decomposition: `H^k(M) = ⊕_{p+q=k} H^{p,q}(M)`
8. de Rham Cohomology - Differential forms on manifolds

### Convergence & Fixed Points
9. Banach Fixed-Point Theorem - Contraction Mapping
10. Lyapunov Stability - ε-neighborhood convergence

## License

MIT
