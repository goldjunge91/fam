import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { DATASET_VERSION, syntheticScenarios } from './scenarios.mjs';

const STATES = [
  'empty_shopping_list', 'shopping_declined', 'shopping_promised_planned_ingredients',
  'generative_fallback', 'priority_pressure',
];
const UNITS = ['g', 'ml', 'pcs', 'kg', 'pack', 'dose'];
const CONTEXT_KEYS = [
  'schema_version', 'request', 'constraints', 'priority_foods', 'planned_shopping_items',
  'candidate_recipes', 'shopping_question', 'fallback_allowed',
];
const FOOD_KEYS = ['inventory_item_id', 'name', 'available_quantity', 'unit', 'priority_score'];
const SHOPPING_KEYS = ['shopping_item_id', 'name', 'quantity', 'unit'];
const normalize = (name) => name.trim().toLocaleLowerCase('de-DE');
const familyOf = (scenario) => scenario.tags.find((tag) => tag.startsWith('family:')).slice(7);

// Independent serving floors for the principal food, in the supplied unit.
// These catch plausible-looking fixtures that could never feed the requested household.
const PRIMARY_PORTIONS = {
  apfelporridge: ['Haferflocken', 'g', 60],
  kartoffeleintopf: ['Kartoffel', 'kg', 0.3],
  linsendal: ['Rote Linsen', 'g', 80],
  kichererbsensalat: ['Kichererbsen (240-g-Dose, Abtropfgewicht)', 'dose', 0.5],
  spinatomelett: ['Ei', 'pcs', 2],
  tofunudeln: ['Naturtofu (200-g-Packung)', 'pack', 0.75],
  blumenkohlquinoa: ['Blumenkohl', 'kg', 0.25],
  haehnchenreis: ['Hähnchenbrust', 'g', 150],
  ofenlachs: ['Lachsfilet', 'g', 150],
  pilznudeln: ['Champignon', 'g', 200],
  auberginenbulgur: ['Aubergine', 'pcs', 0.5],
  suesskartoffelchili: ['Süßkartoffel', 'kg', 0.3],
  bohnenkohltopf: ['Weiße Bohnen (240-g-Dose, Abtropfgewicht)', 'dose', 0.5],
  fruehstuecksquark: ['Quark', 'g', 200],
  gemuesepolenta: ['Polenta', 'g', 75],
};

function exactKeys(value, keys, message) {
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), message);
}

