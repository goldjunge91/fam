import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const projectRoot = resolve(__dirname, '..');
const configPath = resolve(projectRoot, 'react-native.config.js');

function loadConfig(harnessUI: '0' | '1') {
  const output = execFileSync(
    process.execPath,
    ['-e', "console.log(JSON.stringify(require(process.argv[1])))", configPath],
    {
      cwd: projectRoot,
      env: { ...process.env, FAM_HARNESS_UI: harnessUI },
      encoding: 'utf8',
    },
  );

  return JSON.parse(output) as {
    dependencies?: {
      '@react-native-harness/ui'?: {
        platforms?: { ios?: null; android?: null };
      };
    };
  };
}

describe('react-native autolinking configuration', () => {
  it('excludes HarnessUI from release native projects', () => {
    const config = loadConfig('0');

    expect(config.dependencies?.['@react-native-harness/ui']?.platforms).toEqual({
      ios: null,
      android: null,
    });
  });

  it('keeps HarnessUI available for dev projects', () => {
    expect(loadConfig('1')).toEqual({});
  });
});
