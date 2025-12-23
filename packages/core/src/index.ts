/**
 * semantic-complexity - Multi-dimensional code complexity analyzer (v0.0.3)
 *
 * Core 엔진 모듈
 *
 * v0.0.3 Features:
 * - Second-order tensor: score = v^T M v + <v, w>
 * - ε-regularization for convergence
 * - Module-type canonical profiles
 * - Hodge decomposition of complexity space
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

// ─── v0.0.3: Tensor Module ─────────────────────────────────────────

// Tensor types
export type {
  Vector5D,
  ModuleType as TensorModuleType,
  Matrix5x5,
  TensorScore,
  ConvergenceStatus as TensorConvergenceStatus,
  ConvergenceAnalysis,
  HodgeDecomposition,
  ComplexityLevel,
  DeviationResult,
  RefactoringRecommendation,
  CanonicalBounds,
} from './tensor/index.js';

// Tensor constants
export {
  IDX_CONTROL,
  IDX_NESTING,
  IDX_STATE,
  IDX_ASYNC,
  IDX_COUPLING,
  DEFAULT_MATRIX,
  MODULE_MATRICES,
  DEFAULT_WEIGHTS,
  CANONICAL_5D_PROFILES,
} from './tensor/index.js';

// Tensor matrix operations
export {
  getInteractionMatrix,
  vectorToArray,
  arrayToVector,
  zeroVector,
  vectorNorm,
  dotProduct,
  quadraticForm,
  isPositiveSemidefinite,
  euclideanDistance,
  mahalanobisDistance,
} from './tensor/index.js';

// Tensor scoring
export {
  calculateTensorScore,
  calculateRawSum,
  calculateRawSumThreshold,
  convergenceScore,
  estimateLipschitz,
  analyzeConvergence as analyzeTensorConvergence,
  hodgeDecomposition,
  classifyComplexityLevel,
  recommendRefactoring,
  isSafe,
  needsReview,
  isViolation,
} from './tensor/index.js';

// Tensor canonical profiles
export {
  getCanonicalProfile,
  getProfileCentroid,
  isWithinCanonicalBounds,
  getViolationDimensions,
  isOrphan,
  analyzeDeviation,
  findBestModuleType as findBestTensorModuleType,
} from './tensor/index.js';

// ─── v0.0.8: Class Reusability Module ───────────────────────────

export type {
  ClassFieldInfo,
  ClassMethodInfo,
  ClassAnalysisResult,
  ClassMetrics,
  ReusabilityScore,
  ReusabilityIssue,
  FileClassAnalysisResult,
} from './class/index.js';

export {
  analyzeClass,
  analyzeClasses,
  analyzeClassesInFile,
} from './class/index.js';

// ─── v0.0.8: Invariants Module ──────────────────────────────────

export type {
  CognitiveViolation,
  SecretViolation,
  LockedZoneWarning,
  InvariantCheckResult,
} from './invariants/index.js';

export {
  checkCognitiveInvariant,
  detectSecrets,
  checkLockedZone,
  checkAllInvariants,
} from './invariants/index.js';

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
