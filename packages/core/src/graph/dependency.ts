import * as path from 'node:path';
import * as fs from 'node:fs';
import type { DependencyNode } from '../types.js';
import { parseSourceFile, extractImports } from '../ast/parser.js';

/**
 * 의존성 그래프 빌더
 */
export class DependencyGraph {
  private nodes: Map<string, DependencyNode> = new Map();
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = path.resolve(projectRoot);
  }

  /**
   * 프로젝트 루트 경로 반환
   */
  getProjectRoot(): string {
    return this.projectRoot;
  }

  /**
   * 파일의 의존성 분석
   */
  analyzeFile(filePath: string, content?: string): DependencyNode {
    const absPath = path.resolve(filePath);
    const normalizedPath = this.normalizePath(absPath);

    // 이미 분석된 경우 캐시된 결과 반환
    const existing = this.nodes.get(normalizedPath);
    if (existing) return existing;

    // 파일 내용 읽기
    const fileContent = content ?? this.readFile(absPath);
    if (!fileContent) {
      const node: DependencyNode = {
        filePath: normalizedPath,
        imports: [],
        importedBy: [],
        depth: -1,
      };
      this.nodes.set(normalizedPath, node);
      return node;
    }

    // 파싱 및 import 추출
    const sourceFile = parseSourceFile(absPath, fileContent);
    const imports = extractImports(sourceFile);

    // import 경로 해석
    const resolvedImports = imports
      .map((imp) => this.resolveImportPath(absPath, imp.source))
      .filter((p): p is string => p !== null);

    // 노드 생성
    const node: DependencyNode = {
      filePath: normalizedPath,
      imports: resolvedImports,
      importedBy: [],
      depth: 0,
    };

    this.nodes.set(normalizedPath, node);

    // 역방향 참조 업데이트
    for (const importPath of resolvedImports) {
      const importNode = this.nodes.get(importPath);
      if (importNode && !importNode.importedBy.includes(normalizedPath)) {
        importNode.importedBy.push(normalizedPath);
      }
    }

    return node;
  }

  /**
   * 디렉토리 내 모든 파일 분석
   */
  analyzeDirectory(
    dirPath: string,
    extensions = ['.ts', '.tsx', '.js', '.jsx']
  ): void {
    const files = this.findFiles(dirPath, extensions);
    for (const file of files) {
      this.analyzeFile(file);
    }

    // 모든 파일 분석 후 역방향 참조 재구성
    this.rebuildReverseReferences();

    // 깊이 계산
    this.calculateDepths();
  }

  /**
   * 특정 파일에서 시작하는 의존성 트리 구축
   */
  buildDependencyTree(filePath: string, maxDepth = 5): DependencyNode[] {
    const absPath = path.resolve(filePath);
    const normalizedPath = this.normalizePath(absPath);
    const visited = new Set<string>();
    const result: DependencyNode[] = [];

    const traverse = (nodePath: string, depth: number) => {
      if (depth > maxDepth || visited.has(nodePath)) return;
      visited.add(nodePath);

      let node = this.nodes.get(nodePath);
      if (!node) {
        node = this.analyzeFile(nodePath);
      }

      const nodeWithDepth = { ...node, depth };
      result.push(nodeWithDepth);

      for (const importPath of node.imports) {
        traverse(importPath, depth + 1);
      }
    };

    traverse(normalizedPath, 0);
    return result;
  }

  /**
   * 특정 파일을 참조하는 파일들 찾기
   */
  findDependents(filePath: string, maxDepth = 5): DependencyNode[] {
    const absPath = path.resolve(filePath);
    const normalizedPath = this.normalizePath(absPath);
    const visited = new Set<string>();
    const result: DependencyNode[] = [];

    const traverse = (nodePath: string, depth: number) => {
      if (depth > maxDepth || visited.has(nodePath)) return;
      visited.add(nodePath);

      const node = this.nodes.get(nodePath);
      if (!node) return;

      const nodeWithDepth = { ...node, depth };
      result.push(nodeWithDepth);

      for (const dependentPath of node.importedBy) {
        traverse(dependentPath, depth + 1);
      }
    };

    traverse(normalizedPath, 0);
    return result;
  }

  /**
   * 노드 조회
   */
  getNode(filePath: string): DependencyNode | undefined {
    const normalizedPath = this.normalizePath(path.resolve(filePath));
    return this.nodes.get(normalizedPath);
  }

  /**
   * 모든 노드 반환
   */
  getAllNodes(): DependencyNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * 순환 의존성 탐지
   */
  findCircularDependencies(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodePath: string, path: string[]): boolean => {
      visited.add(nodePath);
      recursionStack.add(nodePath);

      const node = this.nodes.get(nodePath);
      if (!node) return false;

      for (const importPath of node.imports) {
        if (!visited.has(importPath)) {
          if (dfs(importPath, [...path, importPath])) {
            return true;
          }
        } else if (recursionStack.has(importPath)) {
          // 순환 발견
          const cycleStart = path.indexOf(importPath);
          if (cycleStart >= 0) {
            cycles.push([...path.slice(cycleStart), importPath]);
          } else {
            cycles.push([...path, importPath]);
          }
        }
      }

      recursionStack.delete(nodePath);
      return false;
    };

    for (const nodePath of this.nodes.keys()) {
      if (!visited.has(nodePath)) {
        dfs(nodePath, [nodePath]);
      }
    }

    return cycles;
  }

  // ─── Private Methods ───────────────────────────────────────────

  private normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/');
  }

  private readFile(filePath: string): string | null {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  private resolveImportPath(
    fromFile: string,
    importSource: string
  ): string | null {
    // 상대 경로만 처리 (node_modules 제외)
    if (!importSource.startsWith('.')) {
      return null;
    }

    const fromDir = path.dirname(fromFile);
    const resolved = path.resolve(fromDir, importSource);

    // 확장자가 없으면 추가
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];

    for (const ext of extensions) {
      const candidate = resolved + ext;
      if (fs.existsSync(candidate)) {
        return this.normalizePath(candidate);
      }
    }

    // 이미 확장자가 있는 경우
    if (fs.existsSync(resolved)) {
      return this.normalizePath(resolved);
    }

    return null;
  }

  private findFiles(dirPath: string, extensions: string[]): string[] {
    const files: string[] = [];

    const traverse = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          // node_modules 등 제외
          if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
            continue;
          }

          if (entry.isDirectory()) {
            traverse(fullPath);
          } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
            files.push(fullPath);
          }
        }
      } catch {
        // 접근 불가 디렉토리 무시
      }
    };

    traverse(dirPath);
    return files;
  }

  private rebuildReverseReferences(): void {
    // 기존 역참조 초기화
    for (const node of this.nodes.values()) {
      node.importedBy = [];
    }

    // 역참조 재구성
    for (const node of this.nodes.values()) {
      for (const importPath of node.imports) {
        const importNode = this.nodes.get(importPath);
        if (importNode && !importNode.importedBy.includes(node.filePath)) {
          importNode.importedBy.push(node.filePath);
        }
      }
    }
  }

  private calculateDepths(): void {
    // 루트 노드 찾기 (참조되지 않는 노드)
    const roots = Array.from(this.nodes.values()).filter(
      (node) => node.importedBy.length === 0
    );

    // BFS로 깊이 계산
    const visited = new Set<string>();
    const queue: { path: string; depth: number }[] = roots.map((r) => ({
      path: r.filePath,
      depth: 0,
    }));

    while (queue.length > 0) {
      const { path: nodePath, depth } = queue.shift()!;
      if (visited.has(nodePath)) continue;
      visited.add(nodePath);

      const node = this.nodes.get(nodePath);
      if (!node) continue;

      node.depth = depth;

      for (const importPath of node.imports) {
        if (!visited.has(importPath)) {
          queue.push({ path: importPath, depth: depth + 1 });
        }
      }
    }
  }
}

/**
 * 의존성 그래프를 DOT 형식으로 출력 (시각화용)
 */
export function exportToDot(graph: DependencyGraph): string {
  const lines = ['digraph DependencyGraph {', '  rankdir=TB;'];

  for (const node of graph.getAllNodes()) {
    const shortName = path.basename(node.filePath);
    lines.push(`  "${shortName}" [label="${shortName}"];`);

    for (const importPath of node.imports) {
      const importName = path.basename(importPath);
      lines.push(`  "${shortName}" -> "${importName}";`);
    }
  }

  lines.push('}');
  return lines.join('\n');
}
