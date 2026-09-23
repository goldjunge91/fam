import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { createNativeBuildFixture } from './native-build-fixture';

describe('CNG config plugins', () => {
  it('preserves native caches across local and EAS prebuilds and supports relocated ccache wrappers', () => {
    const fixture = createNativeBuildFixture();
    const moved = `${fixture.root} relocated`;
    try {
      const compiler = join(fixture.root, "fake ccache's binary");
      writeFileSync(
        compiler,
        '#!/bin/sh\nprintf "%s\\n" "$CCACHE_DIR" "$CCACHE_BASEDIR" "$CCACHE_CONFIGPATH" "$@"\n',
      );
      chmodSync(compiler, 0o755);
      const cache = join(fixture.root, "external cache's directory");
      const result = fixture.run(
        ['run', 'native:prebuild', '--', '--no-install', '--platform', 'all'],
        { CCACHE_BINARY: compiler, CCACHE_DIR: cache },
      );
      expect(result.status).toBe(0);
      expect(
        JSON.parse(readFileSync(join(fixture.root, 'ios/Podfile.properties.json'), 'utf8')),
      ).toHaveProperty(['apple.ccacheEnabled'], 'true');
      expect(existsSync(join(fixture.root, 'android/app/src/main/AndroidManifest.xml'))).toBe(true);
      expect(existsSync(join(fixture.root, 'ios/ExpoWidgetsTarget/ShoppingListWidget.swift'))).toBe(
        true,
      );
      const podfile = readFileSync(join(fixture.root, 'ios/Podfile'), 'utf8');
      expect(podfile).toContain('withIosCcacheDir: disable explicit modules');
      expect(podfile).toContain(
        "c.build_settings['CC'] = File.join(__dir__, '.ccache-wrapper-clang.sh')",
      );
      const project = readFileSync(join(fixture.root, 'ios/fam.xcodeproj/project.pbxproj'), 'utf8');
      expect(project).toContain('$(SRCROOT)/.ccache-wrapper-clang.sh');
      expect(project).toContain('POSTHOG_DSYM_TIMEOUT=300');

      const cachedFiles = [
        'ios/Pods/cached-pod.a',
        'ios/Podfile.lock',
        'ios/build/cached-object.o',
        'android/.gradle/cached-state.bin',
        'android/app/build/cached-object.o',
      ];
      for (const file of cachedFiles) {
        const path = join(fixture.root, file);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, `preserve ${file}`);
      }
      const eas = JSON.parse(readFileSync(join(fixture.root, 'eas.json'), 'utf8')) as {
        build: { base: { prebuildCommand: string } };
      };
      for (const command of [
        ['run', 'native:prebuild', '--'],
        ['node_modules/expo/bin/cli', ...eas.build.base.prebuildCommand.split(' ')],
      ]) {
        const updated = fixture.run([...command, '--no-install', '--platform', 'all'], {
          CCACHE_BINARY: compiler,
          CCACHE_DIR: cache,
        });
        expect(updated.status).toBe(0);
        for (const file of cachedFiles) {
          expect(readFileSync(join(fixture.root, file), 'utf8')).toBe(`preserve ${file}`);
        }
      }
      const regeneratedPodfile = readFileSync(join(fixture.root, 'ios/Podfile'), 'utf8');
      expect(
        regeneratedPodfile.match(/withIosCcacheDir: RNs eigener ccache-Wrapper/g),
      ).toHaveLength(1);
      expect(regeneratedPodfile.match(/withIosCcacheDir: disable explicit modules/g)).toHaveLength(
        1,
      );

      // EAS moves native output; the external compiler/cache stay at their host paths.
      renameSync(join(fixture.root, 'ios'), join(fixture.root, 'generated-ios'));
      mkdirSync(moved);
      renameSync(join(fixture.root, 'generated-ios'), join(moved, 'ios'));
      for (const [wrapper, language] of [
        ['.ccache-wrapper-clang.sh', 'clang'],
        ['.ccache-wrapper-clang++.sh', 'clang++'],
      ]) {
        const invocation = spawnSync(join(moved, 'ios', wrapper), ['source with spaces.cpp'], {
          encoding: 'utf8',
          cwd: '/',
        });
        expect(invocation.status).toBe(0);
        expect(invocation.stdout.trim().split('\n')).toEqual([
          cache,
          moved,
          `${moved}/node_modules/react-native/scripts/xcode/ccache.conf`,
          language,
          'source with spaces.cpp',
        ]);
      }
    } finally {
      rmSync(fixture.root, { recursive: true, force: true });
      rmSync(moved, { recursive: true, force: true });
    }
  }, 60_000);
});
