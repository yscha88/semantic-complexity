/**
 * 🍞 Bread Analyzer - Security & Trust Boundary (TypeScript)
 *
 * 보안 구조 안정성 분석:
 * - Trust boundary 탐지
 * - Auth/Authz 흐름 분석
 * - Secret 패턴 탐지
 * - Hidden dependencies 계산
 *
 * TypeScript 전용 타입 안전성 분석:
 * - any 타입 사용 탐지
 * - Type assertion (as) 남용
 * - @ts-ignore, @ts-expect-error 사용
 * - Non-null assertion (!) 남용
 * - unknown vs any 사용 패턴
 */

import ts from 'typescript';

// =============================================================
// Types
// =============================================================

export interface BreadResult {
  trustBoundaryCount: number;
  trustBoundaries: TrustBoundary[];
  authExplicitness: number; // 0.0 ~ 1.0
  authPatterns: string[];
  secretPatterns: SecretPattern[];
  hiddenDeps: HiddenDeps;
  violations: string[];

  // TypeScript 전용 타입 안전성
  typeSafety: TypeSafetyResult;
}

export interface TypeSafetyResult {
  anyCount: number;              // any 타입 사용 횟수
  anyLocations: TypeUnsafeLocation[];
  assertionCount: number;        // type assertion (as) 횟수
  assertionLocations: TypeUnsafeLocation[];
  nonNullAssertionCount: number; // ! 연산자 횟수
  tsIgnoreCount: number;         // @ts-ignore/@ts-expect-error 횟수
  tsIgnoreLocations: TypeUnsafeLocation[];
  unknownCount: number;          // unknown 타입 사용 (권장)
  safetyScore: number;           // 0.0 ~ 1.0 (높을수록 안전)
}

export interface TypeUnsafeLocation {
  line: number;
  column: number;
  code: string;
  reason: string;
}

export interface TrustBoundary {
  name: string;
  line: number;
  boundaryType: 'marker' | 'api' | 'auth' | 'network' | 'data';
  description: string;
}

export interface SecretPattern {
  line: number;
  patternType: string;
  snippet: string;
  severity: 'high' | 'medium' | 'low';
}

export interface HiddenDeps {
  global: number;
  env: number;
  io: number;
  total: number;
}

// =============================================================
// Trust Boundary Patterns (TypeScript/JavaScript)
// =============================================================

