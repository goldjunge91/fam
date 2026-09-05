import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { after, test } from 'node:test';
import { buildRecipeContext, validateRecipeResponse } from '../../recipe-suggestion-prototype/recipe-suggestion.mjs';
import { syntheticScenarios } from './scenarios.mjs';

const normalize = (value) => value.trim().toLocaleLowerCase('de-DE');

// Only translate field names. Do not prefilter or rank the inventory for the code under test.
// The old prototype's `expired` flag represents unusability here, NOT a past MHD.
function prototypeInput(scenario) {
  const { request, constraints, candidate_recipes } = scenario.compact_context;
  return {
    servings: request.servings,
    allergies: [...constraints.allergies], preferences: [...constraints.preferences],
    allowedStaples: [...constraints.allowed_staples], forbiddenIngredients: [...constraints.forbidden_ingredients],
    inventory: scenario.synthetic_inventory.map((item) => ({
      id: item.inventory_item_id, name: item.name, quantity: item.quantity, unit: item.unit,
      priorityScore: item.priority_score, allergens: [...item.allergens], expired: !item.usable,
    })),
    shoppingList: scenario.shopping_list.map((item) => ({
      id: item.shopping_item_id, name: item.name, quantity: item.quantity, unit: item.unit,
    })),
    candidateRecipes: candidate_recipes.map((recipe) => ({
      id: recipe.id, source: recipe.source, title: recipe.title, ingredientNames: [...recipe.ingredient_names],
    })),
  };
}

const decision = (scenario) => ({ accepted: 'yes', declined: 'no' })[scenario.shopping_decision];
const fixtures = syntheticScenarios.map((scenario) => ({ scenario, input: prototypeInput(scenario) }));
const checks = [];

// Run every inventory even when a rule fails, then fail the test. The report is diagnostic,
// not an expected-failure baseline that would make current bugs green.
function rule(name, verify, applicable = () => true) {
  test(name, () => {
    const failures = [];
    for (const fixture of fixtures.filter(applicable)) {
      const record = { scenario_id: fixture.scenario.scenario_id, rule: name };
      try { verify(fixture); checks.push({ ...record, pass: true }); }
      catch (error) {
        const failure = { ...record, pass: false, reason: error.message };
        checks.push(failure);
        failures.push(failure);
      }
    }
    assert.equal(failures.length, 0,
      `${failures.length} inventories failed; first cases: ${failures.slice(0, 5).map((item) => item.scenario_id).join(', ')}`);
  });
}

const contextFor = ({ scenario, input }) => buildRecipeContext(input, decision(scenario));

rule('adapter_preserves_all_raw_inventory_without_MHD_inference', ({ scenario, input }) => {
  assert.equal(input.inventory.length, scenario.synthetic_inventory.length);
  for (const [index, raw] of scenario.synthetic_inventory.entries()) {
    const item = input.inventory[index];
    assert.equal(item.id, raw.inventory_item_id);
    assert.equal(item.quantity, raw.quantity);
    assert.equal(item.priorityScore, raw.priority_score);
    assert.equal(item.expired, !raw.usable);
  }
});

rule('context_is_deterministic_and_does_not_mutate_input', (fixture) => {
  const before = structuredClone(fixture.input);
  assert.deepEqual(contextFor(fixture), contextFor(fixture));
  assert.deepEqual(fixture.input, before);
});

rule('allergic_and_explicitly_unusable_stock_is_excluded', (fixture) => {
  const allergies = fixture.input.allergies.map(normalize);
  const excluded = fixture.input.inventory.filter((item) => item.expired || item.allergens.some((allergen) => allergies.includes(normalize(allergen))));
  const ids = new Set(contextFor(fixture).priority_foods.map((food) => food.inventory_item_id));
  assert.deepEqual(excluded.filter((item) => ids.has(item.id)).map((item) => item.id), []);
});

rule('forbidden_stock_is_excluded_even_with_the_highest_score', (fixture) => {
  const forbidden = new Set(fixture.input.forbiddenIngredients.map(normalize));
  assert.deepEqual(contextFor(fixture).priority_foods.filter((food) => forbidden.has(normalize(food.name))).map((food) => food.name), []);
});

