import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PRODUCT_INFORMATION_PATH = 'src/features/inventory/components/product-information.tsx';
const NUTRI_SCORE_VALUES = new Set(['#038141', '#85BB2F', '#FECB02', '#EE8100', '#E63E11']);
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?)$/u;

type ParsedProductionSource = {
  path: string;
  source: ts.SourceFile;
};

function productionSources(): ParsedProductionSource[] {
  const sourceRoot = path.join(REPO_ROOT, 'src');

  function readDirectory(directory: string): ParsedProductionSource[] {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) return readDirectory(filePath);
      if (!entry.isFile() || !SOURCE_FILE.test(entry.name) || entry.name.includes('.test.')) {
        return [];
      }

      const content = fs.readFileSync(filePath, 'utf8');
      const scriptKind = entry.name.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
      return [
        {
          path: path.relative(REPO_ROOT, filePath).split(path.sep).join('/'),
          source: ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, scriptKind),
        },
      ];
    });
  }

  return readDirectory(sourceRoot);
}

function propertyName(node: ts.PropertyName | undefined): string | undefined {
  if (!node) return undefined;
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) return node.text;
  return undefined;
}

function findNutriScoreMaps() {
  return productionSources().flatMap(({ path: sourcePath, source }) => {
    const maps: Array<{
      path: string;
      source: ts.SourceFile;
      declaration: ts.VariableDeclaration;
    }> = [];

    function visit(node: ts.Node) {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === 'NUTRI_BADGE_COLORS'
      ) {
        maps.push({ path: sourcePath, source, declaration: node });
      }
      ts.forEachChild(node, visit);
    }

    visit(source);
    return maps;
  });
}

function findNutriScoreColorViolations(): string[] {
  const maps = findNutriScoreMaps();
  const allowedMap = maps.find(({ path: sourcePath }) => sourcePath === PRODUCT_INFORMATION_PATH);

  return productionSources().flatMap(({ path: sourcePath, source }) => {
    const violations: string[] = [];
    const allowedStart = allowedMap?.declaration.initializer?.getStart(allowedMap.source);
    const allowedEnd = allowedMap?.declaration.initializer?.end;

    function visit(node: ts.Node) {
      if (ts.isStringLiteralLike(node) && NUTRI_SCORE_VALUES.has(node.text)) {
        const isAllowed =
          sourcePath === PRODUCT_INFORMATION_PATH &&
          allowedStart !== undefined &&
          allowedEnd !== undefined &&
          node.getStart(source) >= allowedStart &&
          node.end <= allowedEnd;
        if (!isAllowed)
          violations.push(
            `${sourcePath}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`,
          );
      }
      ts.forEachChild(node, visit);
    }

    visit(source);
    return violations;
  });
}

describe('ProductInformation Styling- und Integrationsvertrag', () => {
  it('besitzt genau einen lokalen Nutri-Score-Owner mit den Graden A bis E', () => {
    const maps = findNutriScoreMaps();
    expect(maps).toHaveLength(1);
    expect(maps[0]?.path).toBe(PRODUCT_INFORMATION_PATH);

    const initializer = maps[0]?.declaration.initializer;
    expect(initializer && ts.isObjectLiteralExpression(initializer)).toBe(true);
    if (!initializer || !ts.isObjectLiteralExpression(initializer)) return;

    const entries = initializer.properties.flatMap((property) => {
      if (!ts.isPropertyAssignment(property) || !ts.isStringLiteralLike(property.initializer)) {
        return [];
      }
      const key = propertyName(property.name);
      return key ? [[key, property.initializer.text] as const] : [];
    });

    expect(new Map(entries)).toEqual(
      new Map([
        ['a', '#038141'],
        ['b', '#85BB2F'],
        ['c', '#FECB02'],
        ['d', '#EE8100'],
        ['e', '#E63E11'],
      ]),
    );
  });

  it('erlaubt die OFF-Hexwerte nur in dieser lokalen Badge-Map', () => {
    expect(findNutriScoreColorViolations()).toEqual([]);
  });

  it('hält die Ausnahme und den Owner im verbindlichen Vertrag fest', () => {
    const contract = fs.readFileSync(
      path.join(REPO_ROOT, 'docs/design-system/contracts/05-unistyles-and-stylesheet.md'),
      'utf8',
    );
    const plan = fs.readFileSync(
      path.join(REPO_ROOT, 'tasks/product-information-token-plan.md'),
      'utf8',
    );

    expect(contract).toMatch(/ProductInformation und Nutri-Score/iu);
    expect(contract).toMatch(/Open Food Facts/iu);
    expect(contract).toMatch(/NUTRI_BADGE_COLORS/iu);
    expect(contract).toMatch(/keinen zweiten Farb-Map-Owner/iu);
    expect(plan).toMatch(/Owner-Register/iu);
    expect(plan).toMatch(/Android ist ausdrücklich nicht Teil/iu);
  });

  it('hält die Nutri-Score-Entscheidung aus den drei globalen Theme-Ownern heraus', () => {
    for (const ownerPath of [
      'src/components/theme/index.ts',
      'src/components/theme/ThemeProvider.tsx',
      'src/constants/ui.tsx',
    ]) {
      const source = fs.readFileSync(path.join(REPO_ROOT, ownerPath), 'utf8');
      expect(source).not.toMatch(/NUTRI_BADGE_COLORS|Open Food Facts/iu);
    }
  });
});
