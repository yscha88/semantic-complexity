#!/usr/bin/env node
/**
 * semantic-complexity CLI
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { analyzeBread } from '../analyzers/bread.js';
import { analyzeCheese } from '../analyzers/cheese.js';
import { analyzeHam } from '../analyzers/ham.js';
import { normalize, calculateEquilibrium } from '../simplex/index.js';
import { checkGate } from '../gate/index.js';
import type { GateType } from '../types/index.js';

// package.json에서 버전 동적으로 읽기
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf-8')
);

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(`semantic-complexity v${packageJson.version}`);
    process.exit(0);
  }

  const filePath = args.find(arg => !arg.startsWith('-'));
  if (!filePath) {
    console.error('Error: No file path provided');
    process.exit(1);
  }

  const gateType = (args.find(arg => arg.startsWith('--gate='))?.split('=')[1] || 'mvp') as GateType;

  try {
    const source = readFileSync(filePath, 'utf-8');
    analyze(source, filePath, gateType);
  } catch {
    console.error(`Error reading file: ${filePath}`);
    process.exit(1);
  }
}

function analyze(source: string, filePath: string, gateType: GateType): void {
  console.log(`\nAnalyzing: ${filePath}`);
  console.log('='.repeat(50));

  // Analyze each axis
  const bread = analyzeBread(source);
  const cheese = analyzeCheese(source);
  const ham = analyzeHam(source);

  // Calculate simplex & equilibrium
  const simplex = normalize(bread, cheese, ham);
  const equilibrium = calculateEquilibrium(simplex);

  // Check gate
  const gate = checkGate(gateType, cheese, ham);

  // Output results
  console.log('\n[Bread - Security]');
  console.log(`  Trust Boundaries: ${bread.trustBoundaryCount}`);
  console.log(`  Auth Explicitness: ${(bread.authExplicitness * 100).toFixed(1)}%`);
  console.log(`  Secrets Detected: ${bread.secretPatterns.filter(s => s.severity === 'high').length} high, ${bread.secretPatterns.filter(s => s.severity === 'medium').length} medium`);
  console.log(`  Hidden Deps: global=${bread.hiddenDeps.global}, env=${bread.hiddenDeps.env}, io=${bread.hiddenDeps.io}`);

  console.log('\n[Cheese - Cognitive]');
  console.log(`  Max Nesting: ${cheese.maxNesting}`);
  console.log(`  State×Async×Retry: ${cheese.stateAsyncRetry.axes.join('×') || 'none'} (${cheese.stateAsyncRetry.count})`);
  console.log(`  Accessible: ${cheese.accessible ? 'YES' : 'NO'}`);
  if (cheese.violations.length > 0) {
    console.log(`  Violations: ${cheese.violations.join(', ')}`);
  }

  console.log('\n[Ham - Behavioral]');
  console.log(`  Golden Test Coverage: ${(ham.goldenTestCoverage * 100).toFixed(1)}%`);
  console.log(`  Critical Paths: ${ham.criticalPaths.length}`);
  console.log(`  Untested Critical: ${ham.untestedCriticalPaths.length}`);

  console.log('\n[Simplex]');
  console.log(`  Coordinates: B=${simplex.bread.toFixed(2)}, C=${simplex.cheese.toFixed(2)}, H=${simplex.ham.toFixed(2)}`);
  console.log(`  Equilibrium: ${equilibrium.inEquilibrium ? 'YES' : 'NO'} (energy=${equilibrium.energy.toFixed(3)})`);
  if (equilibrium.dominantAxis) {
    console.log(`  Dominant Axis: ${equilibrium.dominantAxis}`);
  }

  console.log(`\n[Gate: ${gateType.toUpperCase()}]`);
  console.log(`  Result: ${gate.passed ? 'PASSED' : 'FAILED'}`);
  if (gate.violations.length > 0) {
    console.log('  Violations:');
    gate.violations.forEach(v => console.log(`    - ${v.message}`));
  }

  process.exit(gate.passed ? 0 : 1);
}

function printHelp(): void {
  console.log(`
semantic-complexity - Code complexity analyzer (Bread-Cheese-Ham model)

Usage:
  semantic-complexity <file> [options]

Options:
  --gate=<type>   Gate type: poc, mvp, production (default: mvp)
  --version, -v   Show version
  --help, -h      Show this help

Examples:
  semantic-complexity src/app.ts
  semantic-complexity src/api.ts --gate=production
`);
}

main();