rule('stock_ids_quantities_units_and_supplied_priority_order_are_preserved', (fixture) => {
  const foods = contextFor(fixture).priority_foods;
  const stock = new Map(fixture.input.inventory.map((item) => [item.id, item]));
  assert.equal(new Set(foods.map((food) => food.inventory_item_id)).size, foods.length);
  for (const [index, food] of foods.entries()) {
    const item = stock.get(food.inventory_item_id);
    assert.ok(item);
    assert.equal(food.available_quantity, item.quantity);
    assert.equal(food.unit, item.unit);
    assert.equal(food.priority_score, item.priorityScore);
    if (index) assert.ok(foods[index - 1].priority_score >= food.priority_score);
  }
});

rule('pending_shopping_asks_only_for_a_nonempty_list_and_adds_no_stock', ({ input }) => {
  const context = buildRecipeContext(input);
  assert.equal(context.shopping_question, input.shoppingList.length ? 'Willst du heute noch einkaufen?' : null);
  assert.deepEqual(context.planned_shopping_items, []);
  assert.ok(context.priority_foods.every((food) => input.inventory.some((item) => item.id === food.inventory_item_id)));
});

rule('resolved_shopping_includes_only_confirmed_items', (fixture) => {
  const context = contextFor(fixture);
  assert.equal(context.shopping_question, null);
  assert.deepEqual(context.planned_shopping_items,
    fixture.scenario.shopping_decision === 'accepted' ? fixture.scenario.shopping_list : []);
  assert.equal(context.request.servings, fixture.input.servings);
});

rule('original_recipe_candidates_and_fallback_are_reproduced', (fixture) => {
  const context = contextFor(fixture);
  assert.deepEqual(context.candidate_recipes, fixture.scenario.compact_context.candidate_recipes);
  assert.equal(context.fallback_allowed, fixture.scenario.scenario_type === 'generative_fallback');
});

function probeRecipe(id, ingredientNames) {
  return { id, source: 'catalog', title: 'Interner Auswahltest', ingredientNames };
}

rule('recipes_requiring_missing_unusable_or_allergenic_items_are_rejected', ({ scenario, input }) => {
  const allergies = input.allergies.map(normalize);
  const unsafe = input.inventory.filter((item) => item.expired || item.allergens.some((allergen) => allergies.includes(normalize(allergen))));
  const primary = scenario.compact_context.priority_foods[0].name;
  const recipes = [...unsafe.map((item, index) => probeRecipe(`unsafe-${index}`, [primary, item.name])),
    probeRecipe('missing-ingredient', [primary, 'Nicht vorhandene Testzutat'])];
  const context = buildRecipeContext({ ...input, candidateRecipes: recipes });
  assert.deepEqual(context.candidate_recipes, []);
  assert.equal(context.fallback_allowed, true);
});

rule('recipes_requiring_explicitly_forbidden_items_are_rejected', ({ scenario, input }) => {
  const recipe = probeRecipe('forbidden-ingredient', [scenario.compact_context.priority_foods[0].name, 'Chilischote']);
  const context = buildRecipeContext({ ...input, candidateRecipes: [recipe] });
  assert.deepEqual(context.candidate_recipes, []);
  assert.equal(context.fallback_allowed, true);
});

rule('confirmed_shopping_cannot_reintroduce_a_forbidden_ingredient', ({ scenario, input }) => {
  const context = buildRecipeContext({ ...input,
    shoppingList: [{ id: 'shopping-forbidden', name: 'Chilischote', quantity: 1, unit: 'pcs' }],
    candidateRecipes: [probeRecipe('forbidden-shopping', [scenario.compact_context.priority_foods[0].name, 'Chilischote'])],
  }, 'yes');
  assert.deepEqual(context.planned_shopping_items.filter((item) => normalize(item.name) === 'chilischote'), []);
  assert.deepEqual(context.candidate_recipes, []);
});

