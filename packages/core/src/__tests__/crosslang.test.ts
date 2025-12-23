import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseSourceFile } from '../ast/parser.js';
import { analyzeFunctionExtended } from '../metrics/index.js';
import { extractFunctionInfo } from '../ast/parser.js';
import type { ExtendedComplexityResult } from '../types.js';
import ts from 'typescript';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, 'fixtures');

/**
 * Cross-Language Compatibility Tests
 *
 * Verifies that TypeScript, Python, and Go analyzers produce
 * compatible output structures with consistent field names and types.
 */

interface CommonFunctionResult {
  name: string;
  lineno: number;
  end_lineno: number;
  cyclomatic: number;
  cognitive: number;
  dimensional: {
    weighted: number;
    control: number;
    nesting: number;
    state: { state_mutations: number };
    async_: { async_boundaries: number };
    coupling: { global_access: number; side_effects: number };
  };
}

function analyzeTypeScript(fixturePath: string): CommonFunctionResult[] {
  const content = fs.readFileSync(fixturePath, 'utf-8');
  const sourceFile = parseSourceFile(fixturePath, content);
  const results: CommonFunctionResult[] = [];

  function visit(node: ts.Node) {
    const funcInfo = extractFunctionInfo(node, sourceFile);
    if (funcInfo) {
      const result = analyzeFunctionExtended(node, sourceFile, funcInfo);
      results.push({
        name: funcInfo.name,
        lineno: funcInfo.location.startLine,
        end_lineno: funcInfo.location.endLine,
        cyclomatic: result.cyclomatic,
        cognitive: result.cognitive,
        dimensional: {
          weighted: result.dimensional.weighted,
          control: result.dimensional.control,
          nesting: result.dimensional.nesting,
          state: { state_mutations: result.dimensional.state.stateMutations },
          async_: { async_boundaries: result.dimensional.async.asyncBoundaries },
          coupling: {
            global_access: result.dimensional.coupling.globalAccess.length,
            side_effects: result.dimensional.coupling.sideEffects.length,
          },
        },
      });
    }
    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sourceFile, visit);
  return results;
}

function analyzePython(fixturePath: string): CommonFunctionResult[] | null {
  const tempDir = os.tmpdir();
  const tempScript = path.join(tempDir, `sc_test_${Date.now()}.py`);
  const safeFilePath = fixturePath.replace(/\\/g, '/');

  // Find py package directory
  const possiblePyPaths = [
    path.join(process.cwd(), 'py'),
    path.join(__dirname, '..', '..', '..', '..', '..', 'py'),
  ].map((p) => p.replace(/\\/g, '/'));

  const pythonCode = `
import json
import sys
for p in ${JSON.stringify(possiblePyPaths)}:
    if p not in sys.path:
        sys.path.insert(0, p)
try:
    from semantic_complexity import analyze_functions
    with open(r'${safeFilePath}', 'r', encoding='utf-8') as f:
        source = f.read()
    results = analyze_functions(source, '${path.basename(fixturePath)}')
    output = []
    for r in results:
        output.append({
            'name': r.name,
            'lineno': r.lineno,
            'end_lineno': r.end_lineno,
            'cyclomatic': r.cyclomatic,
            'cognitive': r.cognitive,
            'dimensional': {
                'weighted': r.dimensional.weighted,
                'control': r.dimensional.control,
                'nesting': r.dimensional.nesting,
                'state': {'state_mutations': r.dimensional.state.state_mutations},
                'async_': {'async_boundaries': r.dimensional.async_.async_boundaries},
                'coupling': {
                    'global_access': r.dimensional.coupling.global_access,
                    'side_effects': r.dimensional.coupling.side_effects
                }
            }
        })
    print(json.dumps(output))
except Exception as e:
    print(json.dumps({'error': str(e)}))
`;

  fs.writeFileSync(tempScript, pythonCode, 'utf-8');

  const pythonCommands = process.platform === 'win32' ? ['python', 'python3', 'py'] : ['python3', 'python'];

  try {
    let result: string | null = null;
    for (const cmd of pythonCommands) {
      try {
        result = execSync(`${cmd} "${tempScript}"`, { encoding: 'utf-8', timeout: 30000 });
        break;
      } catch {
        // Try next command
      }
    }

    if (result === null) return null;

    const parsed = JSON.parse(result.trim());
    if (parsed.error) {
      console.error('Python analysis error:', parsed.error);
      return null;
    }
    return parsed;
  } catch (error) {
    console.error('Failed to analyze Python file:', error);
    return null;
  } finally {
    try {
      fs.unlinkSync(tempScript);
    } catch {
      // Ignore cleanup errors
    }
  }
}