const TRUST_BOUNDARY_PATTERNS: Record<string, Array<[RegExp, string]>> = {
  marker: [
    [/TRUST_BOUNDARY\s*[:=]/i, 'Trust boundary marker'],
    [/\/\*\*.*TRUST.?BOUNDARY/is, 'Trust boundary JSDoc'],
    [/\/\/\s*TRUST.?BOUNDARY/i, 'Trust boundary comment'],
  ],
  api: [
    // Express/Fastify/Koa
    [/\.(get|post|put|delete|patch|all)\s*\(\s*['"`]/, 'HTTP endpoint'],
    [/@(Get|Post|Put|Delete|Patch|All)\s*\(/, 'NestJS endpoint'],
    [/@Controller\s*\(/, 'NestJS Controller'],
    // tRPC
    [/\.query\s*\(|\.mutation\s*\(/, 'tRPC procedure'],
    // GraphQL
    [/@(Query|Mutation|Resolver)\s*\(/, 'GraphQL resolver'],
  ],
  auth: [
    [/@(Auth|Authenticated|RequireAuth|Protected)\s*(\(|$)/i, 'Auth decorator'],
    [/@(UseGuards|Guard)\s*\(.*Auth/i, 'NestJS Auth Guard'],
    [/passport\.(authenticate|use)/i, 'Passport.js'],
    [/verifyToken|validateToken|checkToken/i, 'Token verification'],
    [/requireAuth|isAuthenticated|ensureAuth/i, 'Auth middleware'],
    [/jwt\.(verify|decode|sign)/i, 'JWT operation'],
  ],
  network: [
    [/@(RateLimit|Throttle)\s*\(/i, 'Rate limiting'],
    [/helmet\s*\(/i, 'Helmet security'],
    [/cors\s*\(/i, 'CORS policy'],
  ],
  data: [
    [/@(Validate|IsString|IsNumber|IsEmail)\s*\(/i, 'class-validator'],
    [/zod\.(string|number|object)|z\.(string|number|object)/i, 'Zod validation'],
    [/yup\.(string|number|object)/i, 'Yup validation'],
    [/sanitize|escape|encodeURI/i, 'Data sanitization'],
  ],
};

// =============================================================
// Auth Explicit Patterns
// =============================================================

const AUTH_EXPLICIT_PATTERNS: Array<[RegExp, number, string]> = [
  // Explicit declarations
  [/AUTH_FLOW\s*[:=]/i, 10, 'explicit AUTH_FLOW declaration'],
  [/AUTH_FLOW\s*=/i, 10, 'explicit AUTH_FLOW variable'],

  // Functions/classes
  [/function\s+authenticate\s*\(/i, 10, 'authenticate function'],
  [/function\s+authorize\s*\(/i, 10, 'authorize function'],
  [/class\s+\w*Auth\w*\s*(extends|implements|{)/i, 8, 'Auth class'],

  // Decorators
  [/@(Auth|Authenticated|RequireAuth)\s*\(/i, 8, 'Auth decorator'],
  [/@UseGuards\s*\(.*Auth/i, 8, 'NestJS Auth Guard'],

  // Middleware/functions
  [/verifyToken|validateToken/i, 7, 'token verification'],
  [/checkPermission|hasPermission/i, 7, 'permission check'],

  // Libraries
  [/passport\./i, 6, 'Passport.js'],
  [/jwt\./i, 5, 'JWT usage'],
  [/OAuth|oauth/i, 5, 'OAuth usage'],

  // Session
  [/req\.session|ctx\.session/i, 3, 'session access'],
];

// =============================================================
// Secret Patterns
// =============================================================

const SECRET_PATTERNS: Array<[RegExp, string, 'high' | 'medium' | 'low']> = [
  // High - Hardcoded secrets
  [/['"`]?password['"`]?\s*[:=]\s*['"`][^'"`]+['"`]/i, 'password', 'high'],
  [/['"`]?api[_-]?key['"`]?\s*[:=]\s*['"`][^'"`]+['"`]/i, 'api_key', 'high'],
  [/['"`]?secret['"`]?\s*[:=]\s*['"`][^'"`]+['"`]/i, 'secret', 'high'],
  [/['"`]?private[_-]?key['"`]?\s*[:=]\s*['"`][^'"`]+['"`]/i, 'private_key', 'high'],
  [/-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/, 'private_key_pem', 'high'],

  // High - AWS/Cloud credentials
  [/AKIA[0-9A-Z]{16}/, 'aws_access_key', 'high'],
  [/['"`](sk|pk)[-_](live|test)[-_][a-zA-Z0-9]+['"`]/, 'stripe_key', 'high'],

  // Medium
  [/['"`]?token['"`]?\s*[:=]\s*['"`][^'"`]+['"`]/i, 'token', 'medium'],
  [/Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/, 'jwt_token', 'medium'],

  // Low - Environment variable access (OK)
  [/process\.env\.[A-Z_]+KEY/i, 'env_key_access', 'low'],
  [/process\.env\.[A-Z_]+SECRET/i, 'env_secret_access', 'low'],
];

// =============================================================
// Secret Leak Patterns (console output)
// =============================================================

const SECRET_LEAK_PATTERNS: Array<[RegExp, string, 'high' | 'medium']> = [
  // High - Auth/secret info in console
  [/console\.(log|warn|error|info)\s*\(.*\b(password|passwd|pwd)\b/i, 'password_leak', 'high'],
  [/console\.(log|warn|error|info)\s*\(.*\b(api[_-]?key|secret)\b/i, 'api_key_leak', 'high'],
  [/console\.(log|warn|error|info)\s*\(.*\b(token|access[_-]?token)\b/i, 'token_leak', 'high'],
  [/console\.(log|warn|error|info)\s*\(.*\b(credential|private[_-]?key)\b/i, 'credential_leak', 'high'],

  // Medium
  [/console\.(log|warn|error|info)\s*\(.*\b(auth|session)\b/i, 'auth_leak', 'medium'],
];

// =============================================================
// Hidden Dependency Patterns
// =============================================================

const HIDDEN_DEP_PATTERNS = {
  global: [
    /\bglobal\./,
    /\bglobalThis\./,
    /\bwindow\./,
    /\bdocument\./,
  ],
  env: [
    /process\.env/,
    /import\.meta\.env/,
    /Deno\.env/,
  ],
  io: [
    /console\.(log|warn|error|info|debug)/,
    /fs\.(read|write|append|unlink|mkdir)/,
    /fsPromises\./,
    /fetch\s*\(/,
    /axios\./,
    /http\.(get|post|request)/,
  ],
};

// =============================================================
// Analyzer
// =============================================================

export function analyzeBread(source: string, _filePath?: string): BreadResult {
  const lines = source.split('\n');

  const trustBoundaries = detectTrustBoundaries(lines);
  const [authExplicitness, authPatterns] = analyzeAuthExplicitness(source);
  const secretPatterns = detectSecrets(lines);
  const hiddenDeps = countHiddenDeps(source);

  // TypeScript 전용 타입 안전성 분석
  const typeSafety = analyzeTypeSafety(source);

  const violations = collectViolations(
    trustBoundaries,
    authExplicitness,
    authPatterns,
    secretPatterns,
    typeSafety
  );

  return {
    trustBoundaryCount: trustBoundaries.length,
    trustBoundaries,
    authExplicitness,
    authPatterns,
    secretPatterns,
    hiddenDeps,
    violations,
    typeSafety,
  };
}

function detectTrustBoundaries(lines: string[]): TrustBoundary[] {
  const boundaries: TrustBoundary[] = [];

  lines.forEach((line, idx) => {
    for (const [boundaryType, patterns] of Object.entries(TRUST_BOUNDARY_PATTERNS)) {
      for (const [pattern, description] of patterns) {
        if (pattern.test(line)) {
          boundaries.push({
            name: extractName(line),
            line: idx + 1,
            boundaryType: boundaryType as TrustBoundary['boundaryType'],
            description,
          });
        }
      }
    }
  });

  return boundaries;
}

function analyzeAuthExplicitness(source: string): [number, string[]] {
  let totalScore = 0;
  const maxPossible = AUTH_EXPLICIT_PATTERNS.reduce((sum, [, score]) => sum + score, 0);
  const patternsFound: string[] = [];

  for (const [pattern, score, description] of AUTH_EXPLICIT_PATTERNS) {
    if (pattern.test(source)) {
      totalScore += score;
      patternsFound.push(description);
    }
  }

  const explicitness = maxPossible > 0 ? Math.min(1.0, totalScore / maxPossible) : 0;
  return [explicitness, patternsFound];
}

function detectSecrets(lines: string[]): SecretPattern[] {
  const secrets: SecretPattern[] = [];

  lines.forEach((line, idx) => {
    // Hardcoded secrets
    for (const [pattern, patternType, severity] of SECRET_PATTERNS) {
      const match = pattern.exec(line);
      if (match) {
        if (severity === 'low') continue; // env access is OK
        secrets.push({
          line: idx + 1,
          patternType,
          snippet: maskSecret(match[0]),
          severity,
        });
      }
    }

    // Secret leaks in console
    for (const [pattern, patternType, severity] of SECRET_LEAK_PATTERNS) {
      if (pattern.test(line)) {
        secrets.push({
          line: idx + 1,
          patternType,
          snippet: line.trim().slice(0, 50),
          severity,
        });
      }
    }
  });

  return secrets;
}

function countHiddenDeps(source: string): HiddenDeps {
  const count = (patterns: RegExp[]): number =>
    patterns.reduce((sum, p) => sum + (source.match(new RegExp(p.source, 'g')) || []).length, 0);

  const global = count(HIDDEN_DEP_PATTERNS.global);
  const env = count(HIDDEN_DEP_PATTERNS.env);
  const io = count(HIDDEN_DEP_PATTERNS.io);

  return { global, env, io, total: global + env + io };
}

function collectViolations(
  boundaries: TrustBoundary[],
  authExplicitness: number,
  authPatterns: string[],
  secrets: SecretPattern[],
  typeSafety: TypeSafetyResult
): string[] {
  const violations: string[] = [];

  if (boundaries.length === 0) {
    violations.push('No trust boundary defined');
  }

  const authFlowDeclared = authPatterns.some(p => p.includes('AUTH_FLOW'));
  if (!authFlowDeclared && authExplicitness < 0.3) {
    violations.push(`Low auth explicitness: ${authExplicitness.toFixed(2)}`);
  }

  const highSecrets = secrets.filter(s => s.severity === 'high');
  if (highSecrets.length > 0) {
    violations.push(`High severity secrets detected: ${highSecrets.length}`);
  }

  // TypeScript 타입 안전성 위반
  if (typeSafety.anyCount > 3) {
    violations.push(`Excessive 'any' usage: ${typeSafety.anyCount} occurrences`);
  }

  if (typeSafety.tsIgnoreCount > 0) {
    violations.push(`@ts-ignore/@ts-expect-error found: ${typeSafety.tsIgnoreCount}`);
  }

  if (typeSafety.safetyScore < 0.5) {
    violations.push(`Low type safety score: ${typeSafety.safetyScore.toFixed(2)}`);
  }

  return violations;
}

function extractName(line: string): string {
  // Function/class name
  const funcMatch = /function\s+(\w+)|class\s+(\w+)|const\s+(\w+)\s*=/.exec(line);
  if (funcMatch) {
    return funcMatch[1] || funcMatch[2] || funcMatch[3];
  }

  // Decorator
  const decMatch = /@(\w+)/.exec(line);
  if (decMatch) {
    return decMatch[1];
  }

  return line.trim().slice(0, 30);
}

function maskSecret(secret: string): string {
  if (secret.length <= 8) {
    return '*'.repeat(secret.length);
  }
  return secret.slice(0, 4) + '*'.repeat(secret.length - 4);
}

// =============================================================
// TypeScript Type Safety Analysis - Separated for Cognitive Accessibility
// =============================================================

interface AnyUsageResult {
  count: number;
  locations: TypeUnsafeLocation[];
  unknownCount: number;
}

interface AssertionResult {
  count: number;
  locations: TypeUnsafeLocation[];
  nonNullCount: number;
}

/**
 * any 타입 사용 감지 (개념 수 ~7)
 */
function detectAnyUsage(sourceFile: ts.SourceFile): AnyUsageResult {
  const locations: TypeUnsafeLocation[] = [];
  let count = 0;
  let unknownCount = 0;

  function visit(node: ts.Node): void {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

    if (ts.isTypeReferenceNode(node) && node.getText(sourceFile) === 'any') {
      count++;
      locations.push({
        line: line + 1,
        column: character + 1,
        code: node.parent.getText(sourceFile).slice(0, 50),
        reason: 'Explicit any type',
      });
    }

    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      count++;
      locations.push({
        line: line + 1,
        column: character + 1,
        code: node.parent.getText(sourceFile).slice(0, 50),
        reason: 'any keyword in type annotation',
      });
    }

    if (node.kind === ts.SyntaxKind.UnknownKeyword) {
      unknownCount++;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { count, locations, unknownCount };
}

/**
 * Type assertion 감지 (개념 수 ~8)
 */
function detectTypeAssertions(sourceFile: ts.SourceFile): AssertionResult {
  const locations: TypeUnsafeLocation[] = [];
  let count = 0;
  let nonNullCount = 0;

  function visit(node: ts.Node): void {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

    if (ts.isAsExpression(node)) {
      count++;
      const typeText = node.type.getText(sourceFile);
      const severity = typeText === 'any' ? 'as any (dangerous)' : 'type assertion';
      locations.push({
        line: line + 1,
        column: character + 1,
        code: node.getText(sourceFile).slice(0, 50),
        reason: severity,
      });
    }

    if (ts.isTypeAssertionExpression(node)) {
      count++;
      locations.push({
        line: line + 1,
        column: character + 1,
        code: node.getText(sourceFile).slice(0, 50),
        reason: 'angle-bracket assertion',
      });
    }

    if (ts.isNonNullExpression(node)) {
      nonNullCount++;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { count, locations, nonNullCount };
}

/**
 * 타입 안전성 점수 계산 (개념 수 ~5)
 */
function calculateTypeSafetyScore(
  anyCount: number,
  assertionCount: number,
  nonNullCount: number,
  tsIgnoreCount: number,
  unknownCount: number
): number {
  const penalties =
    anyCount * 0.1 +
    assertionCount * 0.05 +
    nonNullCount * 0.02 +
    tsIgnoreCount * 0.15;
  const bonuses = unknownCount * 0.05;
  return Math.max(0, Math.min(1, 1 - penalties + bonuses));
}

/**
 * 타입 안전성 분석 메인 (개념 수 ~8) - 조합만 수행
 */
function analyzeTypeSafety(source: string): TypeSafetyResult {
  const sourceFile = ts.createSourceFile(
    'temp.ts',
    source,
    ts.ScriptTarget.Latest,
    true
  );

  const tsIgnoreLocations: TypeUnsafeLocation[] = [];

  const anyResult = detectAnyUsage(sourceFile);
  const assertionResult = detectTypeAssertions(sourceFile);
  const tsIgnoreCount = countTsIgnoreComments(source, tsIgnoreLocations);

  const safetyScore = calculateTypeSafetyScore(
    anyResult.count,
    assertionResult.count,
    assertionResult.nonNullCount,
    tsIgnoreCount,
    anyResult.unknownCount
  );

  return {
    anyCount: anyResult.count,
    anyLocations: anyResult.locations,
    assertionCount: assertionResult.count,
    assertionLocations: assertionResult.locations,
    nonNullAssertionCount: assertionResult.nonNullCount,
    tsIgnoreCount,
    tsIgnoreLocations,
    unknownCount: anyResult.unknownCount,
    safetyScore,
  };
}

function countTsIgnoreComments(source: string, locations: TypeUnsafeLocation[]): number {
  const lines = source.split('\n');
  let count = 0;

  lines.forEach((line, idx) => {
    // @ts-ignore
    if (/@ts-ignore/.test(line)) {
      count++;
      locations.push({
        line: idx + 1,
        column: line.indexOf('@ts-ignore') + 1,
        code: line.trim().slice(0, 50),
        reason: '@ts-ignore suppresses type checking',
      });
    }

    // ts-expect-error directive
    if (/@ts-expect-error/.test(line)) {
      count++;
      locations.push({
        line: idx + 1,
        column: line.indexOf('@ts-expect-error') + 1,
        code: line.trim().slice(0, 50),
        reason: '@ts-expect-error suppresses type checking',
      });
    }

    // @ts-nocheck (whole file)
    if (/@ts-nocheck/.test(line)) {
      count += 5; // Heavy penalty for disabling entire file
      locations.push({
        line: idx + 1,
        column: line.indexOf('@ts-nocheck') + 1,
        code: line.trim().slice(0, 50),
        reason: '@ts-nocheck disables type checking for entire file',
      });
    }
  });

  return count;
}
