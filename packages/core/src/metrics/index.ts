import ts from 'typescript';
import type {
  ComplexityResult,
  ExtendedComplexityResult,
  FileAnalysisResult,
  FunctionInfo,
  DimensionalWeights,
} from '../types.js';
import { extractFunctionInfo, extractImports, extractExports } from '../ast/parser.js';
import { calculateCyclomaticComplexity } from './cyclomatic.js';
import { calculateCognitiveComplexity } from './cognitive.js';
import { analyzeDimensionalComplexity, DEFAULT_WEIGHTS } from './dimensional.js';

export {
  calculateCyclomaticComplexity,
  analyzeFunctionCyclomatic,
  analyzeFileCyclomatic,
} from './cyclomatic.js';

export {
  calculateCognitiveComplexity,
  analyzeFunctionCognitive,
  analyzeFileCognitive,
} from './cognitive.js';

export {
  analyzeStateComplexity,
  analyzeAsyncComplexity,
  analyzeCouplingComplexity,
  analyzeDimensionalComplexity,
  DEFAULT_WEIGHTS,
} from './dimensional.js';

/**
 * 함수의 순환복잡도와 인지복잡도를 모두 계산
 */
export function analyzeFunction(
  functionNode: ts.Node,
  sourceFile: ts.SourceFile,
  functionInfo: FunctionInfo
): ComplexityResult {
  const cyclomatic = calculateCyclomaticComplexity(functionNode, sourceFile);
  const cognitive = calculateCognitiveComplexity(
    functionNode,
    sourceFile,
    functionInfo.name !== '<anonymous>' ? functionInfo.name : undefined
  );

  // 상세 정보 병합 (인지복잡도 기준, 더 상세함)
  return {
    function: functionInfo,
    cyclomatic: cyclomatic.complexity,
    cognitive: cognitive.complexity,
    details: cognitive.details,
  };
}

/**
 * 함수의 확장된 복잡도 분석 (차원 복잡도 포함)
 */
export function analyzeFunctionExtended(
  functionNode: ts.Node,
  sourceFile: ts.SourceFile,
  functionInfo: FunctionInfo,
  weights: DimensionalWeights = DEFAULT_WEIGHTS
): ExtendedComplexityResult {
  const cyclomatic = calculateCyclomaticComplexity(functionNode, sourceFile);
  const cognitive = calculateCognitiveComplexity(
    functionNode,
    sourceFile,
    functionInfo.name !== '<anonymous>' ? functionInfo.name : undefined
  );

  // nesting penalty 계산 (인지복잡도 - 순환복잡도 기반 추정)
  const nestingPenalty = cognitive.details
    .filter((d) => d.nestingLevel > 0)
    .reduce((sum, d) => sum + d.nestingLevel, 0);

  // 차원 복잡도 분석
  const dimensional = analyzeDimensionalComplexity(
    functionNode,
    sourceFile,
    cyclomatic.complexity,
    nestingPenalty,
    weights
  );

  return {
    function: functionInfo,
    cyclomatic: cyclomatic.complexity,
    cognitive: cognitive.complexity,
    details: cognitive.details,
    dimensional,
  };
}

/**
 * 소스 파일의 모든 함수에 대한 복잡도 분석
 */
export function analyzeFile(sourceFile: ts.SourceFile): FileAnalysisResult {
  const functions: ComplexityResult[] = [];

  function visit(node: ts.Node, className?: string) {
    // 클래스 처리
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      const name = node.name?.getText(sourceFile) ?? '<anonymous>';
      node.members.forEach((member) => visit(member, name));
      return;
    }

    // 함수 노드 확인
    const functionInfo = extractFunctionInfo(node, sourceFile, className);
    if (functionInfo) {
      const result = analyzeFunction(node, sourceFile, functionInfo);
      functions.push(result);
    }

    // 최상위 레벨만 순회 (중첩 함수는 상위 함수에서 처리)
  }

  ts.forEachChild(sourceFile, (node) => visit(node));

  // 통계 계산
  const totalCyclomatic = functions.reduce((sum, f) => sum + f.cyclomatic, 0);
  const totalCognitive = functions.reduce((sum, f) => sum + f.cognitive, 0);
  const count = functions.length || 1;

  return {
    filePath: sourceFile.fileName,
    functions,
    imports: extractImports(sourceFile),
    exports: extractExports(sourceFile),
    totalCyclomatic,
    totalCognitive,
    averageCyclomatic: totalCyclomatic / count,
    averageCognitive: totalCognitive / count,
  };
}

/**
 * 복잡도 등급 판정
 */
export function getComplexityGrade(
  cyclomatic: number,
  cognitive: number
): 'low' | 'moderate' | 'high' | 'very-high' {
  // 인지복잡도 기준 (SonarQube 기준)
  if (cognitive <= 5 && cyclomatic <= 5) return 'low';
  if (cognitive <= 10 && cyclomatic <= 10) return 'moderate';
  if (cognitive <= 20 && cyclomatic <= 20) return 'high';
  return 'very-high';
}

/**
 * 복잡도 요약 생성 (MCP용)
 */
export function generateComplexitySummary(result: FileAnalysisResult): string {
  const lines: string[] = [
    `## 파일: ${result.filePath}`,
    '',
    `총 함수 수: ${result.functions.length}`,
    `평균 순환복잡도: ${result.averageCyclomatic.toFixed(1)}`,
    `평균 인지복잡도: ${result.averageCognitive.toFixed(1)}`,
    '',
  ];

  // 복잡도가 높은 함수 목록
  const highComplexity = result.functions
    .filter((f) => f.cyclomatic > 10 || f.cognitive > 15)
    .sort((a, b) => b.cognitive - a.cognitive);

  if (highComplexity.length > 0) {
    lines.push('### 리팩토링 권장 함수');
    lines.push('');
    for (const func of highComplexity) {
      const grade = getComplexityGrade(func.cyclomatic, func.cognitive);
      const loc = func.function.location;
      lines.push(
        `- **${func.function.name}** (${loc.startLine}행): ` +
          `순환=${func.cyclomatic}, 인지=${func.cognitive} [${grade}]`
      );
    }
  }

  return lines.join('\n');
}
