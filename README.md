# semantic-complexity

Multi-dimensional code complexity analyzer — Security × Cognitive × Behavioral

> [한국어](README.ko.md)

## What it does

Overcomes the limits of traditional static analysis (McCabe, etc.) by combining
LLM semantic reasoning + SKILLS (policy frame) + MCP (quantitative measurement).

| Axis | Measures | Core |
|------|----------|------|
| 🍞 **Bread** (Security) | Trust boundary, auth, secrets | Structural stability |
| 🧀 **Cheese** (Cognitive) | Nesting, concept count, state×async×retry | Comprehensibility |
| 🥓 **Ham** (Behavioral) | Golden test, contract test, critical path | Behavior preservation |

## MCP Server

### Python
```bash
claude mcp add sc-py -- "uvx --from semantic-complexity semantic-complexity-py-mcp"
```

### TypeScript
```bash
claude mcp add sc-ts -- npx -y -p semantic-complexity semantic-complexity-ts-mcp
```

### Go
```bash
go install github.com/yscha88/semantic-complexity/src/go/cmd/sc-go-mcp@latest
claude mcp add sc-go -- sc-go-mcp
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `analyze_sandwich` | Full 3-axis complexity analysis |
| `analyze_cheese` | Cognitive accessibility analysis |
| `check_gate` | Release gate check (PoC/MVP/Production) |
| `suggest_refactor` | Refactoring recommendations |
| `check_budget` | PR change budget check |
| `get_label` | Module dominant axis label |
| `check_degradation` | Cognitive degradation detection |

## Documentation

- [Theory (한국어)](docs/THEORY.ko.md) — Theoretical foundation + explicit limitations
- [Stability Invariants](docs/STABILITY_INVARIANTS.md) — Hard safety boundaries
- [LLM Refactoring Protocol](docs/LLM_REFACTORING_PROTOCOL.md) — Allowed/prohibited LLM actions
- [Module Types (한국어)](docs/MODULE_TYPES.ko.md) — Architecture role taxonomy
