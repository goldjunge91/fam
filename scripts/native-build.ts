#!/usr/bin/env bun

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFingerprintAsync } from 'expo/fingerprint';

type Platform = 'ios' | 'android';
type ArtifactKind = 'app' | 'ipa' | 'apk' | 'aab';
type TargetName = keyof typeof TARGETS;

type Target = {
  platform: Platform;
  profile: string;
  kind: ArtifactKind;
  configuration?: 'Debug' | 'Release';
};

type NativeFingerprint = {
  hash: string;
  expoSdk: string;
};

type ArtifactLock = {
  fingerprint: string;
  configuration?: 'Debug' | 'Release';
  kind: ArtifactKind;
  relativePath: string;
  sha256: string;
  easBuildId?: string;
};

type NativeBuildLock = {
  schemaVersion: 1;
  nativeFingerprints: Record<Platform, NativeFingerprint>;
  artifacts: Partial<Record<TargetName, ArtifactLock>>;
};

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCK_PATH = join(PROJECT_ROOT, 'native-build-lock.json');
const ARTIFACT_ROOT = join(PROJECT_ROOT, 'native-artifacts');

const TARGETS = {
  'ios-development-simulator': {
    platform: 'ios',
    profile: 'development',
    configuration: 'Debug',
    kind: 'app',
  },
  'ios-development-device': {
    platform: 'ios',
    profile: 'development-device',
    configuration: 'Debug',
    kind: 'ipa',
  },
  'ios-preview-simulator': {
    platform: 'ios',
    profile: 'preview-simulator',
    configuration: 'Release',
    kind: 'app',
  },
  'ios-preview-testflight': {
    platform: 'ios',
    profile: 'preview-testflight',
    configuration: 'Release',
    kind: 'ipa',
  },
  'ios-production': {
    platform: 'ios',
    profile: 'production',
    configuration: 'Release',
    kind: 'ipa',
  },
  'android-development': {
    platform: 'android',
    profile: 'development',
    kind: 'apk',
  },
  'android-preview': {
    platform: 'android',
    profile: 'preview',
    kind: 'apk',
  },
  'android-production': {
    platform: 'android',
    profile: 'production',
    kind: 'aab',
  },
} as const satisfies Record<string, Target>;

const command = process.argv[2];
const args = process.argv.slice(3);

function fail(message: string): never {
  console.error(`\nNative Build Lock: ${message}`);
  process.exit(1);
}

function log(message: string): void {
  console.log(`Native Build Lock: ${message}`);
}

function parseFlag(name: string): boolean {
  return args.includes(name);
}

