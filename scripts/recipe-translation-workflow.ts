import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

type Catalog = JsonObject & {
  recipes: JsonObject[];
};

type SliceReport = {
  format: 'fam.recipe.translation.slice-report.v1';
  status: 'passed' | 'failed';
  inputPath: string;
  sourcePath: string;
  outputPath: string;
  sortOrderFrom: number;
  sortOrderTo: number;
  recipeCount: number;
  checkedTextFieldCount: number;
  changedTextPathCount: number;
  errors: string[];
  translationFindings: Array<{ path: string; value: string; reason: string }>;
  protectedDifferences: string[];
  numericDifferences: string[];
};

type TaskManifest = {
  format: 'fam.recipe.translation.task.v1';
  job: string;
  inputPath: string;
  sourcePath: string;
  outputPath: string;
  reportPath: string;
  sortOrderFrom: number;
  sortOrderTo: number;
  recipeCount: number;
  instructions: string;
};

const defaultWorkDir = '/tmp/fam-recipe-translation';
const visibleTextKeys = new Set([
  'title',
  'instructions',
  'storageInstructions',
  'reheatingInstructions',
  'whyCheap',
  'cheapTips',
  'healthierTips',
  'batchPrepTips',
  'optionalAddIns',
  'substitutions',
  'components',
  'items',
  'steps',
  'hashtags',
  'dishTypes',
  'images',
]);
const translatableLeafKeys = new Set([
  'title',
  'instructions',
  'storageInstructions',
  'reheatingInstructions',
  'whyCheap',
  'cheapTips',
  'healthierTips',
  'batchPrepTips',
  'optionalAddIns',
  'swap',
  'name',
  'ingredientName',
  'text',
  'hashtags',
  'dishTypes',
  'altText',
]);
const englishResidue = new Set([
  'add',
  'bake',
  'chopped',
  'cook',
  'degrees',
  'fresh',
  'frozen',
  'garnish',
  'ground',
  'heat',
  'minutes',
  'serve',
  'simmer',
  'stir',
  'tablespoon',
  'teaspoon',
  'thicken',
  'toss',
  'until',
  'with',
  'easy',
  'medium',
  'high',
  'low',
]);
const allowedLoanwords = new Set([
  'air-fryer',
  'bagel',
  'bowl',
  'bowls',
  'burger',
  'curry',
  'diner',
  'dressing',
  'hummus',
  'kimchi',
  'meal-prep',
  'miso',
  'pasta',
  'pesto',
  'pizza',
  'ramen',
  'salsa',
  'sandwich',
  'smoothie',
  'sushi',
  'taco',
  'tofu',
  'wrap',
]);

const isRecord = (value: JsonValue | undefined): value is JsonObject =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const parseJson = async (filePath: string): Promise<JsonValue> =>
  JSON.parse(await readFile(filePath, 'utf8')) as JsonValue;

const parseCatalog = async (filePath: string): Promise<Catalog> => {
  const value = await parseJson(filePath);
  if (!isRecord(value) || !Array.isArray(value.recipes)) {
    throw new Error(`Ungültiger Katalog: ${filePath}`);
  }
  if (!value.recipes.every(isRecord)) {
    throw new Error(`Ungültige Rezeptobjekte: ${filePath}`);
  }
  return value as Catalog;
};

const getOption = (options: Map<string, string>, name: string): string => {
  const value = options.get(name);
  if (!value) throw new Error(`Fehlende Option --${name}`);
  return value;
};

const parseOptions = (args: string[]): Map<string, string> => {
  const options = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith('--')) throw new Error(`Unbekannte Position: ${token}`);
    const [name, inlineValue] = token.slice(2).split('=', 2);
    const value = inlineValue ?? args[index + 1];
    if (inlineValue === undefined) index += 1;
    if (!value || value.startsWith('--')) throw new Error(`Fehlender Wert für --${name}`);
    options.set(name, value);
  }
  return options;
};

const integerOption = (options: Map<string, string>, name: string): number => {
  const value = Number.parseInt(getOption(options, name), 10);
  if (!Number.isInteger(value) || value < 0) throw new Error(`Ungültige Zahl für --${name}`);
  return value;
};

