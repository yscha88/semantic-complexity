/**
 * Essential Complexity Waiver System
 *
 * 본질적 복잡도 면제 시스템:
 * - __essential_complexity__ 파싱 (인라인)
 * - .waiver.json 파일 지원 (외부)
 * - ADR 존재 여부 검증
 * - ComplexityContext (토대 정보) 생성
 *
 * 사용법:
 *   // 방법 1: 모듈에서 인라인 선언
 *   export const __essential_complexity__ = {
 *     adr: "docs/adr/003-inference-complexity.md",
 *   };
 *
 *   // 방법 2: 프로젝트 루트에 .waiver.json 파일 생성
 *   // {
 *   //   "version": "1.0",
 *   //   "waivers": [
 *   //     { "pattern": "src/crypto/*.ts", "adr": "ADR-007" }
 *   //   ]
 *   // }
 *
 *   // Gate에서 체크
 *   const waiver = checkWaiver(source, filePath);
 *   if (waiver.waived) {
 *     // 복잡도 검사 유예
 *   }
 */

import * as ts from 'typescript';
import { existsSync, readFileSync } from 'fs';
import { join, dirname, relative } from 'path';

// ============================================================
// 타입 정의
// ============================================================

export interface EssentialComplexityConfig {
  adr?: string;
  nesting?: number;
  conceptsTotal?: number;
  conceptsParams?: number;
}

export interface ComplexitySignal {
  category: 'math' | 'algorithm' | 'domain';
  pattern: string;
  description: string;
}

export interface ComplexityContext {
  signals: ComplexitySignal[];
  imports: string[];
  metrics: Record<string, number>;
  questions: string[];
}

export interface WaiverResult {
  waived: boolean;
  reason?: string;
  adrPath?: string;
  config?: EssentialComplexityConfig;
  externalWaiver?: ExternalWaiverEntry;
}

// ============================================================
// 외부 .waiver.json 타입 정의
// ============================================================

export interface ExternalWaiverEntry {
  pattern: string;
  adr: string;
  justification?: string;
  approvedAt?: string;  // YYYY-MM-DD
  expiresAt?: string | null;  // YYYY-MM-DD or null (영구)
  approver?: string;
}

export interface WaiverFile {
  $schema?: string;
  version: string;
  waivers: ExternalWaiverEntry[];
}

// ============================================================
// 본질적 복잡도 신호 패턴
// ============================================================

type SignalCategory = 'math' | 'algorithm' | 'domain';

