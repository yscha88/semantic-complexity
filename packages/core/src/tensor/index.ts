/**
 * v0.0.3: Tensor-based Complexity Analysis
 *
 * Second-order tensor framework for multi-dimensional code complexity.
 *
 * Mathematical foundation:
 *   score = v^T M v + <v, w> + ε‖v‖²
 *
 * Features:
 * - 5D complexity vector: [Control, Nesting, State, Async, Coupling]
 * - Interaction matrix M for dimension cross-effects
 * - ε-regularization for convergence guarantee
 * - Module-type canonical profiles
 * - Hodge decomposition of complexity space
 */

// Types
export type {
  Vector5D,
  ModuleType,
  Matrix5x5,
  TensorScore,
  ConvergenceStatus,
  ConvergenceAnalysis,
  HodgeDecomposition,
  ComplexityLevel,
  DeviationResult,
  RefactoringRecommendation,
} from './types.js';

export {
  IDX_CONTROL,
  IDX_NESTING,
  IDX_STATE,
  IDX_ASYNC,
  IDX_COUPLING,
} from './types.js';

// Matrix operations
export {
  DEFAULT_MATRIX,
  MODULE_MATRICES,
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
} from './matrix.js';

// Scoring
export {
  DEFAULT_WEIGHTS,
  calculateTensorScore,
  calculateRawSum,
  calculateRawSumThreshold,
  convergenceScore,
  estimateLipschitz,
  analyzeConvergence,
  hodgeDecomposition,
  classifyComplexityLevel,
  recommendRefactoring,
  isSafe,
  needsReview,
  isViolation,
} from './scoring.js';

// Canonical profiles
export type { CanonicalBounds } from './canonical.js';
export {
  CANONICAL_5D_PROFILES,
  getCanonicalProfile,
  getProfileCentroid,
  isWithinCanonicalBounds,
  getViolationDimensions,
  isOrphan,
  analyzeDeviation,
  findBestModuleType,
} from './canonical.js';
