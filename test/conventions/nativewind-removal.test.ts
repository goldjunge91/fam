import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?|css)$/u;
const JSON_CONFIG = /(?:\.jsonc?$|^\.(?:babelrc|prettierrc|postcssrc)$|^bun\.lock$)/u;
const RETIRED_ASSET = /^(?:tailwind\.config\.[cm]?[jt]s|nativewind-env\.d\.ts|global\.css)$/u;
const LEGACY_PACKAGES =
  '(?:nativewind|tailwindcss|react-native-css-interop|prettier-plugin-tailwindcss|tailwind-merge|@tailwindcss/[\\w-]+)';
const MODULE_REFERENCE = new RegExp(`^${LEGACY_PACKAGES}(?:/|$)`, 'u');
const CONFIG_REFERENCE = new RegExp(`(?:^|[\\s"'=:])${LEGACY_PACKAGES}(?=$|[/@\\s"'])`, 'u');
const FORBIDDEN_PROPS = new Set(['className', 'contentContainerClassName']);

function getSourceFiles(directory: string, insideSource = false): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return insideSource || entry.name === 'src' ? getSourceFiles(filePath, true) : [];
    }
    return entry.isFile() && (SOURCE_FILE.test(entry.name) || (!insideSource && JSON_CONFIG.test(entry.name)))
      ? [filePath]
      : [];
  });
}

function propertyName(node: ts.Node | undefined): string | undefined {
  if (!node) return undefined;
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) return node.text;
  if (ts.isComputedPropertyName(node)) return propertyName(node.expression);
  return undefined;
}

function objectProperty(node: ts.Node, name: string): ts.Expression {
  if (ts.isObjectLiteralExpression(node)) {
    for (const property of node.properties) {
      if (ts.isPropertyAssignment(property) && propertyName(property.name) === name) {
        return property.initializer;
      }
    }
  }
  throw new Error(`Bun-Lockfile: erwartetes Objektfeld ${JSON.stringify(name)} fehlt.`);
}

