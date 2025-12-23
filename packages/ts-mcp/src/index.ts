#!/usr/bin/env node
/**
 * semantic-complexity-ts-mcp
 *
 * MCP Server for TypeScript/JavaScript Complexity Analysis
 * For Python files, use semantic-complexity-py-mcp
 * For Go files, use semantic-complexity-go-mcp
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));

// Handle --version flag
if (process.argv.includes('--version') || process.argv.includes('-V')) {
  console.log(packageJson.version);
  process.exit(0);
}

import { glob } from 'glob';
import ts from 'typescript';

import {
  parseSourceFile,
  extractFunctionInfo,
  analyzeFunctionExtended,
  type ExtendedComplexityResult,
  // Tensor scoring
  calculateTensorScore,
  type TensorModuleType,
  type Vector5D,
  // Graph
  DependencyGraph,
  CallGraph,
  exportToDot,
  exportToMermaid,
  // Canonical
  analyzeDeviation,
  isWithinCanonicalBounds,
  getCanonicalProfile,
  // Class analysis (v0.0.8)
  analyzeClassesInFile,
} from 'semantic-complexity';

// ─────────────────────────────────────────────────────────────────
// File Type Detection (TypeScript/JavaScript only)
// ─────────────────────────────────────────────────────────────────

const TS_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

function isTypeScriptFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return TS_EXTENSIONS.has(ext);
}

// ─────────────────────────────────────────────────────────────────
// Tensor Score Calculation
// ─────────────────────────────────────────────────────────────────

interface TensorScoreOutput {
  regularized: number;
  rawSum: number;
  rawSumThreshold: number;
  rawSumRatio: number;
  zone: 'safe' | 'review' | 'violation';
}

function calculateTensorFromDimensional(
  dimensional: ExtendedComplexityResult['dimensional'],
  moduleType: TensorModuleType
): TensorScoreOutput {
  const vector: Vector5D = {
    control: dimensional.control,
    nesting: dimensional.nesting,
    state: dimensional.state.stateMutations,
    async: dimensional.async.asyncBoundaries,
    coupling: dimensional.coupling.globalAccess.length + dimensional.coupling.sideEffects.length,
  };

  const score = calculateTensorScore(vector, moduleType);

  let zone: 'safe' | 'review' | 'violation';
  if (score.rawSumRatio < 0.7) zone = 'safe';
  else if (score.rawSumRatio < 1.0) zone = 'review';
  else zone = 'violation';

  return {
    regularized: score.regularized,
    rawSum: score.rawSum,
    rawSumThreshold: score.rawSumThreshold,
    rawSumRatio: score.rawSumRatio,
    zone,
  };
}

// ─────────────────────────────────────────────────────────────────
// Tool Definitions (TypeScript/JavaScript only)
// ─────────────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    name: 'get_hotspots',
    description: `[ENTRY POINT] Find complexity hotspots in TypeScript/JavaScript code.

USE THIS FIRST when user mentions:
- "refactoring", "리팩토링", "개선"
- "code quality", "코드 품질"
- "what should I improve?", "뭐 고쳐야 해?"

Returns top N functions sorted by dimensional complexity.
Supports: .ts, .tsx, .js, .jsx, .mjs, .cjs

For Python files, use semantic-complexity-py-mcp.
For Go files, use semantic-complexity-go-mcp.`,
    inputSchema: {
      type: 'object',
      properties: {
        directory: {
          type: 'string',
          description: 'Directory path to scan',
        },
        moduleType: {
          type: 'string',
          enum: ['api', 'lib', 'app', 'web', 'data', 'infra', 'deploy'],
          description: 'Module type for complexity bounds. Required.',
        },
        topN: {
          type: 'number',
          description: 'Number of hotspots to return (default: 10)',
        },
        pattern: {
          type: 'string',
          description: 'Glob pattern for files (default: **/*.{ts,tsx,js,jsx})',
        },
      },
      required: ['directory', 'moduleType'],
    },
  },
  {
    name: 'analyze_file',
    description: `Analyze complexity of all functions in a TypeScript/JavaScript file.

USE when:
- User opens or mentions a specific file
- After get_hotspots identifies a problematic file

Returns McCabe, cognitive, and dimensional complexity for each function.
Supports: .ts, .tsx, .js, .jsx, .mjs, .cjs`,
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the file to analyze',
        },
        moduleType: {
          type: 'string',
          enum: ['api', 'lib', 'app', 'web', 'data', 'infra', 'deploy'],
          description: 'Module type for complexity bounds. Required.',
        },
        threshold: {
          type: 'number',
          description: 'Minimum dimensional complexity to include (default: 0)',
        },
      },
      required: ['filePath', 'moduleType'],
    },
  },
  {
    name: 'analyze_function',
    description: `Deep analysis of a specific function with full dimensional breakdown.

USE when:
- User asks about a specific function
- After get_hotspots/analyze_file identifies a complex function

Returns:
- McCabe vs Dimensional comparison (hidden complexity ratio)
- 5-dimension breakdown (Control, Nesting, State, Async, Coupling)
- Contribution percentages for each dimension`,
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the file containing the function',
        },
        functionName: {
          type: 'string',
          description: 'Name of the function to analyze',
        },
        moduleType: {
          type: 'string',
          enum: ['api', 'lib', 'app', 'web', 'data', 'infra', 'deploy'],
          description: 'Module type for complexity bounds. Required.',
        },
      },
      required: ['filePath', 'functionName', 'moduleType'],
    },
  },
  {
    name: 'suggest_refactor',
    description: `Get actionable refactoring suggestions based on complexity profile.

USE when:
- User asks "어떻게 고쳐?", "how to fix?"
- After analyze_function shows high complexity

Returns prioritized suggestions based on the dominant complexity dimension.`,
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the file',
        },
        functionName: {
          type: 'string',
          description: 'Name of the function to get suggestions for',
        },
        moduleType: {
          type: 'string',
          enum: ['api', 'lib', 'app', 'web', 'data', 'infra', 'deploy'],
          description: 'Module type for complexity bounds. Required.',
        },
      },
      required: ['filePath', 'functionName', 'moduleType'],
    },
  },
  {
    name: 'generate_graph',
    description: `Generate dependency or call graph visualization.

USE when:
- User asks about dependencies, "의존성", "구조"
- User wants to see relationships between modules

Returns Mermaid or DOT format for rendering.`,
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file or directory to analyze',
        },
        graphType: {
          type: 'string',
          enum: ['dependency', 'call'],
          description: 'Type of graph (default: dependency)',
        },
        format: {
          type: 'string',
          enum: ['mermaid', 'dot'],
          description: 'Output format (default: mermaid)',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'validate_complexity',
    description: `Validate if code fits within canonical complexity bounds.

USE when:
- After writing new code (CI integration)
- PR review quality gate
- User asks "이거 괜찮아?", "is this okay?"

Checks bounds against specified module type. Returns pass/fail status.`,
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the file',
        },
        moduleType: {
          type: 'string',
          enum: ['api', 'lib', 'app', 'web', 'data', 'infra', 'deploy'],
          description: 'Module type for complexity bounds. Required.',
        },
        functionName: {
          type: 'string',
          description: 'Name of the function (optional - validates all if omitted)',
        },
      },
      required: ['filePath', 'moduleType'],
    },
  },
  {
    name: 'analyze_class',
    description: `Analyze class reusability and OO design quality metrics.

USE when:
- User asks about class quality, "클래스 품질", "재활용율"
- Reviewing class design for refactoring
- Checking if a class follows SOLID principles

Returns:
- Standard OO metrics: WMC, LCOM, CBO, RFC, DIT
- Reusability score (0-100) with grade (A-F)
- Specific issues and recommendations`,
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the file containing classes',
        },
        className: {
          type: 'string',
          description: 'Name of the specific class to analyze (optional - analyzes all if omitted)',
        },
      },
      required: ['filePath'],
    },
  },
];

