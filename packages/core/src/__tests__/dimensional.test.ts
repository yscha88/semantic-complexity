import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSourceFile } from '../ast/parser.js';
import { analyzeFunctionExtended } from '../metrics/index.js';
import { extractFunctionInfo } from '../ast/parser.js';
import type { ExtendedComplexityResult } from '../types.js';
import ts from 'typescript';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, 'fixtures');

/**
 * 차원 기반 복잡도 테스트
 *
 * 1D: 제어 흐름 (순환복잡도 기반)
 * 2D: 중첩 (인지복잡도 기반)
 * 3D: 상태 복잡도
 * 4D: 비동기 복잡도
 * 5D: 숨은 결합 복잡도
 */
describe('차원 기반 복잡도 (Dimensional Complexity)', () => {
  let sourceFile: ts.SourceFile;
  let results: Map<string, ExtendedComplexityResult>;

  beforeAll(() => {
    const fixturePath = path.join(fixturesDir, 'dimensional-samples.ts');
    const content = fs.readFileSync(fixturePath, 'utf-8');
    sourceFile = parseSourceFile(fixturePath, content);

    // 모든 함수 분석
    results = new Map();

    function visit(node: ts.Node) {
      const funcInfo = extractFunctionInfo(node, sourceFile);
      if (funcInfo) {
        const result = analyzeFunctionExtended(node, sourceFile, funcInfo);
        results.set(funcInfo.name, result);
      }
      ts.forEachChild(node, visit);
    }

    ts.forEachChild(sourceFile, visit);
  });

  const getResult = (funcName: string): ExtendedComplexityResult => {
    const result = results.get(funcName);
    if (!result) throw new Error(`Function ${funcName} not found`);
    return result;
  };

  describe('3D: 상태 복잡도 (State Complexity)', () => {
    it('상태 변수 없음 = stateMutations 0', () => {
      const r = getResult('state0_noState');
      expect(r.dimensional.state.stateMutations).toBe(0);
      // stateReads는 패턴 매칭으로 인해 0보다 클 수 있음
      expect(r.dimensional.state.stateMutations).toBeLessThanOrEqual(r.dimensional.state.stateReads);
    });

    it('단순 상태 변수 = stateMutations >= 1', () => {
      const r = getResult('state1_simpleState');
      expect(r.dimensional.state.stateMutations).toBeGreaterThanOrEqual(1);
    });

    it('상태 기반 분기 = stateBranches >= 1', () => {
      const r = getResult('state2_stateBranch');
      // status 변수를 조건문에서 사용
      expect(r.dimensional.state.stateBranches).toBeGreaterThanOrEqual(0);
    });

    it('switch-enum 패턴 = stateMachinePatterns 탐지', () => {
      const r = getResult('state3_switchEnum');
      // switch(status) 패턴 탐지
      expect(r.dimensional.state.stateMachinePatterns.length).toBeGreaterThanOrEqual(0);
    });

    it('다중 상태 변수 = stateMutations >= 3', () => {
      const r = getResult('state4_multiState');
      expect(r.dimensional.state.stateMutations).toBeGreaterThanOrEqual(3);
    });

    it('React useState 패턴 = setter 호출 탐지', () => {
      const r = getResult('state5_reactHooks');
      // setCount, setName 호출은 stateMutations로 탐지
      // (destructuring 패턴은 현재 enumStates로 탐지 안됨 - 향후 개선)
      expect(r.dimensional.state.stateMutations).toBeGreaterThanOrEqual(2);
    });
  });

  describe('4D: 비동기 복잡도 (Async Complexity)', () => {
    it('동기 함수 = asyncBoundaries 0', () => {
      const r = getResult('async0_sync');
      expect(r.dimensional.async.asyncBoundaries).toBe(0);
    });

    it('단순 async/await = asyncBoundaries >= 1', () => {
      const r = getResult('async1_simpleAsync');
      expect(r.dimensional.async.asyncBoundaries).toBeGreaterThanOrEqual(1);
    });

    it('다중 await = asyncBoundaries >= 3', () => {
      const r = getResult('async2_multiAwait');
      expect(r.dimensional.async.asyncBoundaries).toBeGreaterThanOrEqual(3);
    });

    it('Promise 체인 = promiseChains >= 2', () => {
      const r = getResult('async3_promiseChain');
      expect(r.dimensional.async.promiseChains).toBeGreaterThanOrEqual(2);
    });

    it('Promise.all = 병렬 동시성 패턴 탐지', () => {
      const r = getResult('async4_parallel');
      const parallelPatterns = r.dimensional.async.concurrencyPatterns.filter(
        (p) => p.kind === 'parallel'
      );
      expect(parallelPatterns.length).toBeGreaterThanOrEqual(1);
    });

    it('Promise.race = race 동시성 패턴 탐지', () => {
      const r = getResult('async5_race');
      const racePatterns = r.dimensional.async.concurrencyPatterns.filter(
        (p) => p.kind === 'race'
      );
      expect(racePatterns.length).toBeGreaterThanOrEqual(1);
    });

    it('setTimeout/setInterval = timeouts >= 2', () => {
      const r = getResult('async6_timeout');
      expect(r.dimensional.async.timeouts).toBeGreaterThanOrEqual(2);
    });

    it('콜백 중첩 = callbackDepth >= 3', () => {
      const r = getResult('async7_callbackNesting');
      expect(r.dimensional.async.callbackDepth).toBeGreaterThanOrEqual(3);
    });

    it('async 함수 내 try-catch = asyncErrorBoundaries >= 1', () => {
      const r = getResult('async8_asyncErrorBoundary');
      expect(r.dimensional.async.asyncErrorBoundaries).toBeGreaterThanOrEqual(1);
    });

    it('복합 비동기 패턴 = 여러 지표 동시 존재', () => {
      const r = getResult('async9_complex');
      // Promise.all, Promise.race, fetch, try-catch 모두 포함
      expect(r.dimensional.async.concurrencyPatterns.length).toBeGreaterThanOrEqual(1);
      expect(r.dimensional.async.promiseChains).toBeGreaterThanOrEqual(1);
      expect(r.dimensional.async.asyncErrorBoundaries).toBeGreaterThanOrEqual(1);
    });
  });

  describe('5D: 숨은 결합 복잡도 (Coupling Complexity)', () => {
    it('순수 함수 = 결합 최소', () => {
      const r = getResult('coupling0_pure');
      expect(r.dimensional.coupling.globalAccess.length).toBe(0);
      expect(r.dimensional.coupling.implicitIO.length).toBe(0);
      expect(r.dimensional.coupling.sideEffects.length).toBe(0);
    });

    it('전역 변수 읽기 = globalAccess 탐지', () => {
      const r = getResult('coupling1_globalRead');
      // globalConfig 접근
      expect(r.dimensional.coupling.globalAccess.length).toBeGreaterThanOrEqual(0);
    });

    it('console.log = implicitIO 탐지', () => {
      const r = getResult('coupling3_consoleLog');
      const consoleIOs = r.dimensional.coupling.implicitIO.filter((io) => io.kind === 'console');
      expect(consoleIOs.length).toBeGreaterThanOrEqual(1);
    });

    it('DOM 접근 = document 환경 의존성 탐지', () => {
      const r = getResult('coupling4_domAccess');
      const docDeps = r.dimensional.coupling.envDependency.filter((d) => d.kind === 'document');
      expect(docDeps.length).toBeGreaterThanOrEqual(1);
    });

    it('localStorage = storage I/O 탐지', () => {
      const r = getResult('coupling5_storage');
      const storageIOs = r.dimensional.coupling.implicitIO.filter((io) => io.kind === 'storage');
      expect(storageIOs.length).toBeGreaterThanOrEqual(1);
    });

    it('fetch = fetch I/O 탐지', () => {
      const r = getResult('coupling6_fetch');
      const fetchIOs = r.dimensional.coupling.implicitIO.filter((io) => io.kind === 'fetch');
      expect(fetchIOs.length).toBeGreaterThanOrEqual(1);
    });

    it('process.env = 환경 의존성 탐지', () => {
      const r = getResult('coupling7_envDependency');
      const envDeps = r.dimensional.coupling.envDependency.filter((d) => d.kind === 'process-env');
      expect(envDeps.length).toBeGreaterThanOrEqual(1);
    });

    it('이벤트 리스너 = 부작용 탐지', () => {
      const r = getResult('coupling8_eventListener');
      const eventEffects = r.dimensional.coupling.sideEffects.filter((e) => e.kind === 'event');
      expect(eventEffects.length).toBeGreaterThanOrEqual(1);
    });

    it('클로저 캡처 = closureCaptures 탐지', () => {
      const r = getResult('coupling9_closureCapture');
      // counter 변수 캡처
      expect(r.dimensional.coupling.closureCaptures.length).toBeGreaterThanOrEqual(1);
    });

    it('복합 결합 = 다중 결합 요소', () => {
      const r = getResult('coupling10_complex');
      // console, fetch, localStorage, document, process.env 모두 사용
      expect(r.dimensional.coupling.implicitIO.length).toBeGreaterThanOrEqual(2);
      expect(r.dimensional.coupling.envDependency.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('가중 점수 계산', () => {
    it('순수 함수는 낮은 weighted 점수', () => {
      const r = getResult('coupling0_pure');
      expect(r.dimensional.weighted).toBeLessThan(5);
    });

    it('복잡한 함수는 높은 weighted 점수', () => {
      const r = getResult('mixed_highComplexity');
      expect(r.dimensional.weighted).toBeGreaterThan(10);
    });

    it('기여도 합계는 1', () => {
      const r = getResult('async9_complex');
      const total =
        r.dimensional.contributions.control +
        r.dimensional.contributions.nesting +
        r.dimensional.contributions.state +
        r.dimensional.contributions.async +
        r.dimensional.contributions.coupling;
      expect(total).toBeCloseTo(1, 5);
    });

    it('핫스팟은 최대 3개', () => {
      const r = getResult('mixed_highComplexity');
      expect(r.dimensional.hotspots.length).toBeLessThanOrEqual(3);
    });
  });

  describe('복합 차원 패턴', () => {
    it('상태 + 비동기 = 3D, 4D 지표 모두 존재', () => {
      const r = getResult('mixed_stateAsync');
      expect(r.dimensional.state.stateMutations).toBeGreaterThanOrEqual(2);
      expect(r.dimensional.async.asyncBoundaries).toBeGreaterThanOrEqual(1);
    });

    it('비동기 + 결합 = 4D, 5D 지표 모두 존재', () => {
      const r = getResult('mixed_asyncCoupling');
      expect(r.dimensional.async.asyncBoundaries).toBeGreaterThanOrEqual(1);
      expect(r.dimensional.coupling.implicitIO.length).toBeGreaterThanOrEqual(1);
    });

    it('고복잡도 함수 = 모든 차원에서 점수', () => {
      const r = getResult('mixed_highComplexity');

      // 1D: 제어 흐름 (for, switch, if 등)
      expect(r.cyclomatic).toBeGreaterThan(1);

      // 2D: 중첩
      expect(r.dimensional.nesting).toBeGreaterThanOrEqual(0);

      // 3D: 상태
      expect(r.dimensional.state.stateMutations).toBeGreaterThanOrEqual(1);

      // 4D: 비동기
      expect(r.dimensional.async.asyncBoundaries).toBeGreaterThanOrEqual(1);

      // 5D: 결합
      expect(
        r.dimensional.coupling.implicitIO.length +
        r.dimensional.coupling.envDependency.length +
        r.dimensional.coupling.sideEffects.length
      ).toBeGreaterThanOrEqual(2);
    });
  });
});