// Kept in the test, independent of the generator: corrupted clones must fail
// the same contract as the exported records, without reconstructing the fixtures.
function assertFixture(scenario) {
  exactKeys(scenario, ['scenario_id', 'scenario_type', 'description', 'tags', 'synthetic_inventory', 'shopping_list', 'shopping_decision', 'compact_context', 'expected']);
  assert.match(scenario.scenario_id, /^synthetic-\d{3}$/);
  assert.ok(STATES.includes(scenario.scenario_type));
  assert.ok(scenario.description.length > 30);
  assert.ok(scenario.tags.every((tag) => typeof tag === 'string' && tag.length > 0));
  assert.equal(scenario.tags.filter((tag) => tag.startsWith('family:')).length, 1);
  assert.ok(scenario.tags.includes('reference_date:2026-09-03'));
  const context = scenario.compact_context;
  exactKeys(context, CONTEXT_KEYS, 'canonical context keys');
  exactKeys(context.request, ['type', 'servings']);
  assert.equal(context.schema_version, 1);
  assert.equal(context.request.type, 'recipe_suggestion');
  assert.ok([1, 2, 3, 4, 6].includes(context.request.servings));
  assert.ok(scenario.tags.includes(`household:${context.request.servings}`));
  exactKeys(context.constraints, ['allergies', 'preferences', 'allowed_staples', 'forbidden_ingredients']);
  for (const values of Object.values(context.constraints)) {
    assert.ok(Array.isArray(values));
    assert.ok(values.every((value) => typeof value === 'string' && value.trim().length > 0));
    assert.equal(new Set(values.map(normalize)).size, values.length);
  }
  const { allergies, preferences, allowed_staples, forbidden_ingredients } = context.constraints;
  const forbidden = new Set(forbidden_ingredients.map(normalize));
  assert.ok(!forbidden.has('alcohol') && !forbidden.has('shellfish'), 'denylist must name ingredients');
  assert.ok(forbidden.has('rotwein') && forbidden.has('chilischote'));
  const raw = new Map();
  for (const item of scenario.synthetic_inventory) {
    exactKeys(item, ['inventory_item_id', 'name', 'quantity', 'unit', 'expiry_days', 'opened', 'allergens', 'usable', 'category', 'priority_score']);
    assert.ok(!raw.has(item.inventory_item_id), 'unique raw inventory IDs');
    assert.ok(item.inventory_item_id.startsWith(`${scenario.scenario_id}-`));
    assert.ok(typeof item.name === 'string' && item.name.length > 0);
    assert.ok(Number.isFinite(item.quantity) && item.quantity > 0, 'positive raw quantity');
    assert.ok(UNITS.includes(item.unit), 'known inventory unit');
    assert.ok(Number.isInteger(item.expiry_days));
    assert.equal(typeof item.opened, 'boolean');
    assert.equal(typeof item.usable, 'boolean');
    assert.ok(typeof item.category === 'string' && item.category.length > 0);
    assert.ok(Array.isArray(item.allergens) && item.allergens.every((value) => typeof value === 'string'));
    assert.ok(Number.isFinite(item.priority_score));
    if (['pack', 'dose'].includes(item.unit) && !Number.isInteger(item.quantity)) {
      assert.equal(item.opened, true, 'fractional package is opened');
    }
    if (item.name === 'Ei') assert.ok(Number.isInteger(item.quantity), 'whole eggs');
    raw.set(item.inventory_item_id, item);
  }
  assert.ok(context.priority_foods.length >= 2 && context.priority_foods.length <= 6);
  const selectedIds = new Set();
  for (const [index, item] of context.priority_foods.entries()) {
    exactKeys(item, FOOD_KEYS);
    assert.ok(!selectedIds.has(item.inventory_item_id), 'unique selected IDs');
    selectedIds.add(item.inventory_item_id);
    const original = raw.get(item.inventory_item_id);
    assert.ok(original, 'selected inventory exists');
    assert.equal(original.usable, true, 'selected inventory is usable');
    assert.ok(!forbidden.has(normalize(item.name)), 'forbidden food excluded');
    assert.ok(!original.allergens.some((allergen) => allergies.includes(allergen)), 'allergen excluded');
    assert.deepEqual(item, {
      inventory_item_id: original.inventory_item_id, name: original.name,
      available_quantity: original.quantity, unit: original.unit, priority_score: original.priority_score,
    }, 'lossless raw-to-compact mapping');
    const prior = context.priority_foods[index - 1];
    if (prior) {
      assert.ok(prior.priority_score >= item.priority_score, 'descending priority');
      if (prior.priority_score === item.priority_score) assert.ok(prior.inventory_item_id < item.inventory_item_id, 'stable score tie');
    }
    const upperBound = { g: 600, ml: 500, pcs: 4, kg: 0.6, pack: 2, dose: 2 }[item.unit];
    assert.ok(item.available_quantity / context.request.servings <= upperBound, 'plausible per-serving unit amount');
    if (preferences.includes('vegan')) assert.ok(!['Fleisch', 'Fisch', 'Eier', 'Milchprodukte'].includes(original.category));
    if (preferences.includes('vegetarisch')) assert.ok(!['Fleisch', 'Fisch'].includes(original.category));
    if (preferences.includes('glutenfrei')) assert.ok(!original.allergens.includes('Gluten'));
    if (preferences.includes('ohne Milchprodukte')) assert.ok(!original.allergens.includes('Milch'));
  }

  const [primaryName, primaryUnit, perServing] = PRIMARY_PORTIONS[familyOf(scenario)];
  assert.equal(context.priority_foods[0].name, primaryName, 'highest priority is the family food');
  const primaryLots = context.priority_foods.filter((item) => item.name === primaryName);
  assert.ok(primaryLots.every((item) => item.unit === primaryUnit), 'primary unit is preserved');
  const totalPrimary = primaryLots.reduce((sum, item) => sum + item.available_quantity, 0);
  assert.ok(totalPrimary + 1e-9 >= perServing * context.request.servings, 'enough primary food for servings');
  if (scenario.tags.includes('quantity_boundary')) {
    assert.ok(Math.abs(totalPrimary - perServing * context.request.servings) < 1e-9, 'exact portion boundary');
  }
  if (scenario.scenario_type === 'priority_pressure') {
    assert.equal(primaryLots.length, 2, 'two separately identified lots');
    const older = raw.get(primaryLots[0].inventory_item_id);
    const newer = raw.get(primaryLots[1].inventory_item_id);
    assert.notEqual(older.quantity, newer.quantity, 'lots have different quantities');
    assert.ok(older.expiry_days < newer.expiry_days, 'older lot first');
    assert.equal(older.opened, true);
    assert.equal(context.priority_foods.length, 6);
  }

  const shoppingIds = new Set();
  for (const item of scenario.shopping_list) {
    exactKeys(item, SHOPPING_KEYS);
    assert.ok(item.shopping_item_id.startsWith(`${scenario.scenario_id}-shop-`));
    assert.ok(!shoppingIds.has(item.shopping_item_id));
    shoppingIds.add(item.shopping_item_id);
    assert.ok(item.quantity > 0 && Number.isFinite(item.quantity), 'positive shopping quantity');
    assert.ok(UNITS.includes(item.unit));
    assert.ok(!forbidden.has(normalize(item.name)), 'shopping excludes forbidden ingredient');
  }
  assert.equal(context.shopping_question, null);
  if (scenario.scenario_type === 'shopping_promised_planned_ingredients') {
    assert.equal(scenario.shopping_decision, 'accepted');
    assert.ok(context.planned_shopping_items.length >= 1 && context.planned_shopping_items.length <= 2);
    assert.deepEqual(context.planned_shopping_items, scenario.shopping_list, 'planned items are known accepted records');
  } else {
    assert.deepEqual(context.planned_shopping_items, [], 'unconfirmed shopping excluded');
    if (scenario.scenario_type === 'shopping_declined') {
      assert.equal(scenario.shopping_decision, 'declined');
      assert.ok(scenario.shopping_list.length >= 1);
    } else {
      assert.equal(scenario.shopping_decision, 'not_needed');
      assert.deepEqual(scenario.shopping_list, []);
    }
  }
  for (const item of context.planned_shopping_items) exactKeys(item, SHOPPING_KEYS);

  const excludedNames = new Set(scenario.synthetic_inventory
    .filter((item) => !selectedIds.has(item.inventory_item_id))
    .map((item) => normalize(item.name)));
  const allowedNames = new Set([
    ...context.priority_foods.map((item) => normalize(item.name)),
    ...allowed_staples.map(normalize),
    ...context.planned_shopping_items.map((item) => normalize(item.name)),
  ]);
  for (const name of allowedNames) {
    assert.ok(!forbidden.has(name), 'forbidden name not allowed through another channel');
    assert.ok(!excludedNames.has(name), 'distractor not allowed through another channel');
  }
  assert.ok(context.candidate_recipes.length <= 3);
  assert.equal(context.fallback_allowed, context.candidate_recipes.length === 0);
  assert.equal(context.fallback_allowed, scenario.scenario_type === 'generative_fallback');
  const recipeIds = new Set();
  for (const recipe of context.candidate_recipes) {
    exactKeys(recipe, ['id', 'source', 'title', 'ingredient_names']);
    assert.match(recipe.id, /^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
    assert.ok(!recipeIds.has(recipe.id));
    recipeIds.add(recipe.id);
    assert.ok(['catalog', 'template'].includes(recipe.source), 'trusted recipe source');
    assert.ok(typeof recipe.title === 'string' && recipe.title.length > 0);
    assert.ok(recipe.ingredient_names.length >= 2);
    const ingredients = new Set(recipe.ingredient_names.map(normalize));
    assert.equal(ingredients.size, recipe.ingredient_names.length);
    for (const name of ingredients) assert.ok(allowedNames.has(name), `candidate ingredient available: ${name}`);
    assert.ok(ingredients.has(normalize(primaryName)), 'candidate uses highest priority food');
    assert.ok(context.priority_foods.filter((item) => ingredients.has(normalize(item.name))).length >= 2, 'candidate uses two foods');
    for (const planned of context.planned_shopping_items) assert.ok(ingredients.has(normalize(planned.name)), 'accepted ingredient changes the recipe');
  }
  exactKeys(scenario.expected, ['servings', 'required_priority_ids', 'min_used_items']);
  assert.equal(scenario.expected.servings, context.request.servings);
  assert.deepEqual(scenario.expected.required_priority_ids, [context.priority_foods[0].inventory_item_id]);
  assert.equal(scenario.expected.min_used_items, 2, 'shared prompt requires two foods when available');
}

for (const scenario of syntheticScenarios) {
  test(`${scenario.scenario_id}: ${familyOf(scenario)} / ${scenario.scenario_type} is a feasible canonical fixture`, () => {
    assertFixture(scenario);
  });
}

test('first food family covers the five backend shopping/candidate states', () => {
  assert.equal(DATASET_VERSION, 'synthetic-v1');
  assert.equal(syntheticScenarios.length, 75);
  const cases = syntheticScenarios.slice(0, 5);
  assert.deepEqual(cases.map((item) => item.shopping_decision), ['not_needed', 'declined', 'accepted', 'not_needed', 'not_needed']);
  assert.deepEqual(cases.map((item) => item.compact_context.fallback_allowed), [false, false, false, true, false]);
  assert.deepEqual(cases.map((item) => item.compact_context.priority_foods.length), [3, 3, 3, 3, 6]);
  assert.deepEqual(cases.map((item) => item.compact_context.planned_shopping_items.length), [0, 0, 1, 0, 0]);
});

test('first scenario has an independently specified one-person porridge context', () => {
  assert.deepEqual(syntheticScenarios[0].compact_context, {
    schema_version: 1,
    request: { type: 'recipe_suggestion', servings: 1 },
    constraints: {
      allergies: [], preferences: ['vegan', 'Frühstück', 'mild'],
      allowed_staples: ['Wasser', 'Zimt'], forbidden_ingredients: ['Rotwein', 'Chilischote'],
    },
    priority_foods: [
      { inventory_item_id: 'synthetic-001-food-1', name: 'Haferflocken', available_quantity: 60, unit: 'g', priority_score: 0.98 },
      { inventory_item_id: 'synthetic-001-food-2', name: 'Apfel', available_quantity: 1, unit: 'pcs', priority_score: 0.86 },
      { inventory_item_id: 'synthetic-001-food-3', name: 'Haferdrink', available_quantity: 150, unit: 'ml', priority_score: 0.65 },
    ],
    planned_shopping_items: [],
    candidate_recipes: [{
      id: 'synthetic-001-recipe', source: 'template', title: 'Apfelporridge',
      ingredient_names: ['Haferflocken', 'Apfel', 'Haferdrink', 'Wasser', 'Zimt'],
    }],
    shopping_question: null, fallback_allowed: false,
  });
});

test('75 distinct inventories balance fifteen food families, five states and five household sizes', () => {
  assert.equal(new Set(syntheticScenarios.map((scenario) => scenario.scenario_id)).size, 75);
  // Strip generated IDs: renamed copies do not count as distinct contexts.
  const contexts = syntheticScenarios.map((scenario) => JSON.stringify(scenario.compact_context)
    .replace(/synthetic-\d{3}/g, 'scenario'));
  assert.equal(new Set(contexts).size, 75);
  assert.equal(new Set(syntheticScenarios.map(familyOf)).size, 15);
  for (const family of Object.keys(PRIMARY_PORTIONS)) {
    assert.deepEqual(syntheticScenarios.filter((scenario) => familyOf(scenario) === family)
      .map((scenario) => scenario.scenario_type), STATES);
  }
  for (const size of [1, 2, 3, 4, 6]) {
    assert.equal(syntheticScenarios.filter((scenario) => scenario.expected.servings === size).length, 15);
  }
  const contextsOnly = syntheticScenarios.map((scenario) => scenario.compact_context);
  assert.deepEqual([...new Set(contextsOnly.flatMap((context) => context.priority_foods.map((food) => food.unit)))].sort(), [...UNITS].sort());
  assert.equal(contextsOnly.filter((context) => context.constraints.allergies.length === 0).length, 5);
  assert.equal(contextsOnly.filter((context) => context.constraints.allergies.length > 1).length, 5);
  for (const [tag, count] of Object.entries({ duplicate_lots: 15, score_tie: 15, quantity_boundary: 30, past_mhd_explicitly_usable: 1 })) {
    assert.equal(syntheticScenarios.filter((scenario) => scenario.tags.includes(tag)).length, count, tag);
  }
});

test('fresh processes produce the identical dataset regardless of timezone', () => {
  const script = "import { syntheticScenarios } from './scenarios.mjs'; console.log(JSON.stringify(syntheticScenarios));";
  for (const timezone of ['UTC', 'Pacific/Honolulu']) {
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: fileURLToPath(new URL('./', import.meta.url)), encoding: 'utf8', timeout: 10_000,
      env: { ...process.env, TZ: timezone }, windowsHide: true,
    });
    assert.deepEqual(JSON.parse(output), syntheticScenarios);
  }
});

test('fixture checks reject corrupt quantities, safety flags, units and shopping states', () => {
  const mutations = [
    (scenario) => { scenario.synthetic_inventory[0].quantity = 0; },
    (scenario) => { scenario.synthetic_inventory[0].usable = false; },
    (scenario) => { scenario.compact_context.constraints.forbidden_ingredients.push('Haferflocken'); },
    (scenario) => { scenario.compact_context.constraints.allergies.push('Gluten'); },
    (scenario) => { scenario.compact_context.priority_foods[0].unit = 'ml'; },
    (scenario) => { scenario.compact_context.priority_foods[0].available_quantity *= 2; },
    (scenario) => { scenario.compact_context.candidate_recipes[0].ingredient_names.push('Butter'); },
    (scenario) => { scenario.compact_context.fallback_allowed = true; },
    (scenario) => { scenario.shopping_decision = 'accepted'; },
  ];
  for (const mutate of mutations) {
    const corrupted = structuredClone(syntheticScenarios[0]);
    mutate(corrupted);
    assert.throws(() => assertFixture(corrupted), assert.AssertionError);
  }
});
