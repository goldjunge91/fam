import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

type CommandResult = {
  output: string;
  status: number | null;
};

const projectRoot = resolve(__dirname, '..');

function runNative(...arguments_: string[]): CommandResult {
  const result = spawnSync('bun', ['scripts/native-build/native-build.ts', ...arguments_], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, EXPO_NO_DOTENV: '1', FAM_HARNESS_UI: '0' },
  });

  return {
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
    status: result.status,
  };
}

describe('native build artifact lock', () => {
  it('does not compile when the locked binary is missing', () => {
    const result = runNative('run', '--target', 'ios-production');

    expect(result.status).toBe(1);
    expect(result.output).toContain('Kein Artefakt für ios-production registriert');
    expect(result.output).toContain('Kein automatischer Rebuild');
  });
});
