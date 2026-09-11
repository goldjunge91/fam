import { readFile, writeFile } from 'node:fs/promises';

const inputPath = 'docs/recipe-extraction/waivy-fam-catalog-import.json';
const outputPath = 'docs/recipe-extraction/waivy-fam-catalog-import.de.json';
const MAX_BATCH_CHARS = 3_500;
const CONCURRENCY = 20;
const MAX_RETRIES = 5;

type JsonObject = Record<string, unknown>;

type Item = JsonObject & {
  ingredientName: string;
  source_note: string | null;
};

type Component = JsonObject & {
  name: string;
  items: Item[];
};

type Step = JsonObject & { text: string };
type Substitution = JsonObject & { swap: string };
type Image = JsonObject & { altText: string | null };

type Recipe = JsonObject & {
  title: string;
  instructions: string | null;
  storageInstructions: string | null;
  reheatingInstructions: string | null;
  whyCheap: string | null;
  cheapTips: string[];
  healthierTips: string[];
  batchPrepTips: string[];
  optionalAddIns: string[];
  substitutions: Substitution[];
  components: Component[];
  steps: Step[];
  images: Image[];
};

type Batch = JsonObject & {
  schemaVersion: number;
  recipes: Recipe[];
};

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const requireString = (value: unknown, label: string): string => {
  if (typeof value !== 'string') throw new Error(`${label} muss ein String sein.`);
  return value;
};

const requireStringArray = (value: unknown, label: string): string[] => {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(`${label} muss ein String-Array sein.`);
  }
  return value;
};

const parseBatch = (value: unknown): Batch => {
  if (!isObject(value) || value.schemaVersion !== 2 || !Array.isArray(value.recipes)) {
    throw new Error('Die Eingabe ist keine schemaVersion-2-Batchdatei.');
  }
  for (const [recipeIndex, recipeValue] of value.recipes.entries()) {
    if (!isObject(recipeValue)) throw new Error(`recipes[${recipeIndex}] ist kein Objekt.`);
    const recipe = recipeValue as Recipe;
    recipe.title = requireString(recipe.title, `recipes[${recipeIndex}].title`);
    for (const field of [
      'cheapTips',
      'healthierTips',
      'batchPrepTips',
      'optionalAddIns',
    ] as const) {
      recipe[field] = requireStringArray(recipe[field], `recipes[${recipeIndex}].${field}`);
    }
    if (!Array.isArray(recipe.components) || !Array.isArray(recipe.steps)) {
      throw new Error(`recipes[${recipeIndex}] hat keine gültigen Komponenten/Schritte.`);
    }
    for (const [componentIndex, componentValue] of recipe.components.entries()) {
      if (!isObject(componentValue) || !Array.isArray(componentValue.items)) {
        throw new Error(`recipes[${recipeIndex}].components[${componentIndex}] ist ungültig.`);
      }
      for (const [itemIndex, itemValue] of componentValue.items.entries()) {
        if (!isObject(itemValue)) {
          throw new Error(
            `recipes[${recipeIndex}].components[${componentIndex}].items[${itemIndex}] ist ungültig.`,
          );
        }
      }
    }
  }
  return value as Batch;
};

const htmlEntities: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
};

const decodeHtml = (value: string) =>
  value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&(?:amp|lt|gt|quot|#39|apos);/g, (entity) => htmlEntities[entity] ?? entity)
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );

const numberPattern =
  /\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?)?(?:\s*-?\s*(?:°[CF]|[CF]|minutes?|mins?|hours?|hrs?|seconds?|secs?|tablespoons?|teaspoons?|tbsp|tsp|ounces?|pounds?|inch(?:es)?|cups?|cm|mm|km|kg|mg|ml|lb|lbs|oz|m|g|l))?/gi;

const maskNumbers = (text: string) => {
  const numbers: string[] = [];
  const masked = text.replace(numberPattern, (number) => {
    const marker = `[[[N${numbers.length}]]]`;
    numbers.push(number);
    return marker;
  });
  return { masked, numbers };
};

const restoreNumbers = (text: string, numbers: string[]) => {
  const markers = [...text.matchAll(/\[\[\[N(\d+)\]\]\]/g)];
  if (markers.length !== numbers.length) {
    throw new Error(`Zahlenplatzhalter verloren: ${markers.length}/${numbers.length}.`);
  }
  return text.replace(/\[\[\[N(\d+)\]\]\]/g, (_, index: string) => {
    const number = numbers[Number(index)];
    if (number === undefined) throw new Error(`Unbekannter Zahlenplatzhalter N${index}.`);
    return number;
  });
};

