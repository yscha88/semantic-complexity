/**
 * v0.0.3: Interaction Matrix for Second-Order Tensor Analysis
 *
 * M[i,j] represents the interaction strength between dimensions i and j.
 * - Diagonal: self-interaction (typically 1.0)
 * - Off-diagonal: cross-dimension interaction
 */

import type { Matrix5x5, ModuleType, Vector5D } from './types.js';

/**
 * Default interaction matrix (symmetric, positive semi-definite)
 */
export const DEFAULT_MATRIX: Matrix5x5 = [
  //  C     N     S     A     Λ
  [1.0,  0.3,  0.2,  0.2,  0.3],  // Control
  [0.3,  1.0,  0.4,  0.8,  0.2],  // Nesting × Async ↑
  [0.2,  0.4,  1.0,  0.5,  0.9],  // State × Coupling ↑↑
  [0.2,  0.8,  0.5,  1.0,  0.4],  // Async × Nesting ↑
  [0.3,  0.2,  0.9,  0.4,  1.0],  // Coupling × State ↑↑
];

/**
 * Module-type specific interaction matrices
 */
export const MODULE_MATRICES: Record<ModuleType, Matrix5x5> = {
  api: [
    // API: Coupling interactions are critical
    [1.0,  0.2,  0.3,  0.2,  0.4],
    [0.2,  1.0,  0.3,  0.6,  0.2],
    [0.3,  0.3,  1.0,  0.4,  1.5],  // State × Coupling ↑↑↑
    [0.2,  0.6,  0.4,  1.0,  0.5],
    [0.4,  0.2,  1.5,  0.5,  1.0],  // Coupling × State ↑↑↑
  ],
  lib: [
    // LIB: Control/Nesting interactions are important
    [1.0,  1.2,  0.2,  0.2,  0.2],  // Control × Nesting ↑
    [1.2,  1.0,  0.3,  0.5,  0.2],  // Nesting × Control ↑
    [0.2,  0.3,  1.0,  0.3,  0.6],
    [0.2,  0.5,  0.3,  1.0,  0.3],
    [0.2,  0.2,  0.6,  0.3,  1.0],
  ],
  app: [
    // APP: State/Async interactions are critical
    [1.0,  0.3,  0.3,  0.3,  0.3],
    [0.3,  1.0,  0.5,  0.9,  0.2],  // Nesting × Async ↑
    [0.3,  0.5,  1.0,  1.3,  0.7],  // State × Async ↑↑
    [0.3,  0.9,  1.3,  1.0,  0.4],  // Async × State ↑↑
    [0.3,  0.2,  0.7,  0.4,  1.0],
  ],
  web: [
    // WEB: Nesting is most important (component hierarchy)
    [1.0,  0.5,  0.2,  0.4,  0.2],
    [0.5,  1.5,  0.3,  0.6,  0.2],  // Nesting self-weight ↑
    [0.2,  0.3,  1.0,  0.3,  0.5],
    [0.4,  0.6,  0.3,  1.0,  0.3],
    [0.2,  0.2,  0.5,  0.3,  1.0],
  ],
  deploy: [
    // DEPLOY: All interactions should be minimal
    [1.0,  0.1,  0.1,  0.1,  0.2],
    [0.1,  1.0,  0.1,  0.1,  0.1],
    [0.1,  0.1,  1.0,  0.1,  0.3],
    [0.1,  0.1,  0.1,  1.0,  0.2],
    [0.2,  0.1,  0.3,  0.2,  1.0],
  ],
  unknown: DEFAULT_MATRIX,
};

/**
 * Get interaction matrix for module type
 */
export function getInteractionMatrix(moduleType: ModuleType): Matrix5x5 {
  return MODULE_MATRICES[moduleType] ?? DEFAULT_MATRIX;
}

/**
 * Convert Vector5D to array
 */
export function vectorToArray(v: Vector5D): number[] {
  return [v.control, v.nesting, v.state, v.async, v.coupling];
}

/**
 * Create Vector5D from array
 */
export function arrayToVector(arr: number[]): Vector5D {
  if (arr.length !== 5) {
    throw new Error('Vector5D requires exactly 5 values');
  }
  return {
    control: arr[0],
    nesting: arr[1],
    state: arr[2],
    async: arr[3],
    coupling: arr[4],
  };
}

/**
 * Create zero vector
 */
export function zeroVector(): Vector5D {
  return { control: 0, nesting: 0, state: 0, async: 0, coupling: 0 };
}

/**
 * Calculate L2 norm of vector
 */
export function vectorNorm(v: Vector5D): number {
  const arr = vectorToArray(v);
  return Math.sqrt(arr.reduce((sum, x) => sum + x * x, 0));
}

/**
 * Calculate dot product of two vectors
 */
export function dotProduct(v1: Vector5D, v2: Vector5D): number {
  const a1 = vectorToArray(v1);
  const a2 = vectorToArray(v2);
  return a1.reduce((sum, x, i) => sum + x * a2[i], 0);
}

/**
 * Calculate quadratic form: v^T M v
 *
 * This captures dimension interactions.
 */
export function quadraticForm(v: Vector5D, matrix: Matrix5x5): number {
  const arr = vectorToArray(v);
  let result = 0;
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
      result += arr[i] * matrix[i][j] * arr[j];
    }
  }
  return result;
}

/**
 * Check if matrix is positive semi-definite using diagonal dominance
 * (conservative approximation)
 */
export function isPositiveSemidefinite(matrix: Matrix5x5): boolean {
  for (let i = 0; i < 5; i++) {
    let rowSum = 0;
    for (let j = 0; j < 5; j++) {
      if (i !== j) {
        rowSum += Math.abs(matrix[i][j]);
      }
    }
    if (matrix[i][i] < rowSum) {
      return false;
    }
  }
  return true;
}

/**
 * Euclidean distance between two vectors
 */
export function euclideanDistance(v1: Vector5D, v2: Vector5D): number {
  const a1 = vectorToArray(v1);
  const a2 = vectorToArray(v2);
  const sumSquares = a1.reduce((sum, x, i) => sum + Math.pow(x - a2[i], 2), 0);
  return Math.sqrt(sumSquares);
}

/**
 * Mahalanobis-like distance using interaction matrix
 *
 * δ(v, target) = sqrt((v - target)^T M (v - target))
 */
export function mahalanobisDistance(
  v: Vector5D,
  target: Vector5D,
  matrix: Matrix5x5
): number {
  const diff: Vector5D = {
    control: v.control - target.control,
    nesting: v.nesting - target.nesting,
    state: v.state - target.state,
    async: v.async - target.async,
    coupling: v.coupling - target.coupling,
  };
  const result = quadraticForm(diff, matrix);
  return Math.sqrt(Math.abs(result));
}
