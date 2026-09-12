import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LANGUAGE_SOURCE = path.join(REPO_ROOT, 'src', 'i18n', 'index.ts');
const FEATURE_DIRECTORY = path.join(REPO_ROOT, 'src', 'i18n', 'features');

type LocaleCatalogDiscovery = {
  languages: string[];
  features: string[];
};

export type LocaleCatalog = {
  language: string;
  feature: string;
  path: string;
  values: Map<string, string>;
  issues: string[];
  missing: boolean;
};

export type LocaleCatalogSnapshot = {
  languages: string[];
  features: string[];
  catalogs: LocaleCatalog[];
};

export type TranslationReference = {
  key: string;
  line: number;
  path: string;
};

export type DynamicTranslationReference = {
  expression: string;
  keys: string[] | null;
  line: number;
  path: string;
};

function readSupportedLanguages(): string[] {
  const source = ts.createSourceFile(
    LANGUAGE_SOURCE,
    readFileSync(LANGUAGE_SOURCE, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );

  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;

    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText(source) !== 'SUPPORTED_LANGUAGES') continue;

      const initializer = declaration.initializer;
      const arrayInitializer =
        initializer && ts.isAsExpression(initializer) ? initializer.expression : initializer;
      if (!arrayInitializer || !ts.isArrayLiteralExpression(arrayInitializer)) break;

      const languages = arrayInitializer.elements.map((element) => {
        if (!ts.isStringLiteralLike(element)) {
          throw new Error('SUPPORTED_LANGUAGES muss nur String-Literale enthalten.');
        }
        return element.text;
      });

      return languages;
    }
  }

  throw new Error('SUPPORTED_LANGUAGES wurde in src/i18n/index.ts nicht gefunden.');
}