const relativeOrAbsolute = (filePath: string): string =>
  path.isAbsolute(filePath) ? filePath : path.resolve(filePath);

const sortOrderOf = (recipe: JsonObject): number => {
  const value = recipe.sortOrder;
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error('Rezept ohne ganzzahlige sortOrder');
  }
  return value;
};

const sliceRecipes = (catalog: Catalog, from: number, to: number): JsonObject[] => {
  const recipes = catalog.recipes.filter((recipe) => {
    try {
      const order = sortOrderOf(recipe);
      return order >= from && order <= to;
    } catch {
      return false;
    }
  });
  if (recipes.length !== to - from + 1) {
    throw new Error(`Bereich ${from}–${to} ist nicht vollständig (${recipes.length} Rezepte)`);
  }
  recipes.sort((left, right) => sortOrderOf(left) - sortOrderOf(right));
  return recipes;
};

const collectLeaves = (value: JsonValue, currentPath: string, output: Map<string, JsonValue>) => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectLeaves(item, `${currentPath}[${index}]`, output);
    });
    return;
  }
  if (isRecord(value)) {
    Object.entries(value).forEach(([key, item]) => {
      collectLeaves(item, currentPath ? `${currentPath}.${key}` : key, output);
    });
    return;
  }
  output.set(currentPath, value);
};

const pathIsTranslatable = (leafPath: string): boolean => {
  const segments = leafPath.split(/\.|\[|\]/).filter(Boolean);
  return segments.some((segment) => translatableLeafKeys.has(segment));
};

const numericTokens = (value: string): string[] =>
  value.match(/\d+(?:[.,]\d+)?(?:\/\d+(?:[.,]\d+)?)?/g) ?? [];

const textFields = (value: JsonValue, currentPath: string, output: Array<[string, string]>) => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      textFields(item, `${currentPath}[${index}]`, output);
    });
    return;
  }
  if (isRecord(value)) {
    Object.entries(value).forEach(([key, item]) => {
      const nextPath = currentPath ? `${currentPath}.${key}` : key;
      if (visibleTextKeys.has(key) || translatableLeafKeys.has(key))
        textFields(item, nextPath, output);
    });
    return;
  }
  if (typeof value === 'string' && value.trim()) output.push([currentPath, value]);
};

const translationFindings = (
  source: JsonObject[],
  output: JsonObject[],
): Array<{ path: string; value: string; reason: string }> => {
  const sourceByOrder = new Map(source.map((recipe) => [sortOrderOf(recipe), recipe]));
  const findings: Array<{ path: string; value: string; reason: string }> = [];
  for (const recipe of output) {
    const order = sortOrderOf(recipe);
    const sourceRecipe = sourceByOrder.get(order);
    if (!sourceRecipe) continue;
    const sourceFields: [string, string][] = [];
    const outputFields: [string, string][] = [];
    textFields(sourceRecipe, `recipes[sortOrder=${order}]`, sourceFields);
    textFields(recipe, `recipes[sortOrder=${order}]`, outputFields);
    const sourceValues = new Set(sourceFields.map(([field, value]) => `${field}:${value}`));
    for (const [field, value] of outputFields) {
      const words = value.toLowerCase().match(/[a-z]+(?:-[a-z]+)?/g) ?? [];
      const residue = words.find((word) => englishResidue.has(word) && !allowedLoanwords.has(word));
      if (residue) findings.push({ path: field, value, reason: `Englischer Rest: ${residue}` });
      if (sourceValues.has(`${field}:${value}`) && value.length > 24) {
        findings.push({
          path: field,
          value,
          reason: 'Sichtbarer Quelltext unverändert übernommen',
        });
      }
    }
  }
  return findings;
};

