import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = process.cwd();
const MAESTRO_OUTPUT_DIRECTORY = join(REPO_ROOT, '.agents', 'maestro');

describe('direct Maestro runners', () => {
  let tempDir: string;
  let fakeMaestro: string;
  let capturedArgs: string;
  let capturedEnvironment: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(REPO_ROOT, '.maestro-runner-test-'));
    fakeMaestro = join(tempDir, 'maestro');
    capturedArgs = join(tempDir, 'args.txt');
    capturedEnvironment = join(tempDir, 'environment.txt');

    writeFileSync(
      fakeMaestro,
      [
        '#!/bin/sh',
        'printf \'%s\\n\' "$@" > "$MAESTRO_CAPTURE_ARGS"',
        'printf \'%s\\n\' "$TEST_EMAIL" "$TEST_PASSWORD" "$WRONG_EMAIL" "$WRONG_PASSWORD" "$METRO_MANIFEST_URL" > "$MAESTRO_CAPTURE_ENV"',
      ].join('\n'),
    );
    chmodSync(fakeMaestro, 0o755);
  });

  afterEach(() => rmSync(tempDir, { recursive: true, force: true }));

  it('passes iOS runner arguments and authentication inputs to Maestro', () => {
    const result = spawnSync(
      'bun',
      ['.maestro/scripts/maestro.ts', 'test', '.maestro/ios', '--include-tags', 'smoke'],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: {
          ...process.env,
          MAESTRO_BIN: fakeMaestro,
          MAESTRO_CAPTURE_ARGS: capturedArgs,
          MAESTRO_CAPTURE_ENV: capturedEnvironment,
          TEST_EMAIL: 'maestro@example.com',
          TEST_PASSWORD: 'safe-test-password',
          WRONG_EMAIL: 'wrong@example.com',
          WRONG_PASSWORD: 'wrong-test-password',
          METRO_MANIFEST_URL: 'http%3A%2F%2F127.0.0.1%3A8081',
        },
      },
    );

    expect(result.status).toBe(0);
    expect(readFileSync(capturedArgs, 'utf8')).toBe(
      [
        'test',
        `--test-output-dir=${MAESTRO_OUTPUT_DIRECTORY}`,
        `--debug-output=${MAESTRO_OUTPUT_DIRECTORY}`,
        '.maestro/ios',
        '--include-tags',
        'smoke',
        '--exclude-tags',
        'fixture,local-session,manual',
        '',
      ].join('\n'),
    );
    expect(readFileSync(capturedEnvironment, 'utf8')).toBe(
      'maestro@example.com\nsafe-test-password\nwrong@example.com\nwrong-test-password\nhttp%3A%2F%2F127.0.0.1%3A8081\n',
    );
  });

  it('keeps explicitly selected iOS flows outside the default suite exclusions', () => {
    const flow = '.maestro/ios/flows/session/signed-in-dashboard.yaml';
    const result = spawnSync('bun', ['.maestro/scripts/maestro.ts', 'test', flow], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        MAESTRO_BIN: fakeMaestro,
        MAESTRO_CAPTURE_ARGS: capturedArgs,
        MAESTRO_CAPTURE_ENV: capturedEnvironment,
      },
    });

    expect(result.status).toBe(0);
    expect(readFileSync(capturedArgs, 'utf8')).toBe(
      [
        'test',
        `--test-output-dir=${MAESTRO_OUTPUT_DIRECTORY}`,
        `--debug-output=${MAESTRO_OUTPUT_DIRECTORY}`,
        flow,
        '',
      ].join('\n'),
    );
  });

  it('passes Android flow, explicit device, tag and authentication inputs to Maestro', () => {
    const result = spawnSync(
      'bun',
      [
        '.maestro/scripts/android.ts',
        '.maestro/android/flows/session/signed-in-dashboard.yaml',
        '--include-tags',
        'smoke',
        '--device',
        'Pixel_8_API_35',
      ],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: {
          ...process.env,
          MAESTRO_BIN: fakeMaestro,
          MAESTRO_CAPTURE_ARGS: capturedArgs,
          MAESTRO_CAPTURE_ENV: capturedEnvironment,
          TEST_EMAIL: 'maestro@example.com',
          TEST_PASSWORD: 'safe-test-password',
          WRONG_EMAIL: 'wrong@example.com',
          WRONG_PASSWORD: 'wrong-test-password',
          METRO_MANIFEST_URL: 'http%3A%2F%2F127.0.0.1%3A8081',
        },
      },
    );

    expect(result.status).toBe(0);
    expect(readFileSync(capturedArgs, 'utf8')).toBe(
      [
        'test',
        `--test-output-dir=${MAESTRO_OUTPUT_DIRECTORY}`,
        `--debug-output=${MAESTRO_OUTPUT_DIRECTORY}`,
        '--reinstall-driver',
        '.maestro/android/flows/session/signed-in-dashboard.yaml',
        '--include-tags',
        'smoke',
        '--device',
        'Pixel_8_API_35',
        '',
      ].join('\n'),
    );
    expect(readFileSync(capturedEnvironment, 'utf8')).toBe(
      'maestro@example.com\nsafe-test-password\nwrong@example.com\nwrong-test-password\nhttp%3A%2F%2F127.0.0.1%3A8081\n',
    );
  });

  it('keeps Maestro out of package scripts and flow discovery away from subflows', () => {
    const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const scripts = Object.keys(packageJson.scripts).join(' ');

    expect(scripts).not.toMatch(/maestro|e2e/iu);
    for (const platform of ['ios', 'android']) {
      const config = readFileSync(join(REPO_ROOT, '.maestro', platform, 'config.yaml'), 'utf8');
      expect(config).toContain('flows: flows/**');
      expect(config).not.toContain('subflows');
    }
  });
});
