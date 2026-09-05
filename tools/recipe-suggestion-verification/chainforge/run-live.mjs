import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import vm from 'node:vm';
import assertRecipeSuggestion from '../promptfoo/assertions/recipe-suggestion.js';

const root = new URL('../', import.meta.url);
const { values } = parseArgs({ options: {
  model: { type: 'string', multiple: true },
  scenario: { type: 'string' },
  matrix: { type: 'boolean', default: false },
  synthetic: { type: 'boolean', default: false },
  'dry-run': { type: 'boolean', default: false },
} });
if (values.matrix && values.synthetic) throw new Error('Select either the comparison matrix or the GLM synthetic suite.');
const flowFile = values.synthetic ? 'recipe-suggestion-synthetic-75.cforge'
  : values.matrix ? 'recipe-suggestion-model-comparison.cforge' : 'recipe-suggestion-v2.cforge';
const flow = JSON.parse(await readFile(new URL(flowFile, import.meta.url), 'utf8')).flow;
const prompt = flow.nodes.find((node) => node.type === 'prompt').data;
const table = flow.nodes.find((node) => node.type === 'table').data;
const evaluator = { module: { exports: {} } };
vm.runInNewContext(flow.nodes.find((node) => node.type === 'evaluator').data.code, evaluator);
const availableModels = prompt.llms.map((llm) => llm.formData.model);
const models = values.model ?? availableModels;
if (new Set(models).size !== models.length || models.some((model) => !availableModels.includes(model))) {
  throw new Error('Select distinct models from the imported ChainForge flow.');
}
const rows = table.rows.filter((row) => !values.scenario || row.scenario_id === values.scenario);
if (rows.length === 0) throw new Error('Unknown scenario.');
const cases = models.flatMap((model) => rows.map((row) => ({ model, row })));
if (values['dry-run']) {
  console.log(JSON.stringify(cases.map(({ model, row }) => ({ model, scenario_id: row.scenario_id }))));
} else {
  if (!process.env.OPENROUTER_API_KEY) process.loadEnvFile(fileURLToPath(new URL('.env', root)));
  if (!process.env.OPENROUTER_API_KEY?.trim()) throw new Error('OPENROUTER_API_KEY is required.');
  const python = fileURLToPath(new URL(process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python', root));
  // Execute the actual uploadable provider, not a second HTTP implementation.
  const providerCode = `
import json, sys
sys.path.insert(0, ${JSON.stringify(fileURLToPath(new URL('chainforge', root)))})
from openrouter_provider_v2 import OpenRouterRecipeSuggestionV2
request = json.load(sys.stdin)
try:
    output = OpenRouterRecipeSuggestionV2(request["prompt"], model=request["model"])
    print(json.dumps({"output": output}))
except Exception as error:
    print(json.dumps({"error": str(error)}))
`;
  const results = [];
  const reportDir = new URL('reports/', root);
  await mkdir(reportDir, { recursive: true });
  const reportPath = new URL(`chainforge-live-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, reportDir);
  for (const { model, row } of cases) {
    const started = Date.now();
    let response;
    try {
      response = await new Promise((resolve, reject) => {
        const child = execFile(python, ['-X', 'utf8', '-c', providerCode], {
          cwd: fileURLToPath(root), timeout: 180_000, windowsHide: true, maxBuffer: 1_000_000,
        }, (error, stdout) => {
          if (error) reject(new Error(error.killed ? 'Provider process timed out after 180s.' : `Provider process failed (${error.code}).`));
          else { try { resolve(JSON.parse(stdout)); } catch { reject(new Error('Invalid provider process output.')); } }
        });
        child.stdin.on('error', reject);
        child.stdin.end(JSON.stringify({ model, prompt: prompt.prompt.replace('{compact_context}', () => row.compact_context).replace(/\\([{}])/g, '$1') }));
      });
    } catch (error) { response = { error: error.message }; }
    const score = response.error ? null : evaluator.module.exports.evaluate({ text: response.output, var: { compact_context: row.compact_context } });
    const result = { model, scenario_id: row.scenario_id, duration_ms: Date.now() - started,
      status: response.error ? 'provider_error' : score === true ? 'pass' : 'contract_failure', ...response };
    if (!response.error) {
      const contract = assertRecipeSuggestion(response.output, { vars: { compact_context: row.compact_context } });
      const quality = contract.pass ? evaluator.module.exports.evaluateSyntheticQuality?.({
        text: response.output, var: { compact_context: row.compact_context },
      }) : null;
      if (quality?.metrics) result.metrics = quality.metrics;
      if (score === false) result.reason = contract.pass
        ? quality?.reason ?? 'Embedded ChainForge evaluator rejected the response'
        : contract.reason;
    }
    results.push(result);
    await writeFile(reportPath, `${JSON.stringify(results, null, 2)}\n`);
    console.log(JSON.stringify({ model, scenario_id: row.scenario_id, status: result.status, duration_ms: result.duration_ms, error: result.error, reason: result.reason }));
  }
  console.log(`Report: ${fileURLToPath(reportPath)}`);
  if (results.some((result) => result.status !== 'pass')) process.exitCode = 1;
}
