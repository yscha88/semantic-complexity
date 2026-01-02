/**
 * Gate - PoC / MVP / Production quality gates
 */

import type {
  GateType,
  GateResult,
  GateViolation,
} from '../types/index.js';
import type { CheeseResult } from '../analyzers/cheese.js';
import type { HamResult } from '../analyzers/ham.js';
import { checkWaiver } from './waiver.js';

// Re-export waiver functions
export {
  checkWaiver,
  parseEssentialComplexity,
  detectComplexitySignals,
  detectComplexImports,
  buildComplexityContext,
  generateReviewQuestions,
  ESSENTIAL_COMPLEXITY_SIGNALS,
  COMPLEX_DOMAIN_LIBRARIES,
} from './waiver.js';

export type {
  EssentialComplexityConfig,
  ComplexitySignal,
  ComplexityContext,
  WaiverResult,
} from './waiver.js';

// Base thresholds (MVP baseline)
const BASE_THRESHOLDS = {
  nesting_max: 4,
  concepts_per_function: 9,
  hidden_dep_max: 2,
  golden_test_min: 0.8,
};

// Stage adjustments from MVP baseline
const STAGE_ADJUSTMENTS: Record<GateType, Record<string, number>> = {
  poc: {
    nesting_max: +2,
    concepts_per_function: +3,
    hidden_dep_max: +1,
    golden_test_min: -0.3,
  },
  mvp: {
    nesting_max: 0,
    concepts_per_function: 0,
    hidden_dep_max: 0,
    golden_test_min: 0,
  },
  production: {
    nesting_max: -1,
    concepts_per_function: -2,
    hidden_dep_max: -1,
    golden_test_min: +0.15,
  },
};

// Stage policies (exported for external use)
export const STAGE_POLICIES: Record<GateType, { waiver_allowed: boolean }> = {
  poc: { waiver_allowed: false },
  mvp: { waiver_allowed: false },
  production: { waiver_allowed: true },
};

/**
 * Get thresholds for a specific gate type
 */
export function getThresholds(gateType: GateType): typeof BASE_THRESHOLDS {
  const adjustments = STAGE_ADJUSTMENTS[gateType];

  return {
    nesting_max: BASE_THRESHOLDS.nesting_max + adjustments.nesting_max,
    concepts_per_function:
      BASE_THRESHOLDS.concepts_per_function + adjustments.concepts_per_function,
    hidden_dep_max: BASE_THRESHOLDS.hidden_dep_max + adjustments.hidden_dep_max,
    golden_test_min:
      BASE_THRESHOLDS.golden_test_min + adjustments.golden_test_min,
  };
}

export interface CheckGateOptions {
  source?: string;
  filePath?: string;
  projectRoot?: string;
}

/**
 * Check if code passes the gate
 */
export function checkGate(
  gateType: GateType,
  cheese: CheeseResult,
  ham: HamResult,
  options: CheckGateOptions = {}
): GateResult {
  const thresholds = getThresholds(gateType);
  const violations: GateViolation[] = [];
  let waiverApplied = false;

  // Check waiver if source is provided and waiver is allowed for this stage
  if (options.source && STAGE_POLICIES[gateType].waiver_allowed) {
    const waiver = checkWaiver(options.source, options.filePath, options.projectRoot);
    if (waiver.waived) {
      waiverApplied = true;
      // Apply waiver config overrides
      if (waiver.config?.nesting !== undefined) {
        thresholds.nesting_max = waiver.config.nesting;
      }
      if (waiver.config?.conceptsTotal !== undefined) {
        thresholds.concepts_per_function = waiver.config.conceptsTotal;
      }
    }
  }

  // Check nesting
  if (cheese.maxNesting > thresholds.nesting_max) {
    violations.push({
      rule: 'nesting_max',
      actual: cheese.maxNesting,
      threshold: thresholds.nesting_max,
      message: `Nesting depth ${cheese.maxNesting} exceeds ${thresholds.nesting_max}`,
    });
  }

  // Check hidden dependencies
  if (cheese.hiddenDependencies > thresholds.hidden_dep_max) {
    violations.push({
      rule: 'hidden_dep_max',
      actual: cheese.hiddenDependencies,
      threshold: thresholds.hidden_dep_max,
      message: `Hidden deps ${cheese.hiddenDependencies} exceeds ${thresholds.hidden_dep_max}`,
    });
  }

  // Check golden test coverage
  if (ham.goldenTestCoverage < thresholds.golden_test_min) {
    violations.push({
      rule: 'golden_test_min',
      actual: ham.goldenTestCoverage,
      threshold: thresholds.golden_test_min,
      message: `Test coverage ${(ham.goldenTestCoverage * 100).toFixed(1)}% below ${(thresholds.golden_test_min * 100).toFixed(1)}%`,
    });
  }

  // Check state×async×retry
  if (cheese.stateAsyncRetry.violated) {
    violations.push({
      rule: 'state_async_retry',
      actual: cheese.stateAsyncRetry.count,
      threshold: 1,
      message: `state×async×retry co-occurrence: ${cheese.stateAsyncRetry.axes.join('×')}`,
    });
  }

  return {
    passed: violations.length === 0,
    gateType,
    violations,
    waiverApplied,
  };
}
