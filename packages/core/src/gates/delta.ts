/**
 * Delta 분석 (Δ Analysis)
 *
 * "나쁜 코드"가 아닌 "나빠지는 변경"을 감지
 *
 * 변경량 기반 품질 게이트:
 * - baseline과 current 비교
 * - 임계값 초과 시 위반 생성
 * - 담당 게이트 할당
 */

import type { MetaDimensions, Snapshot, ModuleType } from '../canonical/types.js';
import type {
  DeltaAnalysis,
  DeltaThresholds,
  Violation,
  ViolationSeverity,
  GateType,
  GateResult,
  GateDecision,
  GatePipelineResult,
} from './types.js';
import {
  DEFAULT_DELTA_THRESHOLDS,
  GATE_RESPONSIBILITIES,
  GATE_INFO,
} from './types.js';
import { subtractMetaDimensions } from '../metrics/meta.js';

// ─────────────────────────────────────────────────────────────────
// Delta 계산
// ─────────────────────────────────────────────────────────────────

/**
 * Delta 계산 (current - baseline)
 */
export function calculateDelta(
  baseline: MetaDimensions,
  current: MetaDimensions
): MetaDimensions {
  return subtractMetaDimensions(current, baseline);
}

/**
 * Delta 퍼센트 계산
 */
export function calculateDeltaPercent(
  baseline: MetaDimensions,
  delta: MetaDimensions
): MetaDimensions {
  const safeDiv = (d: number, b: number) =>
    b === 0 ? (d > 0 ? 100 : 0) : Math.round((d / b) * 100 * 10) / 10;

  return {
    security: safeDiv(delta.security, baseline.security),
    context: safeDiv(delta.context, baseline.context),
    behavior: safeDiv(delta.behavior, baseline.behavior),
  };
}

// ─────────────────────────────────────────────────────────────────
// 위반 검출
// ─────────────────────────────────────────────────────────────────

/**
 * 심각도 결정
 */
function determineSeverity(
  delta: number,
  threshold: number,
  deltaPercent: number
): ViolationSeverity {
  const ratio = delta / threshold;
  const percentRatio = deltaPercent / 100;

  if (ratio >= 2 || percentRatio >= 1) {
    return 'critical';
  }
  if (ratio >= 1.5 || percentRatio >= 0.5) {
    return 'error';
  }
  if (ratio >= 1 || percentRatio >= 0.2) {
    return 'warning';
  }
  return 'info';
}

/**
 * 차원별 게이트 찾기
 */
function findResponsibleGate(dimension: keyof MetaDimensions): GateType {
  for (const [gate, dim] of Object.entries(GATE_RESPONSIBILITIES)) {
    if (dim === dimension) {
      return gate as GateType;
    }
  }
  return 'dev'; // fallback
}

/**
 * 위반 검출
 */
export function detectViolations(
  baseline: MetaDimensions,
  current: MetaDimensions,
  thresholds: DeltaThresholds = DEFAULT_DELTA_THRESHOLDS
): Violation[] {
  const violations: Violation[] = [];
  const delta = calculateDelta(baseline, current);
  const deltaPercent = calculateDeltaPercent(baseline, delta);

  const dimensions: (keyof MetaDimensions)[] = ['security', 'context', 'behavior'];

  for (const dim of dimensions) {
    const d = delta[dim];
    const dp = deltaPercent[dim];
    const absThreshold = thresholds.absolute[dim];
    const relThreshold = thresholds.relative[dim];

    // 증가만 감지 (감소는 개선이므로 무시)
    if (d <= 0) continue;

    // 절대값 또는 상대값 임계 초과
    if (d > absThreshold || dp > relThreshold) {
      const gate = findResponsibleGate(dim);
      const severity = determineSeverity(d, absThreshold, dp);

      violations.push({
        gate,
        dimension: dim,
        severity,
        currentValue: current[dim],
        previousValue: baseline[dim],
        delta: Math.round(d * 100) / 100,
        threshold: absThreshold,
        message: generateViolationMessage(dim, d, dp, severity),
        suggestion: generateSuggestion(dim, severity),
      });
    }
  }

  return violations;
}

/**
 * 위반 메시지 생성
 */
function generateViolationMessage(
  dimension: keyof MetaDimensions,
  delta: number,
  deltaPercent: number,
  severity: ViolationSeverity
): string {
  const dimNames: Record<keyof MetaDimensions, string> = {
    security: '🍞 Security (구조 안정성)',
    context: '🧀 Context (맥락 밀도)',
    behavior: '🥓 Behavior (행동 보존성)',
  };

  const severityLabels: Record<ViolationSeverity, string> = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
    critical: '🚨',
  };

  return `${severityLabels[severity]} ${dimNames[dimension]}: +${delta.toFixed(1)} (+${deltaPercent.toFixed(1)}%)`;
}

/**
 * 개선 제안 생성
 */
