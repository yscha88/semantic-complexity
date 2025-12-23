/**
 * Cross-language compatibility test sample (TypeScript)
 *
 * This file contains simple functions to test that all analyzers
 * produce compatible output structures across TypeScript, Python, and Go.
 */

// Simple function with control flow
export function simpleControl(x: number): string {
  if (x > 0) {
    return 'positive';
  } else if (x < 0) {
    return 'negative';
  }
  return 'zero';
}

// Function with nesting
export function nestedLoop(arr: number[][]): number {
  let sum = 0;
  for (const row of arr) {
    for (const val of row) {
      if (val > 0) {
        sum += val;
      }
    }
  }
  return sum;
}

// Function with state mutations
export function stateMutation(): number {
  let state = 0;
  let status = 'idle';

  status = 'processing';
  state = 1;

  status = 'done';
  state = 2;

  return state;
}

// Async function
export async function asyncFunction(): Promise<string> {
  const response = await fetch('/api/data');
  const data = await response.json();
  return data.message;
}

// Function with coupling (side effects)
export function coupledFunction(msg: string): void {
  console.log(msg);
  localStorage.setItem('lastMsg', msg);
}
