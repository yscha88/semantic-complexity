import ts from 'typescript';
import type {
  FunctionInfo,
  SourceLocation,
  ParameterInfo,
  ImportInfo,
  ImportSpecifier,
  ExportInfo,
} from '../types.js';

/**
 * 소스 파일을 파싱하여 AST를 생성
 */
export function parseSourceFile(
  filePath: string,
  content: string
): ts.SourceFile {
  return ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') || filePath.endsWith('.jsx')
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS
  );
}

/**
 * AST 노드에서 소스 위치 정보 추출
 */
export function getSourceLocation(
  node: ts.Node,
  sourceFile: ts.SourceFile
): SourceLocation {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

  return {
    filePath: sourceFile.fileName,
    startLine: start.line + 1,
    startColumn: start.character + 1,
    endLine: end.line + 1,
    endColumn: end.character + 1,
  };
}

/**
 * 함수 노드에서 함수 정보 추출
 */
export function extractFunctionInfo(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  className?: string
): FunctionInfo | null {
  if (ts.isFunctionDeclaration(node)) {
    return {
      name: node.name?.getText(sourceFile) ?? '<anonymous>',
      kind: 'function',
      location: getSourceLocation(node, sourceFile),
      isAsync: hasModifier(node, ts.SyntaxKind.AsyncKeyword),
      isGenerator: !!node.asteriskToken,
      isExported: hasModifier(node, ts.SyntaxKind.ExportKeyword),
      parameters: extractParameters(node.parameters, sourceFile),
      returnType: node.type?.getText(sourceFile),
    };
  }

  if (ts.isMethodDeclaration(node)) {
    return {
      name: node.name.getText(sourceFile),
      kind: 'method',
      location: getSourceLocation(node, sourceFile),
      isAsync: hasModifier(node, ts.SyntaxKind.AsyncKeyword),
      isGenerator: !!node.asteriskToken,
      isExported: false,
      parameters: extractParameters(node.parameters, sourceFile),
      returnType: node.type?.getText(sourceFile),
      className,
    };
  }

  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    const parent = node.parent;
    let name = '<anonymous>';

    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
      name = parent.name.getText(sourceFile);
    } else if (ts.isPropertyAssignment(parent)) {
      name = parent.name.getText(sourceFile);
    }

    return {
      name,
      kind: 'arrow',
      location: getSourceLocation(node, sourceFile),
      isAsync: hasModifier(node, ts.SyntaxKind.AsyncKeyword),
      isGenerator: ts.isFunctionExpression(node) && !!node.asteriskToken,
      isExported: false,
      parameters: extractParameters(node.parameters, sourceFile),
      returnType: node.type?.getText(sourceFile),
      className,
    };
  }

  if (ts.isGetAccessor(node)) {
    return {
      name: node.name.getText(sourceFile),
      kind: 'getter',
      location: getSourceLocation(node, sourceFile),
      isAsync: false,
      isGenerator: false,
      isExported: false,
      parameters: [],
      returnType: node.type?.getText(sourceFile),
      className,
    };
  }

  if (ts.isSetAccessor(node)) {
    return {
      name: node.name.getText(sourceFile),
      kind: 'setter',
      location: getSourceLocation(node, sourceFile),
      isAsync: false,
      isGenerator: false,
      isExported: false,
      parameters: extractParameters(node.parameters, sourceFile),
      className,
    };
  }

  if (ts.isConstructorDeclaration(node)) {
    return {
      name: 'constructor',
      kind: 'constructor',
      location: getSourceLocation(node, sourceFile),
      isAsync: false,
      isGenerator: false,
      isExported: false,
      parameters: extractParameters(node.parameters, sourceFile),
      className,
    };
  }

  return null;
}

/**
 * 파라미터 정보 추출
 */
function extractParameters(
  params: ts.NodeArray<ts.ParameterDeclaration>,
  sourceFile: ts.SourceFile
): ParameterInfo[] {
  return params.map((param) => ({
    name: param.name.getText(sourceFile),
    type: param.type?.getText(sourceFile),
    isOptional: !!param.questionToken,
    isRest: !!param.dotDotDotToken,
    hasDefault: !!param.initializer,
  }));
}

/**
 * 모디파이어 확인
 */