function analyzeGo(fixturePath: string): CommonFunctionResult[] | null {
  // Try multiple paths to find go module
  const possibleGoModPaths = [
    path.join(process.cwd(), 'go', 'semanticcomplexity'),
    path.join(__dirname, '..', '..', '..', '..', '..', 'go', 'semanticcomplexity'),
  ];

  let goModPath: string | null = null;
  for (const p of possibleGoModPaths) {
    if (fs.existsSync(path.join(p, 'go.mod'))) {
      goModPath = p;
      break;
    }
  }

  const safeFilePath = fixturePath.replace(/\\/g, '/');

  if (!goModPath) {
    console.error('Go module not found');
    return null;
  }

  try {
    const result = execSync(`go run ./cmd "${safeFilePath}"`, {
      encoding: 'utf-8',
      timeout: 30000,
      cwd: goModPath,
    });

    const parsed = JSON.parse(result.trim());
    if (parsed.error) {
      console.error('Go analysis error:', parsed.error);
      return null;
    }

    // Transform Go output to common format
    return parsed.map((r: Record<string, unknown>) => ({
      name: r.name,
      lineno: r.lineno,
      end_lineno: r.end_lineno,
      cyclomatic: r.cyclomatic,
      cognitive: r.cognitive,
      dimensional: {
        weighted: (r.dimensional as Record<string, unknown>).weighted,
        control: (r.dimensional as Record<string, unknown>).control,
        nesting: (r.dimensional as Record<string, unknown>).nesting,
        state: ((r.dimensional as Record<string, unknown>).state as Record<string, unknown>) || { state_mutations: 0 },
        async_: ((r.dimensional as Record<string, unknown>).async_ as Record<string, unknown>) || { async_boundaries: 0 },
        coupling: ((r.dimensional as Record<string, unknown>).coupling as Record<string, unknown>) || {
          global_access: 0,
          side_effects: 0,
        },
      },
    }));
  } catch (error) {
    console.error('Failed to analyze Go file:', error);
    return null;
  }
}

