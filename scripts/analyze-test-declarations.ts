import { readFile } from 'node:fs/promises';
import * as ts from 'typescript';

export const TEST_MARKERS = ['.only', '.skip', 'fit', 'fdescribe', 'xit', 'xdescribe'] as const;

export type TestMarker = (typeof TEST_MARKERS)[number];

export type TestDeclarationMetrics = {
  describeBlocks: number;
  file: string;
  markers: Record<TestMarker, number>;
  testDeclarations: number;
};

type JestDeclaration = {
  kind: 'describe' | 'test';
  marker?: TestMarker;
};

const TEST_NAMES = new Set(['it', 'test', 'fit', 'xit']);
const DESCRIBE_NAMES = new Set(['describe', 'fdescribe', 'xdescribe']);

function emptyMarkers(): Record<TestMarker, number> {
  return Object.fromEntries(TEST_MARKERS.map((marker) => [marker, 0])) as Record<
    TestMarker,
    number
  >;
}

function expressionParts(
  expression: ts.Expression,
): { root: string; properties: string[] } | undefined {
  if (ts.isIdentifier(expression)) return { root: expression.text, properties: [] };
  if (!ts.isPropertyAccessExpression(expression)) return undefined;

  const parent = expressionParts(expression.expression);
  if (!parent) return undefined;
  return { root: parent.root, properties: [...parent.properties, expression.name.text] };
}

function getJestDeclaration(call: ts.CallExpression): JestDeclaration | undefined {
  const expression = call.expression;
  const parts = ts.isCallExpression(expression)
    ? expressionParts(expression.expression)
    : expressionParts(expression);
  if (!parts) return undefined;

  const markerProperty = parts.properties.find(
    (property) => property === 'only' || property === 'skip',
  );
  if (TEST_NAMES.has(parts.root)) {
    return {
      kind: 'test',
      marker:
        parts.root === 'fit'
          ? 'fit'
          : parts.root === 'xit'
            ? 'xit'
            : markerProperty
              ? `.${markerProperty}`
              : undefined,
    };
  }

  if (DESCRIBE_NAMES.has(parts.root)) {
    return {
      kind: 'describe',
      marker:
        parts.root === 'fdescribe'
          ? 'fdescribe'
          : parts.root === 'xdescribe'
            ? 'xdescribe'
            : markerProperty
              ? `.${markerProperty}`
              : undefined,
    };
  }

  return undefined;
}

function isFactoryCall(call: ts.CallExpression): boolean {
  return ts.isCallExpression(call.parent) && call.parent.expression === call;
}

export function analyzeTestSource(source: string, file: string): TestDeclarationMetrics {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx')
      ? ts.ScriptKind.TSX
      : file.endsWith('.jsx')
        ? ts.ScriptKind.JSX
        : ts.ScriptKind.TS,
  );
  const metrics: TestDeclarationMetrics = {
    describeBlocks: 0,
    file,
    markers: emptyMarkers(),
    testDeclarations: 0,
  };

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && !isFactoryCall(node)) {
      const declaration = getJestDeclaration(node);
      if (declaration) {
        if (declaration.kind === 'describe') metrics.describeBlocks += 1;
        else metrics.testDeclarations += 1;
        if (declaration.marker) metrics.markers[declaration.marker] += 1;
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return metrics;
}

async function main(): Promise<void> {
  const files = process.argv.slice(2);
  if (files.length === 0) throw new Error('Mindestens eine Testdatei ist erforderlich.');

  const reports = await Promise.all(
    files.map(async (file) => analyzeTestSource(await readFile(file, 'utf8'), file)),
  );
  const markers = emptyMarkers();
  for (const report of reports) {
    for (const marker of TEST_MARKERS) markers[marker] += report.markers[marker];
  }

  console.log(
    JSON.stringify(
      {
        describeBlocks: reports.reduce((total, report) => total + report.describeBlocks, 0),
        files: reports,
        markers,
        testDeclarations: reports.reduce((total, report) => total + report.testDeclarations, 0),
      },
      null,
      2,
    ),
  );
}

if (require.main === module) void main();
