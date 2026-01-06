/**
 * Change Budget Tracker
 *
 * PR당 변경 예산 추적 및 검사
 *
 * | Module Type   | ΔCognitive | ΔState | Breaking |
 * |---------------|------------|--------|----------|
 * | api/external  | ≤ 3        | ≤ 1    | NO       |
 * | api/internal  | ≤ 5        | ≤ 2    | with ADR |
 * | app           | ≤ 8        | ≤ 3    | N/A      |
 * | lib/domain    | ≤ 5        | ≤ 2    | with ADR |
 * | lib/util      | ≤ 8        | ≤ 3    | with ADR |
 */

import type { ArchitectureRole } from '../types/index.js';
import type { CheeseResult } from '../analyzers/cheese.js';

// =============================================================
// Types
// =============================================================

export interface Delta {
  cognitive: number;
  stateTransitions: number;
  publicApi: number;
  breakingChanges: boolean;
}

export interface BudgetViolation {
  dimension: string;
  allowed: number;
  actual: number;
  excess: number;
  message: string;
}

export interface BudgetCheckResult {
  passed: boolean;
  architectureRole: ArchitectureRole;
  violations: BudgetViolation[];
  delta: Delta;
}

export interface ChangeBudget {
  deltaCognitive: number;
  deltaState: number;
  deltaPublicApi: number;
  breakingAllowed: boolean;
}

// =============================================================
// Budget Configuration by Module Type
// =============================================================

const MODULE_BUDGETS: Record<ArchitectureRole, ChangeBudget> = {
  'api/external': {
    deltaCognitive: 3,
    deltaState: 1,
    deltaPublicApi: 2,
    breakingAllowed: false,
  },
  'api/internal': {
    deltaCognitive: 5,
    deltaState: 2,
    deltaPublicApi: 3,
    breakingAllowed: true, // with ADR
  },
  'lib/domain': {
    deltaCognitive: 5,
    deltaState: 2,
    deltaPublicApi: 5,
    breakingAllowed: true, // with ADR
  },
  'lib/util': {
    deltaCognitive: 8,
    deltaState: 3,
    deltaPublicApi: 3,
    breakingAllowed: true, // with ADR
  },
  'app': {
    deltaCognitive: 8,
    deltaState: 3,
    deltaPublicApi: 999, // N/A
    breakingAllowed: true, // N/A
  },
};

// =============================================================
// Budget Tracker
// =============================================================

export class BudgetTracker {
  private architectureRole: ArchitectureRole;
  private budget: ChangeBudget;

  constructor(architectureRole: ArchitectureRole) {
    this.architectureRole = architectureRole;
    this.budget = MODULE_BUDGETS[architectureRole] || MODULE_BUDGETS['app'];
  }

  check(delta: Delta): BudgetCheckResult {
    const violations: BudgetViolation[] = [];

    // ΔCognitive check
    if (delta.cognitive > this.budget.deltaCognitive) {
      violations.push({
        dimension: 'ΔCognitive',
        allowed: this.budget.deltaCognitive,
        actual: delta.cognitive,
        excess: delta.cognitive - this.budget.deltaCognitive,
        message: `ΔCognitive: ${delta.cognitive} > ${this.budget.deltaCognitive} (excess: ${delta.cognitive - this.budget.deltaCognitive})`,
      });
    }

    // ΔState check
    if (delta.stateTransitions > this.budget.deltaState) {
      violations.push({
        dimension: 'ΔState',
        allowed: this.budget.deltaState,
        actual: delta.stateTransitions,
        excess: delta.stateTransitions - this.budget.deltaState,
        message: `ΔState: ${delta.stateTransitions} > ${this.budget.deltaState}`,
      });
    }

    // ΔPublicAPI check (not for app)
    if (this.architectureRole !== 'app' && delta.publicApi > this.budget.deltaPublicApi) {
      violations.push({
        dimension: 'ΔPublicAPI',
        allowed: this.budget.deltaPublicApi,
        actual: delta.publicApi,
        excess: delta.publicApi - this.budget.deltaPublicApi,
        message: `ΔPublicAPI: ${delta.publicApi} > ${this.budget.deltaPublicApi}`,
      });
    }

    // Breaking changes check
    if (delta.breakingChanges && !this.budget.breakingAllowed) {
      violations.push({
        dimension: 'BreakingChanges',
        allowed: 0,
        actual: 1,
        excess: 1,
        message: 'Breaking changes not allowed for this module type',
      });
    }

    return {
      passed: violations.length === 0,
      architectureRole: this.architectureRole,
      violations,
      delta,
    };
  }
}

// =============================================================
// Delta Calculation
// =============================================================

export function calculateDelta(
  before: CheeseResult,
  after: CheeseResult
): Delta {
  // Cognitive score calculation
  function score(result: CheeseResult): number {
    if (result.accessible) return 0;
    return (
      result.maxNesting * 2 +
      result.hiddenDependencies +
      (result.stateAsyncRetry.violated ? 10 : 0)
    );
  }

  return {
    cognitive: score(after) - score(before),
    stateTransitions: 0, // TODO: State transition analysis
    publicApi: 0, // TODO: Public API analysis
    breakingChanges: false, // TODO: Breaking change detection
  };
}

// =============================================================
// Public API
// =============================================================

export function checkBudget(
  architectureRole: ArchitectureRole,
  delta: Delta
): BudgetCheckResult {
  const tracker = new BudgetTracker(architectureRole);
  return tracker.check(delta);
}

export function getBudget(architectureRole: ArchitectureRole): ChangeBudget {
  return MODULE_BUDGETS[architectureRole] || MODULE_BUDGETS['app'];
}
