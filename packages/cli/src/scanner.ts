/**
 * 프로젝트 스캐너 - 디렉토리 내 모든 TypeScript/JavaScript 파일 분석
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { glob } from 'glob';
import ts from 'typescript';
import {
  parseSourceFile,
  extractFunctionInfo,
  analyzeFunctionExtended,
  type ExtendedComplexityResult,
  type DimensionalWeights,
} from 'semantic-complexity';

/** ExtendedComplexityResult with relativePath for CLI */
interface ExtendedResultWithPath extends ExtendedComplexityResult {
  relativePath: string;
}

// ─────────────────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────────────────

export interface ScanOptions {
  /** 분석할 파일 패턴 (기본: **\/*.{ts,tsx,js,jsx}) */
  patterns?: string[];
  /** 제외할 패턴 */
  exclude?: string[];
  /** 차원 가중치 */
  weights?: DimensionalWeights;
  /** 진행 콜백 */
  onProgress?: (current: number, total: number, file: string) => void;
}

export interface FileResult {
  filePath: string;
  relativePath: string;
  functions: ExtendedComplexityResult[];
  totalMcCabe: number;
  totalDimensional: number;
  functionCount: number;
}

export interface ProjectReport {
  projectPath: string;
  projectName: string;
  scanDate: string;
  summary: ProjectSummary;
  files: FileResult[];
  hotspots: Hotspot[];
  dimensionBreakdown: DimensionBreakdown;
  refactorPriority: RefactorItem[];
}

export interface ProjectSummary {
  totalFiles: number;
  totalFunctions: number;
  totalMcCabe: number;
  totalDimensional: number;
  averageMcCabe: number;
  averageDimensional: number;
  averageRatio: number;
  filesAboveThreshold: number;
  functionsAboveThreshold: number;
}

export interface Hotspot {
  function: string;
  file: string;
  line: number;
  mccabe: number;
  dimensional: number;
  ratio: number;
  primaryDimension: string;
  issues: string[];
}

export interface DimensionBreakdown {
  control: { total: number; average: number; max: number };
  nesting: { total: number; average: number; max: number };
  state: { total: number; average: number; max: number };
  async: { total: number; average: number; max: number };
  coupling: { total: number; average: number; max: number };
}

export interface RefactorItem {
  priority: 'critical' | 'high' | 'medium' | 'low';
  file: string;
  function: string;
  line: number;
  reason: string;
  suggestion: string;
  impact: number;
}

// ─────────────────────────────────────────────────────────────────
// 스캐너 구현
// ─────────────────────────────────────────────────────────────────

const DEFAULT_PATTERNS = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'];
const DEFAULT_EXCLUDE = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/*.d.ts',
  '**/coverage/**',
  '**/.git/**',
];

/**
 * 프로젝트 전체 스캔
 */
export async function scanProject(
  projectPath: string,
  options: ScanOptions = {}
): Promise<ProjectReport> {
  const {
    patterns = DEFAULT_PATTERNS,
    exclude = DEFAULT_EXCLUDE,
    weights,
    onProgress,
  } = options;

  const absolutePath = path.resolve(projectPath);
  const projectName = path.basename(absolutePath);

  // 파일 목록 수집
  const files: string[] = [];
  for (const pattern of patterns) {
    const matches = await glob(pattern, {
      cwd: absolutePath,
      ignore: exclude,
      absolute: true,
      nodir: true,
    });
    files.push(...matches);
  }

  // 중복 제거
  const uniqueFiles = [...new Set(files)];
  const totalFiles = uniqueFiles.length;

  // 파일별 분석
  const fileResults: FileResult[] = [];
  let processedCount = 0;

  for (const filePath of uniqueFiles) {
    try {
      const result = analyzeFileComplete(filePath, absolutePath, weights);
      if (result.functions.length > 0) {
        fileResults.push(result);
      }
    } catch {
      // 파싱 실패 시 스킵
      console.error(`Failed to analyze: ${filePath}`);
    }

    processedCount++;
    if (onProgress) {
      onProgress(processedCount, totalFiles, path.relative(absolutePath, filePath));
    }
  }

  // 리포트 생성
  return generateReport(absolutePath, projectName, fileResults);
}

/**
 * 단일 파일 완전 분석
 */
