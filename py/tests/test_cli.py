"""Tests for CLI module."""

from __future__ import annotations

import json
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

from semantic_complexity.cli import (
    analyze_path,
    collect_python_files,
    format_json,
    format_markdown,
    func_to_dict,
    main,
)
from semantic_complexity.core import FunctionComplexity, analyze_functions


# ─────────────────────────────────────────────────────────────────
# collect_python_files Tests
# ─────────────────────────────────────────────────────────────────


class TestCollectPythonFiles:
    """Tests for collect_python_files function."""

    def test_collect_single_file(self, tmp_path: Path) -> None:
        """Should return single file when given a .py file."""
        py_file = tmp_path / "test.py"
        py_file.write_text("x = 1")

        files = collect_python_files(py_file)

        assert len(files) == 1
        assert files[0] == py_file

    def test_collect_non_python_file(self, tmp_path: Path) -> None:
        """Should return empty list for non-Python file."""
        txt_file = tmp_path / "test.txt"
        txt_file.write_text("hello")

        files = collect_python_files(txt_file)

        assert len(files) == 0

    def test_collect_directory(self, tmp_path: Path) -> None:
        """Should collect all Python files in directory."""
        (tmp_path / "a.py").write_text("x = 1")
        (tmp_path / "b.py").write_text("y = 2")
        (tmp_path / "c.txt").write_text("not python")

        files = collect_python_files(tmp_path)

        assert len(files) == 2
        assert all(f.suffix == ".py" for f in files)

    def test_collect_nested_directory(self, tmp_path: Path) -> None:
        """Should collect Python files recursively."""
        (tmp_path / "a.py").write_text("x = 1")
        subdir = tmp_path / "subdir"
        subdir.mkdir()
        (subdir / "b.py").write_text("y = 2")

        files = collect_python_files(tmp_path)

        assert len(files) == 2

    def test_exclude_pycache(self, tmp_path: Path) -> None:
        """Should exclude __pycache__ directories."""
        (tmp_path / "a.py").write_text("x = 1")
        pycache = tmp_path / "__pycache__"
        pycache.mkdir()
        (pycache / "cached.py").write_text("cached")

        files = collect_python_files(tmp_path)

        assert len(files) == 1
        assert "__pycache__" not in str(files[0])

    def test_exclude_venv(self, tmp_path: Path) -> None:
        """Should exclude venv directories."""
        (tmp_path / "a.py").write_text("x = 1")
        venv = tmp_path / "venv"
        venv.mkdir()
        (venv / "lib.py").write_text("lib")

        files = collect_python_files(tmp_path)

        assert len(files) == 1

    def test_exclude_dot_directories(self, tmp_path: Path) -> None:
        """Should exclude directories starting with dot."""
        (tmp_path / "a.py").write_text("x = 1")
        dotdir = tmp_path / ".hidden"
        dotdir.mkdir()
        (dotdir / "hidden.py").write_text("hidden")

        files = collect_python_files(tmp_path)

        assert len(files) == 1


# ─────────────────────────────────────────────────────────────────
# analyze_path Tests
# ─────────────────────────────────────────────────────────────────


