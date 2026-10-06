import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

describe('PostHog build wrappers', () => {
  it('keeps Hermes upload failures nonfatal while preserving bundle and clone failures', () => {
    const root = mkdtempSync(join(tmpdir(), 'posthog-hermes-wrapper-'));
    const runner = join(root, 'runner.sh');
    const wrapper = join(process.cwd(), 'scripts/posthog-xcode-tolerant.sh');
    writeFileSync(runner, '#!/bin/sh\nprintf "%s\\n" "$FAKE_OUTPUT"\nexit "$FAKE_STATUS"\n', {
      mode: 0o755,
    });

    try {
      const run = (output: string, status: number) =>
        spawnSync('bash', [wrapper, runner], {
          encoding: 'utf8',
          env: { ...process.env, FAKE_OUTPUT: output, FAKE_STATUS: String(status) },
        });

      const uploadFailure = run(
        'error: posthog-cli hermes upload failed with exit code 1',
        1,
      );
      expect(uploadFailure.status).toBe(0);
      expect(uploadFailure.stdout).toContain('continuing the native archive');

      const cloneFailure = run('error: posthog-cli hermes clone failed with exit code 2', 2);
      expect(cloneFailure.status).toBe(2);

      const bundleFailure = run('error: react-native-xcode - bundling failed', 17);
      expect(bundleFailure.status).toBe(17);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('uploads archive dSYMs after build and keeps an upload outage nonfatal', () => {
    const root = mkdtempSync(join(tmpdir(), 'posthog-dsym-upload-'));
    const archive = join(root, 'ios/build/App.xcarchive');
    const infoPlist = join(archive, 'Products/Applications/fam.app/Info.plist');
    const cli = join(root, 'posthog-cli');
    const argsPath = join(root, 'args.txt');
    const uploadScript = join(process.cwd(), 'scripts/posthog-upload-ios-dsyms.sh');
    const easSuccessScript = join(process.cwd(), 'scripts/posthog-eas-build-on-success.sh');

    mkdirSync(join(archive, 'dSYMs'), { recursive: true });
    mkdirSync(join(archive, 'Products/Applications/fam.app'), { recursive: true });
    writeFileSync(infoPlist, '<plist/>');
    writeFileSync(cli, '#!/bin/sh\nprintf "%s\\n" "$@" > "$POSTHOG_ARGS_PATH"\nexit 7\n');
    chmodSync(cli, 0o755);

    try {
      const result = spawnSync('bash', [easSuccessScript], {
        encoding: 'utf8',
        env: {
          ...process.env,
          EAS_BUILD_PLATFORM: 'ios',
          EAS_BUILD_WORKINGDIR: root,
          POSTHOG_CLI_PATH: cli,
          POSTHOG_ARGS_PATH: argsPath,
        },
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('PostHog dSYM upload failed');
      expect(readFileSync(argsPath, 'utf8').split('\n')).toEqual(
        expect.arrayContaining([
          'dsym',
          'upload',
          '--directory',
          join(archive, 'dSYMs'),
          '--info-plist',
          infoPlist,
          '--main-dsym',
          'fam.app.dSYM',
          '--skip-on-conflict',
        ]),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('replaces only the PostHog wrapper in the generated bundle phase', () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'posthog-hermes-plugin-'));
    const pbxPath = join(projectRoot, 'project.pbxproj');
    const posthogInvocation = `\`"$NODE_BINARY" --print "require('path').join(require('path').dirname(require.resolve('posthog-react-native')), '..', 'tooling', 'posthog-xcode.sh')"\``;
    const script = `export POSTHOG_SKIP_ON_CONFLICT=1\n${posthogInvocation} /bin/sh rn-xcode.sh\n`;
    writeFileSync(
      pbxPath,
      [
        '/* Begin PBXNativeTarget section */',
        '\t\tAPP /* fam */ = {',
        '\t\t\tbuildPhases = (',
        '\t\t\t\tABCDEF0123456789ABCDEF01 /* Bundle React Native code and images */,',
        '\t\t\t);',
        '\t\t\tbuildRules = (',
        '\t\t\t);',
        '\t\t};',
        '/* End PBXNativeTarget section */',
        '/* Begin PBXShellScriptBuildPhase section */',
        '\t\tABCDEF0123456789ABCDEF01 /* Bundle React Native code and images */ = {',
        `\t\t\tshellScript = ${JSON.stringify(script)};`,
        '\t\t};',
        '/* End PBXShellScriptBuildPhase section */',
      ].join('\n'),
    );

    try {
      let configWithFinalizedMod:
        | { finalizedMod: { action: (config: unknown) => unknown } }
        | undefined;
      jest.isolateModules(() => {
        jest.doMock('expo/config-plugins', () => ({
          IOSConfig: { Paths: { getPBXProjectPath: () => pbxPath } },
          withFinalizedMod: (
            config: Record<string, unknown>,
            [platform, action]: [string, (config: unknown) => unknown],
          ) => ({ ...config, finalizedMod: { platform, action } }),
        }));
        configWithFinalizedMod = require('../plugins/withPosthogNonfatalHermesUpload')({});
      });

      if (!configWithFinalizedMod) throw new Error('Expo plugin did not return a config');
      configWithFinalizedMod.finalizedMod.action({ modRequest: { projectRoot } });

      const updatedProject = readFileSync(pbxPath, 'utf8');
      expect(updatedProject).toContain('scripts/posthog-xcode-tolerant.sh');
      expect(updatedProject).toContain('/bin/sh rn-xcode.sh');
      expect(updatedProject).not.toContain(posthogInvocation);
    } finally {
      rmSync(projectRoot, { recursive: true, force: true });
      jest.dontMock('expo/config-plugins');
    }
  });
});
