/**
 * Class Reusability Analysis Module
 *
 * Analyzes class design quality using standard OO metrics:
 * - LCOM (Lack of Cohesion of Methods): Method cohesion, lower is better
 * - WMC (Weighted Methods per Class): Sum of method complexities
 * - CBO (Coupling Between Objects): External dependencies count
 * - DIT (Depth of Inheritance Tree): Inheritance depth
 * - RFC (Response For a Class): Methods + called methods
 * - NOC (Number of Children): Direct subclasses (requires codebase scan)
 *
 * Reusability Score = f(LCOM, WMC, CBO, DIT)
 */

import * as ts from 'typescript';

/**
 * Class field info
 */
export interface ClassFieldInfo {
  name: string;
  isStatic: boolean;
  isPrivate: boolean;
  type?: string;
}

/**
 * Class method info with complexity
 */
export interface ClassMethodInfo {
  name: string;
  isStatic: boolean;
  isPrivate: boolean;
  isAsync: boolean;
  complexity: number;
  accessedFields: string[];
  calledMethods: string[];
  externalCalls: string[];
  lineno: number;
}

/**
 * Class analysis result
 */
export interface ClassAnalysisResult {
  name: string;
  lineno: number;
  extends?: string;
  implements: string[];
  fields: ClassFieldInfo[];
  methods: ClassMethodInfo[];
  metrics: ClassMetrics;
  reusability: ReusabilityScore;
}

/**
 * Standard OO metrics
 */
export interface ClassMetrics {
  /** Weighted Methods per Class */
  wmc: number;
  /** Lack of Cohesion of Methods (LCOM4) */
  lcom: number;
  /** Coupling Between Objects */
  cbo: number;
  /** Depth of Inheritance Tree */
  dit: number;
  /** Response For a Class */
  rfc: number;
  /** Number of Methods */
  nom: number;
  /** Number of Fields */
  nof: number;
  /** Lines of Code */
  loc: number;
}

/**
 * Reusability score and interpretation
 */
export interface ReusabilityScore {
  /** Overall score 0-100 */
  score: number;
  /** Grade: A, B, C, D, F */
  grade: string;
  /** Zone: reusable, moderate, problematic */
  zone: 'reusable' | 'moderate' | 'problematic';
  /** Specific issues found */
  issues: ReusabilityIssue[];
  /** Recommendations for improvement */
  recommendations: string[];
}

/**
 * Specific reusability issue
 */
export interface ReusabilityIssue {
  metric: string;
  value: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high';
  message: string;
}

/**
 * File-level class analysis result
 */
export interface FileClassAnalysisResult {
  file: string;
  classes: ClassAnalysisResult[];
  summary: {
    totalClasses: number;
    avgReusability: number;
    problematicCount: number;
  };
}

// Thresholds for metrics
const THRESHOLDS = {
  wmc: { low: 20, high: 50 },
  lcom: { low: 0.5, high: 0.8 },
  cbo: { low: 5, high: 14 },
  rfc: { low: 20, high: 50 },
  nom: { low: 10, high: 30 },
  nof: { low: 5, high: 15 },
};

/**
 * Extract class info from TypeScript AST
 */
