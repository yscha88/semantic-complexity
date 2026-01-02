"""
CLI for semantic-complexity

Usage:
    semantic-complexity analyze <file>
    semantic-complexity gate <file> [--gate=mvp|production]
"""

__module_type__ = "app"

import click
from rich.console import Console
from rich.table import Table

console = Console()


@click.group()
@click.version_option(package_name="semantic-complexity")
def main():
    """Semantic Complexity Analyzer"""
    pass


@main.command()
@click.argument("file", type=click.Path(exists=True))
@click.option("--format", "-f", type=click.Choice(["table", "json"]), default="table")
def analyze(file: str, format: str):
    """Analyze a Python file"""
    from semantic_complexity import analyze_sandwich

    with open(file, encoding="utf-8") as f:
        source = f.read()

    result = analyze_sandwich(source, file)

    if format == "json":
        import json
        click.echo(json.dumps({
            "path": result.path,
            "module_type": str(result.module_type),
            "accessible": result.cheese.accessible,
            "max_nesting": result.cheese.max_nesting,
            "in_equilibrium": result.in_equilibrium,
            "energy": result.energy,
        }, indent=2))
    else:
        _print_analysis(result)


def _print_analysis(result):
    """Print analysis result as table"""
    console.print(f"\n[bold]Analysis: {result.path}[/bold]\n")

    # Sandwich Score
    table = Table(title="Sandwich Score")
    table.add_column("Axis", style="cyan")
    table.add_column("Current", justify="right")
    table.add_column("Canonical", justify="right")

    table.add_row("Bread", f"{result.current.bread:.2f}", f"{result.canonical.bread:.2f}")
    table.add_row("Cheese", f"{result.current.cheese:.2f}", f"{result.canonical.cheese:.2f}")
    table.add_row("Ham", f"{result.current.ham:.2f}", f"{result.canonical.ham:.2f}")
    console.print(table)

    # Cheese (Cognitive)
    cheese = result.cheese
    status = "[green]Accessible[/green]" if cheese.accessible else "[red]Not Accessible[/red]"
    console.print(f"\nCognitive: {status}")
    console.print(f"  Max Nesting: {cheese.max_nesting}")
    console.print(f"  Hidden Deps: {len(cheese.hidden_dependencies)}")

    sar = cheese.state_async_retry
    sar_status = "[red]VIOLATED[/red]" if sar.violated else "[green]OK[/green]"
    console.print(f"  State x Async x Retry: {sar_status} ({'/'.join(sar.axes) if sar.axes else 'none'})")

    # Equilibrium
    eq_status = "[green]Yes[/green]" if result.in_equilibrium else "[yellow]No[/yellow]"
    console.print(f"\nIn Equilibrium: {eq_status} (energy: {result.energy:.4f})")

    # Recommendations
    if result.recommendations:
        console.print("\n[bold]Recommendations:[/bold]")
        for rec in result.recommendations[:3]:
            console.print(f"  - {rec.action} ({rec.priority})")


@main.command()
@click.argument("file", type=click.Path(exists=True))
@click.option("--gate", "-g", type=click.Choice(["mvp", "production"]), default="mvp")
def gate(file: str, gate: str):
    """Check gate (mvp/production)"""
    from semantic_complexity import (
        analyze_bread, analyze_cognitive, analyze_ham,
        check_mvp_gate, check_production_gate,
    )

    with open(file, encoding="utf-8") as f:
        source = f.read()

    bread = analyze_bread(source, file)
    cheese = analyze_cognitive(source)
    ham = analyze_ham(source, file)

    if gate == "mvp":
        result = check_mvp_gate(bread, cheese, ham)
    else:
        result = check_production_gate(bread, cheese, ham)

    # Print result
    if result.passed:
        console.print(f"[green bold]{result.summary}[/green bold]")
    else:
        console.print(f"[red bold]{result.summary}[/red bold]")

        if not result.bread.passed:
            console.print("\n[red]Bread violations:[/red]")
            for v in result.bread.violations:
                console.print(f"  - {v}")

        if not result.cheese.passed:
            console.print("\n[red]Cheese violations:[/red]")
            for v in result.cheese.state_async_retry_violations:
                console.print(f"  - {v}")
            for v in result.cheese.concept_violations:
                console.print(f"  - {v}")

        if not result.ham.passed:
            console.print("\n[red]Ham violations:[/red]")
            console.print(f"  - Golden test coverage: {result.ham.golden_test_coverage:.1%}")


if __name__ == "__main__":
    main()
