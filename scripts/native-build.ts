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
import type { Fingerprint, FingerprintSource } from '@expo/fingerprint';
import { createFingerprintAsync, diffFingerprints } from 'expo/fingerprint';
import {
  isNativePlatformSupportedOnHost,
  type NativePlatform,
  nativePlatformsForHost,
} from './native-build-platform';

type Platform = NativePlatform;
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
// Nicht committet (siehe .gitignore) — lokaler Snapshot des vollen Fingerprints
// (alle Sources inkl. Hashes) zum Zeitpunkt der letzten Baseline. Erlaubt
// 'native:status --diff', die abweichende Quelle direkt zu benennen, statt
// nur den Gesamthash zu vergleichen (siehe docs/native-fingerprint-drift-debugging.md).
const FINGERPRINT_CACHE_DIR = join(PROJECT_ROOT, '.native-fingerprint-cache');

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

async function fingerprintFull(platform: Platform): Promise<Fingerprint> {
  return createFingerprintAsync(PROJECT_ROOT, {
    platforms: [platform],
    silent: true,
    debug: true,
  });
}

async function fingerprint(platform: Platform): Promise<NativeFingerprint> {
  const result = await fingerprintFull(platform);
  return { hash: result.hash, expoSdk: getExpoSdk() };
}

function fingerprintCachePath(platform: Platform): string {
  return join(FINGERPRINT_CACHE_DIR, `${platform}.json`);
}

function saveFingerprintSnapshot(platform: Platform, full: Fingerprint): void {
  mkdirSync(FINGERPRINT_CACHE_DIR, { recursive: true });
  writeFileSync(fingerprintCachePath(platform), `${JSON.stringify(full, null, 2)}\n`);
}

function loadFingerprintSnapshot(platform: Platform): Fingerprint | undefined {
  const path = fingerprintCachePath(platform);
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, 'utf8')) as Fingerprint;
}

// diffFingerprints() setzt sortierte Source-Arrays voraus (siehe JSDoc in
// @expo/fingerprint) — createFingerprintAsync() garantiert das nicht explizit.
function sortedSources(full: Fingerprint): Fingerprint {
  return {
    ...full,
    sources: [...full.sources].sort((a, b) => (a.hash ?? '').localeCompare(b.hash ?? '')),
  };
}

async function printFingerprintDiff(platform: Platform): Promise<void> {
  const before = loadFingerprintSnapshot(platform);
  if (!before) {
    console.warn(
      `  Kein gespeicherter Fingerprint-Snapshot für ${platform} (${relative(PROJECT_ROOT, fingerprintCachePath(platform))} fehlt). ` +
        `Diff nicht möglich — der Snapshot entsteht erst bei 'native:baseline'.`,
    );
    return;
  }
  const after = await fingerprintFull(platform);
  const diff = diffFingerprints(sortedSources(before), sortedSources(after));
  if (diff.length === 0) {
    console.warn(`  Kein Source-Diff für ${platform} gefunden (Gesamthash weicht trotzdem ab).`);
    return;
  }
  console.warn(`  Abweichende Fingerprint-Sources (${platform}):`);
  for (const item of diff) {
    if (item.op === 'added') console.warn(`    + ${describeSource(item.addedSource)}`);
    else if (item.op === 'removed') console.warn(`    - ${describeSource(item.removedSource)}`);
    else
      console.warn(
        `    ~ ${describeSource(item.afterSource)} (${item.beforeSource.hash} → ${item.afterSource.hash})`,
      );
  }
}

