# Changelog

---

## [0.0.21] - 2026-01-03

### CLI Version Flag

Added `--version` flag to all MCP servers:

```bash
# Python
semantic-complexity-py-mcp --version
# semantic-complexity-py-mcp 0.0.21

# TypeScript
npx -y semantic-complexity-mcp --version
# semantic-complexity-mcp 0.0.21

# Go
sc-go-mcp --version
# sc-go-mcp 0.0.21
```

---

## [0.0.20] - 2026-01-03

### MCP Document Resources

Added MCP resources so LLMs can understand how to use the tools and learn the theoretical background after installation.

#### MCP Document Resources

| Resource URI | Content |
|--------------|---------|
| `docs://usage-guide` | Usage guide (3-axis model, tool scenarios, Gate stages) |
| `docs://theory` | Theoretical foundation (Ham Sandwich Theorem, Lyapunov stability) |
| `docs://srs` | Software Requirements Specification (module types, Gate system) |
| `docs://sds` | Software Design Specification (ML pipeline, algorithms) |

**Implementation:**
| Language | Method |
|----------|--------|
| Python | `@mcp.resource("docs://...")` decorator |
| TypeScript | `ListResourcesRequestSchema` + `ReadResourceRequestSchema` |
| Go | `mcp.NewResource()` + `s.AddResource()` |

#### English Documentation

| File | Description |
|------|-------------|
| `docs/THEORY.md` | Theoretical foundation (English) |
| `docs/SRS.md` | Software Requirements Specification (English) |
| `docs/SDS.md` | Software Design Specification (English) |
| `docs/CHANGELOG.md` | Changelog (English) |

#### Feature Matrix

| Feature | Python | TypeScript | Go |
|---------|--------|------------|-----|
| analyze_sandwich | ✅ | ✅ | ✅ |
| analyze_cheese | ✅ | ✅ | ✅ |
| check_gate | ✅ | ✅ | ✅ |
| suggest_refactor | ✅ | ✅ | ✅ |
| check_budget | ✅ | ✅ | ✅ |
| get_label | ✅ | ✅ | ✅ |
| check_degradation | ✅ | ✅ | ✅ |
| External .waiver.json | ✅ | ✅ | ✅ |
| **MCP Document Resources** | ✅ | ✅ | ✅ |

---

## [0.0.19] - 2026-01-02

### Go Module Path Fix

- Changed Go module path to `github.com/yscha88/semantic-complexity/src/go`
- Updated all internal import paths
- Applied submodule structure for `go install ...@latest` support

---

## [0.0.18] - 2026-01-02

### Project Structure Cleanup

- Renamed Go binary: `cmd/mcp` → `cmd/sc-go-mcp`
- Added README.md with MCP installation guide

---

## [0.0.17] - 2026-01-02

### GitHub Actions Workflow Improvements

#### Auto Go Submodule Tag Creation

```yaml
on:
  push:
    tags:
      - '[0-9]*'  # X.Y.Z format

- name: Create Go submodule tag
  run: |
    VERSION=${GITHUB_REF#refs/tags/}
    GO_TAG="src/go/v$VERSION"
    git tag "$GO_TAG" && git push origin "$GO_TAG"
```

- Trigger: `X.Y.Z` format tag push
- Action: Auto-create `src/go/vX.Y.Z` submodule tag
- Effect: `go install ...@latest` support

---

## [0.0.16] - 2026-01-02

### Workspace Settings and Waiver Extensions

#### TypeScript External .waiver.json Support
- `parseWaiverFile()` - JSON parsing
- `findWaiverFile()` - Parent directory traversal
- `matchFilePattern()` - Glob pattern matching
- `isWaiverExpired()` - Expiration check
- `checkExternalWaiver()` - External waiver check
- `checkWaiver()` - Unified API (external first, inline fallback)

---

## [0.0.15] - 2026-01-02

### TypeScript/Go MCP Synchronization + JSON Format Unification

Synchronized MCP tools and features across Python, TypeScript, and Go.

#### Go Implementation

New Go implementation of semantic-complexity:

**Package Structure:**
```
src/go/
├── cmd/sc-go-mcp/   # MCP server entry point
├── pkg/analyzer/    # Bread, Cheese, Ham analyzers
├── pkg/gate/        # Gate and Waiver system
├── pkg/simplex/     # Normalization and equilibrium
└── pkg/types/       # Common type definitions
```

**MCP Tools (same as Python/TypeScript):**
- `analyze_sandwich` - 3-axis complexity analysis
- `check_gate` - Gate check (with waiver)
- `analyze_cheese` - Cognitive accessibility analysis
- `suggest_refactor` - Refactoring recommendations
- `check_budget` - PR change budget check
- `get_label` - Dominant axis label
- `check_degradation` - Cognitive degradation detection

#### TypeScript MCP Tool Additions (synced with Python)
- `suggest_refactor` - Refactoring recommendations
- `check_budget` - PR change budget check
- `get_label` - Dominant axis label
- `check_degradation` - Cognitive degradation detection

#### JSON Field Name Case Unification (camelCase)

Unified all Go JSON tags to camelCase to match TypeScript:

| Type | Before (snake_case) | After (camelCase) |
|------|---------------------|-------------------|
| CheeseResult | `max_nesting` | `maxNesting` |
| | `hidden_dependencies` | `hiddenDependencies` |
| GateResult | `gate_type` | `gateType` |
| | `waiver_applied` | `waiverApplied` |

---

## [0.0.14] - 2026-01-02

### External Waiver File Support + Schema Improvements

#### `.waiver.json` External File Support

Project-level waiver management via external file:

```json
{
  "$schema": "https://semantic-complexity.dev/schemas/waiver.json",
  "version": "1.0",
  "waivers": [
    {
      "pattern": "src/crypto/*.py",
      "adr": "ADR-007",
      "justification": "AES-256 encryption algorithm",
      "approved_at": "2025-01-15",
      "expires_at": "2025-12-31",
      "approver": "security-team"
    }
  ]
}
```

---

## [0.0.13] - 2025-12-30

### Essential Complexity Waiver + 3-Stage Gate System

#### 3-Stage Gate System

| Stage | Strictness | Waiver | Purpose |
|-------|------------|--------|---------|
| **PoC** | Loose | ❌ | Quick validation |
| **MVP** | Tight | ❌ | First release, enforce design |
| **Production** | Strict | ✅ | Allow proven tech debt |

#### Essential Complexity Waiver

```python
__module_type__ = "lib/domain"
__essential_complexity__ = {
    "adr": "docs/adr/003-inference.md",
}
```

- Only applicable in Production Gate
- Requires ADR file reference
- PoC/MVP do not allow waivers

---

For detailed Korean changelog, see [CHANGELOG.ko.md](./CHANGELOG.ko.md).
