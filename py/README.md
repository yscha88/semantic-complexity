# semantic-complexity (Python)

Multi-dimensional code complexity analyzer for Python.

## Installation

```bash
pip install semantic-complexity
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
print(f"Control (1D): {result.control}")
print(f"Nesting (2D): {result.nesting}")
print(f"Contributions: {result.contributions}")

# Analyze functions individually
functions = analyze_functions(source)
for fn in functions:
    print(f"{fn.name}: McCabe={fn.cyclomatic}, Dimensional={fn.dimensional.weighted}")
```

## Dimensions

| Dimension | Weight | Description |
|-----------|--------|-------------|
| 1D Control | 1.0 | Cyclomatic complexity (branches, loops) |
| 2D Nesting | 1.5 | Depth penalty |
| 3D State | 2.0 | State mutations and transitions |
| 4D Async | 2.5 | Async/await, coroutines |
| 5D Coupling | 3.0 | Hidden dependencies, side effects |

## License

MIT
