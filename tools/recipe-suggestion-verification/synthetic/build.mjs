import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { syntheticScenarios, DATASET_VERSION } from './scenarios.mjs';

const root = new URL('../', import.meta.url);
const read = (name) => readFile(new URL(name, root), 'utf8');
if (syntheticScenarios.length !== 75) throw new Error('Expected exactly 75 synthetic scenarios.');
const rows = syntheticScenarios.map(({ scenario_id, scenario_type, compact_context }) =>
  ({ scenario_id, scenario_type, compact_context }));
const prompt = `${await read('chainforge/recipe-suggestion-prompt.txt')}
Für diesen Test gilt zusätzlich: Jede Mahlzeit hat exakt request.servings Portionen.
Verwende das Lebensmittel mit dem höchsten priority_score und mindestens zwei
verschiedene priority_foods, wenn mindestens zwei verfügbar sind. Verbrauche
möglichst viele priorisierte Lebensmittel, ohne ihre verfügbaren Mengen zu überschreiten.
`;
const expected = Object.fromEntries(syntheticScenarios.map((scenario) =>
  [scenario.compact_context.priority_foods[0].inventory_item_id, scenario.expected]));
if (Object.keys(expected).length !== 75) throw new Error('Expected unique inventory IDs per scenario.');
const quality = (await read('synthetic/quality.mjs')).replace(/^export /gm, '');
const evaluator = `${await read('chainforge/recipe-suggestion-evaluator.js')}
${quality}
const SYNTHETIC_EXPECTATIONS = ${JSON.stringify(expected)};
const evaluateContract = evaluate;
function evaluateSyntheticQuality(response) {
  const compact = readJson(response.var.compact_context);
  const expected = SYNTHETIC_EXPECTATIONS[compact.priority_foods[0].inventory_item_id];
  return assessSyntheticResponse(response.text, compact, expected);
}
evaluate = function(response) {
  if (evaluateContract(response) !== 1) return 0;
  return evaluateSyntheticQuality(response).pass ? 1 : 0;
};
if (typeof module !== 'undefined') module.exports = { evaluate, evaluateSyntheticQuality };
`;
const flow = JSON.parse(await read('chainforge/recipe-suggestion-v2.cforge'));
const table = flow.flow.nodes.find((node) => node.type === 'table').data;
table.rows = rows.map((row) => ({ ...row, compact_context: JSON.stringify(row.compact_context), __uid: row.scenario_id }));
table.sample = false;
const promptNode = flow.flow.nodes.find((node) => node.type === 'prompt').data;
promptNode.prompt = prompt;
promptNode.title = '75 synthetische Inventare · GLM 5.3';
flow.flow.nodes.find((node) => node.type === 'evaluator').data.code = evaluator;
flow.cache = { __s: [] };
const tests = syntheticScenarios.map((scenario) => ({
  description: `${scenario.scenario_id}: ${scenario.description}`,
  vars: { scenario_id: scenario.scenario_id, compact_context: JSON.stringify(scenario.compact_context), expected: JSON.stringify(scenario.expected) },
  metadata: { dataset: DATASET_VERSION, scenario_type: scenario.scenario_type, tags: scenario.tags },
  assert: [
    { type: 'is-json', value: 'file://promptfoo/schemas/recipe-suggestion-response.schema.json' },
    { type: 'javascript', value: 'file://assertions/recipe-suggestion.js' },
    { type: 'javascript', value: 'file://assertions/synthetic-quality.js' },
  ],
}));
const coverage = {
  dataset_version: DATASET_VERSION, scenarios: rows.length,
  types: Object.fromEntries([...new Set(rows.map((row) => row.scenario_type))].map((type) =>
    [type, rows.filter((row) => row.scenario_type === type).length])),
  servings: [...new Set(rows.map((row) => row.compact_context.request.servings))].sort((a, b) => a - b),
  units: [...new Set(rows.flatMap((row) => row.compact_context.priority_foods.map((food) => food.unit)))].sort(),
  synthetic_inventory_items: syntheticScenarios.reduce((sum, row) => sum + row.synthetic_inventory.length, 0),
  tags: Object.fromEntries([...new Set(syntheticScenarios.flatMap((row) => row.tags))].sort().map((tag) =>
    [tag, syntheticScenarios.filter((row) => row.tags.includes(tag)).length])),
};
const artifacts = {
  'synthetic/inventories.json': `${JSON.stringify(syntheticScenarios, null, 2)}\n`,
  'synthetic/coverage.json': `${JSON.stringify(coverage, null, 2)}\n`,
  'chainforge/recipe-suggestion-synthetic-dataset.jsonl': `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`,
  'chainforge/recipe-suggestion-synthetic-75.cforge': `${JSON.stringify(flow, null, 2)}\n`,
  'promptfoo/tests/recipe-suggestion-synthetic.json': `${JSON.stringify(tests, null, 2)}\n`,
  'promptfoo/prompts/recipe-suggestion-synthetic.prompt.txt': prompt.replace('{compact_context}', '{{compact_context}}'),
};
for (const [name, content] of Object.entries(artifacts)) {
  await mkdir(new URL('./', new URL(name, root)), { recursive: true });
  await writeFile(new URL(name, root), content);
}
console.log(JSON.stringify(coverage, null, 2));
