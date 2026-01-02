/**
 * Simplex - Normalization & Equilibrium
 *
 * Normalizes Bread, Cheese, Ham scores to simplex coordinates
 * and calculates equilibrium state.
 */

import type { BreadResult } from '../analyzers/bread.js';
import type { CheeseResult } from '../analyzers/cheese.js';
import type { HamResult } from '../analyzers/ham.js';
import type { SimplexCoordinates, EquilibriumResult } from '../types/index.js';

/**
 * Normalize scores to simplex coordinates (sum = 1)
 */
export function normalize(
  bread: BreadResult,
  cheese: CheeseResult,
  ham: HamResult
): SimplexCoordinates {
  // Convert to raw scores (0-1 range, higher = more issues)
  const breadRaw = calculateBreadRaw(bread);
  const cheeseRaw = calculateCheeseRaw(cheese);
  const hamRaw = calculateHamRaw(ham);

  const total = breadRaw + cheeseRaw + hamRaw;

  if (total === 0) {
    return { bread: 1 / 3, cheese: 1 / 3, ham: 1 / 3 };
  }

  return {
    bread: breadRaw / total,
    cheese: cheeseRaw / total,
    ham: hamRaw / total,
  };
}

function calculateBreadRaw(bread: BreadResult): number {
  let score = 0;

  // Trust boundary
  if (bread.trustBoundaryCount === 0) score += 0.3;

  // Auth explicitness
  score += (1 - bread.authExplicitness) * 0.2;

  // Secrets
  const highSecrets = bread.secretPatterns.filter(s => s.severity === 'high').length;
  score += Math.min(highSecrets * 0.15, 0.3);

  // Hidden deps
  score += Math.min(bread.hiddenDeps.total * 0.02, 0.2);

  return Math.min(score, 1.0);
}

function calculateCheeseRaw(cheese: CheeseResult): number {
  let score = 0;

  // Nesting depth (normalized to 0-1, threshold = 4)
  score += Math.min(cheese.maxNesting / 10, 0.3);

  // State×Async×Retry violation
  if (cheese.stateAsyncRetry.violated) score += 0.3;

  // Accessibility
  if (!cheese.accessible) score += 0.3;

  // Additional violations
  score += Math.min(cheese.violations.length * 0.05, 0.1);

  return Math.min(score, 1.0);
}

function calculateHamRaw(ham: HamResult): number {
  // Inverse of coverage (1.0 coverage = 0 raw score)
  return 1 - ham.goldenTestCoverage;
}

/**
 * Calculate equilibrium state
 */
export function calculateEquilibrium(
  simplex: SimplexCoordinates
): EquilibriumResult {
  const { bread, cheese, ham } = simplex;
  const ideal = 1 / 3;

  // Energy = sum of squared deviations from ideal
  const energy =
    Math.pow(bread - ideal, 2) +
    Math.pow(cheese - ideal, 2) +
    Math.pow(ham - ideal, 2);

  // Find dominant axis (if any)
  const max = Math.max(bread, cheese, ham);
  const threshold = 0.5; // Dominant if > 50%

  let dominantAxis: 'bread' | 'cheese' | 'ham' | null = null;
  if (max > threshold) {
    if (bread === max) dominantAxis = 'bread';
    else if (cheese === max) dominantAxis = 'cheese';
    else dominantAxis = 'ham';
  }

  return {
    inEquilibrium: energy < 0.1,
    energy,
    dominantAxis,
  };
}

/**
 * Get label based on dominant axis
 */
export function getLabel(simplex: SimplexCoordinates): {
  label: 'bread' | 'cheese' | 'ham' | 'balanced';
  confidence: number;
} {
  const { bread, cheese, ham } = simplex;
  const max = Math.max(bread, cheese, ham);

  if (max < 0.4) {
    return { label: 'balanced', confidence: 1 - max * 2 };
  }

  if (bread === max) return { label: 'bread', confidence: bread };
  if (cheese === max) return { label: 'cheese', confidence: cheese };
  return { label: 'ham', confidence: ham };
}
