/**
 * 차원 기반 복잡도 분석 (Dimensional Complexity)
 *
 * 1D: 제어 흐름 (순환복잡도 기반) - cyclomatic.ts
 * 2D: 중첩 (인지복잡도 기반) - cognitive.ts
 * 3D: 상태 복잡도 - 이 파일
 * 4D: 비동기 복잡도 - 이 파일
 * 5D: 숨은 결합 복잡도 - 이 파일
 */

import * as ts from 'typescript';
import type {
  SourceLocation,
  StateComplexity,
  AsyncComplexity,
  CouplingComplexity,
  ImplicitIOInfo,
  DimensionalComplexity,
  DimensionalWeights,
  DimensionalHotspot,
} from '../types.js';

// ─────────────────────────────────────────────────────────────────
// 유틸리티 함수
// ─────────────────────────────────────────────────────────────────

function getLocation(node: ts.Node, sourceFile: ts.SourceFile): SourceLocation {
  const { line: startLine, character: startColumn } =
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const { line: endLine, character: endColumn } =
    sourceFile.getLineAndCharacterOfPosition(node.getEnd());
  return {
    filePath: sourceFile.fileName,
    startLine: startLine + 1,
    startColumn: startColumn + 1,
    endLine: endLine + 1,
    endColumn: endColumn + 1,
  };
}

// ─────────────────────────────────────────────────────────────────
// 3D: 상태 복잡도 분석
// ─────────────────────────────────────────────────────────────────

/**
 * 상태 복잡도 분석
 */
export function analyzeStateComplexity(
  node: ts.Node,
  sourceFile: ts.SourceFile
): StateComplexity {
  const result: StateComplexity = {
    enumStates: 0,
    stateMutations: 0,
    stateReads: 0,
    stateBranches: 0,
    stateMachinePatterns: [],
  };

  // 상태 관련 변수 이름 패턴
  const statePatterns = /^(state|status|mode|phase|step|stage|flag|is[A-Z]|has[A-Z]|can[A-Z])/;
  const stateVariables = new Set<string>();

  function visit(n: ts.Node): void {
    // 변수 선언에서 상태 변수 탐지
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) {
      const name = n.name.text;
      if (statePatterns.test(name)) {
        stateVariables.add(name);
      }
      // useState, useReducer 패턴
      if (n.initializer && ts.isCallExpression(n.initializer)) {
        const callText = n.initializer.expression.getText(sourceFile);
        if (callText === 'useState' || callText === 'useReducer') {
          stateVariables.add(name);
          result.enumStates++;
        }
      }
    }

    // 상태 변경 탐지 (할당)
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      if (ts.isIdentifier(n.left)) {
        const name = n.left.text;
        if (stateVariables.has(name) || statePatterns.test(name)) {
          result.stateMutations++;
        }
      }
      // setter 함수 호출 (setXxx)
      if (ts.isCallExpression(n.right)) {
        const callText = n.right.expression.getText(sourceFile);
        if (/^set[A-Z]/.test(callText)) {
          result.stateMutations++;
        }
      }
    }

    // setter 함수 호출
    if (ts.isCallExpression(n)) {
      const callText = n.expression.getText(sourceFile);
      if (/^set[A-Z]/.test(callText)) {
        result.stateMutations++;
      }
    }

    // 상태 읽기 탐지
    if (ts.isIdentifier(n) && !ts.isVariableDeclaration(n.parent)) {
      const name = n.text;
      if (stateVariables.has(name) || statePatterns.test(name)) {
        // 할당 대상이 아닌 경우만
        if (!ts.isBinaryExpression(n.parent) ||
            n.parent.left !== n ||
            n.parent.operatorToken.kind !== ts.SyntaxKind.EqualsToken) {
          result.stateReads++;
        }
      }
    }

    // 상태 기반 분기 (switch on state)
    if (ts.isSwitchStatement(n)) {
      const expr = n.expression.getText(sourceFile);
      if (statePatterns.test(expr) || stateVariables.has(expr)) {
        result.stateBranches++;
        result.stateMachinePatterns.push({
          kind: 'switch-enum',
          location: getLocation(n, sourceFile),
          stateCount: n.caseBlock.clauses.length,
          transitionCount: countTransitionsInSwitch(n, sourceFile),
        });
      }
    }

    // if 문에서 상태 체크
    if (ts.isIfStatement(n)) {
      const condText = n.expression.getText(sourceFile);
      if (statePatterns.test(condText)) {
        result.stateBranches++;
      }
    }

    ts.forEachChild(n, visit);
  }

  visit(node);
  return result;
}

