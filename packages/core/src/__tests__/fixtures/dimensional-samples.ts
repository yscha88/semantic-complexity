/**
 * 차원 기반 복잡도 테스트용 샘플 코드
 *
 * 1D: 제어 흐름 (순환복잡도) - cyclomatic-samples.ts 참조
 * 2D: 중첩 (인지복잡도) - cognitive-samples.ts 참조
 * 3D: 상태 복잡도 - 이 파일
 * 4D: 비동기 복잡도 - 이 파일
 * 5D: 숨은 결합 복잡도 - 이 파일
 */

// ═════════════════════════════════════════════════════════════════
// 3D: 상태 복잡도 (State Complexity) 샘플
// ═════════════════════════════════════════════════════════════════

// 상태 변수 없음
export function state0_noState(): number {
  return 42;
}

// 단순 상태 변수
export function state1_simpleState(): string {
  let status = 'pending';
  status = 'completed';
  return status;
}

// 상태 기반 분기
export function state2_stateBranch(status: string): string {
  if (status === 'pending') {
    return 'wait';
  } else if (status === 'active') {
    return 'working';
  }
  return 'done';
}

// switch-enum 상태 머신 패턴
type Status = 'idle' | 'loading' | 'success' | 'error';

export function state3_switchEnum(status: Status): string {
  switch (status) {
    case 'idle':
      return 'Ready';
    case 'loading':
      return 'Loading...';
    case 'success':
      return 'Done!';
    case 'error':
      return 'Failed';
    default:
      return 'Unknown';
  }
}

// 다중 상태 변수
export function state4_multiState(): { mode: string; phase: number } {
  let mode = 'init';
  let phase = 0;
  let isActive = false;

  mode = 'running';
  phase = 1;
  isActive = true;

  if (isActive) {
    phase = 2;
  }

  return { mode, phase };
}

// React useState 시뮬레이션
declare function useState<T>(initial: T): [T, (v: T) => void];

export function state5_reactHooks(): void {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('');

  setCount(count + 1);
  setName('test');

  if (count > 10) {
    setCount(0);
  }
}

// ═════════════════════════════════════════════════════════════════
// 4D: 비동기 복잡도 (Async Complexity) 샘플
// ═════════════════════════════════════════════════════════════════

// 비동기 없음
export function async0_sync(): number {
  return 1 + 1;
}

// 단순 async/await
export async function async1_simpleAsync(): Promise<string> {
  const result = await Promise.resolve('hello');
  return result;
}

// 다중 await
export async function async2_multiAwait(): Promise<number> {
  const a = await Promise.resolve(1);
  const b = await Promise.resolve(2);
  const c = await Promise.resolve(3);
  return a + b + c;
}

// Promise 체인
export function async3_promiseChain(): Promise<number> {
  return Promise.resolve(1)
    .then((x) => x + 1)
    .then((x) => x * 2)
    .catch(() => 0);
}

// Promise.all (병렬)
export async function async4_parallel(): Promise<number[]> {
  const results = await Promise.all([
    Promise.resolve(1),
    Promise.resolve(2),
    Promise.resolve(3),
  ]);
  return results;
}

// Promise.race
export async function async5_race(): Promise<string> {
  const result = await Promise.race([
    new Promise<string>((resolve) => setTimeout(() => resolve('slow'), 1000)),
    new Promise<string>((resolve) => setTimeout(() => resolve('fast'), 100)),
  ]);
  return result;
}

// 타임아웃 패턴
export function async6_timeout(): void {
  setTimeout(() => {
    console.log('delayed');
  }, 1000);

  setInterval(() => {
    console.log('interval');
  }, 500);
}

// 콜백 중첩
export function async7_callbackNesting(): void {
  setTimeout(() => {
    setTimeout(() => {
      setTimeout(() => {
        console.log('deeply nested');
      }, 100);
    }, 100);
  }, 100);
}

// async 함수 내 try-catch
export async function async8_asyncErrorBoundary(): Promise<string> {
  try {
    const result = await fetch('https://api.example.com');
    return await result.text();
  } catch (error) {
    return 'error';
  }
}

// 복합 비동기 패턴
export async function async9_complex(): Promise<number> {
  try {
    const [a, b] = await Promise.all([
      fetch('https://api.example.com/a').then((r) => r.json()),
      fetch('https://api.example.com/b').then((r) => r.json()),
    ]);

    if (a.value > 10) {
      const c = await Promise.race([
        fetch('https://api.example.com/c'),
        new Promise((_, reject) => setTimeout(() => reject('timeout'), 5000)),
      ]);
      return a.value + b.value + c;
    }

    return a.value + b.value;
  } catch {
    return 0;
  }
}

