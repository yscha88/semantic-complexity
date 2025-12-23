#!/usr/bin/env node
/**
 * semantic-complexity-mcp
 *
 * MCP Server for Complexity Analysis
 * Provides tools for Claude and other LLMs to analyze code complexity
 *
 * v0.0.4: Auto language detection (TypeScript/JavaScript + Python + Go)
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
import * as os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
  findBestTensorModuleType,
  analyzeDeviation,
  isWithinCanonicalBounds,
  getCanonicalProfile,
} from 'semantic-complexity';

// ─────────────────────────────────────────────────────────────────
// 언어 감지
// ─────────────────────────────────────────────────────────────────

type SupportedLanguage = 'typescript' | 'python' | 'go' | 'unsupported';

const TS_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const PY_EXTENSIONS = new Set(['.py', '.pyw']);
const GO_EXTENSIONS = new Set(['.go']);

function detectLanguage(filePath: string): SupportedLanguage {
  const ext = path.extname(filePath).toLowerCase();
  if (TS_EXTENSIONS.has(ext)) return 'typescript';
  if (PY_EXTENSIONS.has(ext)) return 'python';
  if (GO_EXTENSIONS.has(ext)) return 'go';
  return 'unsupported';
}

function getLanguagePattern(language?: string): string {
  if (language === 'python') return '**/*.py';
  if (language === 'typescript') return '**/*.{ts,tsx,js,jsx}';
  if (language === 'go') return '**/*.go';
  return '**/*.{ts,tsx,js,jsx,py,go}'; // All supported
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
  // v0.0.7: Full tensor/canonical analysis from native CLI
  tensor?: {
    linear: number;
    quadratic: number;
    regularized: number;
    rawSum: number;
    rawSumThreshold: number;
    rawSumRatio: number;
    zone: 'safe' | 'review' | 'violation';
  };
  moduleType?: {
    inferred: string;
    distance: number;
    confidence: number;
  };
  canonical?: {
    isCanonical: boolean;
    isOrphan: boolean;
    status: string;
    euclideanDistance: number;
    mahalanobisDistance: number;
    violations: string[];
  };
  hodge?: {
    algorithmic: number;
    architectural: number;
    balanced: number;
    total: number;
    balanceRatio: number;
    isHarmonic: boolean;
  };
  recommendations?: Array<{
    dimension: string;
    priority: number;
    action: string;
    expectedImpact: number;
  }>;
}