function describeSource(source: FingerprintSource): string {
  const path = 'filePath' in source ? source.filePath : 'id' in source ? source.id : '';
  return `${source.type}:${path}`;
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

function assertNativeDirectories(platforms: readonly Platform[] = nativePlatformsForHost()): void {
  for (const platform of platforms) {
    if (!existsSync(join(PROJECT_ROOT, platform))) {
      fail(`Native Projekt fehlt: ${platform}/. Es darf nicht automatisch erzeugt werden.`);
    }
  }
}

async function assertNativeBaseline(
  lock: NativeBuildLock,
  platforms: readonly Platform[] = nativePlatformsForHost(),
): Promise<Partial<Record<Platform, NativeFingerprint>>> {
  assertNativeDirectories(platforms);
  const current = Object.fromEntries(
    await Promise.all(
      platforms.map(async (platform) => [platform, await fingerprint(platform)] as const),
    ),
  ) as Partial<Record<Platform, NativeFingerprint>>;

  for (const platform of platforms) {
    const expected = lock.nativeFingerprints[platform];
    const actual = current[platform];
    if (!actual) fail(`Kein aktueller Fingerprint für ${platform} ermittelt.`);
    if (!expected || expected.hash !== actual.hash) {
      if (parseFlag('--diff')) await printFingerprintDiff(platform);
      fail(
        `${platform}-Fingerprint stimmt nicht mit dem Lock überein. ` +
          `Native Änderung, Config-/Dependency-Änderung oder falsche Baseline erkannt. ` +
          `Erwartet: ${expected?.hash ?? '(nicht gesetzt)'}, aktuell: ${actual.hash}. ` +
          `Rebuild nur mit '--approve-rebuild'. Genaue abweichende Quelle: 'native:status -- --diff'.`,
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
  const platforms = nativePlatformsForHost();
  const current = await assertNativeBaseline(lock, platforms);
  log('Native Baseline ist unverändert.');

  let invalidArtifacts = 0;
  for (const [targetName, targetLock] of Object.entries(lock.artifacts) as [
    TargetName,
    ArtifactLock,
  ][]) {
    if (!isNativePlatformSupportedOnHost(TARGETS[targetName].platform)) {
      console.warn(
        `  Artefaktprüfung übersprungen: ${targetName} ist auf Windows nicht verfügbar.`,
      );
      continue;
    }
    const currentFingerprint = current[TARGETS[targetName].platform];
    if (!currentFingerprint) {
      fail(`Kein aktueller Fingerprint für ${TARGETS[targetName].platform} verfügbar.`);
    }
    const artifactPath = join(PROJECT_ROOT, targetLock.relativePath);
    if (!existsSync(artifactPath)) {
      console.warn(`  Artefakt nicht lokal vorhanden: ${targetLock.relativePath}`);
      continue;
    }
    try {
      assertArtifact(targetLock, targetName, currentFingerprint.hash);
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
  const [iosFull, androidFull] = await Promise.all([
    fingerprintFull('ios'),
    fingerprintFull('android'),
  ]);
  saveFingerprintSnapshot('ios', iosFull);
  saveFingerprintSnapshot('android', androidFull);

  const lock: NativeBuildLock = {
    schemaVersion: 1,
    nativeFingerprints: {
      ios: { hash: iosFull.hash, expoSdk: getExpoSdk() },
      android: { hash: androidFull.hash, expoSdk: getExpoSdk() },
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

// ios/Podfile liest USE_CCACHE bereits (ccache_enabled?()) — B5, der Hebel war
// gebaut und nicht umgelegt. ccache selbst muss lokal installiert sein
// (/opt/homebrew/bin/ccache); ist es das nicht, ist die Env-Var wirkungslos,
// kein Fehler. Wichtig: 'pod install' schreibt CC/CXX (Ccache-Wrapper) fest in
// die generierten .xcodeproj-Dateien — USE_CCACHE muss also beim Aufruf von
// 'pod install' gesetzt sein, nicht erst beim späteren Build, sonst wirkt es
// gar nicht (verifiziert, siehe docs/native-fingerprint-drift-debugging.md).
// USE_CCACHE=1 triggert ccache_enabled?() in ios/Podfile zur 'pod install'-
// Zeit (schreibt CC/CXX aufs Pods-Project fest). Der eigentliche Cache-Pfad
// (CCACHE_DIR) wird NICHT mehr hier gesetzt — Env-Vars erreichen die
// Compile-Sources-Subprozesse von Xcode nachweislich nicht (siehe
// plugins/withIosCcacheDir.js für den echten Fix: eigenständige
// Wrapper-Skripte mit fest einprogrammiertem Pfad statt Env-Var-Vertrauen).
function iosBuildEnv(): Record<string, string> {
  return { USE_CCACHE: '1' };
}

// 'eas build --local' kopiert das Projekt bei JEDEM Lauf in ein neues Temp-
// Verzeichnis mit zufälliger UUID. EAS_LOCAL_BUILD_WORKINGDIR erzwingt
// stattdessen einen festen Pfad, damit absolute Build-Pfade zwischen Läufen
// stabil bleiben und ccache wiederverwendbar ist. Der EAS-Plugin-Runner
// verlangt allerdings, dass dieser Arbeitsordner beim Start leer ist. Wir
// löschen deshalb nur den alten Arbeitsinhalt, nicht den benachbarten ccache.
function easLocalBuildEnv(): Record<string, string> {
  const ccacheDir = readCcacheDirFromUserConfig();
  if (!ccacheDir) return {};
  const workingDir = join(dirname(ccacheDir), 'eas-build-local-workingdir');
  rmSync(workingDir, { force: true, recursive: true });
  mkdirSync(workingDir, { recursive: true });
  return { EAS_LOCAL_BUILD_WORKINGDIR: workingDir };
}

function readCcacheDirFromUserConfig(): string | undefined {
  if (process.env.CCACHE_DIR) return process.env.CCACHE_DIR;
  const configPath = join(
    process.env.XDG_CONFIG_HOME ?? join(process.env.HOME ?? '', '.config'),
    'ccache/ccache.conf',
  );
  if (!existsSync(configPath)) return undefined;
  const match = readFileSync(configPath, 'utf8').match(/^\s*cache_dir\s*=\s*(.+?)\s*$/mu);
  return match?.[1];
}

async function rebuild(): Promise<void> {
  if (!parseFlag('--approve-rebuild')) {
    fail(`Rebuild blockiert. Nur '--approve-rebuild' erlaubt Prebuild und Kompilierung.`);
  }
  const [targetName, target] = getTarget();

  log(`Regeneriere ${target.platform}/ kontrolliert für ${targetName}...`);
  // Kein EXPO_USE_PRECOMPILED_MODULES mehr setzen: der generierte Podfile
  // setzt es bereits selbst (ENV['EXPO_USE_PRECOMPILED_MODULES'] ||= '1'),
  // und seit SDK 56 ist Precompiled ohnehin default (B7, Plan Phase 3).
  run('bunx', ['expo', 'prebuild', '--clean', '--platform', target.platform, '--no-install']);

  if (target.platform === 'ios') {
    // Keep the resolved CocoaPods graph versioned. EAS installs again in its
    // isolated local build directory, but the project baseline must include
    // the same Podfile.lock before its fingerprint is recorded.
    run('pod', ['install'], iosBuildEnv(), join(PROJECT_ROOT, 'ios'));
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
    target.platform === 'ios' ? { ...iosBuildEnv(), ...easLocalBuildEnv() } : undefined,
  );

  const finalPath = artifactPath(targetName, target.kind);
  if (target.kind === 'app') {
    extractSimulatorArchive(buildOutput, finalPath);
  } else {
    rmSync(finalPath, { force: true, recursive: true });
    run('cp', [buildOutput, finalPath]);
    rmSync(buildOutput, { force: true });
  }

  const [iosFull, androidFull] = await Promise.all([
    fingerprintFull('ios'),
    fingerprintFull('android'),
  ]);
  saveFingerprintSnapshot('ios', iosFull);
  saveFingerprintSnapshot('android', androidFull);
  const currentFingerprints: Record<Platform, NativeFingerprint> = {
    ios: { hash: iosFull.hash, expoSdk: getExpoSdk() },
    android: { hash: androidFull.hash, expoSdk: getExpoSdk() },
  };
  const lock: NativeBuildLock = existsSync(LOCK_PATH)
    ? readLock()
    : { schemaVersion: 1, nativeFingerprints: currentFingerprints, artifacts: {} };
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
  if (!isNativePlatformSupportedOnHost(target.platform)) {
    fail(
      `Das iOS-Artefakt ${targetName} kann nur auf macOS geprüft oder wiederhergestellt werden.`,
    );
  }
  const lock = readLock();
  const current = await assertNativeBaseline(lock, [target.platform]);
  const currentFingerprint = current[target.platform];
  if (!currentFingerprint) fail(`Kein aktueller Fingerprint für ${target.platform} ermittelt.`);
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

  const expectedFingerprint = artifactLock?.fingerprint ?? currentFingerprint.hash;
  if (expectedFingerprint !== currentFingerprint.hash) {
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
  assertArtifact(lock.artifacts[targetName], targetName, currentFingerprint.hash);
  log(`Artefakt wiederhergestellt: ${relative(PROJECT_ROOT, finalPath)}`);
}

// Development-Targets laufen über den Inner-Loop-Pfad (native:dev), alles
// andere bleibt bei eas build --local — reproduzierbar, isoliert, signiert
// (Plan Phase 2, "Zwei Pfade sauber trennen").
const DEV_TARGETS: readonly TargetName[] = [
  'ios-development-simulator',
  'ios-development-device',
  'android-development',
];

async function warnOnBaselineMismatch(platform: Platform): Promise<void> {
  assertNativeDirectories();
  if (!existsSync(LOCK_PATH)) {
    console.warn(
      'Native Build Lock: keine Baseline vorhanden — native:dev läuft trotzdem (Inner Loop blockiert nicht).',
    );
    return;
  }
  const expected = readLock().nativeFingerprints[platform];
  const current = await fingerprint(platform);
  if (!expected || expected.hash !== current.hash) {
    console.warn(
      `Native Build Lock: ${platform}-Fingerprint weicht von der Baseline ab (Inner Loop, keine Blockade). ` +
        `Erwartet: ${expected?.hash ?? '(nicht gesetzt)'}, aktuell: ${current.hash}. ` +
        `Baseline danach mit 'bun run native:baseline -- --approve-rebuild' aktualisieren; Quelle finden mit 'bun run native:status -- --diff'.`,
    );
  }
}

async function runDev(): Promise<void> {
  const [targetName, target] = getTarget();
  if (!DEV_TARGETS.includes(targetName)) {
    fail(
      `native:dev ist nur für Development-Targets gedacht: ${DEV_TARGETS.join(', ')}. ` +
        `Für Release-/Preview-Targets 'native:rebuild' nutzen.`,
    );
  }
  await warnOnBaselineMismatch(target.platform);

  const device = parseValue('--device');
  // Bewusst kein 'prebuild --clean' und kein bedingungsloses 'pod install'
  // davor (das war B3: eas build --local erzwingt bei jedem Lauf Klasse C).
  // expo run:* nutzt DerivedData/Gradle inkrementell weiter und ist der
  // einzige lokale Pfad, der den bereits konfigurierten EAS-Build-Cache-
  // Provider überhaupt bedient (siehe Plan, Befund B2/B3, Phase 2).
  const commandArgs =
    target.platform === 'ios' ? ['expo', 'run:ios', '--scheme', 'fam'] : ['expo', 'run:android'];
  if (device) commandArgs.push('--device', device);
  // ACHTUNG (per Quellcode verifiziert, @expo/cli/src/run/ios/runIosAsync.ts):
  // '--no-build-cache' löscht nur lokales DerivedData vor dem Xcode-Build —
  // es umgeht NICHT den Remote-Cache-Lookup (resolveBuildCache() wird
  // unabhängig vom Flag aufgerufen, sobald 'buildCacheProvider' in app.json
  // gesetzt ist). Für eine echte Klasse-C-Messung (kein Cache-Treffer) bleibt
  // nur, 'buildCacheProvider' in app.json temporär zu entfernen oder den
  // Fingerprint tatsächlich zu ändern. Der Flag ist trotzdem nützlich, um
  // lokales DerivedData gezielt zu leeren, ohne die Baseline anzufassen.
  if (parseFlag('--no-build-cache')) {
    if (target.platform !== 'ios') fail(`--no-build-cache ist nur für iOS-Targets verfügbar.`);
    commandArgs.push('--no-build-cache');
  }

  const environment = buildDevEnv(target.platform);
  run('bunx', commandArgs, environment);
}

// Env-Overrides nur für den Inner Loop (native:dev), niemals für rebuild()/
// den Release-Pfad — dort bleibt die volle Multi-ABI-Matrix bzw. das
// unveränderte Podfile-Verhalten maßgeblich.
function buildDevEnv(platform: Platform): Record<string, string> | undefined {
  if (platform === 'ios') return iosBuildEnv();
  // B6: lokal wird immer genau eine ABI gebraucht. ORG_GRADLE_PROJECT_* wird
  // von Gradle automatisch als Projekt-Property gelesen — kein Eingriff in
  // android/gradle.properties nötig, das bei jedem 'prebuild --clean' ohnehin
  // neu generiert wird (B8).
  return { ORG_GRADLE_PROJECT_reactNativeArchitectures: 'arm64-v8a' };
}

async function runLocked(): Promise<void> {
  const [targetName, target] = getTarget();
  if (!isNativePlatformSupportedOnHost(target.platform)) {
    fail(`Das iOS-Artefakt ${targetName} kann nur auf macOS geprüft oder gestartet werden.`);
  }
  const lock = readLock();
  const current = await assertNativeBaseline(lock, [target.platform]);
  const currentFingerprint = current[target.platform];
  if (!currentFingerprint) fail(`Kein aktueller Fingerprint für ${target.platform} ermittelt.`);
  const artifactLock = lock.artifacts[targetName];
  if (!artifactLock) {
    fail(`Kein Artefakt für ${targetName} registriert. Kein automatischer Rebuild.`);
  }
  const binaryPath = assertArtifact(artifactLock, targetName, currentFingerprint.hash);
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
  bun run native:status -- --diff        # bei Mismatch die abweichende Fingerprint-Quelle anzeigen
  bun run native:baseline -- --approve-rebuild
  bun run native:dev -- --target <dev-target> [--device <name>] [--no-build-cache]   # Inner Loop, expo run:*, Lock blockiert nicht
                                                                                       # --no-build-cache leert nur lokales DerivedData, umgeht NICHT den Remote-Cache
  bun run native:run -- --target <target> [--device <name>]       # gesperrtes Artefakt installieren
  bun run native:restore -- --target <target> [--eas-build-id <id>]
  bun run native:rebuild -- --target <target> --approve-rebuild   # eas build --local, Release-Pfad

Targets: ${Object.keys(TARGETS).join(', ')}
Dev-Targets (native:dev): ${DEV_TARGETS.join(', ')}
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
    case 'dev':
      await runDev();
      break;
    default:
      printHelp();
      process.exit(command ? 1 : 0);
  }
}

await main();
