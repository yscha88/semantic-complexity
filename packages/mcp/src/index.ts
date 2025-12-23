#!/usr/bin/env node
/**
 * semantic-complexity-mcp
 *
 * MCP Server for Complexity Analysis
 * Provides tools for Claude and other LLMs to analyze code complexity
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
import { glob } from 'glob';
import ts from 'typescript';

import {
  parseSourceFile,
  extractFunctionInfo,
  analyzeFunctionExtended,
  type ExtendedComplexityResult,
} from 'semantic-complexity';

// ─────────────────────────────────────────────────────────────────
// 도구 정의
// ─────────────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    name: 'analyze_file',
    description: 'Analyze complexity of a single TypeScript/JavaScript file. Returns McCabe cyclomatic, cognitive, and dimensional complexity for each function.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Absolute or relative path to the file to analyze',
        },
        threshold: {
          type: 'number',
          description: 'Minimum dimensional complexity to include in results (default: 0)',
        },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'analyze_function',
    description: 'Analyze a specific function by name in a file. Returns detailed dimensional complexity breakdown.',
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
      },
      required: ['filePath', 'functionName'],
    },
  },
  {
    name: 'get_hotspots',
    description: 'Find the most complex functions in a directory. Returns top N functions sorted by dimensional complexity.',
    inputSchema: {
      type: 'object',
      properties: {
        directory: {
          type: 'string',
          description: 'Directory path to scan',
        },
        topN: {
          type: 'number',
          description: 'Number of hotspots to return (default: 10)',
        },
        pattern: {
          type: 'string',
          description: 'Glob pattern for files (default: **/*.{ts,tsx})',
        },
      },
      required: ['directory'],
    },
  },
  {
    name: 'compare_mccabe_dimensional',
    description: 'Compare McCabe cyclomatic complexity with dimensional complexity for a file or function. Highlights hidden complexity that McCabe misses.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the file to analyze',
        },
        functionName: {
          type: 'string',
          description: 'Optional: specific function to compare',
        },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'suggest_refactor',
    description: 'Get refactoring suggestions for a complex function based on its dimensional complexity profile.',
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
      },
      required: ['filePath', 'functionName'],
    },
  },
  {
    name: 'get_dimension_breakdown',
    description: 'Get detailed breakdown of each complexity dimension (1D-5D) for a function.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the file',
        },
        functionName: {
          type: 'string',
          description: 'Name of the function',
        },
      },
      required: ['filePath', 'functionName'],
    },
  },
];

// ─────────────────────────────────────────────────────────────────
// 도구 구현
// ─────────────────────────────────────────────────────────────────

async function analyzeFile(filePath: string, threshold = 0): Promise<string> {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    return JSON.stringify({ error: `File not found: ${absolutePath}` });
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const sourceFile = parseSourceFile(absolutePath, content);
  const results: any[] = [];

  function visit(node: ts.Node) {
    const funcInfo = extractFunctionInfo(node, sourceFile);
    if (funcInfo) {
      const result = analyzeFunctionExtended(node, sourceFile, funcInfo);
      if (result.dimensional.weighted >= threshold) {
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
          ratio: result.cyclomatic > 0 ? Math.round((result.dimensional.weighted / result.cyclomatic) * 100) / 100 : 0,
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sourceFile, visit);

  return JSON.stringify({
    file: path.basename(absolutePath),
    functionCount: results.length,
    functions: results.sort((a, b) => b.dimensional.weighted - a.dimensional.weighted),
  }, null, 2);
}

async function analyzeFunction(filePath: string, functionName: string): Promise<string> {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    return JSON.stringify({ error: `File not found: ${absolutePath}` });
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
  return JSON.stringify({
    name: f.function.name,
    location: `${path.basename(absolutePath)}:${f.function.location.startLine}`,
    mccabe: f.cyclomatic,
    cognitive: f.cognitive,
    dimensional: f.dimensional,
  }, null, 2);
}

async function getHotspots(directory: string, topN = 10, pattern = '**/*.{ts,tsx}'): Promise<string> {
  const absolutePath = path.resolve(directory);

  if (!fs.existsSync(absolutePath)) {
    return JSON.stringify({ error: `Directory not found: ${absolutePath}` });
  }

  const files = await glob(pattern, {
    cwd: absolutePath,
    ignore: ['**/node_modules/**', '**/dist/**', '**/*.test.ts', '**/*.d.ts'],
    absolute: true,
  });

  const hotspots: any[] = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const sourceFile = parseSourceFile(file, content);

      function visit(node: ts.Node) {
        const funcInfo = extractFunctionInfo(node, sourceFile);
        if (funcInfo) {
          const result = analyzeFunctionExtended(node, sourceFile, funcInfo);
          hotspots.push({
            name: funcInfo.name,
            file: path.relative(absolutePath, file),
            line: funcInfo.location.startLine,
            mccabe: result.cyclomatic,
            dimensional: Math.round(result.dimensional.weighted * 10) / 10,
            ratio: result.cyclomatic > 0 ? Math.round((result.dimensional.weighted / result.cyclomatic) * 100) / 100 : 0,
            primaryDimension: getPrimaryDimension(result),
          });
        }
        ts.forEachChild(node, visit);
      }

      ts.forEachChild(sourceFile, visit);
    } catch (e) {
      // Skip unparseable files
    }
  }

  hotspots.sort((a, b) => b.dimensional - a.dimensional);

  return JSON.stringify({
    directory: absolutePath,
    totalFunctions: hotspots.length,
    hotspots: hotspots.slice(0, topN),
  }, null, 2);
}

