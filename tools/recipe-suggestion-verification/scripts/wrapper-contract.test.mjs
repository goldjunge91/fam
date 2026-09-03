import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (file) => readFile(path.join(root, file), 'utf8');

test('both Promptfoo entry configs bound eval time and avoid stacked retry queues for every launcher', async () => {
  for (const file of ['promptfooconfig.yaml', 'promptfooconfig.openrouter.yaml']) {
    const config = await read(`../promptfoo/${file}`);
    assert.match(config, /env:\r?\n  PROMPTFOO_DISABLE_ADAPTIVE_SCHEDULER: true\r?\n  REQUEST_TIMEOUT_MS: 120000\b/, file);
    assert.match(config, /evaluateOptions:\r?\n  timeoutMs: 125000\r?\n  maxEvalTimeMs: 900000\b/, file);
    const providers = config.split(/\r?\n  - id: /).slice(1);
    for (const provider of providers) {
      assert.match(provider, /\n      maxRetries: 0\r?\n/, file);
    }
  }
});

test('installed Promptfoo makes one HTTP attempt on 429 and aborts a stalled fetch without retry', { timeout: 2000 }, async () => {
  // Isolate pinned CLI functions: importing Promptfoo itself loads dotenv and logging.
  const fetchSource = await read('../node_modules/promptfoo/dist/src/fetch-KD8O9oZZ.js');
  const schedulerSource = await read('../node_modules/promptfoo/dist/src/shared-jcnXW0lA.js');
  const functionSource = (source, name) => {
    const match = source.match(new RegExp(`^(?:async )?function ${name}\\([^]*?^\\}`, 'm'));
    assert.ok(match, `Promptfoo function ${name} must be reviewed after a dependency update`);
    return match[0];
  };
  const executeSource = schedulerSource.match(/^\tasync execute\(provider, callFn, options\) \{[^]*?^\t\}/m)?.[0];
  assert.ok(executeSource);
  let attempts = 0;
  let aborted = false;
  let stalled = false;
  class HttpRateLimitError extends Error {}
  const runtime = runInNewContext(`
    ${['withFetchRetryContext', 'getFetchRetryContextMaxRetries', 'fetchWithTimeout', 'handleRateLimitedResponse', 'fetchWithRetries'].map((name) => functionSource(fetchSource, name)).join('\n')}
    ${functionSource(schedulerSource, 'getProviderMaxRetries')}
    ({ fetchWithRetries, execute: ({ ${executeSource} }).execute })
  `, {
    AbortController, AbortSignal, Request, setTimeout, clearTimeout, HttpRateLimitError,
    fetchRetryContext: new AsyncLocalStorage(),
    logger: { debug() {}, warn() {} },
    getEnvInt: (_name, fallback) => fallback,
    getEnvBool: () => false,
    isRateLimited: (response) => response.status === 429,
    isHardQuotaCode: () => false,
    urlForLog: (url) => url,
    peekRateLimitBody: async () => ({ body: {}, code: undefined }),
    buildHttpRateLimitError: () => new HttpRateLimitError('HTTP 429'),
    formatFetchErrorMessage: (error) => String(error),
    handleRateLimit: () => assert.fail('Fail-fast must not wait for Retry-After'),
    sleepWithAbort: () => assert.fail('Fail-fast must not wait for retry backoff'),
    fetchWithProxy: async (_url, options) => {
      attempts++;
      if (!stalled) return { status: 429, headers: new Headers({ 'Retry-After': '3600' }) };
      return new Promise((_, reject) => {
        options.signal.addEventListener('abort', () => {
          aborted = true;
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        }, { once: true });
      });
    },
  });
  const scheduler = { enabled: false, getOrCreateState: () => assert.fail('No scheduler cooldown queue') };
  const invoke = () => runtime.execute.call(scheduler, { config: { maxRetries: 0 } },
    () => runtime.fetchWithRetries('https://example.invalid/simulated', {}, 25));
  for (let index = 0; index < 2; index++) {
    await assert.rejects(invoke(), /HTTP 429/);
    assert.equal(attempts, index + 1, 'exactly one attempt per sequential case');
  }
  stalled = true;
  await assert.rejects(invoke(), /timed out|aborted/);
  assert.equal(attempts, 3, 'a stalled request must not be retried');
  assert.equal(aborted, true, 'the request timeout aborts the simulated transport');
});

test('Promptfoo wrappers resolve the installation from the standalone eval folder', async () => {
  const powershell = await read('promptfoo.ps1');
  const shell = await read('promptfoo.sh');

  assert.match(powershell, /Join-Path \$verificationDir 'node_modules\\promptfoo\\dist\\src\\entrypoint\.js'/);
  assert.doesNotMatch(powershell, /\$platformDir/);
  assert.match(powershell, /PROMPTFOO_CONFIG_DIR/);
  assert.match(powershell, /FAM_NODE_BIN/);
  assert.match(powershell, /promptfoo-node-preload\.cjs/);
  assert.match(powershell, /Push-Location \$verificationDir/);
  assert.match(shell, /VERIFICATION_DIR/);
  assert.match(shell, /VERIFICATION_DIR\/node_modules\/promptfoo\/dist\/src\/entrypoint\.js/);
  assert.doesNotMatch(shell, /PLATFORM_DIR/);
  assert.match(shell, /PROMPTFOO_CONFIG_DIR/);
  assert.match(shell, /FAM_NODE_BIN/);
  assert.match(shell, /promptfoo-node-preload\.cjs/);
  assert.match(shell, /cd -- "\$VERIFICATION_DIR"/);
});

test('ChainForge wrappers resolve the local environment and allow an explicit launcher override', async () => {
  const powershell = await read('chainforge.ps1');
  const shell = await read('chainforge.sh');

  assert.match(powershell, /Join-Path \$verificationDir '\.venv\\Scripts\\python\.exe'/);
  assert.match(powershell, /from chainforge import main; main\(\)/);
  assert.doesNotMatch(powershell, /\.venv\\Scripts\\chainforge\.exe/);
  assert.doesNotMatch(powershell, /\$platformDir|\.venv-chainforge/);
  assert.match(powershell, /FAM_CHAINFORGE_BIN/);
  assert.match(shell, /VERIFICATION_DIR/);
  assert.match(shell, /\.venv\/bin\/python/);
  assert.match(shell, /\.venv\/Scripts\/python\.exe/);
  assert.match(shell, /from chainforge import main; main\(\)/);
  assert.doesNotMatch(shell, /\.venv\/(?:bin\/chainforge|Scripts\/chainforge\.exe)/);
  assert.doesNotMatch(shell, /PLATFORM_DIR|\.venv-chainforge/);
  assert.match(shell, /FAM_CHAINFORGE_BIN/);
});
