# semantic-complexity

Multi-dimensional code complexity analyzer using algebraic topology and tensor analysis.

## Installation

```bash
npm install semantic-complexity
```

## Quick Start

```typescript
import { analyzeSource, calculateTensorScore } from 'semantic-complexity';

const source = `
function example(data) {
  if (data) {
    for (const item of data) {
      console.log(item);
    }
  }
}
`;

const result = analyzeSource(source);
console.log(result.functions[0].complexity);
```

## Features

- **Multi-Domain Complexity**: Control, Nesting, State, Async, Coupling
- **2nd-Order Tensor Scoring**: `score = vᵀMv + ⟨v,w⟩ + ε‖v‖²`
- **8 Module Types**: api, lib, app, web, data, infra, deploy, unknown
- **CDR-Inspired Dual Metrics**: Tensor Score + Raw Sum

## API

### Core Functions

```typescript
// Analyze source code
analyzeSource(source: string, fileName?: string): FileAnalysisResult

// Analyze file path
analyzeFilePath(filePath: string): FileAnalysisResult

// Calculate tensor score
calculateTensorScore(result: ExtendedComplexityResult, moduleType?: ModuleType): TensorScore
```

### Tensor Score

```typescript
interface TensorScore {
  linear: number;      // ⟨v,w⟩
  quadratic: number;   // vᵀMv
  raw: number;         // linear + quadratic
  regularized: number; // raw + ε‖v‖²
  rawSum: number;      // C + N + S + A + Λ
  rawSumThreshold: number;
  rawSumRatio: number;
}
```

## Documentation

Full documentation: [GitHub Repository](https://github.com/yscha88/semantic-complexity)

## License

MIT
