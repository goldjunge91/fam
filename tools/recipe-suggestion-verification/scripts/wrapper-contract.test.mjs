import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (file) => readFile(path.join(root, file), 'utf8');

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

  assert.match(powershell, /Join-Path \$verificationDir '\.venv\\Scripts\\chainforge\.exe'/);
  assert.doesNotMatch(powershell, /\$platformDir|\.venv-chainforge/);
  assert.match(powershell, /FAM_CHAINFORGE_BIN/);
  assert.match(shell, /VERIFICATION_DIR/);
  assert.match(shell, /\.venv\/bin\/chainforge/);
  assert.match(shell, /\.venv\/Scripts\/chainforge\.exe/);
  assert.doesNotMatch(shell, /PLATFORM_DIR|\.venv-chainforge/);
  assert.match(shell, /FAM_CHAINFORGE_BIN/);
});
