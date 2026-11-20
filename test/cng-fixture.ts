import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export function createCngFixture() {
  const projectRoot = resolve(__dirname, '..');
  const root = mkdtempSync(join(tmpdir(), 'fam-cng-'));
  for (const path of [
    'package.json',
    'app.json',
    'app.config.ts',
    'eas.json',
    'bun.lock',
    'react-native.config.js',
    'plugins',
    'targets',
    'assets',
    'patches',
  ]) {
    cpSync(join(projectRoot, path), join(root, path), { recursive: true });
  }
  symlinkSync(join(projectRoot, 'node_modules'), join(root, 'node_modules'), 'junction');

  function run(args: string[], environment: Record<string, string> = {}) {
    const baseEnvironment = { ...process.env };
    for (const variable of ['CCACHE_BINARY', 'CCACHE_DIR']) {
      if (!(variable in environment)) delete baseEnvironment[variable];
    }
    const result = spawnSync('bun', args, {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...baseEnvironment,
        EXPO_NO_DOTENV: '1',
        FAM_HARNESS_UI: '0',
        CI: '1',
        ...environment,
      },
      timeout: 60_000,
    });
    if (result.error) throw result.error;
    return { output: `${result.stdout ?? ''}${result.stderr ?? ''}`, status: result.status };
  }

  return { root, run };
}
