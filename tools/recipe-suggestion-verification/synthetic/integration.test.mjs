import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';
import assertContract from '../promptfoo/assertions/recipe-suggestion.js';
import { assessSyntheticResponse } from './quality.mjs';
import { DATASET_VERSION, syntheticScenarios } from './scenarios.mjs';

const read = (name) => readFile(new URL(`../${name}`, import.meta.url), 'utf8');
const flow = JSON.parse(await read('chainforge/recipe-suggestion-synthetic-75.cforge'));
const cases = JSON.parse(await read('promptfoo/tests/recipe-suggestion-synthetic.json'));
const table = flow.flow.nodes.find((node) => node.type === 'table').data;
const prompt = flow.flow.nodes.find((node) => node.type === 'prompt').data;
const sandbox = { module: { exports: {} } };
vm.runInNewContext(flow.flow.nodes.find((node) => node.type === 'evaluator').data.code, sandbox);

test('synthetic Promptfoo config keeps strict outputs, GLM settings and bounded retries', async () => {
  const config = await read('promptfoo/promptfooconfig.synthetic.yaml');
  assert.deepEqual([...config.matchAll(/- id:\s*(\S+)/g)].map((match) => match[1]), ['openrouter:z-ai/glm-5.3-flash']);
  for (const pattern of [
    /apiKeyEnvar:\s*OPENROUTER_API_KEY/,
    /maxRetries:\s*0\b/, /temperature:\s*0\b/, /top_p:\s*1\b/, /seed:\s*0\b/,
    /max_tokens:\s*8192\b/, /showThinking:\s*false/,
    /reasoning:\s*\r?\n\s+effort:\s*low/, /require_parameters:\s*true/,
    /PROMPTFOO_DISABLE_ADAPTIVE_SCHEDULER:\s*true/, /REQUEST_TIMEOUT_MS:\s*120000\b/,
    /timeoutMs:\s*125000\b/, /maxEvalTimeMs:\s*900000\b/,
    /response_format:\s*file:\/\/schemas\/recipe-suggestion-response-format.json/,
    /tests:\s*file:\/\/tests\/recipe-suggestion-synthetic.json/,
  ]) assert.match(config, pattern);
  const responseFormat = JSON.parse(await read('promptfoo/schemas/recipe-suggestion-response-format.json'));
  assert.equal(responseFormat.type, 'json_schema');
  assert.equal(responseFormat.json_schema.strict, true);
  assert.deepEqual(responseFormat.json_schema.schema,
    JSON.parse(await read('promptfoo/schemas/recipe-suggestion-response.schema.json')));
});

test('both tools receive the exact same 75 inputs and prompt, GLM only, no cached answers', async () => {
  assert.equal(cases.length, 75);
  assert.equal(table.rows.length, 75);
  assert.equal(table.title, `1. 75 synthetische Inventare · ${DATASET_VERSION}`);
  assert.deepEqual(JSON.parse(await read('synthetic/inventories.json')), syntheticScenarios);
  assert.equal(JSON.parse(await read('synthetic/coverage.json')).dataset_version, DATASET_VERSION);
  const dataset = (await read('chainforge/recipe-suggestion-synthetic-dataset.jsonl')).trim().split('\n').map((line) => JSON.parse(line));
  assert.deepEqual(dataset, syntheticScenarios.map(({ scenario_id, scenario_type, compact_context }) =>
    ({ scenario_id, scenario_type, compact_context })));
  assert.equal(table.sample, false);
  assert.equal(prompt.n, 1);
  assert.deepEqual(prompt.llms.map((llm) => llm.formData.model), ['z-ai/glm-5.3-flash']);
  assert.deepEqual(flow.cache, { __s: [] });
  assert.equal((await read('promptfoo/prompts/recipe-suggestion-synthetic.prompt.txt'))
    .replace('{{compact_context}}', '{compact_context}'), prompt.prompt);
  for (const [index, scenario] of syntheticScenarios.entries()) {
    assert.equal(cases[index].metadata.dataset, DATASET_VERSION);
    assert.deepEqual(JSON.parse(cases[index].vars.compact_context), scenario.compact_context);
    assert.equal(table.rows[index].compact_context, cases[index].vars.compact_context);
    assert.equal(cases[index].vars.scenario_id, scenario.scenario_id);
    assert.deepEqual(JSON.parse(cases[index].vars.expected), scenario.expected);
    for (const assertion of cases[index].assert) {
      assert.ok(assertion.value.startsWith('file://'));
      // External test files resolve assertion paths against the config directory.
      assert.ok((await read(`promptfoo/${assertion.value.slice('file://'.length)}`)).length > 0);
    }
  }
});

test('Vis defaults to short scenario metadata instead of plotting the full inventory JSON', () => {
  const vis = flow.flow.nodes.find((node) => node.type === 'vis').data;
  assert.deepEqual(vis.selected_vars, ['__meta_scenario_type']);
  assert.deepEqual(vis.vars.map((option) => option.value), [
    'LLM (default)', 'compact_context', '__meta_scenario_id', '__meta_scenario_type',
  ]);
  assert.deepEqual(vis.eval_res_vars, ['score']);
  assert.equal(new Set(table.rows.map((row) => row.scenario_type)).size, 5);
});

