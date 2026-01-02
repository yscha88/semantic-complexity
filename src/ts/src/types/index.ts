/**
 * Type definitions for semantic-complexity
 */

// Re-export from analyzers for convenience
export type {
  BreadResult,
  TrustBoundary,
  SecretPattern,
  HiddenDeps,
} from '../analyzers/bread.js';

export type {
  CheeseResult,
  FunctionInfo,
  StateAsyncRetry,
  AntiPatternPenalty,
  CognitiveConfig,
} from '../analyzers/cheese.js';

export type {
  HamResult,
  CriticalPath,
  TestInfo,
  CriticalCategory,
  TestFramework,
} from '../analyzers/ham.js';

// =============================================================
// Sandwich Score (Combined)
// =============================================================

export interface SandwichScore {
  bread: import('../analyzers/bread.js').BreadResult;
  cheese: import('../analyzers/cheese.js').CheeseResult;
  ham: import('../analyzers/ham.js').HamResult;
  simplex: SimplexCoordinates;
  equilibrium: EquilibriumResult;
}

export interface SimplexCoordinates {
  bread: number;
  cheese: number;
  ham: number;
}

export interface EquilibriumResult {
  inEquilibrium: boolean;
  energy: number;
  dominantAxis: 'bread' | 'cheese' | 'ham' | null;
}

// =============================================================
// Gate Types
// =============================================================

export type GateType = 'poc' | 'mvp' | 'production';

export interface GateResult {
  passed: boolean;
  gateType: GateType;
  violations: GateViolation[];
  waiverApplied: boolean;
}

export interface GateViolation {
  rule: string;
  actual: number | boolean;
  threshold: number | boolean;
  message: string;
}

// =============================================================
// Module Types
// =============================================================

export type ModuleType =
  | 'api/external'
  | 'api/internal'
  | 'lib/domain'
  | 'lib/util'
  | 'app';

// =============================================================
// Waiver Types
// =============================================================

export type {
  EssentialComplexityConfig,
  ComplexitySignal,
  ComplexityContext,
  WaiverResult,
} from '../gate/waiver.js';
