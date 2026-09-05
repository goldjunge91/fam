import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

const read = (relativePath) =>
  readFile(new URL(relativePath, import.meta.url), 'utf8');
const bundle = JSON.parse(await read('./recipe-suggestion-v2.cforge'));
const comparison = JSON.parse(await read('./recipe-suggestion-model-comparison.cforge'));
const { nodes, edges } = bundle.flow;
const models = [
  'z-ai/glm-5.2:free',
  'upstage/solar-pro4',
  'z-ai/glm-5.3-flash',
];
const baseModel = '__custom/OpenRouter Rezeptvorschlag v2/';
const prompt = nodes.find((node) => node.type === 'prompt');
const table = nodes.find((node) => node.type === 'table');
const evaluator = nodes.find((node) => node.type === 'evaluator');

test('import flow embeds all four original scenarios without sampling or cached answers', async () => {
  const rows = (await read('./recipe-suggestion-dataset.jsonl'))
    .trim().split(/\r?\n/).map((line) => JSON.parse(line));
  assert.equal(rows.length, 4);
  assert.deepEqual(table.data.rows.map(({ __uid, ...row }) => ({
    ...row,
    compact_context: JSON.parse(row.compact_context),
  })), rows);
  assert.equal(table.data.sample, false);
  assert.equal(new Set(table.data.rows.map((row) => row.__uid)).size, 4);
  assert.deepEqual(table.data.columns.map((column) => column.header), [
    'scenario_id', 'scenario_type', 'compact_context',
  ]);
  assert.deepEqual(bundle.cache, { __s: [] });
  assert.deepEqual(prompt.data.fields, []);
});

test('normal flow selects GLM 5.3 only and comparison is explicit', async () => {
  const provider = await read('./openrouter_provider_v2.py');
  const declaredModels = JSON.parse(provider.match(/OPENROUTER_MODELS = (\[[\s\S]*?\])/)[1]
    .replace(/,\s*\]/, ']'));
  assert.deepEqual(declaredModels, models);
  assert.deepEqual(prompt.data.llms.map((llm) => llm.formData.model), ['z-ai/glm-5.3-flash']);
  assert.equal(new Set(prompt.data.llms.map((llm) => llm.key)).size, 1);
  for (const llm of prompt.data.llms) {
    assert.equal(llm.base_model, baseModel);
    assert.equal(llm.model, baseModel + llm.formData.model);
    assert.equal(llm.name, llm.formData.model);
    assert.equal(llm.temp, 0);
    assert.deepEqual(llm.settings, {});
  }
  assert.equal(prompt.data.n, 1);
  assert.equal(table.data.rows.length * prompt.data.llms.length * prompt.data.n, 4);
  const comparisonPrompt = comparison.flow.nodes.find((node) => node.type === 'prompt').data;
  assert.deepEqual(comparisonPrompt.llms.map((llm) => llm.formData.model), models);
  assert.equal(comparisonPrompt.n, 1);
  assert.equal(comparisonPrompt.prompt, prompt.data.prompt);
  assert.deepEqual(comparison.flow.edges, edges);
  assert.deepEqual(comparison.flow.nodes.find((node) => node.type === 'table').data, table.data);
  assert.equal(comparison.flow.nodes.find((node) => node.type === 'evaluator').data.code, evaluator.data.code);
  assert.deepEqual(comparison.cache, { __s: [] });
});

test('prompt has exactly one input and embedded evaluator matches its source', async () => {
  assert.equal(prompt.data.prompt, await read('./recipe-suggestion-prompt.txt'));
  assert.deepEqual(
    [...prompt.data.prompt.matchAll(/(?<!\\)\{([^{}]*)\}/g)].map((match) => match[1]),
    ['compact_context'],
  );
  assert.doesNotMatch(prompt.data.prompt.replace('{compact_context}', ''), /(?<!\\)[{}]/);
  assert.equal(evaluator.data.language, 'javascript');
  assert.equal(evaluator.data.code, await read('./recipe-suggestion-evaluator.js'));
});

test('prompt is written as product behavior, not evaluation instructions', () => {
  assert.doesNotMatch(prompt.data.prompt, /synthetic|promptfoo|chainforge|für diesen test|for this test/i);
  assert.doesNotMatch(prompt.data.prompt, /scenario_id|scenario_type|expected|test case/i);
  assert.doesNotMatch(prompt.data.prompt, /\b(?:college|student|budget|USD|estimatedCost|imagePromptHint)\b/i);
});