function findViolations(root: string): string[] {
  return getSourceFiles(root).sort().flatMap((filePath) => {
    const relativePath = path.relative(root, filePath).split(path.sep).join('/');
    const filename = path.basename(filePath);
    if (RETIRED_ASSET.test(filename)) return [`${relativePath}:1`];

    const text = fs.readFileSync(filePath, 'utf8');
    if (filePath.endsWith('.css')) {
      const withoutComments = text.replace(/\/\*[\s\S]*?\*\//gu, (comment) => comment.replace(/[^\n]/gu, ' '));
      return [...withoutComments.matchAll(/@(?:tailwind|apply|theme|utility|custom-variant|variant|source|config|plugin)\b|@import\s+['"](?:tailwindcss|nativewind)(?:\/|['"])/gu)]
        .map((match) => `${relativePath}:${text.slice(0, match.index).split('\n').length}`);
    }

    const source = JSON_CONFIG.test(filename)
      ? ts.parseJsonText(filePath, text)
      : ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true);
    const violations = new Set<string>();
    const referencePattern = path.dirname(filePath) === root ? CONFIG_REFERENCE : MODULE_REFERENCE;
    const report = (node: ts.Node) => {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
      violations.add(`${relativePath}:${line + 1}`);
    };

    function visit(node: ts.Node) {
      if ((ts.isStringLiteralLike(node) || ts.isIdentifier(node)) && referencePattern.test(node.text)) {
        report(node);
      }

      // Reads in absence assertions remain legal; declarations and writes do not.
      if (ts.isJsxAttribute(node) || ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node) || ts.isPropertySignature(node) || ts.isPropertyDeclaration(node)) {
        if (FORBIDDEN_PROPS.has(propertyName(node.name) ?? '')) report(node.name);
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
        const target = node.left;
        const name = ts.isPropertyAccessExpression(target) ? target.name : ts.isElementAccessExpression(target) ? target.argumentExpression : undefined;
        if (FORBIDDEN_PROPS.has(propertyName(name) ?? '')) report(target);
      }
      ts.forEachChild(node, visit);
    }

    if (filename === 'bun.lock') {
      // Rozenite has an independent Tailwind UI; only the app workspace is forbidden.
      const statement = source.statements[0];
      if (!statement || !ts.isExpressionStatement(statement)) throw new Error('Ungültiges Bun-Lockfile.');
      visit(objectProperty(objectProperty(statement.expression, 'workspaces'), ''));
    } else {
      visit(source);
      for (const reference of source.typeReferenceDirectives) {
        if (MODULE_REFERENCE.test(reference.fileName)) {
          violations.add(`${relativePath}:${source.getLineAndCharacterOfPosition(reference.pos).line + 1}`);
        }
      }
    }
    return [...violations];
  });
}

describe('NativeWind-Removal-Gate', () => {
  it('findet keine Legacy-Props, Pakete, Konfiguration oder Styling-Assets in der App', () => {
    expect(findViolations(REPO_ROOT)).toEqual([]);
  });
});

describe('Removal-Gate erkennt Wiedereinführungen', () => {
  let root: string;

  function writeFixture(relativePath: string, content: string) {
    const filePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fam-nativewind-gate-'));
    writeFixture('src/clean.ts', 'export const enabled = true;');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it.each([
    ['src/view.tsx', '<View className="p-4" />;', 1],
    ['src/view.tsx', '<View contentContainerClassName="p-4" />;', 1],
    ['src/view.tsx', '<View\n className\n ="p-4" />;', 2],
    ['src/view.tsx', 'const props = { className: "p-4" }; <View {...props} />;', 1],
    ['src/view.tsx', '<View {...{ className }} />;', 1],
    ['src/view.tsx', '<View {...{ "contentContainerClassName": "p-4" }} />;', 1],
    ['src/view.tsx', '<View {...{ ["className"]: "p-4" }} />;', 1],
    ['src/view.tsx', 'props.contentContainerClassName = "p-4";', 1],
    ['src/view.tsx', 'props["className"] = "p-4";', 1],
    ['src/legacy.ts', 'import { vars } from\n"nativewind";', 2],
    ['src/legacy.ts', 'import "tailwindcss";', 1],
    ['src/legacy.ts', 'export { cssInterop } from "react-native-css-interop";', 1],
    ['src/legacy.ts', 'const legacy = require("nativewind/jsx-runtime");', 1],
    ['src/legacy.ts', 'import("tailwindcss/plugin");', 1],
    ['src/legacy.ts', 'import legacy = require("nativewind");', 1],
    ['src/types.d.ts', '/// <reference types="nativewind/types" />', 1],
    ['src/legacy.jsx', 'import "nativewind";', 1],
    ['src/legacy.mjs', 'import "tailwindcss";', 1],
    ['src/legacy.cjs', 'require("react-native-css-interop");', 1],
    ['index.ts', 'import "nativewind";', 1],
    ['babel.config.js', 'module.exports = { presets: ["nativewind/babel"] };', 1],
    ['metro.config.cjs', 'const { withNativeWind } = require("nativewind/metro");', 1],
    ['postcss.config.mjs', 'export default { plugins: { tailwindcss: {} } };', 1],
    ['.babelrc', '{"presets": ["nativewind/babel"]}', 1],
    ['tsconfig.json', '{"compilerOptions": {"jsxImportSource": "nativewind"}}', 1],
    ['package.json', '{"scripts": {"check:css": "bunx tailwindcss -i src/global.css"}}', 1],
    ['package.json', '{"dependencies": {"legacy": "npm:nativewind@4"}}', 1],
    ['src/styles.css', '/* Historie */\n@tailwind utilities;', 2],
    ['src/styles.css', '@import\n"tailwindcss";', 1],
  ])('meldet %s: %s', (relativePath, content, line) => {
    writeFixture(relativePath, content);

    expect(findViolations(root)).toEqual([`${relativePath}:${line}`]);
  });

  it.each(['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'])(
    'verhindert verbotene direkte Pakete in %s',
    (section) => {
      writeFixture('package.json', JSON.stringify({ [section]: { tailwindcss: '4.2.2' } }));

      expect(findViolations(root)).toEqual(['package.json:1']);
    },
  );

  it('prüft auch direkte Pakete im Bun-Lockfile', () => {
    writeFixture('bun.lock', '{"workspaces":{"":{"dependencies":{"nativewind":"4"}}},}');

    expect(findViolations(root)).toEqual(['bun.lock:1']);
  });

  it.each(['tailwind.config.js', 'tailwind.config.ts', 'src/global.css', 'nativewind-env.d.ts'])(
    'verhindert das zurückkehrende Styling-Asset %s auch ohne Inhalt',
    (relativePath) => {
      writeFixture(relativePath, '');

      expect(findViolations(root)).toEqual([`${relativePath}:1`]);
    },
  );

  it('erlaubt Kommentare, Textbeispiele, Unistyles und unabhängige Tools', () => {
    writeFixture('src/view.tsx', `
      // import "nativewind"; <View className="p-4" />
      /* require("tailwindcss"); */
      import { StyleSheet } from 'react-native-unistyles';
      const example = '<View className="p-4" />';
      const comment = 'import "nativewind";';
      expect(button.props.className).toBeUndefined();
      expect(button).not.toHaveProp('className');
      const styles = StyleSheet.create(theme => ({ root: { padding: theme.space.md } }));
      export const View = () => <Txt style={styles.root}>className ist entfernt</Txt>;
    `);
    writeFixture('docs/specs/nativewind-styling/example.tsx', '<View className="p-4" />;');
    writeFixture('tools/preview/view.tsx', '<View className="p-4" />;');
    writeFixture('src/icon.module.css', '/* @tailwind utilities; */\n.icon { opacity: 1; }');
    writeFixture('babel.config.js', 'module.exports = { plugins: ["react-native-unistyles/plugin"] };');
    writeFixture('bun.lock', '{"workspaces":{"":{"dependencies":{"react-native-unistyles":"3.3.0"}}},"packages":{"tailwindcss":["tailwindcss@4.2.2"]}}');

    expect(findViolations(root)).toEqual([]);
  });
});
