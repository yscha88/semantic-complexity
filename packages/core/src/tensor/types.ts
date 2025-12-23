/**
 * v0.0.3: Tensor Types
 *
 * Mathematical foundation:
 *   score^(2) = v^T M v + <v, w>
 */

/**
 * 5-dimensional complexity vector
 */
export interface Vector5D {
  control: number;
  nesting: number;
  state: number;
  async: number;
  coupling: number;
}

/**
 * Module type for context-aware analysis
 */
export type ModuleType = 'api' | 'lib' | 'app' | 'web' | 'data' | 'infra' | 'deploy' | 'unknown';

/**
 * Dimension indices
 */
export const IDX_CONTROL = 0;
export const IDX_NESTING = 1;
export const IDX_STATE = 2;
export const IDX_ASYNC = 3;
export const IDX_COUPLING = 4;

/**
 * 5x5 Interaction Matrix
 */
export type Matrix5x5 = [
  [number, number, number, number, number],
  [number, number, number, number, number],
  [number, number, number, number, number],
  [number, number, number, number, number],
  [number, number, number, number, number],
];

/**
 * Tensor score result
 *
 * Dual-metric approach inspired by CDR (Clinical Dementia Rating):
 * - tensorScore (CDR Global style): Algorithm-based, captures interactions
 * - rawSum (CDR-SOB style): Simple sum, better for tracking changes
 */
export interface TensorScore {
  /** Linear component: <v, w> */
  linear: number;
  /** Quadratic component: v^T M v */
  quadratic: number;
  /** Raw score: linear + quadratic */
  raw: number;
  /** Regularization term: ε‖v‖² */
  regularization: number;
  /** Final regularized score (CDR Global style) */
  regularized: number;
  /** Epsilon value used */
  epsilon: number;
  /** Module type used */
  moduleType: ModuleType;
  /** Complexity vector */
  vector: Vector5D;

  // CDR-SOB style metrics
  /** Simple sum of dimensions: C + N + S + A + Λ (CDR-SOB style) */
  rawSum: number;
  /** Threshold for rawSum based on canonical upper bounds */
  rawSumThreshold: number;
  /** rawSum / rawSumThreshold ratio (0-1 = safe, >1 = violation) */
  rawSumRatio: number;
}

/**
 * Convergence status
 */
export type ConvergenceStatus = 'safe' | 'review' | 'violation' | 'oscillating';

/**
 * Convergence analysis result
 */
export interface ConvergenceAnalysis {
  /** Current score */
  score: number;
  /** Threshold value */
  threshold: number;
  /** Epsilon value */
  epsilon: number;
  /** Convergence score: (score - target) / ε */
  convergenceScore: number;
  /** Status based on convergence score */
  status: ConvergenceStatus;
  /** Distance to target (threshold - ε) */
  distanceToTarget: number;
  /** Distance to threshold */
  distanceToThreshold: number;
  /** Lipschitz constant estimate */
  lipschitzEstimate: number;
}

/**
 * Hodge decomposition result
 *
 * H^k(Code) = ⊕_{p+q=k} H^{p,q}(Code)
 */
export interface HodgeDecomposition {
  /** H^{2,0}: Control + Nesting (algorithmic) */
  algorithmic: number;
  /** H^{0,2}: State + Coupling (architectural) */
  architectural: number;
  /** H^{1,1}: Async (balanced/harmonic) */
  balanced: number;
  /** Total complexity */
  total: number;
  /** Balance ratio: balanced / total */
  balanceRatio: number;
  /** Is in harmonic state (well-balanced) */
  isHarmonic: boolean;
}

/**
 * Complexity level classification
 */
export type ComplexityLevel = 'minimal' | 'low' | 'medium' | 'high' | 'extreme';

/**
 * Deviation from canonical form result
 */
export interface DeviationResult {
  /** Euclidean distance to canonical centroid */
  euclideanDistance: number;
  /** Mahalanobis-like distance using interaction matrix */
  mahalanobisDistance: number;
  /** Maximum deviation in any dimension */
  maxDimensionDeviation: number;
  /** Normalized deviation (0-1 scale) */
  normalizedDeviation: number;
  /** Whether vector is within canonical bounds */
  isCanonical: boolean;
  /** Whether vector is outside ALL canonical regions */
  isOrphan: boolean;
  /** Module type used for comparison */
  moduleType: ModuleType;
  /** Current vector */
  vector: Vector5D;
  /** Dimensions that violate canonical bounds */
  violationDimensions: string[];
  /** Status: canonical | deviated | orphan */
  status: 'canonical' | 'deviated' | 'orphan';
}

/**
 * Refactoring recommendation
 */
export interface RefactoringRecommendation {
  /** Dimension to address */
  dimension: string;
  /** Priority (1-5, higher = more urgent) */
  priority: number;
  /** Recommended action */
  action: string;
  /** Expected impact on score */
  expectedImpact: number;
}
