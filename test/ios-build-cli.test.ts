import fs from 'node:fs';
import path from 'node:path';
import {
  artifactInfoPlistPath,
  artifactOutputPath,
  buildLogFileName,
  localEasBuildCommand,
  parseInfoPlistJson,
  parseIosBuildArgs,
  parseRemoteBuildVersion,
  remoteVersionCommand,
  resolveArtifactPath,
  testflightSubmitCommand,
} from '../scripts/ios-build/ios-build-cli';
import { IosBuildLog } from '../scripts/ios-build/ios-build-logging';

describe('ios build CLI contract', () => {
  it('maps simulator to the local EAS simulator profile', () => {
    expect(parseIosBuildArgs(['simulator'])).toEqual({
      kind: 'run',
      spec: {
        kind: 'simulator',
        buildProfile: 'development-local',
        artifactKind: 'app',
        upload: 'none',
      },
    });
  });

  it('maps TestFlight upload methods to fixed local profiles', () => {
    expect(parseIosBuildArgs(['testflight', 'eas'])).toEqual({
      kind: 'run',
      spec: {
        kind: 'testflight-eas',
        buildProfile: 'preview-testflight-local',
        submitProfile: 'preview-testflight',
        artifactKind: 'ipa',
        upload: 'eas',
      },
    });
    expect(parseIosBuildArgs(['testflight', 'xcode'])).toEqual({
      kind: 'run',
      spec: {
        kind: 'testflight-xcode',
        buildProfile: 'preview-testflight',
        artifactKind: 'xcarchive',
        upload: 'xcode',
      },
    });
  });

  it('rejects missing or unknown arguments with usage errors', () => {
    expect(() => parseIosBuildArgs([])).toThrow(/Usage/);
    expect(() => parseIosBuildArgs(['testflight'])).toThrow(/eas.*xcode/);
    expect(() => parseIosBuildArgs(['testflight', 'xcode', 'extra'])).toThrow(/Usage/);
    expect(() => parseIosBuildArgs(['unknown'])).toThrow(/simulator/);
  });

  it('returns help without selecting a build', () => {
    expect(parseIosBuildArgs(['--help'])).toEqual({ kind: 'help' });
    expect(parseIosBuildArgs(['testflight', '--help'])).toEqual({ kind: 'help' });
  });
});

describe('remote version and artifact metadata', () => {
  it('parses the EAS JSON build number', () => {
    expect(parseRemoteBuildVersion('{"buildNumber":"84"}')).toBe('84');
    expect(parseRemoteBuildVersion('{"buildNumber":85}')).toBe('85');
  });

  it('rejects missing or invalid remote build numbers', () => {
    expect(() => parseRemoteBuildVersion('{}')).toThrow(/buildNumber/);
    expect(() => parseRemoteBuildVersion('{"buildNumber":"next"}')).toThrow(/buildNumber/);
  });

  it('parses the version and bundle identifier from Info.plist JSON', () => {
    expect(
      parseInfoPlistJson(
        JSON.stringify({
          CFBundleShortVersionString: '0.0.6',
          CFBundleVersion: 84,
          CFBundleIdentifier: 'com.goldjunge91.fam1',
        }),
      ),
    ).toEqual({
      appVersion: '0.0.6',
      buildNumber: '84',
      bundleIdentifier: 'com.goldjunge91.fam1',
    });
  });

  it('rejects an artifact with a wrong bundle identifier', () => {
    expect(() =>
      parseInfoPlistJson(
        JSON.stringify({
          CFBundleShortVersionString: '0.0.6',
          CFBundleVersion: '84',
          CFBundleIdentifier: 'com.example.other',
        }),
      ),
    ).toThrow(/Bundle-ID/);
  });
});

describe('build command plans', () => {
  it('reads the remote iOS version non-interactively', () => {
    expect(remoteVersionCommand('development-local')).toEqual({
      command: 'bun',
      args: [
        'x',
        'eas-cli',
        'build:version:get',
        '--platform',
        'ios',
        '--profile',
        'development-local',
        '--json',
        '--non-interactive',
      ],
    });
  });

  it('builds the simulator locally with an explicit app output', () => {
    expect(
      localEasBuildCommand('development-local', 'build/local/eas/development-local/run/fam.app'),
    ).toEqual({
      command: 'bash',
      args: [
        'scripts/eas-ios-build.sh',
        'local',
        'development-local',
        '--output',
        'build/local/eas/development-local/run/fam.app',
        '--non-interactive',
      ],
    });
  });

  it('submits the exact local IPA instead of using latest', () => {
    expect(testflightSubmitCommand('preview-testflight', 'build/local/eas/run/fam.ipa')).toEqual({
      command: 'bun',
      args: [
        'x',
        'eas-cli',
        'submit',
        '--platform',
        'ios',
        '--profile',
        'preview-testflight',
        '--path',
        'build/local/eas/run/fam.ipa',
        '--non-interactive',
      ],
    });
  });

  it('keeps successful log names tied to date, build type, version, and number', () => {
    const date = new Date(2026, 9, 22, 14, 30, 0);

    expect(
      buildLogFileName(
        { kind: 'testflight-eas', buildProfile: 'preview-testflight-local', artifactKind: 'ipa', upload: 'eas' },
        date,
        { appVersion: '0.0.6', buildNumber: '84', bundleIdentifier: 'com.goldjunge91.fam1' },
      ),
    ).toBe('20261022-143000-testflight-eas-v0.0.6-b84.log');
  });

  it('creates unique per-run artifact paths without overwriting previous output', () => {
    expect(artifactOutputPath({ kind: 'simulator', buildProfile: 'development-local', artifactKind: 'app', upload: 'none' }, '20261022-143000-123')).toBe(
      'build/local/eas/development-local/20261022-143000-123/fam.app',
    );
    expect(artifactOutputPath({ kind: 'testflight-eas', buildProfile: 'preview-testflight-local', artifactKind: 'ipa', upload: 'eas' }, 'run')).toBe(
      'build/local/eas/preview-testflight-local/run/fam.ipa',
    );
  });
});

