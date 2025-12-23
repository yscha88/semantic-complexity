# semantic-complexity-cli

CLI tool for semantic complexity analysis and reporting.

## Installation

```bash
npm install -g semantic-complexity-cli
```

## Usage

### Analyze Directory

```bash
semantic-complexity summary ./src
```

### Generate Report

```bash
semantic-complexity analyze ./src -o report -f html
semantic-complexity analyze ./src -o report -f json
```

### Options

```
Commands:
  summary <path>   Quick complexity summary
  analyze <path>   Detailed analysis with report generation

Options:
  -o, --output <dir>    Output directory (default: ./report)
  -f, --format <type>   Output format: html, json, markdown (default: html)
  -t, --threshold <n>   Complexity threshold (default: 10)
  --ignore <patterns>   Glob patterns to ignore
  -h, --help           Display help
```

## Example Output

```
📊 Complexity Summary
━━━━━━━━━━━━━━━━━━━━━

Files analyzed: 15
Total functions: 87

🔴 High complexity (>10): 3
🟡 Medium complexity (5-10): 12
🟢 Low complexity (<5): 72

Top 5 complex functions:
  1. processData (src/handler.ts:45) - 15.2
  2. validateInput (src/validator.ts:12) - 12.8
  3. renderComponent (src/ui/Card.tsx:30) - 11.5
```

## Documentation

Full documentation: [GitHub Repository](https://github.com/yscha88/semantic-complexity)

## License

MIT
