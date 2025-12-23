/**
 * semantic-complexity - Multi-dimensional code complexity analyzer
 *
 * Core 엔진 모듈
 */

// Types
export type {
  SourceLocation,
  FunctionInfo,
  ParameterInfo,
  ComplexityResult,
  ComplexityDetail,
  ComplexityContributor,
  FileAnalysisResult,
  ImportInfo,
  ImportSpecifier,
  ExportInfo,
  DependencyNode,
  CallNode,
  CallEdge,
  AnalysisContext,
  ProjectInfo,
  AnalysisOptions,
  // Dimensional complexity types
  DimensionalComplexity,
  DimensionalWeights,
  ExtendedComplexityResult,
} from './types.js';

export { DEFAULT_OPTIONS } from './types.js';

// AST
export {
  parseSourceFile,
  getSourceLocation,
  extractFunctionInfo,
  extractAllFunctions,
  extractImports,
  extractExports,
} from './ast/index.js';

// Metrics
export {
  calculateCyclomaticComplexity,
  calculateCognitiveComplexity,
  analyzeFunction,
  analyzeFunctionExtended,
  analyzeFile,
  getComplexityGrade,
  generateComplexitySummary,
} from './metrics/index.js';

// Graph
export {
  DependencyGraph,
  CallGraph,
  exportToDot,
  exportToMermaid,
} from './graph/index.js';

// Context
export { ContextCollector, quickAnalyze } from './context/index.js';

// ─── Convenience Functions ───────────────────────────────────────

import * as fs from 'node:fs';
import { parseSourceFile } from './ast/index.js';
import { analyzeFile } from './metrics/index.js';
import type { FileAnalysisResult } from './types.js';

/**
 * 파일 경로로 복잡도 분석
 */
export function analyzeFilePath(filePath: string): FileAnalysisResult {
  const content = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = parseSourceFile(filePath, content);
  return analyzeFile(sourceFile);
}

/**
 * 소스 코드 문자열로 복잡도 분석
 */
export function analyzeSource(
  source: string,
  fileName = 'input.ts'
): FileAnalysisResult {
  const sourceFile = parseSourceFile(fileName, source);
  return analyzeFile(sourceFile);
}