// ─────────────────────────────────────────────────────────────────
// Tool Implementations
// ─────────────────────────────────────────────────────────────────

async function analyzeFileImpl(filePath: string, moduleType: TensorModuleType, threshold = 0): Promise<string> {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    return JSON.stringify({ error: `File not found: ${absolutePath}` });
  }

  if (!isTypeScriptFile(absolutePath)) {
    return JSON.stringify({
      error: `Unsupported file type: ${path.extname(absolutePath)}. This MCP only supports TypeScript/JavaScript (.ts, .tsx, .js, .jsx). For Python, use semantic-complexity-py-mcp. For Go, use semantic-complexity-go-mcp.`,
    });
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const sourceFile = parseSourceFile(absolutePath, content);

  const results: Array<{
    name: string;
    line: number;
    mccabe: number;
    cognitive: number;
    dimensional: {
      weighted: number;
      control: number;
      nesting: number;
      state: number;
      async: number;
      coupling: number;
    };
    tensor: TensorScoreOutput;
    ratio: number;
  }> = [];

  function visit(node: ts.Node) {
    const funcInfo = extractFunctionInfo(node, sourceFile);
    if (funcInfo) {
      const result = analyzeFunctionExtended(node, sourceFile, funcInfo);
      if (result.dimensional.weighted >= threshold) {
        const tensor = calculateTensorFromDimensional(result.dimensional, moduleType);
        results.push({
          name: funcInfo.name,
          line: funcInfo.location.startLine,
          mccabe: result.cyclomatic,
          cognitive: result.cognitive,
          dimensional: {
            weighted: Math.round(result.dimensional.weighted * 10) / 10,
            control: result.dimensional.control,
            nesting: result.dimensional.nesting,
            state: result.dimensional.state.stateMutations,
            async: result.dimensional.async.asyncBoundaries,
            coupling: result.dimensional.coupling.globalAccess.length + result.dimensional.coupling.sideEffects.length,
          },
          tensor,
          ratio: result.cyclomatic > 0 ? Math.round((result.dimensional.weighted / result.cyclomatic) * 100) / 100 : 0,
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sourceFile, visit);

  return JSON.stringify({
    file: path.basename(absolutePath),
    language: 'typescript',
    moduleType,
    functionCount: results.length,
    functions: results.sort((a, b) => b.dimensional.weighted - a.dimensional.weighted),
  }, null, 2);
}

async function analyzeFunctionImpl(filePath: string, functionName: string, moduleType: TensorModuleType): Promise<string> {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    return JSON.stringify({ error: `File not found: ${absolutePath}` });
  }

  if (!isTypeScriptFile(absolutePath)) {
    return JSON.stringify({
      error: `Unsupported file type. This MCP only supports TypeScript/JavaScript. For Python, use semantic-complexity-py-mcp. For Go, use semantic-complexity-go-mcp.`,
    });
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const sourceFile = parseSourceFile(absolutePath, content);
  let found: ExtendedComplexityResult | null = null;

  function visit(node: ts.Node) {
    const funcInfo = extractFunctionInfo(node, sourceFile);
    if (funcInfo && funcInfo.name === functionName) {
      found = analyzeFunctionExtended(node, sourceFile, funcInfo);
    }
    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sourceFile, visit);

  if (!found) {
    return JSON.stringify({ error: `Function '${functionName}' not found in ${filePath}` });
  }

  const f = found as ExtendedComplexityResult;
  const d = f.dimensional;
  const ratio = f.cyclomatic > 0 ? d.weighted / f.cyclomatic : 0;
  const stateScore = d.state.stateMutations + d.state.stateReads * 0.5;
  const asyncScore = d.async.asyncBoundaries + d.async.promiseChains + d.async.callbackDepth;
  const couplingScore = d.coupling.globalAccess.length * 2 + d.coupling.sideEffects.length * 3 + d.coupling.closureCaptures.length;
  const total = d.control + d.nesting * 1.5 + stateScore * 2 + asyncScore * 2.5 + couplingScore;

  return JSON.stringify({
    name: f.function.name,
    location: `${path.basename(absolutePath)}:${f.function.location.startLine}`,
    language: 'typescript',
    comparison: {
      mccabe: f.cyclomatic,
      dimensional: Math.round(d.weighted * 10) / 10,
      ratio: Math.round(ratio * 100) / 100,
      hiddenComplexity: ratio > 2 ? 'HIGH' : ratio > 1.5 ? 'MEDIUM' : 'LOW',
      interpretation: getInterpretation(f),
    },
    dimensions: {
      control: { score: d.control, weight: 1.0, weighted: d.control, percent: total > 0 ? Math.round(d.control / total * 100) : 0 },
      nesting: { score: d.nesting, weight: 1.5, weighted: d.nesting * 1.5, percent: total > 0 ? Math.round(d.nesting * 1.5 / total * 100) : 0 },
      state: {
        score: Math.round(stateScore),
        weight: 2.0,
        weighted: Math.round(stateScore * 2),
        percent: total > 0 ? Math.round(stateScore * 2 / total * 100) : 0,
        details: {
          enumStates: d.state.enumStates,
          stateMutations: d.state.stateMutations,
          stateReads: d.state.stateReads,
          stateBranches: d.state.stateBranches,
        },
      },
      async: {
        score: Math.round(asyncScore),
        weight: 2.5,
        weighted: Math.round(asyncScore * 2.5),
        percent: total > 0 ? Math.round(asyncScore * 2.5 / total * 100) : 0,
        details: {
          asyncBoundaries: d.async.asyncBoundaries,
          promiseChains: d.async.promiseChains,
          callbackDepth: d.async.callbackDepth,
        },
      },
      coupling: {
        score: Math.round(couplingScore),
        weight: 3.0,
        weighted: Math.round(couplingScore * 3),
        percent: total > 0 ? Math.round(couplingScore * 3 / total * 100) : 0,
        details: {
          globalAccess: d.coupling.globalAccess.length,
          sideEffects: d.coupling.sideEffects.length,
          closureCaptures: d.coupling.closureCaptures.length,
          implicitIO: d.coupling.implicitIO.length,
        },
      },
    },
    primaryDimension: getPrimaryDimension(f),
    moduleType,
    cognitive: f.cognitive,
    contributions: d.contributions,
  }, null, 2);
}

async function getHotspotsImpl(
  directory: string,
  moduleType: TensorModuleType,
  topN = 10,
  pattern?: string
): Promise<string> {
  const absolutePath = path.resolve(directory);

  if (!fs.existsSync(absolutePath)) {
    return JSON.stringify({ error: `Directory not found: ${absolutePath}` });
  }

  const filePattern = pattern || '**/*.{ts,tsx,js,jsx}';

  const files = await glob(filePattern, {
    cwd: absolutePath,
    ignore: ['**/node_modules/**', '**/dist/**', '**/*.test.ts', '**/*.d.ts'],
    absolute: true,
  });

  const hotspots: Array<{
    name: string;
    file: string;
    line: number;
    mccabe: number;
    dimensional: number;
    tensor: TensorScoreOutput;
    ratio: number;
    primaryDimension: string;
  }> = [];

  for (const file of files) {
    try {
      if (!isTypeScriptFile(file)) continue;

      const content = fs.readFileSync(file, 'utf-8');
      const sourceFile = parseSourceFile(file, content);

      function visit(node: ts.Node) {
        const funcInfo = extractFunctionInfo(node, sourceFile);
        if (funcInfo) {
          const result = analyzeFunctionExtended(node, sourceFile, funcInfo);
          const tensor = calculateTensorFromDimensional(result.dimensional, moduleType);
          hotspots.push({
            name: funcInfo.name,
            file: path.relative(absolutePath, file),
            line: funcInfo.location.startLine,
            mccabe: result.cyclomatic,
            dimensional: Math.round(result.dimensional.weighted * 10) / 10,
            tensor,
            ratio: result.cyclomatic > 0 ? Math.round((result.dimensional.weighted / result.cyclomatic) * 100) / 100 : 0,
            primaryDimension: getPrimaryDimension(result),
          });
        }
        ts.forEachChild(node, visit);
      }

      ts.forEachChild(sourceFile, visit);
    } catch {
      // Skip unparseable files
    }
  }

  hotspots.sort((a, b) => b.dimensional - a.dimensional);

  return JSON.stringify({
    directory: absolutePath,
    language: 'typescript',
    moduleType,
    totalFunctions: hotspots.length,
    hotspots: hotspots.slice(0, topN),
  }, null, 2);
}

async function suggestRefactorImpl(filePath: string, functionName: string, moduleType: TensorModuleType): Promise<string> {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    return JSON.stringify({ error: `File not found: ${absolutePath}` });
  }

  if (!isTypeScriptFile(absolutePath)) {
    return JSON.stringify({
      error: `Unsupported file type. This MCP only supports TypeScript/JavaScript.`,
    });
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const sourceFile = parseSourceFile(absolutePath, content);
  let found: ExtendedComplexityResult | null = null;

  function visit(node: ts.Node) {
    const funcInfo = extractFunctionInfo(node, sourceFile);
    if (funcInfo && funcInfo.name === functionName) {
      found = analyzeFunctionExtended(node, sourceFile, funcInfo);
    }
    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sourceFile, visit);

  if (!found) {
    return JSON.stringify({ error: `Function '${functionName}' not found` });
  }

  const f = found as ExtendedComplexityResult;
  const suggestions = generateSuggestions(f);
  const tensor = calculateTensorFromDimensional(f.dimensional, moduleType);

  return JSON.stringify({
    function: functionName,
    language: 'typescript',
    moduleType,
    complexity: {
      mccabe: f.cyclomatic,
      dimensional: Math.round(f.dimensional.weighted * 10) / 10,
      ratio: f.cyclomatic > 0 ? Math.round((f.dimensional.weighted / f.cyclomatic) * 100) / 100 : 0,
    },
    tensor,
    primaryIssue: getPrimaryDimension(f),
    suggestions,
  }, null, 2);
}

async function generateGraph(
  targetPath: string,
  graphType: 'dependency' | 'call' = 'dependency',
  format: 'mermaid' | 'dot' = 'mermaid'
): Promise<string> {
  const absolutePath = path.resolve(targetPath);

  if (!fs.existsSync(absolutePath)) {
    return JSON.stringify({ error: `Path not found: ${absolutePath}` });
  }

  const stat = fs.statSync(absolutePath);

  if (graphType === 'call') {
    if (stat.isDirectory()) {
      return JSON.stringify({ error: 'Call graph requires a single file, not a directory' });
    }

    if (!isTypeScriptFile(absolutePath)) {
      return JSON.stringify({ error: 'Call graph only supports TypeScript/JavaScript files' });
    }

    const content = fs.readFileSync(absolutePath, 'utf-8');
    const sourceFile = parseSourceFile(absolutePath, content);
    const callGraph = new CallGraph();

    callGraph.analyzeSourceFile(sourceFile);

    const graphOutput = exportToMermaid(callGraph);
    return JSON.stringify({
      graphType: 'call',
      format: 'mermaid',
      file: path.basename(absolutePath),
      graph: graphOutput,
    }, null, 2);
  }

  // Dependency graph
  const projectRoot = stat.isDirectory() ? absolutePath : path.dirname(absolutePath);
  const depGraph = new DependencyGraph(projectRoot);

  if (stat.isDirectory()) {
    depGraph.analyzeDirectory(absolutePath);
  } else {
    const content = fs.readFileSync(absolutePath, 'utf-8');
    depGraph.analyzeFile(absolutePath, content);
  }

  const graphOutput = format === 'dot' ? exportToDot(depGraph) : depGraph.getAllNodes().map(n => ({
    file: path.relative(projectRoot, n.filePath),
    imports: n.imports.map(i => path.relative(projectRoot, i)),
    depth: n.depth,
  }));

  return JSON.stringify({
    graphType: 'dependency',
    format,
    path: absolutePath,
    nodeCount: depGraph.getAllNodes().length,
    circularDependencies: depGraph.findCircularDependencies().length,
    graph: graphOutput,
  }, null, 2);
}

async function validateComplexityImpl(
  filePath: string,
  moduleType: TensorModuleType,
  functionName?: string
): Promise<string> {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    return JSON.stringify({ error: `File not found: ${absolutePath}` });
  }

  if (!isTypeScriptFile(absolutePath)) {
    return JSON.stringify({ error: 'Validation only supports TypeScript/JavaScript' });
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const sourceFile = parseSourceFile(absolutePath, content);

  interface FunctionValidation {
    name: string;
    line: number;
    vector: Vector5D;
    isCanonical: boolean;
    status: string;
    violationDimensions: string[];
  }

  const results: FunctionValidation[] = [];

  function visit(node: ts.Node) {
    const funcInfo = extractFunctionInfo(node, sourceFile);
    if (funcInfo && (!functionName || funcInfo.name === functionName)) {
      const result = analyzeFunctionExtended(node, sourceFile, funcInfo);
      const vector: Vector5D = {
        control: result.dimensional.control,
        nesting: result.dimensional.nesting,
        state: result.dimensional.state.stateMutations,
        async: result.dimensional.async.asyncBoundaries,
        coupling: result.dimensional.coupling.globalAccess.length + result.dimensional.coupling.sideEffects.length,
      };

      const profile = getCanonicalProfile(moduleType);
      const isWithinBounds = isWithinCanonicalBounds(vector, profile);
      const deviation = analyzeDeviation(vector, moduleType);

      results.push({
        name: funcInfo.name,
        line: funcInfo.location.startLine,
        vector,
        isCanonical: isWithinBounds,
        status: deviation.status,
        violationDimensions: deviation.violationDimensions,
      });
    }
    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sourceFile, visit);

  if (results.length === 0) {
    return JSON.stringify({ error: functionName ? `Function '${functionName}' not found` : 'No functions found' });
  }

  const passed = results.filter(r => r.isCanonical).length;
  const failed = results.filter(r => !r.isCanonical).length;
  const overallStatus = failed === 0 ? 'PASS' : failed > passed ? 'FAIL' : 'WARNING';

  return JSON.stringify({
    file: path.basename(absolutePath),
    language: 'typescript',
    moduleType,
    summary: {
      total: results.length,
      passed,
      failed,
      status: overallStatus,
    },
    functions: results.map(r => ({
      name: r.name,
      line: r.line,
      status: r.isCanonical ? 'PASS' : 'FAIL',
      violations: r.violationDimensions,
      vector: r.vector,
    })),
    recommendation: overallStatus === 'PASS'
      ? 'All functions are within canonical bounds.'
      : `${failed} function(s) exceed canonical bounds. Review: ${results.filter(r => !r.isCanonical).map(r => r.name).join(', ')}`,
  }, null, 2);
}

async function analyzeClassReusability(
  filePath: string,
  className?: string
): Promise<string> {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    return JSON.stringify({ error: `File not found: ${absolutePath}` });
  }

  if (!isTypeScriptFile(absolutePath)) {
    return JSON.stringify({
      error: `Unsupported file type. This MCP only supports TypeScript/JavaScript.`,
    });
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const result = analyzeClassesInFile(absolutePath, content);

  if (result.classes.length === 0) {
    return JSON.stringify({
      file: path.basename(absolutePath),
      error: 'No classes found in file',
    });
  }

  // Filter by class name if specified
  let classes = result.classes;
  if (className) {
    classes = classes.filter((c) => c.name === className);
    if (classes.length === 0) {
      return JSON.stringify({
        error: `Class '${className}' not found in ${filePath}`,
      });
    }
  }

  return JSON.stringify({
    file: path.basename(absolutePath),
    language: 'typescript',
    summary: {
      totalClasses: classes.length,
      avgReusability: Math.round(
        classes.reduce((sum, c) => sum + c.reusability.score, 0) / classes.length
      ),
      problematicCount: classes.filter((c) => c.reusability.zone === 'problematic').length,
    },
    classes: classes.map((c) => ({
      name: c.name,
      line: c.lineno,
      extends: c.extends,
      implements: c.implements,
      metrics: {
        wmc: c.metrics.wmc,
        lcom: Math.round(c.metrics.lcom * 100) / 100,
        cbo: c.metrics.cbo,
        rfc: c.metrics.rfc,
        dit: c.metrics.dit,
        nom: c.metrics.nom,
        nof: c.metrics.nof,
        loc: c.metrics.loc,
      },
      reusability: {
        score: c.reusability.score,
        grade: c.reusability.grade,
        zone: c.reusability.zone,
      },
      issues: c.reusability.issues.map((i) => ({
        metric: i.metric,
        severity: i.severity,
        message: i.message,
      })),
      recommendations: c.reusability.recommendations,
      methodCount: c.methods.length,
      fieldCount: c.fields.length,
    })),
  }, null, 2);
}

// ─────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────

function getPrimaryDimension(f: ExtendedComplexityResult): string {
  const d = f.dimensional;
  const scores = [
    { name: 'control', score: d.control },
    { name: 'nesting', score: d.nesting },
    { name: 'state', score: d.state.stateMutations * 2 },
    { name: 'async', score: d.async.asyncBoundaries + d.async.promiseChains },
    { name: 'coupling', score: d.coupling.globalAccess.length * 2 + d.coupling.sideEffects.length * 3 },
  ];
  scores.sort((a, b) => b.score - a.score);
  return scores[0].name;
}

function getInterpretation(f: ExtendedComplexityResult): string {
  const ratio = f.cyclomatic > 0 ? f.dimensional.weighted / f.cyclomatic : 0;
  if (ratio < 1.5) return 'McCabe accurately measures this function';
  if (ratio < 2) return 'Slight hidden complexity from nesting or state';
  if (ratio < 3) return 'Significant hidden complexity - consider refactoring';
  if (ratio < 5) return 'High hidden complexity - McCabe underestimates difficulty';
  return 'Severe hidden complexity - McCabe greatly underestimates maintenance cost';
}

function generateSuggestions(f: ExtendedComplexityResult): string[] {
  const suggestions: string[] = [];
  const d = f.dimensional;

  if (d.state.stateMutations > 5) {
    suggestions.push(`Reduce state mutations (${d.state.stateMutations} found). Consider using useReducer or immutable updates.`);
  }
  if (d.state.stateMachinePatterns.length > 0) {
    suggestions.push('Extract state machine logic into a separate module or use a state machine library.');
  }

  if (d.async.callbackDepth > 2) {
    suggestions.push(`Flatten callback nesting (depth: ${d.async.callbackDepth}). Use async/await instead.`);
  }
  if (d.async.promiseChains > 3) {
    suggestions.push(`Simplify Promise chains (${d.async.promiseChains} found). Consider async/await syntax.`);
  }
  if (d.async.asyncBoundaries > 0 && d.async.asyncErrorBoundaries === 0) {
    suggestions.push('Add error handling for async operations (try-catch or .catch()).');
  }

  if (d.coupling.globalAccess.length > 3) {
    suggestions.push(`Reduce global access (${d.coupling.globalAccess.length} found). Use dependency injection.`);
  }
  if (d.coupling.sideEffects.length > 2) {
    suggestions.push(`Isolate side effects (${d.coupling.sideEffects.length} found). Move to a separate service layer.`);
  }
  if (d.coupling.closureCaptures.length > 5) {
    suggestions.push(`Reduce closure captures (${d.coupling.closureCaptures.length} found). Use useCallback or extract logic.`);
  }

  if (d.nesting > 10) {
    suggestions.push(`Reduce nesting depth (penalty: ${d.nesting}). Use early returns and extract helper functions.`);
  }

  if (d.control > 15) {
    suggestions.push(`High cyclomatic complexity (${d.control}). Split into smaller functions with single responsibility.`);
  }

  if (suggestions.length === 0) {
    suggestions.push('Function complexity is acceptable. Consider minor improvements for maintainability.');
  }

  return suggestions;
}

// ─────────────────────────────────────────────────────────────────
// MCP Server Setup
// ─────────────────────────────────────────────────────────────────

const server = new Server(
  {
    name: 'semantic-complexity-ts-mcp',
    version: packageJson.version,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    let result: string;

    switch (name) {
      case 'get_hotspots':
        result = await getHotspotsImpl(
          args.directory as string,
          args.moduleType as TensorModuleType,
          args.topN as number,
          args.pattern as string | undefined
        );
        break;
      case 'analyze_file':
        result = await analyzeFileImpl(
          args.filePath as string,
          args.moduleType as TensorModuleType,
          args.threshold as number
        );
        break;
      case 'analyze_function':
        result = await analyzeFunctionImpl(
          args.filePath as string,
          args.functionName as string,
          args.moduleType as TensorModuleType
        );
        break;
      case 'suggest_refactor':
        result = await suggestRefactorImpl(
          args.filePath as string,
          args.functionName as string,
          args.moduleType as TensorModuleType
        );
        break;
      case 'generate_graph':
        result = await generateGraph(
          args.path as string,
          (args.graphType as 'dependency' | 'call') || 'dependency',
          (args.format as 'mermaid' | 'dot') || 'mermaid'
        );
        break;
      case 'validate_complexity':
        result = await validateComplexityImpl(
          args.filePath as string,
          args.moduleType as TensorModuleType,
          args.functionName as string | undefined
        );
        break;
      case 'analyze_class':
        result = await analyzeClassReusability(
          args.filePath as string,
          args.className as string | undefined
        );
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: 'text', text: result }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: (error as Error).message }) }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('TypeScript/JavaScript Complexity MCP Server running on stdio');
}

main().catch(console.error);