function analyzePythonFile(filePath: string): PythonFunctionResult[] {
  try {
    // Python 패키지를 사용하여 분석 (임시 파일 방식으로 Windows 호환성 확보)
    const tempDir = os.tmpdir();
    const tempScript = path.join(tempDir, `sc_analyze_${Date.now()}.py`);

    // 경로를 forward slash로 변환 (Python에서 더 안전)
    const safeFilePath = filePath.replace(/\\/g, '/');

    // py 패키지 디렉토리 찾기 (monorepo 구조 고려)
    const possiblePyPaths = [
      path.join(process.cwd(), 'py'),
      path.join(__dirname, '..', '..', '..', 'py'),
      path.join(__dirname, '..', '..', 'py'),
    ].map(p => p.replace(/\\/g, '/'));

    const pythonCode = `
import json
import sys
# Add possible py package paths
for p in ${JSON.stringify(possiblePyPaths)}:
    if p not in sys.path:
        sys.path.insert(0, p)
try:
    from semantic_complexity import analyze_functions
    from semantic_complexity.cli import func_to_dict
    with open(r'${safeFilePath}', 'r', encoding='utf-8') as f:
        source = f.read()
    results = analyze_functions(source, '${path.basename(filePath)}')
    # v0.0.7: Use CLI's func_to_dict for full tensor/canonical analysis
    output = [func_to_dict(r) for r in results]
    print(json.dumps(output))
except Exception as e:
    import traceback
    print(json.dumps({'error': str(e), 'traceback': traceback.format_exc()}))
`;

    // 임시 파일에 Python 코드 작성
    fs.writeFileSync(tempScript, pythonCode, 'utf-8');

    // Python 명령어 결정 (python3 우선, fallback으로 python)
    const pythonCommands = process.platform === 'win32'
      ? ['python', 'python3', 'py']  // Windows: python 우선
      : ['python3', 'python'];       // Linux/Mac: python3 우선

    try {
      let result: string | null = null;
      let lastError: Error | null = null;

      for (const cmd of pythonCommands) {
        try {
          result = execSync(`${cmd} "${tempScript}"`, {
            encoding: 'utf-8',
            timeout: 30000,
          });
          break; // 성공하면 루프 종료
        } catch (e) {
          lastError = e as Error;
          // 다음 명령어 시도
        }
      }

      if (result === null) {
        throw lastError || new Error('No Python interpreter found');
      }

      const parsed = JSON.parse(result.trim());
      if (parsed.error) {
        console.error('Python analysis error:', parsed.error);
        return [];
      }
      return parsed;
    } finally {
      // 임시 파일 정리
      try {
        fs.unlinkSync(tempScript);
      } catch {
        // 정리 실패해도 무시
      }
    }
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
// Go 분석기 (바이너리 호출)
// ─────────────────────────────────────────────────────────────────

// Go 결과 타입 (Python과 동일한 구조)
type GoFunctionResult = PythonFunctionResult;

function analyzeGoFile(filePath: string): GoFunctionResult[] {
  try {
    const safeFilePath = filePath.replace(/\\/g, '/');

    // Go 바이너리 경로 찾기
    const possibleGoBinPaths = [
      path.join(process.cwd(), 'go', 'semanticcomplexity', 'go-complexity'),
      path.join(process.cwd(), 'go', 'semanticcomplexity', 'go-complexity.exe'),
      path.join(__dirname, '..', '..', '..', 'go', 'semanticcomplexity', 'go-complexity'),
      path.join(__dirname, '..', '..', '..', 'go', 'semanticcomplexity', 'go-complexity.exe'),
    ];

    let goBinary: string | null = null;
    for (const binPath of possibleGoBinPaths) {
      if (fs.existsSync(binPath)) {
        goBinary = binPath;
        break;
      }
    }

    // 바이너리가 없으면 go run 사용 (fallback)
    if (!goBinary) {
      const goModPath = path.join(process.cwd(), 'go', 'semanticcomplexity');
      if (fs.existsSync(path.join(goModPath, 'go.mod'))) {
        try {
          const result = execSync(`go run ./cmd "${safeFilePath}"`, {
            encoding: 'utf-8',
            timeout: 30000,
            cwd: goModPath,
          });
          const parsed = JSON.parse(result.trim());
          if (parsed.error) {
            console.error('Go analysis error:', parsed.error);
            return [];
          }
          return parsed;
        } catch (e) {
          console.error('Failed to run go analyzer:', e);
          return [];
        }
      }
      console.error('Go analyzer not found');
      return [];
    }

    // 바이너리 실행
    const result = execSync(`"${goBinary}" "${safeFilePath}"`, {
      encoding: 'utf-8',
      timeout: 30000,
    });

    const parsed = JSON.parse(result.trim());
    if (parsed.error) {
      console.error('Go analysis error:', parsed.error);
      return [];
    }
    return parsed;
  } catch (error) {
    console.error('Failed to analyze Go file:', error);
    return [];
  }
}

function analyzeGoFunction(filePath: string, functionName: string): GoFunctionResult | null {
  const results = analyzeGoFile(filePath);
  return results.find(r => r.name === functionName) || null;
}

// ─────────────────────────────────────────────────────────────────
// Tensor Score 계산 (CDR-SOB 스타일 포함)
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
  moduleType: TensorModuleType = 'unknown'
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

function calculateTensorFromPython(
  dimensional: PythonFunctionResult['dimensional'],
  moduleType: TensorModuleType = 'unknown'
): TensorScoreOutput {
  const vector: Vector5D = {
    control: dimensional.control,
    nesting: dimensional.nesting,
    state: dimensional.state.state_mutations,
    async: dimensional.async_.async_boundaries,
    coupling: dimensional.coupling.global_access + dimensional.coupling.side_effects,
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
// 도구 정의
// ─────────────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  // ═══════════════════════════════════════════════════════════════
  // [ENTRY POINT] - 코드 품질 분석의 시작점
  // ═══════════════════════════════════════════════════════════════
  {
    name: 'get_hotspots',
    description: `[ENTRY POINT] Find complexity hotspots in a codebase.

USE THIS FIRST when user mentions:
- "refactoring", "리팩토링", "개선"
- "code quality", "코드 품질"
- "what should I improve?", "뭐 고쳐야 해?"
- "복잡한 코드", "복잡도"
- Starting code review or PR review

Returns top N functions sorted by dimensional complexity.
Supports TypeScript/JavaScript, Python, and Go.`,
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
          description: 'Glob pattern for files (default: **/*.{ts,tsx,js,jsx,py,go})',
        },
        language: {
          type: 'string',
          enum: ['typescript', 'python', 'go', 'all'],
          description: 'Filter by language (default: all)',
        },
      },
      required: ['directory'],
    },
  },
  // ═══════════════════════════════════════════════════════════════
  // File-level Analysis
  // ═══════════════════════════════════════════════════════════════
  {
    name: 'analyze_file',
    description: `Analyze complexity of all functions in a source file.

USE when:
- User opens or mentions a specific file
- After get_hotspots identifies a problematic file
- User asks "이 파일 분석해줘", "analyze this file"

Returns McCabe, cognitive, and dimensional complexity for each function.
Supports: .ts, .tsx, .js, .jsx, .py, .go`,
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
  // ═══════════════════════════════════════════════════════════════
  // Function-level Deep Analysis (통합: breakdown + compare)
  // ═══════════════════════════════════════════════════════════════
  {
    name: 'analyze_function',
    description: `Deep analysis of a specific function with full dimensional breakdown.

USE when:
- User asks about a specific function
- After get_hotspots/analyze_file identifies a complex function
- User wants to understand WHY a function is complex

Returns:
- McCabe vs Dimensional comparison (hidden complexity ratio)
- 5-dimension breakdown (Control, Nesting, State, Async, Coupling)
- Contribution percentages for each dimension
- Weighted scores with interpretation

Supports: TypeScript/JavaScript, Python, Go`,
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
  // ═══════════════════════════════════════════════════════════════
  // Refactoring Suggestions
  // ═══════════════════════════════════════════════════════════════
  {
    name: 'suggest_refactor',
    description: `Get actionable refactoring suggestions based on complexity profile.

USE when:
- User asks "어떻게 고쳐?", "how to fix?"
- After analyze_function shows high complexity
- User mentions "리팩토링", "refactor"

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
      },
      required: ['filePath', 'functionName'],
    },
  },
  // ═══════════════════════════════════════════════════════════════
  // Visualization
  // ═══════════════════════════════════════════════════════════════
  {
    name: 'generate_graph',
    description: `Generate dependency or call graph visualization.

USE when:
- User asks about dependencies, "의존성", "구조"
- User wants to see relationships between modules
- Architecture review

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
  // ═══════════════════════════════════════════════════════════════
  // Validation (통합: infer_module_type + check_canonical)
  // ═══════════════════════════════════════════════════════════════
  {
    name: 'validate_complexity',
    description: `Validate if code fits within canonical complexity bounds.

USE when:
- After writing new code (CI integration)
- PR review quality gate
- User asks "이거 괜찮아?", "is this okay?"

Auto-infers module type (api/lib/app/web/data/infra/deploy) and checks bounds.
Returns pass/fail status with specific violation details.`,
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Path to the file',
        },
        functionName: {
          type: 'string',
          description: 'Name of the function (optional: if omitted, validates entire file)',
        },
        moduleType: {
          type: 'string',
          enum: ['api', 'lib', 'app', 'web', 'data', 'infra', 'deploy', 'auto'],
          description: 'Expected module type (default: auto-infer)',
        },
      },
      required: ['filePath'],
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
      error: `Unsupported file type: ${path.extname(absolutePath)}. Supported: .ts, .tsx, .js, .jsx, .py, .go`,
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
    tensor: TensorScoreOutput;
    ratio: number;
  }> = [];

  if (language === 'python') {
    // Python 분석 - v0.0.7: 네이티브 tensor/canonical 결과 직접 사용
    const pyResults = analyzePythonFile(absolutePath);
    for (const r of pyResults) {
      if (r.dimensional.weighted >= threshold) {
        // v0.0.7: Python CLI에서 계산된 tensor 직접 사용, fallback으로 TS 계산
        const tensor = r.tensor || calculateTensorFromPython(r.dimensional);
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
          tensor,
          ratio: r.cyclomatic > 0 ? Math.round((r.dimensional.weighted / r.cyclomatic) * 100) / 100 : 0,
        });
      }
    }
  } else if (language === 'go') {
    // Go 분석 - v0.0.7: 네이티브 tensor/canonical 결과 직접 사용
    const goResults = analyzeGoFile(absolutePath);
    for (const r of goResults) {
      if (r.dimensional.weighted >= threshold) {
        // v0.0.7: Go CLI에서 계산된 tensor 직접 사용, fallback으로 TS 계산
        const tensor = r.tensor || calculateTensorFromPython(r.dimensional);
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
          tensor,
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
          const tensor = calculateTensorFromDimensional(result.dimensional);
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
      error: `Unsupported file type: ${path.extname(absolutePath)}. Supported: .ts, .tsx, .js, .jsx, .py, .go`,
    });
  }

  if (language === 'python') {
    // Python 분석 (통합: breakdown + compare)
    const pyResult = analyzePythonFunction(absolutePath, functionName);
    if (!pyResult) {
      return JSON.stringify({ error: `Function '${functionName}' not found in ${filePath}` });
    }

    const d = pyResult.dimensional;
    const ratio = pyResult.cyclomatic > 0 ? d.weighted / pyResult.cyclomatic : 0;
    const stateScore = d.state.state_mutations;
    const asyncScore = d.async_.async_boundaries;
    const couplingScore = d.coupling.global_access + d.coupling.side_effects;
    const total = d.control + d.nesting * 1.5 + stateScore * 2 + asyncScore * 2.5 + couplingScore * 3;

    return JSON.stringify({
      name: pyResult.name,
      location: `${path.basename(absolutePath)}:${pyResult.lineno}`,
      language: 'python',
      // McCabe vs Dimensional 비교
      comparison: {
        mccabe: pyResult.cyclomatic,
        dimensional: Math.round(d.weighted * 10) / 10,
        ratio: Math.round(ratio * 100) / 100,
        hiddenComplexity: ratio > 2 ? 'HIGH' : ratio > 1.5 ? 'MEDIUM' : 'LOW',
        interpretation: getInterpretationFromRatio(ratio),
      },
      // 차원별 상세 breakdown
      dimensions: {
        control: { score: d.control, weight: 1.0, weighted: d.control, percent: total > 0 ? Math.round(d.control / total * 100) : 0 },
        nesting: { score: d.nesting, weight: 1.5, weighted: d.nesting * 1.5, percent: total > 0 ? Math.round(d.nesting * 1.5 / total * 100) : 0 },
        state: { score: stateScore, weight: 2.0, weighted: stateScore * 2, percent: total > 0 ? Math.round(stateScore * 2 / total * 100) : 0, details: d.state },
        async: { score: asyncScore, weight: 2.5, weighted: asyncScore * 2.5, percent: total > 0 ? Math.round(asyncScore * 2.5 / total * 100) : 0, details: d.async_ },
        coupling: { score: couplingScore, weight: 3.0, weighted: couplingScore * 3, percent: total > 0 ? Math.round(couplingScore * 3 / total * 100) : 0, details: d.coupling },
      },
      primaryDimension: getPrimaryDimensionFromPython(pyResult),
      cognitive: pyResult.cognitive,
    }, null, 2);
  }

  if (language === 'go') {
    // Go 분석 (통합: breakdown + compare)
    const goResult = analyzeGoFunction(absolutePath, functionName);
    if (!goResult) {
      return JSON.stringify({ error: `Function '${functionName}' not found in ${filePath}` });
    }

    const d = goResult.dimensional;
    const ratio = goResult.cyclomatic > 0 ? d.weighted / goResult.cyclomatic : 0;
    const stateScore = d.state.state_mutations;
    const asyncScore = d.async_.async_boundaries;
    const couplingScore = d.coupling.global_access + d.coupling.side_effects;
    const total = d.control + d.nesting * 1.5 + stateScore * 2 + asyncScore * 2.5 + couplingScore * 3;

    return JSON.stringify({
      name: goResult.name,
      location: `${path.basename(absolutePath)}:${goResult.lineno}`,
      language: 'go',
      comparison: {
        mccabe: goResult.cyclomatic,
        dimensional: Math.round(d.weighted * 10) / 10,
        ratio: Math.round(ratio * 100) / 100,
        hiddenComplexity: ratio > 2 ? 'HIGH' : ratio > 1.5 ? 'MEDIUM' : 'LOW',
        interpretation: getInterpretationFromRatio(ratio),
      },
      dimensions: {
        control: { score: d.control, weight: 1.0, weighted: d.control, percent: total > 0 ? Math.round(d.control / total * 100) : 0 },
        nesting: { score: d.nesting, weight: 1.5, weighted: d.nesting * 1.5, percent: total > 0 ? Math.round(d.nesting * 1.5 / total * 100) : 0 },
        state: { score: stateScore, weight: 2.0, weighted: stateScore * 2, percent: total > 0 ? Math.round(stateScore * 2 / total * 100) : 0, details: d.state },
        async: { score: asyncScore, weight: 2.5, weighted: asyncScore * 2.5, percent: total > 0 ? Math.round(asyncScore * 2.5 / total * 100) : 0, details: d.async_ },
        coupling: { score: couplingScore, weight: 3.0, weighted: couplingScore * 3, percent: total > 0 ? Math.round(couplingScore * 3 / total * 100) : 0, details: d.coupling },
      },
      primaryDimension: getPrimaryDimensionFromPython(goResult),
      cognitive: goResult.cognitive,
    }, null, 2);
  }

  // TypeScript/JavaScript 분석 (통합: breakdown + compare)
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
    cognitive: f.cognitive,
    contributions: d.contributions,
  }, null, 2);
}

