/**
 * semantic-complexity MCP Server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
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
    },
  }
);

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
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
