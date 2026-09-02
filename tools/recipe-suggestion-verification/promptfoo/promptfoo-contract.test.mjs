import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import assertRecipeSuggestion from './assertions/recipe-suggestion.js';

const root = path.dirname(fileURLToPath(import.meta.url));

const readArtifact = (relativePath) =>
  readFile(path.join(root, relativePath), 'utf8');

const promptfooConfig = await readArtifact('promptfooconfig.yaml');
const openrouterConfig = await readArtifact('promptfooconfig.openrouter.yaml');
const prompt = await readArtifact('prompts/recipe-suggestion.prompt.txt');
const responseFormatText = await readArtifact(
  'schemas/recipe-suggestion-response-format.json',
);
const responseFormat = JSON.parse(responseFormatText);
const canonicalSchema = JSON.parse(
  await readArtifact('schemas/recipe-suggestion-response.schema.json'),
);
const assertionSource = await readArtifact('assertions/recipe-suggestion.js');
const scenarios = await readArtifact('tests/recipe-suggestion.yaml');

function readCompactContexts(yaml) {
  return [...yaml.matchAll(/compact_context:\s*>-\s*\r?\n\s*(\{.*\})/g)].map(
    ([, json]) => JSON.parse(json),
  );
}

function contextForAssertion(compactContext) {
  return { vars: { compact_context: JSON.stringify(compactContext) } };
}

function validResponseFor(compactContext) {
  const candidate = compactContext.candidate_recipes[0];
  const priorityFood = compactContext.priority_foods[0];
  return {
    schema_version: 1,
    meals: [
      {
        title: candidate?.title ?? 'Haferflocken mit Apfel',
        source: candidate?.source ?? 'model_generated',
        recipe_id: candidate?.id ?? null,
        servings: compactContext.request.servings,
        used_items: priorityFood
          ? [
              {
                inventory_item_id: priorityFood.inventory_item_id,
                quantity: Math.min(1, priorityFood.available_quantity),
                unit: priorityFood.unit,
              },
            ]
          : [],
        additional_ingredients: compactContext.constraints.allowed_staples.slice(0, 1),
        steps: ['Zutaten vorbereiten und garen.'],
        notes: [],
      },
    ],
  };
}

const compactContexts = readCompactContexts(scenarios);

test('response_format is a strict OpenRouter envelope over the canonical schema', () => {
  assert.deepEqual(responseFormat, {
    type: 'json_schema',
    json_schema: {
      name: 'recipe_suggestion_response',
      strict: true,
      schema: canonicalSchema,
    },
  });
  assert.equal(canonicalSchema.title, 'Recipe suggestion response');
  assert.deepEqual(canonicalSchema.required, ['schema_version', 'meals']);
  assert.equal(canonicalSchema.properties.meals.maxItems, 3);
  assert.deepEqual(
    canonicalSchema.properties.meals.items.required,
    [
      'title',
      'source',
      'recipe_id',
      'servings',
      'used_items',
      'additional_ingredients',
      'steps',
      'notes',
    ],
  );
  assert.match(
    promptfooConfig,
    /defaultTest:\s*\r?\n\s+options:\s*\r?\n\s+response_format:\s*file:\/\/schemas\/recipe-suggestion-response-format\.json/,
  );
  assert.match(promptfooConfig, /id:\s*openrouter:ibm-granite\/granite-4\.2-8b/);
  assert.match(promptfooConfig, /apiKeyEnvar:\s*OPENROUTER_API_KEY/);
  assert.match(promptfooConfig, /showThinking:\s*false/);
  assert.match(promptfooConfig, /passthrough:\s*\r?\n\s+reasoning:/);
  assert.match(promptfooConfig, /require_parameters:\s*true/);
  assert.match(promptfooConfig, /temperature:\s*0/);
  assert.doesNotMatch(promptfooConfig, /openai:chat:/);
  assert.match(openrouterConfig, /id:\s*openrouter:minimax\/minimax-m3:free/);
  assert.match(openrouterConfig, /id:\s*openrouter:ibm-granite\/granite-4\.2-8b/);
  assert.match(
    openrouterConfig,
    /defaultTest:\s*\r?\n\s+options:\s*\r?\n\s+response_format:\s*file:\/\/schemas\/recipe-suggestion-response-format\.json/,
  );
});

