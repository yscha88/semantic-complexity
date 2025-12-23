"""
CLI for semantic-complexity.

Usage:
    semantic-complexity <path>              # Analyze file or directory
    semantic-complexity <path> -f json      # Output as JSON
    semantic-complexity <path> -f markdown  # Output as Markdown report
    semantic-complexity <path> --threshold 20  # Show only functions above threshold
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Any

from semantic_complexity import __version__
from semantic_complexity.core import (
    DimensionalWeights,
    FunctionComplexity,
    analyze_functions,
    # v0.0.7: tensor/canonical support
    ModuleType,
    calculate_tensor_score,
    find_best_module_type,
    analyze_deviation,
    hodge_decomposition,
    recommend_refactoring,
    extract_vector,
)


def collect_python_files(path: Path) -> list[Path]:
    """Collect all Python files from path."""
    if path.is_file():
        return [path] if path.suffix == ".py" else []

    excludes = {"__pycache__", "node_modules", "venv", ".venv", "dist", "build"}
    files = []
    for p in path.rglob("*.py"):
        # Skip common excludes
        if any(part.startswith(".") or part in excludes for part in p.parts):
            continue
        files.append(p)
    return sorted(files)


def analyze_path(
    path: Path,
    weights: DimensionalWeights | None = None,
) -> dict[str, Any]:
    """Analyze a file or directory."""
    files = collect_python_files(path)

    results: list[dict[str, Any]] = []
    total_functions = 0
    total_mccabe = 0
    total_dimensional = 0.0

    for file_path in files:
        try:
            source = file_path.read_text(encoding="utf-8")
            functions = analyze_functions(source, str(file_path), weights)

            if functions:
                try:
                    rel_path = str(file_path.relative_to(path)) if path.is_dir() else file_path.name
                except ValueError:
                    rel_path = file_path.name
                total_dim = sum(f.dimensional.weighted for f in functions)
                file_result = {
                    "file": rel_path,
                    "functions": [func_to_dict(f) for f in functions],
                    "summary": {
                        "count": len(functions),
                        "totalMcCabe": sum(f.cyclomatic for f in functions),
                        "totalDimensional": round(total_dim, 1),
                    }
                }
                results.append(file_result)

                total_functions += len(functions)
                total_mccabe += sum(f.cyclomatic for f in functions)
                total_dimensional += sum(f.dimensional.weighted for f in functions)
        except Exception:
            # Skip files that fail to parse
            continue

    # Find hotspots (top 10 by dimensional complexity)
    all_functions = []
    for r in results:
        for f in r["functions"]:
            f["file"] = r["file"]
            all_functions.append(f)

    hotspots = sorted(all_functions, key=lambda x: x["dimensional"]["weighted"], reverse=True)[:10]

    avg_mccabe = round(total_mccabe / total_functions, 1) if total_functions > 0 else 0
    avg_dim = round(total_dimensional / total_functions, 1) if total_functions > 0 else 0

    return {
        "path": str(path),
        "summary": {
            "totalFiles": len(results),
            "totalFunctions": total_functions,
            "totalMcCabe": total_mccabe,
            "totalDimensional": round(total_dimensional, 1),
            "averageMcCabe": avg_mccabe,
            "averageDimensional": avg_dim,
        },
        "hotspots": hotspots,
        "files": results,
    }


def func_to_dict(f: FunctionComplexity) -> dict[str, Any]:
    """Convert FunctionComplexity to dict with full tensor/canonical analysis."""
    # Extract 5D vector from dimensional complexity
    vector = extract_vector(f.dimensional)

    # Infer best module type
    inferred_type, type_distance = find_best_module_type(vector)

    # Calculate tensor score
    tensor = calculate_tensor_score(f.dimensional, inferred_type)

    # Analyze deviation from canonical
    deviation = analyze_deviation(vector, inferred_type)

    # Hodge decomposition
    hodge = hodge_decomposition(vector)

    # Refactoring recommendations
    from semantic_complexity.core.tensor import Vector5D as WeightsVector
    weights = WeightsVector(1.0, 1.5, 2.0, 2.5, 3.0)
    recommendations = recommend_refactoring(vector, weights)

    return {
        "name": f.name,
        "line": f.lineno,
        "endLine": f.end_lineno,
        "cyclomatic": f.cyclomatic,
        "cognitive": f.cognitive,
        "dimensional": {
            "control": f.dimensional.control,
            "nesting": f.dimensional.nesting,
            "state": asdict(f.dimensional.state),
            "async": asdict(f.dimensional.async_),
            "coupling": asdict(f.dimensional.coupling),
            "weighted": f.dimensional.weighted,
            "contributions": f.dimensional.contributions,
        },
        # v0.0.7: Full tensor/canonical analysis
        "tensor": {
            "linear": tensor.linear,
            "quadratic": tensor.quadratic,
            "regularized": tensor.regularized,
            "rawSum": tensor.raw_sum,
            "rawSumThreshold": tensor.raw_sum_threshold,
            "rawSumRatio": tensor.raw_sum_ratio,
            "zone": "safe" if tensor.raw_sum_ratio < 0.7 else "review" if tensor.raw_sum_ratio < 1.0 else "violation",
        },
        "moduleType": {
            "inferred": inferred_type.value,
            "distance": type_distance,
            "confidence": round(1.0 / (1.0 + type_distance), 3),
        },
        "canonical": {
            "isCanonical": deviation.is_canonical,
            "isOrphan": deviation.is_orphan,
            "status": deviation.status,
            "euclideanDistance": deviation.euclidean_distance,
            "mahalanobisDistance": deviation.mahalanobis_distance,
            "violations": deviation.violation_dimensions,
        },
        "hodge": {
            "algorithmic": hodge.algorithmic,
            "architectural": hodge.architectural,
            "balanced": hodge.balanced,
            "total": hodge.total,
            "balanceRatio": hodge.balance_ratio,
            "isHarmonic": hodge.is_harmonic,
        },
        "recommendations": [
            {
                "dimension": r.dimension,
                "priority": r.priority,
                "action": r.action,
                "expectedImpact": r.expected_impact,
            }
            for r in recommendations
        ],
    }


def format_json(result: dict[str, Any]) -> str:
    """Format result as JSON."""
    return json.dumps(result, indent=2, ensure_ascii=False)


def format_markdown(result: dict[str, Any]) -> str:
    """Format result as Markdown report."""
    lines = [
        "# Complexity Analysis Report",
        "",
        f"**Path:** `{result['path']}`",
        "",
        "## Summary",
        "",
        "| Metric | Value |",
        "|--------|-------|",
        f"| Files analyzed | {result['summary']['totalFiles']} |",
        f"| Functions analyzed | {result['summary']['totalFunctions']} |",
        f"| Total McCabe | {result['summary']['totalMcCabe']} |",
        f"| Total Dimensional | {result['summary']['totalDimensional']} |",
        f"| Avg McCabe | {result['summary']['averageMcCabe']} |",
        f"| Avg Dimensional | {result['summary']['averageDimensional']} |",
        "",
    ]

    if result["hotspots"]:
        lines.extend([
            "## Hotspots (Top 10)",
            "",
            "| Function | File | Line | McCabe | Dimensional | Ratio |",
            "|----------|------|------|--------|-------------|-------|",
        ])

        for h in result["hotspots"]:
            mccabe = h["cyclomatic"]
            dim = h["dimensional"]["weighted"]
            ratio = round(dim / mccabe, 2) if mccabe > 0 else 0
            name, file, line = h["name"], h.get("file", "N/A"), h["line"]
            lines.append(f"| `{name}` | {file} | {line} | {mccabe} | {dim} | {ratio}x |")

        lines.append("")

    # Dimension breakdown for hotspots
    if result["hotspots"]:
        lines.extend([
            "## Dimension Analysis",
            "",
        ])

        for h in result["hotspots"][:5]:
            d = h["dimensional"]
            c = d.get("contributions", {})
            s, a, cp = d["state"], d["async"], d["coupling"]

            lines.extend([
                f"### `{h['name']}` (Line {h['line']})",
                "",
                f"- **Control (1D):** {d['control']} ({c.get('control', 0)*100:.1f}%)",
                f"- **Nesting (2D):** {d['nesting']} ({c.get('nesting', 0)*100:.1f}%)",
                f"- **State (3D):** mut={s['state_mutations']}, read={s['state_reads']} "
                f"({c.get('state', 0)*100:.1f}%)",
                f"- **Async (4D):** await={a['await_count']}, boundary={a['async_boundaries']} "
                f"({c.get('async', 0)*100:.1f}%)",
                f"- **Coupling (5D):** global={cp['global_access']}, io={cp['implicit_io']} "
                f"({c.get('coupling', 0)*100:.1f}%)",
                "",
            ])

    return "\n".join(lines)


def main() -> int:
    """Main CLI entrypoint."""
    parser = argparse.ArgumentParser(
        prog="semantic-complexity",
        description="Multi-dimensional code complexity analyzer for Python",
    )
    parser.add_argument(
        "-V", "--version",
        action="version",
        version=f"%(prog)s {__version__}",
    )
    parser.add_argument(
        "path",
        type=Path,
        nargs="?",
        help="File or directory to analyze",
    )
    parser.add_argument(
        "-o", "--output",
        type=Path,
        help="Output file path",
    )
    parser.add_argument(
        "-f", "--format",
        choices=["json", "markdown"],
        default="json",
        help="Output format (default: json)",
    )
    parser.add_argument(
        "-t", "--threshold",
        type=float,
        default=0,
        help="Only show functions with dimensional complexity above threshold",
    )
    parser.add_argument(
        "-w", "--weights",
        type=str,
        help="Custom weights as JSON: '{\"control\": 1.0, \"nesting\": 1.5, ...}'",
    )

    args = parser.parse_args()

    if args.path is None:
        parser.print_help()
        return 0

    if not args.path.exists():
        print(f"Error: Path not found: {args.path}", file=sys.stderr)
        return 1

    # Parse custom weights
    weights = None
    if args.weights:
        try:
            w = json.loads(args.weights)
            weights = DimensionalWeights(
                control=w.get("control", 1.0),
                nesting=w.get("nesting", 1.5),
                state=w.get("state", 2.0),
                async_=w.get("async", 2.5),
                coupling=w.get("coupling", 3.0),
            )
        except json.JSONDecodeError:
            print("Error: Invalid weights JSON", file=sys.stderr)
            return 1

    # Analyze
    result = analyze_path(args.path, weights)

    # Apply threshold filter
    if args.threshold > 0:
        result["hotspots"] = [
            h for h in result["hotspots"]
            if h["dimensional"]["weighted"] >= args.threshold
        ]
        for f in result["files"]:
            f["functions"] = [
                fn for fn in f["functions"]
                if fn["dimensional"]["weighted"] >= args.threshold
            ]

    # Format output
    if args.format == "json":
        output = format_json(result)
    else:
        output = format_markdown(result)

    # Write or print
    if args.output:
        args.output.write_text(output, encoding="utf-8")
        print(f"Report written to: {args.output}")
    else:
        print(output)

    return 0


if __name__ == "__main__":
    sys.exit(main())
