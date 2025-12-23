#!/usr/bin/env node
/**
 * semantic-complexity-mcp
 *
 * MCP Server for Complexity Analysis
 * Provides tools for Claude and other LLMs to analyze code complexity
 *
 * v0.0.3: Auto language detection (TypeScript/JavaScript + Python)
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
import { execSync } from 'node:child_process';
import { glob } from 'glob';
import ts from 'typescript';

import {
  parseSourceFile,
  extractFunctionInfo,
  analyzeFunctionExtended,
  type ExtendedComplexityResult,
} from 'semantic-complexity';

// ─────────────────────────────────────────────────────────────────
// 언어 감지
// ─────────────────────────────────────────────────────────────────

type SupportedLanguage = 'typescript' | 'python' | 'unsupported';

const TS_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const PY_EXTENSIONS = new Set(['.py', '.pyw']);

function detectLanguage(filePath: string): SupportedLanguage {
  const ext = path.extname(filePath).toLowerCase();
  if (TS_EXTENSIONS.has(ext)) return 'typescript';
  if (PY_EXTENSIONS.has(ext)) return 'python';
  return 'unsupported';
}

function getLanguagePattern(language?: string): string {
  if (language === 'python') return '**/*.py';
  if (language === 'typescript') return '**/*.{ts,tsx,js,jsx}';
  return '**/*.{ts,tsx,js,jsx,py}'; // All supported
}

// ─────────────────────────────────────────────────────────────────
// Python 분석기 (CLI 호출)
// ─────────────────────────────────────────────────────────────────

interface PythonFunctionResult {
  name: string;
  lineno: number;
  end_lineno: number;
  cyclomatic: number;
  cognitive: number;
  dimensional: {
    weighted: number;
    control: number;
    nesting: number;
    state: { state_mutations: number };
    async_: { async_boundaries: number };
    coupling: { global_access: number; side_effects: number };
  };
}

function analyzePythonFile(filePath: string): PythonFunctionResult[] {
  try {
    // Python 패키지를 사용하여 분석
    const pythonCode = `
import json
import sys
sys.path.insert(0, '.')
try:
    from semantic_complexity import analyze_functions
    with open(r'${filePath.replace(/\\/g, '\\\\')}', 'r', encoding='utf-8') as f:
        source = f.read()
    results = analyze_functions(source, '${path.basename(filePath)}')
    output = []
    for r in results:
        output.append({
            'name': r.name,
            'lineno': r.lineno,
            'end_lineno': r.end_lineno,
            'cyclomatic': r.cyclomatic,
            'cognitive': r.cognitive,
            'dimensional': {
                'weighted': r.dimensional.weighted,
                'control': r.dimensional.control,
                'nesting': r.dimensional.nesting,
                'state': {'state_mutations': r.dimensional.state.state_mutations},
                'async_': {'async_boundaries': r.dimensional.async_.async_boundaries},
                'coupling': {
                    'global_access': r.dimensional.coupling.global_access,
                    'side_effects': r.dimensional.coupling.side_effects
                }
            }
        })
    print(json.dumps(output))
except Exception as e:
    print(json.dumps({'error': str(e)}))
`;
    const result = execSync(`python -c "${pythonCode.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`, {
      encoding: 'utf-8',
      timeout: 30000,
    });
    const parsed = JSON.parse(result.trim());
    if (parsed.error) {
      console.error('Python analysis error:', parsed.error);
      return [];
    }
    return parsed;
  } catch (error) {
    console.error('Failed to analyze Python file:', error);
    return [];
  }
}

function analyzePythonFunction(filePath: string, functionName: string): PythonFunctionResult | null {
  const results = analyzePythonFile(filePath);
  return results.find(r => r.name === functionName) || null;
}

