import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  AnalysisContext,
  AnalysisOptions,
  FileAnalysisResult,
  ProjectInfo,
} from '../types.js';
import { parseSourceFile } from '../ast/parser.js';
import { analyzeFile } from '../metrics/index.js';
import { DependencyGraph } from '../graph/dependency.js';
import { CallGraph } from '../graph/call.js';

/**
 * MCP용 분석 컨텍스트 수집기
 *
 * LLM이 인지복잡도를 정확히 판단할 수 있도록
 * 코드와 관련된 모든 컨텍스트를 수집합니다.
 */
export class ContextCollector {
  private options: AnalysisOptions;
  private projectRoot: string;
  private dependencyGraph: DependencyGraph;
  private projectInfo?: ProjectInfo;

  constructor(projectRoot: string, options?: Partial<AnalysisOptions>) {
    this.projectRoot = path.resolve(projectRoot);
    this.options = { ...getDefaultOptions(), ...options };
    this.dependencyGraph = new DependencyGraph(this.projectRoot);
    this.projectInfo = this.detectProjectInfo();
  }

  /**
   * 파일에 대한 전체 분석 컨텍스트 수집
   */
  async collectContext(filePath: string): Promise<AnalysisContext> {
    const absPath = path.resolve(filePath);
    const content = fs.readFileSync(absPath, 'utf-8');
    const sourceFile = parseSourceFile(absPath, content);

    // 기본 분석
    const fileResult = analyzeFile(sourceFile);

    // 의존성 분석
    const depNode = this.dependencyGraph.analyzeFile(absPath, content);

    // 호출 그래프
    const callGraph = new CallGraph();
    callGraph.analyzeSourceFile(sourceFile);

    // 관련 파일 분석
    const relatedFiles = await this.analyzeRelatedFiles(
      absPath,
      this.options.contextDepth
    );

    return {
      file: fileResult,
      dependencies: depNode,
      callGraph: callGraph.getAllNodes(),
      relatedFiles,
      projectInfo: this.projectInfo,
    };
  }

  /**
   * MCP 응답용 프롬프트 생성
   *
   * LLM이 인지복잡도를 판단할 수 있도록
   * 구조화된 프롬프트를 생성합니다.
   */
  generatePrompt(context: AnalysisContext, functionName?: string): string {
    const lines: string[] = [];

    // 헤더
    lines.push('# 코드 복잡도 분석 요청');
    lines.push('');

    // 프로젝트 정보
    if (context.projectInfo) {
      lines.push('## 프로젝트 정보');
      lines.push(`- 이름: ${context.projectInfo.name}`);
      lines.push(`- 언어: ${context.projectInfo.language}`);
      if (context.projectInfo.framework) {
        lines.push(`- 프레임워크: ${context.projectInfo.framework}`);
      }
      lines.push('');
    }

    // 파일 정보
    lines.push('## 분석 대상 파일');
    lines.push(`경로: ${context.file.filePath}`);
    lines.push('');

    // 기계적 메트릭
    lines.push('## 기계적 복잡도 (참고용)');
    const targetFunctions = functionName
      ? context.file.functions.filter((f) => f.function.name === functionName)
      : context.file.functions;

    for (const func of targetFunctions) {
      lines.push(`### ${func.function.name}`);
      lines.push(`- 위치: ${func.function.location.startLine}행`);
      lines.push(`- 순환복잡도: ${func.cyclomatic}`);
      lines.push(`- 인지복잡도 (SonarSource): ${func.cognitive}`);
      lines.push('');

      if (func.details.length > 0) {
        lines.push('상세:');
        for (const detail of func.details.slice(0, 10)) {
          lines.push(`  - ${detail.description} (${detail.location.startLine}행)`);
        }
        if (func.details.length > 10) {
          lines.push(`  - ... 외 ${func.details.length - 10}개`);
        }
        lines.push('');
      }
    }

    // 의존성 정보
    lines.push('## 의존성 관계');
    lines.push(`이 파일이 import하는 모듈: ${context.dependencies.imports.length}개`);
    for (const imp of context.dependencies.imports.slice(0, 5)) {
      lines.push(`  - ${path.basename(imp)}`);
    }
    lines.push(`이 파일을 import하는 모듈: ${context.dependencies.importedBy.length}개`);
    for (const dep of context.dependencies.importedBy.slice(0, 5)) {
      lines.push(`  - ${path.basename(dep)}`);
    }
    lines.push('');

    // 호출 관계
    if (context.callGraph.length > 0) {
      lines.push('## 함수 호출 관계');
      for (const node of context.callGraph.slice(0, 5)) {
        const callCount = node.calls.length;
        const calledByCount = node.calledBy.length;
        lines.push(
          `- ${node.function.name}: 호출 ${callCount}개, 호출됨 ${calledByCount}개`
        );
      }
      lines.push('');
    }

    // 분석 요청
    lines.push('## 분석 요청');
    lines.push('위 정보를 바탕으로 다음을 분석해주세요:');
    lines.push('');
    lines.push('1. **실제 인지복잡도 평가**');
    lines.push('   - 알고리즘 패턴 인식 (매핑, 변환, 상태 머신 등)');
    lines.push('   - 도메인 로직 난이도');
    lines.push('   - 추상화 수준 적절성');
    lines.push('');
    lines.push('2. **리팩토링 제안** (필요시)');
    lines.push('   - 함수 분리 가능 지점');
    lines.push('   - 패턴 적용 가능성');
    lines.push('   - 테스트 용이성 개선 방안');
    lines.push('');
    lines.push('3. **복잡도 점수 (1-100)**');
    lines.push('   - 기계적 메트릭과 실제 복잡도의 차이 설명');

    return lines.join('\n');
  }