const restoreRawNumbers = (source: string, translated: string) => {
  const sourceNumbers = source.match(numberPattern) ?? [];
  const translatedNumbers = translated.match(numberPattern) ?? [];
  if (sourceNumbers.length !== translatedNumbers.length) {
    throw new Error(
      `Zahlenfolge nicht erhalten: ${translatedNumbers.length}/${sourceNumbers.length}.`,
    );
  }
  let index = 0;
  return translated.replace(numberPattern, () => sourceNumbers[index++]);
};

const translateSinglePreservingNumbers = async (source: string) => {
  const numbers = source.match(numberPattern) ?? [];
  if (numbers.length === 0) return translatePage(source);
  const markerStyles = [
    (index: number) => `[[[N${index}]]]`,
    (index: number) => `___NUM${index}___`,
    (index: number) => `NUMTOKEN${index}NUMTOKEN`,
  ];
  let lastError: unknown;
  for (const markerStyle of markerStyles) {
    let numberIndex = 0;
    const masked = source.replace(numberPattern, () => markerStyle(numberIndex++));
    const translated = await translatePage(masked);
    try {
      const markers = [
        ...translated.matchAll(/\[\[\[N(\d+)\]\]\]|___NUM(\d+)___|NUMTOKEN(\d+)NUMTOKEN/g),
      ];
      if (markers.length !== numbers.length) {
        throw new Error(`Zahlenplatzhalter verloren: ${markers.length}/${numbers.length}.`);
      }
      let index = 0;
      return translated.replace(
        /\[\[\[N\d+\]\]\]|___NUM\d+___|NUMTOKEN\d+NUMTOKEN/g,
        () => numbers[index++],
      );
    } catch (error) {
      lastError = error;
    }
  }
  try {
    return restoreRawNumbers(source, await translatePage(source));
  } catch {
    throw new Error(
      `Einzelübersetzung konnte Zahlen nicht bewahren (${source}): ${String(lastError)}`,
    );
  }
};

const translatePage = async (text: string): Promise<string> => {
  const response = await fetch(
    `https://translate.google.com/m?sl=en&tl=de&q=${encodeURIComponent(text)}`,
    { headers: { 'user-agent': 'Mozilla/5.0' } },
  );
  if (!response.ok) throw new Error(`Übersetzungsdienst HTTP ${response.status}.`);
  const html = await response.text();
  const result = html.match(/<div class="result-container">([\s\S]*?)<\/div>/)?.[1];
  if (!result) throw new Error('Keine Übersetzung im Dienstresultat gefunden.');
  return decodeHtml(result).trim();
};

type TranslationEntry = { id: number; source: string; masked: string; numbers: string[] };

const makeBatches = (entries: TranslationEntry[]) => {
  const batches: TranslationEntry[][] = [];
  let current: TranslationEntry[] = [];
  let length = 0;
  for (const entry of entries) {
    const lineLength = entry.masked.length + 18;
    if (current.length > 0 && length + lineLength > MAX_BATCH_CHARS) {
      batches.push(current);
      current = [];
      length = 0;
    }
    current.push(entry);
    length += lineLength;
  }
  if (current.length > 0) batches.push(current);
  return batches;
};