function analyzeFileComplete(
  filePath: string,
  projectRoot: string,
  weights?: DimensionalWeights
): FileResult {
  const content = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = parseSourceFile(filePath, content);
  const functions: ExtendedComplexityResult[] = [];

  function visit(node: ts.Node) {
    const funcInfo = extractFunctionInfo(node, sourceFile);
    if (funcInfo) {
      const result = analyzeFunctionExtended(node, sourceFile, funcInfo, weights);
      functions.push(result);
    }
    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sourceFile, visit);

  const totalMcCabe = functions.reduce((sum, f) => sum + f.cyclomatic, 0);
  const totalDimensional = functions.reduce((sum, f) => sum + f.dimensional.weighted, 0);

  return {
    filePath,
    relativePath: path.relative(projectRoot, filePath),
    functions,
    totalMcCabe,
    totalDimensional,
    functionCount: functions.length,
  };
}

/**
 * 리포트 생성
 */
function generateReport(
  projectPath: string,
  projectName: string,
  files: FileResult[]
): ProjectReport {
  const allFunctions = files.flatMap((f) =>
    f.functions.map((fn) => ({ ...fn, filePath: f.filePath, relativePath: f.relativePath }))
  );

  // 요약 통계
  const totalFunctions = allFunctions.length;
  const totalMcCabe = allFunctions.reduce((sum, f) => sum + f.cyclomatic, 0);
  const totalDimensional = allFunctions.reduce((sum, f) => sum + f.dimensional.weighted, 0);

  const avgMcCabe = totalFunctions > 0 ? totalMcCabe / totalFunctions : 0;
  const avgDimensional = totalFunctions > 0 ? totalDimensional / totalFunctions : 0;
  const avgRatio = avgMcCabe > 0 ? avgDimensional / avgMcCabe : 0;

  // 임계값 초과 카운트
  const filesAboveThreshold = files.filter((f) =>
    f.functions.some((fn) => fn.dimensional.weighted > 20)
  ).length;
  const functionsAboveThreshold = allFunctions.filter(
    (f) => f.dimensional.weighted > 20
  ).length;

  const summary: ProjectSummary = {
    totalFiles: files.length,
    totalFunctions,
    totalMcCabe,
    totalDimensional: Math.round(totalDimensional * 10) / 10,
    averageMcCabe: Math.round(avgMcCabe * 10) / 10,
    averageDimensional: Math.round(avgDimensional * 10) / 10,
    averageRatio: Math.round(avgRatio * 100) / 100,
    filesAboveThreshold,
    functionsAboveThreshold,
  };

  // 핫스팟 (상위 20개)
  const hotspots: Hotspot[] = allFunctions
    .filter((f) => f.dimensional.weighted > 10)
    .sort((a, b) => b.dimensional.weighted - a.dimensional.weighted)
    .slice(0, 20)
    .map((f) => ({
      function: f.function.name,
      file: (f as ExtendedResultWithPath).relativePath,
      line: f.function.location.startLine,
      mccabe: f.cyclomatic,
      dimensional: Math.round(f.dimensional.weighted * 10) / 10,
      ratio: f.cyclomatic > 0 ? Math.round((f.dimensional.weighted / f.cyclomatic) * 100) / 100 : 0,
      primaryDimension: getPrimaryDimension(f),
      issues: getIssues(f),
    }));

  // 차원별 분석
  const dimensionBreakdown = calculateDimensionBreakdown(allFunctions);

  // 리팩토링 우선순위
  const refactorPriority = generateRefactorPriority(allFunctions);

  return {
    projectPath,
    projectName,
    scanDate: new Date().toISOString(),
    summary,
    files,
    hotspots,
    dimensionBreakdown,
    refactorPriority,
  };
}

function getPrimaryDimension(f: ExtendedComplexityResult): string {
  const scores = [
    { name: '1D-control', score: f.dimensional.control },
    { name: '2D-nesting', score: f.dimensional.nesting },
    { name: '3D-state', score: scoreState(f) },
    { name: '4D-async', score: scoreAsync(f) },
    { name: '5D-coupling', score: scoreCoupling(f) },
  ];
  scores.sort((a, b) => b.score - a.score);
  return scores[0].name;
}

function getIssues(f: ExtendedComplexityResult): string[] {
  const issues: string[] = [];
  const d = f.dimensional;

  if (d.state.stateMutations > 5) {
    issues.push(`상태 변경 ${d.state.stateMutations}회`);
  }
  if (d.async.callbackDepth > 2) {
    issues.push(`콜백 깊이 ${d.async.callbackDepth}`);
  }
  if (d.coupling.globalAccess.length > 3) {
    issues.push(`전역 접근 ${d.coupling.globalAccess.length}회`);
  }
  if (d.coupling.sideEffects.length > 2) {
    issues.push(`부작용 ${d.coupling.sideEffects.length}개`);
  }
  if (d.coupling.closureCaptures.length > 5) {
    issues.push(`클로저 캡처 ${d.coupling.closureCaptures.length}개`);
  }

  return issues;
}

