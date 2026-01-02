/**
 * 🧀 Cheese Analyzer - Cognitive Accessibility (TypeScript)
 *
 * 인지 가능 조건 (4가지 모두 충족):
 * 1. 중첩 깊이 ≤ 4
 * 2. 개념 수 ≤ 9/함수 (Miller's Law: 7±2)
 * 3. 숨겨진 의존성 ≤ 2
 * 4. state×async×retry 2개 이상 공존 금지
 *
 * TypeScript 전용 복잡도 분석:
 * - 제네릭 복잡도 (타입 파라미터 수, constraints, nested)
 * - 유니온/인터섹션 타입 복잡도
 * - 조건부 타입 복잡도
 * - 매핑 타입 복잡도
 * - 타입 가드 복잡도
 * - 데코레이터 스택 복잡도
 *
 * Anti-pattern Penalty (TypeScript):
 * - Rest parameters (...args) → +3 개념
 * - Object spread for config bundling → +3 개념
 * - Complex generics (>3 params or nested) → +2 per level
 * - Deep union types (>4 members) → +1 per extra
 * - Conditional type chains → +2 per level
 */

import ts from 'typescript';

// =============================================================
// Essential Complexity Waiver
// =============================================================

// @ts-ignore: Waiver declaration for gate system - parsed at runtime
const __essential_complexity__ = {
  adr: '../../docs/adr/001-ast-analyzer-complexity.md',
  nesting: 7,
  concepts: { total: 26 },
  reason: 'AST Visitor 패턴 - 본질적 복잡도',
};

// =============================================================
// Types
// =============================================================

export interface CheeseResult {
  accessible: boolean;
  reason: string;
  violations: string[];

  maxNesting: number;
  adjustedNesting: number;       // 프레임워크 보정 후
  functions: FunctionInfo[];
  hiddenDependencies: number;
  stateAsyncRetry: StateAsyncRetry;
  config: CognitiveConfig;

  // TypeScript 전용 복잡도
  typeComplexity: TypeComplexity;

  // 프레임워크 보정
  frameworkInfo: FrameworkInfo;
}

export interface FrameworkInfo {
  detected: FrameworkType;
  config: FrameworkConfig;
  jsxNestingDepth: number;       // JSX만의 중첩
  logicNestingDepth: number;     // 로직만의 중첩
  hookCount: number;             // Hook/Composition API 사용 수
  chainCount: number;            // 체이닝 메서드 수
  adjustments: FrameworkAdjustment[];
}

export interface FrameworkAdjustment {
  type: 'jsx_nesting' | 'hook' | 'chain' | 'props';
  original: number;
  adjusted: number;
  reason: string;
}

export interface TypeComplexity {
  generics: GenericComplexity;
  unions: UnionComplexity;
  conditionalTypes: number;      // 조건부 타입 개수
  mappedTypes: number;           // 매핑 타입 개수
  typeGuards: number;            // 타입 가드 개수
  decoratorStacks: number;       // 데코레이터 스택 (3개 이상 연속)
  totalPenalty: number;          // 총 페널티
}

export interface GenericComplexity {
  count: number;                 // 제네릭 선언 수
  maxParams: number;             // 최대 타입 파라미터 수
  maxDepth: number;              // 최대 중첩 깊이
  constrainedCount: number;      // constraint 있는 제네릭 수
  penalty: number;
}

export interface UnionComplexity {
  count: number;                 // 유니온 타입 수
  maxMembers: number;            // 최대 멤버 수
  intersectionCount: number;     // 인터섹션 타입 수
  penalty: number;
}

export interface FunctionInfo {
  name: string;
  line: number;
  conceptCount: number;       // penalty 포함 최종
  rawConceptCount: number;    // penalty 미포함
  concepts: string[];
  antiPatterns: AntiPatternPenalty[];
}

export interface StateAsyncRetry {
  hasState: boolean;
  hasAsync: boolean;
  hasRetry: boolean;
  axes: string[];
  count: number;
  violated: boolean;
}

export interface AntiPatternPenalty {
  pattern: string;
  penalty: number;
  reason: string;
}

export interface CognitiveConfig {
  nestingThreshold: number;
  conceptsPerFunction: number;
  hiddenDepThreshold: number;
  framework?: FrameworkType;
}

// =============================================================
// Framework Configuration
// =============================================================

export type FrameworkType = 'react' | 'vue' | 'angular' | 'svelte' | 'none';

export interface FrameworkConfig {
  name: FrameworkType;
  jsxNestingWeight: number;      // JSX/템플릿 중첩 가중치
  hookConceptWeight: number;     // Hook/Composition API 개념 가중치
  chainMethodWeight: number;     // 체이닝 메서드 가중치
  propsDestructureWeight: number; // props destructuring 가중치
}

