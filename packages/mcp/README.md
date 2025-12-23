# semantic-complexity-mcp

MCP (Model Context Protocol) server for semantic complexity analysis. Integrates with Claude and other LLMs.

## Installation

```bash
npm install -g semantic-complexity-mcp
```

## Claude Code Configuration

Add to your MCP settings:

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

## Available Tools

| Tool | Description |
|------|-------------|
| `analyze_file` | Analyze file complexity |
| `analyze_function` | Analyze specific function |
| `get_hotspots` | Find complexity hotspots |
| `compare_mccabe_dimensional` | Compare McCabe vs dimensional |
| `suggest_refactor` | Get refactoring suggestions |
| `get_dimension_breakdown` | Detailed dimension analysis |

## Features

- **Auto Language Detection**: TypeScript/JavaScript + Python
- **Cross-Platform**: Linux, Mac, Windows
- **Python Command Fallback**: `python3` → `python` → `py`

## Supported Languages

| Language | Extensions |
|----------|------------|
| TypeScript | `.ts`, `.tsx` |
| JavaScript | `.js`, `.jsx`, `.mjs`, `.cjs` |
| Python | `.py`, `.pyw` |

## Example Usage in Claude

```
User: Analyze the complexity of src/handlers/auth.ts

Claude: [Uses analyze_file tool]
The file has 5 functions with the following complexity scores:
- login(): 8.5 (medium)
- logout(): 2.1 (low)
- validateToken(): 12.3 (high - needs review)
...
```

## Documentation

Full documentation: [GitHub Repository](https://github.com/yscha88/semantic-complexity)

## License

MIT
