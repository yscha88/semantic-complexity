/**
 * 정준성(Canonicality) 프레임워크 타입 정의
 *
 * 햄 샌드위치 정리 기반:
 * - 🍞 Security: 구조 안정성
 * - 🧀 Context: 맥락 밀도
 * - 🥓 Behavior: 행동 보존성
 */

// ─────────────────────────────────────────────────────────────────
// 모듈 타입
// ─────────────────────────────────────────────────────────────────

/**
 * 모듈 타입 정의
 *
 * 각 타입은 독립된 문제 클래스를 형성하여
 * NP-hard → P 환원을 가능하게 함
 */
export type ModuleType = 'api' | 'app' | 'lib' | 'deploy';

/**
 * 모듈 타입 메타데이터
 */
export interface ModuleTypeInfo {
  type: ModuleType;
  description: string;
  characteristics: string[];
}

export const MODULE_TYPE_INFO: Record<ModuleType, ModuleTypeInfo> = {
  api: {
    type: 'api',
    description: '경계면 (internal/external)',
    characteristics: ['얇은 레이어', '무상태', '검증 집중'],
  },
  app: {
    type: 'app',
    description: '응용 로직',
    characteristics: ['상태/비동기 허용', '격리됨'],
  },
  lib: {
    type: 'lib',
    description: '재사용 라이브러리',
    characteristics: ['순수 함수', '고응집', '저결합'],
  },
  deploy: {
    type: 'deploy',
    description: '배포 구성',
    characteristics: ['선언적', '로직 최소'],
  },
};

// ─────────────────────────────────────────────────────────────────
// 메타 차원 (햄 샌드위치 분해)
// ─────────────────────────────────────────────────────────────────

/**
 * 메타 차원 점수
 *
 * 기존 5개 차원을 3개 상위 축으로 집계:
 * - 🍞 Security: coupling + globalAccess + envDependency
 * - 🧀 Context: cognitive + nestingDepth + callbackDepth
 * - 🥓 Behavior: state + async + sideEffects
 */
export interface MetaDimensions {
  /** 🍞 구조 안정성 (Security) */
  security: number;
  /** 🧀 맥락 밀도 (Context) */
  context: number;
  /** 🥓 행동 보존성 (Behavior) */
  behavior: number;
}

/**
 * 메타 차원 가중치
 */
export interface MetaWeights {
  security: number;
  context: number;
  behavior: number;
}

export const DEFAULT_META_WEIGHTS: MetaWeights = {
  security: 1.0,
  context: 1.0,
  behavior: 1.0,
};

// ─────────────────────────────────────────────────────────────────
// 범위 및 정준형
// ─────────────────────────────────────────────────────────────────

/**
 * 수치 범위
 */
export interface Range {
  min: number;
  max: number;
}

/**
 * 정준 레벨
 */
export type CanonicalLevel = 'lowest' | 'low' | 'medium' | 'high' | 'highest';

/**
 * 레벨별 범위 매핑
 */
export const LEVEL_RANGES: Record<CanonicalLevel, Range> = {
  lowest: { min: 0, max: 2 },
  low: { min: 0, max: 5 },
  medium: { min: 3, max: 10 },
  high: { min: 8, max: 20 },
  highest: { min: 15, max: Infinity },
};

/**
 * 모듈별 정준형 프로파일
 */
export interface CanonicalProfile {
  type: ModuleType;
  ideal: {
    security: CanonicalLevel;
    context: CanonicalLevel;
    behavior: CanonicalLevel;
  };
  tolerance: {
    security: number;
    context: number;
    behavior: number;
  };
}

// ─────────────────────────────────────────────────────────────────
// 수렴 분석
// ─────────────────────────────────────────────────────────────────

/**
 * 3D 벡터 (수렴 방향)
 */
export interface Vector3D {
  x: number; // security 방향
  y: number; // context 방향
  z: number; // behavior 방향
}

/**
 * 편차 정보
 */
export interface Deviation {
  security: number;
  context: number;
  behavior: number;
  /** L2 norm (유클리드 거리) */
  total: number;
}

/**
 * 수렴 분석 결과
 */
export interface ConvergenceResult {
  moduleType: ModuleType;
  currentState: MetaDimensions;
  canonicalState: MetaDimensions;
  deviation: Deviation;
  convergenceVector: Vector3D;
  /** 정준 상태 도달 여부 */
  isStable: boolean;
  /** 수렴률 (0-1, 1이면 완전 정준) */
  convergenceRate: number;
}

// ─────────────────────────────────────────────────────────────────
// 스냅샷
// ─────────────────────────────────────────────────────────────────

/**
 * 분석 스냅샷 (특정 시점의 상태)
 */
export interface Snapshot {
  timestamp: number;
  commitHash?: string;
  moduleType: ModuleType;
  meta: MetaDimensions;
  functionCount: number;
  totalWeighted: number;
}