// ═════════════════════════════════════════════════════════════════
// 5D: 숨은 결합 복잡도 (Coupling Complexity) 샘플
// ═════════════════════════════════════════════════════════════════

// 결합 없음 (순수 함수)
export function coupling0_pure(a: number, b: number): number {
  return a + b;
}

// 전역 변수 읽기
declare const globalConfig: { apiUrl: string };

export function coupling1_globalRead(): string {
  return globalConfig.apiUrl;
}

// 전역 변수 쓰기
let globalCounter = 0;

export function coupling2_globalWrite(): number {
  globalCounter++;
  return globalCounter;
}

// console.log (암묵적 I/O)
export function coupling3_consoleLog(message: string): void {
  console.log('INFO:', message);
  console.error('ERROR:', message);
}

// DOM 접근
export function coupling4_domAccess(): Element | null {
  const element = document.getElementById('app');
  document.querySelector('.container');
  return element;
}

// localStorage 접근
export function coupling5_storage(): void {
  localStorage.setItem('key', 'value');
  const value = localStorage.getItem('key');
  console.log(value);
}

// fetch (네트워크 I/O)
export async function coupling6_fetch(): Promise<unknown> {
  const response = await fetch('https://api.example.com/data');
  return response.json();
}

// 환경 변수 의존
declare const process: { env: Record<string, string> };

export function coupling7_envDependency(): string {
  const apiKey = process.env.API_KEY;
  const nodeEnv = process.env.NODE_ENV;
  return `${nodeEnv}: ${apiKey}`;
}

// 이벤트 리스너 등록 (부작용)
export function coupling8_eventListener(): void {
  document.addEventListener('click', () => {
    console.log('clicked');
  });

  window.addEventListener('resize', () => {
    console.log('resized');
  });
}

// 클로저 캡처
export function coupling9_closureCapture(): () => number {
  let counter = 0;

  return () => {
    counter++;
    return counter;
  };
}

// 복합 결합 패턴
export async function coupling10_complex(): Promise<void> {
  const config = globalConfig;
  console.log('Starting with config:', config);

  try {
    const response = await fetch(process.env.API_URL || config.apiUrl);
    const data = await response.json();

    localStorage.setItem('cache', JSON.stringify(data));

    document.getElementById('result')!.textContent = data.message;
  } catch (error) {
    console.error('Error:', error);
  }
}

// ═════════════════════════════════════════════════════════════════
// 복합 차원 패턴 (여러 차원이 결합된 케이스)
// ═════════════════════════════════════════════════════════════════

// 상태 + 비동기 (3D + 4D)
export async function mixed_stateAsync(): Promise<string> {
  let status: Status = 'idle';

  status = 'loading';
  try {
    await fetch('https://api.example.com');
    status = 'success';
  } catch {
    status = 'error';
  }

  return status;
}

// 비동기 + 결합 (4D + 5D)
export async function mixed_asyncCoupling(): Promise<void> {
  console.log('Starting fetch...');

  const data = await fetch(process.env.API_URL!);
  const json = await data.json();

  localStorage.setItem('data', JSON.stringify(json));
  console.log('Saved:', json);
}

// 고복잡도 함수 (모든 차원)
export async function mixed_highComplexity(
  items: Array<{ id: number; status: Status }>
): Promise<void> {
  let processedCount = 0;
  let errorCount = 0;

  console.log('Processing', items.length, 'items');

  for (const item of items) {
    switch (item.status) {
      case 'idle':
        try {
          const response = await fetch(`${process.env.API_URL}/items/${item.id}`);
          if (response.ok) {
            const data = await response.json();
            localStorage.setItem(`item-${item.id}`, JSON.stringify(data));
            processedCount++;
          } else {
            throw new Error('Failed');
          }
        } catch {
          errorCount++;
          console.error('Failed to process item:', item.id);
        }
        break;

      case 'loading':
        await new Promise((r) => setTimeout(r, 100));
        break;

      case 'success':
        processedCount++;
        break;

      case 'error':
        errorCount++;
        break;
    }
  }

  document.getElementById('status')!.textContent =
    `Processed: ${processedCount}, Errors: ${errorCount}`;
}
