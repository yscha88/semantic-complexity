import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSourceFile } from '../ast/parser.js';
import { analyzeFile } from '../metrics/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, 'fixtures');

/**
 * 순환복잡도 테스트
 *
 * McCabe 순환복잡도: V(G) = E - N + 2P (간단히: 분기점 + 1)
 *
 * 분기점:
 * - if, else if: +1
 * - case (switch): +1
 * - for, for-in, for-of, while, do-while: +1
 * - catch: +1
 * - 삼항 연산자 (?:): +1
 * - &&, ||, ??: +1
 */
describe('순환복잡도 (Cyclomatic Complexity)', () => {
  const fixturePath = path.join(fixturesDir, 'cyclomatic-samples.ts');
  const content = fs.readFileSync(fixturePath, 'utf-8');
  const sourceFile = parseSourceFile(fixturePath, content);
  const result = analyzeFile(sourceFile);

  const getComplexity = (funcName: string) => {
    const func = result.functions.find((f) => f.function.name === funcName);
    if (!func) throw new Error(`Function ${funcName} not found`);
    return func.cyclomatic;
  };

  describe('기본 케이스', () => {
    it('분기 없는 함수는 복잡도 1', () => {
      expect(getComplexity('complexity1_noBranch')).toBe(1);
    });

    it('if 1개 = 복잡도 2', () => {
      expect(getComplexity('complexity2_oneIf')).toBe(2);
    });

    it('if + else if = 복잡도 3', () => {
      expect(getComplexity('complexity3_ifElseIf')).toBe(3);
    });

    it('if + else if + else if = 복잡도 4', () => {
      expect(getComplexity('complexity4_threeConditions')).toBe(4);
    });
  });

  describe('반복문', () => {
    it('for + if = 복잡도 3', () => {
      expect(getComplexity('complexity3_forWithIf')).toBe(3);
    });

    it('while + 중첩 if 2개 = 복잡도 4', () => {
      expect(getComplexity('complexity5_whileNested')).toBe(4);
    });

    it('do-while + for + if + else if = 복잡도 5', () => {
      expect(getComplexity('complexity6_doWhileForIf')).toBe(5);
    });
  });

  describe('switch 문', () => {
    it('switch with 3 cases = 복잡도 4', () => {
      expect(getComplexity('complexity4_switch')).toBe(4);
    });
  });

  describe('삼항 연산자', () => {
    it('중첩 삼항 연산자 2개 = 복잡도 3', () => {
      expect(getComplexity('complexity3_ternary')).toBe(3);
    });
  });

  describe('논리 연산자', () => {
    it('&& || = 복잡도 3', () => {
      expect(getComplexity('complexity4_logical')).toBe(3);
    });

    it('?? ?? = 복잡도 3', () => {
      expect(getComplexity('complexity3_nullish')).toBe(3);
    });
  });

  describe('try-catch', () => {
    it('try-catch + if 2개 = 복잡도 4', () => {
      expect(getComplexity('complexity4_tryCatch')).toBe(4);
    });
  });

  describe('복합 조건식', () => {
    it('if(a && b) + else if(b || c) + else if(c && d || a) = 복잡도 8', () => {
      // if: +1, &&: +1
      // else if: +1, ||: +1
      // else if: +1, &&: +1, ||: +1
      // 기본: +1
      // 총: 1 + 2 + 2 + 3 = 8
      expect(getComplexity('complexity7_complexConditions')).toBe(8);
    });
  });
});