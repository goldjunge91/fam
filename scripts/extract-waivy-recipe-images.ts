import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import * as ts from 'typescript';

type JsonValue = boolean | null | number | string | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

type ImportBinding = {
  filePath: string;
  importedName: string;
};

type ModuleState = {
  filePath: string;
  sourceFile: ts.SourceFile;
  bindings: Map<string, ts.Expression>;
  imports: Map<string, ImportBinding>;
};

export type WaivyImageManifestImage = {
  recipeId: string;
  src: string;
  alt: string;
  sourceName: string;
  sourceUrl: string;
  license: string;
  attributionRequired: boolean;
  attributionText?: string;
  verifiedMatch: boolean;
};

export type WaivyImageManifest = {
  repository: 'https://github.com/justinsuo/waivy';
  source: 'src/data/recipeImages.ts';
  resolution: [
    'RECIPE_IMAGE_OVERRIDES',
    'RECIPE_IMAGES',
    'MACRO_RECIPE_PHOTOS',
    'GEN_RECIPE_PHOTOS',
  ];
  images: WaivyImageManifestImage[];
};

const moduleCache = new Map<string, ModuleState>();

function resolveModule(root: string, importer: string, specifier: string): string {
  const base = specifier.startsWith('@/')
    ? resolve(root, 'src', specifier.slice(2))
    : resolve(dirname(importer), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, resolve(base, 'index.ts')];
  const filePath = candidates.find(
    (candidate) => extname(candidate) === '.ts' || extname(candidate) === '.tsx',
  );
  if (!filePath) throw new Error(`Waivy-Modul nicht gefunden: ${specifier} aus ${importer}`);
  return filePath;
}

function loadModule(root: string, filePath: string): ModuleState {
  const cached = moduleCache.get(filePath);
  if (cached) return cached;
  const sourceFile = ts.createSourceFile(
    filePath,
    readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const bindings = new Map<string, ts.Expression>();
  const imports = new Map<string, ImportBinding>();

  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer) {
          bindings.set(declaration.name.text, declaration.initializer);
        }
      }
    }
    if (!ts.isImportDeclaration(statement)) continue;
    const importClause = statement.importClause;
    if (!importClause || importClause.isTypeOnly) continue;
    const source = statement.moduleSpecifier;
    if (!ts.isStringLiteral(source)) continue;
    const importPath = resolveModule(root, filePath, source.text);
    const namedBindings = importClause.namedBindings;
    if (namedBindings && ts.isNamedImports(namedBindings)) {
      for (const element of namedBindings.elements) {
        imports.set(element.name.text, {
          filePath: importPath,
          importedName: element.propertyName?.text ?? element.name.text,
        });
      }
    }
  }

  const module = { filePath, sourceFile, bindings, imports };
  moduleCache.set(filePath, module);
  return module;
}

function propertyName(name: ts.PropertyName): string {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  throw new Error(`Nicht-statischer Property-Name in ${name.getSourceFile().fileName}`);
}