function extractClassInfo(
  classDecl: ts.ClassDeclaration,
  sourceFile: ts.SourceFile
): {
  name: string;
  lineno: number;
  extends?: string;
  implements: string[];
  fields: ClassFieldInfo[];
  methods: ClassMethodInfo[];
  loc: number;
} {
  const name = classDecl.name?.getText(sourceFile) ?? '<anonymous>';
  const { line: lineno } = sourceFile.getLineAndCharacterOfPosition(
    classDecl.getStart()
  );

  // Get extends and implements
  let extendsClass: string | undefined;
  const implementsInterfaces: string[] = [];

  if (classDecl.heritageClauses) {
    for (const clause of classDecl.heritageClauses) {
      if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
        extendsClass = clause.types[0]?.expression.getText(sourceFile);
      } else if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
        for (const type of clause.types) {
          implementsInterfaces.push(type.expression.getText(sourceFile));
        }
      }
    }
  }

  const fields: ClassFieldInfo[] = [];
  const methods: ClassMethodInfo[] = [];

  // Extract fields and methods
  for (const member of classDecl.members) {
    if (ts.isPropertyDeclaration(member)) {
      const isPrivate =
        member.modifiers?.some(
          (m) =>
            m.kind === ts.SyntaxKind.PrivateKeyword ||
            (member.name.getText(sourceFile).startsWith('#'))
        ) ?? false;
      const isStatic =
        member.modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword) ??
        false;

      fields.push({
        name: member.name.getText(sourceFile),
        isStatic,
        isPrivate,
        type: member.type?.getText(sourceFile),
      });
    } else if (
      ts.isMethodDeclaration(member) ||
      ts.isGetAccessor(member) ||
      ts.isSetAccessor(member)
    ) {
      const isPrivate =
        member.modifiers?.some(
          (m) =>
            m.kind === ts.SyntaxKind.PrivateKeyword ||
            member.name.getText(sourceFile).startsWith('#')
        ) ?? false;
      const isStatic =
        member.modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword) ??
        false;
      const isAsync =
        member.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) ??
        false;

      const methodLineno = sourceFile.getLineAndCharacterOfPosition(
        member.getStart()
      ).line;

      // Analyze method body
      const { accessedFields, calledMethods, externalCalls, complexity } =
        analyzeMethodBody(member, sourceFile, fields.map((f) => f.name));

      methods.push({
        name: member.name.getText(sourceFile),
        isStatic,
        isPrivate,
        isAsync,
        complexity,
        accessedFields,
        calledMethods,
        externalCalls,
        lineno: methodLineno + 1,
      });
    } else if (ts.isConstructorDeclaration(member)) {
      const constructorLineno = sourceFile.getLineAndCharacterOfPosition(
        member.getStart()
      ).line;

      const { accessedFields, calledMethods, externalCalls, complexity } =
        analyzeMethodBody(member, sourceFile, fields.map((f) => f.name));

      methods.push({
        name: 'constructor',
        isStatic: false,
        isPrivate: false,
        isAsync: false,
        complexity,
        accessedFields,
        calledMethods,
        externalCalls,
        lineno: constructorLineno + 1,
      });
    }
  }

  // Calculate LOC
  const startLine = sourceFile.getLineAndCharacterOfPosition(
    classDecl.getStart()
  ).line;
  const endLine = sourceFile.getLineAndCharacterOfPosition(
    classDecl.getEnd()
  ).line;
  const loc = endLine - startLine + 1;

  return {
    name,
    lineno: lineno + 1,
    extends: extendsClass,
    implements: implementsInterfaces,
    fields,
    methods,
    loc,
  };
}

/**
 * Analyze method body for field access and method calls
 */
function analyzeMethodBody(
  method:
    | ts.MethodDeclaration
    | ts.GetAccessorDeclaration
    | ts.SetAccessorDeclaration
    | ts.ConstructorDeclaration,
  sourceFile: ts.SourceFile,
  fieldNames: string[]
): {
  accessedFields: string[];
  calledMethods: string[];
  externalCalls: string[];
  complexity: number;
} {
  const accessedFields = new Set<string>();
  const calledMethods = new Set<string>();
  const externalCalls = new Set<string>();
  let complexity = 1; // Base complexity

  function visit(node: ts.Node) {
    // Count complexity
    if (
      ts.isIfStatement(node) ||
      ts.isConditionalExpression(node) ||
      ts.isWhileStatement(node) ||
      ts.isForStatement(node) ||
      ts.isForInStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isCaseClause(node) ||
      ts.isCatchClause(node)
    ) {
      complexity++;
    }
    if (ts.isBinaryExpression(node)) {
      if (
        node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
        node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
        node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
      ) {
        complexity++;
      }
    }

    // Track this.field access
    if (ts.isPropertyAccessExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ThisKeyword) {
        const fieldName = node.name.getText(sourceFile);
        if (fieldNames.includes(fieldName)) {
          accessedFields.add(fieldName);
        } else {
          // Might be a method call on this
          calledMethods.add(fieldName);
        }
      }
    }

    // Track method calls
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isPropertyAccessExpression(callee)) {
        if (callee.expression.kind === ts.SyntaxKind.ThisKeyword) {
          calledMethods.add(callee.name.getText(sourceFile));
        } else {
          externalCalls.add(callee.getText(sourceFile));
        }
      } else if (ts.isIdentifier(callee)) {
        externalCalls.add(callee.getText(sourceFile));
      }
    }

    ts.forEachChild(node, visit);
  }

  if (method.body) {
    visit(method.body);
  }

  return {
    accessedFields: Array.from(accessedFields),
    calledMethods: Array.from(calledMethods),
    externalCalls: Array.from(externalCalls),
    complexity,
  };
}