function generateSuggestion(
  dimension: keyof MetaDimensions,
  severity: ViolationSeverity
): string {
  const suggestions: Record<keyof MetaDimensions, Record<ViolationSeverity, string>> = {
    security: {
      info: '외부 의존성 변경을 확인하세요.',
      warning: '전역 변수 접근을 줄이세요.',
      error: '환경 의존성을 격리하세요.',
      critical: '보안 검토가 필수입니다. RA 승인을 받으세요.',
    },
    context: {
      info: '코드 복잡도가 증가했습니다.',
      warning: '중첩 깊이를 줄이세요.',
      error: '함수를 분리하세요.',
      critical: '리팩토링이 필수입니다. 설계 검토를 진행하세요.',
    },
    behavior: {
      info: '상태 변경이 추가되었습니다.',
      warning: '부작용을 최소화하세요.',
      error: '상태 관리를 단순화하세요.',
      critical: '행동 변경이 큽니다. 전체 테스트가 필수입니다.',
    },
  };

  return suggestions[dimension][severity];
}

// ─────────────────────────────────────────────────────────────────
// Delta 분석
// ─────────────────────────────────────────────────────────────────

/**
 * Delta 분석 수행
 */
export function analyzeDelta(
  baseline: Snapshot,
  current: Snapshot,
  thresholds: DeltaThresholds = DEFAULT_DELTA_THRESHOLDS
): DeltaAnalysis {
  const delta = calculateDelta(baseline.meta, current.meta);
  const deltaPercent = calculateDeltaPercent(baseline.meta, delta);
  const violations = detectViolations(baseline.meta, current.meta, thresholds);

  const affectedGates = [...new Set(violations.map((v) => v.gate))];
  const exceedsThreshold = violations.some(
    (v) => v.severity === 'error' || v.severity === 'critical'
  );

  return {
    baseline,
    current,
    delta,
    deltaPercent,
    exceedsThreshold,
    violations,
    affectedGates,
  };
}

// ─────────────────────────────────────────────────────────────────
// 게이트 파이프라인
// ─────────────────────────────────────────────────────────────────

/**
 * 단일 게이트 검사
 */
export function checkGate(
  gate: GateType,
  violations: Violation[]
): GateResult {
  const gateViolations = violations.filter((v) => v.gate === gate);

  let decision: GateDecision = 'pass';
  if (gateViolations.some((v) => v.severity === 'critical')) {
    decision = 'fail';
  } else if (gateViolations.some((v) => v.severity === 'error')) {
    decision = 'fail';
  } else if (gateViolations.some((v) => v.severity === 'warning')) {
    decision = 'warn';
  }

  const info = GATE_INFO[gate];
  const summary =
    decision === 'pass'
      ? `${info.name}: 통과`
      : decision === 'warn'
      ? `${info.name}: 주의 필요 (${gateViolations.length}건)`
      : `${info.name}: 승인 필요 (${gateViolations.length}건)`;

  return {
    gate,
    decision,
    violations: gateViolations,
    summary,
  };
}

/**
 * 전체 게이트 파이프라인 실행
 */
export function runGatePipeline(
  moduleType: ModuleType,
  baseline: Snapshot,
  current: Snapshot,
  thresholds: DeltaThresholds = DEFAULT_DELTA_THRESHOLDS
): GatePipelineResult {
  const deltaResult = analyzeDelta(baseline, current, thresholds);

  const gates: GateType[] = ['dev', 'qa', 'ra'];
  const gateResults = gates.map((gate) =>
    checkGate(gate, deltaResult.violations)
  );

  // 전체 결정
  let overallDecision: GateDecision = 'pass';
  if (gateResults.some((g) => g.decision === 'fail')) {
    overallDecision = 'fail';
  } else if (gateResults.some((g) => g.decision === 'warn')) {
    overallDecision = 'warn';
  }

  // 필요한 승인
  const requiredApprovals = gateResults
    .filter((g) => g.decision === 'fail')
    .map((g) => g.gate);

  // CEO 승인 필요 여부 (critical 위반 시)
  if (deltaResult.violations.some((v) => v.severity === 'critical')) {
    requiredApprovals.push('ceo');
  }

  const summary = generatePipelineSummary(overallDecision, requiredApprovals);

  return {
    moduleType,
    baseline,
    current,
    gates: gateResults,
    overallDecision,
    requiredApprovals: [...new Set(requiredApprovals)],
    summary,
  };
}

/**
 * 파이프라인 요약 생성
 */
function generatePipelineSummary(
  decision: GateDecision,
  requiredApprovals: GateType[]
): string {
  if (decision === 'pass') {
    return '✅ 모든 게이트 통과. 자동 머지 가능.';
  }

  if (decision === 'warn') {
    return '⚠️ 주의 필요. 리뷰 후 머지 권장.';
  }

  const approvers = requiredApprovals
    .map((g) => GATE_INFO[g].name)
    .join(', ');
  return `❌ 승인 필요: ${approvers}`;
}

// ─────────────────────────────────────────────────────────────────
// 유틸리티
// ─────────────────────────────────────────────────────────────────

/**
 * 스냅샷 생성 헬퍼
 */
export function createSnapshot(
  moduleType: ModuleType,
  meta: MetaDimensions,
  options: {
    commitHash?: string;
    functionCount?: number;
    totalWeighted?: number;
  } = {}
): Snapshot {
  return {
    timestamp: Date.now(),
    commitHash: options.commitHash,
    moduleType,
    meta,
    functionCount: options.functionCount ?? 0,
    totalWeighted: options.totalWeighted ?? 0,
  };
}