// ─────────────────────────────────────────────────────────────────
// 도구 정의
// ─────────────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    name: 'analyze_file',
    description: 'Analyze complexity of a source file. Supports TypeScript/JavaScript (.ts, .tsx, .js, .jsx) and Python (.py). Returns McCabe cyclomatic, cognitive, and dimensional complexity for each function.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Absolute or relative path to the file to analyze (.ts, .tsx, .js, .jsx, .py)',
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
    description: 'Analyze a specific function by name in a file. Supports TypeScript/JavaScript and Python. Returns detailed dimensional complexity breakdown.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the file containing the function (.ts, .tsx, .js, .jsx, .py)',
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
    description: 'Find the most complex functions in a directory. Supports TypeScript/JavaScript and Python. Returns top N functions sorted by dimensional complexity.',
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
          description: 'Glob pattern for files (default: **/*.{ts,tsx,js,jsx,py})',
        },
        language: {
          type: 'string',
          enum: ['typescript', 'python', 'all'],
          description: 'Filter by language (default: all)',
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

  const language = detectLanguage(absolutePath);

  if (language === 'unsupported') {
    return JSON.stringify({
      error: `Unsupported file type: ${path.extname(absolutePath)}. Supported: .ts, .tsx, .js, .jsx, .py`,
    });
  }

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
    ratio: number;
  }> = [];

  if (language === 'python') {
    // Python 분석
    const pyResults = analyzePythonFile(absolutePath);
    for (const r of pyResults) {
      if (r.dimensional.weighted >= threshold) {
        results.push({
          name: r.name,
          line: r.lineno,
          mccabe: r.cyclomatic,
          cognitive: r.cognitive,
          dimensional: {
            weighted: Math.round(r.dimensional.weighted * 10) / 10,
            control: r.dimensional.control,
            nesting: r.dimensional.nesting,
            state: r.dimensional.state.state_mutations,
            async: r.dimensional.async_.async_boundaries,
            coupling: r.dimensional.coupling.global_access + r.dimensional.coupling.side_effects,
          },
          ratio: r.cyclomatic > 0 ? Math.round((r.dimensional.weighted / r.cyclomatic) * 100) / 100 : 0,
        });
      }
    }
  } else {
    // TypeScript/JavaScript 분석
    const content = fs.readFileSync(absolutePath, 'utf-8');
    const sourceFile = parseSourceFile(absolutePath, content);

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
  }

  return JSON.stringify({
    file: path.basename(absolutePath),
    language,
    functionCount: results.length,
    functions: results.sort((a, b) => b.dimensional.weighted - a.dimensional.weighted),
  }, null, 2);
}

async function analyzeFunction(filePath: string, functionName: string): Promise<string> {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    return JSON.stringify({ error: `File not found: ${absolutePath}` });
  }

  const language = detectLanguage(absolutePath);

  if (language === 'unsupported') {
    return JSON.stringify({
      error: `Unsupported file type: ${path.extname(absolutePath)}. Supported: .ts, .tsx, .js, .jsx, .py`,
    });
  }

  if (language === 'python') {
    // Python 분석
    const pyResult = analyzePythonFunction(absolutePath, functionName);
    if (!pyResult) {
      return JSON.stringify({ error: `Function '${functionName}' not found in ${filePath}` });
    }
    return JSON.stringify({
      name: pyResult.name,
      location: `${path.basename(absolutePath)}:${pyResult.lineno}`,
      language: 'python',
      mccabe: pyResult.cyclomatic,
      cognitive: pyResult.cognitive,
      dimensional: {
        weighted: pyResult.dimensional.weighted,
        control: pyResult.dimensional.control,
        nesting: pyResult.dimensional.nesting,
        state: pyResult.dimensional.state,
        async: pyResult.dimensional.async_,
        coupling: pyResult.dimensional.coupling,
      },
    }, null, 2);
  }

  // TypeScript/JavaScript 분석
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
    language: 'typescript',
    mccabe: f.cyclomatic,
    cognitive: f.cognitive,
    dimensional: f.dimensional,
  }, null, 2);
}