/**
 * Calculate LCOM4 (Lack of Cohesion of Methods)
 *
 * Based on graph connectivity:
 * - Each method is a node
 * - Edge exists if methods share a field
 * - LCOM4 = number of connected components
 *
 * We normalize to 0-1 range: (components - 1) / (methods - 1)
 */
function calculateLCOM(methods: ClassMethodInfo[]): number {
  if (methods.length <= 1) return 0;

  // Build adjacency based on shared fields
  const n = methods.length;
  const adj: Set<number>[] = Array.from({ length: n }, () => new Set());

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const fieldsI = new Set(methods[i].accessedFields);
      const fieldsJ = new Set(methods[j].accessedFields);
      let shared = false;
      for (const f of fieldsI) {
        if (fieldsJ.has(f)) {
          shared = true;
          break;
        }
      }
      if (shared) {
        adj[i].add(j);
        adj[j].add(i);
      }
    }
  }

  // Count connected components using BFS
  const visited = new Set<number>();
  let components = 0;

  for (let i = 0; i < n; i++) {
    if (!visited.has(i)) {
      components++;
      const queue = [i];
      while (queue.length > 0) {
        const node = queue.shift()!;
        if (visited.has(node)) continue;
        visited.add(node);
        for (const neighbor of adj[node]) {
          if (!visited.has(neighbor)) {
            queue.push(neighbor);
          }
        }
      }
    }
  }

  // Normalize: 0 = fully cohesive, 1 = no cohesion
  return (components - 1) / (n - 1);
}

/**
 * Calculate class metrics
 */
function calculateMetrics(
  classInfo: ReturnType<typeof extractClassInfo>
): ClassMetrics {
  const { fields, methods, extends: parentClass, loc } = classInfo;

  // WMC: Sum of method complexities
  const wmc = methods.reduce((sum, m) => sum + m.complexity, 0);

  // LCOM: Lack of cohesion
  const lcom = calculateLCOM(methods);

  // CBO: Count unique external dependencies
  const allExternalCalls = new Set<string>();
  for (const m of methods) {
    for (const call of m.externalCalls) {
      // Extract the base object/module
      const base = call.split('.')[0];
      allExternalCalls.add(base);
    }
  }
  const cbo = allExternalCalls.size;

  // DIT: Depth of inheritance tree (simplified - just check if extends)
  const dit = parentClass ? 1 : 0;

  // RFC: Methods + external calls
  const allCalls = new Set<string>();
  for (const m of methods) {
    allCalls.add(m.name);
    for (const call of m.externalCalls) {
      allCalls.add(call);
    }
    for (const call of m.calledMethods) {
      allCalls.add(call);
    }
  }
  const rfc = allCalls.size;

  return {
    wmc,
    lcom,
    cbo,
    dit,
    rfc,
    nom: methods.length,
    nof: fields.length,
    loc,
  };
}

/**
 * Calculate reusability score
 */
