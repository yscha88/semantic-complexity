/**
 * 정준성(Canonicality) 프레임워크
 *
 * 모듈 타입 기반 P-NP 특수해 접근
 */

// Types
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
} from './types.js';

export {
  MODULE_TYPE_INFO,
  DEFAULT_META_WEIGHTS,
  LEVEL_RANGES,
} from './types.js';

// Profiles
export {
  CANONICAL_PROFILES,
  levelToRange,
  levelToMidpoint,
  getIdealMetaDimensions,
  getProfile,
  isWithinCanonicalRange,
  isCanonical,
  inferModuleType,
} from './profiles.js';

// Convergence
export {
  calculateDeviation,
  calculateConvergenceVector,
  calculateConvergenceRate,
  analyzeConvergence,
  analyzeAllModuleTypes,
  findBestFitModuleType,
  getConvergenceStatus,
  generateConvergenceAdvice,
} from './convergence.js';

export type {
  ConvergenceStatus,
  ConvergenceAdvice,
} from './convergence.js';
