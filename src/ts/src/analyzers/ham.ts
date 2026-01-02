/**
 * 🥓 Ham Analyzer - Behavioral Coverage (TypeScript)
 *
 * 행동 검증 분석:
 * - Golden test coverage 계산
 * - Critical path 식별
 * - 테스트되지 않은 critical path 탐지
 *
 * 지원 테스트 프레임워크:
 * - Jest, Vitest, Mocha, Node.js test runner
 */

import ts from 'typescript';

// =============================================================
// Types
// =============================================================

export interface HamResult {
  goldenTestCoverage: number;  // 0.0 ~ 1.0
  criticalPaths: CriticalPath[];
  untestedCriticalPaths: string[];
  testInfo: TestInfo;
}

export interface CriticalPath {
  name: string;
  line: number;
  category: CriticalCategory;
  reason: string;
}

export interface TestInfo {
  framework: TestFramework | null;
  testCount: number;
  describedFunctions: Set<string>;
}

export type CriticalCategory =
  | 'payment'
  | 'auth'
  | 'data'
  | 'security'
  | 'api'
  | 'database';

export type TestFramework = 'jest' | 'vitest' | 'mocha' | 'node' | 'unknown';

// =============================================================
// Critical Path Patterns
// =============================================================

const CRITICAL_PATH_PATTERNS: Record<CriticalCategory, RegExp[]> = {
  payment: [
    /payment|billing|charge|invoice/i,
    /stripe|paypal|braintree/i,
    /checkout|cart|order/i,
    /refund|subscription/i,
  ],
  auth: [
    /auth|login|logout|signin|signout/i,
    /password|credential|token/i,
    /session|cookie/i,
    /oauth|sso|saml/i,
    /verify|validate.*user/i,
  ],
  data: [
    /delete|remove|destroy|drop/i,
    /truncate|purge|clear/i,
    /migrate|migration/i,
    /backup|restore/i,
  ],
  security: [
    /encrypt|decrypt|hash/i,
    /permission|authorize|acl/i,
    /sanitize|escape|xss/i,
    /csrf|cors|helmet/i,
    /admin|sudo|root/i,
  ],
  api: [
    /api.*call|fetch.*api/i,
    /external.*request/i,
    /webhook|callback/i,
    /rate.*limit|throttle/i,
  ],
  database: [
    /query|execute.*sql/i,
    /transaction|commit|rollback/i,
    /insert|update|select/i,
    /connect.*db|pool/i,
  ],
};

// =============================================================
// Test Framework Detection
// =============================================================

