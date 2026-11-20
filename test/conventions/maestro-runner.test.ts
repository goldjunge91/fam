import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = process.cwd();
const MAESTRO_OUTPUT_DIRECTORY = join(REPO_ROOT, '.agents', 'maestro');

describe('direct Maestro runners', () => {
  let tempDir: string;
  let fakeMaestro: string;
  let capturedArgs: string;
  let capturedEnvironment: string;
  let capturedMailosaurPresence: string;
  let capturedMaestroMailosaurPresence: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(REPO_ROOT, '.maestro-runner-test-'));
    fakeMaestro = join(tempDir, 'maestro');
    capturedArgs = join(tempDir, 'args.txt');
    capturedEnvironment = join(tempDir, 'environment.txt');
    capturedMailosaurPresence = join(tempDir, 'mailosaur-presence.txt');
    capturedMaestroMailosaurPresence = join(tempDir, 'maestro-mailosaur-presence.txt');

    writeFileSync(
      fakeMaestro,
      [
        '#!/bin/sh',
        'printf \'%s\\n\' "$@" > "$MAESTRO_CAPTURE_ARGS"',
        'printf \'%s\\n\' "$TEST_EMAIL" "$TEST_PASSWORD" "$WRONG_EMAIL" "$WRONG_PASSWORD" "$METRO_MANIFEST_URL" > "$MAESTRO_CAPTURE_ENV"',
        'if [ -n "$MAESTRO_CAPTURE_MAILOSAUR" ]; then if [ -n "$MAILOSAUR_API_KEY" ]; then printf \'present\\n\' > "$MAESTRO_CAPTURE_MAILOSAUR"; else printf \'absent\\n\' > "$MAESTRO_CAPTURE_MAILOSAUR"; fi; fi',
        'if [ -n "$MAESTRO_CAPTURE_MAILOSAUR_PREFIX" ]; then if [ -n "$MAESTRO_MAILOSAUR_API_KEY" ]; then printf \'present\\n\' > "$MAESTRO_CAPTURE_MAILOSAUR_PREFIX"; else printf \'absent\\n\' > "$MAESTRO_CAPTURE_MAILOSAUR_PREFIX"; fi; fi',
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
        'fixture,local-session,manual,remote-setup,remote-recovery',
        '',
      ].join('\n'),
    );
    expect(readFileSync(capturedEnvironment, 'utf8')).toBe(
      'maestro@example.com\nsafe-test-password\nwrong@example.com\nwrong-test-password\nhttp%3A%2F%2F127.0.0.1%3A8081\n',
    );
  });

  it('loads Mailosaur runtime values only for an explicitly selected remote flow', () => {
    const envFile = join(tempDir, 'remote.env');
    writeFileSync(envFile, 'MAILOSAUR_API_KEY=present\n');

    const flow = '.maestro/ios/flows/auth/password-reset-remote-code.yaml';
    const result = spawnSync('bun', ['.maestro/scripts/maestro.ts', 'test', flow], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        MAESTRO_BIN: fakeMaestro,
        MAESTRO_CAPTURE_ARGS: capturedArgs,
        MAESTRO_CAPTURE_ENV: capturedEnvironment,
        MAESTRO_CAPTURE_MAILOSAUR: capturedMailosaurPresence,
        MAESTRO_CAPTURE_MAILOSAUR_PREFIX: capturedMaestroMailosaurPresence,
        MAESTRO_ENV_FILE: envFile,
        MAILOSAUR_API_KEY: '',
      },
    });

    expect(result.status).toBe(0);
    expect(readFileSync(capturedMailosaurPresence, 'utf8')).toBe('present\n');
    expect(readFileSync(capturedMaestroMailosaurPresence, 'utf8')).toBe('present\n');
    expect(readFileSync(capturedArgs, 'utf8')).not.toContain('MAILOSAUR_API_KEY');
  });

  it('retains remote exclusions when a suite supplies custom exclusions', () => {
    const result = spawnSync(
      'bun',
      ['.maestro/scripts/maestro.ts', 'test', '.maestro/ios', '--exclude-tags', 'fixture'],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: {
          ...process.env,
          MAESTRO_BIN: fakeMaestro,
          MAESTRO_CAPTURE_ARGS: capturedArgs,
          MAESTRO_CAPTURE_ENV: capturedEnvironment,
        },
      },
    );

    expect(result.status).toBe(0);
    expect(readFileSync(capturedArgs, 'utf8')).toContain(
      '--exclude-tags\nfixture,remote-setup,remote-recovery\n',
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

  it('forces explicitly selected remote flows onto iOS', () => {
    const flow = '.maestro/ios/flows/auth/password-reset-remote-code.yaml';
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
    expect(readFileSync(capturedArgs, 'utf8')).toContain(`${flow}\n--platform=ios\n`);
  });

  it('rejects explicitly targeted Android remote flows before Maestro starts', () => {
    const flow = '.maestro/ios/flows/auth/password-reset-remote-link.yaml';
    const result = spawnSync(
      'bun',
      ['.maestro/scripts/maestro.ts', 'test', flow, '--platform=android'],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: {
          ...process.env,
          MAESTRO_BIN: fakeMaestro,
          MAESTRO_CAPTURE_ARGS: capturedArgs,
          MAESTRO_CAPTURE_ENV: capturedEnvironment,
        },
      },
    );

    expect(result.status).toBe(1);
    expect(existsSync(capturedArgs)).toBe(false);
  });

  it('rejects remote flows through the Android wrapper before Maestro starts', () => {
    const flow = '.maestro/ios/flows/auth/password-reset-remote-code.yaml';
    const result = spawnSync(
      'bun',
      ['.maestro/scripts/android.ts', flow, '--device', 'Pixel_8_API_35'],
      {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        env: {
          ...process.env,
          MAESTRO_BIN: fakeMaestro,
          MAESTRO_CAPTURE_ARGS: capturedArgs,
          MAESTRO_CAPTURE_ENV: capturedEnvironment,
        },
      },
    );

    expect(result.status).toBe(1);
    expect(existsSync(capturedArgs)).toBe(false);
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