const FRAMEWORK_CONFIGS: Record<FrameworkType, FrameworkConfig> = {
  react: {
    name: 'react',
    jsxNestingWeight: 0.3,
    hookConceptWeight: 0.5,
    chainMethodWeight: 0.5,
    propsDestructureWeight: 0.3,
  },
  vue: {
    name: 'vue',
    jsxNestingWeight: 0.3,
    hookConceptWeight: 0.5,  // Composition API
    chainMethodWeight: 0.5,
    propsDestructureWeight: 0.3,
  },
  angular: {
    name: 'angular',
    jsxNestingWeight: 0.4,
    hookConceptWeight: 0.7,
    chainMethodWeight: 0.5,
    propsDestructureWeight: 0.5,
  },
  svelte: {
    name: 'svelte',
    jsxNestingWeight: 0.3,
    hookConceptWeight: 0.5,
    chainMethodWeight: 0.5,
    propsDestructureWeight: 0.3,
  },
  none: {
    name: 'none',
    jsxNestingWeight: 1.0,
    hookConceptWeight: 1.0,
    chainMethodWeight: 1.0,
    propsDestructureWeight: 1.0,
  },
};

// Hook/Composition API 패턴
const HOOK_PATTERNS: Record<FrameworkType, RegExp[]> = {
  react: [
    /\buse[A-Z]\w*\s*\(/,  // useState, useEffect, useCustomHook
    /\buseState\b/,
    /\buseEffect\b/,
    /\buseCallback\b/,
    /\buseMemo\b/,
    /\buseRef\b/,
    /\buseContext\b/,
    /\buseReducer\b/,
  ],
  vue: [
    /\bref\s*\(/,
    /\breactive\s*\(/,
    /\bcomputed\s*\(/,
    /\bwatch\s*\(/,
    /\bwatchEffect\s*\(/,
    /\bonMounted\s*\(/,
    /\bonUnmounted\s*\(/,
  ],
  angular: [
    /\b@Input\s*\(/,
    /\b@Output\s*\(/,
    /\b@ViewChild\s*\(/,
    /\bngOnInit\b/,
  ],
  svelte: [
    /\$:\s*/,  // reactive statements
    /\bonMount\s*\(/,
    /\bonDestroy\s*\(/,
  ],
  none: [],
};

// 체이닝 메서드 패턴
const CHAIN_METHOD_PATTERNS = [
  /\.map\s*\(/,
  /\.filter\s*\(/,
  /\.reduce\s*\(/,
  /\.find\s*\(/,
  /\.findIndex\s*\(/,
  /\.some\s*\(/,
  /\.every\s*\(/,
  /\.flatMap\s*\(/,
  /\.forEach\s*\(/,
];

// =============================================================
// Default Config
// =============================================================

const DEFAULT_CONFIG: CognitiveConfig = {
  nestingThreshold: 4,
  conceptsPerFunction: 9,  // Miller's Law: 7±2
  hiddenDepThreshold: 2,
};

// Anti-pattern penalties
const REST_PARAMS_PENALTY = 3;
const SPREAD_CONFIG_PENALTY = 3;

// TypeScript 타입 시스템 페널티
const GENERIC_PARAMS_THRESHOLD = 3;      // 3개 초과 시 페널티
const GENERIC_PARAMS_PENALTY = 2;        // 초과당 +2
const GENERIC_DEPTH_THRESHOLD = 2;       // 중첩 2 초과 시 페널티
const GENERIC_DEPTH_PENALTY = 2;         // 레벨당 +2
const GENERIC_CONSTRAINT_PENALTY = 1;    // constraint당 +1

const UNION_MEMBERS_THRESHOLD = 4;       // 4개 초과 시 페널티
const UNION_MEMBERS_PENALTY = 1;         // 초과당 +1
const INTERSECTION_PENALTY = 1;          // 인터섹션당 +1

const CONDITIONAL_TYPE_PENALTY = 2;      // 조건부 타입당 +2
const MAPPED_TYPE_PENALTY = 2;           // 매핑 타입당 +2
const TYPE_GUARD_PENALTY = 1;            // 타입 가드당 +1
const DECORATOR_STACK_THRESHOLD = 3;     // 3개 이상 연속 시 페널티
const DECORATOR_STACK_PENALTY = 2;       // 스택당 +2

// Built-in functions (low cognitive load)
const BUILTIN_FUNCTIONS = new Set([
  'parseInt', 'parseFloat', 'String', 'Number', 'Boolean',
  'Array', 'Object', 'JSON', 'Math', 'Date', 'Promise',
  'console', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'encodeURI', 'decodeURI', 'encodeURIComponent', 'decodeURIComponent',
]);

// =============================================================
// Main Analyzer
// =============================================================

export function analyzeCheese(
  source: string,
  config: CognitiveConfig = DEFAULT_CONFIG
): CheeseResult {
  const sourceFile = ts.createSourceFile(
    'temp.ts',
    source,
    ts.ScriptTarget.Latest,
    true
  );

  // 프레임워크 감지 및 보정
  const frameworkType = config.framework || detectFramework(source);
  const frameworkConfig = FRAMEWORK_CONFIGS[frameworkType];
  const frameworkInfo = analyzeFrameworkPatterns(sourceFile, source, frameworkConfig);

  // 중첩 분석 (JSX와 로직 분리)
  const { maxNesting, jsxNesting, logicNesting } = calculateNestingWithFramework(sourceFile);
  frameworkInfo.jsxNestingDepth = jsxNesting;
  frameworkInfo.logicNestingDepth = logicNesting;

  // 보정된 중첩 계산
  const adjustedNesting = calculateAdjustedNesting(
    jsxNesting,
    logicNesting,
    frameworkConfig,
    frameworkInfo.adjustments
  );

  const functions = analyzeFunctionsWithFramework(sourceFile, source, frameworkConfig, frameworkInfo);
  const hiddenDeps = countHiddenDependencies(sourceFile);
  const stateAsyncRetry = checkStateAsyncRetry(source, sourceFile);

  // TypeScript 전용 복잡도 분석
  const typeComplexity = analyzeTypeComplexity(sourceFile);

  const violations = collectViolations(
    adjustedNesting,  // 보정된 값 사용
    functions,
    hiddenDeps,
    stateAsyncRetry,
    typeComplexity,
    config
  );

  return {
    accessible: violations.length === 0,
    reason: violations.length === 0 ? 'All conditions met' : violations[0],
    violations,
    maxNesting,
    adjustedNesting,
    functions,
    hiddenDependencies: hiddenDeps,
    stateAsyncRetry,
    config,
    typeComplexity,
    frameworkInfo,
  };
}

// =============================================================
// Helper Functions
// =============================================================

function getFunctionName(
  node: ts.FunctionDeclaration | ts.MethodDeclaration | ts.ArrowFunction | ts.FunctionExpression
): string {
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
    return node.name?.getText() || '<anonymous>';
  }

  // Arrow function: check parent for variable name
  const parent = node.parent;
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
    return parent.name.text;
  }
  if (ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) {
    return parent.name.text;
  }

  return '<anonymous>';
}

function getCallName(node: ts.CallExpression, sourceFile: ts.SourceFile): string | null {
  const expr = node.expression;

  if (ts.isIdentifier(expr)) {
    return expr.text;
  }

  if (ts.isPropertyAccessExpression(expr)) {
    return expr.getText(sourceFile);
  }

  return null;
}

// =============================================================
// Condition 3: Hidden Dependencies
// =============================================================

function countHiddenDependencies(sourceFile: ts.SourceFile): number {
  let count = 0;

  function visit(node: ts.Node): void {
    // Global access
    if (ts.isIdentifier(node)) {
      const name = node.text;
      if (['global', 'globalThis', 'window', 'document'].includes(name)) {
        count++;
      }
    }

    // process.env access
    if (ts.isPropertyAccessExpression(node)) {
      const text = node.getText(sourceFile);
      if (text.startsWith('process.env') || text.startsWith('import.meta.env')) {
        count++;
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return count;
}

// =============================================================
// Condition 4: State × Async × Retry
// =============================================================

function checkStateAsyncRetry(source: string, sourceFile: ts.SourceFile): StateAsyncRetry {
  // State detection
  const hasState = detectState(source, sourceFile);

  // Async detection
  const hasAsync = detectAsync(source, sourceFile);

  // Retry detection
  const hasRetry = detectRetry(source);

  const axes: string[] = [];
  if (hasState) axes.push('state');
  if (hasAsync) axes.push('async');
  if (hasRetry) axes.push('retry');

  return {
    hasState,
    hasAsync,
    hasRetry,
    axes,
    count: axes.length,
    violated: axes.length >= 2,
  };
}

function detectState(source: string, sourceFile: ts.SourceFile): boolean {
  // Class field mutation (this.field = ...)
  if (/this\.\w+\s*=/.test(source)) {
    return true;
  }

  // React state
  if (/useState|useReducer|setState/.test(source)) {
    return true;
  }

  // Zustand/Redux/MobX
  if (/createStore|makeAutoObservable|observable/.test(source)) {
    return true;
  }

  // Let variable with reassignment
  let hasLetReassignment = false;
  function visit(node: ts.Node): void {
    if (ts.isVariableDeclaration(node)) {
      const parent = node.parent;
      if (ts.isVariableDeclarationList(parent) && parent.flags & ts.NodeFlags.Let) {
        // Check if reassigned later (simple heuristic)
        const varName = node.name.getText(sourceFile);
        if (new RegExp(`${varName}\\s*=(?!=)`).test(source)) {
          hasLetReassignment = true;
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  return hasLetReassignment;
}

function detectAsync(source: string, _sourceFile: ts.SourceFile): boolean {
  // Explicit async/await
  if (/async\s+(function|\()|\bawait\b/.test(source)) {
    return true;
  }

  // Promise usage
  if (/new\s+Promise|\.then\s*\(|\.catch\s*\(/.test(source)) {
    return true;
  }

  // Worker/concurrent
  if (/Worker|spawn|fork/.test(source)) {
    return true;
  }

  return false;
}

function detectRetry(source: string): boolean {
  // Retry decorators/libraries
  const retryPatterns = [
    /@retry/i,
    /retry\s*\(/i,
    /p-retry|async-retry/i,
    /exponentialBackoff/i,
    /retryable/i,
  ];

  if (retryPatterns.some(p => p.test(source))) {
    return true;
  }

  // Manual retry pattern: for/while + try/catch + continue/break
  if (/for\s*\([^)]*retry|while\s*\([^)]*retry/i.test(source)) {
    return true;
  }

  // loop with try-catch and counter
  if (/for\s*\(.*attempts?|while\s*\(.*attempts?/i.test(source)) {
    return true;
  }

  return false;
}

// =============================================================
// Collect Violations
// =============================================================

function collectViolations(
  maxNesting: number,
  functions: FunctionInfo[],
  hiddenDeps: number,
  sar: StateAsyncRetry,
  typeComplexity: TypeComplexity,
  config: CognitiveConfig
): string[] {
  const violations: string[] = [];

  // 1. Nesting
  if (maxNesting > config.nestingThreshold) {
    violations.push(`nesting depth ${maxNesting} > ${config.nestingThreshold}`);
  }

  // 2. Concepts per function (타입 복잡도 페널티 포함)
  const typePenaltyPerFunction = Math.floor(typeComplexity.totalPenalty / Math.max(functions.length, 1));
  for (const fn of functions) {
    const totalConcepts = fn.conceptCount + typePenaltyPerFunction;
    if (totalConcepts > config.conceptsPerFunction) {
      violations.push(
        `${fn.name}: ${totalConcepts} concepts > ${config.conceptsPerFunction} (type penalty: ${typePenaltyPerFunction})`
      );
    }
  }

  // 3. Hidden dependencies
  if (hiddenDeps > config.hiddenDepThreshold) {
    violations.push(`hidden deps ${hiddenDeps} > ${config.hiddenDepThreshold}`);
  }

  // 4. State × Async × Retry
  if (sar.violated) {
    violations.push(`state×async×retry: ${sar.axes.join('×')} (${sar.count} >= 2)`);
  }

  // 5. TypeScript 타입 복잡도 위반
  if (typeComplexity.generics.maxParams > GENERIC_PARAMS_THRESHOLD + 2) {
    violations.push(`excessive generic params: ${typeComplexity.generics.maxParams} > ${GENERIC_PARAMS_THRESHOLD + 2}`);
  }

  if (typeComplexity.generics.maxDepth > GENERIC_DEPTH_THRESHOLD + 1) {
    violations.push(`deeply nested generics: depth ${typeComplexity.generics.maxDepth}`);
  }

  if (typeComplexity.unions.maxMembers > UNION_MEMBERS_THRESHOLD + 4) {
    violations.push(`excessive union members: ${typeComplexity.unions.maxMembers} > ${UNION_MEMBERS_THRESHOLD + 4}`);
  }

  if (typeComplexity.conditionalTypes > 3) {
    violations.push(`too many conditional types: ${typeComplexity.conditionalTypes}`);
  }

  if (typeComplexity.decoratorStacks > 0) {
    violations.push(`decorator stacks detected: ${typeComplexity.decoratorStacks}`);
  }

  return violations;
}

// =============================================================
// TypeScript Type Complexity Analysis
// =============================================================

function analyzeTypeComplexity(sourceFile: ts.SourceFile): TypeComplexity {
  const generics = analyzeGenericComplexity(sourceFile);
  const unions = analyzeUnionComplexity(sourceFile);
  const conditionalTypes = countConditionalTypes(sourceFile);
  const mappedTypes = countMappedTypes(sourceFile);
  const typeGuards = countTypeGuards(sourceFile);
  const decoratorStacks = countDecoratorStacks(sourceFile);

  const totalPenalty =
    generics.penalty +
    unions.penalty +
    conditionalTypes * CONDITIONAL_TYPE_PENALTY +
    mappedTypes * MAPPED_TYPE_PENALTY +
    typeGuards * TYPE_GUARD_PENALTY +
    decoratorStacks * DECORATOR_STACK_PENALTY;

  return {
    generics,
    unions,
    conditionalTypes,
    mappedTypes,
    typeGuards,
    decoratorStacks,
    totalPenalty,
  };
}

interface GenericNodeInfo {
  paramCount: number;
  constrainedCount: number;
  depth: number;
}

/**
 * 타입 파라미터 정보 추출 (개념 수 ~5)
 */
function extractTypeParameterInfo(
  typeParameters: ts.NodeArray<ts.TypeParameterDeclaration> | undefined,
  typeNode?: ts.TypeNode
): GenericNodeInfo {
  if (!typeParameters) return { paramCount: 0, constrainedCount: 0, depth: 0 };

  const paramCount = typeParameters.length;
  const constrainedCount = typeParameters.filter(p => p.constraint).length;
  const depth = typeNode ? getGenericDepth(typeNode) : 0;

  return { paramCount, constrainedCount, depth };
}

/**
 * 제네릭 복잡도 분석 (개념 수 ~8)
 */
function analyzeGenericComplexity(sourceFile: ts.SourceFile): GenericComplexity {
  let count = 0;
  let maxParams = 0;
  let maxDepth = 0;
  let constrainedCount = 0;

  function processGenericNode(info: GenericNodeInfo): void {
    count++;
    if (info.paramCount > maxParams) maxParams = info.paramCount;
    if (info.depth > maxDepth) maxDepth = info.depth;
    constrainedCount += info.constrainedCount;
  }

  function visit(node: ts.Node): void {
    if (ts.isTypeAliasDeclaration(node) && node.typeParameters) {
      processGenericNode(extractTypeParameterInfo(node.typeParameters, node.type));
    }
    if (ts.isInterfaceDeclaration(node) && node.typeParameters) {
      processGenericNode(extractTypeParameterInfo(node.typeParameters));
    }
    if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node)) && node.typeParameters) {
      processGenericNode(extractTypeParameterInfo(node.typeParameters));
    }
    if (ts.isClassDeclaration(node) && node.typeParameters) {
      processGenericNode(extractTypeParameterInfo(node.typeParameters));
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  const penalty = calculateGenericPenalty(maxParams, maxDepth, constrainedCount);
  return { count, maxParams, maxDepth, constrainedCount, penalty };
}

/**
 * 제네릭 페널티 계산 (개념 수 ~4)
 */
function calculateGenericPenalty(maxParams: number, maxDepth: number, constrainedCount: number): number {
  let penalty = 0;
  if (maxParams > GENERIC_PARAMS_THRESHOLD) {
    penalty += (maxParams - GENERIC_PARAMS_THRESHOLD) * GENERIC_PARAMS_PENALTY;
  }
  if (maxDepth > GENERIC_DEPTH_THRESHOLD) {
    penalty += (maxDepth - GENERIC_DEPTH_THRESHOLD) * GENERIC_DEPTH_PENALTY;
  }
  penalty += constrainedCount * GENERIC_CONSTRAINT_PENALTY;
  return penalty;
}

function getGenericDepth(node: ts.Node): number {
  let maxDepth = 0;

  function visit(n: ts.Node, depth: number): void {
    if (ts.isTypeReferenceNode(n) && n.typeArguments) {
      depth++;
      if (depth > maxDepth) maxDepth = depth;
      n.typeArguments.forEach(arg => visit(arg, depth));
    } else {
      ts.forEachChild(n, child => visit(child, depth));
    }
  }

  visit(node, 0);
  return maxDepth;
}

function analyzeUnionComplexity(sourceFile: ts.SourceFile): UnionComplexity {
  let count = 0;
  let maxMembers = 0;
  let intersectionCount = 0;

  function visit(node: ts.Node): void {
    // Union type: A | B | C
    if (ts.isUnionTypeNode(node)) {
      count++;
      const members = node.types.length;
      if (members > maxMembers) maxMembers = members;
    }

    // Intersection type: A & B & C
    if (ts.isIntersectionTypeNode(node)) {
      intersectionCount++;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  // Calculate penalty
  let penalty = 0;
  if (maxMembers > UNION_MEMBERS_THRESHOLD) {
    penalty += (maxMembers - UNION_MEMBERS_THRESHOLD) * UNION_MEMBERS_PENALTY;
  }
  penalty += intersectionCount * INTERSECTION_PENALTY;

  return { count, maxMembers, intersectionCount, penalty };
}

function countConditionalTypes(sourceFile: ts.SourceFile): number {
  let count = 0;

  function visit(node: ts.Node): void {
    // Conditional type: T extends U ? X : Y
    if (ts.isConditionalTypeNode(node)) {
      count++;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return count;
}

function countMappedTypes(sourceFile: ts.SourceFile): number {
  let count = 0;

  function visit(node: ts.Node): void {
    // Mapped type: { [K in keyof T]: ... }
    if (ts.isMappedTypeNode(node)) {
      count++;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return count;
}

function countTypeGuards(sourceFile: ts.SourceFile): number {
  let count = 0;

  function visit(node: ts.Node): void {
    // Type predicate: x is Foo
    if (ts.isTypePredicateNode(node)) {
      count++;
    }

    // Function with type predicate return type
    if (
      (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node)) &&
      node.type &&
      ts.isTypePredicateNode(node.type)
    ) {
      count++;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return count;
}

function countDecoratorStacks(sourceFile: ts.SourceFile): number {
  let stacks = 0;

  function visit(node: ts.Node): void {
    // Check for decorator stacks on classes, methods, properties
    const decorators = ts.canHaveDecorators(node) ? ts.getDecorators(node) : undefined;
    if (decorators && decorators.length >= DECORATOR_STACK_THRESHOLD) {
      stacks++;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return stacks;
}

// =============================================================
// Framework Detection & Adjustment
// =============================================================

function detectFramework(source: string): FrameworkType {
  // React 감지
  if (/from\s+['"]react['"]/.test(source) ||
      /import\s+React/.test(source) ||
      /['"]react['"]/.test(source)) {
    return 'react';
  }

  // Vue 감지
  if (/from\s+['"]vue['"]/.test(source) ||
      /defineComponent|ref\(|reactive\(/.test(source)) {
    return 'vue';
  }

  // Angular 감지
  if (/@Component\s*\(|@Injectable\s*\(|@NgModule/.test(source) ||
      /from\s+['"]@angular/.test(source)) {
    return 'angular';
  }

  // Svelte 감지
  if (/from\s+['"]svelte['"]/.test(source) ||
      /\$:\s*/.test(source)) {
    return 'svelte';
  }

  return 'none';
}

function analyzeFrameworkPatterns(
  _sourceFile: ts.SourceFile,
  source: string,
  config: FrameworkConfig
): FrameworkInfo {
  const hookPatterns = HOOK_PATTERNS[config.name];
  let hookCount = 0;
  let chainCount = 0;

  // Hook 패턴 카운트
  for (const pattern of hookPatterns) {
    const matches = source.match(new RegExp(pattern.source, 'g'));
    if (matches) {
      hookCount += matches.length;
    }
  }

  // 체이닝 메서드 카운트
  for (const pattern of CHAIN_METHOD_PATTERNS) {
    const matches = source.match(new RegExp(pattern.source, 'g'));
    if (matches) {
      chainCount += matches.length;
    }
  }

  return {
    detected: config.name,
    config,
    jsxNestingDepth: 0,  // 나중에 계산
    logicNestingDepth: 0,  // 나중에 계산
    hookCount,
    chainCount,
    adjustments: [],
  };
}

interface NestingResult {
  maxNesting: number;
  jsxNesting: number;
  logicNesting: number;
}

function calculateNestingWithFramework(sourceFile: ts.SourceFile): NestingResult {
  let maxNesting = 0;
  let maxJsxNesting = 0;
  let maxLogicNesting = 0;

  // JSX 요소 노드 종류
  const jsxNodeKinds = new Set([
    ts.SyntaxKind.JsxElement,
    ts.SyntaxKind.JsxSelfClosingElement,
    ts.SyntaxKind.JsxFragment,
    ts.SyntaxKind.JsxOpeningElement,
  ]);

  // 로직 중첩 노드 종류
  const logicNodeKinds = new Set([
    ts.SyntaxKind.IfStatement,
    ts.SyntaxKind.ForStatement,
    ts.SyntaxKind.ForInStatement,
    ts.SyntaxKind.ForOfStatement,
    ts.SyntaxKind.WhileStatement,
    ts.SyntaxKind.DoStatement,
    ts.SyntaxKind.TryStatement,
    ts.SyntaxKind.CatchClause,
    ts.SyntaxKind.SwitchStatement,
    ts.SyntaxKind.ConditionalExpression,
  ]);

  function visit(node: ts.Node, totalDepth: number, jsxDepth: number, logicDepth: number): void {
    let newTotalDepth = totalDepth;
    let newJsxDepth = jsxDepth;
    let newLogicDepth = logicDepth;

    if (jsxNodeKinds.has(node.kind)) {
      newTotalDepth++;
      newJsxDepth++;
      if (newJsxDepth > maxJsxNesting) maxJsxNesting = newJsxDepth;
    } else if (logicNodeKinds.has(node.kind)) {
      newTotalDepth++;
      newLogicDepth++;
      if (newLogicDepth > maxLogicNesting) maxLogicNesting = newLogicDepth;
    } else if (
      node.kind === ts.SyntaxKind.ArrowFunction ||
      node.kind === ts.SyntaxKind.FunctionExpression ||
      node.kind === ts.SyntaxKind.FunctionDeclaration ||
      node.kind === ts.SyntaxKind.MethodDeclaration
    ) {
      newTotalDepth++;
      newLogicDepth++;
      if (newLogicDepth > maxLogicNesting) maxLogicNesting = newLogicDepth;
    }

    if (newTotalDepth > maxNesting) maxNesting = newTotalDepth;

    ts.forEachChild(node, child => visit(child, newTotalDepth, newJsxDepth, newLogicDepth));
  }

  visit(sourceFile, 0, 0, 0);

  return {
    maxNesting,
    jsxNesting: maxJsxNesting,
    logicNesting: maxLogicNesting,
  };
}

function calculateAdjustedNesting(
  jsxNesting: number,
  logicNesting: number,
  config: FrameworkConfig,
  adjustments: FrameworkAdjustment[]
): number {
  // JSX 중첩에 가중치 적용
  const adjustedJsx = Math.ceil(jsxNesting * config.jsxNestingWeight);

  if (jsxNesting > 0 && config.jsxNestingWeight < 1) {
    adjustments.push({
      type: 'jsx_nesting',
      original: jsxNesting,
      adjusted: adjustedJsx,
      reason: `JSX nesting weighted by ${config.jsxNestingWeight}`,
    });
  }

  // 최종 중첩 = 로직 중첩 + 보정된 JSX 중첩
  return logicNesting + adjustedJsx;
}

function analyzeFunctionsWithFramework(
  sourceFile: ts.SourceFile,
  source: string,
  frameworkConfig: FrameworkConfig,
  frameworkInfo: FrameworkInfo
): FunctionInfo[] {
  const functions: FunctionInfo[] = [];

  function visit(node: ts.Node): void {
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node)
    ) {
      const info = analyzeFunctionWithFramework(node, sourceFile, source, frameworkConfig, frameworkInfo);
      if (info) {
        functions.push(info);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return functions;
}

// =============================================================
// Function Analysis - Separated for Cognitive Accessibility
// =============================================================

interface ParameterAnalysis {
  concepts: string[];
  antiPatterns: AntiPatternPenalty[];
}

interface VariableAnalysis {
  concepts: string[];
  hookCount: number;
}

interface CallAnalysis {
  concepts: string[];
  chainCount: number;
}

/**
 * 파라미터 분석 (개념 수 ~7)
 */
function analyzeParameters(
  node: ts.FunctionDeclaration | ts.MethodDeclaration | ts.ArrowFunction | ts.FunctionExpression,
  sourceFile: ts.SourceFile,
  frameworkConfig: FrameworkConfig,
  frameworkInfo: FrameworkInfo
): ParameterAnalysis {
  const concepts: string[] = [];
  const antiPatterns: AntiPatternPenalty[] = [];

  if (!node.parameters) return { concepts, antiPatterns };

  for (const param of node.parameters) {
    const paramName = param.name.getText(sourceFile);
    if (paramName === 'this') continue;

    if (ts.isObjectBindingPattern(param.name)) {
      const bindingCount = param.name.elements.length;
      const adjustedCount = Math.ceil(bindingCount * frameworkConfig.propsDestructureWeight);
      for (let i = 0; i < adjustedCount; i++) {
        concepts.push(`prop:destructured_${i}`);
      }
      if (frameworkConfig.propsDestructureWeight < 1) {
        frameworkInfo.adjustments.push({
          type: 'props',
          original: bindingCount,
          adjusted: adjustedCount,
          reason: `Props destructuring weighted by ${frameworkConfig.propsDestructureWeight}`,
        });
      }
    } else {
      concepts.push(`param:${paramName}`);
    }

    if (param.dotDotDotToken) {
      antiPatterns.push({
        pattern: 'rest_params',
        penalty: REST_PARAMS_PENALTY,
        reason: `...${paramName} hides actual parameter count`,
      });
    }
  }

  return { concepts, antiPatterns };
}

/**
 * 변수 및 Hook 분석 (개념 수 ~8)
 */
function analyzeVariablesWithHooks(
  node: ts.FunctionDeclaration | ts.MethodDeclaration | ts.ArrowFunction | ts.FunctionExpression,
  sourceFile: ts.SourceFile,
  hookPatterns: RegExp[]
): VariableAnalysis {
  const variables = new Set<string>();
  let hookCount = 0;

  function visit(n: ts.Node): void {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) {
      const varText = n.getText(sourceFile);
      const isHook = hookPatterns.some(pattern => pattern.test(varText));

      if (isHook) {
        hookCount++;
      } else {
        variables.add(n.name.text);
      }
    }
    ts.forEachChild(n, visit);
  }

  if (node.body) visit(node.body);

  const concepts = Array.from(variables).map(v => `var:${v}`);
  return { concepts, hookCount };
}

/**
 * 함수 호출 및 Chain 메서드 분석 (개념 수 ~8)
 */
function analyzeCallsWithChains(
  node: ts.FunctionDeclaration | ts.MethodDeclaration | ts.ArrowFunction | ts.FunctionExpression,
  sourceFile: ts.SourceFile
): CallAnalysis {
  const calls = new Set<string>();
  let chainCount = 0;

  function visit(n: ts.Node): void {
    if (ts.isCallExpression(n)) {
      const callName = getCallName(n, sourceFile);
      if (callName && !BUILTIN_FUNCTIONS.has(callName.split('.')[0])) {
        const isChain = CHAIN_METHOD_PATTERNS.some(pattern => pattern.test(callName));
        if (isChain) {
          chainCount++;
        } else {
          calls.add(callName);
        }
      }
    }
    ts.forEachChild(n, visit);
  }

  if (node.body) visit(node.body);

  const concepts = Array.from(calls).map(c => `call:${c}`);
  return { concepts, chainCount };
}

/**
 * Spread config 안티패턴 분석 (개념 수 ~5)
 */
function analyzeSpreadPatterns(
  node: ts.FunctionDeclaration | ts.MethodDeclaration | ts.ArrowFunction | ts.FunctionExpression,
  sourceFile: ts.SourceFile
): AntiPatternPenalty[] {
  const antiPatterns: AntiPatternPenalty[] = [];

  function visit(n: ts.Node): void {
    if (ts.isSpreadElement(n) || ts.isSpreadAssignment(n)) {
      const text = n.getText(sourceFile);
      if (/\.\.\.(options|config|props|params|args)/i.test(text)) {
        antiPatterns.push({
          pattern: 'spread_config',
          penalty: SPREAD_CONFIG_PENALTY,
          reason: `${text} bundles multiple concepts`,
        });
      }
    }
    ts.forEachChild(n, visit);
  }

  if (node.body) visit(node.body);
  return antiPatterns;
}

/**
 * Hook/Chain 개념에 가중치 적용 (개념 수 ~6)
 */
function applyFrameworkWeights(
  hookCount: number,
  chainCount: number,
  frameworkConfig: FrameworkConfig,
  frameworkInfo: FrameworkInfo
): string[] {
  const concepts: string[] = [];

  const adjustedHookCount = Math.ceil(hookCount * frameworkConfig.hookConceptWeight);
  for (let i = 0; i < adjustedHookCount; i++) {
    concepts.push(`hook:${i}`);
  }

  if (hookCount > 0 && frameworkConfig.hookConceptWeight < 1) {
    frameworkInfo.adjustments.push({
      type: 'hook',
      original: hookCount,
      adjusted: adjustedHookCount,
      reason: `Hook concepts weighted by ${frameworkConfig.hookConceptWeight}`,
    });
  }

  const adjustedChainCount = Math.ceil(chainCount * frameworkConfig.chainMethodWeight);
  for (let i = 0; i < adjustedChainCount; i++) {
    concepts.push(`chain:${i}`);
  }

  if (chainCount > 0 && frameworkConfig.chainMethodWeight < 1) {
    frameworkInfo.adjustments.push({
      type: 'chain',
      original: chainCount,
      adjusted: adjustedChainCount,
      reason: `Chain methods weighted by ${frameworkConfig.chainMethodWeight}`,
    });
  }

  return concepts;
}

/**
 * 함수 분석 메인 (개념 수 ~8) - 조합만 수행
 */
function analyzeFunctionWithFramework(
  node: ts.FunctionDeclaration | ts.MethodDeclaration | ts.ArrowFunction | ts.FunctionExpression,
  sourceFile: ts.SourceFile,
  _source: string,
  frameworkConfig: FrameworkConfig,
  frameworkInfo: FrameworkInfo
): FunctionInfo | null {
  const name = getFunctionName(node);
  const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  const hookPatterns = HOOK_PATTERNS[frameworkConfig.name];

  // 분리된 분석 함수 호출
  const paramResult = analyzeParameters(node, sourceFile, frameworkConfig, frameworkInfo);
  const varResult = analyzeVariablesWithHooks(node, sourceFile, hookPatterns);
  const callResult = analyzeCallsWithChains(node, sourceFile);
  const spreadPatterns = analyzeSpreadPatterns(node, sourceFile);
  const weightedConcepts = applyFrameworkWeights(
    varResult.hookCount, callResult.chainCount, frameworkConfig, frameworkInfo
  );

  // 결과 조합
  const concepts = [
    ...paramResult.concepts,
    ...varResult.concepts,
    ...callResult.concepts,
    ...weightedConcepts,
  ];
  const antiPatterns = [...paramResult.antiPatterns, ...spreadPatterns];

  const rawConceptCount = concepts.length;
  const penaltyTotal = antiPatterns.reduce((sum, ap) => sum + ap.penalty, 0);

  return {
    name,
    line,
    conceptCount: rawConceptCount + penaltyTotal,
    rawConceptCount,
    concepts,
    antiPatterns,
  };
}