class TestAnalyzePath:
    """Tests for analyze_path function."""

    def test_analyze_single_file(self, tmp_path: Path) -> None:
        """Should analyze a single Python file."""
        py_file = tmp_path / "test.py"
        py_file.write_text("def foo():\n    pass\n")

        result = analyze_path(py_file)

        assert result["path"] == str(py_file)
        assert result["summary"]["totalFiles"] == 1
        assert result["summary"]["totalFunctions"] == 1

    def test_analyze_directory(self, tmp_path: Path) -> None:
        """Should analyze all Python files in directory."""
        (tmp_path / "a.py").write_text("def foo(): pass\n")
        (tmp_path / "b.py").write_text("def bar(): pass\ndef baz(): pass\n")

        result = analyze_path(tmp_path)

        assert result["summary"]["totalFiles"] == 2
        assert result["summary"]["totalFunctions"] == 3

    def test_analyze_empty_directory(self, tmp_path: Path) -> None:
        """Should handle empty directory."""
        result = analyze_path(tmp_path)

        assert result["summary"]["totalFiles"] == 0
        assert result["summary"]["totalFunctions"] == 0

    def test_analyze_hotspots(self, tmp_path: Path) -> None:
        """Should identify hotspots sorted by complexity."""
        py_file = tmp_path / "test.py"
        py_file.write_text("""
def simple():
    pass

def complex_func(x):
    if x > 0:
        for i in range(10):
            if i > 5:
                return i
    return 0
""")

        result = analyze_path(py_file)

        assert len(result["hotspots"]) >= 1
        # First hotspot should be the most complex
        assert result["hotspots"][0]["name"] == "complex_func"

    def test_analyze_with_syntax_error(self, tmp_path: Path) -> None:
        """Should skip files with syntax errors."""
        good_file = tmp_path / "good.py"
        good_file.write_text("def foo(): pass\n")
        bad_file = tmp_path / "bad.py"
        bad_file.write_text("def broken(:\n")

        result = analyze_path(tmp_path)

        assert result["summary"]["totalFiles"] == 1

    def test_analyze_summary_averages(self, tmp_path: Path) -> None:
        """Should calculate correct averages."""
        py_file = tmp_path / "test.py"
        py_file.write_text("def foo(): pass\ndef bar(): pass\n")

        result = analyze_path(py_file)

        assert "averageMcCabe" in result["summary"]
        assert "averageDimensional" in result["summary"]


# ─────────────────────────────────────────────────────────────────
# func_to_dict Tests
# ─────────────────────────────────────────────────────────────────


class TestFuncToDict:
    """Tests for func_to_dict function."""

    def test_basic_conversion(self) -> None:
        """Should convert FunctionComplexity to dict."""
        source = "def foo(): pass\n"
        functions = analyze_functions(source, "test.py")
        func = functions[0]

        result = func_to_dict(func)

        assert result["name"] == "foo"
        assert "line" in result
        assert "cyclomatic" in result
        assert "cognitive" in result
        assert "dimensional" in result

    def test_dimensional_structure(self) -> None:
        """Should include all dimensional components."""
        source = "def foo(): pass\n"
        functions = analyze_functions(source, "test.py")
        func = functions[0]

        result = func_to_dict(func)
        dim = result["dimensional"]

        assert "control" in dim
        assert "nesting" in dim
        assert "state" in dim
        assert "async" in dim
        assert "coupling" in dim
        assert "weighted" in dim
        assert "contributions" in dim


# ─────────────────────────────────────────────────────────────────
# format_json Tests
# ─────────────────────────────────────────────────────────────────


class TestFormatJson:
    """Tests for format_json function."""

    def test_valid_json_output(self) -> None:
        """Should produce valid JSON."""
        result = {
            "path": "/test",
            "summary": {"totalFiles": 1},
            "hotspots": [],
            "files": [],
        }

        output = format_json(result)
        parsed = json.loads(output)

        assert parsed["path"] == "/test"

    def test_unicode_handling(self) -> None:
        """Should handle unicode characters."""
        result = {
            "path": "/한글/경로",
            "summary": {},
            "hotspots": [],
            "files": [],
        }

        output = format_json(result)

        assert "한글" in output

    def test_indented_output(self) -> None:
        """Should produce indented JSON."""
        result = {"path": "/test", "summary": {}}

        output = format_json(result)

        assert "\n" in output
        assert "  " in output


# ─────────────────────────────────────────────────────────────────
# format_markdown Tests
# ─────────────────────────────────────────────────────────────────


