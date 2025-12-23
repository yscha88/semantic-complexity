/**
 * v0.0.3: Tensor-based Complexity Scoring
 *
 * score = v^T M v + <v, w> + ε‖v‖²
 */

import type {
  TensorScore,
  Vector5D,
  ModuleType,
  ConvergenceAnalysis,
  ConvergenceStatus,
  HodgeDecomposition,
  ComplexityLevel,
  RefactoringRecommendation,
} from './types.js';

import {
  getInteractionMatrix,
  quadraticForm,
  dotProduct,
  vectorNorm,
  vectorToArray,
} from './matrix.js';

import { getCanonicalProfile } from './canonical.js';

/**
 * Default linear weights
 */
export const DEFAULT_WEIGHTS: Vector5D = {
  control: 1.0,
  nesting: 1.5,
  state: 2.0,
  async: 2.5,
  coupling: 3.0,
};

/**
 * Calculate raw sum of dimensions (CDR-SOB style)
 * Simple sum: C + N + S + A + Λ
 */
export function calculateRawSum(vector: Vector5D): number {
  return vector.control + vector.nesting + vector.state + vector.async + vector.coupling;
}

/**
 * Calculate rawSum threshold from canonical profile upper bounds
 */
export function calculateRawSumThreshold(moduleType: ModuleType): number {
  const profile = getCanonicalProfile(moduleType);
  return (
    profile.control[1] +
    profile.nesting[1] +
    profile.state[1] +
    profile.async[1] +
    profile.coupling[1]
  );
}

/**
 * Calculate tensor-based complexity score
 *
 * @param vector - 5D complexity vector
 * @param moduleType - Module type for context-aware analysis
 * @param epsilon - Regularization parameter (default: 2.0)
 * @param weights - Linear weights (default: DEFAULT_WEIGHTS)
 */
export function calculateTensorScore(
  vector: Vector5D,
  moduleType: ModuleType = 'unknown',
  epsilon: number = 2.0,
  weights: Vector5D = DEFAULT_WEIGHTS
): TensorScore {
  // Get interaction matrix for module type
  const matrix = getInteractionMatrix(moduleType);

  // Calculate components
  const linear = dotProduct(vector, weights);
  const quadratic = quadraticForm(vector, matrix) * 0.1; // Scale factor
  const raw = linear + quadratic;

  // ε-regularization
  const normSquared = Math.pow(vectorNorm(vector), 2);
  const regularization = epsilon * normSquared * 0.01; // Scale factor
  const regularized = raw + regularization;

  // CDR-SOB style: simple sum and threshold
  const rawSum = calculateRawSum(vector);
  const rawSumThreshold = calculateRawSumThreshold(moduleType);
  const rawSumRatio = rawSumThreshold > 0 ? rawSum / rawSumThreshold : 0;

  return {
    linear: Math.round(linear * 100) / 100,
    quadratic: Math.round(quadratic * 100) / 100,
    raw: Math.round(raw * 100) / 100,
    regularization: Math.round(regularization * 100) / 100,
    regularized: Math.round(regularized * 100) / 100,
    epsilon,
    moduleType,
    vector,
    // CDR-SOB style
    rawSum: Math.round(rawSum * 100) / 100,
    rawSumThreshold,
    rawSumRatio: Math.round(rawSumRatio * 1000) / 1000,
  };
}

/**
 * Calculate convergence score
 *
 * Returns:
 *   < 0: Safe zone (converged)
 *   0-1: ε-neighborhood (review needed)
 *   > 1: Violation zone
 */
export function convergenceScore(
  current: number,
  threshold: number,
  epsilon: number
): number {
  if (epsilon === 0) {
    return current > threshold - epsilon ? Infinity : 0;
  }
  const target = threshold - epsilon;
  return (current - target) / epsilon;
}

/**
 * Determine convergence status from score
 */
function getConvergenceStatus(convScore: number, isOscillating: boolean = false): ConvergenceStatus {
  if (isOscillating) return 'oscillating';
  if (convScore < 0) return 'safe';
  if (convScore < 1) return 'review';
  return 'violation';
}

/**
 * Estimate Lipschitz constant from two points
 *
 * k = |f(x) - f(y)| / |x - y|
 * For contraction mapping, we need k < 1
 */
export function estimateLipschitz(
  v1: Vector5D,
  v2: Vector5D,
  score1: number,
  score2: number
): number {
  const a1 = vectorToArray(v1);
  const a2 = vectorToArray(v2);

  // Calculate vector distance
  const vDist = Math.sqrt(
    a1.reduce((sum, x, i) => sum + Math.pow(x - a2[i], 2), 0)
  );

  if (vDist < 1e-10) return 0;

  // Calculate score distance
  const sDist = Math.abs(score1 - score2);

  return sDist / vDist;
}

/**
 * Analyze convergence status
 */
