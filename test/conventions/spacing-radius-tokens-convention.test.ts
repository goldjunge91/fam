import fs from 'node:fs';
import path from 'node:path';
import * as ts from 'typescript';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SOURCE_ROOT = path.join(REPO_ROOT, 'src');
const TOKEN_NAMESPACES = ['space', 'radius'] as const;
type TokenNamespace = (typeof TOKEN_NAMESPACES)[number];

function isSettingsDevPath(relativePath: string): boolean {
  const segments = relativePath.split(path.sep);
  return segments.some((segment, index) => {
    if (segment !== 'settings') {
      return false;
    }

    const settingName = segments[index + 1]?.replace(/\.[^.]+$/u, '');
    return settingName === 'dev' || settingName?.startsWith('dev-') === true;
  });
}

function isTestSourcePath(relativePath: string): boolean {
  const segments = relativePath.split(path.sep);
  return (
    segments.some((segment) => ['__tests__', 'test', 'tests'].includes(segment)) ||
    /\.(?:test|spec)\.tsx?$/u.test(relativePath)
  );
}

function collectSourceFiles(directory = SOURCE_ROOT): string[] {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(SOURCE_ROOT, absolutePath);

      if (isSettingsDevPath(relativePath) || isTestSourcePath(relativePath)) {
        return [];
      }

      if (entry.isDirectory()) {
        return collectSourceFiles(absolutePath);
      }

      if (!entry.isFile() || !/\.tsx?$/u.test(entry.name)) {
        return [];
      }

      return [absolutePath];
    });
}

function propertyName(node: ts.PropertyName | ts.Expression | undefined): string | undefined {
  if (!node) {
    return undefined;
  }

  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }

  return undefined;
}

function getAccessName(node: ts.Expression): string | undefined {
  if (ts.isPropertyAccessExpression(node)) {
    return node.name.text;
  }

  if (ts.isElementAccessExpression(node)) {
    return propertyName(node.argumentExpression);
  }

  return undefined;
}

function getAccessBase(node: ts.Expression): ts.Expression | undefined {
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    return node.expression;
  }

  return undefined;
}

function arithmeticOperator(operator: ts.SyntaxKind): boolean {
  return [
    ts.SyntaxKind.PlusToken,
    ts.SyntaxKind.MinusToken,
    ts.SyntaxKind.AsteriskToken,
    ts.SyntaxKind.SlashToken,
    ts.SyntaxKind.PercentToken,
    ts.SyntaxKind.AsteriskAsteriskToken,
  ].includes(operator);
}

function isTokenNamespaceExpression(
  expression: ts.Expression,
  namespaceAliases: Map<string, Set<TokenNamespace>>,
): boolean {
  if (ts.isIdentifier(expression)) {
    return namespaceAliases.has(expression.text);
  }

  const name = getAccessName(expression);
  const base = getAccessBase(expression);
  if (!name || !base) {
    return false;
  }

  if (
    TOKEN_NAMESPACES.includes(name as TokenNamespace) &&
    ts.isIdentifier(base) &&
    base.text === 'theme'
  ) {
    return true;
  }

  return isTokenNamespaceExpression(base, namespaceAliases);
}

function isStaticTokenValue(
  expression: ts.Expression,
  namespaceAliases: Map<string, Set<TokenNamespace>>,
  valueAliases: Set<string>,
): boolean {
  if (ts.isParenthesizedExpression(expression)) {
    return isStaticTokenValue(expression.expression, namespaceAliases, valueAliases);
  }

  if (
    ts.isNumericLiteral(expression) ||
    (ts.isIdentifier(expression) && valueAliases.has(expression.text))
  ) {
    return true;
  }

  if (
    (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) &&
    isTokenNamespaceExpression(getAccessBase(expression) ?? expression, namespaceAliases)
  ) {
    return !TOKEN_NAMESPACES.includes(getAccessName(expression) as TokenNamespace);
  }

  return (
    ts.isBinaryExpression(expression) &&
    arithmeticOperator(expression.operatorToken.kind) &&
    isStaticTokenValue(expression.left, namespaceAliases, valueAliases) &&
    isStaticTokenValue(expression.right, namespaceAliases, valueAliases)
  );
}

function containsTokenValue(
  expression: ts.Expression,
  namespaceAliases: Map<string, Set<TokenNamespace>>,
  valueAliases: Set<string>,
): boolean {
  if (ts.isParenthesizedExpression(expression)) {
    return containsTokenValue(expression.expression, namespaceAliases, valueAliases);
  }

  if (ts.isIdentifier(expression) && valueAliases.has(expression.text)) {
    return true;
  }

  if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
    return (
      isTokenNamespaceExpression(getAccessBase(expression) ?? expression, namespaceAliases) &&
      !TOKEN_NAMESPACES.includes(getAccessName(expression) as TokenNamespace)
    );
  }

  return (
    ts.isBinaryExpression(expression) &&
    (containsTokenValue(expression.left, namespaceAliases, valueAliases) ||
      containsTokenValue(expression.right, namespaceAliases, valueAliases))
  );
}