function parseValue(name: string): string | undefined {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function getTarget(): [TargetName, Target] {
  const targetName = parseValue('--target') as TargetName | undefined;
  if (!targetName || !(targetName in TARGETS)) {
    fail(`Bitte ein gültiges --target angeben: ${Object.keys(TARGETS).join(', ')}`);
  }
  return [targetName, TARGETS[targetName]];
}

function readLock(): NativeBuildLock {
  if (!existsSync(LOCK_PATH)) {
    fail(
      `Lockdatei fehlt: ${relative(PROJECT_ROOT, LOCK_PATH)}. Einmalig 'bun run native:baseline -- --approve-rebuild' ausführen.`,
    );
  }

  const parsed = JSON.parse(readFileSync(LOCK_PATH, 'utf8')) as NativeBuildLock;
  if (parsed.schemaVersion !== 1 || !parsed.nativeFingerprints || !parsed.artifacts) {
    fail(`${relative(PROJECT_ROOT, LOCK_PATH)} hat ein unbekanntes Schema.`);
  }
  return parsed;
}

function writeLock(lock: NativeBuildLock): void {
  writeFileSync(LOCK_PATH, `${JSON.stringify(lock, null, 2)}\n`);
}

function getExpoSdk(): string {
  const packageJson = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  return packageJson.dependencies?.expo?.replace(/^[^0-9]*/u, '') ?? 'unknown';
}

async function fingerprint(platform: Platform): Promise<NativeFingerprint> {
  const result = await createFingerprintAsync(PROJECT_ROOT, {
    platforms: [platform],
    silent: true,
  });
  return { hash: result.hash, expoSdk: getExpoSdk() };
}

function hashPath(path: string): string {
  const hash = createHash('sha256');

  function visit(currentPath: string, pathPrefix: string): void {
    const stat = lstatSync(currentPath);
    if (stat.isSymbolicLink()) {
      hash.update(`link:${pathPrefix}:${readlinkSync(currentPath)}\0`);
      return;
    }
    if (stat.isDirectory()) {
      for (const child of readdirSync(currentPath).sort()) {
        visit(join(currentPath, child), `${pathPrefix}/${child}`);
      }
      return;
    }
    hash.update(`file:${pathPrefix}\0`);
    hash.update(readFileSync(currentPath));
  }

  visit(path, basename(path));
  return hash.digest('hex');
}

function artifactPath(targetName: TargetName, kind: ArtifactKind): string {
  const directory = join(ARTIFACT_ROOT, targetName);
  mkdirSync(directory, { recursive: true });
  return join(directory, kind === 'app' ? 'fam.app' : `fam.${kind}`);
}

function run(
  program: string,
  commandArgs: string[],
  environment?: Record<string, string>,
  cwd = PROJECT_ROOT,
): void {
  const result = spawnSync(program, commandArgs, {
    cwd,
    env: { ...process.env, ...environment },
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    fail(`${program} ${commandArgs.join(' ')} ist fehlgeschlagen.`);
  }
}

function runCapture(program: string, commandArgs: string[]): string {
  const result = spawnSync(program, commandArgs, {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status !== 0) {
    fail(`${program} ${commandArgs.join(' ')} ist fehlgeschlagen.`);
  }
  return result.stdout;
}

function assertNativeDirectories(): void {
  for (const platform of ['ios', 'android'] as const) {
    if (!existsSync(join(PROJECT_ROOT, platform))) {
      fail(`Native Projekt fehlt: ${platform}/. Es darf nicht automatisch erzeugt werden.`);
    }
  }
}

async function assertNativeBaseline(
  lock: NativeBuildLock,
  platforms: readonly Platform[] = ['ios', 'android'],
): Promise<Record<Platform, NativeFingerprint>> {
  assertNativeDirectories();
  const current = {
    ios: await fingerprint('ios'),
    android: await fingerprint('android'),
  };

  for (const platform of platforms) {
    const expected = lock.nativeFingerprints[platform];
    if (!expected || expected.hash !== current[platform].hash) {
      fail(
        `${platform}-Fingerprint stimmt nicht mit dem Lock überein. ` +
          `Native Änderung, Config-/Dependency-Änderung oder falsche Baseline erkannt. ` +
          `Erwartet: ${expected?.hash ?? '(nicht gesetzt)'}, aktuell: ${current[platform].hash}. ` +
          `Rebuild nur mit '--approve-rebuild'.`,
      );
    }
  }
  return current;
}

function assertArtifact(
  lock: ArtifactLock,
  targetName: TargetName,
  currentFingerprint: string,
): string {
  if (lock.fingerprint !== currentFingerprint) {
    fail(`Artefakt ${targetName} gehört zu einem anderen Fingerprint.`);
  }

  const fullPath = join(PROJECT_ROOT, lock.relativePath);
  if (!existsSync(fullPath)) {
    fail(
      `Artefakt fehlt: ${lock.relativePath}. ` +
        `Nutze 'bun run native:restore -- --target ${targetName}' oder erteile explizit einen Rebuild.`,
    );
  }

  const actualHash = hashPath(fullPath);
  if (actualHash !== lock.sha256) {
    fail(`SHA-256-Prüfung für ${lock.relativePath} fehlgeschlagen.`);
  }
  return fullPath;
}

async function status(): Promise<void> {
  const lock = readLock();
  const current = await assertNativeBaseline(lock);
  log('Native Baseline ist unverändert.');

  let invalidArtifacts = 0;
  for (const [targetName, targetLock] of Object.entries(lock.artifacts) as [
    TargetName,
    ArtifactLock,
  ][]) {
    const artifactPath = join(PROJECT_ROOT, targetLock.relativePath);
    if (!existsSync(artifactPath)) {
      console.warn(`  Artefakt nicht lokal vorhanden: ${targetLock.relativePath}`);
      continue;
    }
    try {
      assertArtifact(targetLock, targetName, current[TARGETS[targetName].platform].hash);
      log(`Artefakt gültig: ${targetName}`);
    } catch (error) {
      invalidArtifacts += 1;
      console.warn(`  ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (Object.keys(lock.artifacts).length === 0) {
    log('Noch keine Binärartefakte registriert. Die Baseline ist dennoch gültig.');
  } else if (invalidArtifacts > 0) {
    fail(`${invalidArtifacts} registrierte Artefakte sind ungültig.`);
  }
}

async function baseline(): Promise<void> {
  if (!parseFlag('--approve-rebuild')) {
    fail(`Baseline-Schreibvorgang benötigt '--approve-rebuild'.`);
  }
  assertNativeDirectories();
  const lock: NativeBuildLock = {
    schemaVersion: 1,
    nativeFingerprints: {
      ios: await fingerprint('ios'),
      android: await fingerprint('android'),
    },
    artifacts: {},
  };
  if (existsSync(LOCK_PATH)) {
    lock.artifacts = readLock().artifacts;
  }
  writeLock(lock);
  log(`Native Baseline gespeichert: ${relative(PROJECT_ROOT, LOCK_PATH)}`);
}

function prepareArtifactOutput(path: string): void {
  rmSync(path, { force: true, recursive: true });
  mkdirSync(join(path, '..'), { recursive: true });
}

function extractSimulatorArchive(archivePath: string, outputPath: string): void {
  const extractionDirectory = join(archivePath, '..', 'extracted');
  rmSync(extractionDirectory, { force: true, recursive: true });
  mkdirSync(extractionDirectory, { recursive: true });
  run('tar', ['-xzf', archivePath, '-C', extractionDirectory]);

  const appPath = findFirstNamedPath(extractionDirectory, '.app');
  if (!appPath) {
    fail(`Kein .app-Artefakt in ${archivePath} gefunden.`);
  }
  rmSync(outputPath, { force: true, recursive: true });
  run('cp', ['-R', appPath, outputPath]);
  rmSync(archivePath, { force: true });
  rmSync(extractionDirectory, { force: true, recursive: true });
}

function findFirstNamedPath(directory: string, suffix: string): string | undefined {
  for (const entry of readdirSync(directory)) {
    const current = join(directory, entry);
    if (entry.endsWith(suffix)) return current;
    if (lstatSync(current).isDirectory()) {
      const nested = findFirstNamedPath(current, suffix);
      if (nested) return nested;
    }
  }
  return undefined;
}

async function rebuild(): Promise<void> {
  if (!parseFlag('--approve-rebuild')) {
    fail(`Rebuild blockiert. Nur '--approve-rebuild' erlaubt Prebuild und Kompilierung.`);
  }
  const [targetName, target] = getTarget();

  log(`Regeneriere ${target.platform}/ kontrolliert für ${targetName}...`);
  run('bunx', ['expo', 'prebuild', '--clean', '--platform', target.platform, '--no-install'], {
    EXPO_USE_PRECOMPILED_MODULES: '1',
  });

  if (target.platform === 'ios') {
    // Keep the resolved CocoaPods graph versioned. EAS installs again in its
    // isolated local build directory, but the project baseline must include
    // the same Podfile.lock before its fingerprint is recorded.
    run('pod', ['install'], { EXPO_USE_PRECOMPILED_MODULES: '1' }, join(PROJECT_ROOT, 'ios'));
  }

  const outputDirectory = join(ARTIFACT_ROOT, targetName);
  mkdirSync(outputDirectory, { recursive: true });
  const buildOutput = join(
    outputDirectory,
    target.kind === 'app' ? 'eas-output.tar.gz' : `eas-output.${target.kind}`,
  );
  prepareArtifactOutput(buildOutput);

  run(
    'eas',
    [
      'build',
      '--local',
      '--platform',
      target.platform,
      '--profile',
      target.profile,
      '--non-interactive',
      '--output',
      buildOutput,
    ],
    { EXPO_USE_PRECOMPILED_MODULES: '1' },
  );

  const finalPath = artifactPath(targetName, target.kind);
  if (target.kind === 'app') {
    extractSimulatorArchive(buildOutput, finalPath);
  } else {
    rmSync(finalPath, { force: true, recursive: true });
    run('cp', [buildOutput, finalPath]);
    rmSync(buildOutput, { force: true });
  }

  const lock = existsSync(LOCK_PATH)
    ? readLock()
    : {
        schemaVersion: 1 as const,
        nativeFingerprints: {
          ios: await fingerprint('ios'),
          android: await fingerprint('android'),
        },
        artifacts: {},
      };
  const currentFingerprints = {
    ios: await fingerprint('ios'),
    android: await fingerprint('android'),
  };
  lock.nativeFingerprints = currentFingerprints;
  lock.artifacts[targetName] = {
    fingerprint: currentFingerprints[target.platform].hash,
    configuration: target.configuration,
    kind: target.kind,
    relativePath: relative(PROJECT_ROOT, finalPath),
    sha256: hashPath(finalPath),
  };
  writeLock(lock);
  log(`Rebuild abgeschlossen und gelockt: ${relative(PROJECT_ROOT, finalPath)}`);
}

async function restore(): Promise<void> {
  const [targetName, target] = getTarget();
  const lock = readLock();
  const current = await assertNativeBaseline(lock, [target.platform]);
  const artifactLock = lock.artifacts[targetName];
  const requestedBuildId = parseValue('--eas-build-id');
  const easBuildId = requestedBuildId ?? artifactLock?.easBuildId;
  if (!easBuildId) {
    fail(`Für ${targetName} ist keine easBuildId im Lock hinterlegt.`);
  }

  const buildJson = runCapture('eas', ['build:view', easBuildId, '--json', '--non-interactive']);
  const build = JSON.parse(buildJson) as { artifacts?: { applicationArchiveUrl?: string } };
  const archiveUrl = build.artifacts?.applicationArchiveUrl;
  if (!archiveUrl) fail(`EAS-Build ${easBuildId} enthält keine Application-URL.`);

  const response = await fetch(archiveUrl);
  if (!response.ok) fail(`Artefakt-Download fehlgeschlagen: HTTP ${response.status}.`);
  const downloadPath = join(
    ARTIFACT_ROOT,
    targetName,
    `download${extname(new URL(archiveUrl).pathname) || '.bin'}`,
  );
  mkdirSync(join(downloadPath, '..'), { recursive: true });
  writeFileSync(downloadPath, Buffer.from(await response.arrayBuffer()));

  const finalPath = artifactPath(targetName, target.kind);
  const temporaryPath = join(
    ARTIFACT_ROOT,
    targetName,
    target.kind === 'app' ? 'restore.tmp.app' : `restore.tmp.${target.kind}`,
  );
  prepareArtifactOutput(temporaryPath);
  if (target.kind === 'app') {
    extractSimulatorArchive(downloadPath, temporaryPath);
  } else {
    run('cp', [downloadPath, temporaryPath]);
    rmSync(downloadPath, { force: true });
  }

  const expectedFingerprint = artifactLock?.fingerprint ?? current[target.platform].hash;
  if (expectedFingerprint !== current[target.platform].hash) {
    rmSync(temporaryPath, { force: true, recursive: true });
    fail(`Das wiederhergestellte Artefakt gehört nicht zur aktuellen Native Baseline.`);
  }
  const restoredHash = hashPath(temporaryPath);
  if (artifactLock?.sha256 && artifactLock.sha256 !== restoredHash) {
    rmSync(temporaryPath, { force: true, recursive: true });
    fail(`SHA-256-Prüfung für das wiederhergestellte Artefakt ${targetName} fehlgeschlagen.`);
  }
  rmSync(finalPath, { force: true, recursive: true });
  run('cp', ['-R', temporaryPath, finalPath]);
  rmSync(temporaryPath, { force: true, recursive: true });
  lock.artifacts[targetName] = {
    fingerprint: expectedFingerprint,
    configuration: target.configuration,
    kind: target.kind,
    relativePath: relative(PROJECT_ROOT, finalPath),
    sha256: restoredHash,
    easBuildId,
  };
  writeLock(lock);
  assertArtifact(lock.artifacts[targetName], targetName, current[target.platform].hash);
  log(`Artefakt wiederhergestellt: ${relative(PROJECT_ROOT, finalPath)}`);
}

async function runLocked(): Promise<void> {
  const [targetName, target] = getTarget();
  const lock = readLock();
  const current = await assertNativeBaseline(lock, [target.platform]);
  const artifactLock = lock.artifacts[targetName];
  if (!artifactLock) {
    fail(`Kein Artefakt für ${targetName} registriert. Kein automatischer Rebuild.`);
  }
  const binaryPath = assertArtifact(artifactLock, targetName, current[target.platform].hash);
  const device = parseValue('--device');
  const commandArgs =
    target.platform === 'ios'
      ? ['expo', 'run:ios', '--binary', binaryPath]
      : ['expo', 'run:android', '--binary', binaryPath];
  if (device) commandArgs.push('--device', device);
  run('bunx', commandArgs);
}

function printHelp(): void {
  console.log(`
Native Build Lock

  bun run native:status
  bun run native:baseline -- --approve-rebuild
  bun run native:run -- --target <target> [--device <name>]
  bun run native:restore -- --target <target> [--eas-build-id <id>]
  bun run native:rebuild -- --target <target> --approve-rebuild

Targets: ${Object.keys(TARGETS).join(', ')}
`);
}

async function main(): Promise<void> {
  switch (command) {
    case 'status':
      await status();
      break;
    case 'baseline':
      await baseline();
      break;
    case 'restore':
      await restore();
      break;
    case 'rebuild':
      await rebuild();
      break;
    case 'run':
      await runLocked();
      break;
    default:
      printHelp();
      process.exit(command ? 1 : 0);
  }
}

await main();
