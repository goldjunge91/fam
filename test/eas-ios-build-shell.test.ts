import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '..');

describe('eas-ios-build.sh local diagnostics', () => {
  it('records the working directory before invoking the lifecycle recorder', () => {
    const script = fs.readFileSync(path.join(projectRoot, 'scripts', 'eas-ios-build.sh'), 'utf8');
    const recorderInvocation = script.indexOf('run-recorded-ios-build.ts');

    expect(script).toContain('export EAS_LOCAL_BUILD_SKIP_CLEANUP=1');
    expect(script.indexOf('EAS working directory:')).toBeLessThan(recorderInvocation);
    expect(recorderInvocation).toBeGreaterThanOrEqual(0);
    expect(script).toContain('bun x eas-cli "${args[@]}"');
  });
});

describe('eas-ios-build.sh EAS profile validation', () => {
  it('accepts every build profile from eas.json except base', () => {
    const easConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, 'eas.json'), 'utf8')) as {
      build: Record<string, unknown>;
    };
    const profiles = Object.keys(easConfig.build).filter((profile) => profile !== 'base');
    const temporaryBase = path.join(projectRoot, 'build', 'tmp');
    fs.mkdirSync(temporaryBase, { recursive: true });
    const tempRoot = fs.mkdtempSync(path.join(temporaryBase, 'eas-ios-profile-'));

    try {
      const scriptsDirectory = path.join(tempRoot, 'scripts');
      const binDirectory = path.join(tempRoot, 'bin');
      fs.mkdirSync(scriptsDirectory, { recursive: true });
      fs.mkdirSync(binDirectory, { recursive: true });
      fs.copyFileSync(path.join(projectRoot, 'eas.json'), path.join(tempRoot, 'eas.json'));
      fs.copyFileSync(
        path.join(projectRoot, 'scripts', 'eas-ios-build.sh'),
        path.join(scriptsDirectory, 'eas-ios-build.sh'),
      );
      fs.copyFileSync(
        path.join(projectRoot, 'scripts', 'local-build-env.sh'),
        path.join(scriptsDirectory, 'local-build-env.sh'),
      );

      const recorderDirectory = path.join(
        tempRoot,
        '.codex',
        'skills',
        'apple-app-store-release',
        'scripts',
      );
      fs.mkdirSync(recorderDirectory, { recursive: true });
      fs.copyFileSync(
        path.join(
          projectRoot,
          '.codex',
          'skills',
          'apple-app-store-release',
          'scripts',
          'build-run-recorder.ts',
        ),
        path.join(recorderDirectory, 'build-run-recorder.ts'),
      );
      fs.copyFileSync(
        path.join(
          projectRoot,
          '.codex',
          'skills',
          'apple-app-store-release',
          'scripts',
          'run-recorded-ios-build.ts',
        ),
        path.join(recorderDirectory, 'run-recorded-ios-build.ts'),
      );

      const realBun = execFileSync('which', ['bun'], { encoding: 'utf8' }).trim();
      const bunStub = path.join(binDirectory, 'bun');
      fs.writeFileSync(
        bunStub,
        `#!/bin/sh\nif [ "$1" = "-e" ]; then exec ${JSON.stringify(realBun)} "$@"; fi\nif [ "$1" = "${path.join(recorderDirectory, 'run-recorded-ios-build.ts')}" ]; then exec ${JSON.stringify(realBun)} "$@"; fi\nif [ "$1" = "x" ] && [ "$2" = "eas-cli" ]; then exit 0; fi\nexit 1\n`,
      );
      fs.chmodSync(bunStub, 0o755);

      for (const profile of profiles) {
        const result = spawnSync(
          'bash',
          [path.join(scriptsDirectory, 'eas-ios-build.sh'), 'cloud', profile],
          {
            cwd: tempRoot,
            encoding: 'utf8',
            env: { ...process.env, CI: '1', PATH: `${binDirectory}:${process.env.PATH ?? ''}` },
          },
        );

        expect({ profile, status: result.status, output: result.stderr }).toEqual({
          profile,
          status: 0,
          output: '',
        });
      }
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

describe('iOS build workflow hooks', () => {
  it('does not invoke the removed prompt-triggered build script', () => {
    const hooks = fs.readFileSync(path.join(projectRoot, '.codex', 'hooks.json'), 'utf8');
    const actions = fs.readFileSync(path.join(projectRoot, '.github', 'workflows', 'ios-testflight.yml'), 'utf8');

    expect(hooks).not.toContain('ios-build-workflow.sh');
    expect(hooks).toContain('bd codex-hook UserPromptSubmit');
    expect(actions).toContain('bun run eas:ios:local');
  });

  it('archives lifecycle records even when the build or TestFlight upload fails', () => {
    const actions = fs.readFileSync(path.join(projectRoot, '.github', 'workflows', 'ios-testflight.yml'), 'utf8');

    expect(actions).toContain('if: always()');
    expect(actions).toContain('uses: actions/upload-artifact@v4');
    expect(actions).toContain('path: build/workflows/ios/');
    expect(actions).toContain('retention-days: 90');
  });
});
