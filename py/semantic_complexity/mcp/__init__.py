"""
semantic-complexity-py-mcp

MCP Server for Python complexity analysis.
Provides tools for Claude and other LLMs to analyze Python code complexity.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

from semantic_complexity import __version__
from semantic_complexity.core import (
    analyze_functions,
    ModuleType,
    calculate_tensor_score,
    find_best_module_type,
    analyze_deviation,
    hodge_decomposition,
    recommend_refactoring,
    extract_vector,
    Vector5D,
    CANONICAL_PROFILES,
)


def create_server() -> Server:
    """Create and configure the MCP server."""
    server = Server("semantic-complexity-py-mcp")

    @server.list_tools()
    async def list_tools() -> list[Tool]:
        return [
            Tool(
                name="get_hotspots",
                description="""[ENTRY POINT] Find complexity hotspots in Python code.

USE THIS FIRST when user mentions:
- "refactoring", "리팩토링", "개선"
- "code quality", "코드 품질"
- "what should I improve?", "뭐 고쳐야 해?"
- "복잡한 코드", "복잡도"

Returns top N functions sorted by dimensional complexity.""",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "directory": {
                            "type": "string",
                            "description": "Directory path to scan for Python files",
                        },
                        "moduleType": {
                            "type": "string",
                            "enum": ["api", "lib", "app", "web", "data", "infra", "deploy"],
                            "description": "Module type for canonical profile comparison",
                        },
                        "topN": {
                            "type": "number",
                            "description": "Number of hotspots to return (default: 10)",
                            "default": 10,
                        },
                        "pattern": {
                            "type": "string",
                            "description": "Glob pattern for files (default: **/*.py)",
                            "default": "**/*.py",
                        },
                    },
                    "required": ["directory", "moduleType"],
                },
            ),
            Tool(
                name="analyze_file",
                description="""Analyze complexity of all functions in a Python file.

USE when:
- User opens or mentions a specific Python file
- After get_hotspots identifies a problematic file
- User asks "이 파일 분석해줘", "analyze this file"

Returns McCabe, cognitive, and dimensional complexity for each function.""",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "filePath": {
                            "type": "string",
                            "description": "Path to the Python file to analyze",
                        },
                        "moduleType": {
                            "type": "string",
                            "enum": ["api", "lib", "app", "web", "data", "infra", "deploy"],
                            "description": "Module type for canonical profile comparison",
                        },
                        "threshold": {
                            "type": "number",
                            "description": "Minimum dimensional complexity to include (default: 0)",
                            "default": 0,
                        },
                    },
                    "required": ["filePath", "moduleType"],
                },
            ),
            Tool(
                name="analyze_function",
                description="""Deep analysis of a specific function with full dimensional breakdown.

USE when:
- User asks about a specific function
- After get_hotspots/analyze_file identifies a complex function
- User wants to understand WHY a function is complex

Returns 5-dimension breakdown, tensor score, canonical deviation, and recommendations.""",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "filePath": {
                            "type": "string",
                            "description": "Path to the file containing the function",
                        },
                        "functionName": {
                            "type": "string",
                            "description": "Name of the function to analyze",
                        },
                        "moduleType": {
                            "type": "string",
                            "enum": ["api", "lib", "app", "web", "data", "infra", "deploy"],
                            "description": "Module type for canonical profile comparison",
                        },
                    },
                    "required": ["filePath", "functionName", "moduleType"],
                },
            ),
            Tool(
                name="suggest_refactor",
                description="""Get actionable refactoring suggestions based on complexity profile.

USE when:
- User asks "어떻게 고쳐?", "how to fix?"
- After analyze_function shows high complexity
- User mentions "리팩토링", "refactor"

Returns prioritized suggestions based on the dominant complexity dimension.""",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "filePath": {
                            "type": "string",
                            "description": "Path to the file",
                        },
                        "functionName": {
                            "type": "string",
                            "description": "Name of the function to get suggestions for",
                        },
                        "moduleType": {
                            "type": "string",
                            "enum": ["api", "lib", "app", "web", "data", "infra", "deploy"],
                            "description": "Module type for canonical profile comparison",
                        },
                    },
                    "required": ["filePath", "functionName", "moduleType"],
                },
            ),
            Tool(
                name="validate_complexity",
                description="""Validate if code fits within canonical complexity bounds.

USE when:
- After writing new code (CI integration)
- PR review quality gate
- User asks "이거 괜찮아?", "is this okay?"