export function analyzeConvergence(
  score: number,
  threshold: number = 10.0,
  epsilon: number = 2.0,
  options?: {
    prevVector?: Vector5D;
    currVector?: Vector5D;
    prevScore?: number;
    isOscillating?: boolean;
  }
): ConvergenceAnalysis {
  const target = threshold - epsilon;
  const convScore = convergenceScore(score, threshold, epsilon);

  // Estimate Lipschitz constant if vectors provided
  let lipschitzEstimate = 0;
  if (options?.prevVector && options?.currVector && options?.prevScore !== undefined) {
    lipschitzEstimate = estimateLipschitz(
      options.prevVector,
      options.currVector,
      options.prevScore,
      score
    );
  }

  return {
    score,
    threshold,
    epsilon,
    convergenceScore: Math.round(convScore * 1000) / 1000,
    status: getConvergenceStatus(convScore, options?.isOscillating),
    distanceToTarget: Math.round((score - target) * 100) / 100,
    distanceToThreshold: Math.round((threshold - score) * 100) / 100,
    lipschitzEstimate: Math.round(lipschitzEstimate * 1000) / 1000,
  };
}

/**
 * Hodge decomposition of complexity vector
 *
 * - H^{2,0} (holomorphic): Control + Nesting → Local algorithmic
 * - H^{0,2} (anti-holomorphic): State + Coupling → Global structural
 * - H^{1,1} (harmonic): Async → Mixed/balanced
 */
export function hodgeDecomposition(
  vector: Vector5D,
  weights: Vector5D = DEFAULT_WEIGHTS
): HodgeDecomposition {
  // Algorithmic: Control + Nesting
  const algorithmic = vector.control * weights.control + vector.nesting * weights.nesting;

  // Architectural: State + Coupling
  const architectural = vector.state * weights.state + vector.coupling * weights.coupling;

  // Balanced: Async (bridges both worlds)
  const balanced = vector.async * weights.async;

  const total = algorithmic + architectural + balanced;
  const balanceRatio = total > 0 ? balanced / total : 0;

  return {
    algorithmic: Math.round(algorithmic * 100) / 100,
    architectural: Math.round(architectural * 100) / 100,
    balanced: Math.round(balanced * 100) / 100,
    total: Math.round(total * 100) / 100,
    balanceRatio: Math.round(balanceRatio * 1000) / 1000,
    isHarmonic: balanceRatio >= 0.3,
  };
}

/**
 * Classify complexity score into level
 */
export function classifyComplexityLevel(score: number): ComplexityLevel {
  if (score < 2) return 'minimal';
  if (score < 5) return 'low';
  if (score < 10) return 'medium';
  if (score < 20) return 'high';
  return 'extreme';
}

/**
 * Generate refactoring recommendations based on vector analysis
 */
export function recommendRefactoring(
  vector: Vector5D,
  weights: Vector5D = DEFAULT_WEIGHTS
): RefactoringRecommendation[] {
  const dimensions = ['control', 'nesting', 'state', 'async', 'coupling'] as const;
  const arr = vectorToArray(vector);
  const wArr = vectorToArray(weights);

  // Calculate weighted contributions
  const weighted = arr.map((v, i) => v * wArr[i]);
  const total = weighted.reduce((sum, w) => sum + w, 0);

  if (total === 0) return [];

  // Calculate contributions and sort by weight
  const contributions = dimensions.map((dim, i) => ({
    dimension: dim,
    weighted: weighted[i],
    percentage: weighted[i] / total,
  }));

  contributions.sort((a, b) => b.weighted - a.weighted);

  // Generate recommendations for top contributors
  const actions: Record<string, string> = {
    control: 'Extract complex conditionals into separate functions',
    nesting: 'Flatten nested structures using early returns or guard clauses',
    state: 'Reduce state mutations; consider immutable patterns',
    async: 'Simplify async flow; reduce callback nesting',
    coupling: 'Extract dependencies; use dependency injection',
  };

  return contributions
    .filter(c => c.percentage >= 0.1) // Only dimensions contributing >= 10%
    .map(c => ({
      dimension: c.dimension,
      priority: Math.min(5, Math.floor(c.percentage * 10) + 1),
      action: actions[c.dimension],
      expectedImpact: Math.round(c.weighted * 0.3 * 100) / 100, // Assume 30% reduction
    }));
}

/**
 * Check if in safe zone (below threshold - ε)
 */
export function isSafe(score: TensorScore): boolean {
  return score.regularized < 8.0; // threshold(10) - ε(2)
}

/**
 * Check if needs review (in ε-neighborhood)
 */
export function needsReview(score: TensorScore): boolean {
  return score.regularized >= 8.0 && score.regularized < 10.0;
}

/**
 * Check if violates threshold
 */
export function isViolation(score: TensorScore): boolean {
  return score.regularized >= 10.0;
}
