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
import { type BuildClass, type BuildTimer, createBuildTimer } from './build-timer';
import { createEasLocalBuildEnvironment } from './native-build-eas-env';
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

export type NativeBuildPreparationInput = {
  platform: NativePlatform;
  nativeProjectExists: boolean;
  baselineFingerprint: string | undefined;
  currentFingerprint: string | undefined;
  podsAreSynchronized: boolean;
};

export type NativeBuildPreparation = {
  needsPrebuild: boolean;
  needsPodInstall: boolean;
};

export function determineNativeBuildPreparation({
  platform,
  nativeProjectExists,
  baselineFingerprint,
  currentFingerprint,
  podsAreSynchronized,
}: NativeBuildPreparationInput): NativeBuildPreparation {
  const needsPrebuild =
    !nativeProjectExists ||
    !baselineFingerprint ||
    !currentFingerprint ||
    baselineFingerprint !== currentFingerprint;

  return {
    needsPrebuild,
    // A native config update does not automatically mean that CocoaPods
    // changed. The Podfile/lock pair is checked again after prebuild below.
    needsPodInstall: platform === 'ios' && !podsAreSynchronized,
  };
}

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
  nativeFingerprints: Partial<Record<Platform, NativeFingerprint>>;
  artifacts: Partial<Record<TargetName, ArtifactLock>>;
};

const SCRIPT_DIRECTORY = import.meta.url
  ? dirname(fileURLToPath(import.meta.url))
  : join(process.cwd(), 'scripts/native-build');
const PROJECT_ROOT = resolve(SCRIPT_DIRECTORY, '../..');
const LOCK_PATH = join(PROJECT_ROOT, 'native-build-lock.json');
// Der ios-build-workflow-runner (.codex/hooks) exportiert diese Variable und
// verbietet lokale lastFallbacks: alle Build-Artefakte MÜSSEN unter
// /Volumes/Programme liegen. Ohne diesen Override landete das fertige IPA
// projekt-lokal (PROJECT_ROOT/native-artifacts), während runner.sh und
// native-testflight-fastpath.sh stur unter $STORAGE_ROOT/native-artifacts
// nachsahen — das Artefakt war für sie *nie* auffindbar, jeder
// '!ios-build-testflight'-Lauf endete nach dem vollen Rebuild mit
// 'New artifact is missing or empty'.
const ARTIFACT_ROOT =
  process.env.IOS_BUILD_WORKFLOW_ARTIFACT_ROOT ?? join(PROJECT_ROOT, 'native-artifacts');
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
let activeBuildTimer: BuildTimer | undefined;

class NativeBuildError extends Error {}