function countTransitionsInSwitch(node: ts.SwitchStatement, sourceFile: ts.SourceFile): number {
  let transitions = 0;
  const stateSetterPattern = /^set[A-Z]/;

  function visitCase(clause: ts.CaseOrDefaultClause): void {
    clause.statements.forEach((stmt) => {
      const stmtText = stmt.getText(sourceFile);
      if (stateSetterPattern.test(stmtText)) {
        transitions++;
      }
    });
  }

  node.caseBlock.clauses.forEach(visitCase);
  return transitions;
}

// ─────────────────────────────────────────────────────────────────
// 4D: 비동기 복잡도 분석
// ─────────────────────────────────────────────────────────────────

/**
 * 비동기 복잡도 분석
 */
export function analyzeAsyncComplexity(
  node: ts.Node,
  sourceFile: ts.SourceFile
): AsyncComplexity {
  const result: AsyncComplexity = {
    asyncBoundaries: 0,
    promiseChains: 0,
    retryPatterns: 0,
    timeouts: 0,
    callbackDepth: 0,
    concurrencyPatterns: [],
    asyncErrorBoundaries: 0,
  };

  let maxCallbackDepth = 0;

  function visit(n: ts.Node, callbackLevel: number = 0): void {
    // async 함수
    if (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) ||
        ts.isArrowFunction(n) || ts.isMethodDeclaration(n)) {
      const modifiers = ts.canHaveModifiers(n) ? ts.getModifiers(n) : undefined;
      if (modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword)) {
        result.asyncBoundaries++;
      }
    }

    // await 표현식
    if (ts.isAwaitExpression(n)) {
      result.asyncBoundaries++;
    }

    // Promise 체인 (.then, .catch, .finally)
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const propName = n.expression.name.text;
      if (propName === 'then' || propName === 'catch' || propName === 'finally') {
        result.promiseChains++;
      }
    }

    // 동시성 패턴 (Promise.all, Promise.race, Promise.allSettled)
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const objText = n.expression.expression.getText(sourceFile);
      const propName = n.expression.name.text;

      if (objText === 'Promise') {
        if (propName === 'all' || propName === 'allSettled') {
          const promiseCount = countPromisesInArray(n.arguments[0]);
          result.concurrencyPatterns.push({
            kind: 'parallel',
            location: getLocation(n, sourceFile),
            promiseCount,
          });
        } else if (propName === 'race') {
          const promiseCount = countPromisesInArray(n.arguments[0]);
          result.concurrencyPatterns.push({
            kind: 'race',
            location: getLocation(n, sourceFile),
            promiseCount,
          });
        }
      }
    }

    // 타임아웃/인터벌
    if (ts.isCallExpression(n)) {
      const callText = n.expression.getText(sourceFile);
      if (callText === 'setTimeout' || callText === 'setInterval' ||
          callText === 'requestAnimationFrame') {
        result.timeouts++;
      }
    }

    // 재시도 패턴 탐지
    if (ts.isCallExpression(n)) {
      const callText = n.expression.getText(sourceFile);
      if (/retry|backoff|attempt/i.test(callText)) {
        result.retryPatterns++;
      }
    }

    // 콜백 깊이 추적
    if (ts.isCallExpression(n)) {
      n.arguments.forEach((arg) => {
        if (ts.isFunctionExpression(arg) || ts.isArrowFunction(arg)) {
          const newLevel = callbackLevel + 1;
          maxCallbackDepth = Math.max(maxCallbackDepth, newLevel);
          ts.forEachChild(arg, (child) => visit(child, newLevel));
        } else {
          visit(arg, callbackLevel);
        }
      });
      visit(n.expression, callbackLevel);
      return; // 이미 자식들을 처리함
    }

    // async 함수 내 try-catch
    if (ts.isTryStatement(n)) {
      // 부모가 async 함수인지 확인
      let parent = n.parent;
      while (parent) {
        if (ts.isFunctionDeclaration(parent) || ts.isFunctionExpression(parent) ||
            ts.isArrowFunction(parent) || ts.isMethodDeclaration(parent)) {
          const modifiers = ts.canHaveModifiers(parent) ? ts.getModifiers(parent) : undefined;
          if (modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword)) {
            result.asyncErrorBoundaries++;
          }
          break;
        }
        parent = parent.parent;
      }
    }

    ts.forEachChild(n, (child) => visit(child, callbackLevel));
  }

  visit(node);
  result.callbackDepth = maxCallbackDepth;
  return result;
}

