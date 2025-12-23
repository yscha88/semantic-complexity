import ts from 'typescript';
import type { CallNode, CallEdge, FunctionInfo } from '../types.js';
import { getSourceLocation, extractFunctionInfo } from '../ast/parser.js';

/**
 * 호출 그래프 빌더
 */
export class CallGraph {
  private nodes: Map<string, CallNode> = new Map();
  private functionMap: Map<string, FunctionInfo> = new Map();

  /**
   * 소스 파일에서 호출 그래프 구축
   */
  analyzeSourceFile(sourceFile: ts.SourceFile): void {
    // 1단계: 모든 함수 정보 수집
    this.collectFunctions(sourceFile);

    // 2단계: 호출 관계 분석
    this.analyzeCalls(sourceFile);
  }

  /**
   * 함수 노드 조회
   */
  getNode(functionKey: string): CallNode | undefined {
    return this.nodes.get(functionKey);
  }

  /**
   * 모든 노드 반환
   */
  getAllNodes(): CallNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * 특정 함수가 호출하는 함수들
   */
  getCallees(functionKey: string): CallEdge[] {
    return this.nodes.get(functionKey)?.calls ?? [];
  }

  /**
   * 특정 함수를 호출하는 함수들
   */
  getCallers(functionKey: string): CallEdge[] {
    return this.nodes.get(functionKey)?.calledBy ?? [];
  }

  /**
   * 호출 체인 추적 (특정 함수에서 시작하여 호출되는 모든 함수)
   */
  traceCallChain(functionKey: string, maxDepth = 10): Map<string, number> {
    const result = new Map<string, number>();
    const visited = new Set<string>();

    const traverse = (key: string, depth: number) => {
      if (depth > maxDepth || visited.has(key)) return;
      visited.add(key);
      result.set(key, depth);

      const node = this.nodes.get(key);
      if (!node) return;

      for (const edge of node.calls) {
        const calleeKey = this.getFunctionKey(edge.to);
        traverse(calleeKey, depth + 1);
      }
    };

    traverse(functionKey, 0);
    return result;
  }

  /**
   * 재귀 호출 탐지
   */
  findRecursiveCalls(): FunctionInfo[] {
    const recursive: FunctionInfo[] = [];

    for (const [key, node] of this.nodes) {
      // 직접 재귀
      const directRecursion = node.calls.some(
        (edge) => this.getFunctionKey(edge.to) === key
      );
      if (directRecursion) {
        recursive.push(node.function);
        continue;
      }

      // 간접 재귀 (자기 자신이 호출 체인에 있는지)
      const chain = this.traceCallChain(key, 20);
      const indirectRecursion = node.calls.some((edge) => {
        const calleeKey = this.getFunctionKey(edge.to);
        return chain.has(calleeKey) && calleeKey !== key;
      });

      if (indirectRecursion) {
        recursive.push(node.function);
      }
    }

    return recursive;
  }

  /**
   * 함수 복잡도 영향도 계산
   * (이 함수가 변경되면 영향받는 함수의 수)
   */
  calculateImpact(functionKey: string): number {
    const visited = new Set<string>();

    const countCallers = (key: string): number => {
      if (visited.has(key)) return 0;
      visited.add(key);

      const node = this.nodes.get(key);
      if (!node) return 0;

      let count = node.calledBy.length;
      for (const edge of node.calledBy) {
        const callerKey = this.getFunctionKey(edge.from);
        count += countCallers(callerKey);
      }

      return count;
    };

    return countCallers(functionKey);
  }

  // ─── Private Methods ───────────────────────────────────────────

  /**
   * 함수 고유 키 생성
   */
  private getFunctionKey(func: FunctionInfo): string {
    const prefix = func.className ? `${func.className}.` : '';
    return `${func.location.filePath}:${prefix}${func.name}:${func.location.startLine}`;
  }

