/**
 * Gate Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { checkGate, getThresholds, STAGE_POLICIES } from '../gate/index.js';
import type { CheeseResult } from '../analyzers/cheese.js';
import type { HamResult } from '../analyzers/ham.js';

// Helper to create mock CheeseResult
function mockCheese(overrides: Partial<CheeseResult> = {}): CheeseResult {
  return {
    accessible: true,
    reason: 'All conditions met',
    violations: [],
    maxNesting: 2,
    adjustedNesting: 2,
    functions: [],
    hiddenDependencies: 0,
    stateAsyncRetry: {
      hasState: false,
      hasAsync: false,
      hasRetry: false,
      axes: [],
      count: 0,
      violated: false,
    },
    config: {
      nestingThreshold: 4,
      conceptsPerFunction: 9,
      hiddenDepThreshold: 2,
    },
    typeComplexity: {
      generics: { count: 0, maxParams: 0, maxDepth: 0, constrainedCount: 0, penalty: 0 },
      unions: { count: 0, maxMembers: 0, intersectionCount: 0, penalty: 0 },
      conditionalTypes: 0,
      mappedTypes: 0,
      typeGuards: 0,
      decoratorStacks: 0,
      totalPenalty: 0,
    },
    frameworkInfo: {
      detected: 'none',
      config: {
        name: 'none',
        jsxNestingWeight: 1.0,
        hookConceptWeight: 1.0,
        chainMethodWeight: 1.0,
        propsDestructureWeight: 1.0,
      },
      jsxNestingDepth: 0,
      logicNestingDepth: 0,
      hookCount: 0,
      chainCount: 0,
      adjustments: [],
    },
    ...overrides,
  };
}

// Helper to create mock HamResult
function mockHam(overrides: Partial<HamResult> = {}): HamResult {
  return {
    goldenTestCoverage: 0.9,
    criticalPaths: [],
    untestedCriticalPaths: [],
    testInfo: {
      framework: 'jest',
      testCount: 10,
      describedFunctions: new Set(),
    },
    ...overrides,
  };
}

describe('Gate Thresholds', () => {
  it('should return different thresholds for each gate type', () => {
    const poc = getThresholds('poc');
    const mvp = getThresholds('mvp');
    const production = getThresholds('production');

    // PoC is most lenient
    assert.ok(poc.nesting_max > mvp.nesting_max);
    assert.ok(poc.golden_test_min < mvp.golden_test_min);

    // Production is strictest
    assert.ok(production.nesting_max < mvp.nesting_max);
    assert.ok(production.golden_test_min > mvp.golden_test_min);
  });

  it('should have correct waiver policies', () => {
    assert.strictEqual(STAGE_POLICIES.poc.waiver_allowed, false);
    assert.strictEqual(STAGE_POLICIES.mvp.waiver_allowed, false);
    assert.strictEqual(STAGE_POLICIES.production.waiver_allowed, true);
  });
});

describe('Gate Check', () => {
  it('should pass MVP gate for good code', () => {
    const cheese = mockCheese({ maxNesting: 3, hiddenDependencies: 1 });
    const ham = mockHam({ goldenTestCoverage: 0.85 });

    const result = checkGate('mvp', cheese, ham);
    assert.strictEqual(result.passed, true);
    assert.strictEqual(result.violations.length, 0);
  });

  it('should fail MVP gate for deep nesting', () => {
    const cheese = mockCheese({ maxNesting: 6 });
    const ham = mockHam();

    const result = checkGate('mvp', cheese, ham);
    assert.strictEqual(result.passed, false);
    assert.ok(result.violations.some(v => v.rule === 'nesting_max'));
  });

  it('should fail MVP gate for low test coverage', () => {
    const cheese = mockCheese();
    const ham = mockHam({ goldenTestCoverage: 0.5 });

    const result = checkGate('mvp', cheese, ham);
    assert.strictEqual(result.passed, false);
    assert.ok(result.violations.some(v => v.rule === 'golden_test_min'));
  });

  it('should fail for state×async×retry violation', () => {
    const cheese = mockCheese({
      stateAsyncRetry: {
        hasState: true,
        hasAsync: true,
        hasRetry: false,
        axes: ['state', 'async'],
        count: 2,
        violated: true,
      },
    });
    const ham = mockHam();

    const result = checkGate('mvp', cheese, ham);
    assert.strictEqual(result.passed, false);
    assert.ok(result.violations.some(v => v.rule === 'state_async_retry'));
  });

  it('should pass PoC gate with relaxed thresholds', () => {
    const cheese = mockCheese({ maxNesting: 5, hiddenDependencies: 2 });
    const ham = mockHam({ goldenTestCoverage: 0.5 });

    const result = checkGate('poc', cheese, ham);
    assert.strictEqual(result.passed, true);
  });

  it('should be strict for production gate', () => {
    const cheese = mockCheese({ maxNesting: 4 }); // OK for MVP, too high for production
    const ham = mockHam({ goldenTestCoverage: 0.85 }); // OK for MVP, too low for production

    const result = checkGate('production', cheese, ham);
    assert.strictEqual(result.passed, false);
  });
});