function countPromisesInArray(node: ts.Node | undefined): number {
  if (!node) return 0;
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.length;
  }
  return 1; // 동적 배열일 경우
}

// ─────────────────────────────────────────────────────────────────
// 5D: 숨은 결합 복잡도 분석
// ─────────────────────────────────────────────────────────────────

// 잘 알려진 전역 객체들
const GLOBAL_OBJECTS = new Set([
  'window', 'document', 'navigator', 'location', 'history',
  'console', 'localStorage', 'sessionStorage', 'fetch',
  'XMLHttpRequest', 'WebSocket', 'Worker', 'process',
  'global', 'globalThis', 'self',
]);

// 암묵적 I/O API
const IO_APIS: Record<string, ImplicitIOInfo['kind']> = {
  'console.log': 'console',
  'console.error': 'console',
  'console.warn': 'console',
  'console.info': 'console',
  'console.debug': 'console',
  'fetch': 'fetch',
  'XMLHttpRequest': 'network',
  'WebSocket': 'network',
  'localStorage.getItem': 'storage',
  'localStorage.setItem': 'storage',
  'sessionStorage.getItem': 'storage',
  'sessionStorage.setItem': 'storage',
  'document.getElementById': 'dom',
  'document.querySelector': 'dom',
  'document.querySelectorAll': 'dom',
  'document.createElement': 'dom',
};

/**
 * 숨은 결합 복잡도 분석
 */
