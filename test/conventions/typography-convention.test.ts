import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SOURCE_DIRECTORIES = ['src/components', 'src/features'];
const TYPOGRAPHY_PROPERTIES = new Set(['fontSize', 'lineHeight', 'fontWeight', 'letterSpacing']);
const EXCEPTION_MARKER = '// typography-role-exception:';

type TypographyDeclaration = {
  file: string;
  line: number;
  property: string;
};

function normalizePath(relativePath: string): string {
  return relativePath.split(path.sep).join('/');
}

function isInTypographyScope(relativePath: string): boolean {
  const normalizedPath = normalizePath(relativePath);
  const isProductSource =
    normalizedPath.startsWith('src/components/') || normalizedPath.startsWith('src/features/');

  return (
    isProductSource &&
    !normalizedPath.startsWith('src/components/theme/') &&
    !normalizedPath.startsWith('src/features/settings/dev/') &&
    !/\.(?:test|spec)\.(?:ts|tsx)$/u.test(normalizedPath) &&
    /\.tsx?$/u.test(normalizedPath)
  );
}

function getProductionSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return getProductionSourceFiles(filePath);

    const relativePath = normalizePath(path.relative(REPO_ROOT, filePath));
    return entry.isFile() && isInTypographyScope(relativePath) ? [filePath] : [];
  });
}

function getPropertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  if (ts.isComputedPropertyName(name) && ts.isStringLiteral(name.expression)) {
    return name.expression.text;
  }
  return undefined;
}

function hasDocumentedException(sourceLines: string[], line: number): boolean {
  const previousLine = sourceLines[line - 2]?.trim();
  if (!previousLine?.startsWith(EXCEPTION_MARKER)) return false;
  return previousLine.slice(EXCEPTION_MARKER.length).trim().length > 0;
}

function findUndocumentedTypographyDeclarations(
  source: string,
  fileName: string,
): TypographyDeclaration[] {
  const scriptKind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const sourceLines = source.split(/\r?\n/u);
  const declarations: TypographyDeclaration[] = [];

  function visit(node: ts.Node): void {
    let property: string | undefined;
    let locationNode: ts.Node | undefined;

    if (ts.isPropertyAssignment(node)) {
      property = getPropertyName(node.name);
      locationNode = node.name;
    } else if (ts.isShorthandPropertyAssignment(node)) {
      property = node.name.text;
      locationNode = node.name;
    } else if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name)) {
      property = node.name.text;
      locationNode = node.name;
    }

    if (property && locationNode && TYPOGRAPHY_PROPERTIES.has(property)) {
      const { line } = sourceFile.getLineAndCharacterOfPosition(locationNode.getStart(sourceFile));
      const lineNumber = line + 1;
      if (!hasDocumentedException(sourceLines, lineNumber)) {
        declarations.push({
          file: normalizePath(path.relative(REPO_ROOT, fileName)),
          line: lineNumber,
          property,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return declarations;
}

function findProductionTypographyViolations(): TypographyDeclaration[] {
  return SOURCE_DIRECTORIES.flatMap((directory) =>
    getProductionSourceFiles(path.join(REPO_ROOT, directory)).flatMap((filePath) =>
      findUndocumentedTypographyDeclarations(fs.readFileSync(filePath, 'utf8'), filePath),
    ),
  ).sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line);
}

describe('Feature typography convention', () => {
  it('detects direct declarations in style objects and JSX attributes', () => {
    const declarations = findUndocumentedTypographyDeclarations(
      [
        'const style = {',
        '  fontSize: 12,',
        '  lineHeight: 16,',
        '  fontWeight: "700",',
        '  letterSpacing: 1,',
        '};',
        'const element = <Text fontSize={12} />;',
      ].join('\n'),
      'fixture.tsx',
    );

    expect(declarations.map(({ property }) => property)).toEqual([
      'fontSize',
      'lineHeight',
      'fontWeight',
      'letterSpacing',
      'fontSize',
    ]);
  });

  it('allows a local typography exception only when its rationale is documented', () => {
    const declarations = findUndocumentedTypographyDeclarations(
      [
        'const styles = {',
        '  heading: {',
        '    // typography-role-exception: preserve the tall line box in this verification card.',
        '    lineHeight: font.lineHeights.title,',
        '  },',
        '};',
      ].join('\n'),
      'fixture.ts',
    );

    expect(declarations).toEqual([]);
  });

  it('excludes Settings-Dev, design-system docs, and typography owners from feature checks', () => {
    expect(isInTypographyScope('src/features/settings/dev/design-system/showcase.tsx')).toBe(false);
    expect(isInTypographyScope('docs/design-system/contracts/typography.md')).toBe(false);
    expect(isInTypographyScope('src/components/theme/index.ts')).toBe(false);
    expect(isInTypographyScope('src/features/recipes/screens/recipes-screen.tsx')).toBe(true);
  });

  it('keeps production components and features on shared typography roles', () => {
    expect(findProductionTypographyViolations()).toEqual([]);
  });
});
