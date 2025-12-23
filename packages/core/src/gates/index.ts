/**
 * 게이트 시스템
 *
 * Delta 기반 품질 게이트 및 다단계 승인 워크플로우
 */

// Types
export type {
  GateType,
  GateInfo,
  ViolationSeverity,
  Violation,
  DeltaAnalysis,
  DeltaThresholds,
  GateDecision,
  GateResult,
  GatePipelineResult,
} from './types.js';

export {
  GATE_RESPONSIBILITIES,
  GATE_INFO,
  DEFAULT_DELTA_THRESHOLDS,
} from './types.js';

// Delta Analysis
export {
  calculateDelta,
  calculateDeltaPercent,
  detectViolations,
  analyzeDelta,
  checkGate,
  runGatePipeline,
  createSnapshot,
} from './delta.js';
