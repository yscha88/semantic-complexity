/**
 * 게이트 시스템 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  // Types
  type MetaDimensions,
  type Snapshot,
  // Gates
  GATE_INFO,
  GATE_RESPONSIBILITIES,
  DEFAULT_DELTA_THRESHOLDS,
  calculateDelta,
  calculateDeltaPercent,
  detectViolations,
  analyzeDelta,
  checkGate,
  runGatePipeline,
  createSnapshot,
} from '../index.js';

describe('Gates System', () => {
  describe('GATE_INFO', () => {
    it('should have all gate types defined', () => {
      expect(GATE_INFO.dev).toBeDefined();
      expect(GATE_INFO.qa).toBeDefined();
      expect(GATE_INFO.ra).toBeDefined();
      expect(GATE_INFO.ceo).toBeDefined();
    });

    it('should have correct responsibilities', () => {
      expect(GATE_RESPONSIBILITIES.dev).toBe('context');
      expect(GATE_RESPONSIBILITIES.qa).toBe('behavior');
      expect(GATE_RESPONSIBILITIES.ra).toBe('security');
    });
  });

  describe('calculateDelta', () => {
    it('should calculate positive delta (increase)', () => {
      const baseline: MetaDimensions = { security: 5, context: 10, behavior: 5 };
      const current: MetaDimensions = { security: 8, context: 15, behavior: 7 };

      const delta = calculateDelta(baseline, current);

      expect(delta.security).toBe(3);
      expect(delta.context).toBe(5);
      expect(delta.behavior).toBe(2);
    });

    it('should calculate negative delta (decrease)', () => {
      const baseline: MetaDimensions = { security: 10, context: 20, behavior: 10 };
      const current: MetaDimensions = { security: 5, context: 15, behavior: 5 };

      const delta = calculateDelta(baseline, current);

      expect(delta.security).toBe(-5);
      expect(delta.context).toBe(-5);
      expect(delta.behavior).toBe(-5);
    });
  });

  describe('calculateDeltaPercent', () => {
    it('should calculate percentage change', () => {
      const baseline: MetaDimensions = { security: 10, context: 20, behavior: 10 };
      const delta: MetaDimensions = { security: 2, context: 5, behavior: 3 };

      const percent = calculateDeltaPercent(baseline, delta);

      expect(percent.security).toBe(20);
      expect(percent.context).toBe(25);
      expect(percent.behavior).toBe(30);
    });

    it('should handle zero baseline', () => {
      const baseline: MetaDimensions = { security: 0, context: 0, behavior: 0 };
      const delta: MetaDimensions = { security: 5, context: 0, behavior: -1 };

      const percent = calculateDeltaPercent(baseline, delta);

      expect(percent.security).toBe(100); // 0에서 증가
      expect(percent.context).toBe(0);    // 변화 없음
      expect(percent.behavior).toBe(0);   // 감소는 0으로 처리
    });
  });

  describe('detectViolations', () => {
    it('should not detect violations for small changes', () => {
      const baseline: MetaDimensions = { security: 5, context: 10, behavior: 5 };
      const current: MetaDimensions = { security: 6, context: 12, behavior: 6 };

      const violations = detectViolations(baseline, current);

      expect(violations.length).toBe(0);
    });

    it('should detect violations for large changes', () => {
      const baseline: MetaDimensions = { security: 5, context: 10, behavior: 5 };
      const current: MetaDimensions = { security: 15, context: 30, behavior: 15 };

      const violations = detectViolations(baseline, current);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations.some((v) => v.dimension === 'security')).toBe(true);
    });

    it('should not detect violations for decreases', () => {
      const baseline: MetaDimensions = { security: 20, context: 30, behavior: 20 };
      const current: MetaDimensions = { security: 5, context: 10, behavior: 5 };

      const violations = detectViolations(baseline, current);

      expect(violations.length).toBe(0);
    });
  });

  describe('createSnapshot', () => {
    it('should create snapshot with defaults', () => {
      const meta: MetaDimensions = { security: 5, context: 10, behavior: 5 };
      const snapshot = createSnapshot('lib', meta);

      expect(snapshot.moduleType).toBe('lib');
      expect(snapshot.meta).toEqual(meta);
      expect(snapshot.timestamp).toBeGreaterThan(0);
      expect(snapshot.functionCount).toBe(0);
    });

    it('should create snapshot with options', () => {
      const meta: MetaDimensions = { security: 5, context: 10, behavior: 5 };
      const snapshot = createSnapshot('api', meta, {
        commitHash: 'abc123',
        functionCount: 10,
        totalWeighted: 50,
      });

      expect(snapshot.commitHash).toBe('abc123');
      expect(snapshot.functionCount).toBe(10);
      expect(snapshot.totalWeighted).toBe(50);
    });
  });

  describe('analyzeDelta', () => {
    it('should analyze delta between snapshots', () => {
      const baseline = createSnapshot('lib', { security: 5, context: 10, behavior: 5 });
      const current = createSnapshot('lib', { security: 10, context: 20, behavior: 10 });

      const result = analyzeDelta(baseline, current);

      expect(result.delta.security).toBe(5);
      expect(result.delta.context).toBe(10);
      expect(result.delta.behavior).toBe(5);
      expect(result.exceedsThreshold).toBe(true);
    });

    it('should identify affected gates', () => {
      const baseline = createSnapshot('lib', { security: 5, context: 10, behavior: 5 });
      const current = createSnapshot('lib', { security: 15, context: 10, behavior: 5 });

      const result = analyzeDelta(baseline, current);

      expect(result.affectedGates).toContain('ra');
    });
  });

  describe('checkGate', () => {
    it('should pass gate with no violations', () => {
      const result = checkGate('dev', []);

      expect(result.decision).toBe('pass');
      expect(result.gate).toBe('dev');
    });

    it('should fail gate with critical violation', () => {
      const violations = [{
        gate: 'ra' as const,
        dimension: 'security' as const,
        severity: 'critical' as const,
        currentValue: 50,
        previousValue: 5,
        delta: 45,
        threshold: 5,
        message: 'Test violation',
      }];

      const result = checkGate('ra', violations);

      expect(result.decision).toBe('fail');
    });
  });

  describe('runGatePipeline', () => {
    it('should pass all gates for no changes', () => {
      const meta: MetaDimensions = { security: 5, context: 10, behavior: 5 };
      const baseline = createSnapshot('lib', meta);
      const current = createSnapshot('lib', meta);

      const result = runGatePipeline('lib', baseline, current);

      expect(result.overallDecision).toBe('pass');
      expect(result.requiredApprovals.length).toBe(0);
    });

    it('should require approvals for large changes', () => {
      const baseline = createSnapshot('lib', { security: 5, context: 10, behavior: 5 });
      const current = createSnapshot('lib', { security: 50, context: 100, behavior: 50 });

      const result = runGatePipeline('lib', baseline, current);

      expect(result.overallDecision).toBe('fail');
      expect(result.requiredApprovals.length).toBeGreaterThan(0);
    });

    it('should include CEO for critical violations', () => {
      const baseline = createSnapshot('lib', { security: 0, context: 0, behavior: 0 });
      const current = createSnapshot('lib', { security: 100, context: 200, behavior: 100 });

      const result = runGatePipeline('lib', baseline, current);

      expect(result.requiredApprovals).toContain('ceo');
    });
  });
});
