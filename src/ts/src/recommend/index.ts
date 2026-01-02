/**
 * Gradient-based Recommender
 *
 * 균형점으로 향하는 리팩토링 권장사항 생성
 */

import type { CheeseResult } from '../analyzers/cheese.js';
import type { SimplexCoordinates, EquilibriumResult } from '../types/index.js';

// =============================================================
// Types
// =============================================================

export type Axis = 'bread' | 'cheese' | 'ham';

export interface Recommendation {
  axis: Axis;
  priority: number; // 1 = highest
  action: string;
  reason: string;
  expectedImpact: Record<string, number>;
  targetEquilibrium: boolean;
}

export type Severity = 'none' | 'mild' | 'moderate' | 'severe';

export interface DegradationResult {
  degraded: boolean;
  severity: Severity;
  indicators: string[];
  beforeAccessible: boolean;
  afterAccessible: boolean;
  deltaNesting: number;
  deltaHiddenDeps: number;
  deltaViolations: number;
}

// =============================================================
// Refactoring Actions by Axis
// =============================================================

const BREAD_ACTIONS = {
  increase: [
    ['Add explicit trust boundary', 'Define trust boundary in code explicitly'],
    ['Apply auth decorators', 'Add @Auth, @Protected decorators to endpoints'],
    ['Add input validation', 'Add validation for external inputs'],
  ],
  decrease: [
    ['Separate security logic', 'Extract security logic from business logic'],
    ['Extract common security middleware', 'Move repeated security patterns to middleware'],
  ],
};

const CHEESE_ACTIONS = {
  increase: [
    ['Add proper error handling', 'Add exception handling for edge cases'],
  ],
  decrease: [
    ['Flatten nesting (early return)', 'Use early return to reduce nesting depth'],
    ['Extract function', 'Extract complex blocks to separate functions (no param bundling)'],
    ['Simplify conditions', 'Extract complex conditions to named variables'],
    ['Separate state logic', 'Split state×async×retry into separate concerns'],
    ['Switch → polymorphism', 'Replace switch with Strategy pattern'],
  ],
};

// 🚫 Anti-patterns (LLM should not use these)
export const CHEESE_ANTI_PATTERNS = [
  ['No rest parameters abuse', '...args to hide parameter count is a complexity evasion trick'],
  ['No config object bundling', 'Do not bundle unrelated params into config objects'],
  ['No tuple/dict params', 'params: any[] or options: object hides meaning'],
  ['No inline substitution', 'Do not replace named variables with inline expressions'],
];

const HAM_ACTIONS = {
  increase: [
    ['Add golden tests', 'Write golden tests for critical paths'],
    ['Add contract tests', 'Write API contract tests'],
    ['Organize test fixtures', 'Structure test code better'],
  ],
  decrease: [
    ['Remove duplicate tests', 'Clean up unnecessary test duplication'],
  ],
};

const AXIS_ACTIONS: Record<Axis, typeof BREAD_ACTIONS> = {
  bread: BREAD_ACTIONS,
  cheese: CHEESE_ACTIONS,
  ham: HAM_ACTIONS,
};

// =============================================================
// Recommender
// =============================================================

export function suggestRefactor(
  simplex: SimplexCoordinates,
  equilibrium: EquilibriumResult,
  cheeseResult?: CheeseResult,
  maxRecommendations = 3
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // If in equilibrium, no recommendations needed
  if (equilibrium.inEquilibrium) {
    return [];
  }

  // state×async×retry violation is highest priority
  if (cheeseResult?.stateAsyncRetry.violated) {
    recommendations.push({
      axis: 'cheese',
      priority: 0,
      action: 'Separate state×async×retry',
      reason: `Cognitive invariant violation - ${cheeseResult.stateAsyncRetry.axes.join('×')} must be separated`,
      expectedImpact: { cheese: -20 },
      targetEquilibrium: true,
    });
  }

  // Generate recommendations based on dominant axis
  const { bread, cheese, ham } = simplex;
  const ideal = 1 / 3;

  const deviations: Array<{ axis: Axis; deviation: number; direction: 'increase' | 'decrease' }> = [
    { axis: 'bread', deviation: bread - ideal, direction: bread > ideal ? 'decrease' : 'increase' },
    { axis: 'cheese', deviation: cheese - ideal, direction: cheese > ideal ? 'decrease' : 'increase' },
    { axis: 'ham', deviation: ham - ideal, direction: ham > ideal ? 'decrease' : 'increase' },
  ];

  // Sort by absolute deviation (largest first)
  deviations.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));

  let priority = recommendations.length + 1;
  for (const { axis, deviation, direction } of deviations) {
    if (recommendations.length >= maxRecommendations) break;
    if (Math.abs(deviation) < 0.1) continue; // Skip small deviations

    const actions = AXIS_ACTIONS[axis][direction];
    if (actions && actions.length > 0) {
      const [action, reason] = actions[0];
      recommendations.push({
        axis,
        priority,
        action,
        reason,
        expectedImpact: { [axis]: direction === 'decrease' ? -Math.abs(deviation) * 100 : Math.abs(deviation) * 100 },
        targetEquilibrium: true,
      });
      priority++;
    }
  }

  return recommendations;
}

export function getPriorityAction(
  simplex: SimplexCoordinates,
  equilibrium: EquilibriumResult,
  cheeseResult?: CheeseResult
): Recommendation | null {
  const recommendations = suggestRefactor(simplex, equilibrium, cheeseResult, 1);
  return recommendations[0] || null;
}

// =============================================================
// Degradation Detection
// =============================================================

export function checkDegradation(
  before: CheeseResult,
  after: CheeseResult
): DegradationResult {
  const indicators: string[] = [];

  // 1. Accessibility state transition
  const accessibilityLost = before.accessible && !after.accessible;
  if (accessibilityLost) {
    indicators.push('Accessibility lost (accessible: true → false)');
  }

  // 2. Nesting depth increase
  const deltaNesting = after.maxNesting - before.maxNesting;
  if (deltaNesting > 0) {
    indicators.push(`Nesting depth increased: +${deltaNesting} (${before.maxNesting} → ${after.maxNesting})`);
  }

  // 3. Hidden dependencies increase
  const deltaHiddenDeps = after.hiddenDependencies - before.hiddenDependencies;
  if (deltaHiddenDeps > 0) {
    indicators.push(`Hidden dependencies increased: +${deltaHiddenDeps}`);
  }

  // 4. state×async×retry violation introduced
  const sarBefore = before.stateAsyncRetry.violated;
  const sarAfter = after.stateAsyncRetry.violated;
  if (!sarBefore && sarAfter) {
    indicators.push(`state×async×retry violation introduced: ${after.stateAsyncRetry.axes.join(' × ')}`);
  }

  // 5. Violations increase
  const deltaViolations = after.violations.length - before.violations.length;
  if (deltaViolations > 0) {
    indicators.push(`Violations increased: +${deltaViolations}`);
  }

  // Severity determination
  let severity: Severity;
  if (indicators.length === 0) {
    severity = 'none';
  } else if (accessibilityLost) {
    severity = 'severe';
  } else if (indicators.length >= 3) {
    severity = 'severe';
  } else if (indicators.length >= 2) {
    severity = 'moderate';
  } else {
    severity = 'mild';
  }

  return {
    degraded: indicators.length > 0,
    severity,
    indicators,
    beforeAccessible: before.accessible,
    afterAccessible: after.accessible,
    deltaNesting,
    deltaHiddenDeps,
    deltaViolations,
  };
}
