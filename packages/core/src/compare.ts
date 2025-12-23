/**
 * McCabe 순환복잡도 vs 차원 복잡도 비교 분석기
 *
 * 사용법:
 *   npx tsx src/compare.ts <파일경로>
 *   npx tsx src/compare.ts <파일경로> --json
 *   npx tsx src/compare.ts <파일경로> --threshold=10
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';
import { parseSourceFile, extractFunctionInfo } from './ast/parser.js';
import { analyzeFunctionExtended } from './metrics/index.js';
import type { ExtendedComplexityResult, DimensionalHotspot } from './types.js';

// ─────────────────────────────────────────────────────────────────
// 분석 결과 타입
// ─────────────────────────────────────────────────────────────────

interface ComparisonResult {
  function: string;
  location: string;

  // McCabe (1D)
  mccabe: number;
  mccabeGrade: 'low' | 'moderate' | 'high' | 'very-high';

  // SonarSource Cognitive
  cognitive: number;
  cognitiveGrade: 'low' | 'moderate' | 'high' | 'very-high';

  // 차원 복잡도
  dimensional: {
    weighted: number;
    control: number;   // 1D
    nesting: number;   // 2D
    state: number;     // 3D (스칼라)
    async: number;     // 4D (스칼라)
    coupling: number;  // 5D (스칼라)
  };

  // 분석 인사이트
  insights: string[];
  hotspots: DimensionalHotspot[];

  // McCabe 대비 차원 복잡도 비율
  dimensionalRatio: number;
}

// ─────────────────────────────────────────────────────────────────
// 등급 판정
// ─────────────────────────────────────────────────────────────────

function getMcCabeGrade(complexity: number): ComparisonResult['mccabeGrade'] {
  if (complexity <= 5) return 'low';
  if (complexity <= 10) return 'moderate';
  if (complexity <= 20) return 'high';
  return 'very-high';
}

function getCognitiveGrade(complexity: number): ComparisonResult['cognitiveGrade'] {
  if (complexity <= 5) return 'low';
  if (complexity <= 10) return 'moderate';
  if (complexity <= 15) return 'high';
  return 'very-high';
}

// ─────────────────────────────────────────────────────────────────
// 스칼라 점수 계산 (dimensional.ts와 동일 로직)
// ─────────────────────────────────────────────────────────────────

function scoreState(result: ExtendedComplexityResult): number {
  const s = result.dimensional.state;
  return (
    s.enumStates * 1 +
    s.stateMutations * 2 +
    s.stateReads * 0.5 +
    s.stateBranches * 3 +
    s.stateMachinePatterns.length * 5
  );
}

function scoreAsync(result: ExtendedComplexityResult): number {
  const a = result.dimensional.async;
  return (
    a.asyncBoundaries * 1 +
    a.promiseChains * 2 +
    a.retryPatterns * 3 +
    a.timeouts * 2 +
    a.callbackDepth * 3 +
    a.concurrencyPatterns.length * 4 +
    a.asyncErrorBoundaries * 1
  );
}

function scoreCoupling(result: ExtendedComplexityResult): number {
  const c = result.dimensional.coupling;
  return (
    c.globalAccess.length * 2 +
    c.implicitIO.length * 2 +
    c.sideEffects.length * 3 +
    c.envDependency.length * 2 +
    c.closureCaptures.length * 1
  );
}

// ─────────────────────────────────────────────────────────────────
// 인사이트 생성
// ─────────────────────────────────────────────────────────────────

function generateInsights(result: ExtendedComplexityResult): string[] {
  const insights: string[] = [];
  const d = result.dimensional;

  // McCabe vs 차원 복잡도 비교
  const mccabe = result.cyclomatic;
  const weighted = d.weighted;

  if (weighted > mccabe * 2) {
    insights.push(
      `⚠️ 차원 복잡도(${weighted.toFixed(1)})가 McCabe(${mccabe})의 2배 이상 - 숨은 복잡도 존재`
    );
  }

  // 차원별 분석
  const stateScore = scoreState(result);
  const asyncScore = scoreAsync(result);
  const couplingScore = scoreCoupling(result);

  // 3D 상태
  if (d.state.stateMutations > 3) {
    insights.push(`🔄 상태 변경 ${d.state.stateMutations}회 - 상태 관리 복잡도 높음`);
  }
  if (d.state.stateMachinePatterns.length > 0) {
    insights.push(`🎛️ 상태 머신 패턴 ${d.state.stateMachinePatterns.length}개 탐지`);
  }

  // 4D 비동기
  if (d.async.callbackDepth > 2) {
    insights.push(`📥 콜백 중첩 깊이 ${d.async.callbackDepth} - 콜백 지옥 위험`);
  }
  if (d.async.concurrencyPatterns.length > 1) {
    insights.push(`⚡ 동시성 패턴 ${d.async.concurrencyPatterns.length}개 - 레이스 컨디션 주의`);
  }
  if (d.async.asyncErrorBoundaries === 0 && d.async.asyncBoundaries > 0) {
    insights.push(`🚨 비동기 코드에 에러 처리 없음`);
  }

  // 5D 결합
  if (d.coupling.globalAccess.length > 2) {
    insights.push(`🌐 전역 접근 ${d.coupling.globalAccess.length}회 - 테스트 어려움`);
  }
  if (d.coupling.sideEffects.length > 2) {
    insights.push(`💥 부작용 ${d.coupling.sideEffects.length}개 - 예측 불가능성 증가`);
  }
  if (d.coupling.closureCaptures.length > 3) {
    insights.push(`🔒 클로저 캡처 ${d.coupling.closureCaptures.length}개 - 메모리 누수 주의`);
  }

  // 차원 불균형 분석
  const scores = [
    { name: '상태(3D)', score: stateScore },
    { name: '비동기(4D)', score: asyncScore },
    { name: '결합(5D)', score: couplingScore },
  ].filter((s) => s.score > 0);

  if (scores.length > 0) {
    const maxScore = Math.max(...scores.map((s) => s.score));
    const dominant = scores.find((s) => s.score === maxScore);
    if (dominant && maxScore > 5) {
      insights.push(`📊 주요 복잡도 원인: ${dominant.name} (점수: ${maxScore.toFixed(1)})`);
    }
  }

  return insights;
}

// ─────────────────────────────────────────────────────────────────
// 파일 분석
// ─────────────────────────────────────────────────────────────────

export function analyzeFile(filePath: string): ComparisonResult[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = parseSourceFile(filePath, content);
  const results: ComparisonResult[] = [];

  function visit(node: ts.Node) {
    const funcInfo = extractFunctionInfo(node, sourceFile);
    if (funcInfo) {
      const result = analyzeFunctionExtended(node, sourceFile, funcInfo);
      const loc = funcInfo.location;

      const stateScore = scoreState(result);
      const asyncScore = scoreAsync(result);
      const couplingScore = scoreCoupling(result);

      const comparison: ComparisonResult = {
        function: funcInfo.name,
        location: `${path.basename(filePath)}:${loc.startLine}`,

        mccabe: result.cyclomatic,
        mccabeGrade: getMcCabeGrade(result.cyclomatic),

        cognitive: result.cognitive,
        cognitiveGrade: getCognitiveGrade(result.cognitive),

        dimensional: {
          weighted: result.dimensional.weighted,
          control: result.dimensional.control,
          nesting: result.dimensional.nesting,
          state: stateScore,
          async: asyncScore,
          coupling: couplingScore,
        },

        insights: generateInsights(result),
        hotspots: result.dimensional.hotspots,

        dimensionalRatio:
          result.cyclomatic > 0
            ? Math.round((result.dimensional.weighted / result.cyclomatic) * 100) / 100
            : 0,
      };

      results.push(comparison);
    }

    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sourceFile, visit);
  return results;
}

// ─────────────────────────────────────────────────────────────────
// 콘솔 출력
// ─────────────────────────────────────────────────────────────────

function printComparison(results: ComparisonResult[], threshold: number = 0): void {
  const filtered = results.filter(
    (r) => r.mccabe >= threshold || r.dimensional.weighted >= threshold
  );

  if (filtered.length === 0) {
    console.log(`\n임계값 ${threshold} 이상인 함수가 없습니다.\n`);
    return;
  }

  console.log('\n' + '═'.repeat(80));
  console.log(' McCabe vs 차원 복잡도 비교 분석');
  console.log('═'.repeat(80));

  // 헤더
  console.log(
    '\n' +
      '함수명'.padEnd(30) +
      'McCabe'.padStart(8) +
      'Cognitive'.padStart(10) +
      'Dimensional'.padStart(12) +
      'Ratio'.padStart(8)
  );
  console.log('-'.repeat(68));

  for (const r of filtered.sort((a, b) => b.dimensional.weighted - a.dimensional.weighted)) {
    console.log(
      r.function.slice(0, 28).padEnd(30) +
        `${r.mccabe}`.padStart(8) +
        `${r.cognitive}`.padStart(10) +
        `${r.dimensional.weighted.toFixed(1)}`.padStart(12) +
        `${r.dimensionalRatio}x`.padStart(8)
    );

    // 차원별 분포
    const dims = r.dimensional;
    const bar = (score: number, max: number = 20): string => {
      const filled = Math.min(Math.round((score / max) * 10), 10);
      return '█'.repeat(filled) + '░'.repeat(10 - filled);
    };

    console.log(`  └─ 1D 제어:  ${bar(dims.control)} ${dims.control.toFixed(1)}`);
    console.log(`     2D 중첩:  ${bar(dims.nesting)} ${dims.nesting.toFixed(1)}`);
    console.log(`     3D 상태:  ${bar(dims.state)} ${dims.state.toFixed(1)}`);
    console.log(`     4D 비동기: ${bar(dims.async)} ${dims.async.toFixed(1)}`);
    console.log(`     5D 결합:  ${bar(dims.coupling)} ${dims.coupling.toFixed(1)}`);

    // 인사이트
    if (r.insights.length > 0) {
      console.log('  인사이트:');
      for (const insight of r.insights) {
        console.log(`    ${insight}`);
      }
    }
    console.log();
  }

  // 요약 통계
  console.log('─'.repeat(80));
  console.log('📊 요약 통계');
  console.log('─'.repeat(80));

  const avgMccabe = filtered.reduce((s, r) => s + r.mccabe, 0) / filtered.length;
  const avgDimensional = filtered.reduce((s, r) => s + r.dimensional.weighted, 0) / filtered.length;
  const avgRatio = filtered.reduce((s, r) => s + r.dimensionalRatio, 0) / filtered.length;

  console.log(`  분석 함수: ${filtered.length}개`);
  console.log(`  평균 McCabe: ${avgMccabe.toFixed(1)}`);
  console.log(`  평균 차원 복잡도: ${avgDimensional.toFixed(1)}`);
  console.log(`  평균 비율 (차원/McCabe): ${avgRatio.toFixed(2)}x`);

  // 고위험 함수
  const highRisk = filtered.filter((r) => r.dimensionalRatio > 2 || r.dimensional.weighted > 20);
  if (highRisk.length > 0) {
    console.log(`\n  ⚠️ 고위험 함수 (ratio > 2x 또는 weighted > 20):`);
    for (const r of highRisk) {
      console.log(`    - ${r.function} @ ${r.location}`);
    }
  }

  console.log('\n' + '═'.repeat(80));
}

// ─────────────────────────────────────────────────────────────────
// 해석 가이드 출력
// ─────────────────────────────────────────────────────────────────

function printGuide(): void {
  console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                    McCabe vs 차원 복잡도 해석 가이드                       ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  📐 McCabe 순환복잡도 (1976)                                               ║
║  ─────────────────────────────────────────────────────────────────────────  ║
║  • 정의: 분기점 개수 + 1                                                   ║
║  • 측정: if, switch case, for, while, catch, &&, ||, ?:                    ║
║  • 한계: 중첩 무시, 상태/비동기/결합 미반영                                ║
║                                                                            ║
║  등급 기준:                                                                ║
║    🟢 1-5:   Low (단순, 테스트 용이)                                       ║
║    🟡 6-10:  Moderate (적정)                                               ║
║    🟠 11-20: High (리팩토링 권장)                                          ║
║    🔴 21+:   Very High (반드시 리팩토링)                                   ║
║                                                                            ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  🧠 차원 복잡도 (Dimensional Complexity)                                   ║
║  ─────────────────────────────────────────────────────────────────────────  ║
║                                                                            ║
║  1D 제어 (×1.0): 순환복잡도 기반                                           ║
║  2D 중첩 (×1.5): 중첩으로 인한 인지 부하                                   ║
║  3D 상태 (×2.0): 상태 변수, 상태 머신 패턴                                 ║
║  4D 비동기 (×2.5): async/await, Promise, 콜백                              ║
║  5D 결합 (×3.0): 전역 접근, I/O, 부작용, 환경 의존                         ║
║                                                                            ║
║  가중치 근거:                                                              ║
║  • 상태: 버그 발생률 2배 (IBM 연구)                                        ║
║  • 비동기: 디버깅 시간 2.5배 (Salesforce 연구)                             ║
║  • 결합: 테스트 커버리지 달성 3배 어려움                                   ║
║                                                                            ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  📊 비율 (Ratio) 해석                                                      ║
║  ─────────────────────────────────────────────────────────────────────────  ║
║                                                                            ║
║  Ratio = 차원 복잡도 / McCabe                                              ║
║                                                                            ║
║  • < 1.5: 순수한 제어 흐름 중심 (McCabe로 충분)                            ║
║  • 1.5-2.0: 중첩/상태가 추가됨 (주의 필요)                                 ║
║  • 2.0-3.0: 비동기/결합 복잡도 높음 (리팩토링 권장)                        ║
║  • > 3.0: 숨은 복잡도 심각 (McCabe가 과소평가)                             ║
║                                                                            ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  🎯 실무 권장 임계값                                                       ║
║  ─────────────────────────────────────────────────────────────────────────  ║
║                                                                            ║
║  PoC/MVP 단계:                                                             ║
║    • McCabe ≤ 15                                                           ║
║    • 차원 복잡도 ≤ 30                                                      ║
║                                                                            ║
║  Production 단계:                                                          ║
║    • McCabe ≤ 10                                                           ║
║    • 차원 복잡도 ≤ 20                                                      ║
║    • Ratio ≤ 2.0                                                           ║
║                                                                            ║
║  Mission Critical:                                                         ║
║    • McCabe ≤ 5                                                            ║
║    • 차원 복잡도 ≤ 10                                                      ║
║    • 5D 결합 = 0 (순수 함수)                                               ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
`);
}

// ─────────────────────────────────────────────────────────────────
// CLI 엔트리포인트
// ─────────────────────────────────────────────────────────────────

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
사용법:
  npx tsx src/compare.ts <파일경로> [옵션]

옵션:
  --json           JSON 형식으로 출력
  --threshold=N    복잡도 N 이상인 함수만 표시 (기본: 0)
  --guide          해석 가이드 표시
  --help, -h       도움말

예제:
  npx tsx src/compare.ts ./src/components/Signup.tsx
  npx tsx src/compare.ts ./src/api/handler.ts --threshold=5
  npx tsx src/compare.ts ./src/utils.ts --json
  npx tsx src/compare.ts --guide
`);
    return;
  }

  if (args.includes('--guide')) {
    printGuide();
    return;
  }

  const filePath = args.find((a) => !a.startsWith('--'));
  if (!filePath) {
    console.error('파일 경로를 지정해주세요.');
    process.exit(1);
  }

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`파일을 찾을 수 없습니다: ${resolvedPath}`);
    process.exit(1);
  }

  const isJson = args.includes('--json');
  const thresholdArg = args.find((a) => a.startsWith('--threshold='));
  const threshold = thresholdArg ? parseInt(thresholdArg.split('=')[1], 10) : 0;

  const results = analyzeFile(resolvedPath);

  if (isJson) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    printGuide();
    printComparison(results, threshold);
  }
}

main();