const validateSlice = (
  input: Catalog,
  output: Catalog,
  source: Catalog,
  inputPath: string,
  sourcePath: string,
  outputPath: string,
): SliceReport => {
  const inputOrders = input.recipes.map(sortOrderOf);
  const from = inputOrders[0] ?? -1;
  const to = inputOrders[inputOrders.length - 1] ?? -1;
  const errors: string[] = [];
  const protectedDifferences: string[] = [];
  const numericDifferences: string[] = [];
  if (input.recipes.length === 0 || output.recipes.length !== input.recipes.length) {
    errors.push(`Rezeptanzahl geändert: ${input.recipes.length} → ${output.recipes.length}`);
  }
  const inputByOrder = new Map(input.recipes.map((recipe) => [sortOrderOf(recipe), recipe]));
  const outputByOrder = new Map(output.recipes.map((recipe) => [sortOrderOf(recipe), recipe]));
  if (new Set(inputOrders).size !== inputOrders.length) errors.push('SortOrder im Input doppelt');
  if (new Set(output.recipes.map(sortOrderOf)).size !== output.recipes.length) {
    errors.push('SortOrder im Output doppelt');
  }
  const changedTextPaths = new Set<string>();
  for (const [order, inputRecipe] of inputByOrder) {
    const outputRecipe = outputByOrder.get(order);
    if (!outputRecipe) {
      errors.push(`Rezept fehlt: ${order}`);
      continue;
    }
    if (inputRecipe.externalId !== outputRecipe.externalId) {
      protectedDifferences.push(`recipes[sortOrder=${order}].externalId`);
    }
    const inputLeaves = new Map<string, JsonValue>();
    const outputLeaves = new Map<string, JsonValue>();
    collectLeaves(inputRecipe, `recipes[sortOrder=${order}]`, inputLeaves);
    collectLeaves(outputRecipe, `recipes[sortOrder=${order}]`, outputLeaves);
    const leafPaths = new Set([...inputLeaves.keys(), ...outputLeaves.keys()]);
    for (const leafPath of leafPaths) {
      if (pathIsTranslatable(leafPath)) continue;
      const before = inputLeaves.get(leafPath);
      const after = outputLeaves.get(leafPath);
      if (JSON.stringify(before) !== JSON.stringify(after)) protectedDifferences.push(leafPath);
    }
    const inputTexts: Array<[string, string]> = [];
    const outputTexts: Array<[string, string]> = [];
    textFields(inputRecipe, `recipes[sortOrder=${order}]`, inputTexts);
    textFields(outputRecipe, `recipes[sortOrder=${order}]`, outputTexts);
    const outputTextByPath = new Map(outputTexts);
    for (const [textPath, before] of inputTexts) {
      const after = outputTextByPath.get(textPath);
      if (after === undefined) {
        numericDifferences.push(`${textPath}: Feld entfernt`);
        continue;
      }
      if (before !== after) changedTextPaths.add(textPath);
      if (before.trim() && !after.trim()) numericDifferences.push(`${textPath}: Text geleert`);
      if (JSON.stringify(numericTokens(before)) !== JSON.stringify(numericTokens(after))) {
        numericDifferences.push(`${textPath}: Zahlen/Mengen geändert`);
      }
    }
  }
  const findings = translationFindings(source.recipes, output.recipes);
  return {
    format: 'fam.recipe.translation.slice-report.v1',
    status:
      errors.length || protectedDifferences.length || numericDifferences.length || findings.length
        ? 'failed'
        : 'passed',
    inputPath,
    sourcePath,
    outputPath,
    sortOrderFrom: from,
    sortOrderTo: to,
    recipeCount: output.recipes.length,
    checkedTextFieldCount: output.recipes.reduce((total, recipe) => {
      const fields: Array<[string, string]> = [];
      textFields(recipe, `recipes[sortOrder=${sortOrderOf(recipe)}]`, fields);
      return total + fields.length;
    }, 0),
    changedTextPathCount: changedTextPaths.size,
    errors,
    translationFindings: findings,
    protectedDifferences: [...new Set(protectedDifferences)],
    numericDifferences: [...new Set(numericDifferences)],
  };
};

