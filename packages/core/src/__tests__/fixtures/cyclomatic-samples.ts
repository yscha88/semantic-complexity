/**
 * 순환복잡도 테스트용 샘플 코드
 *
 * McCabe 순환복잡도 공식: V(G) = 분기점 개수 + 1
 *
 * 분기점:
 * - if, else if: +1
 * - case (switch): +1
 * - for, for-in, for-of, while, do-while: +1
 * - catch: +1
 * - 삼항 연산자: +1
 * - &&, ||, ??: +1
 */

// ─── 순환복잡도 1: 분기 없음 ─────────────────────────────────
export function complexity1_noBranch(): string {
  return 'hello';
}

// ─── 순환복잡도 2: if 1개 ─────────────────────────────────────
export function complexity2_oneIf(x: boolean): string {
  if (x) {
    return 'yes';
  }
  return 'no';
}

// ─── 순환복잡도 3: if + else if ───────────────────────────────
export function complexity3_ifElseIf(x: number): string {
  if (x > 0) {
    return 'positive';
  } else if (x < 0) {
    return 'negative';
  }
  return 'zero';
}

// ─── 순환복잡도 4: if + else if + else if ─────────────────────
export function complexity4_threeConditions(x: number): string {
  if (x > 100) {
    return 'large';
  } else if (x > 10) {
    return 'medium';
  } else if (x > 0) {
    return 'small';
  }
  return 'zero or negative';
}

// ─── 순환복잡도 3: for 루프 + if ──────────────────────────────
export function complexity3_forWithIf(arr: number[]): number {
  let sum = 0;
  for (const n of arr) {  // +1
    if (n > 0) {          // +1
      sum += n;
    }
  }
  return sum;
}

// ─── 순환복잡도 4: switch with 3 cases ────────────────────────
export function complexity4_switch(status: number): string {
  switch (status) {
    case 0:               // +1
      return 'pending';
    case 1:               // +1
      return 'active';
    case 2:               // +1
      return 'completed';
    default:
      return 'unknown';
  }
}

// ─── 순환복잡도 3: 삼항 연산자 2개 ────────────────────────────
export function complexity3_ternary(a: boolean, b: boolean): string {
  return a ? 'a-true' : b ? 'b-true' : 'both-false';
  //       ^            ^
  //      +1           +1
}

// ─── 순환복잡도 4: 논리 연산자 ─────────────────────────────────
export function complexity4_logical(a: boolean, b: boolean, c: boolean): boolean {
  return a && b || c;
  //       ^    ^
  //      +1   +1   (2개 논리 연산자 = +2, 기본 +1 = 3) -> 틀림, 실제로는 3
}

// 정정: complexity는 3이어야 함 (&&와 || 각각 +1, 기본 1)

// ─── 순환복잡도 3: nullish coalescing ─────────────────────────
export function complexity3_nullish(a: string | null, b: string | null): string {
  return a ?? b ?? 'default';
  //       ^    ^
  //      +1   +1
}

// ─── 순환복잡도 4: try-catch + if ─────────────────────────────
export function complexity4_tryCatch(x: number): string {
  try {
    if (x < 0) {          // +1
      throw new Error('negative');
    }
    if (x === 0) {        // +1
      return 'zero';
    }
    return 'positive';
  } catch (e) {           // +1
    return 'error';
  }
}

// ─── 순환복잡도 5: while + 중첩 if ────────────────────────────
export function complexity5_whileNested(arr: number[]): number {
  let i = 0;
  let sum = 0;
  while (i < arr.length) {    // +1
    if (arr[i] > 0) {         // +1
      if (arr[i] > 10) {      // +1
        sum += arr[i] * 2;
      } else {
        sum += arr[i];
      }
    } else {                  // else는 분기점 아님
      sum -= 1;
    }
    i++;
  }
  return sum;
}

// ─── 순환복잡도 6: do-while + for + if ────────────────────────
export function complexity6_doWhileForIf(n: number): number {
  let result = 0;
  let count = 0;
  do {                        // +1
    for (let i = 0; i < n; i++) {  // +1
      if (i % 2 === 0) {      // +1
        result += i;
      } else if (i % 3 === 0) {  // +1
        result += i * 2;
      } else {
        result += 1;
      }
    }
    count++;
  } while (count < 3);
  return result;
}

// ─── 순환복잡도 7: 복합 조건식 ─────────────────────────────────
export function complexity7_complexConditions(
  a: boolean,
  b: boolean,
  c: boolean,
  d: boolean
): string {
  if (a && b) {              // if: +1, &&: +1
    return 'ab';
  } else if (b || c) {       // else if: +1, ||: +1
    return 'bc';
  } else if (c && d || a) {  // else if: +1, &&: +1, ||: +1
    return 'cda';
  }
  return 'none';
}