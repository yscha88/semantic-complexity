#!/usr/bin/env node
/**
 * @nxt/complexity-cli
 *
 * 프로젝트 전체 복잡도 분석 및 리포트 생성
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { scanProject, type ProjectReport } from './scanner.js';
import { generateReportFile, type ReportFormat } from './reporter.js';
import {
  DependencyGraph,
  CallGraph,
  exportToDot,
  exportToMermaid,
  parseSourceFile,
} from 'semantic-complexity';

const program = new Command();

program
  .name('nxt-complexity')
  .description('Project-wide complexity analysis with dimensional metrics')
  .version('0.1.0');

// ─────────────────────────────────────────────────────────────────
// analyze 명령어
// ─────────────────────────────────────────────────────────────────

program
  .command('analyze')
  .description('Analyze a project and generate complexity report')
  .argument('<path>', 'Project path to analyze')
  .option('-o, --output <path>', 'Output file path', './complexity-report')
  .option('-f, --format <format>', 'Report format (json, markdown, html)', 'html')
  .option('--json', 'Output as JSON (shorthand for -f json)')
  .option('--md', 'Output as Markdown (shorthand for -f markdown)')
  .option('--threshold <number>', 'Minimum complexity to include', '0')
  .option('--exclude <patterns>', 'Additional exclude patterns (comma-separated)')
  .option('--no-progress', 'Disable progress output')
  .action(async (projectPath: string, options) => {
    const absolutePath = path.resolve(projectPath);

    if (!fs.existsSync(absolutePath)) {
      console.error(chalk.red(`Error: Path not found: ${absolutePath}`));
      process.exit(1);
    }

    const format: ReportFormat = options.json ? 'json' : options.md ? 'markdown' : options.format;

    console.log(chalk.cyan('\n📊 Complexity Analysis'));
    console.log(chalk.gray(`   Project: ${absolutePath}`));
    console.log(chalk.gray(`   Format: ${format}\n`));

    const spinner = options.progress !== false ? ora('Scanning project...').start() : null;

    try {
      const excludePatterns = options.exclude ? options.exclude.split(',') : undefined;

      const report = await scanProject(absolutePath, {
        exclude: excludePatterns,
        onProgress: (current, total, file) => {
          if (spinner) {
            spinner.text = `Analyzing (${current}/${total}): ${file}`;
          }
        },
      });

      if (spinner) spinner.succeed(`Analyzed ${report.summary.totalFiles} files`);

      // 리포트 출력
      const outputPath = generateReportFile(report, options.output, format);
      console.log(chalk.green(`\n✅ Report saved: ${outputPath}`));

      // 요약 출력
      printSummary(report);

    } catch (error) {
      if (spinner) spinner.fail('Analysis failed');
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────────────────────────
// summary 명령어 (콘솔 출력만)
// ─────────────────────────────────────────────────────────────────

program
  .command('summary')
  .description('Print complexity summary to console (no file output)')
  .argument('<path>', 'Project path to analyze')
  .option('--top <number>', 'Number of hotspots to show', '10')
  .action(async (projectPath: string, options) => {
    const absolutePath = path.resolve(projectPath);

    if (!fs.existsSync(absolutePath)) {
      console.error(chalk.red(`Error: Path not found: ${absolutePath}`));
      process.exit(1);
    }

    const spinner = ora('Scanning project...').start();

    try {
      const report = await scanProject(absolutePath, {
        onProgress: (current, total, file) => {
          spinner.text = `Analyzing (${current}/${total}): ${file}`;
        },
      });

      spinner.succeed(`Analyzed ${report.summary.totalFiles} files`);
      printSummary(report, parseInt(options.top, 10));

    } catch (error) {
      spinner.fail('Analysis failed');
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────────────────────────
// graph 명령어
// ─────────────────────────────────────────────────────────────────

program
  .command('graph')
  .description('Generate dependency or call graph')
  .argument('<path>', 'Project path or file to analyze')
  .option('-t, --type <type>', 'Graph type (dependency, call)', 'dependency')
  .option('-f, --format <format>', 'Output format (dot, mermaid)', 'mermaid')
  .option('-o, --output <path>', 'Output file path')
  .action(async (projectPath: string, options) => {
    const absolutePath = path.resolve(projectPath);

    if (!fs.existsSync(absolutePath)) {
      console.error(chalk.red(`Error: Path not found: ${absolutePath}`));
      process.exit(1);
    }

    const spinner = ora('Building graph...').start();

    try {
      const stat = fs.statSync(absolutePath);
      let graphOutput: string;

      if (options.type === 'call') {
        // Call graph - requires a single file
        if (stat.isDirectory()) {
          spinner.fail('Call graph requires a single file, not a directory');
          process.exit(1);
        }

        const content = fs.readFileSync(absolutePath, 'utf-8');
        const sourceFile = parseSourceFile(absolutePath, content);
        const callGraph = new CallGraph();

        // Analyze the source file for call relationships
        callGraph.analyzeSourceFile(sourceFile);

        graphOutput = exportToMermaid(callGraph);

      } else {
        // Dependency graph
        const projectRoot = stat.isDirectory() ? absolutePath : path.dirname(absolutePath);
        const depGraph = new DependencyGraph(projectRoot);

        if (stat.isDirectory()) {
          // Analyze all files in directory
          depGraph.analyzeDirectory(absolutePath);
        } else {
          const content = fs.readFileSync(absolutePath, 'utf-8');
          depGraph.analyzeFile(absolutePath, content);
        }

        graphOutput = exportToDot(depGraph);
      }

      spinner.succeed('Graph generated');

      if (options.output) {
        const ext = options.format === 'dot' ? '.dot' : '.md';
        const outputPath = options.output.endsWith(ext) ? options.output : options.output + ext;
        fs.writeFileSync(outputPath, graphOutput, 'utf-8');
        console.log(chalk.green(`Graph saved: ${outputPath}`));
      } else {
        console.log('\n' + graphOutput);
      }

    } catch (error) {
      spinner.fail('Graph generation failed');
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// ─────────────────────────────────────────────────────────────────
// 요약 출력
// ─────────────────────────────────────────────────────────────────

function printSummary(report: ProjectReport, topN = 10): void {
  const s = report.summary;

  console.log(chalk.cyan('\n═══════════════════════════════════════════════════════════════'));
  console.log(chalk.cyan(' Summary'));
  console.log(chalk.cyan('═══════════════════════════════════════════════════════════════\n'));

  console.log(`  ${chalk.gray('Files:')}        ${s.totalFiles}`);
  console.log(`  ${chalk.gray('Functions:')}    ${s.totalFunctions}`);
  console.log(`  ${chalk.gray('Avg McCabe:')}   ${s.averageMcCabe}`);
  console.log(`  ${chalk.gray('Avg Dimensional:')} ${s.averageDimensional}`);
  console.log(`  ${chalk.gray('Avg Ratio:')}    ${chalk.yellow(s.averageRatio + 'x')}`);
  console.log(`  ${chalk.gray('High-Risk:')}    ${chalk.red(s.functionsAboveThreshold.toString())} functions`);

  // Tensor Summary (v0.0.3)
  if (s.tensor) {
    console.log(chalk.cyan('\n───────────────────────────────────────────────────────────────'));
    console.log(chalk.cyan(' Tensor Analysis (v0.0.3)'));
    console.log(chalk.cyan('───────────────────────────────────────────────────────────────\n'));

    console.log(`  ${chalk.gray('Safe:')}       ${chalk.green(s.tensor.safeCount.toString())} functions`);
    console.log(`  ${chalk.gray('Review:')}     ${chalk.yellow(s.tensor.reviewCount.toString())} functions`);
    console.log(`  ${chalk.gray('Violation:')}  ${chalk.red(s.tensor.violationCount.toString())} functions`);
    console.log(`  ${chalk.gray('Avg Ratio:')}  ${s.tensor.averageRawSumRatio.toFixed(3)} (threshold: 1.0)`);
  }

  // 차원별 분석
  console.log(chalk.cyan('\n───────────────────────────────────────────────────────────────'));
  console.log(chalk.cyan(' Dimension Breakdown'));
  console.log(chalk.cyan('───────────────────────────────────────────────────────────────\n'));

  const dims = [
    { name: '1D Control', data: report.dimensionBreakdown.control, color: chalk.blue },
    { name: '2D Nesting', data: report.dimensionBreakdown.nesting, color: chalk.magenta },
    { name: '3D State', data: report.dimensionBreakdown.state, color: chalk.green },
    { name: '4D Async', data: report.dimensionBreakdown.async, color: chalk.yellow },
    { name: '5D Coupling', data: report.dimensionBreakdown.coupling, color: chalk.red },
  ];

  const maxTotal = Math.max(...dims.map((d) => d.data.total));

  for (const dim of dims) {
    const barLength = maxTotal > 0 ? Math.round((dim.data.total / maxTotal) * 30) : 0;
    const bar = dim.color('█'.repeat(barLength) + '░'.repeat(30 - barLength));
    console.log(`  ${dim.name.padEnd(12)} ${bar} ${dim.data.total.toString().padStart(6)} (avg: ${dim.data.average})`);
  }

  // 핫스팟
  if (report.hotspots.length > 0) {
    console.log(chalk.cyan('\n───────────────────────────────────────────────────────────────'));
    console.log(chalk.cyan(` Hotspots (Top ${topN})`));
    console.log(chalk.cyan('───────────────────────────────────────────────────────────────\n'));

    console.log(
      chalk.gray('  Function'.padEnd(28) + 'McCabe'.padStart(7) + 'Dim'.padStart(6) + 'Ratio'.padStart(7) + 'Zone'.padStart(10) + '  Primary')
    );
    console.log(chalk.gray('  ' + '-'.repeat(75)));

    for (const h of report.hotspots.slice(0, topN)) {
      const name = h.function.slice(0, 26).padEnd(28);
      const ratioColor = h.ratio > 10 ? chalk.red : h.ratio > 5 ? chalk.yellow : chalk.white;
      const zoneColor = h.tensor?.zone === 'violation' ? chalk.red :
                        h.tensor?.zone === 'review' ? chalk.yellow : chalk.green;
      const zone = h.tensor?.zone || 'n/a';
      console.log(
        `  ${name}${h.mccabe.toString().padStart(7)}${h.dimensional.toString().padStart(6)}${ratioColor((h.ratio + 'x').padStart(7))}${zoneColor(zone.padStart(10))}  ${h.primaryDimension}`
      );
    }
  }

  // 리팩토링 필요 항목
  const critical = report.refactorPriority.filter((r) => r.priority === 'critical');
  const high = report.refactorPriority.filter((r) => r.priority === 'high');

  if (critical.length > 0 || high.length > 0) {
    console.log(chalk.cyan('\n───────────────────────────────────────────────────────────────'));
    console.log(chalk.cyan(' Refactoring Needed'));
    console.log(chalk.cyan('───────────────────────────────────────────────────────────────\n'));

    if (critical.length > 0) {
      console.log(chalk.red(`  ⚠ Critical (${critical.length}):`));
      for (const r of critical.slice(0, 5)) {
        console.log(chalk.red(`    - ${r.function} @ ${r.file}:${r.line}`));
      }
    }

    if (high.length > 0) {
      console.log(chalk.yellow(`  ⚡ High (${high.length}):`));
      for (const r of high.slice(0, 5)) {
        console.log(chalk.yellow(`    - ${r.function} @ ${r.file}:${r.line}`));
      }
    }
  }

  console.log(chalk.cyan('\n═══════════════════════════════════════════════════════════════\n'));
}

// ─────────────────────────────────────────────────────────────────
// 실행
// ─────────────────────────────────────────────────────────────────

program.parse();
