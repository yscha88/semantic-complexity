# semantic-complexity

Code complexity analyzer based on Ham Sandwich Theorem

> [한국어](README.ko.md)

## MCP Server Installation

### Python

```bash
# Install
claude mcp add sc-py -- "uvx --from semantic-complexity semantic-complexity-py-mcp"

# Update
uv cache clean && uvx --from semantic-complexity semantic-complexity-py-mcp --version

# Remove
claude mcp remove sc-py

# Reinstall
uv cache clean && claude mcp remove sc-py && claude mcp add sc-py -- "uvx --from semantic-complexity semantic-complexity-py-mcp"
```

### TypeScript

```bash
# Install
claude mcp add sc-ts -- npx -y -p semantic-complexity semantic-complexity-ts-mcp

# Update (clear npx cache and re-run)
npm cache clean --force && npx -y -p semantic-complexity semantic-complexity-ts-mcp --version

# Remove
claude mcp remove sc-ts

# Reinstall
npm cache clean --force && claude mcp remove sc-ts && claude mcp add sc-ts -- npx -y -p semantic-complexity semantic-complexity-ts-mcp
```

### Go

```bash
# Install (go install)
go install github.com/yscha88/semantic-complexity/src/go/cmd/sc-go-mcp@latest
claude mcp add sc-go -- sc-go-mcp

# Update
go install github.com/yscha88/semantic-complexity/src/go/cmd/sc-go-mcp@latest

# Build (local)
cd src/go && go build -o sc-go-mcp ./cmd/sc-go-mcp
claude mcp add sc-go -- /path/to/sc-go-mcp

# Remove
claude mcp remove sc-go

# Clear cache
go clean -cache -modcache

# Reinstall
go clean -cache && go install github.com/yscha88/semantic-complexity/src/go/cmd/sc-go-mcp@latest
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `analyze_sandwich` | Full complexity analysis (Bread + Cheese + Ham 3-axis) |
| `analyze_cheese` | Cognitive accessibility analysis |
| `check_gate` | Release gate check (MVP/Production) |
| `suggest_refactor` | Refactoring recommendations |
| `check_budget` | PR change budget check |
| `get_label` | Module dominant axis label |
| `check_degradation` | Cognitive degradation detection |

## MCP Resources

| URI | Description |
|-----|-------------|
| `docs://usage-guide` | Usage guide (3-axis model, tool scenarios, cognitive complexity) |
| `docs://theory` | Theoretical foundation (Ham Sandwich Theorem, Lyapunov stability) |
| `docs://srs` | Software Requirements Specification |
| `docs://sds` | Software Design Specification |

## Version Check

```bash
# Python
uvx --from semantic-complexity semantic-complexity-py-mcp --version

# TypeScript
npx -y -p semantic-complexity semantic-complexity-ts-mcp --version

# Go
sc-go-mcp --version
```

## Documentation

- [Theory](docs/THEORY.md) - Ham Sandwich Theorem based theory
- [Requirements](docs/SRS.md) - Software Requirements Specification
- [Design](docs/SDS.md) - Software Design Specification
- [Changelog](docs/CHANGELOG.md) - Version history