  /**
   * 모든 함수 정보 수집
   */
  private collectFunctions(sourceFile: ts.SourceFile): void {
    const visit = (node: ts.Node, className?: string) => {
      // 클래스 처리
      if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
        const name = node.name?.getText(sourceFile) ?? '<anonymous>';
        node.members.forEach((member) => visit(member, name));
        return;
      }

      // 함수 정보 추출
      const funcInfo = extractFunctionInfo(node, sourceFile, className);
      if (funcInfo) {
        const key = this.getFunctionKey(funcInfo);
        this.functionMap.set(funcInfo.name, funcInfo);
        this.nodes.set(key, {
          function: funcInfo,
          calls: [],
          calledBy: [],
        });
      }

      ts.forEachChild(node, (child) => visit(child, className));
    };

    visit(sourceFile);
  }

  /**
   * 호출 관계 분석
   */
  private analyzeCalls(sourceFile: ts.SourceFile): void {
    const visit = (
      node: ts.Node,
      currentFunction: FunctionInfo | null,
      inConditional: boolean,
      isAsync: boolean
    ) => {
      // 함수 컨텍스트 업데이트
      if (
        ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node)
      ) {
        const funcInfo = extractFunctionInfo(node, sourceFile);
        if (funcInfo) {
          const asyncContext = funcInfo.isAsync || isAsync;
          ts.forEachChild(node, (child) =>
            visit(child, funcInfo, false, asyncContext)
          );
          return;
        }
      }

      // 조건부 컨텍스트 추적
      const conditional =
        inConditional ||
        ts.isIfStatement(node) ||
        ts.isConditionalExpression(node) ||
        ts.isSwitchStatement(node);

      // 호출 표현식 분석
      if (ts.isCallExpression(node) && currentFunction) {
        this.processCallExpression(
          node,
          sourceFile,
          currentFunction,
          conditional,
          isAsync
        );
      }

      // await 표현식은 async 컨텍스트로 표시
      if (ts.isAwaitExpression(node)) {
        ts.forEachChild(node, (child) =>
          visit(child, currentFunction, conditional, true)
        );
        return;
      }

      ts.forEachChild(node, (child) =>
        visit(child, currentFunction, conditional, isAsync)
      );
    };

    // 최상위 레벨 함수부터 분석
    ts.forEachChild(sourceFile, (node) => visit(node, null, false, false));
  }

  /**
   * 호출 표현식 처리
   */
  private processCallExpression(
    node: ts.CallExpression,
    sourceFile: ts.SourceFile,
    caller: FunctionInfo,
    isConditional: boolean,
    isAsync: boolean
  ): void {
    let calleeName: string | null = null;

    // 호출 대상 이름 추출
    if (ts.isIdentifier(node.expression)) {
      calleeName = node.expression.text;
    } else if (ts.isPropertyAccessExpression(node.expression)) {
      calleeName = node.expression.name.text;
    }

    if (!calleeName) return;

    // 호출 대상 함수 찾기
    const callee = this.functionMap.get(calleeName);
    if (!callee) return;

    const callerKey = this.getFunctionKey(caller);
    const calleeKey = this.getFunctionKey(callee);

    const callerNode = this.nodes.get(callerKey);
    const calleeNode = this.nodes.get(calleeKey);

    if (!callerNode || !calleeNode) return;

    const edge: CallEdge = {
      from: caller,
      to: callee,
      location: getSourceLocation(node, sourceFile),
      isConditional,
      isAsync,
    };

    // 중복 방지
    const isDuplicate = callerNode.calls.some(
      (e) =>
        this.getFunctionKey(e.to) === calleeKey &&
        e.location.startLine === edge.location.startLine
    );

    if (!isDuplicate) {
      callerNode.calls.push(edge);
      calleeNode.calledBy.push(edge);
    }
  }
}

/**
 * 호출 그래프를 Mermaid 형식으로 출력 (시각화용)
 */
export function exportToMermaid(graph: CallGraph): string {
  const lines = ['flowchart TD'];

  for (const node of graph.getAllNodes()) {
    const shortName = node.function.className
      ? `${node.function.className}_${node.function.name}`
      : node.function.name;

    for (const edge of node.calls) {
      const targetName = edge.to.className
        ? `${edge.to.className}_${edge.to.name}`
        : edge.to.name;

      const style = edge.isAsync ? '-.->' : '-->';
      const label = edge.isConditional ? '|conditional|' : '';
      lines.push(`  ${shortName} ${style}${label} ${targetName}`);
    }
  }

  return lines.join('\n');
}