const translateBatch = async (batch: TranslationEntry[]) => {
  const payload = batch.map((entry) => `[[[SEG${entry.id}]]] ${entry.masked}`).join('\n');
  const translated = await translatePage(payload);
  const output = new Map<number, string>();
  for (let index = 0; index < batch.length; index += 1) {
    const entry = batch[index];
    const marker = `[[[SEG${entry.id}]]]`;
    const start = translated.indexOf(marker);
    try {
      if (start < 0) throw new Error(`Segment ${entry.id} fehlt.`);
      const valueStart = start + marker.length;
      const nextMarker = translated.indexOf('[[[SEG', valueStart);
      const value = translated.slice(valueStart, nextMarker < 0 ? undefined : nextMarker).trim();
      output.set(entry.id, restoreNumbers(value, entry.numbers));
    } catch {
      output.set(entry.id, await translateSinglePreservingNumbers(entry.source));
    }
  }
  return output;
};

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const translateEntries = async (sources: Set<string>) => {
  const entries = [...sources].map((source, id) => {
    const masked = maskNumbers(source);
    return { id, source, ...masked };
  });
  const translations = new Map<string, string>();
  const batches = makeBatches(entries);
  let nextBatch = 0;
  let completed = 0;
  const worker = async () => {
    while (true) {
      const batchIndex = nextBatch;
      nextBatch += 1;
      if (batchIndex >= batches.length) return;
      const batch = batches[batchIndex];
      let result: Map<number, string> | undefined;
      let lastError: unknown;
      for (let attempt = 0; attempt < MAX_RETRIES && !result; attempt += 1) {
        try {
          result = await translateBatch(batch);
        } catch (error) {
          lastError = error;
          await sleep(500 * 2 ** attempt);
        }
      }
      if (!result) {
        throw new Error(
          `Batch ${batchIndex + 1}/${batches.length} fehlgeschlagen: ${String(lastError)}`,
        );
      }
      for (const entry of batch)
        translations.set(entry.source, result.get(entry.id) ?? entry.source);
      completed += 1;
      if (completed % 50 === 0 || completed === batches.length) {
        console.log(`Übersetzt: ${completed}/${batches.length} Textbatches`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return translations;
};

const add = (sources: Set<string>, value: unknown) => {
  if (typeof value === 'string' && value.trim() && value !== 'Zutaten') sources.add(value);
};

const collectSources = (batch: Batch) => {
  const sources = new Set<string>();
  for (const recipe of batch.recipes) {
    for (const field of [
      'title',
      'instructions',
      'storageInstructions',
      'reheatingInstructions',
      'whyCheap',
    ] as const)
      add(sources, recipe[field]);
    for (const field of [
      'cheapTips',
      'healthierTips',
      'batchPrepTips',
      'optionalAddIns',
    ] as const) {
      recipe[field].forEach((value) => {
        add(sources, value);
      });
    }
    recipe.substitutions.forEach((substitution) => {
      add(sources, substitution.swap);
    });
    recipe.components.forEach((component) => {
      add(sources, component.name);
      component.items.forEach((item) => {
        add(sources, item.ingredientName);
        add(sources, item.source_note);
      });
    });
    recipe.steps.forEach((step) => {
      add(sources, step.text);
    });
    recipe.images.forEach((image) => {
      add(sources, image.altText);
    });
  }
  return sources;
};

const translateValue = (translations: Map<string, string>, value: string | null) =>
  value === null ? null : (translations.get(value) ?? value);

const applyTranslations = (batch: Batch, translations: Map<string, string>) => {
  for (const recipe of batch.recipes) {
    recipe.title = translateValue(translations, recipe.title) ?? recipe.title;
    recipe.instructions = translateValue(translations, recipe.instructions);
    recipe.storageInstructions = translateValue(translations, recipe.storageInstructions);
    recipe.reheatingInstructions = translateValue(translations, recipe.reheatingInstructions);
    recipe.whyCheap = translateValue(translations, recipe.whyCheap);
    for (const field of [
      'cheapTips',
      'healthierTips',
      'batchPrepTips',
      'optionalAddIns',
    ] as const) {
      recipe[field] = recipe[field].map((value) => translations.get(value) ?? value);
    }
    recipe.substitutions.forEach((substitution) => {
      substitution.swap = translations.get(substitution.swap) ?? substitution.swap;
    });
    recipe.components.forEach((component) => {
      component.name = translations.get(component.name) ?? component.name;
      component.items.forEach((item) => {
        item.ingredientName = translations.get(item.ingredientName) ?? item.ingredientName;
        item.source_note = translateValue(translations, item.source_note);
      });
    });
    recipe.steps.forEach((step) => {
      step.text = translations.get(step.text) ?? step.text;
    });
    recipe.images.forEach((image) => {
      image.altText = translateValue(translations, image.altText);
    });
  }
};

const main = async () => {
  const raw = await readFile(inputPath, 'utf8');
  const batch = parseBatch(JSON.parse(raw));
  const sources = collectSources(batch);
  console.log(`Eindeutige zu übersetzende Texte: ${sources.size}`);
  const translations = await translateEntries(sources);
  applyTranslations(batch, translations);
  await writeFile(outputPath, `${JSON.stringify(batch, null, 2)}\n`, 'utf8');
  console.log(`Geschrieben: ${outputPath}`);
};

await main();