function validResponse(scenario) {
  const compact = scenario.compact_context;
  const candidate = compact.candidate_recipes[0];
  return { schema_version: 1, meals: [{
    title: candidate?.title ?? 'Synthetischer Restetopf',
    source: candidate?.source ?? 'model_generated', recipe_id: candidate?.id ?? null,
    servings: compact.request.servings,
    used_items: compact.priority_foods.map((food) => ({
      inventory_item_id: food.inventory_item_id, quantity: Math.min(food.available_quantity, 1), unit: food.unit,
    })),
    additional_ingredients: [], steps: ['Vorhandene Zutaten zubereiten.'], notes: [],
  }] };
}

test('readable IDs do not allow initials, bare food names or obsolete IDs in responses', () => {
  const scenario = syntheticScenarios[8];
  const compact_context = JSON.stringify(scenario.compact_context);
  for (const alias of ['K', 'Kartoffel', 'kartoffel', 'synthetic-009-food-1']) {
    const response = validResponse(scenario);
    response.meals[0].used_items[0].inventory_item_id = alias;
    const text = JSON.stringify(response);
    assert.equal(assertContract(text, { vars: { compact_context } }).pass, false, `Promptfoo: ${alias}`);
    assert.equal(sandbox.module.exports.evaluate({ text, var: { compact_context } }), false, `ChainForge: ${alias}`);
  }
});

test('both embedded and Promptfoo validators accept compatible inventory units', () => {
  const scenario = syntheticScenarios[8];
  const compact = structuredClone(scenario.compact_context);
  compact.priority_foods[0].available_quantity = 1;
  compact.priority_foods[0].unit = 'kg';
  const response = validResponse({ compact_context: compact });
  response.meals[0].used_items[0] = {
    inventory_item_id: compact.priority_foods[0].inventory_item_id,
    quantity: 1000,
    unit: 'g',
  };
  const text = JSON.stringify(response);
  assert.equal(assertContract(text, { vars: { compact_context: JSON.stringify(compact) } }).pass, true);
  assert.equal(sandbox.module.exports.evaluate({ text, var: { compact_context: JSON.stringify(compact) } }), true);
});

for (const scenario of syntheticScenarios) {
  test(`${scenario.scenario_id}: canonical response passes; thirteen deliberate violations fail in both tools`, () => {
    const compact = scenario.compact_context;
    const check = (value, expectedPass, label) => {
      const text = typeof value === 'string' ? value : JSON.stringify(value);
      const contract = assertContract(text, { vars: { compact_context: JSON.stringify(compact) } });
      const quality = assessSyntheticResponse(text, compact, scenario.expected);
      assert.equal(contract.pass && quality.pass, expectedPass, `Promptfoo: ${label}`);
      assert.equal(sandbox.module.exports.evaluate({ text,
        var: { compact_context: JSON.stringify(compact).replace(/[{}]/g, '\\$&') },
      }), expectedPass, `ChainForge: ${label}`);
    };
    check(validResponse(scenario), true, 'known valid fixture');
    const mutations = {
      foreign_id: (value) => { value.meals[0].used_items[0].inventory_item_id = 'foreign'; },
      wrong_unit: (value) => { value.meals[0].used_items[0].unit = 'wrong-unit'; },
      overdraft: (value) => { value.meals[0].used_items[0].quantity = compact.priority_foods[0].available_quantity + 1; },
      wrong_source: (value) => { value.meals[0].source = compact.fallback_allowed ? 'catalog' : 'model_generated'; value.meals[0].recipe_id = null; },
      forbidden_ingredient: (value) => { value.meals[0].additional_ingredients = [compact.constraints.forbidden_ingredients[0] ?? 'not-allowlisted']; },
      empty_steps: (value) => { value.meals[0].steps = []; },
      extra_field: (value) => { value.unexpected = true; },
      wrong_servings: (value) => { value.meals[0].servings++; },
      skipped_urgent_food: (value) => { value.meals[0].used_items.shift(); },
      no_food_used: (value) => { value.meals[0].used_items = []; },
      empty_extra_meal: (value) => {
        const second = structuredClone(value.meals[0]);
        second.used_items = [];
        value.meals.push(second);
      },
      cumulative_overdraft: (value) => {
        const second = structuredClone(value.meals[0]);
        second.used_items[0].quantity = compact.priority_foods[0].available_quantity;
        value.meals.push(second);
      },
    };
    for (const [label, mutate] of Object.entries(mutations)) {
      const response = validResponse(scenario);
      mutate(response);
      check(response, false, label);
    }
    check(`\`\`\`json\n${JSON.stringify(validResponse(scenario))}\n\`\`\``, false, 'markdown instead of strict JSON');
  });
}
