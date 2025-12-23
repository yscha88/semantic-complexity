/**
 * 게이트 시스템 타입 정의
 *
 * 다단계 승인 워크플로우:
 * - Dev: Context 축 담당
 * - QA: Behavior 축 담당
 * - RA: Security 축 담당
 */

import type { MetaDimensions, Snapshot, ModuleType } from '../canonical/types.js';

// ─────────────────────────────────────────────────────────────────
// 게이트 정의
// ─────────────────────────────────────────────────────────────────

/**
 * 게이트 타입
 */
export type GateType = 'dev' | 'qa' | 'ra' | 'ceo';

/**
 * 게이트별 담당 축
 */
export const GATE_RESPONSIBILITIES: Record<GateType, keyof MetaDimensions> = {
  dev: 'context',
  qa: 'behavior',
  ra: 'security',
  ceo: 'security', // 최종 승인
};

/**
 * 게이트 정보
 */
export interface GateInfo {
  type: GateType;
  name: string;
  responsibility: keyof MetaDimensions;
  description: string;
}

export const GATE_INFO: Record<GateType, GateInfo> = {
  dev: {
    type: 'dev',
    name: '개발팀',
    responsibility: 'context',
    description: '맥락 밀도 증가 제한, 코드 복잡도 검토',
  },
  qa: {
    type: 'qa',
    name: 'QA/SQA',
    responsibility: 'behavior',
    description: '행동 변경 제한, 테스트 커버리지 필수',
  },
  ra: {
    type: 'ra',
    name: 'RA (Regulatory Affairs)',
    responsibility: 'security',
    description: '보안 영향 평가, 규제 준수 확인',
  },
  ceo: {
    type: 'ceo',
    name: 'CEO',
    responsibility: 'security',
    description: '최종 승인, 전체 영향 평가',
  },
};

// ─────────────────────────────────────────────────────────────────
// 위반 정의
// ─────────────────────────────────────────────────────────────────

/**
 * 위반 심각도
 */
export type ViolationSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * 위반 정보
 */
export interface Violation {
  gate: GateType;
  dimension: keyof MetaDimensions;
  severity: ViolationSeverity;
  currentValue: number;
  previousValue: number;
  delta: number;
  threshold: number;
  message: string;
  suggestion?: string;
}

// ─────────────────────────────────────────────────────────────────
// Delta 분석
// ─────────────────────────────────────────────────────────────────

/**
 * Delta 분석 결과
 */
export interface DeltaAnalysis {
  baseline: Snapshot;
  current: Snapshot;
  delta: MetaDimensions;
  deltaPercent: MetaDimensions;
  exceedsThreshold: boolean;
  violations: Violation[];
  affectedGates: GateType[];
}

/**
 * Delta 임계값 설정
 */
export interface DeltaThresholds {
  /** 절대값 증가 임계값 */
  absolute: MetaDimensions;
  /** 상대값(%) 증가 임계값 */
  relative: MetaDimensions;
}

/**
 * 기본 Delta 임계값
 */
export const DEFAULT_DELTA_THRESHOLDS: DeltaThresholds = {
  absolute: {
    security: 5,
    context: 10,
    behavior: 5,
  },
  relative: {
    security: 20, // 20% 증가
    context: 30,  // 30% 증가
    behavior: 25, // 25% 증가
  },
};

// ─────────────────────────────────────────────────────────────────
// 게이트 결과
// ─────────────────────────────────────────────────────────────────

/**
 * 게이트 검사 결과
 */
export type GateDecision = 'pass' | 'warn' | 'fail';

/**
 * 게이트 검사 결과
 */
export interface GateResult {
  gate: GateType;
  decision: GateDecision;
  violations: Violation[];
  summary: string;
}

/**
 * 전체 게이트 파이프라인 결과
 */
export interface GatePipelineResult {
  moduleType: ModuleType;
  baseline: Snapshot;
  current: Snapshot;
  gates: GateResult[];
  overallDecision: GateDecision;
  requiredApprovals: GateType[];
  summary: string;
}