Checks bounds against specified module type. Returns pass/fail status.""",
                inputSchema={
                    "type": "object",
                    "properties": {
                        "filePath": {
                            "type": "string",
                            "description": "Path to the file",
                        },
                        "functionName": {
                            "type": "string",
                            "description": "Name of the function (optional: if omitted, validates entire file)",
                        },
                        "moduleType": {
                            "type": "string",
                            "enum": ["api", "lib", "app", "web", "data", "infra", "deploy"],
                            "description": "Module type for canonical profile comparison",
                        },
                    },
                    "required": ["filePath", "moduleType"],
                },
            ),
        ]

    @server.call_tool()
    async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
        try:
            if name == "get_hotspots":
                result = get_hotspots(
                    arguments["directory"],
                    arguments["moduleType"],
                    arguments.get("topN", 10),
                    arguments.get("pattern", "**/*.py"),
                )
            elif name == "analyze_file":
                result = analyze_file(
                    arguments["filePath"],
                    arguments["moduleType"],
                    arguments.get("threshold", 0),
                )
            elif name == "analyze_function":
                result = analyze_function_detail(
                    arguments["filePath"],
                    arguments["functionName"],
                    arguments["moduleType"],
                )
            elif name == "suggest_refactor":
                result = suggest_refactor(
                    arguments["filePath"],
                    arguments["functionName"],
                    arguments["moduleType"],
                )
            elif name == "validate_complexity":
                result = validate_complexity(
                    arguments["filePath"],
                    arguments["moduleType"],
                    arguments.get("functionName"),
                )
            else:
                result = {"error": f"Unknown tool: {name}"}

            return [TextContent(type="text", text=json.dumps(result, indent=2))]
        except Exception as e:
            return [TextContent(type="text", text=json.dumps({"error": str(e)}))]

    return server


def collect_python_files(directory: str, pattern: str = "**/*.py") -> list[Path]:
    """Collect Python files matching pattern."""
    base = Path(directory)
    excludes = {"__pycache__", "node_modules", "venv", ".venv", "dist", "build", ".git"}
    files = []
    for p in base.glob(pattern):
        if any(part.startswith(".") or part in excludes for part in p.parts):
            continue
        if p.is_file():
            files.append(p)
    return sorted(files)


def func_to_dict(f: Any, module_type: ModuleType) -> dict[str, Any]:
    """Convert FunctionComplexity to dict with tensor/canonical."""
    vector = extract_vector(f.dimensional)
    tensor = calculate_tensor_score(f.dimensional, module_type)
    deviation = analyze_deviation(vector, module_type)
    hodge = hodge_decomposition(vector)
    weights = Vector5D(1.0, 1.5, 2.0, 2.5, 3.0)
    recommendations = recommend_refactoring(vector, weights)

    return {
        "name": f.name,
        "line": f.lineno,
        "mccabe": f.mccabe,
        "cognitive": f.cognitive,
        "dimensional": f.dimensional.total,
        "dimensions": {
            "control": f.dimensional.control,
            "nesting": f.dimensional.nesting,
            "state": f.dimensional.state,
            "async_": f.dimensional.async_,
            "coupling": f.dimensional.coupling,
        },
        "tensor": {
            "score": tensor.score,
            "zone": tensor.zone,
            "rawSum": tensor.raw_sum,
            "rawSumThreshold": tensor.raw_sum_threshold,
            "rawSumRatio": tensor.raw_sum_ratio,
        },
        "moduleType": module_type.value,
        "canonical": {
            "profile": module_type.value,
            "deviation": deviation.total_deviation,
            "violations": deviation.violations,
        },
        "hodge": {
            "algorithmic": hodge.algorithmic,
            "balanced": hodge.balanced,
            "architectural": hodge.architectural,
        },
        "recommendations": [
            {"priority": i + 1, "suggestion": r}
            for i, r in enumerate(recommendations[:3])
        ],
    }


def get_hotspots(
    directory: str,
    module_type: str,
    top_n: int = 10,
    pattern: str = "**/*.py",
) -> dict[str, Any]:
    """Find complexity hotspots."""
    mt = ModuleType(module_type)
    files = collect_python_files(directory, pattern)
    all_functions = []

    for file_path in files:
        try:
            content = file_path.read_text(encoding="utf-8")
            functions = analyze_functions(content, str(file_path))
            for f in functions:
                data = func_to_dict(f, mt)
                data["file"] = str(file_path)
                all_functions.append(data)
        except Exception:
            continue

    # Sort by dimensional complexity
    all_functions.sort(key=lambda x: x["dimensional"], reverse=True)

    return {
        "totalFiles": len(files),
        "totalFunctions": len(all_functions),
        "moduleType": module_type,
        "hotspots": all_functions[:top_n],
    }


def analyze_file(
    file_path: str,
    module_type: str,
    threshold: float = 0,
) -> dict[str, Any]:
    """Analyze all functions in a file."""
    mt = ModuleType(module_type)
    path = Path(file_path)
    if not path.exists():
        return {"error": f"File not found: {file_path}"}

    content = path.read_text(encoding="utf-8")
    functions = analyze_functions(content, file_path)

    results = []
    for f in functions:
        data = func_to_dict(f, mt)
        if data["dimensional"] >= threshold:
            results.append(data)

    return {
        "file": file_path,
        "moduleType": module_type,
        "functions": results,
        "summary": {
            "total": len(results),
            "avgDimensional": sum(r["dimensional"] for r in results) / len(results) if results else 0,
        },
    }


def analyze_function_detail(
    file_path: str,
    function_name: str,
    module_type: str,
) -> dict[str, Any]:
    """Deep analysis of a specific function."""
    mt = ModuleType(module_type)
    path = Path(file_path)
    if not path.exists():
        return {"error": f"File not found: {file_path}"}

    content = path.read_text(encoding="utf-8")
    functions = analyze_functions(content, file_path)

    for f in functions:
        if f.name == function_name:
            data = func_to_dict(f, mt)
            data["file"] = file_path

            # Add McCabe vs Dimensional comparison
            ratio = data["dimensional"] / data["mccabe"] if data["mccabe"] > 0 else 0
            data["comparison"] = {
                "mccabe": data["mccabe"],
                "dimensional": data["dimensional"],
                "ratio": round(ratio, 2),
                "hiddenComplexity": "high" if ratio > 3 else "medium" if ratio > 2 else "low",
            }
            return data

    return {"error": f"Function '{function_name}' not found in {file_path}"}


def suggest_refactor(
    file_path: str,
    function_name: str,
    module_type: str,
) -> dict[str, Any]:
    """Get refactoring suggestions for a function."""
    result = analyze_function_detail(file_path, function_name, module_type)
    if "error" in result:
        return result

    suggestions = []
    dims = result["dimensions"]

    # Prioritize by highest dimension
    dim_values = [
        ("control", dims["control"], "Extract smaller functions, use polymorphism"),
        ("nesting", dims["nesting"], "Flatten with early returns, extract methods"),
        ("state", dims["state"], "Use immutable patterns, reduce mutations"),
        ("async_", dims["async_"], "Simplify async flow, use async utilities"),
        ("coupling", dims["coupling"], "Dependency injection, reduce global access"),
    ]
    dim_values.sort(key=lambda x: x[1], reverse=True)

    for dim_name, value, suggestion in dim_values:
        if value > 0:
            suggestions.append({
                "dimension": dim_name,
                "currentValue": value,
                "suggestion": suggestion,
                "priority": "high" if value > 5 else "medium" if value > 2 else "low",
            })

    return {
        "function": function_name,
        "file": file_path,
        "moduleType": module_type,
        "currentComplexity": result["dimensional"],
        "suggestions": suggestions[:5],
    }


def validate_complexity(
    file_path: str,
    module_type: str,
    function_name: str | None = None,
) -> dict[str, Any]:
    """Validate complexity against canonical bounds."""
    mt = ModuleType(module_type)
    path = Path(file_path)
    if not path.exists():
        return {"error": f"File not found: {file_path}"}

    content = path.read_text(encoding="utf-8")
    functions = analyze_functions(content, file_path)

    if function_name:
        functions = [f for f in functions if f.name == function_name]
        if not functions:
            return {"error": f"Function '{function_name}' not found"}

    results = []
    for f in functions:
        data = func_to_dict(f, mt)

        # Check zone
        zone = data["tensor"]["zone"]
        passed = zone == "safe"

        results.append({
            "function": f.name,
            "moduleType": module_type,
            "zone": zone,
            "passed": passed,
            "tensor": data["tensor"],
            "violations": data["canonical"]["violations"],
        })

    all_passed = all(r["passed"] for r in results)

    return {
        "file": file_path,
        "moduleType": module_type,
        "passed": all_passed,
        "results": results,
        "summary": {
            "total": len(results),
            "passed": sum(1 for r in results if r["passed"]),
            "failed": sum(1 for r in results if not r["passed"]),
        },
    }


async def run_server():
    """Run the MCP server."""
    server = create_server()
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


def main():
    """Entry point for the MCP server."""
    parser = argparse.ArgumentParser(description="Semantic Complexity Python MCP Server")
    parser.add_argument("-V", "--version", action="store_true", help="Show version")
    args = parser.parse_args()

    if args.version:
        print(__version__)
        sys.exit(0)

    asyncio.run(run_server())


if __name__ == "__main__":
    main()
