# McCabe vs 차원 복잡도 비교 가이드

## 사용법

```bash
# 파일 분석
pnpm compare <파일경로>

# 임계값 지정 (복잡도 5 이상만)
pnpm compare <파일경로> --threshold=5

# JSON 출력
pnpm compare <파일경로> --json

# 해석 가이드만 보기
pnpm guide
```

## 핵심 개념

### McCabe 순환복잡도 (1976)

```
V(G) = 분기점 개수 + 1
```

| 분기점 | 설명 |
|--------|------|
| `if` | 조건문 |
| `else if` | 추가 조건 |
| `case` | switch 케이스 |
| `for`, `while`, `do-while` | 반복문 |
| `catch` | 예외 처리 |
| `&&`, `\|\|`, `??` | 논리 연산자 |
| `?:` | 삼항 연산자 |

**한계점:**
- 중첩 깊이 무시
- 상태 관리 복잡도 미반영
- 비동기 처리 복잡도 미반영
- 숨은 결합(side effects) 미반영

### 차원 복잡도 (Dimensional Complexity)

| 차원 | 가중치 | 측정 대상 |
|------|--------|-----------|
| 1D 제어 | ×1.0 | 순환복잡도 기반 분기점 |
| 2D 중첩 | ×1.5 | 인지복잡도 nesting penalty |
| 3D 상태 | ×2.0 | 상태 변수, setter, 상태 머신 |
| 4D 비동기 | ×2.5 | async/await, Promise, 타임아웃, 콜백 |
| 5D 결합 | ×3.0 | 전역 접근, I/O, 부작용, 환경 의존 |

## 비율(Ratio) 해석

```
Ratio = 차원 복잡도 / McCabe
```

| Ratio | 의미 | 조치 |
|-------|------|------|
| < 1.5 | 순수 제어 흐름 | McCabe로 충분 |
| 1.5-2.0 | 중첩/상태 추가됨 | 주의 필요 |
| 2.0-3.0 | 비동기/결합 복잡 | 리팩토링 권장 |
| > 3.0 | 숨은 복잡도 심각 | McCabe 과소평가, 분리 필수 |

## 실무 예시

### 예시 1: 순수 함수 (Ratio < 1.5)

```typescript
// McCabe: 3, Dimensional: 4.5, Ratio: 1.5x
function calculateDiscount(price: number, quantity: number): number {
  if (quantity > 100) {        // +1
    return price * 0.8;
  } else if (quantity > 50) {  // +1
    return price * 0.9;
  }
  return price;
}
```

**분석:**
- 1D 제어: 3
- 2D~5D: 0
- 결론: McCabe로 충분히 측정됨

### 예시 2: 상태 결합 (Ratio 2-3x)

```typescript
// McCabe: 2, Dimensional: 8.0, Ratio: 4x
function handleSubmit(form: FormState): void {
  let isValid = true;
  let errorCount = 0;

  if (!form.email) {    // +1
    isValid = false;    // 상태 변경
    errorCount++;       // 상태 변경
  }

  setFormState({        // 상태 변경
    isValid,
    errorCount,
  });
}
```

**분석:**
- 1D 제어: 2
- 3D 상태: 4 (3개 상태 변경)
- 결론: 상태 관리가 복잡도의 주요 원인

### 예시 3: 비동기 + 결합 (Ratio > 5x)

```typescript
// McCabe: 3, Dimensional: 45.0, Ratio: 15x
async function fetchUserData(userId: string): Promise<User> {
  console.log('Fetching user:', userId);  // 암묵적 I/O

  try {
    const response = await fetch(         // 비동기 경계
      `${process.env.API_URL}/users/${userId}`  // 환경 의존
    );

    if (!response.ok) {  // +1
      throw new Error('Failed');
    }

    const data = await response.json();   // 비동기 경계
    localStorage.setItem('user', JSON.stringify(data));  // 부작용

    return data;
  } catch (error) {  // +1
    console.error('Error:', error);  // 암묵적 I/O
    throw error;
  }
}
```

**분석:**
- 1D 제어: 3
- 4D 비동기: 8 (2 async 경계, 1 에러 처리)
- 5D 결합: 25 (console, fetch, localStorage, process.env)
- 결론: **McCabe가 심각하게 과소평가**, 리팩토링 필요

## 리팩토링 전략

### 3D 상태 복잡도 줄이기

```typescript
// Before: 상태 변경 분산
function process(items: Item[]) {
  let total = 0;
  let count = 0;
  let hasError = false;

  for (const item of items) {
    if (item.valid) {
      total += item.value;
      count++;
    } else {
      hasError = true;
    }
  }
}

// After: 불변 연산으로 변환
function process(items: Item[]) {
  const validItems = items.filter(i => i.valid);
  const total = validItems.reduce((sum, i) => sum + i.value, 0);
  const count = validItems.length;
  const hasError = items.some(i => !i.valid);
}
```

### 4D 비동기 복잡도 줄이기

```typescript
// Before: 콜백 중첩
setTimeout(() => {
  fetchData().then(data => {
    process(data).then(result => {
      save(result);
    });
  });
}, 1000);

// After: async/await + 에러 처리
async function execute() {
  await delay(1000);
  const data = await fetchData();
  const result = await process(data);
  await save(result);
}
```

### 5D 결합 복잡도 줄이기

```typescript
// Before: 전역/환경 의존
function getConfig() {
  return {
    apiUrl: process.env.API_URL,
    debug: window.DEBUG_MODE,
  };
}

// After: 의존성 주입
function getConfig(env: { API_URL: string }, options: { debug: boolean }) {
  return {
    apiUrl: env.API_URL,
    debug: options.debug,
  };
}
```

## 임계값 권장

| 단계 | McCabe | 차원 복잡도 | Ratio |
|------|--------|-------------|-------|
| PoC/MVP | ≤ 15 | ≤ 30 | ≤ 3.0 |
| Production | ≤ 10 | ≤ 20 | ≤ 2.0 |
| Mission Critical | ≤ 5 | ≤ 10 | ≤ 1.5 |

## CI/CD 통합

```json
// package.json
{
  "scripts": {
    "lint:complexity": "tsx src/compare.ts src/**/*.ts --threshold=10 --json | jq '.[] | select(.dimensionalRatio > 2)'"
  }
}
```

```yaml
# GitHub Actions
- name: Complexity Check
  run: |
    pnpm compare src/ --threshold=10 --json > complexity.json
    HIGH_RISK=$(jq '[.[] | select(.dimensionalRatio > 2)] | length' complexity.json)
    if [ "$HIGH_RISK" -gt 0 ]; then
      echo "❌ $HIGH_RISK functions with ratio > 2x"
      exit 1
    fi
```

## 핵심 요약

1. **McCabe가 낮아도 안심하지 말 것** - Ratio가 높으면 숨은 복잡도 존재
2. **5D 결합이 가장 위험** - 가중치 3배, 테스트/디버깅 비용 급증
3. **4D 비동기는 에러 처리 필수** - 에러 경계 없으면 경고
4. **3D 상태는 불변으로** - 상태 변경 최소화
5. **Ratio > 3x는 반드시 리팩토링** - McCabe만 보면 과소평가