async function getHotspots(
  directory: string,
  topN = 10,
  pattern?: string,
  language: 'typescript' | 'python' | 'go' | 'all' = 'all'
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
      } else if (lang === 'go') {
        // Go 파일 분석
        const goResults = analyzeGoFile(file);
        for (const r of goResults) {
          hotspots.push({
            name: r.name,
            file: path.relative(absolutePath, file),
            line: r.lineno,
            language: 'go',
            mccabe: r.cyclomatic,
            dimensional: Math.round(r.dimensional.weighted * 10) / 10,
            ratio: r.cyclomatic > 0 ? Math.round((r.dimensional.weighted / r.cyclomatic) * 100) / 100 : 0,
            primaryDimension: getPrimaryDimensionFromPython(r), // Go와 Python 결과 형식 동일
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

// compareMccabeDimensional - 통합됨: analyze_function에서 comparison 필드로 제공

async function suggestRefactor(filePath: string, functionName: string): Promise<string> {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    return JSON.stringify({ error: `File not found: ${absolutePath}` });
  }

  const language = detectLanguage(absolutePath);

  if (language === 'unsupported') {
    return JSON.stringify({
      error: `Unsupported file type: ${path.extname(absolutePath)}. Supported: .ts, .tsx, .js, .jsx, .py, .go`,
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

  if (language === 'go') {
    // Go 분석
    const goResult = analyzeGoFunction(absolutePath, functionName);
    if (!goResult) {
      return JSON.stringify({ error: `Function '${functionName}' not found` });
    }

    const ratio = goResult.cyclomatic > 0 ? goResult.dimensional.weighted / goResult.cyclomatic : 0;
    const suggestions = generateSuggestionsFromGo(goResult);

    return JSON.stringify({
      function: functionName,
      language: 'go',
      complexity: {
        mccabe: goResult.cyclomatic,
        dimensional: Math.round(goResult.dimensional.weighted * 10) / 10,
        ratio: Math.round(ratio * 100) / 100,
      },
      primaryIssue: getPrimaryDimensionFromPython(goResult), // Go와 Python 결과 형식 동일
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

// getDimensionBreakdown - 통합됨: analyze_function에서 dimensions 필드로 제공

// ─────────────────────────────────────────────────────────────────
// 그래프 생성
// ─────────────────────────────────────────────────────────────────

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
    // Call graph requires a single TypeScript/JavaScript file
    if (stat.isDirectory()) {
      return JSON.stringify({ error: 'Call graph requires a single file, not a directory' });
    }

    const lang = detectLanguage(absolutePath);
    if (lang !== 'typescript') {
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
    graph: format === 'dot' ? graphOutput : graphOutput,
  }, null, 2);
}

// inferModuleType, checkCanonical - 통합됨: validate_complexity에서 제공

// ─────────────────────────────────────────────────────────────────
// 통합 검증 (infer_module_type + check_canonical)
// ─────────────────────────────────────────────────────────────────

async function validateComplexity(
  filePath: string,
  functionName?: string,
  moduleType?: TensorModuleType | 'auto'
): Promise<string> {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    return JSON.stringify({ error: `File not found: ${absolutePath}` });
  }

  const language = detectLanguage(absolutePath);

  if (language !== 'typescript') {
    return JSON.stringify({ error: 'Validation only supports TypeScript/JavaScript for now' });
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const sourceFile = parseSourceFile(absolutePath, content);

  interface FunctionValidation {
    name: string;
    line: number;
    vector: Vector5D;
    moduleType: TensorModuleType;
    confidence: number;
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

      // Auto-infer or use provided module type
      const bestFit = findBestTensorModuleType(vector);
      const targetModuleType = (moduleType && moduleType !== 'auto') ? moduleType : bestFit.type;
      const profile = getCanonicalProfile(targetModuleType);
      const isWithinBounds = isWithinCanonicalBounds(vector, profile);
      const deviation = analyzeDeviation(vector, targetModuleType);

      results.push({
        name: funcInfo.name,
        line: funcInfo.location.startLine,
        vector,
        moduleType: targetModuleType,
        confidence: Math.round((1 - bestFit.distance / 50) * 100) / 100,
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
    summary: {
      total: results.length,
      passed,
      failed,
      status: overallStatus,
    },
    functions: results.map(r => ({
      name: r.name,
      line: r.line,
      moduleType: r.moduleType,
      confidence: r.confidence,
      status: r.isCanonical ? 'PASS' : 'FAIL',
      violations: r.violationDimensions,
      vector: r.vector,
    })),
    recommendation: overallStatus === 'PASS'
      ? 'All functions are within canonical bounds.'
      : `${failed} function(s) exceed canonical bounds. Review: ${results.filter(r => !r.isCanonical).map(r => r.name).join(', ')}`,
  }, null, 2);
}

// ─────────────────────────────────────────────────────────────────
// 헬퍼 함수
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

function getPrimaryDimensionFromPython(r: PythonFunctionResult): string {
  const d = r.dimensional;
  const scores = [
    { name: 'control', score: d.control },
    { name: 'nesting', score: d.nesting },
    { name: 'state', score: d.state.state_mutations * 2 },
    { name: 'async', score: d.async_.async_boundaries * 2 },
    { name: 'coupling', score: d.coupling.global_access * 2 + d.coupling.side_effects * 3 },
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

  // State
  if (d.state.stateMutations > 5) {
    suggestions.push(`Reduce state mutations (${d.state.stateMutations} found). Consider using useReducer or immutable updates.`);
  }
  if (d.state.stateMachinePatterns.length > 0) {
    suggestions.push('Extract state machine logic into a separate module or use a state machine library.');
  }

  // Async
  if (d.async.callbackDepth > 2) {
    suggestions.push(`Flatten callback nesting (depth: ${d.async.callbackDepth}). Use async/await instead.`);
  }
  if (d.async.promiseChains > 3) {
    suggestions.push(`Simplify Promise chains (${d.async.promiseChains} found). Consider async/await syntax.`);
  }
  if (d.async.asyncBoundaries > 0 && d.async.asyncErrorBoundaries === 0) {
    suggestions.push('Add error handling for async operations (try-catch or .catch()).');
  }

  // Coupling
  if (d.coupling.globalAccess.length > 3) {
    suggestions.push(`Reduce global access (${d.coupling.globalAccess.length} found). Use dependency injection.`);
  }
  if (d.coupling.sideEffects.length > 2) {
    suggestions.push(`Isolate side effects (${d.coupling.sideEffects.length} found). Move to a separate service layer.`);
  }
  if (d.coupling.closureCaptures.length > 5) {
    suggestions.push(`Reduce closure captures (${d.coupling.closureCaptures.length} found). Use useCallback or extract logic.`);
  }

  // Nesting
  if (d.nesting > 10) {
    suggestions.push(`Reduce nesting depth (penalty: ${d.nesting}). Use early returns and extract helper functions.`);
  }

  // Control
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

  // State
  if (d.state.state_mutations > 5) {
    suggestions.push(`Reduce state mutations (${d.state.state_mutations} found). Consider using dataclasses or immutable patterns.`);
  }

  // Async
  if (d.async_.async_boundaries > 3) {
    suggestions.push(`High async complexity (${d.async_.async_boundaries} boundaries). Consider using asyncio.gather or task groups.`);
  }

  // Coupling
  if (d.coupling.global_access > 3) {
    suggestions.push(`Reduce global access (${d.coupling.global_access} found). Use dependency injection.`);
  }
  if (d.coupling.side_effects > 2) {
    suggestions.push(`Isolate side effects (${d.coupling.side_effects} found). Move I/O to a separate layer.`);
  }

  // Nesting
  if (d.nesting > 10) {
    suggestions.push(`Reduce nesting depth (penalty: ${d.nesting}). Use early returns and extract helper functions.`);
  }

  // Control
  if (d.control > 15) {
    suggestions.push(`High cyclomatic complexity (${d.control}). Split into smaller functions with single responsibility.`);
  }

  if (suggestions.length === 0) {
    suggestions.push('Function complexity is acceptable. Consider minor improvements for maintainability.');
  }

  return suggestions;
}

function generateSuggestionsFromGo(r: GoFunctionResult): string[] {
  const suggestions: string[] = [];
  const d = r.dimensional;

  // State
  if (d.state.state_mutations > 5) {
    suggestions.push(`Reduce state mutations (${d.state.state_mutations} found). Consider using immutable patterns or smaller functions.`);
  }

  // Async (goroutines/channels)
  if (d.async_.async_boundaries > 3) {
    suggestions.push(`High concurrency complexity (${d.async_.async_boundaries} goroutine/channel operations). Consider using errgroup or worker pools.`);
  }

  // Coupling
  if (d.coupling.global_access > 3) {
    suggestions.push(`Reduce global access (${d.coupling.global_access} found). Use dependency injection.`);
  }
  if (d.coupling.side_effects > 2) {
    suggestions.push(`Isolate side effects (${d.coupling.side_effects} found). Move I/O to interface-based dependencies.`);
  }

  // Nesting
  if (d.nesting > 10) {
    suggestions.push(`Reduce nesting depth (penalty: ${d.nesting}). Use early returns and extract helper functions.`);
  }

  // Control
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
    version: '0.0.7',
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
      // 6개 통합 도구
      case 'get_hotspots':
        result = await getHotspots(
          args.directory as string,
          args.topN as number,
          args.pattern as string | undefined,
          (args.language as 'typescript' | 'python' | 'go' | 'all') || 'all'
        );
        break;
      case 'analyze_file':
        result = await analyzeFile(args.filePath as string, args.threshold as number);
        break;
      case 'analyze_function':
        result = await analyzeFunction(args.filePath as string, args.functionName as string);
        break;
      case 'suggest_refactor':
        result = await suggestRefactor(args.filePath as string, args.functionName as string);
        break;
      case 'generate_graph':
        result = await generateGraph(
          args.path as string,
          (args.graphType as 'dependency' | 'call') || 'dependency',
          (args.format as 'mermaid' | 'dot') || 'mermaid'
        );
        break;
      case 'validate_complexity':
        result = await validateComplexity(
          args.filePath as string,
          args.functionName as string | undefined,
          (args.moduleType as TensorModuleType | 'auto') || 'auto'
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

// 서버 시작
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Complexity MCP Server running on stdio');
}

main().catch(console.error);
