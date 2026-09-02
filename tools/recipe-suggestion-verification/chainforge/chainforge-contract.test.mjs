import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const directory = dirname(new URL(import.meta.url).pathname).replace(/^\/(?:[A-Za-z]:)/, (match) => match.slice(1));
const datasetPath = resolve(directory, 'recipe-suggestion-dataset.jsonl');
const promptPath = resolve(directory, 'recipe-suggestion-prompt.txt');
const evaluatorPath = resolve(directory, 'recipe-suggestion-evaluator.js');
const providerPath = resolve(directory, 'openrouter_provider.py');

const canonicalResponseKeys = [
  'schema_version',
  'meals',
];
const canonicalMealKeys = [
  'title',
  'source',
  'recipe_id',
  'servings',
  'used_items',
  'additional_ingredients',
  'steps',
  'notes',
];
const canonicalContextKeys = [
  'schema_version',
  'request',
  'constraints',
  'priority_foods',
  'planned_shopping_items',
  'candidate_recipes',
  'shopping_question',
  'fallback_allowed',
];

async function readArtifact(path) {
  return readFile(path, 'utf8');
}

async function readDataset() {
  const content = await readArtifact(datasetPath);
  const lines = content.split(/\r?\n/).filter(Boolean);
  return lines.map((line, index) => {
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error('Dataset line ' + (index + 1) + ' is not valid JSON: ' + error.message);
    }
  });
}

async function loadEvaluator() {
  const source = await readArtifact(evaluatorPath);
  const module = { exports: {} };
  const context = {
    module,
    exports: module.exports,
    Number,
    Array,
    JSON,
    Set,
    String,
    Boolean,
  };
  vm.runInNewContext(source + '\nthis.__evaluate = evaluate;', context, {
    filename: evaluatorPath,
  });
  return context.__evaluate;
}

function responseFor(compactContext, meal) {
  return {
    text: JSON.stringify({ schema_version: 1, meals: [meal] }),
    var: { compact_context: JSON.stringify(compactContext) },
  };
}

function responseOutput(response) {
  return JSON.parse(response.text);
}

function withOutput(response, output) {
  return { ...response, text: JSON.stringify(output) };
}

function assertCompleteCompactContext(context) {
  assert.deepEqual(Object.keys(context).sort(), [...canonicalContextKeys].sort());
  assert.equal(context.schema_version, 1);
  assert.deepEqual(Object.keys(context.request).sort(), ['servings', 'type']);
  assert.equal(context.request.type, 'recipe_suggestion');
  assert.equal(Number.isInteger(context.request.servings), true);
  assert.ok(context.request.servings > 0);
  assert.equal(
    context.shopping_question === null || typeof context.shopping_question === 'string',
    true,
  );
  if (context.shopping_question !== null) assert.ok(context.shopping_question.trim());
  assert.equal(typeof context.fallback_allowed, 'boolean');

  assert.deepEqual(Object.keys(context.constraints).sort(), [
    'allergies',
    'allowed_staples',
    'forbidden_ingredients',
    'preferences',
  ]);
  for (const field of ['allergies', 'preferences', 'allowed_staples', 'forbidden_ingredients']) {
    assert.ok(Array.isArray(context.constraints[field]));
    assert.ok(context.constraints[field].every((value) => typeof value === 'string'));
  }

  assert.ok(Array.isArray(context.priority_foods));
  for (const food of context.priority_foods) {
    assert.deepEqual(Object.keys(food).sort(), [
      'available_quantity',
      'inventory_item_id',
      'name',
      'priority_score',
      'unit',
    ]);
    assert.equal(typeof food.inventory_item_id, 'string');
    assert.equal(typeof food.name, 'string');
    assert.equal(typeof food.unit, 'string');
    assert.equal(typeof food.available_quantity, 'number');
    assert.equal(typeof food.priority_score, 'number');
  }

  assert.ok(Array.isArray(context.planned_shopping_items));
  for (const item of context.planned_shopping_items) {
    assert.deepEqual(Object.keys(item).sort(), ['name', 'quantity', 'shopping_item_id', 'unit']);
    assert.equal(typeof item.shopping_item_id, 'string');
    assert.equal(typeof item.name, 'string');
    assert.equal(typeof item.quantity, 'number');
    assert.equal(typeof item.unit, 'string');
  }

  assert.ok(Array.isArray(context.candidate_recipes));
  for (const recipe of context.candidate_recipes) {
    assert.deepEqual(Object.keys(recipe).sort(), ['id', 'ingredient_names', 'source', 'title']);
    assert.equal(typeof recipe.id, 'string');
    assert.equal(typeof recipe.source, 'string');
    assert.equal(typeof recipe.title, 'string');
    assert.ok(Array.isArray(recipe.ingredient_names));
    assert.ok(recipe.ingredient_names.every((name) => typeof name === 'string'));
  }
}

