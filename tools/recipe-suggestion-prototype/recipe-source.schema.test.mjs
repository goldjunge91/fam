import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const prototypeDirectory = dirname(fileURLToPath(import.meta.url));
const readJson = (fileName) =>
  JSON.parse(readFileSync(join(prototypeDirectory, 'schemas', fileName), 'utf8'));

const recipeSourceSchema = readJson('recipe-source.schema.json');
const contextSchema = readJson('recipe-suggestion-context.schema.json');

test('Rezeptquellen-Vertrag ist versioniert und geschlossen', () => {
  assert.equal(recipeSourceSchema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(recipeSourceSchema.type, 'object');
  assert.equal(recipeSourceSchema.additionalProperties, false);
  assert.deepEqual([...recipeSourceSchema.required].sort(), [
    'id',
    'ingredient_names',
    'source',
    'title',
  ]);

  assert.equal(recipeSourceSchema.properties.id.type, 'string');
  assert.equal(recipeSourceSchema.properties.id.minLength, 1);
  assert.equal(typeof recipeSourceSchema.properties.id.pattern, 'string');
  assert.equal(recipeSourceSchema.properties.title.minLength, 1);
});

test('Rezeptquellen erlauben nur Katalog oder deterministisches Template', () => {
  const sourceProperty = recipeSourceSchema.properties.source;

  assert.deepEqual(sourceProperty.enum, ['catalog', 'template']);
  assert.equal(sourceProperty.enum.includes('model_generated'), false);
  assert.equal(recipeSourceSchema.required.includes('steps'), false);

  const ingredientsProperty = recipeSourceSchema.properties.ingredient_names;
  assert.equal(ingredientsProperty.type, 'array');
  assert.equal(ingredientsProperty.minItems, 1);
  assert.equal(ingredientsProperty.uniqueItems, true);
  assert.equal(ingredientsProperty.items.type, 'string');
  assert.equal(ingredientsProperty.items.minLength, 1);

  const stepsProperty = recipeSourceSchema.properties.steps;
  assert.equal(stepsProperty.type, 'array');
  assert.equal(stepsProperty.items.type, 'string');
  assert.equal(stepsProperty.items.minLength, 1);
});

test('Kontext-Kandidaten verwenden denselben nicht-generativen Quellentyp', () => {
  const candidateProperties = contextSchema.properties.candidate_recipes.items.properties;
  const candidateSource = candidateProperties.source;

  assert.deepEqual(candidateSource.enum, ['catalog', 'template']);
  assert.equal(candidateSource.enum.includes('model_generated'), false);

  assert.equal(candidateProperties.id.type, recipeSourceSchema.properties.id.type);
  assert.equal(candidateProperties.id.minLength, recipeSourceSchema.properties.id.minLength);
  assert.equal(candidateProperties.id.pattern, recipeSourceSchema.properties.id.pattern);

  const candidateIngredients = candidateProperties.ingredient_names;
  assert.equal(candidateIngredients.minItems, 1);
  assert.equal(candidateIngredients.uniqueItems, true);
});

test('Rezeptquellen dürfen Schritte tragen, Kontext-Kandidaten reduzieren sie für Token-Sparsamkeit', () => {
  const recipeSourceSteps = recipeSourceSchema.properties.steps;
  const candidateRecipe = contextSchema.properties.candidate_recipes.items;

  assert.equal(recipeSourceSchema.required.includes('steps'), false);
  assert.equal(recipeSourceSteps.type, 'array');
  assert.equal(candidateRecipe.required.includes('steps'), false);
  assert.equal(Object.hasOwn(candidateRecipe.properties, 'steps'), false);
  assert.equal(candidateRecipe.additionalProperties, false);
});
