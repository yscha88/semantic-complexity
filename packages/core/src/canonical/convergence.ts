/**
 * 수렴 분석기 (Convergence Analyzer)
 *
 * 현재 상태에서 정준 상태로의 거리 및 방향을 계산
 *
 * NP-hard가 P로 환원되는 이유:
 * - 모든 가능한 구조를 탐색하지 않음
 * - 타입별 정준형으로의 거리만 측정
 * - 거리 측정: O(n)
 */

import type {
  ModuleType,
  MetaDimensions,
  ConvergenceResult,
  Deviation,
  Vector3D,
} from './types.js';
import {
  CANONICAL_PROFILES,
  getIdealMetaDimensions,
  isCanonical,
} from './profiles.js';
import { metaDistance, subtractMetaDimensions } from '../metrics/meta.js';

// ─────────────────────────────────────────────────────────────────
// 수렴 분석
// ─────────────────────────────────────────────────────────────────

/**
 * 편차 계산
 */
export function calculateDeviation(
  current: MetaDimensions,
  ideal: MetaDimensions
): Deviation {
  const securityDiff = current.security - ideal.security;
  const contextDiff = current.context - ideal.context;
  const behaviorDiff = current.behavior - ideal.behavior;

  return {
    security: Math.round(securityDiff * 100) / 100,
    context: Math.round(contextDiff * 100) / 100,
    behavior: Math.round(behaviorDiff * 100) / 100,
    total: Math.round(metaDistance(current, ideal) * 100) / 100,
  };
}

/**
 * 수렴 벡터 계산 (정준 상태로의 방향)
 */
export function calculateConvergenceVector(
  current: MetaDimensions,
  ideal: MetaDimensions
): Vector3D {
  const diff = subtractMetaDimensions(ideal, current);
  const magnitude = Math.sqrt(
    diff.security * diff.security +
    diff.context * diff.context +
    diff.behavior * diff.behavior
  );

  if (magnitude === 0) {
    return { x: 0, y: 0, z: 0 };
  }

  // 정규화된 방향 벡터
  return {
    x: Math.round((diff.security / magnitude) * 100) / 100,
    y: Math.round((diff.context / magnitude) * 100) / 100,
    z: Math.round((diff.behavior / magnitude) * 100) / 100,
  };
}

/**
 * 수렴률 계산 (0-1, 1이면 완전 정준)
 */
export function calculateConvergenceRate(
  deviation: Deviation,
  maxDeviation: number = 50
): number {
  const rate = 1 - Math.min(deviation.total / maxDeviation, 1);
  return Math.round(rate * 100) / 100;
}

/**
 * 수렴 분석 수행
 */
export function analyzeConvergence(
  moduleType: ModuleType,
  currentMeta: MetaDimensions
): ConvergenceResult {
  const profile = CANONICAL_PROFILES[moduleType];
  const idealMeta = getIdealMetaDimensions(profile);
  const deviation = calculateDeviation(currentMeta, idealMeta);
  const vector = calculateConvergenceVector(currentMeta, idealMeta);
  const rate = calculateConvergenceRate(deviation);
  const stable = isCanonical(currentMeta, profile);

  return {
    moduleType,
    currentState: currentMeta,
    canonicalState: idealMeta,
    deviation,
    convergenceVector: vector,
    isStable: stable,
    convergenceRate: rate,
  };
}

// ─────────────────────────────────────────────────────────────────
// 다중 모듈 분석
// ─────────────────────────────────────────────────────────────────

/**
 * 모든 모듈 타입에 대해 수렴 분석
 * 가장 적합한 모듈 타입 추천에 활용
 */
export function analyzeAllModuleTypes(
  currentMeta: MetaDimensions
): ConvergenceResult[] {
  const types: ModuleType[] = ['api', 'app', 'lib', 'deploy'];
  return types.map((type) => analyzeConvergence(type, currentMeta));
}

/**
 * 가장 가까운 정준 상태를 가진 모듈 타입 반환
 */
export function findBestFitModuleType(
  currentMeta: MetaDimensions
): ConvergenceResult {
  const results = analyzeAllModuleTypes(currentMeta);
  return results.reduce((best, current) =>
    current.deviation.total < best.deviation.total ? current : best
  );
}

// ─────────────────────────────────────────────────────────────────
// 수렴 해석
// ─────────────────────────────────────────────────────────────────

/**
 * 수렴 상태 해석
 */
export type ConvergenceStatus =
  | 'canonical'
  | 'near-canonical'
  | 'drifting'
  | 'divergent';

/**
 * 수렴 상태 판정
 */
export function getConvergenceStatus(
  result: ConvergenceResult
): ConvergenceStatus {
  if (result.isStable) {
    return 'canonical';
  }
  if (result.convergenceRate >= 0.8) {
    return 'near-canonical';
  }
  if (result.convergenceRate >= 0.5) {
    return 'drifting';
  }
  return 'divergent';
}

/**
 * 개선 제안 생성
 */
export interface ConvergenceAdvice {
  dimension: 'security' | 'context' | 'behavior';
  currentValue: number;
  idealValue: number;
  deviation: number;
  suggestion: string;
}

export function generateConvergenceAdvice(
  result: ConvergenceResult
): ConvergenceAdvice[] {
  const advice: ConvergenceAdvice[] = [];
  const { currentState, canonicalState, deviation, moduleType } = result;

  // Security 편차 분석
  if (Math.abs(deviation.security) > 2) {
    advice.push({
      dimension: 'security',
      currentValue: currentState.security,
      idealValue: canonicalState.security,
      deviation: deviation.security,
      suggestion: deviation.security > 0
        ? `${moduleType} 모듈은 외부 의존성을 줄여야 합니다. 전역 접근과 환경 변수 사용을 최소화하세요.`
        : `${moduleType} 모듈에 보안 검증 로직이 부족합니다. 입력 검증을 강화하세요.`,
    });
  }

  // Context 편차 분석
  if (Math.abs(deviation.context) > 3) {
    advice.push({
      dimension: 'context',
      currentValue: currentState.context,
      idealValue: canonicalState.context,
      deviation: deviation.context,
      suggestion: deviation.context > 0
        ? `${moduleType} 모듈의 맥락 밀도가 높습니다. 중첩을 줄이고 로직을 분리하세요.`
        : `${moduleType} 모듈이 너무 단순합니다. 적절한 검증/처리 로직이 필요할 수 있습니다.`,
    });
  }

  // Behavior 편차 분석
  if (Math.abs(deviation.behavior) > 2) {
    advice.push({
      dimension: 'behavior',
      currentValue: currentState.behavior,
      idealValue: canonicalState.behavior,
      deviation: deviation.behavior,
      suggestion: deviation.behavior > 0
        ? `${moduleType} 모듈의 상태/비동기 복잡도가 높습니다. 순수 함수로 리팩토링하세요.`
        : `${moduleType} 모듈에 비즈니스 로직이 부족합니다.`,
    });
  }

  return advice;
}