function readFeatureNames(languages: string[]): string[] {
  const languageSuffixes = new Set(languages.map((language) => `.${language}.json`));

  return readdirSync(FEATURE_DIRECTORY, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .flatMap((filename) => {
      const suffix = [...languageSuffixes].find((candidate) => filename.endsWith(candidate));
      return suffix ? [filename.slice(0, -suffix.length)] : [];
    })
    .filter((feature, index, features) => features.indexOf(feature) === index)
    .sort();
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readCatalogValue(
  value: unknown,
  prefix: string,
  sourcePath: string,
  values: Map<string, string>,
  issues: string[],
): void {
  if (typeof value === 'string') {
    values.set(prefix, value);
    if (value.trim().length === 0) {
      issues.push(`Empty translation value "${prefix}" in ${sourcePath}`);
    }
    return;
  }

  if (isJsonObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      const childPrefix = prefix ? `${prefix}.${key}` : key;
      readCatalogValue(child, childPrefix, sourcePath, values, issues);
    }
    return;
  }

  issues.push(`Invalid translation value "${prefix || '<root>'}" in ${sourcePath}`);
}

export function parseLocaleCatalog(
  language: string,
  feature: string,
  sourcePath: string,
  content: string,
): LocaleCatalog {
  const values = new Map<string, string>();
  const issues: string[] = [];

  try {
    const parsed: unknown = JSON.parse(content);
    readCatalogValue(parsed, '', sourcePath, values, issues);
  } catch {
    issues.push(`Invalid JSON catalog ${sourcePath}`);
  }

  return { language, feature, path: sourcePath, values, issues, missing: false };
}

function loadCatalog(feature: string, language: string): LocaleCatalog {
  const sourcePath = path.join(FEATURE_DIRECTORY, `${feature}.${language}.json`);

  if (!existsSync(sourcePath)) {
    return {
      language,
      feature,
      path: sourcePath,
      values: new Map(),
      issues: [],
      missing: true,
    };
  }

  return parseLocaleCatalog(language, feature, sourcePath, readFileSync(sourcePath, 'utf8'));
}

function readPlaceholders(value: string): string[] {
  const placeholders = new Set<string>();
  const pattern = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

  for (const match of value.matchAll(pattern)) {
    const placeholder = match[1];
    if (placeholder) placeholders.add(placeholder);
  }

  return [...placeholders].sort();
}

export function discoverLocaleCatalogs(): LocaleCatalogDiscovery {
  const languages = readSupportedLanguages();

  return {
    languages,
    features: readFeatureNames(languages),
  };
}

export function loadLocaleCatalogs(): LocaleCatalogSnapshot {
  const discovery = discoverLocaleCatalogs();

  return {
    ...discovery,
    catalogs: discovery.features.flatMap((feature) =>
      discovery.languages.map((language) => loadCatalog(feature, language)),
    ),
  };
}

export function validateLocaleCatalogs(snapshot: LocaleCatalogSnapshot): string[] {
  const errors = snapshot.catalogs.flatMap((catalog) => catalog.issues);

  for (const feature of snapshot.features) {
    const featureCatalogs = snapshot.catalogs.filter((catalog) => catalog.feature === feature);
    const keys = new Set(featureCatalogs.flatMap((catalog) => [...catalog.values.keys()]));

    for (const language of snapshot.languages) {
      const catalog = featureCatalogs.find((candidate) => candidate.language === language);

      if (!catalog || catalog.missing) {
        errors.push(`Missing locale catalog for ${feature} (locale: ${language})`);
        continue;
      }

      for (const key of [...keys].sort()) {
        if (!catalog.values.has(key)) {
          errors.push(`Missing translation key "${key}" in ${catalog.path} (locale: ${language})`);
        }
      }
    }

    for (const key of [...keys].sort()) {
      const referenceCatalog = featureCatalogs.find(
        (catalog) => !catalog.missing && catalog.values.has(key),
      );
      if (!referenceCatalog) continue;

      const expected = readPlaceholders(referenceCatalog.values.get(key) ?? '');
      for (const catalog of featureCatalogs) {
        const value = catalog.values.get(key);
        if (value === undefined) continue;

        const actual = readPlaceholders(value);
        if (actual.join('|') !== expected.join('|')) {
          errors.push(
            `Placeholder mismatch for "${key}" in ${catalog.path} (locale: ${catalog.language}): ` +
              `expected ${expected.join(', ') || 'none'}, found ${actual.join(', ') || 'none'}`,
          );
        }
      }
    }
  }

  return errors.sort();
}

function isTranslationCall(expression: ts.Expression): boolean {
  if (ts.isIdentifier(expression)) return expression.text === 't';

  return (
    ts.isPropertyAccessExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === 'i18n' &&
    expression.name.text === 't'
  );
}

export function extractLiteralTranslationReferences(
  content: string,
  sourcePath: string,
): TranslationReference[] {
  const source = ts.createSourceFile(
    sourcePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    sourcePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const references: TranslationReference[] = [];

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && isTranslationCall(node.expression)) {
      const [keyArgument] = node.arguments;
      if (keyArgument && ts.isStringLiteralLike(keyArgument)) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
        references.push({ key: keyArgument.text, line: line + 1, path: sourcePath });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(source);
  return references;
}

function createSourceProgram(): ts.Program {
  const config = ts.getParsedCommandLineOfConfigFile(
    path.join(REPO_ROOT, 'tsconfig.json'),
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
        throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
      },
    },
  );

  if (!config) throw new Error('tsconfig.json konnte nicht gelesen werden.');
  return ts.createProgram(config.fileNames, config.options);
}

function readStringLiteralValues(type: ts.Type): string[] | null {
  if (type.isStringLiteral()) {
    return [type.value];
  }

  if (!type.isUnion()) return null;

  const values = type.types.flatMap((member) => readStringLiteralValues(member) ?? []);
  const uniqueValues = [...new Set(values)];
  return uniqueValues.length === type.types.length && uniqueValues.length > 0 ? uniqueValues : null;
}

function combineStringValues(left: string[], right: string[]): string[] {
  return [
    ...new Set(left.flatMap((leftValue) => right.map((rightValue) => leftValue + rightValue))),
  ];
}