test('Dataset enthält genau vier Szenarien mit vollständigem kanonischem compact_context', async () => {
  const rows = await readDataset();
  const scenarioTypes = rows.map((row) => row.scenario_type);

  assert.deepEqual(scenarioTypes, [
    'empty_shopping_list',
    'shopping_declined',
    'shopping_promised_planned_ingredients',
    'generative_fallback',
  ]);

  for (const row of rows) {
    assert.equal(typeof row.scenario_id, 'string');
    assert.deepEqual(Object.keys(row).sort(), ['compact_context', 'scenario_id', 'scenario_type']);
    assertCompleteCompactContext(row.compact_context);
  }

  const empty = rows.find((row) => row.scenario_type === 'empty_shopping_list');
  assert.deepEqual(empty.compact_context.planned_shopping_items, []);
  assert.equal(empty.compact_context.fallback_allowed, false);

  const declined = rows.find((row) => row.scenario_type === 'shopping_declined');
  assert.deepEqual(declined.compact_context.planned_shopping_items, []);
  assert.equal(declined.compact_context.fallback_allowed, false);

  const promised = rows.find((row) => row.scenario_type === 'shopping_promised_planned_ingredients');
  assert.deepEqual(promised.compact_context.planned_shopping_items, [
    { shopping_item_id: 'shop_spinach', name: 'Spinat', quantity: 1, unit: 'pack' },
  ]);

  const fallback = rows.find((row) => row.scenario_type === 'generative_fallback');
  assert.equal(fallback.compact_context.fallback_allowed, true);
  assert.deepEqual(fallback.compact_context.candidate_recipes, []);
  assert.equal(rows.filter((row) => row.compact_context.fallback_allowed).length, 1);
});

test('Prompt beschreibt ausschließlich die kanonischen Kontext- und Response-Felder', async () => {
  const prompt = await readArtifact(promptPath);

  for (const field of canonicalContextKeys.concat(canonicalMealKeys, canonicalResponseKeys)) {
    assert.ok(prompt.includes(field), 'Prompt enthält ' + field);
  }
  for (const field of [
    'allergies',
    'preferences',
    'allowed_staples',
    'forbidden_ingredients',
    'inventory_item_id',
    'name',
    'available_quantity',
    'unit',
    'priority_score',
    'shopping_item_id',
    'quantity',
    'id',
    'title',
    'ingredient_names',
  ]) {
    assert.ok(prompt.includes(field), 'Prompt enthält ' + field);
  }
  assert.ok(prompt.includes('catalog'));
  assert.ok(prompt.includes('template'));
  assert.ok(prompt.includes('model_generated'));
  assert.doesNotMatch(prompt, /\bmeal_id\b/);
  assert.doesNotMatch(prompt, /\bingredients\b/);
});

