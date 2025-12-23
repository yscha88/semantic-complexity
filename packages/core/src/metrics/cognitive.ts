import ts from 'typescript';
import type {
  ComplexityResult,
  ComplexityDetail,
  ComplexityContributor,
  FunctionInfo,
} from '../types.js';
import { getSourceLocation, extractFunctionInfo } from '../ast/parser.js';

/**
 * SonarSource 인지복잡도 계산
 *
 * 기본 원칙:
 * 1. 중첩은 복잡성을 증가시킨다 (nesting penalty)
 * 2. 선형 흐름 중단은 복잡성을 증가시킨다 (structural increment)
 * 3. 일부 구조는 "하이브리드" (둘 다 적용)
 *
 * Structural Increment (+1):
 * - if, else if, else
 * - switch
 * - for, for-in, for-of, while, do-while
 * - catch
 * - goto (JS/TS에서는 labeled break/continue)
 * - 재귀 호출
 * - 중첩 함수
 *
 * Nesting Penalty (+nesting level):
 * - if, else if, else (중첩 시)
 * - switch (중첩 시)
 * - for, for-in, for-of, while, do-while (중첩 시)
 * - catch (중첩 시)
 * - 삼항 연산자 (중첩 시)
 * - 중첩 함수
 *
 * 참고: 순환복잡도와 달리 &&, ||, ??는 시퀀스가 아닌 경우에만 카운트
 */