describe('artifact path resolution', () => {
  const testRoot = path.resolve(__dirname, '../build/test-tmp');
  let temporaryRoot: string;

  beforeEach(() => {
    fs.mkdirSync(testRoot, { recursive: true });
    temporaryRoot = fs.mkdtempSync(path.join(testRoot, 'ios-build-artifacts-'));
  });

  afterEach(() => {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  });

  it('resolves the requested simulator app directory', () => {
    const appPath = path.join(temporaryRoot, 'fam.app');
    fs.mkdirSync(appPath);

    expect(resolveArtifactPath('app', appPath, temporaryRoot)).toBe(appPath);
    expect(artifactInfoPlistPath('app', appPath)).toBe(path.join(appPath, 'Info.plist'));
  });

  it('resolves an EAS simulator archive file with an app suffix', () => {
    const appArchivePath = path.join(temporaryRoot, 'fam.app');
    fs.writeFileSync(appArchivePath, 'archive bytes');

    expect(resolveArtifactPath('app', appArchivePath, temporaryRoot)).toBe(appArchivePath);
  });

  it('resolves a single IPA from the artifact directory', () => {
    const ipaPath = path.join(temporaryRoot, 'build-123.ipa');
    fs.writeFileSync(ipaPath, 'ipa');

    expect(resolveArtifactPath('ipa', path.join(temporaryRoot, 'fam.ipa'), temporaryRoot)).toBe(
      ipaPath,
    );
  });

  it('rejects ambiguous artifact directories', () => {
    fs.mkdirSync(path.join(temporaryRoot, 'one.app'));
    fs.mkdirSync(path.join(temporaryRoot, 'two.app'));

    expect(() => resolveArtifactPath('app', path.join(temporaryRoot, 'missing.app'), temporaryRoot)).toThrow(
      /Mehrdeutige/,
    );
  });
});

describe('build logging', () => {
  const testRoot = path.resolve(__dirname, '../build/test-tmp');
  let temporaryRoot: string;

  beforeEach(() => {
    fs.mkdirSync(testRoot, { recursive: true });
    temporaryRoot = fs.mkdtempSync(path.join(testRoot, 'ios-build-log-'));
  });

  afterEach(() => {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  });

  it('renames a pending log after metadata is known and keeps live output', () => {
    const log = new IosBuildLog(
      {
        kind: 'simulator',
        buildProfile: 'development-local',
        artifactKind: 'app',
        upload: 'none',
      },
      temporaryRoot,
      new Date(2026, 9, 22, 14, 30, 0),
      'run-1',
      {
        NODE_ENV: 'test',
        EXPO_PUBLIC_API_KEY: 'do-not-write-this',
      },
    );
    const terminalOutput: string[] = [];
    const terminal = {
      write(chunk: string): boolean {
        terminalOutput.push(chunk);
        return true;
      },
    } as unknown as NodeJS.WritableStream;

    log.write('Build gestartet\n');
    log.appendChildOutput('stdout', Buffer.from('safe output\n'), terminal);
    log.appendChildOutput('stderr', Buffer.from('do-not-write-this\n'), terminal);

    const result = log.finalize({
      status: 'succeeded',
      exitCode: 0,
      durationMs: 1234,
      metadata: {
        appVersion: '0.0.6',
        buildNumber: '84',
        bundleIdentifier: 'com.goldjunge91.fam1',
      },
      artifactPath: 'build/local/fam.app',
    });
    const logText = fs.readFileSync(result.absolutePath, 'utf8');

    expect(result.relativePath).toBe(
      'logs/builds/20261022-143000-simulator-v0.0.6-b84.log',
    );
    expect(logText).toContain('Build gestartet');
    expect(logText).toContain('safe output');
    expect(logText).toContain('[REDACTED]');
    expect(logText).not.toContain('do-not-write-this');
    expect(logText).toContain('Exit-Code: 0');
    expect(logText).toContain('Dauer: 1234ms');
    expect(terminalOutput.join('')).toContain('safe output');
    expect(terminalOutput.join('')).not.toContain('do-not-write-this');
  });

  it('keeps unknown metadata in the final error log', () => {
    const log = new IosBuildLog(
      {
        kind: 'testflight-eas',
        buildProfile: 'preview-testflight-local',
        submitProfile: 'preview-testflight',
        artifactKind: 'ipa',
        upload: 'eas',
      },
      temporaryRoot,
      new Date(2026, 9, 22, 14, 30, 0),
      'run-2',
    );

    const result = log.finalize({ status: 'failed', exitCode: 75, durationMs: 500 });

    expect(result.relativePath).toBe(
      'logs/builds/20261022-143000-testflight-eas-vunknown-bunknown.log',
    );
    expect(fs.readFileSync(result.absolutePath, 'utf8')).toContain('Exit-Code: 75');
  });
});

describe('öffentliche Bun-Einstiege', () => {
  it('exponiert genau die beiden nicht-interaktiven iOS-Buildbefehle', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts['build:simulator']).toBe(
      'bun scripts/ios-build/ios-build.ts simulator',
    );
    expect(packageJson.scripts['build:testflight']).toBe(
      'bun scripts/ios-build/ios-build.ts testflight',
    );
  });
});