rule('candidate_selection_is_capped_at_three_and_prefers_more_priority_coverage', ({ scenario, input }) => {
  const [first, second] = scenario.compact_context.priority_foods;
  const context = buildRecipeContext({ ...input, candidateRecipes: [
    probeRecipe('first-only', [first.name]), probeRecipe('second-only', [second.name]),
    probeRecipe('both-a', [first.name, second.name]), probeRecipe('both-b', [first.name, second.name]),
  ] });
  assert.equal(context.candidate_recipes.length, 3);
  assert.deepEqual(context.candidate_recipes.slice(0, 2).map((recipe) => recipe.id), ['both-a', 'both-b']);
});

rule('adding_a_newer_lower_priority_lot_does_not_demote_the_urgent_recipe', ({ scenario, input }) => {
  const [primary, second] = scenario.compact_context.priority_foods;
  const candidateRecipes = [probeRecipe('urgent', [primary.name]), probeRecipe('other', [second.name])];
  const olderOnly = input.inventory.filter((item) => item.name !== primary.name || item.id === primary.inventory_item_id);
  const before = buildRecipeContext({ ...input, inventory: olderOnly, candidateRecipes });
  const after = buildRecipeContext({ ...input, candidateRecipes });
  assert.equal(before.candidate_recipes[0].id, 'urgent');
  assert.equal(after.candidate_recipes[0].id, 'urgent');
}, ({ scenario }) => scenario.scenario_type === 'priority_pressure');

// Structural references only, not model-generated recipes or nutrition benchmarks.
function referenceResponse(scenario) {
  const candidate = scenario.compact_context.candidate_recipes[0];
  return { schema_version: 1, meals: [{
    title: candidate?.title ?? 'Interner Fallback-Test',
    source: candidate?.source ?? 'model_generated', recipe_id: candidate?.id ?? null,
    servings: scenario.compact_context.request.servings,
    used_items: scenario.compact_context.priority_foods.map((food) => ({
      inventory_item_id: food.inventory_item_id, quantity: food.available_quantity / 2, unit: food.unit,
    })),
    additional_ingredients: [], steps: ['Verfügbare Zutaten zubereiten.'], notes: [],
  }] };
}

rule('internal_validator_accepts_valid_reference_responses', (fixture) => {
  const result = validateRecipeResponse(contextFor(fixture), referenceResponse(fixture.scenario));
  assert.equal(result.ok, true, JSON.stringify(result.errors));
});

rule('runtime_rejects_forbidden_stock_used_as_a_recipe_ingredient', (fixture) => {
  const blocked = fixture.input.inventory.find((item) => item.name === 'Chilischote');
  assert.ok(blocked);
  const response = referenceResponse(fixture.scenario);
  response.meals[0].used_items.push({ inventory_item_id: blocked.id, quantity: blocked.quantity, unit: blocked.unit });
  assert.equal(validateRecipeResponse(contextFor(fixture), response).ok, false);
});

