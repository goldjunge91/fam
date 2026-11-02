import { readFile } from 'node:fs/promises';
import { describe, expect, it } from '@jest/globals';

const actionPath = '.github/actions/setup-bun-env/action.yaml';

describe('ExecuTorch CI artifact handling', () => {
  it('skips native downloads only when explicitly requested and caches native libraries before install', async () => {
    const action = await readFile(actionPath, 'utf8');

    expect(action).toContain('skip-executorch-download:');
    const skipDownloadCondition =
      'if [[ "' + '$' + '{{ inputs.skip-executorch-download }}" == "true" ]]';
    expect(action).toContain(skipDownloadCondition);
    expect(action).toContain('RNET_SKIP_DOWNLOAD=1');
    expect(action).toContain("printf 'RNET_LIBS_CACHE_DIR=%s\\n'");
    expect(action).toContain("if: inputs.cache-executorch-libs == 'true'");
    expect(action).toContain('path: build/cache/react-native-executorch');
    expect(action).toContain('save-always: true');
    expect(action).toContain("hashFiles('bun.lock', 'bunfig.toml', 'package.json')");
    expect(action.indexOf('Cache ExecuTorch native libraries')).toBeLessThan(
      action.indexOf('name: Install dependencies'),
    );
  });

  it('keeps JS-only CI jobs independent of native release downloads and enables caches on native builds', async () => {
    const [ci, autofix, android, simulator, testflight, release] = await Promise.all([
      readFile('.github/workflows/ci.yml', 'utf8'),
      readFile('.github/workflows/autofix.yml', 'utf8'),
      readFile('.github/workflows/android-dev-apk.yml', 'utf8'),
      readFile('.github/workflows/ios-simulator-build.yml', 'utf8'),
      readFile('.github/workflows/ios-testflight.yml', 'utf8'),
      readFile('.github/workflows/release-please.yml', 'utf8'),
    ]);

    expect(ci.match(/skip-executorch-download: true/g)).toHaveLength(3);
    expect(autofix).toContain('skip-executorch-download: true');
    expect(android).toContain('cache-executorch-libs: true');
    expect(simulator).toContain('cache-executorch-libs: true');
    expect(testflight).toContain('cache-executorch-libs: true');
    expect(release.match(/cache-executorch-libs: true/g)).toHaveLength(2);
  });
});
