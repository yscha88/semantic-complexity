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

// Canonical (v0.0.2)
export type {
  ModuleType,
  ModuleTypeInfo,
  MetaDimensions,
  MetaWeights,
  Range,
  CanonicalLevel,
  CanonicalProfile,
  Vector3D,
  Deviation,
  ConvergenceResult,
  Snapshot,
  ConvergenceStatus,
  ConvergenceAdvice,
} from './canonical/index.js';

export {
  MODULE_TYPE_INFO,
  DEFAULT_META_WEIGHTS,
  LEVEL_RANGES,
  CANONICAL_PROFILES,
  levelToRange,
  levelToMidpoint,
  getIdealMetaDimensions,
  getProfile,
  isWithinCanonicalRange,
  isCanonical,
  inferModuleType,
  calculateDeviation,
  calculateConvergenceVector,
  calculateConvergenceRate,
  analyzeConvergence,
  analyzeAllModuleTypes,
  findBestFitModuleType,
  getConvergenceStatus,
  generateConvergenceAdvice,
} from './canonical/index.js';

// Gates (v0.0.2)
export type {
  GateType,
  GateInfo,
  ViolationSeverity,
  Violation,
  DeltaAnalysis,
  DeltaThresholds,
  GateDecision,
  GateResult,
  GatePipelineResult,
} from './gates/index.js';

export {
  GATE_RESPONSIBILITIES,
  GATE_INFO,
  DEFAULT_DELTA_THRESHOLDS,
  calculateDelta,
  calculateDeltaPercent,
  detectViolations,
  analyzeDelta,
  checkGate,
  runGatePipeline,
  createSnapshot,
} from './gates/index.js';

// Meta Dimensions (v0.0.2)
export {
  calculateSecurity,
  calculateContext,
  calculateBehavior,
  toMetaDimensions,
  calculateMetaWeightedSum,
  normalizeMetaDimensions,
  metaDistance,
  addMetaDimensions,
  subtractMetaDimensions,
  ZERO_META,
} from './metrics/meta.js';

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