test('flow connects correct ChainForge handles through evaluator to both result views', () => {
  assert.equal(nodes.length, 5);
  assert.deepEqual(edges.map(({ source, sourceHandle, target, targetHandle }) => [
    source, sourceHandle, target, targetHandle,
  ]), [
    [table.id, 'compact_context', prompt.id, 'compact_context'],
    [prompt.id, 'prompt', evaluator.id, 'responseBatch'],
    [evaluator.id, 'output', nodes.find((node) => node.type === 'inspect').id, 'input'],
    [evaluator.id, 'output', nodes.find((node) => node.type === 'vis').id, 'input'],
  ]);
  assert.equal(new Set(nodes.map((node) => node.id)).size, nodes.length);
});

test('imported result views reference the evaluator cache, not just a visible edge', async () => {
  const synthetic = JSON.parse(await read('./recipe-suggestion-synthetic-75.cforge'));
  for (const flow of [bundle.flow, comparison.flow, synthetic.flow]) {
    for (const node of flow.nodes.filter((item) => ['vis', 'inspect'].includes(item.type))) {
      const incoming = flow.edges.filter((edge) => edge.target === node.id);
      assert.equal(incoming.length, 1);
      assert.equal(node.data.input, incoming[0].source, `${node.id}: cache source must match the edge`);
      assert.equal(flow.nodes.find((item) => item.id === node.data.input)?.type, 'evaluator');
    }
  }
});

test('embedded evaluator reads ChainForge-escaped contexts without repairing model output', () => {
  const context = { module: { exports: {} } };
  vm.runInNewContext(evaluator.data.code, context);
  const evaluate = context.module.exports.evaluate;
  for (const row of table.data.rows) {
    const compact = JSON.parse(row.compact_context);
    const candidate = compact.candidate_recipes[0];
    const food = compact.priority_foods[0];
    const response = {
      text: JSON.stringify({ schema_version: 1, meals: [{
        title: candidate?.title ?? 'Bohnentopf',
        source: candidate?.source ?? 'model_generated',
        recipe_id: candidate?.id ?? null,
        servings: compact.request.servings,
        used_items: [{ inventory_item_id: food.inventory_item_id, quantity: 1, unit: food.unit }],
        additional_ingredients: [],
        steps: ['Zutaten garen.'],
        notes: [],
      }] }),
      var: { compact_context: row.compact_context.replace(/[{}]/g, '\\$&') },
    };
    assert.equal(evaluate(response), true, row.scenario_id);
    assert.equal(evaluate({ ...response, var: { compact_context: '{broken}' } }), false);
    assert.equal(evaluate({ ...response, text: response.text.replace(/[{}]/g, '\\$&') }), false);
    assert.equal(evaluate({ ...response, text: response.text.replace(food.inventory_item_id, 'unknown') }), false);
  }
});

test('Promptfoo models share strict-output settings and use supported seed/reasoning options', async () => {
  const config = (await read('../promptfoo/promptfooconfig.openrouter.yaml')).replace(/\r\n/g, '\n');
  const providerSection = config.split('providers:\n')[1].split('\nprompts:')[0];
  const blocks = providerSection.split(/(?=  - id: openrouter:)/).filter((block) => block.trim());
  assert.deepEqual(blocks.map((block) => block.match(/id: openrouter:(\S+)/)[1]), models);
  for (const block of blocks) {
    for (const setting of [
      'apiKeyEnvar: OPENROUTER_API_KEY', 'temperature: 0', 'top_p: 1',
      'max_tokens: 8192', 'showThinking: false',
      'require_parameters: true',
    ]) assert.ok(block.includes(setting), setting);
    if (block.match(/id: openrouter:(\S+)/)[1] === 'upstage/solar-pro4') {
      assert.doesNotMatch(block, /^\s*seed\s*:/m);
    } else {
      assert.match(block, /^\s*seed: 0\s*$/m);
    }
    if (block.includes('id: openrouter:z-ai/glm-5.3-flash')) {
      assert.match(block, /^\s*effort: low\s*$/m);
      assert.doesNotMatch(block, /^\s*enabled: false\s*$/m);
    } else {
      assert.match(block, /^\s*enabled: false\s*$/m);
      assert.doesNotMatch(block, /^\s*effort:/m);
    }
  }
  assert.match(config, /response_format: file:\/\/schemas\/recipe-suggestion-response-format.json/);
});
