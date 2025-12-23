/**
 * v0.0.3: Canonical Profiles and Deviation Analysis
 *
 * Φ: ModuleType → CanonicalProfile
 * δ(v, Φ(τ)) = ‖v - Φ(τ)‖_M (Mahalanobis-like distance)
 */

import type { Vector5D, ModuleType, DeviationResult } from './types.js';
import {
  getInteractionMatrix,
  euclideanDistance,
  mahalanobisDistance,
  vectorToArray,
} from './matrix.js';

/**
 * Canonical profile bounds for a module type
 */
export interface CanonicalBounds {
  control: [number, number];   // [min, max]
  nesting: [number, number];
  state: [number, number];
  async: [number, number];
  coupling: [number, number];
}

/**
 * Canonical profiles per module type (based on v0.0.3 spec)
 */
export const CANONICAL_5D_PROFILES: Record<ModuleType, CanonicalBounds> = {
  api: {
    control: [0, 5],      // low: thin controllers
    nesting: [0, 3],      // low: flat structure
    state: [0, 2],        // low: stateless preferred
    async: [0, 3],        // low: simple I/O
    coupling: [0, 3],     // low: explicit deps
  },
  lib: {
    control: [0, 10],     // medium: algorithmic complexity ok
    nesting: [0, 5],      // medium: some depth acceptable
    state: [0, 2],        // low: pure functions preferred
    async: [0, 2],        // low: sync preferred
    coupling: [0, 2],     // low: minimal deps
  },
  app: {
    control: [0, 10],     // medium: business logic
    nesting: [0, 5],      // medium: reasonable depth
    state: [0, 8],        // medium: stateful ok
    async: [0, 8],        // medium: async workflows
    coupling: [0, 5],     // low: controlled deps
  },
  web: {
    control: [0, 8],      // medium: UI logic
    nesting: [0, 10],     // higher: component hierarchy
    state: [0, 5],        // medium: UI state
    async: [0, 5],        // medium: data fetching
    coupling: [0, 3],     // low: component isolation
  },
  deploy: {
    control: [0, 3],      // low: simple scripts
    nesting: [0, 2],      // low: flat
    state: [0, 2],        // low: idempotent
    async: [0, 2],        // low: sequential
    coupling: [0, 3],     // low: explicit config
  },
  unknown: {
    control: [0, 15],     // permissive
    nesting: [0, 10],
    state: [0, 10],
    async: [0, 10],
    coupling: [0, 10],
  },
};

/**
 * Get canonical profile for module type
 */
export function getCanonicalProfile(moduleType: ModuleType): CanonicalBounds {
  return CANONICAL_5D_PROFILES[moduleType] ?? CANONICAL_5D_PROFILES.unknown;
}

/**
 * Calculate centroid of canonical profile
 */
export function getProfileCentroid(profile: CanonicalBounds): Vector5D {
  return {
    control: (profile.control[0] + profile.control[1]) / 2,
    nesting: (profile.nesting[0] + profile.nesting[1]) / 2,
    state: (profile.state[0] + profile.state[1]) / 2,
    async: (profile.async[0] + profile.async[1]) / 2,
    coupling: (profile.coupling[0] + profile.coupling[1]) / 2,
  };
}

/**
 * Check if vector is within canonical bounds
 */
export function isWithinCanonicalBounds(
  vector: Vector5D,
  profile: CanonicalBounds
): boolean {
  return (
    vector.control >= profile.control[0] && vector.control <= profile.control[1] &&
    vector.nesting >= profile.nesting[0] && vector.nesting <= profile.nesting[1] &&
    vector.state >= profile.state[0] && vector.state <= profile.state[1] &&
    vector.async >= profile.async[0] && vector.async <= profile.async[1] &&
    vector.coupling >= profile.coupling[0] && vector.coupling <= profile.coupling[1]
  );
}

/**
 * Get dimensions that violate canonical bounds
 */
export function getViolationDimensions(
  vector: Vector5D,
  profile: CanonicalBounds
): string[] {
  const violations: string[] = [];
  const dims = ['control', 'nesting', 'state', 'async', 'coupling'] as const;

  for (const dim of dims) {
    const value = vector[dim];
    const [min, max] = profile[dim];
    if (value < min || value > max) {
      violations.push(dim);
    }
  }

  return violations;
}

/**
 * Check if vector is orphan (outside ALL canonical regions)
 */
export function isOrphan(vector: Vector5D): boolean {
  for (const moduleType of Object.keys(CANONICAL_5D_PROFILES) as ModuleType[]) {
    if (moduleType === 'unknown') continue;
    const profile = CANONICAL_5D_PROFILES[moduleType];
    if (isWithinCanonicalBounds(vector, profile)) {
      return false;
    }
  }
  return true;
}

/**
 * Analyze deviation from canonical form
 */
export function analyzeDeviation(
  vector: Vector5D,
  moduleType: ModuleType = 'unknown'
): DeviationResult {
  const profile = getCanonicalProfile(moduleType);
  const centroid = getProfileCentroid(profile);
  const matrix = getInteractionMatrix(moduleType);

  // Calculate distances
  const eucDist = euclideanDistance(vector, centroid);
  const mahDist = mahalanobisDistance(vector, centroid, matrix);

  // Max dimension deviation
  const arr = vectorToArray(vector);
  const centArr = vectorToArray(centroid);
  const maxDev = Math.max(...arr.map((v, i) => Math.abs(v - centArr[i])));

  // Normalize to 0-1 scale (assuming max reasonable deviation is 50)
  const normDev = Math.min(1.0, mahDist / 50.0);

  // Check canonical bounds
  const withinBounds = isWithinCanonicalBounds(vector, profile);
  const violations = getViolationDimensions(vector, profile);
  const orphan = isOrphan(vector);

  let status: 'canonical' | 'deviated' | 'orphan';
  if (withinBounds) {
    status = 'canonical';
  } else if (orphan) {
    status = 'orphan';
  } else {
    status = 'deviated';
  }

  return {
    euclideanDistance: Math.round(eucDist * 1000) / 1000,
    mahalanobisDistance: Math.round(mahDist * 1000) / 1000,
    maxDimensionDeviation: Math.round(maxDev * 1000) / 1000,
    normalizedDeviation: Math.round(normDev * 1000) / 1000,
    isCanonical: withinBounds,
    isOrphan: orphan,
    moduleType,
    vector,
    violationDimensions: violations,
    status,
  };
}

/**
 * Find the best fitting module type for a vector
 */
export function findBestModuleType(vector: Vector5D): { type: ModuleType; distance: number } {
  let bestType: ModuleType = 'unknown';
  let bestDist = Infinity;

  for (const moduleType of Object.keys(CANONICAL_5D_PROFILES) as ModuleType[]) {
    if (moduleType === 'unknown') continue;

    const profile = CANONICAL_5D_PROFILES[moduleType];
    const centroid = getProfileCentroid(profile);
    const matrix = getInteractionMatrix(moduleType);

    const dist = mahalanobisDistance(vector, centroid, matrix);
    if (dist < bestDist) {
      bestDist = dist;
      bestType = moduleType;
    }
  }

  return {
    type: bestType,
    distance: Math.round(bestDist * 1000) / 1000,
  };
}