export function analyzeCouplingComplexity(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  scopeVariables: Set<string> = new Set()
): CouplingComplexity {
  const result: CouplingComplexity = {
    globalAccess: [],
    implicitIO: [],
    sideEffects: [],
    envDependency: [],
    closureCaptures: [],
  };

  // 현재 스코프의 변수들 수집
  const localVariables = new Set(scopeVariables);

  function collectLocalVariables(n: ts.Node): void {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) {
      localVariables.add(n.name.text);
    }
    if (ts.isParameter(n) && ts.isIdentifier(n.name)) {
      localVariables.add(n.name.text);
    }
    if (ts.isFunctionDeclaration(n) && n.name) {
      localVariables.add(n.name.text);
    }
  }

  function visit(n: ts.Node): void {
    collectLocalVariables(n);

    // 전역 객체 접근
    if (ts.isIdentifier(n) && GLOBAL_OBJECTS.has(n.text)) {
      // 부모가 프로퍼티 접근이거나 호출인 경우
      if (!localVariables.has(n.text)) {
        const isWrite = isWriteAccess(n);
        result.globalAccess.push({
          name: n.text,
          kind: 'global',
          location: getLocation(n, sourceFile),
          isWrite,
        });
      }
    }

    // 암묵적 I/O
    if (ts.isCallExpression(n)) {
      const callText = n.expression.getText(sourceFile);
      for (const [api, kind] of Object.entries(IO_APIS)) {
        if (callText.startsWith(api.split('.')[0]) && callText.includes(api.split('.')[1] || '')) {
          result.implicitIO.push({
            kind,
            location: getLocation(n, sourceFile),
            api: callText,
          });
          break;
        }
      }

      // fetch, XMLHttpRequest 직접 호출
      if (callText === 'fetch') {
        result.implicitIO.push({
          kind: 'fetch',
          location: getLocation(n, sourceFile),
          api: 'fetch',
        });
      }
    }

    // 환경 의존성
    if (ts.isPropertyAccessExpression(n)) {
      const objText = n.expression.getText(sourceFile);
      const propName = n.name.text;

      if (objText === 'process' && propName === 'env') {
        result.envDependency.push({
          kind: 'process-env',
          location: getLocation(n, sourceFile),
          property: 'env',
        });
      }
      if (objText === 'window') {
        result.envDependency.push({
          kind: 'window',
          location: getLocation(n, sourceFile),
          property: propName,
        });
      }
      if (objText === 'document') {
        result.envDependency.push({
          kind: 'document',
          location: getLocation(n, sourceFile),
          property: propName,
        });
      }
    }

    // 부작용 탐지
    if (ts.isCallExpression(n)) {
      const callText = n.expression.getText(sourceFile);

      // 이벤트 등록
      if (callText.includes('addEventListener') || callText.includes('on')) {
        result.sideEffects.push({
          kind: 'event',
          location: getLocation(n, sourceFile),
          target: callText,
          description: 'Event listener registration',
        });
      }

      // 구독 패턴
      if (callText.includes('subscribe') || callText.includes('observe')) {
        result.sideEffects.push({
          kind: 'subscription',
          location: getLocation(n, sourceFile),
          target: callText,
          description: 'Subscription pattern',
        });
      }

      // 타이머
      if (callText === 'setTimeout' || callText === 'setInterval') {
        result.sideEffects.push({
          kind: 'timer',
          location: getLocation(n, sourceFile),
          target: callText,
          description: 'Timer side effect',
        });
      }
    }

    // 클로저 캡처 탐지 (함수 내부에서 외부 변수 참조)
    if ((ts.isFunctionExpression(n) || ts.isArrowFunction(n)) && n.body) {
      const functionLocalVars = new Set<string>();
      // 파라미터 수집
      n.parameters.forEach((p) => {
        if (ts.isIdentifier(p.name)) {
          functionLocalVars.add(p.name.text);
        }
      });

      const captureCheck = (inner: ts.Node): void => {
        if (ts.isVariableDeclaration(inner) && ts.isIdentifier(inner.name)) {
          functionLocalVars.add(inner.name.text);
        }
        if (ts.isIdentifier(inner) &&
            localVariables.has(inner.text) &&
            !functionLocalVars.has(inner.text) &&
            !GLOBAL_OBJECTS.has(inner.text)) {
          result.closureCaptures.push({
            variableName: inner.text,
            location: getLocation(inner, sourceFile),
            capturedAt: getLocation(n, sourceFile),
            isMutable: isVariableMutable(inner.text, node),
          });
        }
        ts.forEachChild(inner, captureCheck);
      };

      ts.forEachChild(n.body, captureCheck);
    }

    ts.forEachChild(n, visit);
  }

  visit(node);
  return result;
}

function isWriteAccess(node: ts.Node): boolean {
  const parent = node.parent;
  if (ts.isBinaryExpression(parent)) {
    return parent.left === node &&
           parent.operatorToken.kind === ts.SyntaxKind.EqualsToken;
  }
  return false;
}

function isVariableMutable(name: string, scope: ts.Node): boolean {
  let isMutable = false;

  function check(n: ts.Node): void {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name) {
      const parent = n.parent;
      if (ts.isVariableDeclarationList(parent)) {
        isMutable = !(parent.flags & ts.NodeFlags.Const);
      }
    }
    ts.forEachChild(n, check);
  }

  check(scope);
  return isMutable;
}

// ─────────────────────────────────────────────────────────────────
// 종합 차원 복잡도 계산
// ─────────────────────────────────────────────────────────────────

/**
 * 기본 가중치
 */
export const DEFAULT_WEIGHTS: DimensionalWeights = {
  control: 1.0,
  nesting: 1.5,
  state: 2.0,
  async: 2.5,
  coupling: 3.0,
};

/**
 * 상태 복잡도를 스칼라 점수로 변환
 */
function scoreStateComplexity(state: StateComplexity): number {
  return (
    state.enumStates * 1 +
    state.stateMutations * 2 +
    state.stateReads * 0.5 +
    state.stateBranches * 3 +
    state.stateMachinePatterns.length * 5
  );
}

/**
 * 비동기 복잡도를 스칼라 점수로 변환
 */
function scoreAsyncComplexity(async: AsyncComplexity): number {
  return (
    async.asyncBoundaries * 1 +
    async.promiseChains * 2 +
    async.retryPatterns * 3 +
    async.timeouts * 2 +
    async.callbackDepth * 3 +
    async.concurrencyPatterns.length * 4 +
    async.asyncErrorBoundaries * 1
  );
}