function scoreState(f: ExtendedComplexityResult): number {
  const s = f.dimensional.state;
  return s.enumStates + s.stateMutations * 2 + s.stateReads * 0.5 + s.stateBranches * 3;
}

function scoreAsync(f: ExtendedComplexityResult): number {
  const a = f.dimensional.async;
  return a.asyncBoundaries + a.promiseChains * 2 + a.callbackDepth * 3 + a.concurrencyPatterns.length * 4;
}

function scoreCoupling(f: ExtendedComplexityResult): number {
  const c = f.dimensional.coupling;
  return c.globalAccess.length * 2 + c.implicitIO.length * 2 + c.sideEffects.length * 3 + c.closureCaptures.length;
}

function calculateDimensionBreakdown(functions: ExtendedComplexityResult[]): DimensionBreakdown {
  if (functions.length === 0) {
    return {
      control: { total: 0, average: 0, max: 0 },
      nesting: { total: 0, average: 0, max: 0 },
      state: { total: 0, average: 0, max: 0 },
      async: { total: 0, average: 0, max: 0 },
      coupling: { total: 0, average: 0, max: 0 },
    };
  }

  const controls = functions.map((f) => f.dimensional.control);
  const nestings = functions.map((f) => f.dimensional.nesting);
  const states = functions.map((f) => scoreState(f));
  const asyncs = functions.map((f) => scoreAsync(f));
  const couplings = functions.map((f) => scoreCoupling(f));

  const calc = (arr: number[]) => ({
    total: Math.round(arr.reduce((a, b) => a + b, 0) * 10) / 10,
    average: Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10,
    max: Math.round(Math.max(...arr) * 10) / 10,
  });

  return {
    control: calc(controls),
    nesting: calc(nestings),
    state: calc(states),
    async: calc(asyncs),
    coupling: calc(couplings),
  };
}

function generateRefactorPriority(
  functions: Array<ExtendedComplexityResult & { relativePath?: string }>
): RefactorItem[] {
  const items: RefactorItem[] = [];

  for (const f of functions) {
    const d = f.dimensional;
    const ratio = f.cyclomatic > 0 ? d.weighted / f.cyclomatic : 0;

    // Critical: ratio > 10 또는 weighted > 100
    if (ratio > 10 || d.weighted > 100) {
      items.push({
        priority: 'critical',
        file: (f as ExtendedResultWithPath).relativePath || f.function.location.filePath,
        function: f.function.name,
        line: f.function.location.startLine,
        reason: `Ratio ${ratio.toFixed(1)}x, Dimensional ${d.weighted.toFixed(1)}`,
        suggestion: getSuggestion(f),
        impact: d.weighted,
      });
    }
    // High: ratio > 5 또는 weighted > 50
    else if (ratio > 5 || d.weighted > 50) {
      items.push({
        priority: 'high',
        file: (f as ExtendedResultWithPath).relativePath || f.function.location.filePath,
        function: f.function.name,
        line: f.function.location.startLine,
        reason: `Ratio ${ratio.toFixed(1)}x, Dimensional ${d.weighted.toFixed(1)}`,
        suggestion: getSuggestion(f),
        impact: d.weighted,
      });
    }
    // Medium: ratio > 3 또는 weighted > 30
    else if (ratio > 3 || d.weighted > 30) {
      items.push({
        priority: 'medium',
        file: (f as ExtendedResultWithPath).relativePath || f.function.location.filePath,
        function: f.function.name,
        line: f.function.location.startLine,
        reason: `Ratio ${ratio.toFixed(1)}x, Dimensional ${d.weighted.toFixed(1)}`,
        suggestion: getSuggestion(f),
        impact: d.weighted,
      });
    }
  }

  return items.sort((a, b) => b.impact - a.impact).slice(0, 30);
}

function getSuggestion(f: ExtendedComplexityResult): string {
  const stateScore = scoreState(f);
  const asyncScore = scoreAsync(f);
  const couplingScore = scoreCoupling(f);

  const max = Math.max(stateScore, asyncScore, couplingScore);

  if (max === stateScore && stateScore > 10) {
    return '상태 관리 개선: useReducer 또는 상태 라이브러리 도입';
  }
  if (max === asyncScore && asyncScore > 10) {
    return '비동기 로직 분리: 커스텀 훅 또는 서비스 레이어로 추출';
  }
  if (max === couplingScore && couplingScore > 10) {
    return '의존성 주입: 전역 접근 제거, 순수 함수로 리팩토링';
  }
  if (f.dimensional.nesting > 10) {
    return '중첩 감소: 조기 반환(early return) 패턴 적용';
  }

  return '함수 분리: 단일 책임 원칙에 따라 작은 함수로 분리';
}