const invalidResponses = {
  foreign_inventory_id: (response) => { response.meals[0].used_items[0].inventory_item_id = 'foreign'; },
  wrong_unit: (response) => { response.meals[0].used_items[0].unit = 'wrong-unit'; },
  zero_quantity: (response) => { response.meals[0].used_items[0].quantity = 0; },
  excessive_single_quantity: (response) => { response.meals[0].used_items[0].quantity *= 3; },
  cumulative_quantity_across_meals: (response) => {
    const second = structuredClone(response.meals[0]);
    second.used_items[0].quantity *= 2;
    response.meals.push(second);
  },
  cumulative_quantity_within_meal: (response) => {
    const duplicate = structuredClone(response.meals[0].used_items[0]);
    duplicate.quantity *= 2;
    response.meals[0].used_items.push(duplicate);
  },
  empty_extra_meal: (response) => { response.meals.push({ ...structuredClone(response.meals[0]), used_items: [] }); },
  wrong_household_servings: (response) => { response.meals[0].servings++; },
  extra_response_field: (response) => { response.unexpected = true; },
  blank_step: (response) => { response.meals[0].steps = ['   ']; },
  invalid_step_type: (response) => { response.meals[0].steps = [42]; },
  invalid_note_type: (response) => { response.meals[0].notes = [42]; },
  blank_note: (response) => { response.meals[0].notes = [' \t ']; },
  nan_quantity: (response) => { response.meals[0].used_items[0].quantity = NaN; },
  infinite_quantity: (response) => { response.meals[0].used_items[0].quantity = Infinity; },
  forbidden_additional_ingredient: (response) => { response.meals[0].additional_ingredients = ['Chilischote']; },
  unplanned_additional_ingredient: (response) => { response.meals[0].additional_ingredients = ['Nicht bestätigte Testzutat']; },
  unknown_recipe_id: (response) => { response.meals[0].recipe_id = 'unknown'; },
  four_meals: (response) => { response.meals = Array.from({ length: 4 }, () => structuredClone(response.meals[0])); },
};
for (const [name, mutate] of Object.entries(invalidResponses)) {
  rule(`runtime_rejects_${name}`, (fixture) => {
    const response = referenceResponse(fixture.scenario);
    mutate(response);
    assert.equal(validateRecipeResponse(contextFor(fixture), response).ok, false);
  });
}

rule('runtime_matches_recipe_source_to_the_selected_candidate', (fixture) => {
  const response = referenceResponse(fixture.scenario);
  response.meals[0].source = response.meals[0].source === 'catalog' ? 'template' : 'catalog';
  assert.equal(validateRecipeResponse(contextFor(fixture), response).ok, false);
}, ({ scenario }) => !scenario.compact_context.fallback_allowed);

rule('runtime_rejects_generation_when_catalog_or_template_candidates_exist', (fixture) => {
  const response = referenceResponse(fixture.scenario);
  response.meals[0].source = 'model_generated';
  response.meals[0].recipe_id = null;
  assert.equal(validateRecipeResponse(contextFor(fixture), response).ok, false);
}, ({ scenario }) => !scenario.compact_context.fallback_allowed);

after(async () => {
  const byRule = Object.fromEntries([...new Set(checks.map((check) => check.rule))].map((name) => {
    const rows = checks.filter((check) => check.rule === name);
    return [name, { checked: rows.length, passed: rows.filter((check) => check.pass).length, failed: rows.filter((check) => !check.pass).length }];
  }));
  const hashes = {};
  for (const path of ['../../recipe-suggestion-prototype/recipe-suggestion.mjs', './scenarios.mjs', './internal-logic.test.mjs']) {
    hashes[path] = createHash('sha256').update(await readFile(new URL(path, import.meta.url))).digest('hex');
  }
  const report = {
    generated_at: new Date().toISOString(), scenarios: fixtures.length, checks: checks.length,
    passed_checks: checks.filter((check) => check.pass).length,
    failed_checks: checks.filter((check) => !check.pass).length,
    scenario_ids: fixtures.map(({ scenario }) => scenario.scenario_id),
    target: 'tools/recipe-suggestion-prototype/recipe-suggestion.mjs', hashes,
    limitations: [
      'No LLM, network, app or database calls. This audit invokes the current prototype without mutating inventories.',
      'All raw stock is passed through. usable=false maps to the legacy expired flag; a past MHD does not.',
      'Priority scores are supplied fixtures; this prototype has no expiry/opening-based score calculation.',
      'Recipe availability is name-based; no recipe serving requirements or required ingredient quantities exist in its input.',
      'Response checks call the runtime validator, which composes its JSON Schema check with context-dependent semantics.',
      'Free recipe prose, nutritional adequacy and real household waste reduction are not certified by these rules.',
    ],
    by_rule: byRule, failures: checks.filter((check) => !check.pass),
  };
  const directory = new URL('../reports/', import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL('internal-logic-verification.json', directory), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Internal rules: ${report.passed_checks}/${report.checks} checks passed across ${report.scenarios} inventories. Report: reports/internal-logic-verification.json`);
});
