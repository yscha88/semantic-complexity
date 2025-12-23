/**
 * 소스 위치 정보
 */
export interface SourceLocation {
  filePath: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

/**
 * 함수/메서드 정보
 */
export interface FunctionInfo {
  name: string;
  kind: 'function' | 'method' | 'arrow' | 'getter' | 'setter' | 'constructor';
  location: SourceLocation;
  isAsync: boolean;
  isGenerator: boolean;
  isExported: boolean;
  parameters: ParameterInfo[];
  returnType?: string;
  className?: string;
}

/**
 * 파라미터 정보
 */
export interface ParameterInfo {
  name: string;
  type?: string;
  isOptional: boolean;
  isRest: boolean;
  hasDefault: boolean;
}

/**
 * 복잡도 결과
 */
export interface ComplexityResult {
  function: FunctionInfo;
  cyclomatic: number;
  cognitive: number;
  details: ComplexityDetail[];
}

/**
 * 복잡도 상세 정보
 */
export interface ComplexityDetail {
  type: ComplexityContributor;
  location: SourceLocation;
  increment: number;
  nestingLevel: number;
  description: string;
}

/**
 * 복잡도 기여 요인
 */
export type ComplexityContributor =
  | 'if'
  | 'else-if'
  | 'else'
  | 'switch'
  | 'case'
  | 'for'
  | 'for-in'
  | 'for-of'
  | 'while'
  | 'do-while'
  | 'catch'
  | 'conditional' // 삼항 연산자
  | 'logical-and'
  | 'logical-or'
  | 'nullish-coalescing'
  | 'optional-chaining'
  | 'recursion'
  | 'callback'
  | 'nested-function';

/**
 * 파일 분석 결과
 */
export interface FileAnalysisResult {
  filePath: string;
  functions: ComplexityResult[];
  imports: ImportInfo[];
  exports: ExportInfo[];
  totalCyclomatic: number;
  totalCognitive: number;
  averageCyclomatic: number;
  averageCognitive: number;
}

/**
 * Import 정보
 */
export interface ImportInfo {
  source: string;
  specifiers: ImportSpecifier[];
  isTypeOnly: boolean;
  location: SourceLocation;
}

/**
 * Import 세부 정보
 */
export interface ImportSpecifier {
  name: string;
  alias?: string;
  isDefault: boolean;
  isNamespace: boolean;
}

/**
 * Export 정보
 */
export interface ExportInfo {
  name: string;
  kind: 'function' | 'class' | 'variable' | 'type' | 'interface' | 're-export';
  location: SourceLocation;
  source?: string; // re-export의 경우
}

/**
 * 의존성 그래프 노드
 */
export interface DependencyNode {
  filePath: string;
  imports: string[];
  importedBy: string[];
  depth: number; // 루트로부터의 거리
}

/**
 * 호출 그래프 노드
 */
export interface CallNode {
  function: FunctionInfo;
  calls: CallEdge[];
  calledBy: CallEdge[];
}

/**
 * 호출 그래프 엣지
 */
export interface CallEdge {
  from: FunctionInfo;
  to: FunctionInfo;
  location: SourceLocation;
  isConditional: boolean;
  isAsync: boolean;
}

/**
 * MCP용 컨텍스트 정보
 */
export interface AnalysisContext {
  file: FileAnalysisResult;
  dependencies: DependencyNode;
  callGraph: CallNode[];
  relatedFiles: FileAnalysisResult[];
  projectInfo?: ProjectInfo;
}

/**
 * 프로젝트 정보
 */
export interface ProjectInfo {
  name: string;
  root: string;
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun';
  framework?: string;
  language: 'typescript' | 'javascript' | 'mixed';
}

/**
 * 분석 옵션
 */
export interface AnalysisOptions {
  /** 순환복잡도 임계값 (기본: 10) */
  cyclomaticThreshold: number;
  /** 인지복잡도 임계값 (기본: 15) */
  cognitiveThreshold: number;
  /** 타입 정보 포함 여부 */
  includeTypes: boolean;
  /** 테스트 파일 제외 여부 */
  excludeTests: boolean;
  /** 분석 제외 패턴 */
  excludePatterns: string[];
  /** 관련 파일 포함 깊이 (의존성 그래프) */
  contextDepth: number;
}

/**
 * 기본 분석 옵션
 */
export const DEFAULT_OPTIONS: AnalysisOptions = {
  cyclomaticThreshold: 10,
  cognitiveThreshold: 15,
  includeTypes: true,
  excludeTests: true,
  excludePatterns: ['node_modules', 'dist', 'build', '.git'],
  contextDepth: 2,
};

// ─────────────────────────────────────────────────────────────────
// 차원 기반 복잡도 (Dimensional Complexity)
// ─────────────────────────────────────────────────────────────────

/**
 * 3D: 상태 복잡도 (State Complexity)
 * 상태 공간과 분기의 결합으로 인한 복잡도
 */
export interface StateComplexity {
  /** enum/union 타입 기반 상태 수 */
  enumStates: number;
  /** 상태 변경 지점 (setter, 재할당) */
  stateMutations: number;
  /** 상태 참조 지점 */
  stateReads: number;
  /** 상태 기반 분기 (상태값에 따른 조건문) */
  stateBranches: number;
  /** 상태 머신 패턴 탐지 */
  stateMachinePatterns: StatePattern[];
}

/**
 * 상태 패턴 정보
 */
export interface StatePattern {
  kind: 'switch-enum' | 'reducer' | 'state-machine' | 'flag-based';
  location: SourceLocation;
  stateCount: number;
  transitionCount: number;
}

/**
 * 4D: 비동기/동시성 복잡도 (Async Complexity)
 * 시간 축을 따라 발생하는 복잡도
 */
export interface AsyncComplexity {
  /** async/await 경계 */
  asyncBoundaries: number;
  /** Promise 체인 깊이 */
  promiseChains: number;
  /** 재시도 패턴 (retry, exponential backoff 등) */
  retryPatterns: number;
  /** 타임아웃/인터벌 처리 */
  timeouts: number;
  /** 콜백 중첩 깊이 */
  callbackDepth: number;
  /** 동시성 패턴 (Promise.all, Promise.race 등) */
  concurrencyPatterns: ConcurrencyPattern[];
  /** 에러 경계 (try-catch in async) */
  asyncErrorBoundaries: number;
}

/**
 * 동시성 패턴 정보
 */
export interface ConcurrencyPattern {
  kind: 'parallel' | 'race' | 'sequential' | 'batch' | 'throttle' | 'debounce';
  location: SourceLocation;
  promiseCount: number;
}

/**
 * 5D: 숨은 결합 복잡도 (Hidden Coupling Complexity)
 * 명시적으로 보이지 않는 의존성과 부작용
 */
export interface CouplingComplexity {
  /** 전역 변수/싱글톤 접근 */
  globalAccess: GlobalAccessInfo[];
  /** 암묵적 I/O (console, DOM, fetch 등) */
  implicitIO: ImplicitIOInfo[];
  /** 부작용 (외부 상태 변경) */
  sideEffects: SideEffectInfo[];
  /** 환경 의존성 (process.env, window 등) */
  envDependency: EnvDependencyInfo[];
  /** 클로저 캡처 */
  closureCaptures: ClosureCaptureInfo[];
}

/**
 * 전역 접근 정보
 */
export interface GlobalAccessInfo {
  name: string;
  kind: 'global' | 'singleton' | 'static' | 'module-scope';
  location: SourceLocation;
  isWrite: boolean;
}

/**
 * 암묵적 I/O 정보
 */
export interface ImplicitIOInfo {
  kind: 'console' | 'dom' | 'fetch' | 'storage' | 'file' | 'network';
  location: SourceLocation;
  api: string;
}

/**
 * 부작용 정보
 */
export interface SideEffectInfo {
  kind: 'mutation' | 'event' | 'subscription' | 'timer';
  location: SourceLocation;
  target: string;
  description: string;
}

/**
 * 환경 의존성 정보
 */
export interface EnvDependencyInfo {
  kind: 'process-env' | 'window' | 'document' | 'navigator' | 'location';
  location: SourceLocation;
  property: string;
}

/**
 * 클로저 캡처 정보
 */
export interface ClosureCaptureInfo {
  variableName: string;
  location: SourceLocation;
  capturedAt: SourceLocation;
  isMutable: boolean;
}

/**
 * 차원별 복잡도 가중치
 */
export interface DimensionalWeights {
  /** 1D 제어 흐름 가중치 */
  control: number;
  /** 2D 중첩 가중치 */
  nesting: number;
  /** 3D 상태 가중치 */
  state: number;
  /** 4D 비동기 가중치 */
  async: number;
  /** 5D 결합 가중치 */
  coupling: number;
}

/**
 * 기본 차원 가중치 (연구 기반 초기값)
 */
export const DEFAULT_DIMENSIONAL_WEIGHTS: DimensionalWeights = {
  control: 1.0,   // 기준
  nesting: 1.5,   // 중첩은 1.5배
  state: 2.0,     // 상태 결합은 2배
  async: 2.5,     // 비동기는 2.5배 (Salesforce 연구 기반)
  coupling: 3.0,  // 숨은 결합은 3배 (디버깅 난이도 기반)
};

/**
 * 차원 기반 복잡도 결과
 */
export interface DimensionalComplexity {
  /** 1D: 제어 흐름 복잡도 (순환복잡도 기반) */
  control: number;

  /** 2D: 중첩 복잡도 (인지복잡도의 nesting penalty) */
  nesting: number;

  /** 3D: 상태 복잡도 */
  state: StateComplexity;

  /** 4D: 비동기 복잡도 */
  async: AsyncComplexity;

  /** 5D: 숨은 결합 복잡도 */
  coupling: CouplingComplexity;

  /** 가중 합산 점수 */
  weighted: number;

  /** 사용된 가중치 */
  weights: DimensionalWeights;

  /** 각 차원별 기여도 (0-1) */
  contributions: {
    control: number;
    nesting: number;
    state: number;
    async: number;
    coupling: number;
  };

  /** 주요 복잡도 원인 (상위 3개) */
  hotspots: DimensionalHotspot[];
}

/**
 * 복잡도 핫스팟
 */
export interface DimensionalHotspot {
  dimension: '1D-control' | '2D-nesting' | '3D-state' | '4D-async' | '5D-coupling';
  score: number;
  location: SourceLocation;
  reason: string;
}

/**
 * 확장된 복잡도 결과 (차원 포함)
 */
export interface ExtendedComplexityResult extends ComplexityResult {
  dimensional: DimensionalComplexity;
}