/**
 * 결합 복잡도를 스칼라 점수로 변환
 *
 * v0.0.8: console 출력은 낮은 가중치 (디버깅/로깅 목적, 실제 결합도 낮음)
 */
function scoreCouplingComplexity(coupling: CouplingComplexity): number {
  // console.log 등 출력 함수는 낮은 가중치 (실제 복잡도 기여 낮음)
  const consoleIO = coupling.implicitIO.filter((io) => io.kind === 'console').length;
  const otherIO = coupling.implicitIO.filter((io) => io.kind !== 'console').length;

  return (
    coupling.globalAccess.length * 2 +
    consoleIO * 0.5 + // console은 낮은 가중치
    otherIO * 2 + // 다른 I/O는 기존 가중치
    coupling.sideEffects.length * 3 +
    coupling.envDependency.length * 2 +
    coupling.closureCaptures.length * 1
  );
}

/**
 * 차원 기반 복잡도 전체 분석
 */
export function analyzeDimensionalComplexity(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  cyclomatic: number,
  nestingPenalty: number,
  weights: DimensionalWeights = DEFAULT_WEIGHTS
): DimensionalComplexity {
  // 각 차원 분석
  const state = analyzeStateComplexity(node, sourceFile);
  const async = analyzeAsyncComplexity(node, sourceFile);
  const coupling = analyzeCouplingComplexity(node, sourceFile);

  // 스칼라 점수 계산
  const stateScore = scoreStateComplexity(state);
  const asyncScore = scoreAsyncComplexity(async);
  const couplingScore = scoreCouplingComplexity(coupling);

  // 가중 합산
  const controlWeighted = cyclomatic * weights.control;
  const nestingWeighted = nestingPenalty * weights.nesting;
  const stateWeighted = stateScore * weights.state;
  const asyncWeighted = asyncScore * weights.async;
  const couplingWeighted = couplingScore * weights.coupling;

  const totalWeighted = controlWeighted + nestingWeighted + stateWeighted + asyncWeighted + couplingWeighted;

  // 기여도 계산 (0-1)
  const contributions = {
    control: totalWeighted > 0 ? controlWeighted / totalWeighted : 0,
    nesting: totalWeighted > 0 ? nestingWeighted / totalWeighted : 0,
    state: totalWeighted > 0 ? stateWeighted / totalWeighted : 0,
    async: totalWeighted > 0 ? asyncWeighted / totalWeighted : 0,
    coupling: totalWeighted > 0 ? couplingWeighted / totalWeighted : 0,
  };

  // 핫스팟 생성
  const hotspots: DimensionalHotspot[] = [];

  // 각 차원에서 가장 기여도 높은 항목 추출
  const dimensionScores: Array<{
    dimension: DimensionalHotspot['dimension'];
    score: number;
    reason: string;
  }> = [
    { dimension: '1D-control', score: controlWeighted, reason: `${cyclomatic} branch points` },
    { dimension: '2D-nesting', score: nestingWeighted, reason: `${nestingPenalty} nesting penalty` },
    { dimension: '3D-state', score: stateWeighted, reason: `${state.stateMutations} mutations, ${state.stateBranches} state branches` },
    { dimension: '4D-async', score: asyncWeighted, reason: `${async.asyncBoundaries} async boundaries, ${async.promiseChains} chains` },
    { dimension: '5D-coupling', score: couplingWeighted, reason: `${coupling.globalAccess.length} global, ${coupling.sideEffects.length} side effects` },
  ];

  // 상위 3개
  dimensionScores.sort((a, b) => b.score - a.score);
  for (let i = 0; i < 3 && i < dimensionScores.length; i++) {
    if (dimensionScores[i].score > 0) {
      hotspots.push({
        dimension: dimensionScores[i].dimension,
        score: dimensionScores[i].score,
        location: getLocation(node, sourceFile),
        reason: dimensionScores[i].reason,
      });
    }
  }

  return {
    control: cyclomatic,
    nesting: nestingPenalty,
    state,
    async,
    coupling,
    weighted: Math.round(totalWeighted * 10) / 10,
    weights,
    contributions,
    hotspots,
  };
}