/**
 * 모듈별 정준형 프로파일 정의
 *
 * 각 모듈 타입의 이상적인 메타 차원 범위를 정의
 * P-NP 관점: 모듈 타입이 제약 조건으로 작용하여 탐색 공간 축소
 */

import type {
  ModuleType,
  CanonicalProfile,
  CanonicalLevel,
  MetaDimensions,
  Range,
} from './types.js';

// ─────────────────────────────────────────────────────────────────
// 정준형 프로파일 정의
// ─────────────────────────────────────────────────────────────────

/**
 * API 모듈 정준형
 *
 * 경계면 역할: 외부 입력 검증, 무상태, 얇은 레이어
 */
const API_PROFILE: CanonicalProfile = {
  type: 'api',
  ideal: {
    security: 'high',     // 입력 검증, 인증/인가 집중
    context: 'low',       // 단순한 라우팅, 최소 로직
    behavior: 'low',      // 상태 없음, 부작용 최소
  },
  tolerance: {
    security: 5,
    context: 3,
    behavior: 3,
  },
};

/**
 * App 모듈 정준형
 *
 * 응용 로직: 비즈니스 로직 집중, 상태/비동기 허용
 */
const APP_PROFILE: CanonicalProfile = {
  type: 'app',
  ideal: {
    security: 'medium',   // 내부 검증
    context: 'high',      // 복잡한 비즈니스 로직 허용
    behavior: 'high',     // 상태/비동기 허용
  },
  tolerance: {
    security: 5,
    context: 10,
    behavior: 10,
  },
};

/**
 * Lib 모듈 정준형
 *
 * 재사용 라이브러리: 순수 함수, 고응집, 저결합
 */
const LIB_PROFILE: CanonicalProfile = {
  type: 'lib',
  ideal: {
    security: 'low',      // 외부 의존 최소
    context: 'low',       // 단순하고 명확한 인터페이스
    behavior: 'low',      // 순수 함수, 부작용 없음
  },
  tolerance: {
    security: 2,
    context: 5,
    behavior: 3,
  },
};

/**
 * Deploy 모듈 정준형
 *
 * 배포 구성: 선언적, 로직 최소
 */
const DEPLOY_PROFILE: CanonicalProfile = {
  type: 'deploy',
  ideal: {
    security: 'high',     // 환경 변수, 시크릿 관리
    context: 'lowest',    // 로직 없음
    behavior: 'lowest',   // 부작용 없음
  },
  tolerance: {
    security: 3,
    context: 1,
    behavior: 1,
  },
};

/**
 * 모든 정준형 프로파일
 */
export const CANONICAL_PROFILES: Record<ModuleType, CanonicalProfile> = {
  api: API_PROFILE,
  app: APP_PROFILE,
  lib: LIB_PROFILE,
  deploy: DEPLOY_PROFILE,
};

// ─────────────────────────────────────────────────────────────────
// 프로파일 유틸리티
// ─────────────────────────────────────────────────────────────────

/**
 * 레벨을 수치 범위로 변환
 */
export function levelToRange(level: CanonicalLevel): Range {
  const ranges: Record<CanonicalLevel, Range> = {
    lowest: { min: 0, max: 2 },
    low: { min: 0, max: 5 },
    medium: { min: 3, max: 10 },
    high: { min: 8, max: 20 },
    highest: { min: 15, max: Infinity },
  };
  return ranges[level];
}

/**
 * 레벨의 중앙값 반환
 */
export function levelToMidpoint(level: CanonicalLevel): number {
  const range = levelToRange(level);
  if (range.max === Infinity) {
    return range.min + 10; // 무한대 처리
  }
  return (range.min + range.max) / 2;
}

/**
 * 프로파일의 이상적 메타 차원값 반환
 */
export function getIdealMetaDimensions(profile: CanonicalProfile): MetaDimensions {
  return {
    security: levelToMidpoint(profile.ideal.security),
    context: levelToMidpoint(profile.ideal.context),
    behavior: levelToMidpoint(profile.ideal.behavior),
  };
}

/**
 * 모듈 타입으로 프로파일 조회
 */
export function getProfile(moduleType: ModuleType): CanonicalProfile {
  return CANONICAL_PROFILES[moduleType];
}

/**
 * 값이 정준 범위 내에 있는지 확인
 */
export function isWithinCanonicalRange(
  value: number,
  level: CanonicalLevel,
  tolerance: number = 0
): boolean {
  const range = levelToRange(level);
  return value >= range.min - tolerance && value <= range.max + tolerance;
}

/**
 * 메타 차원이 프로파일의 정준 범위 내에 있는지 확인
 */
export function isCanonical(
  meta: MetaDimensions,
  profile: CanonicalProfile
): boolean {
  return (
    isWithinCanonicalRange(meta.security, profile.ideal.security, profile.tolerance.security) &&
    isWithinCanonicalRange(meta.context, profile.ideal.context, profile.tolerance.context) &&
    isWithinCanonicalRange(meta.behavior, profile.ideal.behavior, profile.tolerance.behavior)
  );
}

/**
 * 모듈 타입 자동 추론 (파일 경로 기반)
 */
export function inferModuleType(filePath: string): ModuleType {
  const path = filePath.toLowerCase();

  // deploy 패턴
  if (
    path.includes('/deploy/') ||
    path.includes('/infra/') ||
    path.includes('/k8s/') ||
    path.includes('/helm/') ||
    path.includes('/terraform/') ||
    path.endsWith('.yaml') ||
    path.endsWith('.yml')
  ) {
    return 'deploy';
  }

  // api 패턴
  if (
    path.includes('/api/') ||
    path.includes('/routes/') ||
    path.includes('/controllers/') ||
    path.includes('/handlers/') ||
    path.includes('/endpoints/')
  ) {
    return 'api';
  }

  // lib 패턴
  if (
    path.includes('/lib/') ||
    path.includes('/utils/') ||
    path.includes('/helpers/') ||
    path.includes('/common/') ||
    path.includes('/shared/')
  ) {
    return 'lib';
  }

  // 기본값: app
  return 'app';
}
