import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createNativeBuildFixture } from './native-build-fixture';

let fixture: ReturnType<typeof createNativeBuildFixture>;
beforeAll(() => {
  fixture = createNativeBuildFixture();
});
afterAll(() => {
  rmSync(fixture.root, { recursive: true, force: true });
});

describe('native build baseline with CNG', () => {
  it('excludes only dev seed commands from the script fingerprint', () => {
    const config = jest.requireActual('../fingerprint.config.js') as {
      fileHookTransform: (source: { type: 'contents'; id: string }, chunk: string) => string;
    };
    expect(
      JSON.parse(
        config.fileHookTransform(
          { type: 'contents', id: 'packageJson:scripts' },
          JSON.stringify({
            start: 'expo start',
            'seed:glp1': 'bun scripts/glp1-seed.ts',
            'test:unit': 'jest',
          }),
        ),
      ),
    ).toEqual({ start: 'expo start', 'test:unit': 'jest' });
  });

  it('creates and checks an input baseline in a fresh checkout without native directories', () => {
    const baseline = fixture.native('baseline', '--approve-rebuild');
    expect(baseline).toEqual(expect.objectContaining({ status: 0 }));
    const status = fixture.native('status');
    expect(status.output).toContain('Native Baseline ist unverändert.');
    expect(status.status).toBe(0);
  }, 60_000);

  it('ignores generated outputs but detects a config-plugin change', () => {
    for (const platform of ['ios', 'android']) {
      mkdirSync(join(fixture.root, platform), { recursive: true });
      writeFileSync(join(fixture.root, platform, 'generated.txt'), 'host-specific output');
    }
    expect(fixture.native('status').status).toBe(0);
    const plugin = join(fixture.root, 'plugins/withAndroidGradleTuning.js');
    writeFileSync(plugin, 'module.exports = config => config;\n');
    const changed = fixture.native('status');
    expect(changed.status).toBe(1);
    expect(changed.output).toContain('Fingerprint stimmt nicht mit dem Lock überein');
  }, 60_000);

  it('blocks a rebuild needing regeneration without explicit approval', () => {
    const result = fixture.native('rebuild', '--target', 'ios-development-simulator');
    expect(result.status).toBe(1);
    expect(result.output).toContain("'--approve-rebuild'");
  }, 60_000);
});