function expandStringExpression(
  expression: ts.Expression,
  checker: ts.TypeChecker,
): string[] | null {
  if (ts.isStringLiteralLike(expression)) return [expression.text];

  if (ts.isTemplateExpression(expression)) {
    let values = [expression.head.text];

    for (const span of expression.templateSpans) {
      const expressionValues = readStringLiteralValues(checker.getTypeAtLocation(span.expression));
      if (!expressionValues) return null;

      values = combineStringValues(values, expressionValues).map(
        (value) => `${value}${span.literal.text}`,
      );
    }

    return values;
  }

  if (
    ts.isBinaryExpression(expression) &&
    expression.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = expandStringExpression(expression.left, checker);
    const right = expandStringExpression(expression.right, checker);
    return left && right ? combineStringValues(left, right) : null;
  }

  return readStringLiteralValues(checker.getTypeAtLocation(expression));
}

function extractDynamicTranslationReferences(
  source: ts.SourceFile,
  checker: ts.TypeChecker,
  sourcePath: string,
): DynamicTranslationReference[] {
  const references: DynamicTranslationReference[] = [];

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && isTranslationCall(node.expression)) {
      const [keyArgument] = node.arguments;
      if (keyArgument && !ts.isStringLiteralLike(keyArgument)) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
        references.push({
          expression: keyArgument.getText(source),
          keys: expandStringExpression(keyArgument, checker),
          line: line + 1,
          path: sourcePath,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(source);
  return references;
}

function findProductionSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return findProductionSourceFiles(entryPath);
      if (!entry.isFile() || !/\.tsx?$/.test(entry.name)) return [];
      if (/\.test\.tsx?$/.test(entry.name)) return [];
      return [entryPath];
    })
    .sort();
}

export function findProductionTranslationReferences(): TranslationReference[] {
  return findProductionSourceFiles(path.join(REPO_ROOT, 'src')).flatMap((sourcePath) =>
    extractLiteralTranslationReferences(
      readFileSync(sourcePath, 'utf8'),
      path.relative(REPO_ROOT, sourcePath),
    ),
  );
}

export function findProductionDynamicTranslationReferences(): DynamicTranslationReference[] {
  const program = createSourceProgram();
  const checker = program.getTypeChecker();

  return findProductionSourceFiles(path.join(REPO_ROOT, 'src')).flatMap((sourcePath) => {
    const source = program.getSourceFile(sourcePath);
    return source
      ? extractDynamicTranslationReferences(source, checker, path.relative(REPO_ROOT, sourcePath))
      : [];
  });
}

function featureNamespace(feature: string): string {
  return feature.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function hasCatalogKey(key: string, catalog: LocaleCatalog): boolean {
  return (
    catalog.values.has(key) ||
    catalog.values.has(`${key}_one`) ||
    catalog.values.has(`${key}_other`)
  );
}

export function validateTranslationReferences(
  references: TranslationReference[],
  snapshot: LocaleCatalogSnapshot,
): string[] {
  const errors: string[] = [];

  for (const reference of references) {
    const separator = reference.key.indexOf('.');
    const namespace = separator === -1 ? reference.key : reference.key.slice(0, separator);
    const catalogKey = separator === -1 ? '' : reference.key.slice(separator + 1);
    const feature = snapshot.features.find(
      (candidate) => featureNamespace(candidate) === namespace,
    );

    for (const language of snapshot.languages) {
      const catalog = feature
        ? snapshot.catalogs.find(
            (candidate) => candidate.feature === feature && candidate.language === language,
          )
        : undefined;

      if (!catalog || catalog.missing || !catalogKey || !hasCatalogKey(catalogKey, catalog)) {
        errors.push(
          `Missing translation key "${reference.key}" at ${reference.path}:${reference.line} ` +
            `(locale: ${language})`,
        );
      }
    }
  }

  return errors.sort();
}

export function validateDynamicTranslationReferences(
  references: DynamicTranslationReference[],
  snapshot: LocaleCatalogSnapshot,
): string[] {
  return references
    .flatMap((reference) => {
      if (!reference.keys || reference.keys.length === 0) {
        return [
          `Untestable dynamic translation key at ${reference.path}:${reference.line}: ` +
            reference.expression,
        ];
      }

      return validateTranslationReferences(
        reference.keys.map((key) => ({ key, line: reference.line, path: reference.path })),
        snapshot,
      );
    })
    .sort();
}
