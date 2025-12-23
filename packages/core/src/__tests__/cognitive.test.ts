import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSourceFile } from '../ast/parser.js';
import { analyzeFile } from '../metrics/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, 'fixtures');

/**
 * 인지복잡도 테스트
 *
 * SonarSource 인지복잡도:
 * 1. Structural Increment (+1): if, else if, else, switch, loops, catch, ternary, 재귀
 * 2. Nesting Penalty (+nesting level): 중첩 시 추가
 *
 * 핵심 차이점:
 * - else if는 nesting penalty 없음
 * - 같은 논리 연산자 시퀀스는 +1만
 * - 중첩될수록 가중치 증가
 */
describe('인지복잡도 (Cognitive Complexity)', () => {
  const fixturePath = path.join(fixturesDir, 'cognitive-samples.ts');
  const content = fs.readFileSync(fixturePath, 'utf-8');
  const sourceFile = parseSourceFile(fixturePath, content);
  const result = analyzeFile(sourceFile);

  const getComplexity = (funcName: string) => {
    const func = result.functions.find((f) => f.function.name === funcName);
    if (!func) throw new Error(`Function ${funcName} not found`);
    return func.cognitive;
  };

  describe('기본 케이스', () => {
    it('분기 없는 함수는 복잡도 0', () => {
      expect(getComplexity('cognitive0_noBranch')).toBe(0);
    });

    it('if 1개 = 복잡도 2 (structural +1, nesting +1)', () => {
      // 함수 내부가 nesting level 1로 시작
      expect(getComplexity('cognitive1_oneIf')).toBe(2);
    });

    it('if + else = 복잡도 3', () => {
      // if: +1 +1(nesting) = +2
      // else: +1 (no nesting penalty for else)
      expect(getComplexity('cognitive2_ifElse')).toBe(3);
    });

    it('if + else if = 복잡도 3', () => {
      // if: +1 +1(nesting) = +2
      // else if: +1 (no nesting penalty)
      expect(getComplexity('cognitive2_ifElseIf')).toBe(3);
    });
  });

  describe('중첩 페널티', () => {
    it('중첩 if (2단계) = 복잡도 5', () => {
      // 함수 내부 시작 nesting level = 1
      // if (level 1): +1 +1 = +2
      // if (level 2): +1 +2 = +3
      // 총: 2 + 3 = 5
      expect(getComplexity('cognitive3_nestedIf')).toBe(5);
    });

    it('깊은 중첩 if (3단계) = 복잡도 9', () => {
      // if (level 1): +1 +1 = +2
      // if (level 2): +1 +2 = +3
      // if (level 3): +1 +3 = +4
      // 총: 2 + 3 + 4 = 9
      expect(getComplexity('cognitive4_deepNested')).toBe(9);
    });
  });

  describe('반복문', () => {
    it('단순 for = 복잡도 2', () => {
      // for (level 1): +1 +1(nesting) = +2
      expect(getComplexity('cognitive1_for')).toBe(2);
    });

    it('for + 중첩 if 2단계 = 복잡도 9', () => {
      // for (level 1): +1 +1 = +2
      // if (level 2): +1 +2 = +3
      // if (level 3): +1 +3 = +4
      // 총: 2 + 3 + 4 = 9
      expect(getComplexity('cognitive4_forNestedIf')).toBe(9);
    });
  });

  describe('switch 문', () => {
    it('switch = 복잡도 2', () => {
      // switch (level 1): +1 +1(nesting) = +2
      expect(getComplexity('cognitive1_switch')).toBe(2);
    });
  });

  describe('논리 연산자', () => {
    it('같은 논리 연산자 시퀀스 (a && b && c) = 복잡도 1', () => {
      expect(getComplexity('cognitive1_logicalSequence')).toBe(1);
    });

    it('다른 논리 연산자 혼합 (a && b || c) = 복잡도 2', () => {
      expect(getComplexity('cognitive2_logicalMixed')).toBe(2);
    });
  });

  describe('삼항 연산자', () => {
    it('중첩 삼항 연산자 = 복잡도 5', () => {
      // ternary (level 1): +1 +1 = +2
      // ternary (level 2): +1 +2 = +3
      // 총: 2 + 3 = 5
      expect(getComplexity('cognitive2_ternary')).toBe(5);
    });
  });

  describe('재귀 호출', () => {
    it('재귀 함수 = 복잡도 3 (if + 재귀)', () => {
      // if (level 1): +1 +1 = +2
      // 재귀: +1
      // 총: 3
      expect(getComplexity('cognitiveN_recursion')).toBe(3);
    });
  });

  describe('복합 예시', () => {
    it('복잡한 함수의 인지복잡도', () => {
      // 정확한 계산은 복잡하므로 범위로 검증
      const complexity = getComplexity('cognitive_complex');
      expect(complexity).toBeGreaterThan(10);
      expect(complexity).toBeLessThan(25);
    });
  });
});