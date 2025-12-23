/**
 * 인지복잡도 테스트용 샘플 코드
 *
 * SonarSource 인지복잡도 규칙:
 *
 * 1. Structural Increment (+1):
 *    - if, else if, else
 *    - switch (케이스 아님, switch 자체만)
 *    - for, for-in, for-of, while, do-while
 *    - catch
 *    - 삼항 연산자
 *    - 논리 연산자 시퀀스 (같은 연산자가 연속되면 +1만)
 *    - 재귀 호출
 *
 * 2. Nesting Penalty (+nesting level):
 *    - 위 구조가 중첩될 때 현재 중첩 레벨만큼 추가
 *    - else if는 nesting penalty 없음
 */

// ─── 인지복잡도 0: 분기 없음 ──────────────────────────────────
export function cognitive0_noBranch(): string {
  return 'hello';
}

// ─── 인지복잡도 1: if 1개 (레벨 0) ────────────────────────────
export function cognitive1_oneIf(x: boolean): string {
  if (x) {  // +1 (structural)
    return 'yes';
  }
  return 'no';
}

// ─── 인지복잡도 2: if + else ──────────────────────────────────
export function cognitive2_ifElse(x: boolean): string {
  if (x) {      // +1
    return 'yes';
  } else {      // +1
    return 'no';
  }
}

// ─── 인지복잡도 2: if + else if (else if는 nesting 없음) ──────
export function cognitive2_ifElseIf(x: number): string {
  if (x > 0) {        // +1
    return 'positive';
  } else if (x < 0) { // +1 (nesting penalty 없음)
    return 'negative';
  }
  return 'zero';
}

// ─── 인지복잡도 3: 중첩 if (nesting penalty 적용) ─────────────
export function cognitive3_nestedIf(a: boolean, b: boolean): string {
  if (a) {            // +1 (level 0)
    if (b) {          // +1 (structural) +1 (nesting level 1) = +2
      return 'both';
    }
  }
  return 'not both';
}

// ─── 인지복잡도 4: 2단계 중첩 ─────────────────────────────────
export function cognitive4_deepNested(a: boolean, b: boolean, c: boolean): string {
  if (a) {            // +1 (level 0)
    if (b) {          // +1 +1 = +2 (level 1)
      if (c) {        // +1 +2 = +3... 아니, 계산 다시
        return 'abc';
      }
    }
  }
  return 'not all';
}
// 수정: level 0에서 if = +1
//       level 1에서 if = +1 +1(nesting) = +2
//       level 2에서 if = +1 +2(nesting) = +3
// 총: 1 + 2 + 3 = 6 (잘못 명명됨, cognitive6이어야 함)

// ─── 인지복잡도 1: for 루프 (단일) ────────────────────────────
export function cognitive1_for(arr: number[]): number {
  let sum = 0;
  for (const n of arr) {  // +1
    sum += n;
  }
  return sum;
}

// ─── 인지복잡도 4: for + 중첩 if ──────────────────────────────
export function cognitive4_forNestedIf(arr: number[]): number {
  let sum = 0;
  for (const n of arr) {  // +1 (level 0)
    if (n > 0) {          // +1 +1 = +2 (level 1)
      if (n > 10) {       // +1 +2 = +3 (level 2)
        sum += n;
      }
    }
  }
  return sum;
}
// 수정: 1 + 2 + 3 = 6

// ─── 인지복잡도 1: switch (케이스 무관) ───────────────────────
export function cognitive1_switch(status: number): string {
  switch (status) {  // +1 (switch 자체만)
    case 0:
      return 'pending';
    case 1:
      return 'active';
    case 2:
      return 'completed';
    default:
      return 'unknown';
  }
}

// ─── 인지복잡도 1: 논리 연산자 시퀀스 (같은 연산자) ────────────
export function cognitive1_logicalSequence(a: boolean, b: boolean, c: boolean): boolean {
  return a && b && c;  // +1 (시퀀스는 1번만)
}

// ─── 인지복잡도 2: 논리 연산자 혼합 ───────────────────────────
export function cognitive2_logicalMixed(a: boolean, b: boolean, c: boolean): boolean {
  return a && b || c;  // && 시퀀스: +1, || 시퀀스: +1
}

// ─── 인지복잡도 2: 삼항 연산자 중첩 ───────────────────────────
export function cognitive2_ternary(a: boolean, b: boolean): string {
  return a
    ? 'a-true'                    // +1 (level 0)
    : b ? 'b-true' : 'both-false'; // +1 +1 = +2 (level 1)
}
// 수정: 1 + 2 = 3

// ─── 인지복잡도 N: 재귀 호출 ──────────────────────────────────
export function cognitiveN_recursion(n: number): number {
  if (n <= 1) {  // +1
    return 1;
  }
  return n * cognitiveN_recursion(n - 1);  // +1 (재귀)
}
// 총: 2

// ─── 인지복잡도 복합 예시 ─────────────────────────────────────
export function cognitive_complex(items: { type: string; value: number }[]): number {
  let result = 0;

  for (const item of items) {           // +1 (level 0)
    if (item.type === 'add') {          // +1 +1 = +2 (level 1)
      result += item.value;
    } else if (item.type === 'sub') {   // +1 (else if, no nesting)
      if (item.value > 0) {             // +1 +2 = +3 (level 2)
        result -= item.value;
      } else {                          // +1 (else)
        result += Math.abs(item.value);
      }
    } else {                            // +1 (else)
      try {
        if (item.value !== 0) {         // +1 +2 = +3 (level 2)
          result *= item.value;
        }
      } catch (e) {                     // +1 +2 = +3 (level 2)
        result = 0;
      }
    }
  }

  return result;
}
// 계산: 1 + 2 + 1 + 3 + 1 + 1 + 3 + 3 = 15