#!/usr/bin/env node
/**
 * semantic-complexity MCP Server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { analyzeBread } from '../analyzers/bread.js';
import { analyzeCheese } from '../analyzers/cheese.js';
import { analyzeHam } from '../analyzers/ham.js';
import { normalize, calculateEquilibrium, getLabel } from '../simplex/index.js';
import { checkGate } from '../gate/index.js';
import { checkBudget, calculateDelta } from '../budget/index.js';
import { suggestRefactor, checkDegradation } from '../recommend/index.js';
import type { GateType, ModuleType, SimplexCoordinates } from '../types/index.js';

// Usage guide for LLM
const USAGE_GUIDE = `# semantic-complexity 사용 가이드

## 개요
Ham Sandwich Theorem 기반 코드 복잡도 분석기입니다.
코드를 3가지 축으로 분석하여 균형 잡힌 품질을 측정합니다.

## 3축 모델 (Bread-Cheese-Ham)

### 🍞 Bread (보안성)
- Trust Boundary 정의 여부
- 인증/인가 명시성
- 시크릿 하드코딩 탐지
- 숨겨진 의존성 (환경변수, 파일I/O)

### 🧀 Cheese (인지 가능성)
- 중첩 깊이 (≤4 권장)
- 개념 수 (≤9개/함수, Miller's Law)
- state×async×retry 동시 사용 금지
- 숨겨진 의존성 최소화

### 🥓 Ham (행동 보존)
- 테스트 커버리지
- Golden Test 존재 여부
- Critical Path 보호율

## 도구 사용 시나리오

| 시나리오 | 도구 |
|----------|------|
| 코드 전체 품질 분석 | analyze_sandwich |
| 인지 복잡도만 확인 | analyze_cheese |
| PR 리뷰 시 품질 게이트 | check_gate |
| 리팩토링 방향 제안 | suggest_refactor |
| 코드 변경 전후 비교 | check_degradation |
| 변경 예산 초과 확인 | check_budget |
| 코드 특성 라벨링 | get_label |

## Gate 단계
- PoC: 빠른 검증, 느슨한 기준
- MVP: 첫 릴리스, 기본 기준
- Production: 운영, 엄격한 기준 + Waiver 지원

## 인지 복잡도 정의
인지 복잡도는 개발자가 코드를 읽고 이해하는 데 필요한 정신적 노력입니다.
- 중첩이 깊으면 컨텍스트 스택이 커짐
- 상태+비동기+재시도가 동시에 있으면 경우의 수 폭발
- 숨겨진 의존성은 예측 불가능한 부작용 유발

## 추가 문서
- docs://theory - 이론적 토대
- docs://srs - 소프트웨어 요구사항 명세
- docs://sds - 소프트웨어 설계 명세
`;

const THEORY_SUMMARY = `# Theoretical Foundation (Summary)

## Core Theorem: Ham Sandwich (🍞🧀🥓)

Maintainability (🥓) only has meaning between Security (🍞) and Cognitive (🧀).
Maximizing any single axis degrades the system.

## Stability Invariants

| Axis | Metaphor | Meaning |
|------|----------|---------|
| 🍞 Security | Structural stability | Trust boundaries, auth, crypto |
| 🧀 Cognitive | Context density | Human/LLM comprehensible range |
| 🥓 Behavioral | Behavior preservation | Golden test, contract test |

## 🧀 Accessibility Conditions (ALL must be met)

1. Nesting depth ≤ N (configurable)
2. Concept count ≤ 9 per function (Miller's Law: 7±2)
3. Hidden dependencies minimized
4. state×async×retry: No 2+ coexistence

## Mathematical Framework: Lyapunov Stability

\`\`\`
Energy function:  E(v) = ||v - c||²
Stable point:     c = canonical centroid
\`\`\`

For full documentation, see: https://github.com/yscha88/semantic-complexity/blob/main/docs/THEORY.md
`;

const SRS_SUMMARY = `# Software Requirements Specification (Summary)

## System Overview

semantic-complexity is a multi-dimensional code complexity analyzer based on:
- Ham Sandwich Theorem (🍞🧀🥓)
- Sperner's Lemma (equilibrium existence)
- Lyapunov stability (convergence path)

## Module Types

| Type | 🍞 Bread | 🧀 Cheese | 🥓 Ham |
|------|----------|-----------|--------|
| deploy | 70 | 10 | 20 |
| api-external | 50 | 20 | 30 |
| api-internal | 30 | 30 | 40 |
| app | 20 | 50 | 30 |
| lib-domain | 10 | 30 | 60 |
| lib-infra | 20 | 30 | 50 |

## Gate System (3-Stage)

| Stage | Strictness | Waiver |
|-------|------------|--------|
| PoC | Loose | ❌ |
| MVP | Tight | ❌ |
| Production | Strict | ✅ |

For full documentation, see: https://github.com/yscha88/semantic-complexity/blob/main/docs/SRS.md
`;

const SDS_SUMMARY = `# Software Design Specification (Summary)

## Architecture: ML Pipeline Structure

\`\`\`
INPUT (5D Vector) → PROCESSING (Normalization) → OUTPUT (3-axis)
\`\`\`

- INPUT: Context-free measurement (deterministic)
- PROCESSING: Context injection, weights, filters
- OUTPUT: Context-aware inference

## Algorithms

### Simplex Normalization

\`\`\`
bread + cheese + ham = 100
\`\`\`

### Gradient Direction (Lyapunov)

\`\`\`
E(v) = ||v - c||²  (energy function)
recommendation = -∇E  (gradient descent)
\`\`\`

For full documentation, see: https://github.com/yscha88/semantic-complexity/blob/main/docs/SDS.md
`;

// Canonical profile (ideal simplex coordinates by module type)
const CANONICAL_PROFILES: Record<string, SimplexCoordinates> = {
  'api/external': { bread: 0.5, cheese: 0.3, ham: 0.2 },
  'api/internal': { bread: 0.4, cheese: 0.35, ham: 0.25 },
  'lib/domain': { bread: 0.2, cheese: 0.5, ham: 0.3 },
  'lib/util': { bread: 0.1, cheese: 0.5, ham: 0.4 },
  'app': { bread: 0.33, cheese: 0.34, ham: 0.33 },
  'default': { bread: 1 / 3, cheese: 1 / 3, ham: 1 / 3 },
};

function calculateDeviation(
  current: SimplexCoordinates,
  canonical: SimplexCoordinates
): SimplexCoordinates {
  return {
    bread: current.bread - canonical.bread,
    cheese: current.cheese - canonical.cheese,
    ham: current.ham - canonical.ham,
  };
}

// package.json에서 버전 동적으로 읽기
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../../package.json'), 'utf-8')
);

const server = new Server(
  {
    name: 'semantic-complexity',
    version: packageJson.version,
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// List available resources
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'docs://usage-guide',
      name: 'Usage Guide',
      description: 'semantic-complexity MCP server usage guide',
      mimeType: 'text/markdown',
    },
    {
      uri: 'docs://theory',
      name: 'Theoretical Foundation',
      description: 'Ham Sandwich Theorem based theory',
      mimeType: 'text/markdown',
    },
    {
      uri: 'docs://srs',
      name: 'Software Requirements',
      description: 'Software Requirements Specification',
      mimeType: 'text/markdown',
    },
    {
      uri: 'docs://sds',
      name: 'Software Design',
      description: 'Software Design Specification',
      mimeType: 'text/markdown',
    },
  ],
}));

// Read resource content
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  const resourceMap: Record<string, string> = {
    'docs://usage-guide': USAGE_GUIDE,
    'docs://theory': THEORY_SUMMARY,
    'docs://srs': SRS_SUMMARY,
    'docs://sds': SDS_SUMMARY,
  };

  const content = resourceMap[uri];
  if (content) {
    return {
      contents: [
        {
          uri,
          mimeType: 'text/markdown',
          text: content,
        },
      ],
    };
  }

  throw new Error(`Resource not found: ${uri}`);
});

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'analyze_sandwich',
      description: 'Analyze code complexity using Bread-Cheese-Ham model',
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: 'Source code to analyze',
          },
          file_path: {
            type: 'string',
            description: 'Optional file path for context',
          },
        },
        required: ['source'],
      },
    },
    {
      name: 'check_gate',
      description: 'Check if code passes PoC/MVP/Production gate',
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: 'Source code to check',
          },
          gate_type: {
            type: 'string',
            enum: ['poc', 'mvp', 'production'],
            description: 'Gate type (default: mvp)',
          },
          file_path: {
            type: 'string',
            description: 'File path for waiver check',
          },
          project_root: {
            type: 'string',
            description: 'Project root for waiver discovery',
          },
        },
        required: ['source'],
      },
    },
    {
      name: 'analyze_cheese',
      description: 'Analyze cognitive accessibility (Cheese axis)',
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: 'Source code to analyze',
          },
        },
        required: ['source'],
      },
    },
    {
      name: 'suggest_refactor',
      description: 'Suggest refactoring actions based on complexity analysis',
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: 'Source code to analyze',
          },
          module_type: {
            type: 'string',
            enum: ['api/external', 'api/internal', 'lib/domain', 'lib/util', 'app'],
            description: 'Module type for context-aware recommendations',
          },
        },
        required: ['source'],
      },
    },
    {
      name: 'check_budget',
      description: 'Check if code changes stay within allowed complexity budget',
      inputSchema: {
        type: 'object',
        properties: {
          before_source: {
            type: 'string',
            description: 'Source code before changes',
          },
          after_source: {
            type: 'string',
            description: 'Source code after changes',
          },
          module_type: {
            type: 'string',
            enum: ['api/external', 'api/internal', 'lib/domain', 'lib/util', 'app'],
            description: 'Module type for budget limits',
          },
        },
        required: ['before_source', 'after_source'],
      },
    },
    {
      name: 'get_label',
      description: 'Get dominant axis label (bread/cheese/ham/balanced)',
      inputSchema: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: 'Source code to analyze',
          },
        },
        required: ['source'],
      },
    },
    {
      name: 'check_degradation',
      description: 'Detect cognitive degradation between code versions',
      inputSchema: {
        type: 'object',
        properties: {
          before_source: {
            type: 'string',
            description: 'Source code before changes',
          },
          after_source: {
            type: 'string',
            description: 'Source code after changes',
          },
        },
        required: ['before_source', 'after_source'],
      },
    },
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'analyze_sandwich': {
      const source = args?.source as string;
      const filePath = args?.file_path as string | undefined;
      const bread = analyzeBread(source);
      const cheese = analyzeCheese(source);
      const ham = analyzeHam(source, filePath);
      const simplex = normalize(bread, cheese, ham);
      const equilibrium = calculateEquilibrium(simplex);
      const label = getLabel(simplex);
      const recommendations = suggestRefactor(simplex, equilibrium, cheese);

      // Determine module type from file path or use default
      let moduleType = 'default';
      if (filePath) {
        if (filePath.includes('/api/') || filePath.includes('\\api\\')) {
          moduleType = filePath.includes('external') ? 'api/external' : 'api/internal';
        } else if (filePath.includes('/lib/') || filePath.includes('\\lib\\')) {
          moduleType = filePath.includes('domain') ? 'lib/domain' : 'lib/util';
        } else if (filePath.includes('/app/') || filePath.includes('\\app\\')) {
          moduleType = 'app';
        }
      }

      const canonical = CANONICAL_PROFILES[moduleType] || CANONICAL_PROFILES['default'];
      const deviation = calculateDeviation(simplex, canonical);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                bread,
                cheese,
                ham,
                simplex,
                equilibrium,
                label: label.label,
                confidence: label.confidence,
                canonical,
                deviation,
                recommendations,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    case 'check_gate': {
      const source = args?.source as string;
      const gateType = (args?.gate_type as GateType) || 'mvp';
      const filePath = args?.file_path as string | undefined;
      const projectRoot = args?.project_root as string | undefined;
      const cheese = analyzeCheese(source);
      const ham = analyzeHam(source);
      const result = checkGate(gateType, cheese, ham, {
        source,
        filePath,
        projectRoot,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case 'analyze_cheese': {
      const source = args?.source as string;
      const cheese = analyzeCheese(source);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(cheese, null, 2),
          },
        ],
      };
    }

    case 'suggest_refactor': {
      const source = args?.source as string;
      const bread = analyzeBread(source);
      const cheese = analyzeCheese(source);
      const ham = analyzeHam(source);
      const simplex = normalize(bread, cheese, ham);
      const equilibrium = calculateEquilibrium(simplex);
      const recommendations = suggestRefactor(simplex, equilibrium, cheese);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(recommendations, null, 2),
          },
        ],
      };
    }

    case 'check_budget': {
      const beforeSource = args?.before_source as string;
      const afterSource = args?.after_source as string;
      const moduleType = (args?.module_type as ModuleType) || 'app';
      const before = analyzeCheese(beforeSource);
      const after = analyzeCheese(afterSource);
      const delta = calculateDelta(before, after);
      const result = checkBudget(moduleType, delta);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    case 'get_label': {
      const source = args?.source as string;
      const bread = analyzeBread(source);
      const cheese = analyzeCheese(source);
      const ham = analyzeHam(source);
      const simplex = normalize(bread, cheese, ham);
      const label = getLabel(simplex);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ ...label, simplex }, null, 2),
          },
        ],
      };
    }

    case 'check_degradation': {
      const beforeSource = args?.before_source as string;
      const afterSource = args?.after_source as string;
      const before = analyzeCheese(beforeSource);
      const after = analyzeCheese(afterSource);
      const result = checkDegradation(before, after);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              degraded: result.degraded,
              severity: result.severity,
              indicators: result.indicators,
              beforeAccessible: result.beforeAccessible,
              afterAccessible: result.afterAccessible,
              delta: {
                nesting: result.deltaNesting,
                hiddenDeps: result.deltaHiddenDeps,
                violations: result.deltaViolations,
              },
            }, null, 2),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Start server
export async function main(): Promise<void> {
  if (process.argv.includes('--version') || process.argv.includes('-v')) {
    console.log(`semantic-complexity-ts-mcp ${packageJson.version}`);
    process.exit(0);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
