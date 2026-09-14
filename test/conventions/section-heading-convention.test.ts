import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SOURCE_ROOT = path.join(REPO_ROOT, 'src');
const CANONICAL_SECTION_HEADING_PATH = path.join(SOURCE_ROOT, 'constants', 'ui.tsx');
const RETIRED_SECTION_HEADING_PATH = path.join(
  SOURCE_ROOT,
  'components',
  'layout',
  'section-heading.tsx',
);

type SyntaxLocation = {
  relativePath: string;
  line: number;
};

type ModuleReference = SyntaxLocation & {
  specifier: string;
};

function isProductionSourceFile(filePath: string): boolean {
  const filename = path.basename(filePath);
  return /\.(?:ts|tsx)$/u.test(filename) && !/(?:\.test|\.spec)\.[^.]+$/u.test(filename);
}

function getProductionSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return getProductionSourceFiles(filePath);
    return entry.isFile() && isProductionSourceFile(filePath) ? [filePath] : [];
  });
}

function parseSourceFile(filePath: string): ts.SourceFile {
  const source = fs.readFileSync(filePath, 'utf8');
  const scriptKind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, scriptKind);
}

function isSectionHeadingNamedDeclaration(
  node: ts.Node,
): node is
  | ts.FunctionDeclaration
  | ts.ClassDeclaration
  | ts.InterfaceDeclaration
  | ts.TypeAliasDeclaration
  | ts.EnumDeclaration
  | ts.ModuleDeclaration {
  return (
    (ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isEnumDeclaration(node) ||
      ts.isModuleDeclaration(node)) &&
    node.name?.text === 'SectionHeading'
  );
}

function isSectionHeadingVariableDeclaration(node: ts.Node): node is ts.VariableDeclaration {
  return (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.name.text === 'SectionHeading'
  );
}

function getLocation(sourceFile: ts.SourceFile, node: ts.Node): SyntaxLocation {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return {
    relativePath: path.relative(REPO_ROOT, sourceFile.fileName).split(path.sep).join('/'),
    line: line + 1,
  };
}

function findSectionHeadingDefinitions(): SyntaxLocation[] {
  return getProductionSourceFiles(SOURCE_ROOT)
    .sort()
    .flatMap((filePath) => {
      const sourceFile = parseSourceFile(filePath);
      return sourceFile.statements.flatMap((statement) => {
        if (isSectionHeadingNamedDeclaration(statement)) {
          return [getLocation(sourceFile, statement)];
        }
        if (ts.isVariableStatement(statement)) {
          return statement.declarationList.declarations
            .filter(isSectionHeadingVariableDeclaration)
            .map((declaration) => getLocation(sourceFile, declaration));
        }
        return [];
      });
    });
}

function getModuleSpecifier(node: ts.Node): string | undefined {
  if (
    (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
    node.moduleSpecifier &&
    ts.isStringLiteralLike(node.moduleSpecifier)
  ) {
    return node.moduleSpecifier.text;
  }
  if (
    ts.isImportEqualsDeclaration(node) &&
    node.moduleReference.kind === ts.SyntaxKind.ExternalModuleReference &&
    ts.isStringLiteralLike(node.moduleReference.expression)
  ) {
    return node.moduleReference.expression.text;
  }
  return undefined;
}

function getCandidateModulePaths(importingFilePath: string, specifier: string): string[] {
  const basePath = specifier.startsWith('@/')
    ? path.join(SOURCE_ROOT, specifier.slice(2))
    : specifier.startsWith('.')
      ? path.resolve(path.dirname(importingFilePath), specifier)
      : undefined;

  if (!basePath) return [];
  return [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.tsx'),
  ];
}

function referencesRetiredSectionHeadingModule(
  importingFilePath: string,
  specifier: string,
): boolean {
  return getCandidateModulePaths(importingFilePath, specifier).some(
    (candidatePath) =>
      path.normalize(candidatePath) === path.normalize(RETIRED_SECTION_HEADING_PATH),
  );
}

function findRetiredSectionHeadingImports(): ModuleReference[] {
  return getProductionSourceFiles(SOURCE_ROOT)
    .sort()
    .flatMap((filePath) => {
      const sourceFile = parseSourceFile(filePath);
      return sourceFile.statements.flatMap((statement) => {
        const specifier = getModuleSpecifier(statement);
        if (!specifier || !referencesRetiredSectionHeadingModule(filePath, specifier)) return [];
        return [{ ...getLocation(sourceFile, statement), specifier }];
      });
    });
}

describe('SectionHeading Ownership Gate', () => {
  it('has exactly one productive definition in the canonical UI owner', () => {
    const definitions = findSectionHeadingDefinitions();

    expect(definitions.map(({ relativePath }) => relativePath)).toEqual([
      path.relative(REPO_ROOT, CANONICAL_SECTION_HEADING_PATH).split(path.sep).join('/'),
    ]);
  });

  it('has no imports or re-exports from the retired layout module', () => {
    expect(findRetiredSectionHeadingImports()).toEqual([]);
  });
});
