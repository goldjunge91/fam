import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export function createNativeBuildFixture() {
  const projectRoot = resolve(__dirname, '..');
  const root = mkdtempSync(join(tmpdir(), 'fam-native-build-'));
  for (const path of [
    'package.json',
    'app.json',
    'eas.json',
    'bun.lock',
    'fingerprint.config.js',
    'react-native.config.js',
    'plugins',
    'assets',
    'patches',
    'scripts/native-build',
  ]) {
    cpSync(join(projectRoot, path), join(root, path), { recursive: true });
  }
  symlinkSync(join(projectRoot, 'node_modules'), join(root, 'node_modules'), 'junction');

  function run(args: string[], environment: Record<string, string> = {}) {
    const result = spawnSync('bun', args, {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, EXPO_NO_DOTENV: '1', FAM_HARNESS_UI: '0', CI: '1', ...environment },
      timeout: 60_000,
    });
    if (result.error) throw result.error;
    return { output: `${result.stdout ?? ''}${result.stderr ?? ''}`, status: result.status };
  }

  return {
    root,
    run,
    native: (...args: string[]) => run(['scripts/native-build/native-build.ts', ...args]),
  };
}