// Order matters: more specific patterns first
const TEST_FRAMEWORK_PATTERNS: Array<[TestFramework, RegExp[]]> = [
  ['vitest', [
    /from\s+['"]vitest['"]/,
    /import.*vitest/i,
  ]],
  ['node', [
    /from\s+['"]node:test['"]/,
    /import.*node:test/,
  ]],
  ['mocha', [
    /from\s+['"]mocha['"]/,
    /import.*mocha/i,
    /chai/i,
  ]],
  ['jest', [
    /from\s+['"]@jest/,
    /import.*jest/i,
    /describe\s*\(|it\s*\(|test\s*\(/,
    /expect\s*\(/,
  ]],
];

// =============================================================
// Main Analyzer
// =============================================================

export function analyzeHam(
  source: string,
  testSource?: string
): HamResult {
  const sourceFile = ts.createSourceFile(
    'temp.ts',
    source,
    ts.ScriptTarget.Latest,
    true
  );

  // Find critical paths in source
  const criticalPaths = findCriticalPaths(sourceFile, source);

  // Analyze test file if provided
  const testInfo = testSource
    ? analyzeTestFile(testSource)
    : { framework: null, testCount: 0, describedFunctions: new Set<string>() };

  // Find untested critical paths
  const untestedCriticalPaths = criticalPaths
    .filter(cp => !testInfo.describedFunctions.has(cp.name.toLowerCase()))
    .map(cp => cp.name);

  // Calculate coverage
  const coverage = criticalPaths.length > 0
    ? (criticalPaths.length - untestedCriticalPaths.length) / criticalPaths.length
    : 1.0;

  return {
    goldenTestCoverage: coverage,
    criticalPaths,
    untestedCriticalPaths,
    testInfo,
  };
}

// =============================================================
// Critical Path Detection
// =============================================================

function findCriticalPaths(sourceFile: ts.SourceFile, _source: string): CriticalPath[] {
  const paths: CriticalPath[] = [];
  const seen = new Set<string>();

  function visit(node: ts.Node): void {
    // Function declarations
    if (ts.isFunctionDeclaration(node) && node.name) {
      const name = node.name.text;
      const category = matchCriticalCategory(name);
      if (category && !seen.has(name)) {
        seen.add(name);
        paths.push({
          name,
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          category,
          reason: `Function name matches ${category} pattern`,
        });
      }
    }

    // Method declarations
    if (ts.isMethodDeclaration(node) && node.name) {
      const name = node.name.getText(sourceFile);
      const category = matchCriticalCategory(name);
      if (category && !seen.has(name)) {
        seen.add(name);
        paths.push({
          name,
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          category,
          reason: `Method name matches ${category} pattern`,
        });
      }
    }

    // Variable declarations (arrow functions)
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const name = node.name.text;
      if (node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
        const category = matchCriticalCategory(name);
        if (category && !seen.has(name)) {
          seen.add(name);
          paths.push({
            name,
            line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
            category,
            reason: `Arrow function name matches ${category} pattern`,
          });
        }
      }
    }

    // Class declarations with critical methods
    if (ts.isClassDeclaration(node) && node.name) {
      const className = node.name.text;
      const category = matchCriticalCategory(className);
      if (category && !seen.has(className)) {
        seen.add(className);
        paths.push({
          name: className,
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          category,
          reason: `Class name matches ${category} pattern`,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return paths;
}

function matchCriticalCategory(name: string): CriticalCategory | null {
  for (const [category, patterns] of Object.entries(CRITICAL_PATH_PATTERNS)) {
    if (patterns.some(p => p.test(name))) {
      return category as CriticalCategory;
    }
  }
  return null;
}

// =============================================================
// Test File Analysis
// =============================================================

function analyzeTestFile(testSource: string): TestInfo {
  const framework = detectTestFramework(testSource);
  const testCount = countTests(testSource);
  const describedFunctions = extractTestedFunctions(testSource);

  return {
    framework,
    testCount,
    describedFunctions,
  };
}

function detectTestFramework(source: string): TestFramework | null {
  for (const [framework, patterns] of TEST_FRAMEWORK_PATTERNS) {
    if (patterns.some(p => p.test(source))) {
      return framework;
    }
  }
  return null;
}

function countTests(source: string): number {
  const testPatterns = [
    /\bit\s*\(\s*['"`]/g,
    /\btest\s*\(\s*['"`]/g,
    /\bspec\s*\(\s*['"`]/g,
  ];

  let count = 0;
  for (const pattern of testPatterns) {
    const matches = source.match(pattern);
    if (matches) {
      count += matches.length;
    }
  }
  return count;
}

function extractTestedFunctions(testSource: string): Set<string> {
  const functions = new Set<string>();

  // Extract from describe/it/test blocks
  const patterns = [
    /describe\s*\(\s*['"`]([^'"`]+)['"`]/gi,
    /it\s*\(\s*['"`].*?(\w+).*?['"`]/gi,
    /test\s*\(\s*['"`].*?(\w+).*?['"`]/gi,
    /should.*?(\w+)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(testSource)) !== null) {
      const name = match[1].toLowerCase();
      // Filter out common test words
      if (!['should', 'when', 'then', 'given', 'returns', 'throws'].includes(name)) {
        functions.add(name);
      }
    }
  }

  // Extract function calls in tests
  const callPattern = /(?:expect|assert|spy|mock)\s*\(\s*(\w+)/gi;
  let match;
  while ((match = callPattern.exec(testSource)) !== null) {
    functions.add(match[1].toLowerCase());
  }

  return functions;
}

// =============================================================
// Test Discovery (find test files)
// =============================================================

export function findTestFile(sourcePath: string): string | null {
  // Common test file patterns
  const patterns = [
    sourcePath.replace(/\.ts$/, '.test.ts'),
    sourcePath.replace(/\.ts$/, '.spec.ts'),
    sourcePath.replace(/\.tsx$/, '.test.tsx'),
    sourcePath.replace(/\.tsx$/, '.spec.tsx'),
    sourcePath.replace(/src\//, 'test/').replace(/\.ts$/, '.test.ts'),
    sourcePath.replace(/src\//, '__tests__/').replace(/\.ts$/, '.test.ts'),
  ];

  // Note: Actual file existence check would be done by the caller
  return patterns[0]; // Return first pattern as suggestion
}