function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return modifiers?.some((mod) => mod.kind === kind) ?? false;
}

/**
 * 모든 함수 노드 추출
 */
export function extractAllFunctions(sourceFile: ts.SourceFile): FunctionInfo[] {
  const functions: FunctionInfo[] = [];

  function visit(node: ts.Node, className?: string) {
    // 클래스 내부 순회
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      const name = node.name?.getText(sourceFile) ?? '<anonymous>';
      node.members.forEach((member) => visit(member, name));
      return;
    }

    // 함수 정보 추출
    const funcInfo = extractFunctionInfo(node, sourceFile, className);
    if (funcInfo) {
      functions.push(funcInfo);
    }

    // 자식 노드 순회 (함수 내부의 중첩 함수도 추출)
    ts.forEachChild(node, (child) => visit(child, className));
  }

  visit(sourceFile);
  return functions;
}

/**
 * Import 정보 추출
 */
export function extractImports(sourceFile: ts.SourceFile): ImportInfo[] {
  const imports: ImportInfo[] = [];

  ts.forEachChild(sourceFile, (node) => {
    if (ts.isImportDeclaration(node)) {
      const specifiers: ImportSpecifier[] = [];
      const clause = node.importClause;

      if (clause) {
        // default import
        if (clause.name) {
          specifiers.push({
            name: clause.name.getText(sourceFile),
            isDefault: true,
            isNamespace: false,
          });
        }

        // named imports or namespace import
        const bindings = clause.namedBindings;
        if (bindings) {
          if (ts.isNamespaceImport(bindings)) {
            specifiers.push({
              name: bindings.name.getText(sourceFile),
              isDefault: false,
              isNamespace: true,
            });
          } else if (ts.isNamedImports(bindings)) {
            bindings.elements.forEach((element) => {
              specifiers.push({
                name: element.name.getText(sourceFile),
                alias: element.propertyName?.getText(sourceFile),
                isDefault: false,
                isNamespace: false,
              });
            });
          }
        }
      }

      imports.push({
        source: (node.moduleSpecifier as ts.StringLiteral).text,
        specifiers,
        isTypeOnly: !!clause?.isTypeOnly,
        location: getSourceLocation(node, sourceFile),
      });
    }
  });

  return imports;
}

/**
 * Export 정보 추출
 */
export function extractExports(sourceFile: ts.SourceFile): ExportInfo[] {
  const exports: ExportInfo[] = [];

  ts.forEachChild(sourceFile, (node) => {
    // export declaration (re-export)
    if (ts.isExportDeclaration(node)) {
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        node.exportClause.elements.forEach((element) => {
          exports.push({
            name: element.name.getText(sourceFile),
            kind: 're-export',
            location: getSourceLocation(element, sourceFile),
            source: node.moduleSpecifier
              ? (node.moduleSpecifier as ts.StringLiteral).text
              : undefined,
          });
        });
      }
      return;
    }

    // exported declarations
    if (!hasModifier(node, ts.SyntaxKind.ExportKeyword)) {
      return;
    }

    if (ts.isFunctionDeclaration(node) && node.name) {
      exports.push({
        name: node.name.getText(sourceFile),
        kind: 'function',
        location: getSourceLocation(node, sourceFile),
      });
    } else if (ts.isClassDeclaration(node) && node.name) {
      exports.push({
        name: node.name.getText(sourceFile),
        kind: 'class',
        location: getSourceLocation(node, sourceFile),
      });
    } else if (ts.isVariableStatement(node)) {
      node.declarationList.declarations.forEach((decl) => {
        if (ts.isIdentifier(decl.name)) {
          exports.push({
            name: decl.name.getText(sourceFile),
            kind: 'variable',
            location: getSourceLocation(decl, sourceFile),
          });
        }
      });
    } else if (ts.isInterfaceDeclaration(node)) {
      exports.push({
        name: node.name.getText(sourceFile),
        kind: 'interface',
        location: getSourceLocation(node, sourceFile),
      });
    } else if (ts.isTypeAliasDeclaration(node)) {
      exports.push({
        name: node.name.getText(sourceFile),
        kind: 'type',
        location: getSourceLocation(node, sourceFile),
      });
    }
  });

  return exports;
}