async function compareMccabeDimensional(filePath: string, functionName?: string): Promise<string> {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    return JSON.stringify({ error: `File not found: ${absolutePath}` });
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const sourceFile = parseSourceFile(absolutePath, content);
  const comparisons: any[] = [];

  function visit(node: ts.Node) {
    const funcInfo = extractFunctionInfo(node, sourceFile);
    if (funcInfo && (!functionName || funcInfo.name === functionName)) {
      const result = analyzeFunctionExtended(node, sourceFile, funcInfo);
      const ratio = result.cyclomatic > 0 ? result.dimensional.weighted / result.cyclomatic : 0;

      comparisons.push({
        name: funcInfo.name,
        line: funcInfo.location.startLine,
        mccabe: result.cyclomatic,
        dimensional: Math.round(result.dimensional.weighted * 10) / 10,
        ratio: Math.round(ratio * 100) / 100,
        hiddenComplexity: ratio > 2 ? 'HIGH' : ratio > 1.5 ? 'MEDIUM' : 'LOW',
        interpretation: getInterpretation(result),
      });
    }
    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sourceFile, visit);

  return JSON.stringify({
    file: path.basename(absolutePath),
    comparisons: comparisons.sort((a, b) => b.ratio - a.ratio),
    summary: {
      avgMccabe: Math.round(comparisons.reduce((s, c) => s + c.mccabe, 0) / comparisons.length * 10) / 10,
      avgDimensional: Math.round(comparisons.reduce((s, c) => s + c.dimensional, 0) / comparisons.length * 10) / 10,
      avgRatio: Math.round(comparisons.reduce((s, c) => s + c.ratio, 0) / comparisons.length * 100) / 100,
      highHiddenComplexity: comparisons.filter(c => c.hiddenComplexity === 'HIGH').length,
    },
  }, null, 2);
}

async function suggestRefactor(filePath: string, functionName: string): Promise<string> {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    return JSON.stringify({ error: `File not found: ${absolutePath}` });
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

  return JSON.stringify({
    function: functionName,
    complexity: {
      mccabe: f.cyclomatic,
      dimensional: Math.round(f.dimensional.weighted * 10) / 10,
      ratio: f.cyclomatic > 0 ? Math.round((f.dimensional.weighted / f.cyclomatic) * 100) / 100 : 0,
    },
    primaryIssue: getPrimaryDimension(f),
    suggestions,
  }, null, 2);
}

async function getDimensionBreakdown(filePath: string, functionName: string): Promise<string> {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    return JSON.stringify({ error: `File not found: ${absolutePath}` });
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
  const d = f.dimensional;

  return JSON.stringify({
    function: functionName,
    dimensions: {
      '1D_control': {
        score: d.control,
        weight: 1.0,
        weighted: d.control * 1.0,
        description: 'Branch points (if, switch, loops)',
      },
      '2D_nesting': {
        score: d.nesting,
        weight: 1.5,
        weighted: d.nesting * 1.5,
        description: 'Nesting depth penalty',
      },
      '3D_state': {
        score: d.state,
        weight: 2.0,
        details: {
          enumStates: d.state.enumStates,
          stateMutations: d.state.stateMutations,
          stateReads: d.state.stateReads,
          stateBranches: d.state.stateBranches,
        },
        description: 'State variables and mutations',
      },
      '4D_async': {
        score: d.async,
        weight: 2.5,
        details: {
          asyncBoundaries: d.async.asyncBoundaries,
          promiseChains: d.async.promiseChains,
          callbackDepth: d.async.callbackDepth,
          concurrencyPatterns: d.async.concurrencyPatterns.length,
        },
        description: 'Async/await, Promises, callbacks',
      },
      '5D_coupling': {
        score: d.coupling,
        weight: 3.0,
        details: {
          globalAccess: d.coupling.globalAccess.length,
          implicitIO: d.coupling.implicitIO.length,
          sideEffects: d.coupling.sideEffects.length,
          envDependency: d.coupling.envDependency.length,
          closureCaptures: d.coupling.closureCaptures.length,
        },
        description: 'Hidden dependencies and side effects',
      },
    },
    totalWeighted: Math.round(d.weighted * 10) / 10,
    contributions: d.contributions,
  }, null, 2);
}

