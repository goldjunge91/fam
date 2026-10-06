import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '..');

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

      const realBun = execFileSync('which', ['bun'], { encoding: 'utf8' }).trim();
      const bunStub = path.join(binDirectory, 'bun');
      fs.writeFileSync(
        bunStub,
        `#!/bin/sh\nif [ "$1" = "-e" ]; then exec ${JSON.stringify(realBun)} "$@"; fi\nexit 0\n`,
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