  /**
   * 관련 파일 분석
   */
  private async analyzeRelatedFiles(
    filePath: string,
    depth: number
  ): Promise<FileAnalysisResult[]> {
    const results: FileAnalysisResult[] = [];
    const depTree = this.dependencyGraph.buildDependencyTree(filePath, depth);

    for (const node of depTree) {
      if (node.filePath === filePath) continue;

      try {
        const content = fs.readFileSync(node.filePath, 'utf-8');
        const sourceFile = parseSourceFile(node.filePath, content);
        const result = analyzeFile(sourceFile);
        results.push(result);
      } catch {
        // 파일 읽기 실패 무시
      }
    }

    return results;
  }

  /**
   * 프로젝트 정보 감지
   */
  private detectProjectInfo(): ProjectInfo | undefined {
    try {
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      if (!fs.existsSync(packageJsonPath)) return undefined;

      const packageJson = JSON.parse(
        fs.readFileSync(packageJsonPath, 'utf-8')
      );

      // 패키지 매니저 감지
      let packageManager: ProjectInfo['packageManager'] = 'npm';
      if (fs.existsSync(path.join(this.projectRoot, 'pnpm-lock.yaml'))) {
        packageManager = 'pnpm';
      } else if (fs.existsSync(path.join(this.projectRoot, 'yarn.lock'))) {
        packageManager = 'yarn';
      } else if (fs.existsSync(path.join(this.projectRoot, 'bun.lockb'))) {
        packageManager = 'bun';
      }

      // 프레임워크 감지
      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };
      let framework: string | undefined;
      if (deps['next']) framework = 'Next.js';
      else if (deps['nuxt']) framework = 'Nuxt';
      else if (deps['@angular/core']) framework = 'Angular';
      else if (deps['vue']) framework = 'Vue';
      else if (deps['react']) framework = 'React';
      else if (deps['svelte']) framework = 'Svelte';
      else if (deps['express']) framework = 'Express';
      else if (deps['fastify']) framework = 'Fastify';
      else if (deps['nestjs']) framework = 'NestJS';

      // 언어 감지
      const hasTsConfig = fs.existsSync(
        path.join(this.projectRoot, 'tsconfig.json')
      );
      const language: ProjectInfo['language'] = hasTsConfig
        ? 'typescript'
        : 'javascript';

      return {
        name: packageJson.name || path.basename(this.projectRoot),
        root: this.projectRoot,
        packageManager,
        framework,
        language,
      };
    } catch {
      return undefined;
    }
  }
}

/**
 * 기본 옵션 반환
 */
function getDefaultOptions(): AnalysisOptions {
  return {
    cyclomaticThreshold: 10,
    cognitiveThreshold: 15,
    includeTypes: true,
    excludeTests: true,
    excludePatterns: ['node_modules', 'dist', 'build', '.git'],
    contextDepth: 2,
  };
}

/**
 * 단일 파일 빠른 분석 (MCP 도구용)
 */
export async function quickAnalyze(
  filePath: string,
  functionName?: string
): Promise<{ context: AnalysisContext; prompt: string }> {
  const projectRoot = findProjectRoot(filePath);
  const collector = new ContextCollector(projectRoot);
  const context = await collector.collectContext(filePath);
  const prompt = collector.generatePrompt(context, functionName);

  return { context, prompt };
}

/**
 * 프로젝트 루트 찾기
 */
function findProjectRoot(startPath: string): string {
  let current = path.dirname(path.resolve(startPath));

  while (current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, 'package.json'))) {
      return current;
    }
    current = path.dirname(current);
  }

  return path.dirname(startPath);
}