function evaluateExpression(
  root: string,
  module: ModuleState,
  expression: ts.Expression,
): JsonValue {
  if (ts.isParenthesizedExpression(expression))
    return evaluateExpression(root, module, expression.expression);
  if (ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression)) {
    return evaluateExpression(root, module, expression.expression);
  }
  if (ts.isSatisfiesExpression(expression))
    return evaluateExpression(root, module, expression.expression);
  if (ts.isNonNullExpression(expression))
    return evaluateExpression(root, module, expression.expression);
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression))
    return expression.text;
  if (ts.isNumericLiteral(expression)) return Number(expression.text);
  if (expression.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (expression.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (expression.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isPrefixUnaryExpression(expression) && expression.operator === ts.SyntaxKind.MinusToken) {
    const value = evaluateExpression(root, module, expression.operand);
    if (typeof value !== 'number')
      throw new Error('Nur numerische negative Literale sind erlaubt.');
    return -value;
  }
  if (ts.isArrayLiteralExpression(expression)) {
    return expression.elements.map((element) => {
      if (!ts.isExpression(element)) throw new Error('Nicht-statisches Array-Element.');
      return evaluateExpression(root, module, element);
    });
  }
  if (ts.isObjectLiteralExpression(expression)) {
    const result: JsonObject = {};
    for (const property of expression.properties) {
      if (ts.isSpreadAssignment(property)) {
        const spread = evaluateExpression(root, module, property.expression);
        if (!isObject(spread)) throw new Error('Ein Objekt-Spread muss ein Objekt ergeben.');
        Object.assign(result, spread);
        continue;
      }
      if (!ts.isPropertyAssignment(property)) {
        throw new Error(`Nicht-statische Objektdefinition in ${module.filePath}`);
      }
      result[propertyName(property.name)] = evaluateExpression(root, module, property.initializer);
    }
    return result;
  }
  if (ts.isIdentifier(expression)) {
    if (expression.text === 'undefined') return null;
    const imported = module.imports.get(expression.text);
    if (imported) {
      const importedModule = loadModule(root, imported.filePath);
      return evaluateNamedExport(root, importedModule, imported.importedName);
    }
    const binding = module.bindings.get(expression.text);
    if (!binding) throw new Error(`Statischer Identifier nicht auflösbar: ${expression.text}`);
    return evaluateExpression(root, module, binding);
  }
  throw new Error(`Nicht-statischer Ausdruck in ${module.filePath}: ${expression.getText()}`);
}

function evaluateNamedExport(root: string, module: ModuleState, name: string): JsonValue {
  const binding = module.bindings.get(name);
  if (!binding) {
    const imported = module.imports.get(name);
    if (imported) {
      return evaluateNamedExport(root, loadModule(root, imported.filePath), imported.importedName);
    }
    throw new Error(`Export ${name} fehlt in ${module.filePath}`);
  }
  return evaluateExpression(root, module, binding);
}

function isObject(value: JsonValue): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: JsonValue | undefined, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} muss ein nicht-leerer String sein.`);
  }
  return value.trim();
}

function optionalString(value: JsonValue | undefined): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeUrl(value: string): string {
  const duplicateProtocol = value.match(/^https?:\/\/(https?:\/\/.+)$/);
  return duplicateProtocol?.[1] ?? value;
}

function toImage(recipeId: string, value: JsonValue): WaivyImageManifestImage {
  if (typeof value === 'string') {
    return {
      recipeId,
      src: value,
      alt: 'Recipe photo',
      sourceName: 'Web',
      sourceUrl: normalizeUrl(value),
      license: 'Editorial / fair use',
      attributionRequired: false,
      verifiedMatch: false,
    };
  }
  if (!isObject(value)) throw new Error(`Bild ${recipeId} ist kein Objekt oder URL-String.`);
  const src = requiredString(value.src, `Bild ${recipeId}.src`);
  const sourceUrl = optionalString(value.sourceUrl) ?? src;
  return {
    recipeId,
    src,
    alt: optionalString(value.alt) ?? 'Recipe photo',
    sourceName: optionalString(value.sourceName) ?? 'Web',
    sourceUrl: normalizeUrl(sourceUrl),
    license: optionalString(value.license) ?? 'Editorial / fair use',
    attributionRequired: value.attributionRequired === true,
    ...(optionalString(value.attributionText)
      ? { attributionText: optionalString(value.attributionText) }
      : {}),
    verifiedMatch: value.verifiedMatch === true,
  };
}

function record(value: JsonValue, label: string): JsonObject {
  if (!isObject(value)) throw new Error(`${label} muss ein Objekt sein.`);
  return value;
}

export function extractWaivyRecipeImages(
  root: string,
  recipeIds?: ReadonlySet<string>,
): WaivyImageManifest {
  moduleCache.clear();
  const imageModule = loadModule(root, resolve(root, 'src/data/recipeImages.ts'));
  const overrides = record(
    evaluateNamedExport(root, imageModule, 'RECIPE_IMAGE_OVERRIDES'),
    'RECIPE_IMAGE_OVERRIDES',
  );
  const curated = record(evaluateNamedExport(root, imageModule, 'RECIPE_IMAGES'), 'RECIPE_IMAGES');
  const macro = record(
    evaluateNamedExport(root, imageModule, 'MACRO_RECIPE_PHOTOS'),
    'MACRO_RECIPE_PHOTOS',
  );
  const generated = record(
    evaluateNamedExport(root, imageModule, 'GEN_RECIPE_PHOTOS'),
    'GEN_RECIPE_PHOTOS',
  );

  const images = new Map<string, WaivyImageManifestImage>();
  for (const [recipeId, value] of Object.entries(overrides))
    images.set(recipeId, toImage(recipeId, value));
  for (const [recipeId, value] of Object.entries(curated)) {
    if (!images.has(recipeId)) images.set(recipeId, toImage(recipeId, value));
  }
  for (const [recipeId, value] of Object.entries(macro)) {
    if (!images.has(recipeId)) images.set(recipeId, toImage(recipeId, value));
  }
  for (const [recipeId, value] of Object.entries(generated)) {
    if (!images.has(recipeId)) images.set(recipeId, toImage(recipeId, value));
  }

  return {
    repository: 'https://github.com/justinsuo/waivy',
    source: 'src/data/recipeImages.ts',
    resolution: [
      'RECIPE_IMAGE_OVERRIDES',
      'RECIPE_IMAGES',
      'MACRO_RECIPE_PHOTOS',
      'GEN_RECIPE_PHOTOS',
    ],
    images: [...images.values()]
      .filter((image) => !recipeIds || recipeIds.has(image.recipeId))
      .sort((left, right) => left.recipeId.localeCompare(right.recipeId)),
  };
}

function argumentValue(args: readonly string[], name: string, fallback: string): string {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const root = resolve(argumentValue(args, '--waivy-root', '/private/tmp/waivy-source'));
  const output = resolve(
    argumentValue(args, '--output', 'docs/recipe-extraction/waivy-recipe-images.json'),
  );
  const recipesPath = resolve(
    argumentValue(args, '--recipes', 'docs/recipe-extraction/waivy-catalog-recipes.json'),
  );
  const recipeDocument = JSON.parse(readFileSync(recipesPath, 'utf8')) as {
    recipes?: Array<{ id?: string }>;
  };
  const recipeIds = new Set(
    (recipeDocument.recipes ?? [])
      .map((recipe) => recipe.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  );
  const manifest = extractWaivyRecipeImages(root, recipeIds);
  writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(
    `Extrahiert: ${manifest.images.length} effektive Waivy-Bildzuordnungen. Ausgabe: ${output}`,
  );
}
