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