const writeJson = async (
  filePath: string,
  value: JsonValue | SliceReport | TaskManifest,
): Promise<void> => {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

const prepare = async (options: Map<string, string>) => {
  const candidatePath = relativeOrAbsolute(getOption(options, 'candidate'));
  const sourcePath = relativeOrAbsolute(getOption(options, 'source'));
  const from = integerOption(options, 'from');
  const to = integerOption(options, 'to');
  if (to < from) throw new Error('--to muss größer oder gleich --from sein');
  const job = getOption(options, 'job');
  const workDir = relativeOrAbsolute(options.get('workdir') ?? defaultWorkDir);
  const candidate = await parseCatalog(candidatePath);
  const source = await parseCatalog(sourcePath);
  const input = { ...candidate, recipes: sliceRecipes(candidate, from, to) };
  const sourceSlice = { ...source, recipes: sliceRecipes(source, from, to) };
  const jobDir = path.join(workDir, job);
  const inputPath = path.join(jobDir, 'candidate.json');
  const sourceSlicePath = path.join(jobDir, 'source.json');
  const outputPath = path.join(jobDir, 'translated.json');
  const reportPath = path.join(jobDir, 'validation-report.json');
  const task: TaskManifest = {
    format: 'fam.recipe.translation.task.v1',
    job,
    inputPath,
    sourcePath: sourceSlicePath,
    outputPath,
    reportPath,
    sortOrderFrom: from,
    sortOrderTo: to,
    recipeCount: input.recipes.length,
    instructions:
      'Übersetze ausschließlich sichtbare Rezepttexte in translated.json ins natürliche Deutsche. Verändere keine IDs, SortOrder, Zahlen, Mengen, Einheiten, URLs, Bildpfade oder technischen Enumwerte. Nutze etablierte Gerichtsnamen nur dort unverändert, wo sie im Deutschen üblich sind. Führe danach validate aus.',
  };
  await writeJson(inputPath, input);
  await writeJson(sourceSlicePath, sourceSlice);
  await writeJson(outputPath, input);
  await writeJson(path.join(jobDir, 'task.json'), task);
  console.log(JSON.stringify(task, null, 2));
};

const validate = async (options: Map<string, string>) => {
  const inputPath = relativeOrAbsolute(getOption(options, 'input'));
  const outputPath = relativeOrAbsolute(getOption(options, 'output'));
  const sourcePath = relativeOrAbsolute(getOption(options, 'source'));
  const reportPath = relativeOrAbsolute(getOption(options, 'report'));
  const input = await parseCatalog(inputPath);
  const output = await parseCatalog(outputPath);
  const source = await parseCatalog(sourcePath);
  const report = validateSlice(input, output, source, inputPath, sourcePath, outputPath);
  await writeJson(reportPath, report);
  console.log(JSON.stringify(report, null, 2));
  if (report.status === 'failed') process.exitCode = 1;
};

const merge = async (options: Map<string, string>) => {
  const basePath = relativeOrAbsolute(getOption(options, 'base'));
  const outputPath = relativeOrAbsolute(getOption(options, 'output'));
  const slicePaths = getOption(options, 'slices').split(',').map(relativeOrAbsolute);
  const reportPaths = getOption(options, 'reports').split(',').map(relativeOrAbsolute);
  if (slicePaths.length !== reportPaths.length)
    throw new Error('Slices und Reports müssen gleich lang sein');
  const base = await parseCatalog(basePath);
  const merged = { ...base, recipes: [...base.recipes] };
  const used = new Set<number>();
  for (let index = 0; index < slicePaths.length; index += 1) {
    const report = await parseJson(reportPaths[index]);
    if (
      !isRecord(report) ||
      report.status !== 'passed' ||
      typeof report.inputPath !== 'string' ||
      typeof report.sourcePath !== 'string' ||
      report.outputPath !== slicePaths[index]
    ) {
      throw new Error(`Report nicht bestanden: ${reportPaths[index]}`);
    }
    const input = await parseCatalog(report.inputPath);
    const source = await parseCatalog(report.sourcePath);
    const slice = await parseCatalog(slicePaths[index]);
    const freshReport = validateSlice(
      input,
      slice,
      source,
      report.inputPath,
      report.sourcePath,
      slicePaths[index],
    );
    if (freshReport.status !== 'passed') {
      throw new Error(`Slice seit der Prüfung verändert: ${slicePaths[index]}`);
    }
    for (const recipe of slice.recipes) {
      const order = sortOrderOf(recipe);
      if (used.has(order)) throw new Error(`Überlappender SortOrder: ${order}`);
      used.add(order);
      const indexInBase = merged.recipes.findIndex(
        (baseRecipe) => sortOrderOf(baseRecipe) === order,
      );
      if (indexInBase < 0) throw new Error(`SortOrder fehlt im Basis katalog: ${order}`);
      merged.recipes[indexInBase] = recipe;
    }
  }
  merged.recipes.sort((left, right) => sortOrderOf(left) - sortOrderOf(right));
  await writeJson(outputPath, merged);
  console.log(
    JSON.stringify({
      outputPath,
      recipeCount: merged.recipes.length,
      mergedSlices: slicePaths.length,
    }),
  );
};

const status = async (options: Map<string, string>) => {
  const reportDir = relativeOrAbsolute(options.get('dir') ?? defaultWorkDir);
  const entries = await readdir(reportDir, { withFileTypes: true });
  const reports: Array<{
    path: string;
    status: string;
    from: number;
    to: number;
    recipeCount: number;
  }> = [];
  const pendingJobs: Array<{ path: string; from: number; to: number; recipeCount: number }> = [];
  for (const entry of entries.filter((candidate) => candidate.isDirectory())) {
    const jobDir = path.join(reportDir, entry.name);
    const taskPath = path.join(jobDir, 'task.json');
    const reportPath = path.join(jobDir, 'validation-report.json');
    try {
      await readFile(reportPath, 'utf8');
    } catch {
      try {
        const task = await parseJson(taskPath);
        if (isRecord(task)) {
          pendingJobs.push({
            path: taskPath,
            from: typeof task.sortOrderFrom === 'number' ? task.sortOrderFrom : -1,
            to: typeof task.sortOrderTo === 'number' ? task.sortOrderTo : -1,
            recipeCount: typeof task.recipeCount === 'number' ? task.recipeCount : 0,
          });
        }
      } catch {
        // Ignore unrelated directories in the workdir.
      }
    }
  }
  const reportPaths = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(reportDir, entry.name, 'validation-report.json'));
  if (entries.some((entry) => entry.isFile() && entry.name === 'validation-report.json')) {
    reportPaths.push(path.join(reportDir, 'validation-report.json'));
  }
  for (const reportPath of reportPaths) {
    let report: JsonValue;
    try {
      report = await parseJson(reportPath);
    } catch {
      continue;
    }
    if (!isRecord(report)) continue;
    reports.push({
      path: reportPath,
      status: typeof report.status === 'string' ? report.status : 'unknown',
      from: typeof report.sortOrderFrom === 'number' ? report.sortOrderFrom : -1,
      to: typeof report.sortOrderTo === 'number' ? report.sortOrderTo : -1,
      recipeCount: typeof report.recipeCount === 'number' ? report.recipeCount : 0,
    });
  }
  reports.sort((left, right) => left.from - right.from);
  const passedRecipes = reports
    .filter((report) => report.status === 'passed')
    .reduce((sum, report) => sum + report.recipeCount, 0);
  const passedReports = reports.filter((report) => report.status === 'passed').length;
  const failedReports = reports.filter((report) => report.status === 'failed').length;
  const pendingReports = reports.length - passedReports - failedReports;
  const pendingRecipes = pendingJobs.reduce((sum, job) => sum + job.recipeCount, 0);
  console.log(
    JSON.stringify(
      {
        reportDir,
        reports,
        pendingJobs,
        passedRecipes,
        passedReports,
        failedReports,
        pendingReports,
        pendingRecipes,
        openReports: pendingJobs.length + failedReports + pendingReports,
      },
      null,
      2,
    ),
  );
};

const usage = () => {
  console.log(`Usage:
  bun scripts/recipe-translation-workflow.ts prepare --candidate <de.json> --source <en.json> --from <n> --to <n> --job <id>
  bun scripts/recipe-translation-workflow.ts validate --input <candidate.json> --output <translated.json> --source <source.json> --report <report.json>
  bun scripts/recipe-translation-workflow.ts merge --base <catalog.json> --slices <a.json,b.json> --reports <a.json,b.json> --output <merged.json>
  bun scripts/recipe-translation-workflow.ts status --dir <workdir>`);
};

const main = async () => {
  const command = process.argv[2];
  if (!command) return usage();
  const options = parseOptions(process.argv.slice(3));
  if (command === 'prepare') return prepare(options);
  if (command === 'validate') return validate(options);
  if (command === 'merge') return merge(options);
  if (command === 'status') return status(options);
  throw new Error(`Unbekannter Befehl: ${command}`);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