test('Evaluator erzwingt den exakten kanonischen Response-Vertrag', async () => {
  const source = await readArtifact(evaluatorPath);
  const evaluate = await loadEvaluator();
  const rows = await readDataset();

  assert.equal(typeof evaluate, 'function');
  assert.match(source, /function evaluate\(response\)/);
  assert.match(source, /JSON\.parse/);
  assert.match(source, /response\.var\.compact_context/);
  for (const field of [
    'schema_version',
    'used_items',
    'additional_ingredients',
    'steps',
    'notes',
    'model_generated',
    'candidate_recipes',
    'priority_foods',
    'planned_shopping_items',
    'allowed_staples',
    'forbidden_ingredients',
    'available_quantity',
  ]) {
    assert.match(source, new RegExp(field));
  }
  assert.doesNotMatch(source, /fetch\s*\(|axios|OpenAI|Anthropic|llm.?grader/i);

  const promised = rows.find((row) => row.scenario_type === 'shopping_promised_planned_ingredients').compact_context;
  const validResponse = responseFor(promised, {
    title: 'Pasta mit Tomate',
    source: 'catalog',
      recipe_id: 'recipe-tomato-pasta',
      servings: 2,
    used_items: [
      { inventory_item_id: 'inv_pasta', quantity: 200, unit: 'g' },
      { inventory_item_id: 'inv_tomato', quantity: 2, unit: 'pcs' },
    ],
    additional_ingredients: ['olive oil', 'Spinat'],
    steps: ['Pasta kochen.', 'Tomaten und Öl vermengen.'],
    notes: ['Geplante Einkaufsartikel können verwendet werden.'],
  });

  assert.equal(evaluate(validResponse), 1);
  assert.equal(
    evaluate(
      withOutput(validResponse, {
        schema_version: 1,
        meals: Array.from({ length: 4 }, () => responseOutput(validResponse).meals[0]),
      }),
    ),
    0,
  );
  assert.equal(
    evaluate(withOutput(validResponse, { ...responseOutput(validResponse), extra: true })),
    0,
  );
  assert.equal(
    evaluate({ ...validResponse, text: validResponse.text.replace('recipe_id', 'meal_id') }),
    0,
  );
  assert.equal(
    evaluate({ ...validResponse, text: validResponse.text.replace('used_items', 'ingredients') }),
    0,
  );
  assert.equal(
    evaluate({ ...validResponse, text: validResponse.text.replace('inv_pasta', 'inv_unknown') }),
    0,
  );
  assert.equal(
    evaluate({ ...validResponse, text: validResponse.text.replace('"quantity":200', '"quantity":0') }),
    0,
  );
  assert.equal(
    evaluate({ ...validResponse, text: validResponse.text.replace('"unit":"g"', '"unit":""') }),
    0,
  );
  assert.equal(
    evaluate({ ...validResponse, text: validResponse.text.replace('"unit":"g"', '"unit":"kg"') }),
    0,
  );
  assert.equal(
    evaluate({ ...validResponse, text: validResponse.text.replace('"source":"catalog"', '"source":"template"') }),
    0,
  );
  assert.equal(
    evaluate({
      ...validResponse,
      text: validResponse.text.replace(
        '"additional_ingredients":["olive oil","Spinat"]',
        '"additional_ingredients":["peanut"]',
      ),
    }),
    0,
  );
  assert.equal(
    evaluate({ ...validResponse, text: validResponse.text.replace('"steps":["Pasta kochen.","Tomaten und Öl vermengen."]', '"steps":[]') }),
    0,
  );
  assert.equal(
    evaluate({ ...validResponse, text: validResponse.text.replace('"notes":["Geplante Einkaufsartikel können verwendet werden."]', '"notes":[1]') }),
    0,
  );
  assert.equal(evaluate({ ...validResponse, text: '{not-json}' }), 0);
});

test('OpenRouter-Provider bindet Key, Modell und strict Structured Output ohne Secret ein', async () => {
  const source = await readArtifact(providerPath);

  assert.match(source, /OPENROUTER_API_KEY/);
  assert.match(source, /OPENROUTER_MODEL/);
  assert.match(source, /OPENROUTER_BASE_URL/);
  assert.match(source, /response_format/);
  assert.match(source, /json_schema/);
  assert.match(source, /strict['"]?\s*:\s*True/);
  assert.match(source, /require_parameters['"]?\s*:\s*True/);
  assert.match(source, /reasoning['"]?\s*:\s*\{['"]effort['"]:\s*DEFAULT_REASONING_EFFORT\}/);
  assert.match(source, /ibm-granite\/granite-4\.2-8b/);
  assert.match(source, /recipe-suggestion-response\.schema\.json/);
  assert.match(source, /urllib\.request/);
  assert.doesNotMatch(source, /sk-or-v1|api[_-]?key\s*=\s*['"][^'"]+['"]/i);
});

test('Evaluator lehnt used_items mit Mengenüberschreitung ab', async () => {
  const evaluate = await loadEvaluator();
  const rows = await readDataset();
  const promised = rows.find((row) => row.scenario_type === 'shopping_promised_planned_ingredients').compact_context;
  const response = responseFor(promised, {
    title: 'Pasta mit Tomate',
    source: 'catalog',
    recipe_id: 'recipe-tomato-pasta',
    servings: 2,
    used_items: [{ inventory_item_id: 'inv_pasta', quantity: 501, unit: 'g' }],
    additional_ingredients: [],
    steps: ['Pasta kochen.'],
    notes: [],
  });

  assert.equal(evaluate(response), 0);
});

test('model_generated ist nur mit Fallback und null recipe_id gültig', async () => {
  const evaluate = await loadEvaluator();
  const rows = await readDataset();
  const fallback = rows.find((row) => row.scenario_type === 'generative_fallback').compact_context;
  const validFallback = responseFor(fallback, {
    title: 'Bohnentopf',
    source: 'model_generated',
    recipe_id: null,
    servings: 2,
    used_items: [{ inventory_item_id: 'inv_bean', quantity: 1, unit: 'pcs' }],
    additional_ingredients: ['onion'],
    steps: ['Bohnen und Zwiebel garen.'],
    notes: [],
  });

  assert.equal(evaluate(validFallback), 1);
  assert.equal(
    evaluate({ ...validFallback, text: validFallback.text.replace('"recipe_id":null', '"recipe_id":"invented"') }),
    0,
  );

  const declined = rows.find((row) => row.scenario_type === 'shopping_declined').compact_context;
  assert.equal(
    evaluate({
      ...validFallback,
      var: { compact_context: JSON.stringify(declined) },
    }),
    0,
  );
});
