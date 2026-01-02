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
import { normalize, calculateEquilibrium } from '../simplex/index.js';
import { checkGate } from '../gate/index.js';
import type { GateType } from '../types/index.js';

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
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'analyze_sandwich': {
      const source = args?.source as string;
      const bread = analyzeBread(source);
      const cheese = analyzeCheese(source);
      const ham = analyzeHam(source);
      const simplex = normalize(bread, cheese, ham);
      const equilibrium = calculateEquilibrium(simplex);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { bread, cheese, ham, simplex, equilibrium },
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
      const cheese = analyzeCheese(source);
      const ham = analyzeHam(source);
      const result = checkGate(gateType, cheese, ham);

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
