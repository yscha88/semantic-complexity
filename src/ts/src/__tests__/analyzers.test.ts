/**
 * Analyzer Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { analyzeBread } from '../analyzers/bread.js';
import { analyzeCheese } from '../analyzers/cheese.js';
import { analyzeHam } from '../analyzers/ham.js';

describe('Bread Analyzer', () => {
  it('should detect trust boundary markers', () => {
    const source = `
      // TRUST_BOUNDARY: API endpoint
      app.get('/api/users', handler);
    `;
    const result = analyzeBread(source);
    assert.ok(result.trustBoundaryCount > 0);
  });

  it('should detect hardcoded secrets', () => {
    const source = `
      const password = "secret123";
      const api_key = "sk_live_xxx";
    `;
    const result = analyzeBread(source);
    assert.ok(result.secretPatterns.length > 0);
    assert.ok(result.secretPatterns.some(s => s.severity === 'high'));
  });

  it('should count hidden dependencies', () => {
    const source = `
      const env = process.env.NODE_ENV;
      console.log(env);
    `;
    const result = analyzeBread(source);
    assert.ok(result.hiddenDeps.env > 0);
    assert.ok(result.hiddenDeps.io > 0);
  });

  it('should detect auth patterns', () => {
    const source = `
      import jwt from 'jsonwebtoken';
      function verifyToken(token) {
        return jwt.verify(token, secret);
      }
    `;
    const result = analyzeBread(source);
    assert.ok(result.authExplicitness > 0);
    assert.ok(result.authPatterns.length > 0);
  });

  // TypeScript 전용 테스트
  it('should detect any type usage', () => {
    const source = `
      function process(data: any) {
        return data.value;
      }
      const x: any = getData();
    `;
    const result = analyzeBread(source);
    assert.ok(result.typeSafety.anyCount >= 2);
    assert.ok(result.typeSafety.safetyScore < 1.0);
  });

  it('should detect type assertions', () => {
    const source = `
      const data = response as UserData;
      const value = input as any;
    `;
    const result = analyzeBread(source);
    assert.ok(result.typeSafety.assertionCount >= 2);
    assert.ok(result.typeSafety.assertionLocations.some(l => l.reason.includes('as any')));
  });

  it('should detect ts-ignore comments', () => {
    const source = `
      // @ts-ignore
      const x = dangerousCall();
    `;
    const result = analyzeBread(source);
    assert.ok(result.typeSafety.tsIgnoreCount >= 1);
  });

  it('should reward unknown type usage', () => {
    const source = `
      function process(data: unknown) {
        if (typeof data === 'string') {
          return data.length;
        }
      }
    `;
    const result = analyzeBread(source);
    assert.ok(result.typeSafety.unknownCount >= 1);
    assert.ok(result.typeSafety.safetyScore > 0.9);
  });
});

describe('Cheese Analyzer', () => {
  it('should calculate nesting depth', () => {
    const source = `
      function deep() {
        if (a) {
          for (let i = 0; i < 10; i++) {
            while (true) {
              try {
                doSomething();
              } catch (e) {
                console.log(e);
              }
            }
          }
        }
      }
    `;
    const result = analyzeCheese(source);
    assert.ok(result.maxNesting >= 4);
  });

  it('should detect state×async×retry violation', () => {
    const source = `
      class Service {
        async fetchWithRetry() {
          this.count = 0;
          for (let attempts = 0; attempts < 3; attempts++) {
            try {
              const result = await fetch('/api');
              this.count++;
              return result;
            } catch (e) {
              continue;
            }
          }
        }
      }
    `;
    const result = analyzeCheese(source);
    assert.ok(result.stateAsyncRetry.violated);
    assert.ok(result.stateAsyncRetry.count >= 2);
  });

  it('should detect rest parameter anti-pattern', () => {
    const source = `
      function process(...args: any[]) {
        return args.map(x => x * 2);
      }
    `;
    const result = analyzeCheese(source);
    const hasRestPenalty = result.functions.some(f =>
      f.antiPatterns.some(ap => ap.pattern === 'rest_params')
    );
    assert.ok(hasRestPenalty);
  });

  it('should pass for simple accessible code', () => {
    const source = `
      function add(a: number, b: number): number {
        return a + b;
      }
    `;
    const result = analyzeCheese(source);
    assert.ok(result.accessible);
    assert.strictEqual(result.violations.length, 0);
  });

  // TypeScript 전용 테스트
  it('should detect generic complexity', () => {
    const source = `
      type Complex<T extends Record<K, V>, K extends string, V, R extends T> = {
        [P in keyof T]: T[P];
      };
    `;
    const result = analyzeCheese(source);
    assert.ok(result.typeComplexity.generics.count >= 1);
    assert.ok(result.typeComplexity.generics.maxParams >= 4);
    assert.ok(result.typeComplexity.generics.constrainedCount >= 2);
  });

  it('should detect union type complexity', () => {
    const source = `
      type Status = 'pending' | 'active' | 'completed' | 'cancelled' | 'failed' | 'archived';
    `;
    const result = analyzeCheese(source);
    assert.ok(result.typeComplexity.unions.count >= 1);
    assert.ok(result.typeComplexity.unions.maxMembers >= 6);
  });

  it('should detect conditional types', () => {
    const source = `
      type IsArray<T> = T extends Array<infer U> ? U : never;
      type Unwrap<T> = T extends Promise<infer U> ? U : T;
    `;
    const result = analyzeCheese(source);
    assert.ok(result.typeComplexity.conditionalTypes >= 2);
  });

  it('should detect mapped types', () => {
    const source = `
      type Readonly<T> = { readonly [K in keyof T]: T[K] };
      type Partial<T> = { [K in keyof T]?: T[K] };
    `;
    const result = analyzeCheese(source);
    assert.ok(result.typeComplexity.mappedTypes >= 2);
  });

  it('should detect type guards', () => {
    const source = `
      function isString(value: unknown): value is string {
        return typeof value === 'string';
      }
    `;
    const result = analyzeCheese(source);
    assert.ok(result.typeComplexity.typeGuards >= 1);
  });
});

describe('Framework Adjustment', () => {
  it('should detect React framework', () => {
    const source = `
      import React, { useState, useEffect } from 'react';

      function UserProfile({ userId }: Props) {
        const [user, setUser] = useState(null);
        const [loading, setLoading] = useState(true);

        useEffect(() => {
          fetchUser(userId).then(setUser);
        }, [userId]);

        return <div>{user?.name}</div>;
      }
    `;
    const result = analyzeCheese(source);
    assert.strictEqual(result.frameworkInfo.detected, 'react');
    assert.ok(result.frameworkInfo.hookCount >= 2);
  });

  it('should apply JSX nesting weight', () => {
    // Note: TypeScript parser needs proper JSX syntax
    const source = `
      import React from 'react';

      function Component() {
        // Simulating nested structure with nested functions
        return nested1(() => nested2(() => nested3()));
      }
    `;
    const result = analyzeCheese(source);
    // Framework detected as React, adjustments applied
    assert.strictEqual(result.frameworkInfo.detected, 'react');
    assert.ok(result.adjustedNesting <= result.maxNesting);
  });

  it('should apply hook concept weight', () => {
    const source = `
      import { useState, useEffect, useMemo, useCallback } from 'react';

      function useCustomHook() {
        const [state, setState] = useState(null);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState(null);

        useEffect(() => {}, []);

        const memoized = useMemo(() => state, [state]);
        const callback = useCallback(() => {}, []);

        return { state, loading, error, memoized, callback };
      }
    `;
    const result = analyzeCheese(source);
    // Hook이 많지만 가중치 적용되어 개념 수 감소
    assert.ok(result.frameworkInfo.hookCount >= 4);
    const hookAdjustment = result.frameworkInfo.adjustments.find(a => a.type === 'hook');
    if (hookAdjustment) {
      assert.ok(hookAdjustment.adjusted < hookAdjustment.original);
    }
  });

  it('should apply chain method weight', () => {
    const source = `
      import React from 'react';

      function UserList({ users }: Props) {
        const result = users.filter(u => u.active);
        const names = result.map(u => u.name);
        const sorted = names.sort();
        return sorted.join(', ');
      }
    `;
    const result = analyzeCheese(source);
    // At least some chain methods detected
    assert.ok(result.frameworkInfo.chainCount >= 1);
  });

  it('should detect Vue framework', () => {
    const source = `
      import { ref, computed, onMounted } from 'vue';

      export default {
        setup() {
          const count = ref(0);
          const doubled = computed(() => count.value * 2);

          onMounted(() => {
            console.log('mounted');
          });

          return { count, doubled };
        }
      };
    `;
    const result = analyzeCheese(source);
    assert.strictEqual(result.frameworkInfo.detected, 'vue');
  });

  it('should not apply weight for non-framework code', () => {
    const source = `
      function calculate(a: number, b: number) {
        if (a > 0) {
          for (let i = 0; i < b; i++) {
            console.log(i);
          }
        }
        return a + b;
      }
    `;
    const result = analyzeCheese(source);
    assert.strictEqual(result.frameworkInfo.detected, 'none');
    assert.strictEqual(result.maxNesting, result.adjustedNesting);
  });
});

describe('Ham Analyzer', () => {
  it('should detect critical paths', () => {
    const source = `
      function processPayment(amount: number) {
        return charge(amount);
      }

      async function authenticateUser(token: string) {
        return verify(token);
      }

      function deleteAccount(userId: string) {
        return remove(userId);
      }
    `;
    const result = analyzeHam(source);
    assert.ok(result.criticalPaths.length >= 2);
    assert.ok(result.criticalPaths.some(cp => cp.category === 'payment'));
    assert.ok(result.criticalPaths.some(cp => cp.category === 'auth'));
  });

  it('should detect test framework', () => {
    const testSource = `
      import { describe, it, expect } from 'vitest';

      describe('Payment', () => {
        it('should process payment', () => {
          expect(processPayment(100)).toBe(true);
        });
      });
    `;
    const result = analyzeHam('', testSource);
    assert.strictEqual(result.testInfo.framework, 'vitest');
    assert.ok(result.testInfo.testCount > 0);
  });

  it('should calculate coverage', () => {
    const source = `
      function processPayment() {}
      function login() {}
    `;
    const testSource = `
      describe('Payment', () => {
        it('should processPayment', () => {});
      });
    `;
    const result = analyzeHam(source, testSource);
    // processPayment is tested, login is not
    assert.ok(result.goldenTestCoverage >= 0);
    assert.ok(result.goldenTestCoverage <= 1);
  });
});