async function getHotspots(
  directory: string,
  topN = 10,
  pattern?: string,
  language: 'typescript' | 'python' | 'all' = 'all'
): Promise<string> {
  const absolutePath = path.resolve(directory);

  if (!fs.existsSync(absolutePath)) {
    return JSON.stringify({ error: `Directory not found: ${absolutePath}` });
  }

  // 언어에 따라 패턴 결정
  const filePattern = pattern || getLanguagePattern(language === 'all' ? undefined : language);

  const files = await glob(filePattern, {
    cwd: absolutePath,
    ignore: ['**/node_modules/**', '**/dist/**', '**/*.test.ts', '**/*.test.py', '**/*.d.ts', '**/__pycache__/**'],
    absolute: true,
  });

  const hotspots: Array<{
    name: string;
    file: string;
    line: number;
    language: string;
    mccabe: number;
    dimensional: number;
    ratio: number;
    primaryDimension: string;
  }> = [];

  for (const file of files) {
    try {
      const lang = detectLanguage(file);
      if (lang === 'unsupported') continue;

      if (lang === 'python') {
        // Python 파일 분석
        const pyResults = analyzePythonFile(file);
        for (const r of pyResults) {
          hotspots.push({
            name: r.name,
            file: path.relative(absolutePath, file),
            line: r.lineno,
            language: 'python',
            mccabe: r.cyclomatic,
            dimensional: Math.round(r.dimensional.weighted * 10) / 10,
            ratio: r.cyclomatic > 0 ? Math.round((r.dimensional.weighted / r.cyclomatic) * 100) / 100 : 0,
            primaryDimension: getPrimaryDimensionFromPython(r),
          });
        }
      } else {
        // TypeScript/JavaScript 파일 분석
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
              language: 'typescript',
              mccabe: result.cyclomatic,
              dimensional: Math.round(result.dimensional.weighted * 10) / 10,
              ratio: result.cyclomatic > 0 ? Math.round((result.dimensional.weighted / result.cyclomatic) * 100) / 100 : 0,
              primaryDimension: getPrimaryDimension(result),
            });
          }
          ts.forEachChild(node, visit);
        }

        ts.forEachChild(sourceFile, visit);
      }
    } catch {
      // Skip unparseable files
    }
  }

  hotspots.sort((a, b) => b.dimensional - a.dimensional);

  return JSON.stringify({
    directory: absolutePath,
    language: language,
    totalFunctions: hotspots.length,
    hotspots: hotspots.slice(0, topN),
  }, null, 2);
}

async function compareMccabeDimensional(filePath: string, functionName?: string): Promise<string> {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    return JSON.stringify({ error: `File not found: ${absolutePath}` });
  }

  const language = detectLanguage(absolutePath);

  if (language === 'unsupported') {
    return JSON.stringify({
      error: `Unsupported file type: ${path.extname(absolutePath)}. Supported: .ts, .tsx, .js, .jsx, .py`,
    });
  }

  const comparisons: Array<{
    name: string;
    line: number;
    mccabe: number;
    dimensional: number;
    ratio: number;
    hiddenComplexity: string;
    interpretation: string;
  }> = [];

  if (language === 'python') {
    // Python 분석
    const pyResults = analyzePythonFile(absolutePath);
    for (const r of pyResults) {
      if (functionName && r.name !== functionName) continue;
      const ratio = r.cyclomatic > 0 ? r.dimensional.weighted / r.cyclomatic : 0;

      comparisons.push({
        name: r.name,
        line: r.lineno,
        mccabe: r.cyclomatic,
        dimensional: Math.round(r.dimensional.weighted * 10) / 10,
        ratio: Math.round(ratio * 100) / 100,
        hiddenComplexity: ratio > 2 ? 'HIGH' : ratio > 1.5 ? 'MEDIUM' : 'LOW',
        interpretation: getInterpretationFromRatio(ratio),
      });
    }
  } else {
    // TypeScript/JavaScript 분석
    const content = fs.readFileSync(absolutePath, 'utf-8');
    const sourceFile = parseSourceFile(absolutePath, content);

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
  }

  const count = comparisons.length || 1; // prevent division by zero

  return JSON.stringify({
    file: path.basename(absolutePath),
    language,
    comparisons: comparisons.sort((a, b) => b.ratio - a.ratio),
    summary: {
      avgMccabe: Math.round(comparisons.reduce((s, c) => s + c.mccabe, 0) / count * 10) / 10,
      avgDimensional: Math.round(comparisons.reduce((s, c) => s + c.dimensional, 0) / count * 10) / 10,
      avgRatio: Math.round(comparisons.reduce((s, c) => s + c.ratio, 0) / count * 100) / 100,
      highHiddenComplexity: comparisons.filter(c => c.hiddenComplexity === 'HIGH').length,
    },
  }, null, 2);
}

