import ts from 'typescript';
import type {
  ComplexityResult,
  ComplexityDetail,
  ComplexityContributor,
  FunctionInfo,
} from '../types.js';
import { getSourceLocation, extractFunctionInfo } from '../ast/parser.js';

/**
 * McCabe 순환복잡도 계산
 *
 * V(G) = E - N + 2P
 * 단순화: 분기점 개수 + 1
 *
 * 분기점:
 * - if, else if
 * - case (switch)
 * - for, for-in, for-of
 * - while, do-while
 * - catch
 * - 삼항 연산자 (?:)
 * - 논리 AND (&&), OR (||)
 * - nullish coalescing (??)
 */
export function calculateCyclomaticComplexity(
  node: ts.Node,
  sourceFile: ts.SourceFile
): { complexity: number; details: ComplexityDetail[] } {
  let complexity = 1; // 기본 경로
  const details: ComplexityDetail[] = [];

  function addDetail(
    node: ts.Node,
    type: ComplexityContributor,
    description: string
  ) {
    details.push({
      type,
      location: getSourceLocation(node, sourceFile),
      increment: 1,
      nestingLevel: 0, // 순환복잡도에서는 중첩 레벨 무시
      description,
    });
    complexity++;
  }

  function visit(node: ts.Node) {
    switch (node.kind) {
      case ts.SyntaxKind.IfStatement:
        addDetail(node, 'if', 'if 조건문');
        break;

      case ts.SyntaxKind.CaseClause:
        addDetail(node, 'case', 'switch case');
        break;

      case ts.SyntaxKind.DefaultClause:
        // default는 복잡도에 포함하지 않음 (경로가 아닌 fallback)
        break;

      case ts.SyntaxKind.ForStatement:
        addDetail(node, 'for', 'for 반복문');
        break;

      case ts.SyntaxKind.ForInStatement:
        addDetail(node, 'for-in', 'for-in 반복문');
        break;

      case ts.SyntaxKind.ForOfStatement:
        addDetail(node, 'for-of', 'for-of 반복문');
        break;

      case ts.SyntaxKind.WhileStatement:
        addDetail(node, 'while', 'while 반복문');
        break;

      case ts.SyntaxKind.DoStatement:
        addDetail(node, 'do-while', 'do-while 반복문');
        break;

      case ts.SyntaxKind.CatchClause:
        addDetail(node, 'catch', 'catch 예외 처리');
        break;

      case ts.SyntaxKind.ConditionalExpression:
        addDetail(node, 'conditional', '삼항 연산자');
        break;

      case ts.SyntaxKind.BinaryExpression: {
        const binary = node as ts.BinaryExpression;
        if (binary.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
          addDetail(node, 'logical-and', '논리 AND (&&)');
        } else if (binary.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
          addDetail(node, 'logical-or', '논리 OR (||)');
        } else if (
          binary.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
        ) {
          addDetail(node, 'nullish-coalescing', 'Nullish coalescing (??)');
        }
        break;
      }

      default:
        break;
    }

    ts.forEachChild(node, visit);
  }

  visit(node);

  return { complexity, details };
}

/**
 * 함수 노드에서 순환복잡도 계산
 */
export function analyzeFunctionCyclomatic(
  functionNode: ts.Node,
  sourceFile: ts.SourceFile,
  functionInfo: FunctionInfo
): ComplexityResult {
  const { complexity, details } = calculateCyclomaticComplexity(
    functionNode,
    sourceFile
  );

  return {
    function: functionInfo,
    cyclomatic: complexity,
    cognitive: 0, // cognitive.ts에서 별도 계산
    details,
  };
}

/**
 * 소스 파일의 모든 함수에 대한 순환복잡도 계산
 */
export function analyzeFileCyclomatic(
  sourceFile: ts.SourceFile
): ComplexityResult[] {
  const results: ComplexityResult[] = [];

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
      const result = analyzeFunctionCyclomatic(node, sourceFile, functionInfo);
      results.push(result);
    }

    // 자식 노드 순회
    ts.forEachChild(node, (child) => visit(child, className));
  }

  visit(sourceFile);
  return results;
}
