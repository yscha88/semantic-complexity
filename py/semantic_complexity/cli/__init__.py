"""
CLI for semantic-complexity.
"""

import argparse
import sys
from pathlib import Path

from semantic_complexity import __version__
from semantic_complexity.core import analyze_file


def main() -> int:
    """Main CLI entrypoint."""
    parser = argparse.ArgumentParser(
        prog="semantic-complexity",
        description="Multi-dimensional code complexity analyzer",
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
        choices=["json", "markdown", "html"],
        default="json",
        help="Output format (default: json)",
    )

    args = parser.parse_args()

    if args.path is None:
        parser.print_help()
        return 0

    if not args.path.exists():
        print(f"Error: Path not found: {args.path}", file=sys.stderr)
        return 1

    # TODO: Implement analysis
    result = analyze_file(str(args.path))
    print(f"Analysis result: {result}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
