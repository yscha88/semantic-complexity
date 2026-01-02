# semantic-complexity (Python)

Multi-dimensional code complexity analyzer for Python.

## Installation

```bash
pip install semantic-complexity
```

### uv를 통한 설치

```bash
# 글로벌 도구로 설치
uv tool install semantic-complexity

# 또는 일회성 실행
uvx semantic-complexity path/to/file.py
```

## MCP 서버 설치

Claude Code에서 MCP 서버로 사용하려면:

```bash
# MCP 서버 추가 (Python 버전)
claude mcp add sc-py "uvx --from semantic-complexity semantic-complexity-py-mcp"
```

### 기존 MCP 업데이트/재설치

```bash
# 1. 기존 MCP 삭제
claude mcp remove sc-py

# 2. 캐시 정리 (최신 버전 반영)
uv cache clean semantic-complexity --force

# 3. 재설치
claude mcp add sc-py "uvx --from semantic-complexity semantic-complexity-py-mcp"

# 설치 확인
claude mcp list
```

## Usage

### CLI

```bash
# Analyze a file
semantic-complexity path/to/file.py

# Analyze a directory
semantic-complexity path/to/project/

# Output as Markdown report
semantic-complexity path/to/project/ -f markdown -o report.md

# Filter by threshold
semantic-complexity path/to/project/ --threshold 20
```

### Python API

```python
from semantic_complexity import analyze_source, analyze_functions

# Analyze source code
result = analyze_source("""
def complex_function(x):
    if x > 0:
        for i in range(x):
            if i % 2 == 0:
                print(i)
""")

print(f"Weighted complexity: {result.weighted}")
print(f"Control: {result.control}")
print(f"Nesting: {result.nesting}")
print(f"Contributions: {result.contributions}")

# Analyze functions individually
functions = analyze_functions(source)
for fn in functions:
    print(f"{fn.name}: McCabe={fn.cyclomatic}, Dimensional={fn.dimensional.weighted}")
```

## Domains

| Domain | Weight | Description |
|--------|--------|-------------|
| Control (C) | 1.0 | Cyclomatic complexity (branches, loops) |
| Nesting (N) | 1.5 | Depth penalty |
| State (S) | 2.0 | State mutations and transitions |
| Async (A) | 2.5 | Async/await, coroutines |
| Coupling (Λ) | 3.0 | Hidden dependencies, side effects |

## License

MIT