function calculateReusability(metrics: ClassMetrics): ReusabilityScore {
  const issues: ReusabilityIssue[] = [];

  // Check each metric against thresholds
  if (metrics.wmc > THRESHOLDS.wmc.high) {
    issues.push({
      metric: 'WMC',
      value: metrics.wmc,
      threshold: THRESHOLDS.wmc.high,
      severity: 'high',
      message: `클래스가 너무 복잡함 (WMC=${metrics.wmc}, 권장 <${THRESHOLDS.wmc.high})`,
    });
  } else if (metrics.wmc > THRESHOLDS.wmc.low) {
    issues.push({
      metric: 'WMC',
      value: metrics.wmc,
      threshold: THRESHOLDS.wmc.low,
      severity: 'medium',
      message: `클래스 복잡도가 중간 수준 (WMC=${metrics.wmc})`,
    });
  }

  if (metrics.lcom > THRESHOLDS.lcom.high) {
    issues.push({
      metric: 'LCOM',
      value: metrics.lcom,
      threshold: THRESHOLDS.lcom.high,
      severity: 'high',
      message: `메서드 응집도가 매우 낮음 (LCOM=${metrics.lcom.toFixed(2)}, 권장 <${THRESHOLDS.lcom.high})`,
    });
  } else if (metrics.lcom > THRESHOLDS.lcom.low) {
    issues.push({
      metric: 'LCOM',
      value: metrics.lcom,
      threshold: THRESHOLDS.lcom.low,
      severity: 'medium',
      message: `메서드 응집도가 중간 수준 (LCOM=${metrics.lcom.toFixed(2)})`,
    });
  }

  if (metrics.cbo > THRESHOLDS.cbo.high) {
    issues.push({
      metric: 'CBO',
      value: metrics.cbo,
      threshold: THRESHOLDS.cbo.high,
      severity: 'high',
      message: `외부 의존성이 너무 많음 (CBO=${metrics.cbo}, 권장 <${THRESHOLDS.cbo.high})`,
    });
  } else if (metrics.cbo > THRESHOLDS.cbo.low) {
    issues.push({
      metric: 'CBO',
      value: metrics.cbo,
      threshold: THRESHOLDS.cbo.low,
      severity: 'medium',
      message: `외부 의존성이 중간 수준 (CBO=${metrics.cbo})`,
    });
  }

  if (metrics.nom > THRESHOLDS.nom.high) {
    issues.push({
      metric: 'NOM',
      value: metrics.nom,
      threshold: THRESHOLDS.nom.high,
      severity: 'high',
      message: `메서드 수가 너무 많음 (NOM=${metrics.nom}, 권장 <${THRESHOLDS.nom.high})`,
    });
  }

  if (metrics.nof > THRESHOLDS.nof.high) {
    issues.push({
      metric: 'NOF',
      value: metrics.nof,
      threshold: THRESHOLDS.nof.high,
      severity: 'medium',
      message: `필드 수가 많음 (NOF=${metrics.nof}, 권장 <${THRESHOLDS.nof.high})`,
    });
  }

  // Calculate score (0-100)
  let score = 100;

  // WMC penalty (max -30)
  if (metrics.wmc > THRESHOLDS.wmc.low) {
    const penalty = Math.min(
      30,
      ((metrics.wmc - THRESHOLDS.wmc.low) /
        (THRESHOLDS.wmc.high - THRESHOLDS.wmc.low)) *
        30
    );
    score -= penalty;
  }

  // LCOM penalty (max -25)
  if (metrics.lcom > THRESHOLDS.lcom.low) {
    const penalty = Math.min(
      25,
      ((metrics.lcom - THRESHOLDS.lcom.low) /
        (THRESHOLDS.lcom.high - THRESHOLDS.lcom.low)) *
        25
    );
    score -= penalty;
  }

  // CBO penalty (max -25)
  if (metrics.cbo > THRESHOLDS.cbo.low) {
    const penalty = Math.min(
      25,
      ((metrics.cbo - THRESHOLDS.cbo.low) /
        (THRESHOLDS.cbo.high - THRESHOLDS.cbo.low)) *
        25
    );
    score -= penalty;
  }

  // NOM penalty (max -10)
  if (metrics.nom > THRESHOLDS.nom.low) {
    const penalty = Math.min(
      10,
      ((metrics.nom - THRESHOLDS.nom.low) /
        (THRESHOLDS.nom.high - THRESHOLDS.nom.low)) *
        10
    );
    score -= penalty;
  }

  // NOF penalty (max -10)
  if (metrics.nof > THRESHOLDS.nof.low) {
    const penalty = Math.min(
      10,
      ((metrics.nof - THRESHOLDS.nof.low) /
        (THRESHOLDS.nof.high - THRESHOLDS.nof.low)) *
        10
    );
    score -= penalty;
  }

  score = Math.max(0, Math.round(score));

  // Determine grade and zone
  let grade: string;
  let zone: 'reusable' | 'moderate' | 'problematic';

  if (score >= 80) {
    grade = 'A';
    zone = 'reusable';
  } else if (score >= 60) {
    grade = 'B';
    zone = 'reusable';
  } else if (score >= 40) {
    grade = 'C';
    zone = 'moderate';
  } else if (score >= 20) {
    grade = 'D';
    zone = 'problematic';
  } else {
    grade = 'F';
    zone = 'problematic';
  }

  // Generate recommendations
  const recommendations: string[] = [];

  if (metrics.lcom > THRESHOLDS.lcom.low) {
    recommendations.push(
      '클래스를 여러 응집된 클래스로 분리하세요 (SRP 원칙)'
    );
  }
  if (metrics.wmc > THRESHOLDS.wmc.low) {
    recommendations.push(
      '복잡한 메서드를 작은 단위로 추출하세요 (Extract Method)'
    );
  }
  if (metrics.cbo > THRESHOLDS.cbo.low) {
    recommendations.push(
      '의존성 주입(DI)을 사용하여 결합도를 낮추세요'
    );
  }
  if (metrics.nom > THRESHOLDS.nom.low) {
    recommendations.push(
      '관련 메서드들을 별도 클래스로 위임하세요 (Delegation)'
    );
  }

  return {
    score,
    grade,
    zone,
    issues,
    recommendations,
  };
}