test('prompt is restricted to the canonical compact context and response fields', () => {
  assert.match(prompt, /\{\{compact_context\}\}/);
  for (const field of [
    'constraints',
    'priority_foods',
    'planned_shopping_items',
    'candidate_recipes',
    'fallback_allowed',
  ]) {
    assert.match(prompt, new RegExp(`\\b${field}\\b`));
  }
  assert.doesNotMatch(prompt, /\bmeal_id\b/);
  assert.doesNotMatch(prompt, /(?:^|["'`\s])ingredients\s*:/m);
  assert.doesNotMatch(prompt, /\bmodel_generated\s+(?:boolean|true|false)\b/);
  assert.doesNotMatch(
    prompt,
    /\b(?:available_inventory|planned_ingredients|fallback_ingredient_pool)\b/,
  );
});

test('all scenarios use canonical contexts and direct is-json references', () => {
  assert.equal(compactContexts.length, 4);
  const canonicalContextKeys = [
    'candidate_recipes',
    'constraints',
    'fallback_allowed',
    'planned_shopping_items',
    'priority_foods',
    'request',
    'schema_version',
    'shopping_question',
  ];

  for (const compactContext of compactContexts) {
    assert.deepEqual(Object.keys(compactContext).sort(), canonicalContextKeys);
    assert.equal(compactContext.schema_version, 1);
    assert.ok(Array.isArray(compactContext.priority_foods));
    assert.ok(Array.isArray(compactContext.planned_shopping_items));
    assert.ok(Array.isArray(compactContext.candidate_recipes));
    assert.ok(compactContext.constraints);
    assert.equal(typeof compactContext.fallback_allowed, 'boolean');
    assert.doesNotMatch(
      JSON.stringify(compactContext),
      /"(?:meal_id|ingredients|model_generated|available_inventory|planned_ingredients|fallback_ingredient_pool)"\s*:/,
    );
  }

  assert.equal((scenarios.match(/type:\s*is-json/g) ?? []).length, 4);
  assert.equal(
    (scenarios.match(
      /value:\s*file:\/\/promptfoo\/schemas\/recipe-suggestion-response\.schema\.json/g,
    ) ?? []).length,
    4,
  );
  assert.equal((scenarios.match(/type:\s*javascript/g) ?? []).length, 4);
  assert.doesNotMatch(
    scenarios,
    /value:\s*file:\/\/.*recipe-suggestion-response-format\.json/,
  );
  assert.match(scenarios, /value:\s*file:\/\/assertions\/recipe-suggestion\.js/);
  assert.match(assertionSource, /module\.exports\s*=|export\s+default/);
});

test('canonical responses pass the semantic assertion in every scenario', () => {
  for (const compactContext of compactContexts) {
    const result = assertRecipeSuggestion(
      JSON.stringify(validResponseFor(compactContext)),
      contextForAssertion(compactContext),
    );
    assert.equal(result.pass, true, result.reason);
  }
});

test('semantic assertion rejects foreign inventory IDs and mismatched measures', () => {
  const compactContext = compactContexts[0];
  const response = validResponseFor(compactContext);
  response.meals[0].used_items[0].inventory_item_id = 'foreign-id';
  assert.equal(
    assertRecipeSuggestion(JSON.stringify(response), contextForAssertion(compactContext)).pass,
    false,
  );

  const quantityResponse = validResponseFor(compactContext);
  quantityResponse.meals[0].used_items[0].quantity = 999;
  assert.equal(
    assertRecipeSuggestion(
      JSON.stringify(quantityResponse),
      contextForAssertion(compactContext),
    ).pass,
    false,
  );

  const unitResponse = validResponseFor(compactContext);
  unitResponse.meals[0].used_items[0].unit = 'kg';
  assert.equal(
    assertRecipeSuggestion(JSON.stringify(unitResponse), contextForAssertion(compactContext)).pass,
    false,
  );
});

test('semantic assertion ties recipe source and ID to candidate_recipes', () => {
  const compactContext = compactContexts[0];
  const response = validResponseFor(compactContext);
  response.meals[0].source = 'template';
  assert.equal(
    assertRecipeSuggestion(JSON.stringify(response), contextForAssertion(compactContext)).pass,
    false,
  );

  const idResponse = validResponseFor(compactContext);
  idResponse.meals[0].recipe_id = 'foreign-recipe';
  assert.equal(
    assertRecipeSuggestion(JSON.stringify(idResponse), contextForAssertion(compactContext)).pass,
    false,
  );
});

test('semantic assertion gates model_generated and additional ingredients', () => {
  const catalogContext = compactContexts[0];
  const generatedResponse = validResponseFor(catalogContext);
  generatedResponse.meals[0].source = 'model_generated';
  generatedResponse.meals[0].recipe_id = null;
  assert.equal(
    assertRecipeSuggestion(
      JSON.stringify(generatedResponse),
      contextForAssertion(catalogContext),
    ).pass,
    false,
  );

  const fallbackContext = compactContexts[3];
  const nonNullFallbackResponse = validResponseFor(fallbackContext);
  nonNullFallbackResponse.meals[0].recipe_id = 'foreign-recipe';
  assert.equal(
    assertRecipeSuggestion(
      JSON.stringify(nonNullFallbackResponse),
      contextForAssertion(fallbackContext),
    ).pass,
    false,
  );

  const plannedContext = compactContexts[2];
  const plannedResponse = validResponseFor(plannedContext);
  plannedResponse.meals[0].additional_ingredients = ['Spinat'];
  assert.equal(
    assertRecipeSuggestion(
      JSON.stringify(plannedResponse),
      contextForAssertion(plannedContext),
    ).pass,
    true,
  );

  const forbiddenResponse = validResponseFor(catalogContext);
  forbiddenResponse.meals[0].additional_ingredients = ['Erdnüsse'];
  assert.equal(
    assertRecipeSuggestion(
      JSON.stringify(forbiddenResponse),
      contextForAssertion(catalogContext),
    ).pass,
    false,
  );

  const unknownResponse = validResponseFor(catalogContext);
  unknownResponse.meals[0].additional_ingredients = ['invented'];
  assert.equal(
    assertRecipeSuggestion(
      JSON.stringify(unknownResponse),
      contextForAssertion(catalogContext),
    ).pass,
    false,
  );
});

test('semantic assertion requires bounded meals plus steps and notes', () => {
  const compactContext = compactContexts[0];
  const emptyStepsResponse = validResponseFor(compactContext);
  emptyStepsResponse.meals[0].steps = [];
  assert.equal(
    assertRecipeSuggestion(
      JSON.stringify(emptyStepsResponse),
      contextForAssertion(compactContext),
    ).pass,
    false,
  );

  const invalidNotesResponse = validResponseFor(compactContext);
  invalidNotesResponse.meals[0].notes = [42];
  assert.equal(
    assertRecipeSuggestion(
      JSON.stringify(invalidNotesResponse),
      contextForAssertion(compactContext),
    ).pass,
    false,
  );

  const tooManyMealsResponse = validResponseFor(compactContext);
  tooManyMealsResponse.meals = Array.from({ length: 4 }, () => ({
    ...validResponseFor(compactContext).meals[0],
  }));
  assert.equal(
    assertRecipeSuggestion(
      JSON.stringify(tooManyMealsResponse),
      contextForAssertion(compactContext),
    ).pass,
    false,
  );
});