export function calculateCognitiveComplexity(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  currentFunctionName?: string
): { complexity: number; details: ComplexityDetail[] } {
  let complexity = 0;
  const details: ComplexityDetail[] = [];

  function addDetail(
    node: ts.Node,
    type: ComplexityContributor,
    increment: number,
    nestingLevel: number,
    description: string
  ) {
    const totalIncrement = increment + nestingLevel;
    details.push({
      type,
      location: getSourceLocation(node, sourceFile),
      increment: totalIncrement,
      nestingLevel,
      description: `${description} (+${increment}${nestingLevel > 0 ? ` +${nestingLevel} nesting` : ''})`,
    });
    complexity += totalIncrement;
  }

  function visit(node: ts.Node, nestingLevel: number, inLogicalSequence: boolean) {
    switch (node.kind) {
      case ts.SyntaxKind.IfStatement: {
        const ifStmt = node as ts.IfStatement;

        // if 또는 else if
        const parent = node.parent;
        const isElseIf =
          parent &&
          ts.isIfStatement(parent) &&
          parent.elseStatement === node;

        if (isElseIf) {
          addDetail(node, 'else-if', 1, 0, 'else if'); // else if는 nesting penalty 없음
        } else {
          addDetail(node, 'if', 1, nestingLevel, 'if 조건문');
        }

        // then 브랜치
        visit(ifStmt.thenStatement, nestingLevel + 1, false);

        // else 브랜치
        if (ifStmt.elseStatement) {
          if (ts.isIfStatement(ifStmt.elseStatement)) {
            // else if는 nesting 증가 없이 순회
            visit(ifStmt.elseStatement, nestingLevel, false);
          } else {
            addDetail(ifStmt.elseStatement, 'else', 1, 0, 'else');
            visit(ifStmt.elseStatement, nestingLevel + 1, false);
          }
        }
        return; // 자식 노드 이미 처리함
      }

      case ts.SyntaxKind.SwitchStatement:
        addDetail(node, 'switch', 1, nestingLevel, 'switch 문');
        ts.forEachChild(node, (child) => visit(child, nestingLevel + 1, false));
        return;

      case ts.SyntaxKind.ForStatement:
        addDetail(node, 'for', 1, nestingLevel, 'for 반복문');
        ts.forEachChild(node, (child) => visit(child, nestingLevel + 1, false));
        return;

      case ts.SyntaxKind.ForInStatement:
        addDetail(node, 'for-in', 1, nestingLevel, 'for-in 반복문');
        ts.forEachChild(node, (child) => visit(child, nestingLevel + 1, false));
        return;

      case ts.SyntaxKind.ForOfStatement:
        addDetail(node, 'for-of', 1, nestingLevel, 'for-of 반복문');
        ts.forEachChild(node, (child) => visit(child, nestingLevel + 1, false));
        return;

      case ts.SyntaxKind.WhileStatement:
        addDetail(node, 'while', 1, nestingLevel, 'while 반복문');
        ts.forEachChild(node, (child) => visit(child, nestingLevel + 1, false));
        return;

      case ts.SyntaxKind.DoStatement:
        addDetail(node, 'do-while', 1, nestingLevel, 'do-while 반복문');
        ts.forEachChild(node, (child) => visit(child, nestingLevel + 1, false));
        return;

      case ts.SyntaxKind.CatchClause:
        addDetail(node, 'catch', 1, nestingLevel, 'catch 예외 처리');
        ts.forEachChild(node, (child) => visit(child, nestingLevel + 1, false));
        return;

      case ts.SyntaxKind.ConditionalExpression:
        addDetail(node, 'conditional', 1, nestingLevel, '삼항 연산자');
        ts.forEachChild(node, (child) => visit(child, nestingLevel + 1, false));
        return;

      case ts.SyntaxKind.BinaryExpression: {
        const binary = node as ts.BinaryExpression;
        const op = binary.operatorToken.kind;

        // 논리 연산자 시퀀스 처리
        // a && b && c 는 +1 (시퀀스)
        // a && b || c 는 +2 (다른 연산자)
        const isLogical =
          op === ts.SyntaxKind.AmpersandAmpersandToken ||
          op === ts.SyntaxKind.BarBarToken ||
          op === ts.SyntaxKind.QuestionQuestionToken;

        if (isLogical) {
          const parentBinary = node.parent;
          const isContinuingSequence =
            inLogicalSequence &&
            ts.isBinaryExpression(parentBinary) &&
            parentBinary.operatorToken.kind === op;

          if (!isContinuingSequence) {
            const type: ComplexityContributor =
              op === ts.SyntaxKind.AmpersandAmpersandToken
                ? 'logical-and'
                : op === ts.SyntaxKind.BarBarToken
                  ? 'logical-or'
                  : 'nullish-coalescing';
            const desc =
              op === ts.SyntaxKind.AmpersandAmpersandToken
                ? '논리 AND 시퀀스'
                : op === ts.SyntaxKind.BarBarToken
                  ? '논리 OR 시퀀스'
                  : 'Nullish coalescing 시퀀스';
            addDetail(node, type, 1, 0, desc);
          }

          visit(binary.left, nestingLevel, true);
          visit(binary.right, nestingLevel, true);
          return;
        }
        break;
      }

      case ts.SyntaxKind.FunctionDeclaration:
      case ts.SyntaxKind.FunctionExpression:
      case ts.SyntaxKind.ArrowFunction: {
        // 중첩 함수 (콜백)
        if (nestingLevel > 0) {
          addDetail(node, 'nested-function', 1, nestingLevel, '중첩 함수/콜백');
        }
        // 중첩 함수 내부는 새로운 nesting 시작
        ts.forEachChild(node, (child) => visit(child, nestingLevel + 1, false));
        return;
      }

      case ts.SyntaxKind.CallExpression: {
        // 재귀 호출 감지
        const call = node as ts.CallExpression;
        if (
          currentFunctionName &&
          ts.isIdentifier(call.expression) &&
          call.expression.text === currentFunctionName
        ) {
          addDetail(node, 'recursion', 1, 0, '재귀 호출');
        }
        break;
      }

      default:
        break;
    }

    ts.forEachChild(node, (child) => visit(child, nestingLevel, inLogicalSequence));
  }

  visit(node, 0, false);

  return { complexity, details };
}

/**
 * 함수 노드에서 인지복잡도 계산
 */
export function analyzeFunctionCognitive(
  functionNode: ts.Node,
  sourceFile: ts.SourceFile,
  functionInfo: FunctionInfo
): ComplexityResult {
  const { complexity, details } = calculateCognitiveComplexity(
    functionNode,
    sourceFile,
    functionInfo.name !== '<anonymous>' ? functionInfo.name : undefined
  );

  return {
    function: functionInfo,
    cyclomatic: 0, // cyclomatic.ts에서 별도 계산
    cognitive: complexity,
    details,
  };
}

/**
 * 소스 파일의 모든 함수에 대한 인지복잡도 계산
 */
export function analyzeFileCognitive(
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
      const result = analyzeFunctionCognitive(node, sourceFile, functionInfo);
      results.push(result);
    }

    // 자식 노드 순회 - 중첩 함수는 별도로 분석하지 않음 (상위 함수에 포함)
    // 최상위 레벨 함수만 독립적으로 분석
  }

  ts.forEachChild(sourceFile, (node) => visit(node));
  return results;
}