/**
 * Analyze a single class
 */
export function analyzeClass(
  classDecl: ts.ClassDeclaration,
  sourceFile: ts.SourceFile
): ClassAnalysisResult {
  const classInfo = extractClassInfo(classDecl, sourceFile);
  const metrics = calculateMetrics(classInfo);
  const reusability = calculateReusability(metrics);

  return {
    name: classInfo.name,
    lineno: classInfo.lineno,
    extends: classInfo.extends,
    implements: classInfo.implements,
    fields: classInfo.fields,
    methods: classInfo.methods,
    metrics,
    reusability,
  };
}

/**
 * Analyze all classes in a source file
 */
export function analyzeClasses(
  sourceFile: ts.SourceFile
): ClassAnalysisResult[] {
  const results: ClassAnalysisResult[] = [];

  function visit(node: ts.Node) {
    if (ts.isClassDeclaration(node)) {
      results.push(analyzeClass(node, sourceFile));
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return results;
}

/**
 * Analyze classes in a file by path
 */
export function analyzeClassesInFile(
  filePath: string,
  content: string
): FileClassAnalysisResult {
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  const classes = analyzeClasses(sourceFile);

  const avgReusability =
    classes.length > 0
      ? classes.reduce((sum, c) => sum + c.reusability.score, 0) / classes.length
      : 0;

  const problematicCount = classes.filter(
    (c) => c.reusability.zone === 'problematic'
  ).length;

  return {
    file: filePath,
    classes,
    summary: {
      totalClasses: classes.length,
      avgReusability: Math.round(avgReusability),
      problematicCount,
    },
  };
}