// ─────────────────────────────────────────────────────────────────
// 헬퍼 함수
// ─────────────────────────────────────────────────────────────────

function getPrimaryDimension(f: ExtendedComplexityResult): string {
  const d = f.dimensional;
  const scores = [
    { name: '1D-control', score: d.control },
    { name: '2D-nesting', score: d.nesting },
    { name: '3D-state', score: d.state.stateMutations * 2 },
    { name: '4D-async', score: d.async.asyncBoundaries + d.async.promiseChains },
    { name: '5D-coupling', score: d.coupling.globalAccess.length * 2 + d.coupling.sideEffects.length * 3 },
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

  // 3D State
  if (d.state.stateMutations > 5) {
    suggestions.push(`Reduce state mutations (${d.state.stateMutations} found). Consider using useReducer or immutable updates.`);
  }
  if (d.state.stateMachinePatterns.length > 0) {
    suggestions.push('Extract state machine logic into a separate module or use a state machine library.');
  }

  // 4D Async
  if (d.async.callbackDepth > 2) {
    suggestions.push(`Flatten callback nesting (depth: ${d.async.callbackDepth}). Use async/await instead.`);
  }
  if (d.async.promiseChains > 3) {
    suggestions.push(`Simplify Promise chains (${d.async.promiseChains} found). Consider async/await syntax.`);
  }
  if (d.async.asyncBoundaries > 0 && d.async.asyncErrorBoundaries === 0) {
    suggestions.push('Add error handling for async operations (try-catch or .catch()).');
  }

  // 5D Coupling
  if (d.coupling.globalAccess.length > 3) {
    suggestions.push(`Reduce global access (${d.coupling.globalAccess.length} found). Use dependency injection.`);
  }
  if (d.coupling.sideEffects.length > 2) {
    suggestions.push(`Isolate side effects (${d.coupling.sideEffects.length} found). Move to a separate service layer.`);
  }
  if (d.coupling.closureCaptures.length > 5) {
    suggestions.push(`Reduce closure captures (${d.coupling.closureCaptures.length} found). Use useCallback or extract logic.`);
  }

  // 2D Nesting
  if (d.nesting > 10) {
    suggestions.push(`Reduce nesting depth (penalty: ${d.nesting}). Use early returns and extract helper functions.`);
  }

  // 1D Control
  if (d.control > 15) {
    suggestions.push(`High cyclomatic complexity (${d.control}). Split into smaller functions with single responsibility.`);
  }

  if (suggestions.length === 0) {
    suggestions.push('Function complexity is acceptable. Consider minor improvements for maintainability.');
  }

  return suggestions;
}

// ─────────────────────────────────────────────────────────────────
// MCP 서버 설정
// ─────────────────────────────────────────────────────────────────

const server = new Server(
  {
    name: 'semantic-complexity-mcp',
    version: '0.0.1',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 도구 목록 핸들러
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// 도구 실행 핸들러
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    let result: string;

    switch (name) {
      case 'analyze_file':
        result = await analyzeFile(args.filePath as string, args.threshold as number);
        break;
      case 'analyze_function':
        result = await analyzeFunction(args.filePath as string, args.functionName as string);
        break;
      case 'get_hotspots':
        result = await getHotspots(args.directory as string, args.topN as number, args.pattern as string);
        break;
      case 'compare_mccabe_dimensional':
        result = await compareMccabeDimensional(args.filePath as string, args.functionName as string);
        break;
      case 'suggest_refactor':
        result = await suggestRefactor(args.filePath as string, args.functionName as string);
        break;
      case 'get_dimension_breakdown':
        result = await getDimensionBreakdown(args.filePath as string, args.functionName as string);
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

// 서버 시작
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Complexity MCP Server running on stdio');
}

main().catch(console.error);
