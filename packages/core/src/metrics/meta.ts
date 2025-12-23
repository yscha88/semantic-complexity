/**
 * 메타 차원 집계 (Meta Dimensions Aggregation)
 *
 * 5D 복잡도 → 3D 메타 차원 변환
 *
 * 햄 샌드위치 분해:
 * - 🍞 Security: coupling + globalAccess + envDependency
 * - 🧀 Context: cognitive + nestingDepth + callbackDepth
 * - 🥓 Behavior: state + async + sideEffects
 */

import type {
  DimensionalComplexity,
  StateComplexity,
  AsyncComplexity,
  CouplingComplexity,
} from '../types.js';
import type { MetaDimensions, MetaWeights } from '../canonical/types.js';
import { DEFAULT_META_WEIGHTS } from '../canonical/types.js';

// ─────────────────────────────────────────────────────────────────
// 집계 가중치
// ─────────────────────────────────────────────────────────────────

/**
 * 🍞 Security 집계 가중치
 */
interface SecurityAggregationWeights {
  globalAccess: number;
  envDependency: number;
  implicitIO: number;
  couplingBase: number;
}

const DEFAULT_SECURITY_WEIGHTS: SecurityAggregationWeights = {
  globalAccess: 2.0,
  envDependency: 1.5,
  implicitIO: 1.0,
  couplingBase: 0.5,
};

/**
 * 🧀 Context 집계 가중치
 */
interface ContextAggregationWeights {
  cognitive: number;
  nesting: number;
  callbackDepth: number;
  control: number;
}

const DEFAULT_CONTEXT_WEIGHTS: ContextAggregationWeights = {
  cognitive: 1.0,
  nesting: 1.5,
  callbackDepth: 2.0,
  control: 0.5,
};

/**
 * 🥓 Behavior 집계 가중치
 */
interface BehaviorAggregationWeights {
  stateMutations: number;
  stateBranches: number;
  asyncBoundaries: number;
  sideEffects: number;
  promiseChains: number;
}

const DEFAULT_BEHAVIOR_WEIGHTS: BehaviorAggregationWeights = {
  stateMutations: 2.0,
  stateBranches: 1.5,
  asyncBoundaries: 1.0,
  sideEffects: 2.5,
  promiseChains: 1.0,
};

// ─────────────────────────────────────────────────────────────────
// 개별 차원 계산
// ─────────────────────────────────────────────────────────────────

/**
 * 🍞 Security 점수 계산
 *
 * 구조 안정성: 외부 의존, 환경 결합, 암묵적 I/O
 */
export function calculateSecurity(
  coupling: CouplingComplexity,
  weights: SecurityAggregationWeights = DEFAULT_SECURITY_WEIGHTS
): number {
  const globalScore = coupling.globalAccess.length * weights.globalAccess;
  const envScore = coupling.envDependency.length * weights.envDependency;
  const ioScore = coupling.implicitIO.length * weights.implicitIO;
  const baseScore = (
    coupling.sideEffects.length +
    coupling.closureCaptures.length
  ) * weights.couplingBase;

  return Math.round((globalScore + envScore + ioScore + baseScore) * 10) / 10;
}

/**
 * 🧀 Context 점수 계산
 *
 * 맥락 밀도: 인지 복잡도, 중첩 깊이, 콜백 깊이
 */
export function calculateContext(
  control: number,
  nesting: number,
  async: AsyncComplexity,
  weights: ContextAggregationWeights = DEFAULT_CONTEXT_WEIGHTS
): number {
  // cognitive ≈ control + nesting 기반 추정
  const cognitiveEstimate = control + nesting;

  const score =
    cognitiveEstimate * weights.cognitive +
    nesting * weights.nesting +
    async.callbackDepth * weights.callbackDepth +
    control * weights.control;

  return Math.round(score * 10) / 10;
}

/**
 * 🥓 Behavior 점수 계산
 *
 * 행동 보존성: 상태 변이, 비동기, 부작용
 */
export function calculateBehavior(
  state: StateComplexity,
  async: AsyncComplexity,
  coupling: CouplingComplexity,
  weights: BehaviorAggregationWeights = DEFAULT_BEHAVIOR_WEIGHTS
): number {
  const stateScore =
    state.stateMutations * weights.stateMutations +
    state.stateBranches * weights.stateBranches;

  const asyncScore =
    async.asyncBoundaries * weights.asyncBoundaries +
    async.promiseChains * weights.promiseChains;

  const sideEffectScore = coupling.sideEffects.length * weights.sideEffects;

  return Math.round((stateScore + asyncScore + sideEffectScore) * 10) / 10;
}

// ─────────────────────────────────────────────────────────────────
// 통합 변환
// ─────────────────────────────────────────────────────────────────

/**
 * DimensionalComplexity → MetaDimensions 변환
 *
 * 5D 복잡도를 3D 메타 차원으로 집계
 */
export function toMetaDimensions(
  dimensional: DimensionalComplexity
): MetaDimensions {
  return {
    security: calculateSecurity(dimensional.coupling),
    context: calculateContext(
      dimensional.control,
      dimensional.nesting,
      dimensional.async
    ),
    behavior: calculateBehavior(
      dimensional.state,
      dimensional.async,
      dimensional.coupling
    ),
  };
}

/**
 * 메타 차원 가중 합계
 */
export function calculateMetaWeightedSum(
  meta: MetaDimensions,
  weights: MetaWeights = DEFAULT_META_WEIGHTS
): number {
  return (
    meta.security * weights.security +
    meta.context * weights.context +
    meta.behavior * weights.behavior
  );
}

/**
 * 메타 차원 정규화 (0-1 범위)
 */
export function normalizeMetaDimensions(
  meta: MetaDimensions,
  maxValues: MetaDimensions = { security: 50, context: 100, behavior: 50 }
): MetaDimensions {
  return {
    security: Math.min(meta.security / maxValues.security, 1),
    context: Math.min(meta.context / maxValues.context, 1),
    behavior: Math.min(meta.behavior / maxValues.behavior, 1),
  };
}

/**
 * 두 메타 차원 간의 유클리드 거리
 */
export function metaDistance(a: MetaDimensions, b: MetaDimensions): number {
  const dx = a.security - b.security;
  const dy = a.context - b.context;
  const dz = a.behavior - b.behavior;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * 메타 차원 덧셈
 */
export function addMetaDimensions(
  a: MetaDimensions,
  b: MetaDimensions
): MetaDimensions {
  return {
    security: a.security + b.security,
    context: a.context + b.context,
    behavior: a.behavior + b.behavior,
  };
}

/**
 * 메타 차원 차이
 */
export function subtractMetaDimensions(
  a: MetaDimensions,
  b: MetaDimensions
): MetaDimensions {
  return {
    security: a.security - b.security,
    context: a.context - b.context,
    behavior: a.behavior - b.behavior,
  };
}

/**
 * 빈 메타 차원
 */
export const ZERO_META: MetaDimensions = {
  security: 0,
  context: 0,
  behavior: 0,
};