function fail(message: string): never {
  throw new NativeBuildError(message);
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

async function timedPhase<T>(name: string, work: () => T | Promise<T>): Promise<T> {
  if (!activeBuildTimer) return work();
  return activeBuildTimer.phase(name, work);
}

function buildTimerForCommand(): BuildTimer | undefined {
  if (!['dev', 'rebuild', 'restore', 'run'].includes(command ?? '')) return undefined;

  let buildClass: BuildClass;
  switch (command) {
    case 'dev':
      buildClass = parseFlag('--no-build-cache') ? 'C' : "B'";
      break;
    case 'restore':
    case 'run':
      buildClass = 'B';
      break;
    default:
      buildClass = parseFlag('--approve-rebuild') ? 'C' : "B'";
  }

  return createBuildTimer({
    buildClass,
    target: parseValue('--target') ?? command ?? 'unknown',
  });
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
  if (result.error) {
    fail(`${program} konnte nicht gestartet werden: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const reason = result.signal
      ? `Signal ${result.signal}`
      : `Exit-Code ${result.status ?? 'unbekannt'}`;
    fail(`${program} ${commandArgs.join(' ')} ist fehlgeschlagen (${reason}).`);
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

function availableNativePlatforms(): readonly Platform[] {
  return nativePlatformsForHost().filter((platform) => existsSync(join(PROJECT_ROOT, platform)));
}

function iosPodsAreSynchronized(): boolean {
  const podsDirectory = join(PROJECT_ROOT, 'ios', 'Pods');
  const podfileLock = join(PROJECT_ROOT, 'ios', 'Podfile.lock');
  const manifestLock = join(podsDirectory, 'Manifest.lock');
  if (!existsSync(podsDirectory) || !existsSync(podfileLock) || !existsSync(manifestLock)) {
    return false;
  }
  return readFileSync(podfileLock, 'utf8') === readFileSync(manifestLock, 'utf8');
}

function iosPodInputs(): string {
  const hash = createHash('sha256');
  for (const path of ['ios/Podfile', 'ios/Podfile.properties.json', 'bun.lock']) {
    hash.update(path);
    const fullPath = join(PROJECT_ROOT, path);
    if (existsSync(fullPath)) hash.update(readFileSync(fullPath));
    else hash.update('missing');
  }

  const packageJson = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  hash.update(
    JSON.stringify({
      dependencies: packageJson.dependencies ?? {},
      devDependencies: packageJson.devDependencies ?? {},
    }),
  );
  return hash.digest('hex');
}

async function inspectNativeBuildPreparation(
  target: Target,
  lock: NativeBuildLock | undefined,
): Promise<NativeBuildPreparation> {
  const nativeProjectExists = existsSync(join(PROJECT_ROOT, target.platform));
  const baselineFingerprint = lock?.nativeFingerprints[target.platform]?.hash;
  const currentFingerprint =
    nativeProjectExists && baselineFingerprint
      ? (await fingerprint(target.platform)).hash
      : undefined;

  return determineNativeBuildPreparation({
    platform: target.platform,
    nativeProjectExists,
    baselineFingerprint,
    currentFingerprint,
    podsAreSynchronized: target.platform === 'ios' ? iosPodsAreSynchronized() : true,
  });
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
  const hostPlatforms = nativePlatformsForHost();
  const platforms = availableNativePlatforms();
  for (const platform of hostPlatforms) {
    if (!platforms.includes(platform)) {
      console.warn(`  Baselineprüfung übersprungen: ${platform}/ ist nicht ausgecheckt.`);
    }
  }
  if (platforms.length === 0) {
    fail('Kein natives Projekt ausgecheckt. Mindestens ios/ oder android/ wird benötigt.');
  }
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
  const platforms = nativePlatformsForHost();
  assertNativeDirectories(platforms);
  const fingerprints = await Promise.all(
    platforms.map(async (platform) => [platform, await fingerprintFull(platform)] as const),
  );

  const lock: NativeBuildLock = existsSync(LOCK_PATH)
    ? readLock()
    : { schemaVersion: 1, nativeFingerprints: {}, artifacts: {} };
  for (const [platform, full] of fingerprints) {
    saveFingerprintSnapshot(platform, full);
    lock.nativeFingerprints[platform] = { hash: full.hash, expoSdk: getExpoSdk() };
  }

  writeLock(lock);
  log(
    `Native Baseline gespeichert (${platforms.join(', ')}): ${relative(PROJECT_ROOT, LOCK_PATH)}`,
  );
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
function iosBuildEnv(includeHarnessUI: boolean): Record<string, string> {
  return {
    USE_CCACHE: '1',
    FAM_HARNESS_UI: includeHarnessUI ? '1' : '0',
  };
}

// 'eas build --local' kopiert das Projekt bei JEDEM Lauf in ein neues Temp-
// Verzeichnis mit zufälliger UUID. EAS_LOCAL_BUILD_WORKINGDIR erzwingt
// stattdessen einen festen Pfad, damit absolute Build-Pfade zwischen Läufen
// stabil bleiben und ccache wiederverwendbar ist. Der EAS-Plugin-Runner
// verlangt allerdings, dass dieser Arbeitsordner beim Start leer ist. Wir
// löschen deshalb nur den alten Arbeitsinhalt, nicht den benachbarten ccache.
function easLocalBuildEnv(): Record<string, string> {
  const { workingDir, environment } = createEasLocalBuildEnvironment({
    configuredWorkingDir: process.env.EAS_LOCAL_BUILD_WORKINGDIR,
    ccacheDir: readCcacheDirFromUserConfig(),
    projectRoot: PROJECT_ROOT,
  });
  rmSync(workingDir, { force: true, recursive: true });
  mkdirSync(workingDir, { recursive: true });
  log(`EAS-Local-Workingdir: ${workingDir}`);
  log('EAS-Local-Diagnostik: Cleanup bleibt nach Fehlern erhalten.');
  return environment;
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

/**
 * Release-Builds ziehen ihre statischen Tokens aus der Profil-Env-Datei. Ohne
 * sie bricht der Bundling-Schritt erst nach Minuten ab (z. B. posthog-cli).
 */
function loadReleaseEnv(profile: string): Record<string, string> {
  const fileName = profile === 'production' ? '.env.production' : '.env.preview';
  const envPath = join(PROJECT_ROOT, fileName);
  if (!existsSync(envPath)) {
    fail(`Env-Datei fehlt: ${fileName}. Release-Build abgebrochen.`);
  }

  const values: Record<string, string> = {};
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    values[trimmed.slice(0, separator).trim()] = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^(['"])(.*)\1$/u, '$2');
  }

  const missing = [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_KEY',
    'EXPO_PUBLIC_REVENUECAT_IOS_API_KEY',
    'POSTHOG_CLI_API_KEY',
    'POSTHOG_CLI_PROJECT_ID',
    'POSTHOG_CLI_HOST',
  ].filter((name) => !values[name]);
  if (missing.length > 0) {
    fail(`${fileName}: buildkritische Variablen fehlen: ${missing.join(', ')}`);
  }

  if (!values.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY.startsWith('appl_')) {
    fail(`${fileName}: EXPO_PUBLIC_REVENUECAT_IOS_API_KEY muss mit 'appl_' beginnen.`);
  }
  if (['true', '1'].includes((values.EXPO_PUBLIC_FORCE_PREMIUM ?? '').toLowerCase())) {
    fail(`${fileName}: EXPO_PUBLIC_FORCE_PREMIUM muss im Release-Build aus sein.`);
  }

  log(`Umgebungsvariablen aus ${fileName} geprüft und geladen.`);
  return values;
}

async function rebuild(): Promise<void> {
  const [targetName, target] = getTarget();
  const existingLock = existsSync(LOCK_PATH) ? readLock() : undefined;
  const preparation = await inspectNativeBuildPreparation(target, existingLock);
  const approvedNativeRebuild = parseFlag('--approve-rebuild');

  if (preparation.needsPrebuild && !approvedNativeRebuild) {
    fail(
      `Native Eingaben haben sich geändert oder ${target.platform}/ fehlt. ` +
        `Für das einmalige Prebuild '--approve-rebuild' angeben; unveränderte Builds brauchen diese Freigabe nicht.`,
    );
  }

  const releaseEnv = target.configuration === 'Release' ? loadReleaseEnv(target.profile) : {};

  log(`Baue ${targetName} mit vorhandener Native-Konfiguration...`);
  const buildEnvironment = {
    ...releaseEnv,
    ...(target.platform === 'ios' ? iosBuildEnv(target.configuration === 'Debug') : {}),
  };

  const podInputsBefore = target.platform === 'ios' ? iosPodInputs() : undefined;
  if (preparation.needsPrebuild || approvedNativeRebuild) {
    log(
      preparation.needsPrebuild
        ? `Native-Konfiguration geändert — aktualisiere ${target.platform}/ einmalig...`
        : `Explizites Native-Prebuild für ${target.platform}/...`,
    );
    // Kein --clean: Das versionierte native Projekt und DerivedData bleiben
    // als Arbeitsgrundlage erhalten. Ein Clean-Prebuild würde bei jedem
    // freigegebenen Drift unnötig den lokalen Inner Loop zerlegen.
    await timedPhase('prebuild', () =>
      run(
        'bunx',
        ['expo', 'prebuild', '--platform', target.platform, '--no-install'],
        buildEnvironment,
      ),
    );
  } else {
    log(`Native-Konfiguration unverändert — prebuild übersprungen.`);
  }

  if (target.platform === 'ios') {
    const podInputsChanged = podInputsBefore !== iosPodInputs();
    const needsPodInstall = !iosPodsAreSynchronized() || podInputsChanged;
    if (needsPodInstall) {
      // EAS installiert in seinem isolierten Arbeitsordner erneut. Der lokale
      // Lock bleibt trotzdem synchron, damit der nächste Lauf denselben
      // CocoaPods-Graph wiederverwenden kann.
      await timedPhase('podInstall', () =>
        run('pod', ['install'], buildEnvironment, join(PROJECT_ROOT, 'ios')),
      );
    } else {
      log('Pods unverändert — pod install übersprungen.');
    }
  }

  const localBuildEnvironment =
    target.platform === 'ios' ? { ...buildEnvironment, ...easLocalBuildEnv() } : undefined;
  const outputRoot = localBuildEnvironment?.EAS_LOCAL_BUILD_WORKINGDIR
    ? join(dirname(localBuildEnvironment.EAS_LOCAL_BUILD_WORKINGDIR), 'native-build-artifacts')
    : ARTIFACT_ROOT;
  const outputDirectory = join(outputRoot, targetName);
  mkdirSync(outputDirectory, { recursive: true });
  const buildOutput = join(
    outputDirectory,
    target.kind === 'app' ? 'eas-output.tar.gz' : `eas-output.${target.kind}`,
  );
  prepareArtifactOutput(buildOutput);

  await timedPhase('compile', () =>
    run(
      'bunx',
      [
        'eas-cli',
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
      localBuildEnvironment,
    ),
  );

  const finalPath = artifactPath(targetName, target.kind);
  await timedPhase('artifact', () => {
    if (target.kind === 'app') {
      extractSimulatorArchive(buildOutput, finalPath);
    } else {
      rmSync(finalPath, { force: true, recursive: true });
      run('cp', [buildOutput, finalPath]);
      rmSync(buildOutput, { force: true });
    }
  });

  const fingerprints = await Promise.all(
    nativePlatformsForHost().map(
      async (platform) => [platform, await fingerprintFull(platform)] as const,
    ),
  );
  const lock: NativeBuildLock = existsSync(LOCK_PATH)
    ? readLock()
    : { schemaVersion: 1, nativeFingerprints: {}, artifacts: {} };
  for (const [platform, full] of fingerprints) {
    saveFingerprintSnapshot(platform, full);
    lock.nativeFingerprints[platform] = { hash: full.hash, expoSdk: getExpoSdk() };
  }
  const builtFingerprint = lock.nativeFingerprints[target.platform];
  if (!builtFingerprint) {
    fail(`Kein Fingerprint für ${target.platform} ermittelt — Artefakt bleibt ungelockt.`);
  }
  lock.artifacts[targetName] = {
    fingerprint: builtFingerprint.hash,
    configuration: target.configuration,
    kind: target.kind,
    relativePath: relative(PROJECT_ROOT, finalPath),
    sha256: hashPath(finalPath),
  };
  writeLock(lock);
  log(`Rebuild abgeschlossen und gelockt: ${relative(PROJECT_ROOT, finalPath)}`);

  await offerSubmit(target, finalPath);
}

/**
 * Fragt nach einem Store-Build, ob das Artefakt direkt zu App Store Connect
 * soll. Ohne TTY (CI, Pipes) wird nur der Befehl ausgegeben.
 */
async function offerSubmit(target: Target, artifactPath: string): Promise<void> {
  if (target.kind !== 'ipa' || target.configuration !== 'Release') return;

  const command = `eas submit --platform ios --profile ${target.profile} --path ${artifactPath}`;
  if (!process.stdin.isTTY) {
    log(`Upload nicht angeboten (kein Terminal). Manuell: ${command}`);
    return;
  }

  const answer = prompt('Artefakt jetzt zu App Store Connect hochladen? [j/N]')
    ?.trim()
    .toLowerCase();
  if (answer !== 'j' && answer !== 'ja') {
    log(`Upload übersprungen. Später mit: ${command}`);
    return;
  }

  log('Starte eas submit...');
  await timedPhase('submit', () =>
    run('bunx', [
      'eas-cli',
      'submit',
      '--platform',
      'ios',
      '--profile',
      target.profile,
      '--path',
      artifactPath,
    ]),
  );
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

  const response = await timedPhase('download', () => fetch(archiveUrl));
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
  await timedPhase('artifact', () => {
    if (target.kind === 'app') {
      extractSimulatorArchive(downloadPath, temporaryPath);
    } else {
      run('cp', [downloadPath, temporaryPath]);
      rmSync(downloadPath, { force: true });
    }
  });

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
  await timedPhase('install', () => {
    rmSync(finalPath, { force: true, recursive: true });
    run('cp', ['-R', temporaryPath, finalPath]);
    rmSync(temporaryPath, { force: true, recursive: true });
  });
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
  assertNativeDirectories([platform]);
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
  await timedPhase('compile', () => run('bunx', commandArgs, environment));
}

// Env-Overrides nur für den Inner Loop (native:dev), niemals für rebuild()/
// den Release-Pfad — dort bleibt die volle Multi-ABI-Matrix bzw. das
// unveränderte Podfile-Verhalten maßgeblich.
function buildDevEnv(platform: Platform): Record<string, string> | undefined {
  if (platform === 'ios') return iosBuildEnv(true);
  // B6: lokal wird immer genau eine ABI gebraucht. ORG_GRADLE_PROJECT_* wird
  // von Gradle automatisch als Projekt-Property gelesen — kein Eingriff in
  // android/gradle.properties nötig, das bei einem Native-Prebuild ohnehin
  // generiert wird (B8).
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
  await timedPhase('install', () => run('bunx', commandArgs));
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
  bun run native:rebuild -- --target <target>                  # nutzt Native-Konfiguration, Ccache und EAS-Workingdir
  bun run native:rebuild -- --target <target> --approve-rebuild # erlaubt einmaliges Prebuild bei Native-Änderung

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
      if (command) fail(`Unbekannter Befehl: ${command}`);
  }
}

async function runCli(): Promise<void> {
  activeBuildTimer = buildTimerForCommand();
  let exitCode = 0;
  try {
    await main();
  } catch (error) {
    exitCode = 1;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nNative Build Lock: ${message}`);
  } finally {
    activeBuildTimer?.finish(exitCode);
    activeBuildTimer = undefined;
  }
  process.exitCode = exitCode;
}

if (import.meta.main) void runCli();