class TestFormatMarkdown:
    """Tests for format_markdown function."""

    def test_header(self) -> None:
        """Should include report header."""
        result = {
            "path": "/test",
            "summary": {
                "totalFiles": 1,
                "totalFunctions": 2,
                "totalMcCabe": 3,
                "totalDimensional": 4.0,
                "averageMcCabe": 1.5,
                "averageDimensional": 2.0,
            },
            "hotspots": [],
            "files": [],
        }

        output = format_markdown(result)

        assert "# Complexity Analysis Report" in output
        assert "`/test`" in output

    def test_summary_table(self) -> None:
        """Should include summary table."""
        result = {
            "path": "/test",
            "summary": {
                "totalFiles": 5,
                "totalFunctions": 10,
                "totalMcCabe": 20,
                "totalDimensional": 30.0,
                "averageMcCabe": 2.0,
                "averageDimensional": 3.0,
            },
            "hotspots": [],
            "files": [],
        }

        output = format_markdown(result)

        assert "| Files analyzed | 5 |" in output
        assert "| Functions analyzed | 10 |" in output

    def test_hotspots_table(self) -> None:
        """Should include hotspots table when present."""
        result = {
            "path": "/test",
            "summary": {
                "totalFiles": 1,
                "totalFunctions": 1,
                "totalMcCabe": 5,
                "totalDimensional": 10.0,
                "averageMcCabe": 5.0,
                "averageDimensional": 10.0,
            },
            "hotspots": [{
                "name": "complex_func",
                "file": "test.py",
                "line": 1,
                "cyclomatic": 5,
                "dimensional": {
                    "weighted": 10.0,
                    "control": 3,
                    "nesting": 2,
                    "state": {"state_mutations": 1, "state_reads": 0},
                    "async": {"await_count": 0, "async_boundaries": 0},
                    "coupling": {"global_access": 0, "implicit_io": 0},
                    "contributions": {"control": 0.3, "nesting": 0.2},
                },
            }],
            "files": [],
        }

        output = format_markdown(result)

        assert "## Hotspots" in output
        assert "`complex_func`" in output

    def test_dimension_analysis(self) -> None:
        """Should include dimension analysis for top hotspots."""
        result = {
            "path": "/test",
            "summary": {
                "totalFiles": 1,
                "totalFunctions": 1,
                "totalMcCabe": 5,
                "totalDimensional": 10.0,
                "averageMcCabe": 5.0,
                "averageDimensional": 10.0,
            },
            "hotspots": [{
                "name": "test_func",
                "file": "test.py",
                "line": 1,
                "cyclomatic": 5,
                "dimensional": {
                    "weighted": 10.0,
                    "control": 3,
                    "nesting": 2,
                    "state": {"state_mutations": 1, "state_reads": 0},
                    "async": {"await_count": 0, "async_boundaries": 0},
                    "coupling": {"global_access": 0, "implicit_io": 0},
                    "contributions": {"control": 0.3, "nesting": 0.2, "state": 0.1, "async": 0.0, "coupling": 0.0},
                },
            }],
            "files": [],
        }

        output = format_markdown(result)

        assert "## Dimension Analysis" in output
        assert "Control (1D)" in output
        assert "Nesting (2D)" in output


# ─────────────────────────────────────────────────────────────────
# main() CLI Tests
# ─────────────────────────────────────────────────────────────────