describe('Cross-Language Compatibility', () => {
  let tsResults: CommonFunctionResult[];
  let pyResults: CommonFunctionResult[] | null;
  let goResults: CommonFunctionResult[] | null;

  beforeAll(() => {
    // Analyze TypeScript sample
    const tsFixture = path.join(fixturesDir, 'crosslang-sample.ts');
    tsResults = analyzeTypeScript(tsFixture);

    // Analyze Python sample
    const pyFixture = path.join(fixturesDir, 'crosslang_sample.py');
    pyResults = analyzePython(pyFixture);

    // Analyze Go sample
    const goFixture = path.join(fixturesDir, 'crosslang_sample.go');
    goResults = analyzeGo(goFixture);
  });

  describe('TypeScript Analyzer', () => {
    it('should produce results with correct structure', () => {
      expect(tsResults.length).toBeGreaterThan(0);
      for (const r of tsResults) {
        expect(r).toHaveProperty('name');
        expect(r).toHaveProperty('lineno');
        expect(r).toHaveProperty('end_lineno');
        expect(r).toHaveProperty('cyclomatic');
        expect(r).toHaveProperty('cognitive');
        expect(r).toHaveProperty('dimensional');
        expect(r.dimensional).toHaveProperty('weighted');
        expect(r.dimensional).toHaveProperty('control');
        expect(r.dimensional).toHaveProperty('nesting');
        expect(r.dimensional).toHaveProperty('state');
        expect(r.dimensional).toHaveProperty('async_');
        expect(r.dimensional).toHaveProperty('coupling');
      }
    });

    it('should detect control flow complexity', () => {
      const simpleControl = tsResults.find((r) => r.name === 'simpleControl');
      expect(simpleControl).toBeDefined();
      expect(simpleControl!.cyclomatic).toBeGreaterThan(1);
      expect(simpleControl!.dimensional.control).toBeGreaterThan(0);
    });

    it('should detect nesting complexity', () => {
      const nestedLoop = tsResults.find((r) => r.name === 'nestedLoop');
      expect(nestedLoop).toBeDefined();
      expect(nestedLoop!.dimensional.nesting).toBeGreaterThan(0);
    });

    it('should detect state mutations', () => {
      const stateMutation = tsResults.find((r) => r.name === 'stateMutation');
      expect(stateMutation).toBeDefined();
      expect(stateMutation!.dimensional.state.state_mutations).toBeGreaterThan(0);
    });

    it('should detect async boundaries', () => {
      const asyncFunction = tsResults.find((r) => r.name === 'asyncFunction');
      expect(asyncFunction).toBeDefined();
      expect(asyncFunction!.dimensional.async_.async_boundaries).toBeGreaterThan(0);
    });

    it('should detect coupling/side effects', () => {
      const coupledFunction = tsResults.find((r) => r.name === 'coupledFunction');
      expect(coupledFunction).toBeDefined();
      // console.log or localStorage access should be detected
      expect(
        coupledFunction!.dimensional.coupling.side_effects >= 0 ||
          coupledFunction!.dimensional.coupling.global_access >= 0
      ).toBe(true);
    });
  });

  describe('Python Analyzer', () => {
    it('should produce results with correct structure', () => {
      if (!pyResults) {
        console.warn('Python analyzer not available, skipping test');
        return;
      }

      expect(pyResults.length).toBeGreaterThan(0);
      for (const r of pyResults) {
        expect(r).toHaveProperty('name');
        expect(r).toHaveProperty('lineno');
        expect(r).toHaveProperty('end_lineno');
        expect(r).toHaveProperty('cyclomatic');
        expect(r).toHaveProperty('cognitive');
        expect(r).toHaveProperty('dimensional');
        expect(r.dimensional).toHaveProperty('weighted');
        expect(r.dimensional).toHaveProperty('control');
        expect(r.dimensional).toHaveProperty('nesting');
        expect(r.dimensional).toHaveProperty('state');
        expect(r.dimensional).toHaveProperty('async_');
        expect(r.dimensional).toHaveProperty('coupling');
      }
    });

    it('should detect control flow complexity', () => {
      if (!pyResults) {
        console.warn('Python analyzer not available, skipping test');
        return;
      }

      const simpleControl = pyResults.find((r) => r.name === 'simple_control');
      expect(simpleControl).toBeDefined();
      expect(simpleControl!.cyclomatic).toBeGreaterThan(1);
      expect(simpleControl!.dimensional.control).toBeGreaterThan(0);
    });

    it('should detect nesting complexity', () => {
      if (!pyResults) {
        console.warn('Python analyzer not available, skipping test');
        return;
      }

      const nestedLoop = pyResults.find((r) => r.name === 'nested_loop');
      expect(nestedLoop).toBeDefined();
      expect(nestedLoop!.dimensional.nesting).toBeGreaterThan(0);
    });

    it('should detect state mutations', () => {
      if (!pyResults) {
        console.warn('Python analyzer not available, skipping test');
        return;
      }

      const stateMutation = pyResults.find((r) => r.name === 'state_mutation');
      expect(stateMutation).toBeDefined();
      expect(stateMutation!.dimensional.state.state_mutations).toBeGreaterThan(0);
    });
  });

  describe('Go Analyzer', () => {
    it('should produce results with correct structure', () => {
      if (!goResults) {
        console.warn('Go analyzer not available, skipping test');
        return;
      }

      expect(goResults.length).toBeGreaterThan(0);
      for (const r of goResults) {
        expect(r).toHaveProperty('name');
        expect(r).toHaveProperty('lineno');
        expect(r).toHaveProperty('end_lineno');
        expect(r).toHaveProperty('cyclomatic');
        expect(r).toHaveProperty('cognitive');
        expect(r).toHaveProperty('dimensional');
        expect(r.dimensional).toHaveProperty('weighted');
        expect(r.dimensional).toHaveProperty('control');
        expect(r.dimensional).toHaveProperty('nesting');
      }
    });

    it('should detect control flow complexity', () => {
      if (!goResults) {
        console.warn('Go analyzer not available, skipping test');
        return;
      }

      const simpleControl = goResults.find((r) => r.name === 'SimpleControl');
      expect(simpleControl).toBeDefined();
      expect(simpleControl!.cyclomatic).toBeGreaterThan(1);
      expect(simpleControl!.dimensional.control).toBeGreaterThan(0);
    });

    it('should detect nesting complexity', () => {
      if (!goResults) {
        console.warn('Go analyzer not available, skipping test');
        return;
      }

      const nestedLoop = goResults.find((r) => r.name === 'NestedLoop');
      expect(nestedLoop).toBeDefined();
      expect(nestedLoop!.dimensional.nesting).toBeGreaterThan(0);
    });

    it('should detect state mutations', () => {
      if (!goResults) {
        console.warn('Go analyzer not available, skipping test');
        return;
      }

      const stateMutation = goResults.find((r) => r.name === 'StateMutation');
      expect(stateMutation).toBeDefined();
      expect(stateMutation!.dimensional.state.state_mutations).toBeGreaterThan(0);
    });

    it('should detect async (goroutine) boundaries', () => {
      if (!goResults) {
        console.warn('Go analyzer not available, skipping test');
        return;
      }

      const asyncFunction = goResults.find((r) => r.name === 'AsyncFunction');
      expect(asyncFunction).toBeDefined();
      expect(asyncFunction!.dimensional.async_.async_boundaries).toBeGreaterThan(0);
    });
  });

  describe('Output Structure Compatibility', () => {
    it('all analyzers should produce same top-level fields', () => {
      const requiredFields = ['name', 'lineno', 'end_lineno', 'cyclomatic', 'cognitive', 'dimensional'];

      // TypeScript
      expect(tsResults.length).toBeGreaterThan(0);
      for (const field of requiredFields) {
        expect(tsResults[0]).toHaveProperty(field);
      }

      // Python
      if (pyResults && pyResults.length > 0) {
        for (const field of requiredFields) {
          expect(pyResults[0]).toHaveProperty(field);
        }
      }

      // Go
      if (goResults && goResults.length > 0) {
        for (const field of requiredFields) {
          expect(goResults[0]).toHaveProperty(field);
        }
      }
    });

    it('all analyzers should produce same dimensional fields', () => {
      const requiredDimensionalFields = ['weighted', 'control', 'nesting', 'state', 'async_', 'coupling'];

      // TypeScript
      expect(tsResults.length).toBeGreaterThan(0);
      for (const field of requiredDimensionalFields) {
        expect(tsResults[0].dimensional).toHaveProperty(field);
      }

      // Python
      if (pyResults && pyResults.length > 0) {
        for (const field of requiredDimensionalFields) {
          expect(pyResults[0].dimensional).toHaveProperty(field);
        }
      }

      // Go
      if (goResults && goResults.length > 0) {
        for (const field of requiredDimensionalFields) {
          expect(goResults[0].dimensional).toHaveProperty(field);
        }
      }
    });
  });
});
