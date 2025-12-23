/**
 * 정준성(Canonicality) 프레임워크 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  // Types
  type ModuleType,
  type MetaDimensions,
  // Profiles
  CANONICAL_PROFILES,
  levelToRange,
  levelToMidpoint,
  getIdealMetaDimensions,
  getProfile,
  isWithinCanonicalRange,
  isCanonical,
  inferModuleType,
  // Convergence
  calculateDeviation,
  calculateConvergenceVector,
  calculateConvergenceRate,
  analyzeConvergence,
  findBestFitModuleType,
  getConvergenceStatus,
  generateConvergenceAdvice,
} from '../index.js';

describe('Canonical Profiles', () => {
  describe('CANONICAL_PROFILES', () => {
    it('should have all module types defined', () => {
      const types: ModuleType[] = ['api', 'app', 'lib', 'deploy'];
      for (const type of types) {
        expect(CANONICAL_PROFILES[type]).toBeDefined();
        expect(CANONICAL_PROFILES[type].type).toBe(type);
      }
    });

    it('api should have high security, low context/behavior', () => {
      const profile = CANONICAL_PROFILES.api;
      expect(profile.ideal.security).toBe('high');
      expect(profile.ideal.context).toBe('low');
      expect(profile.ideal.behavior).toBe('low');
    });

    it('lib should have low complexity across all dimensions', () => {
      const profile = CANONICAL_PROFILES.lib;
      expect(profile.ideal.security).toBe('low');
      expect(profile.ideal.context).toBe('low');
      expect(profile.ideal.behavior).toBe('low');
    });
  });

  describe('levelToRange', () => {
    it('should return correct ranges', () => {
      expect(levelToRange('lowest')).toEqual({ min: 0, max: 2 });
      expect(levelToRange('low')).toEqual({ min: 0, max: 5 });
      expect(levelToRange('medium')).toEqual({ min: 3, max: 10 });
      expect(levelToRange('high')).toEqual({ min: 8, max: 20 });
      expect(levelToRange('highest').min).toBe(15);
    });
  });

  describe('levelToMidpoint', () => {
    it('should return midpoint of range', () => {
      expect(levelToMidpoint('low')).toBe(2.5);
      expect(levelToMidpoint('medium')).toBe(6.5);
      expect(levelToMidpoint('high')).toBe(14);
    });
  });

  describe('isWithinCanonicalRange', () => {
    it('should check if value is within range', () => {
      expect(isWithinCanonicalRange(3, 'low')).toBe(true);
      expect(isWithinCanonicalRange(10, 'low')).toBe(false);
      expect(isWithinCanonicalRange(5, 'medium')).toBe(true);
    });

    it('should respect tolerance', () => {
      expect(isWithinCanonicalRange(6, 'low', 0)).toBe(false);
      expect(isWithinCanonicalRange(6, 'low', 2)).toBe(true);
    });
  });

  describe('isCanonical', () => {
    it('should return true for canonical state', () => {
      const libMeta: MetaDimensions = { security: 2, context: 2, behavior: 2 };
      expect(isCanonical(libMeta, CANONICAL_PROFILES.lib)).toBe(true);
    });

    it('should return false for non-canonical state', () => {
      const badLibMeta: MetaDimensions = { security: 20, context: 30, behavior: 25 };
      expect(isCanonical(badLibMeta, CANONICAL_PROFILES.lib)).toBe(false);
    });
  });

  describe('inferModuleType', () => {
    it('should infer api from path', () => {
      expect(inferModuleType('/src/api/users.ts')).toBe('api');
      expect(inferModuleType('/src/routes/index.ts')).toBe('api');
      expect(inferModuleType('/src/controllers/auth.ts')).toBe('api');
    });

    it('should infer lib from path', () => {
      expect(inferModuleType('/src/lib/utils.ts')).toBe('lib');
      expect(inferModuleType('/src/utils/helpers.ts')).toBe('lib');
      expect(inferModuleType('/src/common/format.ts')).toBe('lib');
    });

    it('should infer deploy from path', () => {
      expect(inferModuleType('/deploy/k8s/deployment.yaml')).toBe('deploy');
      expect(inferModuleType('/infra/terraform/main.tf')).toBe('deploy');
    });

    it('should default to app', () => {
      expect(inferModuleType('/src/features/dashboard.ts')).toBe('app');
    });
  });
});

describe('Convergence Analysis', () => {
  describe('calculateDeviation', () => {
    it('should calculate deviation correctly', () => {
      const current: MetaDimensions = { security: 10, context: 15, behavior: 8 };
      const ideal: MetaDimensions = { security: 5, context: 10, behavior: 5 };

      const deviation = calculateDeviation(current, ideal);

      expect(deviation.security).toBe(5);
      expect(deviation.context).toBe(5);
      expect(deviation.behavior).toBe(3);
      expect(deviation.total).toBeGreaterThan(0);
    });
  });

  describe('calculateConvergenceVector', () => {
    it('should return zero vector when at ideal', () => {
      const state: MetaDimensions = { security: 5, context: 5, behavior: 5 };
      const vector = calculateConvergenceVector(state, state);

      expect(vector.x).toBe(0);
      expect(vector.y).toBe(0);
      expect(vector.z).toBe(0);
    });

    it('should return normalized direction vector', () => {
      const current: MetaDimensions = { security: 0, context: 0, behavior: 0 };
      const ideal: MetaDimensions = { security: 3, context: 4, behavior: 0 };

      const vector = calculateConvergenceVector(current, ideal);

      // 3-4-5 삼각형, 정규화됨
      expect(vector.x).toBeCloseTo(0.6, 1);
      expect(vector.y).toBeCloseTo(0.8, 1);
      expect(vector.z).toBe(0);
    });
  });

  describe('analyzeConvergence', () => {
    it('should analyze lib module convergence', () => {
      const meta: MetaDimensions = { security: 2, context: 3, behavior: 2 };
      const result = analyzeConvergence('lib', meta);

      expect(result.moduleType).toBe('lib');
      expect(result.currentState).toEqual(meta);
      expect(result.isStable).toBe(true);
      expect(result.convergenceRate).toBeGreaterThan(0.5);
    });

    it('should detect unstable state', () => {
      const meta: MetaDimensions = { security: 50, context: 100, behavior: 50 };
      const result = analyzeConvergence('lib', meta);

      expect(result.isStable).toBe(false);
      expect(result.convergenceRate).toBeLessThan(0.5);
    });
  });

  describe('findBestFitModuleType', () => {
    it('should find lib for simple pure functions', () => {
      const simpleMeta: MetaDimensions = { security: 1, context: 2, behavior: 1 };
      const result = findBestFitModuleType(simpleMeta);

      expect(result.moduleType).toBe('lib');
    });

    it('should find app for complex stateful code', () => {
      const complexMeta: MetaDimensions = { security: 5, context: 15, behavior: 12 };
      const result = findBestFitModuleType(complexMeta);

      expect(result.moduleType).toBe('app');
    });
  });

  describe('getConvergenceStatus', () => {
    it('should return canonical for stable state', () => {
      const meta: MetaDimensions = { security: 2, context: 2, behavior: 2 };
      const result = analyzeConvergence('lib', meta);

      expect(getConvergenceStatus(result)).toBe('canonical');
    });

    it('should return divergent for far state', () => {
      const meta: MetaDimensions = { security: 100, context: 100, behavior: 100 };
      const result = analyzeConvergence('lib', meta);

      expect(getConvergenceStatus(result)).toBe('divergent');
    });
  });

  describe('generateConvergenceAdvice', () => {
    it('should generate advice for high deviation', () => {
      const meta: MetaDimensions = { security: 30, context: 50, behavior: 25 };
      const result = analyzeConvergence('lib', meta);
      const advice = generateConvergenceAdvice(result);

      expect(advice.length).toBeGreaterThan(0);
      expect(advice.some((a) => a.dimension === 'security')).toBe(true);
    });

    it('should return empty for canonical state', () => {
      const meta: MetaDimensions = { security: 2, context: 2, behavior: 2 };
      const result = analyzeConvergence('lib', meta);
      const advice = generateConvergenceAdvice(result);

      expect(advice.length).toBe(0);
    });
  });
});