async function suggestRefactor(filePath: string, functionName: string): Promise<string> {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    return JSON.stringify({ error: `File not found: ${absolutePath}` });
  }

  const language = detectLanguage(absolutePath);

  if (language === 'unsupported') {
    return JSON.stringify({
      error: `Unsupported file type: ${path.extname(absolutePath)}. Supported: .ts, .tsx, .js, .jsx, .py`,
    });
  }

  if (language === 'python') {
    // Python 분석
    const pyResult = analyzePythonFunction(absolutePath, functionName);
    if (!pyResult) {
      return JSON.stringify({ error: `Function '${functionName}' not found` });
    }

    const ratio = pyResult.cyclomatic > 0 ? pyResult.dimensional.weighted / pyResult.cyclomatic : 0;
    const suggestions = generateSuggestionsFromPython(pyResult);

    return JSON.stringify({
      function: functionName,
      language: 'python',
      complexity: {
        mccabe: pyResult.cyclomatic,
        dimensional: Math.round(pyResult.dimensional.weighted * 10) / 10,
        ratio: Math.round(ratio * 100) / 100,
      },
      primaryIssue: getPrimaryDimensionFromPython(pyResult),
      suggestions,
    }, null, 2);
  }

  // TypeScript/JavaScript 분석
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
    language: 'typescript',
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

  const language = detectLanguage(absolutePath);

  if (language === 'unsupported') {
    return JSON.stringify({
      error: `Unsupported file type: ${path.extname(absolutePath)}. Supported: .ts, .tsx, .js, .jsx, .py`,
    });
  }

  if (language === 'python') {
    // Python 분석
    const pyResult = analyzePythonFunction(absolutePath, functionName);
    if (!pyResult) {
      return JSON.stringify({ error: `Function '${functionName}' not found` });
    }

    const d = pyResult.dimensional;
    const stateScore = d.state.state_mutations;
    const asyncScore = d.async_.async_boundaries;
    const couplingScore = d.coupling.global_access + d.coupling.side_effects;

    return JSON.stringify({
      function: functionName,
      language: 'python',
      dimensions: {
        '1D_control': {
          score: d.control,
          weight: 1.0,
          weighted: d.control * 1.0,
          description: 'Branch points (if, elif, for, while)',
        },
        '2D_nesting': {
          score: d.nesting,
          weight: 1.5,
          weighted: d.nesting * 1.5,
          description: 'Nesting depth penalty',
        },
        '3D_state': {
          score: stateScore,
          weight: 2.0,
          weighted: stateScore * 2.0,
          details: {
            stateMutations: d.state.state_mutations,
          },
          description: 'State variables and mutations',
        },
        '4D_async': {
          score: asyncScore,
          weight: 2.5,
          weighted: asyncScore * 2.5,
          details: {
            asyncBoundaries: d.async_.async_boundaries,
          },
          description: 'async/await, asyncio patterns',
        },
        '5D_coupling': {
          score: couplingScore,
          weight: 3.0,
          weighted: couplingScore * 3.0,
          details: {
            globalAccess: d.coupling.global_access,
            sideEffects: d.coupling.side_effects,
          },
          description: 'Hidden dependencies and side effects',
        },
      },
      totalWeighted: Math.round(d.weighted * 10) / 10,
    }, null, 2);
  }

  // TypeScript/JavaScript 분석
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
    language: 'typescript',
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

function getPrimaryDimensionFromPython(r: PythonFunctionResult): string {
  const d = r.dimensional;
  const scores = [
    { name: '1D-control', score: d.control },
    { name: '2D-nesting', score: d.nesting },
    { name: '3D-state', score: d.state.state_mutations * 2 },
    { name: '4D-async', score: d.async_.async_boundaries * 2 },
    { name: '5D-coupling', score: d.coupling.global_access * 2 + d.coupling.side_effects * 3 },
  ];
  scores.sort((a, b) => b.score - a.score);
  return scores[0].name;
}

function getInterpretation(f: ExtendedComplexityResult): string {
  const ratio = f.cyclomatic > 0 ? f.dimensional.weighted / f.cyclomatic : 0;
  return getInterpretationFromRatio(ratio);
}

function getInterpretationFromRatio(ratio: number): string {
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

function generateSuggestionsFromPython(r: PythonFunctionResult): string[] {
  const suggestions: string[] = [];
  const d = r.dimensional;

  // 3D State
  if (d.state.state_mutations > 5) {
    suggestions.push(`Reduce state mutations (${d.state.state_mutations} found). Consider using dataclasses or immutable patterns.`);
  }

  // 4D Async
  if (d.async_.async_boundaries > 3) {
    suggestions.push(`High async complexity (${d.async_.async_boundaries} boundaries). Consider using asyncio.gather or task groups.`);
  }

  // 5D Coupling
  if (d.coupling.global_access > 3) {
    suggestions.push(`Reduce global access (${d.coupling.global_access} found). Use dependency injection.`);
  }
  if (d.coupling.side_effects > 2) {
    suggestions.push(`Isolate side effects (${d.coupling.side_effects} found). Move I/O to a separate layer.`);
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
    version: '0.0.3',
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
        result = await getHotspots(
          args.directory as string,
          args.topN as number,
          args.pattern as string | undefined,
          (args.language as 'typescript' | 'python' | 'all') || 'all'
        );
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
