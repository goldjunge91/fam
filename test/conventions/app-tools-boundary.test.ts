import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PRODUCT_DIRECTORIES = ['src', 'modules', 'plugins', 'targets', 'supabase/functions'];
const PRODUCT_ROOT_FILES = ['app.config.ts'];
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?)$/u;
const TEST_FILE = /\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/u;
const TOOL_PATHS = [
  'tools/batch-import/',
  'tools/brochure-viewer/',
  'tools/build-gui/',
  'tools/category-debugger/',
  'tools/classify.ts',
  'tools/crawler/brochures/listing-only/',
  'tools/llm-test-platform/',
  'tools/product-search-lab/',
  'tools/receipt-ocr-tesseract/',
  'tools/recipe-extraction/',
  'tools/recipe-suggestion-prototype/',
  'tools/speech-to-text/',
] as const;

function collectSourceFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') return [];
      return collectSourceFiles(entryPath);
    }
    if (!entry.isFile() || !SOURCE_FILE.test(entry.name) || TEST_FILE.test(entry.name)) return [];
    return [entryPath];
  });
}

function moduleSpecifiers(
  sourceText: string,
  filePath: string,
): Array<{ value: string; line: number }> {
  const source = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const specifiers: Array<{ value: string; line: number }> = [];

  function addSpecifier(node: ts.StringLiteralLike): void {
    specifiers.push({
      value: node.text,
      line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
    });
  }

  function visit(node: ts.Node): void {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      addSpecifier(node.moduleSpecifier);
    }

    if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression &&
      ts.isStringLiteralLike(node.moduleReference.expression)
    ) {
      addSpecifier(node.moduleReference.expression);
    }

    if (ts.isCallExpression(node)) {
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
      const [argument] = node.arguments;
      if ((isDynamicImport || isRequire) && argument && ts.isStringLiteralLike(argument)) {
        addSpecifier(argument);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(source);
  return specifiers;
}

function pointsIntoTools(importerPath: string, specifier: string): boolean {
  const normalizedSpecifier = specifier.replaceAll('\\', '/');
  if (normalizedSpecifier === 'tools' || normalizedSpecifier.startsWith('tools/')) return true;

  if (!specifier.startsWith('.') && !path.isAbsolute(specifier)) return false;

  const resolvedPath = path.isAbsolute(specifier)
    ? path.normalize(specifier)
    : path.resolve(path.dirname(importerPath), specifier);
  const relativePath = path.relative(REPO_ROOT, resolvedPath);
  return relativePath === 'tools' || relativePath.startsWith(`tools${path.sep}`);
}

function findToolImports(
  sourceText: string,
  filePath: string,
): Array<{ value: string; line: number }> {
  return moduleSpecifiers(sourceText, filePath).filter(({ value }) =>
    pointsIntoTools(filePath, value),
  );
}

function productionFiles(): string[] {
  return [
    ...PRODUCT_DIRECTORIES.flatMap((directory) =>
      collectSourceFiles(path.join(REPO_ROOT, directory)),
    ),
    ...PRODUCT_ROOT_FILES.map((file) => path.join(REPO_ROOT, file)).filter(fs.existsSync),
  ];
}

describe('App-Tools-Grenze', () => {
  it('erkennt statische, dynamische und CommonJS-Imports in tools', () => {
    const importerPath = path.join(REPO_ROOT, 'src', 'example.ts');
    const source = `
      import direct from '../tools/direct';
      export { value } from '../tools/exported';
      const dynamic = import('../tools/dynamic');
      const commonJs = require('../tools/common-js');
    `;

    expect(findToolImports(source, importerPath).map(({ value }) => value)).toEqual([
      '../tools/direct',
      '../tools/exported',
      '../tools/dynamic',
      '../tools/common-js',
    ]);
  });

  it('verwechselt App-devtools und externe Pakete nicht mit dem Root-Ordner tools', () => {
    const importerPath = path.join(REPO_ROOT, 'src', 'example.ts');
    const source = `
      import { capture } from '@/lib/devtools/screenshots';
      import helper from './feature-tools/helper';
      import toolkit from '@example/tools';
    `;

    expect(findToolImports(source, importerPath)).toEqual([]);
  });

  it('hält App- und Runtime-Quellen frei von Abhängigkeiten auf tools', () => {
    const violations = productionFiles().flatMap((filePath) =>
      findToolImports(fs.readFileSync(filePath, 'utf8'), filePath).map(
        ({ value, line }) => `${path.relative(REPO_ROOT, filePath)}:${line} -> ${value}`,
      ),
    );

    expect(violations).toEqual([]);
  });

  it('dokumentiert alle Experimente und ihre einseitige Abhängigkeitsregel', () => {
    const readme = fs.readFileSync(path.join(REPO_ROOT, 'tools', 'README.md'), 'utf8');

    for (const toolPath of TOOL_PATHS) expect(readme).toContain(`\`${toolPath}\``);
    expect(readme).toMatch(/unfertige Experimente/iu);
    expect(readme).toMatch(/App- und Runtime-Code[^.]*nie[^.]*tools\//iu);
    expect(readme).toMatch(/eigenes Repository/iu);
    expect(readme).not.toContain('file://');
    expect(readme).not.toMatch(
      /bun run (?:tools:brochures|debugger:category|tools:recipe-catalog)/u,
    );
  });
});