function collectAliases(sourceFile: ts.SourceFile): {
  namespaceAliases: Map<string, Set<TokenNamespace>>;
  valueAliases: Set<string>;
} {
  const namespaceAliases = new Map<string, Set<TokenNamespace>>(
    TOKEN_NAMESPACES.map((name) => [name, new Set([name])]),
  );

  const addNamespaceAlias = (name: string, namespaces: Set<TokenNamespace>) => {
    const existing = namespaceAliases.get(name) ?? new Set<TokenNamespace>();
    for (const namespace of namespaces) {
      existing.add(namespace);
    }
    namespaceAliases.set(name, existing);
  };

  const visitImports = (node: ts.Node) => {
    if (
      ts.isImportDeclaration(node) &&
      node.importClause?.namedBindings &&
      ts.isNamedImports(node.importClause.namedBindings)
    ) {
      for (const element of node.importClause.namedBindings.elements) {
        const importedName = element.propertyName?.text ?? element.name.text;
        if (TOKEN_NAMESPACES.includes(importedName as TokenNamespace)) {
          addNamespaceAlias(element.name.text, new Set([importedName as TokenNamespace]));
        }
      }
    }
    ts.forEachChild(node, visitImports);
  };
  visitImports(sourceFile);

  const visitDestructuredAliases = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer
    ) {
      for (const element of node.name.elements) {
        const tokenName = propertyName(
          element.propertyName ?? (ts.isIdentifier(element.name) ? element.name : undefined),
        );
        const localName = ts.isIdentifier(element.name) ? element.name.text : undefined;
        if (
          localName &&
          TOKEN_NAMESPACES.includes(tokenName as TokenNamespace) &&
          ((ts.isIdentifier(node.initializer) && node.initializer.text === 'theme') ||
            isTokenNamespaceExpression(node.initializer, namespaceAliases))
        ) {
          addNamespaceAlias(localName, new Set([tokenName as TokenNamespace]));
        }
      }
    }
    ts.forEachChild(node, visitDestructuredAliases);
  };
  visitDestructuredAliases(sourceFile);

  const declarations: ts.VariableDeclaration[] = [];
  const visitDeclarations = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node)) {
      declarations.push(node);
    }
    ts.forEachChild(node, visitDeclarations);
  };
  visitDeclarations(sourceFile);

  for (const declaration of declarations) {
    if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
      continue;
    }

    const initializer = declaration.initializer;
    const namespace = getAccessName(initializer);
    const base = getAccessBase(initializer);
    if (
      TOKEN_NAMESPACES.includes(namespace as TokenNamespace) &&
      base &&
      ts.isIdentifier(base) &&
      base.text === 'theme'
    ) {
      addNamespaceAlias(declaration.name.text, new Set([namespace as TokenNamespace]));
    }
  }

  const valueAliases = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const declaration of declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.initializer &&
        !namespaceAliases.has(declaration.name.text) &&
        !valueAliases.has(declaration.name.text) &&
        isStaticTokenValue(declaration.initializer, namespaceAliases, valueAliases) &&
        containsTokenValue(declaration.initializer, namespaceAliases, valueAliases)
      ) {
        valueAliases.add(declaration.name.text);
        changed = true;
      }
    }
  }

  return { namespaceAliases, valueAliases };
}

function findTokenArithmetic(sourceText: string, fileLabel: string): string[] {
  const sourceFile = ts.createSourceFile(
    fileLabel,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const { namespaceAliases, valueAliases } = collectAliases(sourceFile);
  const violations: string[] = [];

  const visit = (node: ts.Node) => {
    if (
      ts.isBinaryExpression(node) &&
      arithmeticOperator(node.operatorToken.kind) &&
      isStaticTokenValue(node.left, namespaceAliases, valueAliases) &&
      isStaticTokenValue(node.right, namespaceAliases, valueAliases) &&
      (containsTokenValue(node.left, namespaceAliases, valueAliases) ||
        containsTokenValue(node.right, namespaceAliases, valueAliases))
    ) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      violations.push(`${fileLabel}:${line + 1}: ${node.getText(sourceFile)}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return violations;
}

function findProductionViolations(): string[] {
  return collectSourceFiles().flatMap((filePath) =>
    findTokenArithmetic(fs.readFileSync(filePath, 'utf8'), path.relative(REPO_ROOT, filePath)),
  );
}

describe('Spacing and radius token convention', () => {
  it('detects arithmetic around spacing and radius tokens, including aliases and grouped operands', () => {
    const source = `
      import { space as spacing } from '@/components/theme';
      const { radius: corners } = theme;
      const cardGap = spacing.md;
      const compactGap = (2 + spacing.md) / 2;
      const compactAlias = spacing.xs;
      const aliasedHalf = 2 / compactAlias;
      const horizontal = 2 * theme.space.sm;
      const outer = 4 - corners.md;
      const rounded = 3 + (radius.lg * 2);
      const allowed = spacing.md;
      const measured = insets.bottom + spacing.xs;
    `;

    const violations = findTokenArithmetic(source, 'fixture.ts');
    expect(violations).toEqual(
      expect.arrayContaining([
        expect.stringContaining('spacing.md) / 2'),
        expect.stringContaining('2 / compactAlias'),
        expect.stringContaining('2 * theme.space.sm'),
        expect.stringContaining('4 - corners.md'),
        expect.stringContaining('radius.lg * 2'),
        expect.stringContaining('3 + (radius.lg * 2)'),
      ]),
    );
    expect(violations).toHaveLength(7);
  });

  it('keeps token arithmetic out of production styles', () => {
    expect(findProductionViolations()).toEqual([]);
  });

  it('keeps the removed micro radius token out of production styles', () => {
    const radiusDefinition = fs
      .readFileSync(path.join(SOURCE_ROOT, 'components/theme/index.ts'), 'utf8')
      .match(/export const radius = \{([\s\S]*?)\n\} as const;/u)?.[1];

    if (!radiusDefinition) {
      throw new Error('Could not find the radius token definition.');
    }

    expect(radiusDefinition).not.toMatch(/^\s*micro\s*:/mu);
    const source = collectSourceFiles()
      .map((filePath) => fs.readFileSync(filePath, 'utf8'))
      .join('\n');
    expect(source).not.toMatch(/\bradius\.micro\b/u);
  });
});