class TestMain:
    """Tests for main CLI function."""

    def test_no_args_shows_help(self, capsys) -> None:
        """Should show help when no arguments provided."""
        with patch("sys.argv", ["semantic-complexity"]):
            result = main()

        assert result == 0
        captured = capsys.readouterr()
        assert "usage:" in captured.out.lower() or "semantic-complexity" in captured.out

    def test_version_flag(self, capsys) -> None:
        """Should show version with -V flag."""
        with patch("sys.argv", ["semantic-complexity", "-V"]):
            with pytest.raises(SystemExit) as exc_info:
                main()

        assert exc_info.value.code == 0

    def test_analyze_file(self, tmp_path: Path, capsys) -> None:
        """Should analyze a file and output JSON."""
        py_file = tmp_path / "test.py"
        py_file.write_text("def foo(): pass\n")

        with patch("sys.argv", ["semantic-complexity", str(py_file)]):
            result = main()

        assert result == 0
        captured = capsys.readouterr()
        output = json.loads(captured.out)
        assert output["summary"]["totalFunctions"] == 1

    def test_analyze_nonexistent_path(self, capsys) -> None:
        """Should error on nonexistent path."""
        with patch("sys.argv", ["semantic-complexity", "/nonexistent/path"]):
            result = main()

        assert result == 1
        captured = capsys.readouterr()
        assert "not found" in captured.err.lower()

    def test_json_format(self, tmp_path: Path, capsys) -> None:
        """Should output JSON with -f json."""
        py_file = tmp_path / "test.py"
        py_file.write_text("def foo(): pass\n")

        with patch("sys.argv", ["semantic-complexity", str(py_file), "-f", "json"]):
            result = main()

        assert result == 0
        captured = capsys.readouterr()
        json.loads(captured.out)  # Should not raise

    def test_markdown_format(self, tmp_path: Path, capsys) -> None:
        """Should output Markdown with -f markdown."""
        py_file = tmp_path / "test.py"
        py_file.write_text("def foo(): pass\n")

        with patch("sys.argv", ["semantic-complexity", str(py_file), "-f", "markdown"]):
            result = main()

        assert result == 0
        captured = capsys.readouterr()
        assert "# Complexity Analysis Report" in captured.out

    def test_threshold_filter(self, tmp_path: Path, capsys) -> None:
        """Should filter by threshold."""
        py_file = tmp_path / "test.py"
        py_file.write_text("""
def simple():
    pass

def complex_func(x):
    if x > 0:
        for i in range(10):
            if i > 5:
                return i
    return 0
""")

        with patch("sys.argv", ["semantic-complexity", str(py_file), "-t", "5"]):
            result = main()

        assert result == 0
        captured = capsys.readouterr()
        output = json.loads(captured.out)
        # Only functions above threshold
        for f in output["files"]:
            for fn in f["functions"]:
                assert fn["dimensional"]["weighted"] >= 5

    def test_custom_weights(self, tmp_path: Path, capsys) -> None:
        """Should accept custom weights."""
        py_file = tmp_path / "test.py"
        py_file.write_text("def foo(): pass\n")

        weights = '{"control": 2.0, "nesting": 3.0}'
        with patch("sys.argv", ["semantic-complexity", str(py_file), "-w", weights]):
            result = main()

        assert result == 0

    def test_invalid_weights_json(self, tmp_path: Path, capsys) -> None:
        """Should error on invalid weights JSON."""
        py_file = tmp_path / "test.py"
        py_file.write_text("def foo(): pass\n")

        with patch("sys.argv", ["semantic-complexity", str(py_file), "-w", "invalid"]):
            result = main()

        assert result == 1
        captured = capsys.readouterr()
        assert "invalid" in captured.err.lower()

    def test_output_to_file(self, tmp_path: Path, capsys) -> None:
        """Should write output to file with -o."""
        py_file = tmp_path / "test.py"
        py_file.write_text("def foo(): pass\n")
        out_file = tmp_path / "report.json"

        with patch("sys.argv", ["semantic-complexity", str(py_file), "-o", str(out_file)]):
            result = main()

        assert result == 0
        assert out_file.exists()
        content = json.loads(out_file.read_text())
        assert content["summary"]["totalFunctions"] == 1

    def test_analyze_directory(self, tmp_path: Path, capsys) -> None:
        """Should analyze entire directory."""
        (tmp_path / "a.py").write_text("def foo(): pass\n")
        (tmp_path / "b.py").write_text("def bar(): pass\n")

        with patch("sys.argv", ["semantic-complexity", str(tmp_path)]):
            result = main()

        assert result == 0
        captured = capsys.readouterr()
        output = json.loads(captured.out)
        assert output["summary"]["totalFiles"] == 2