export const ESSENTIAL_COMPLEXITY_SIGNALS: Record<SignalCategory, Array<[RegExp, string]>> = {
  math: [
    [/np\.(linalg|fft|einsum)/, 'linear algebra / signal processing'],
    [/torch\.(matmul|einsum|conv\dd)/, 'tensor operations'],
    [/\b(gradient|jacobian|hessian)\b/i, 'calculus'],
    [/\b(eigenvalue|eigenvector|svd)\b/i, 'matrix decomposition'],
    [/tf\.(matmul|linalg|signal)/, 'TensorFlow ops'],
  ],
  algorithm: [
    [/function\s+(\w+)\s*\([^)]*\)[^{]*\{[\s\S]*?\1\s*\(/, 'recursion'],
    [/(memo|dp|cache)\[/, 'dynamic programming'],
    [/(visited|seen)\s*=\s*(new\s+Set|{})/, 'graph traversal'],
    [/\.sort\s*\(\s*\(.*\)\s*=>/, 'custom sorting'],
    [/while\s*\([^)]*\)\s*\{[\s\S]*?(left|right|mid)/, 'binary search'],
  ],
  domain: [
    [/(voxel|slice|volume|segmentation)/i, '3D imaging'],
    [/(encrypt|decrypt|cipher|hash)/i, 'cryptography'],
    [/(tokenize|parse|ast\.)/i, 'parsing/compilation'],
    [/(patient|diagnosis|medical)/i, 'healthcare'],
    [/(tensor|embedding|attention)/i, 'ML/deep learning'],
  ],
};

// 복잡 도메인 라이브러리
export const COMPLEX_DOMAIN_LIBRARIES = new Set([
  'tensorflow',
  '@tensorflow/tfjs',
  'torch',
  'onnxruntime',
  'crypto',
  'node:crypto',
  'd3',
  'three',
  'mathjs',
  'numeric',
  'ml-matrix',
]);

// ============================================================
// __essential_complexity__ 파싱
// ============================================================

export function parseEssentialComplexity(source: string): EssentialComplexityConfig | null {
  let sourceFile: ts.SourceFile;
  try {
    sourceFile = ts.createSourceFile(
      'temp.ts',
      source,
      ts.ScriptTarget.Latest,
      true
    );
  } catch {
    return null;
  }

  let config: EssentialComplexityConfig | null = null;

  function visit(node: ts.Node): void {
    // export const __essential_complexity__ = { ... }
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (
          ts.isIdentifier(decl.name) &&
          decl.name.text === '__essential_complexity__' &&
          decl.initializer &&
          ts.isObjectLiteralExpression(decl.initializer)
        ) {
          config = parseConfigObject(decl.initializer);
          return;
        }
      }
    }

    // const __essential_complexity__ = { ... } (without export)
    if (ts.isVariableDeclaration(node)) {
      if (
        ts.isIdentifier(node.name) &&
        node.name.text === '__essential_complexity__' &&
        node.initializer &&
        ts.isObjectLiteralExpression(node.initializer)
      ) {
        config = parseConfigObject(node.initializer);
        return;
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return config;
}

function parseConfigObject(obj: ts.ObjectLiteralExpression): EssentialComplexityConfig {
  const config: EssentialComplexityConfig = {};

  for (const prop of obj.properties) {
    if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
      const key = prop.name.text;

      if (key === 'adr' && ts.isStringLiteral(prop.initializer)) {
        config.adr = prop.initializer.text;
      } else if (key === 'nesting' && ts.isNumericLiteral(prop.initializer)) {
        config.nesting = Number(prop.initializer.text);
      } else if (key === 'concepts') {
        if (ts.isNumericLiteral(prop.initializer)) {
          config.conceptsTotal = Number(prop.initializer.text);
        } else if (ts.isObjectLiteralExpression(prop.initializer)) {
          for (const inner of prop.initializer.properties) {
            if (ts.isPropertyAssignment(inner) && ts.isIdentifier(inner.name)) {
              if (inner.name.text === 'total' && ts.isNumericLiteral(inner.initializer)) {
                config.conceptsTotal = Number(inner.initializer.text);
              } else if (inner.name.text === 'params' && ts.isNumericLiteral(inner.initializer)) {
                config.conceptsParams = Number(inner.initializer.text);
              }
            }
          }
        }
      }
    }
  }

  return config;
}

// ============================================================
// 신호 탐지
// ============================================================

export function detectComplexitySignals(source: string): ComplexitySignal[] {
  const signals: ComplexitySignal[] = [];
  const seen = new Set<string>();

  for (const [category, patterns] of Object.entries(ESSENTIAL_COMPLEXITY_SIGNALS) as Array<
    [SignalCategory, Array<[RegExp, string]>]
  >) {
    for (const [pattern, description] of patterns) {
      const patternKey = pattern.source;
      if (seen.has(patternKey)) continue;

      if (pattern.test(source)) {
        signals.push({
          category,
          pattern: patternKey,
          description,
        });
        seen.add(patternKey);
      }
    }
  }

  return signals;
}

export function detectComplexImports(source: string): string[] {
  let sourceFile: ts.SourceFile;
  try {
    sourceFile = ts.createSourceFile(
      'temp.ts',
      source,
      ts.ScriptTarget.Latest,
      true
    );
  } catch {
    return [];
  }

  const imports: string[] = [];

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const moduleName = node.moduleSpecifier.text;
      const baseName = moduleName.split('/')[0];

      if (COMPLEX_DOMAIN_LIBRARIES.has(moduleName) || COMPLEX_DOMAIN_LIBRARIES.has(baseName)) {
        imports.push(moduleName);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return [...new Set(imports)];
}

// ============================================================
// 질문 생성
// ============================================================

export function generateReviewQuestions(
  signals: ComplexitySignal[],
  imports: string[]
): string[] {
  const questions: string[] = [];

  for (const signal of signals) {
    switch (signal.category) {
      case 'math':
        questions.push(`${signal.description} - 라이브러리 함수로 대체 가능?`);
        break;
      case 'algorithm':
        questions.push(`${signal.description} - 표준 라이브러리/더 간단한 대안?`);
        break;
      case 'domain':
        questions.push(`${signal.description} - 기존 프레임워크 컴포넌트 재사용 가능?`);
        break;
    }
  }

  if (imports.some((i) => i.includes('tensorflow') || i.includes('torch'))) {
    questions.push('ML 파이프라인 - 고수준 API 사용 가능?');
  }

  if (signals.length === 0 && imports.length === 0) {
    questions.push('복잡도 신호 없음 - 리팩토링으로 해결 가능?');
  }

  return questions;
}

// ============================================================
// 토대 정보 생성
// ============================================================

export function buildComplexityContext(
  source: string,
  metrics: Record<string, number> = {}
): ComplexityContext {
  const signals = detectComplexitySignals(source);
  const imports = detectComplexImports(source);
  const questions = generateReviewQuestions(signals, imports);

  return {
    signals,
    imports,
    metrics,
    questions,
  };
}

// ============================================================
// Layer 1: 외부 .waiver.json 파일 파싱
// ============================================================

export function parseWaiverFile(waiverPath: string): WaiverFile | null {
  try {
    if (!existsSync(waiverPath)) {
      return null;
    }
    const content = readFileSync(waiverPath, 'utf-8');
    const data = JSON.parse(content);

    // 기본 스키마 검증
    if (!data.version || !Array.isArray(data.waivers)) {
      return null;
    }

    // waivers 배열 파싱
    const waivers: ExternalWaiverEntry[] = data.waivers.map((w: Record<string, unknown>) => ({
      pattern: String(w.pattern || ''),
      adr: String(w.adr || ''),
      justification: w.justification ? String(w.justification) : undefined,
      approvedAt: w.approved_at ? String(w.approved_at) : undefined,
      expiresAt: w.expires_at === null ? null : (w.expires_at ? String(w.expires_at) : undefined),
      approver: w.approver ? String(w.approver) : undefined,
    }));

    return {
      $schema: data.$schema,
      version: data.version,
      waivers,
    };
  } catch {
    return null;
  }
}

// ============================================================
// Layer 2: .waiver.json 파일 탐색
// ============================================================

export function findWaiverFile(filePath: string, projectRoot: string): string | null {
  const normalizedPath = filePath.replace(/\\/g, '/');
  const normalizedRoot = projectRoot.replace(/\\/g, '/');

  let currentDir = dirname(normalizedPath);

  while (currentDir.startsWith(normalizedRoot) || currentDir === normalizedRoot) {
    const waiverPath = join(currentDir, '.waiver.json');
    if (existsSync(waiverPath)) {
      return waiverPath;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      break;  // 루트 도달
    }
    currentDir = parentDir;
  }

  return null;
}

// ============================================================
// Layer 3: 파일 패턴 매칭
// ============================================================

export function matchFilePattern(filePath: string, pattern: string): boolean {
  // 경로 정규화 (Windows 백슬래시 -> 슬래시)
  const normalizedPath = filePath.replace(/\\/g, '/');
  const normalizedPattern = pattern.replace(/\\/g, '/');

  // 글롭 패턴을 정규식으로 변환
  const regexPattern = normalizedPattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '<<<DOUBLE_STAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<<DOUBLE_STAR>>>/g, '.*')
    .replace(/\?/g, '.');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(normalizedPath);
}

// ============================================================
// Layer 4: 외부 waiver 만료 체크
// ============================================================

export function isWaiverExpired(entry: ExternalWaiverEntry): boolean {
  if (!entry.expiresAt) {
    return false;  // null 또는 undefined = 영구
  }

  try {
    const expiryDate = new Date(entry.expiresAt);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return today > expiryDate;
  } catch {
    return false;  // 파싱 실패 시 만료되지 않은 것으로 처리
  }
}

// ============================================================
// Layer 5: 외부 waiver 체크
// ============================================================

export function checkExternalWaiver(
  filePath: string,
  projectRoot: string
): WaiverResult {
  const waiverFilePath = findWaiverFile(filePath, projectRoot);

  if (!waiverFilePath) {
    return { waived: false, reason: '.waiver.json 파일 없음' };
  }

  const waiverFile = parseWaiverFile(waiverFilePath);
  if (!waiverFile) {
    return { waived: false, reason: '.waiver.json 파싱 실패' };
  }

  // 상대 경로로 변환하여 패턴 매칭
  const relativePath = relative(projectRoot, filePath).replace(/\\/g, '/');

  for (const entry of waiverFile.waivers) {
    if (matchFilePattern(relativePath, entry.pattern)) {
      // 만료 체크
      if (isWaiverExpired(entry)) {
        return {
          waived: false,
          reason: `waiver 만료됨: ${entry.expiresAt}`,
          adrPath: entry.adr,
          externalWaiver: entry,
        };
      }

      return {
        waived: true,
        reason: entry.justification,
        adrPath: entry.adr,
        externalWaiver: entry,
      };
    }
  }

  return { waived: false, reason: '매칭되는 waiver 패턴 없음' };
}

// ============================================================
// Layer 6: 통합 Waiver 체크 (외부 우선, 인라인 폴백)
// ============================================================

export function checkWaiver(
  source: string,
  filePath?: string,
  projectRoot?: string
): WaiverResult {
  // 1. 외부 waiver 체크 (우선순위 높음)
  if (filePath && projectRoot) {
    const externalResult = checkExternalWaiver(filePath, projectRoot);
    if (externalResult.waived || externalResult.externalWaiver) {
      return externalResult;
    }
  }

  // 2. 인라인 waiver 체크 (폴백)
  return checkInlineWaiver(source, filePath, projectRoot);
}

// ============================================================
// 인라인 Waiver 체크 (기존 로직)
// ============================================================

export function checkInlineWaiver(
  source: string,
  filePath?: string,
  projectRoot?: string
): WaiverResult {
  const config = parseEssentialComplexity(source);

  if (!config) {
    return { waived: false, reason: '__essential_complexity__ 없음' };
  }

  if (!config.adr) {
    return {
      waived: false,
      reason: 'ADR 경로 없음',
      config,
    };
  }

  // ADR 경로 해석
  let adrFullPath: string;

  if (projectRoot) {
    adrFullPath = join(projectRoot, config.adr);
  } else if (filePath) {
    adrFullPath = join(dirname(filePath), config.adr);
  } else {
    adrFullPath = config.adr;
  }

  // ADR 존재 여부 체크
  if (!existsSync(adrFullPath)) {
    return {
      waived: false,
      reason: `ADR 파일 없음: ${config.adr}`,
      adrPath: config.adr,
      config,
    };
  }

  // ADR 최소 내용 체크
  try {
    const adrContent = readFileSync(adrFullPath, 'utf-8');
    if (adrContent.trim().length < 50) {
      return {
        waived: false,
        reason: 'ADR 파일이 너무 짧음 (< 50자)',
        adrPath: config.adr,
        config,
      };
    }
  } catch {
    return {
      waived: false,
      reason: `ADR 파일 읽기 실패: ${config.adr}`,
      adrPath: config.adr,
      config,
    };
  }

  // 유예 승인
  return {
    waived: true,
    adrPath: config.adr,
    config,
  };
}
