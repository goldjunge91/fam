import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type CommandResult = {
  output: string;
  status: number | null;
};

const projectRoot = resolve(__dirname, '..');

function runNative(...arguments_: string[]): CommandResult {
  const result = spawnSync('bun', ['scripts/native-build.ts', ...arguments_], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, EXPO_NO_DOTENV: '1' },
  });

  return {
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
    status: result.status,
  };
}

describe('native build lock', () => {
  it('contains the generated iOS and Android baseline', () => {
    const lock = JSON.parse(
      readFileSync(resolve(projectRoot, 'native-build-lock.json'), 'utf8'),
    ) as {
      schemaVersion: number;
      nativeFingerprints: Record<string, { hash: string; expoSdk: string }>;
    };

    expect(lock.schemaVersion).toBe(1);
    expect(lock.nativeFingerprints.ios.hash).toMatch(/^[a-f0-9]{40}$/);
    expect(lock.nativeFingerprints.android.hash).toMatch(/^[a-f0-9]{40}$/);
    expect(lock.nativeFingerprints.ios.expoSdk).toBe('57.0.17');
    expect(lock.nativeFingerprints.android.expoSdk).toBe('57.0.17');
  });

  it('accepts the unchanged native baseline', () => {
    const result = runNative('status');

    expect(result.status).toBe(0);
    expect(result.output).toContain('Native Baseline ist unverändert.');
  });

  it('blocks rebuilds without explicit approval', () => {
    const result = runNative('rebuild', '--target', 'ios-development-simulator');

    expect(result.status).toBe(1);
    expect(result.output).toContain("'--approve-rebuild'");
  });

  it('does not compile when the locked binary is missing', () => {
    const result = runNative('run', '--target', 'ios-production');

    expect(result.status).toBe(1);
    expect(result.output).toContain('Kein Artefakt für ios-production registriert');
    expect(result.output).toContain('Kein automatischer Rebuild');
  });
});
