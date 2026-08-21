#!/usr/bin/env bun
/**
 * build-android-apk.ts — Standalone Android Release APK Build Script.
 *
 *   bun run android:apk                        Standard: Zählt versionCode automatisch hoch,
 *                                              baut Release-APK & speichert sie in dist/
 *   bun run android:apk --no-bump              Kein Hochzählen der Build-Nummer (versionCode)
 *   bun run android:apk --version-code 10      Spezifischen versionCode setzen
 *   bun run android:apk --app-version 1.1.0    App-Version anpassen
 *   bun run android:apk --install              APK nach dem Bauen direkt via adb installieren
 */

import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '..');
process.chdir(projectRoot);

const appJsonPath = path.join(projectRoot, 'app.json');
const envPath = path.join(projectRoot, '.env');

function log(msg: string) {
  console.log(`\n\x1b[1;34m==>\x1b[0m \x1b[1m${msg}\x1b[0m`);
}

function ok(msg: string) {
  console.log(`\x1b[1;32m==> OK: ${msg}\x1b[0m`);
}

function die(msg: string): never {
  console.error(`\n\x1b[1;31mFehler:\x1b[0m ${msg}`);
  process.exit(1);
}

// ------------------------------------------------------------- 1. Argument Parsing
const args = process.argv.slice(2);
let bumpVersionCode = true;
let explicitVersionCode: number | null = null;
let explicitAppVersion: string | null = null;
let autoInstall = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--no-bump') {
    bumpVersionCode = false;
  } else if (arg === '--version-code') {
    explicitVersionCode = parseInt(args[++i], 10);
    bumpVersionCode = false;
  } else if (arg === '--app-version') {
    explicitAppVersion = args[++i];
  } else if (arg === '--install' || arg === '-i') {
    autoInstall = true;
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Verwendung:
  bun run android:apk [Optionen]

Optionen:
  --no-bump              versionCode nicht erhöhen
  --version-code <num>   Spezifischen versionCode setzen
  --app-version <str>    Spezifische Versionsnummer setzen (z. B. 1.2.0)
  --install, -i          Nach dem Build direkt per adb auf angeschlossenem Gerät installieren
  --help, -h             Diese Hilfe anzeigen
`);
    process.exit(0);
  }
}

// ------------------------------------------------------------- 2. .env Validierung
log('Prüfe Umgebungsvariablen in .env für Android Release...');
if (!fs.existsSync(envPath)) {
  die(`.env-Datei nicht gefunden unter ${envPath}`);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env: Record<string, string> = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx !== -1) {
    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
}

if (!env.EXPO_PUBLIC_SUPABASE_URL || !env.EXPO_PUBLIC_SUPABASE_KEY) {
  die('EXPO_PUBLIC_SUPABASE_URL oder EXPO_PUBLIC_SUPABASE_KEY fehlt in .env!');
}

ok('Umgebungsvariablen sind gültig.');

// ------------------------------------------------------------- 3. Version Management (app.json)
if (!fs.existsSync(appJsonPath)) {
  die(`app.json nicht gefunden unter ${appJsonPath}`);
}

const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const currentAppVersion = appJson.expo.version || '1.0.0';
const currentVersionCode = appJson.expo.android?.versionCode || 1;

const newAppVersion = explicitAppVersion || currentAppVersion;
let newVersionCode = currentVersionCode;

if (explicitVersionCode !== null) {
  newVersionCode = explicitVersionCode;
} else if (bumpVersionCode) {
  newVersionCode = currentVersionCode + 1;
}

log(
  `App-Version: ${newAppVersion} | Android versionCode: ${newVersionCode} (vorher: ${currentAppVersion} / ${currentVersionCode})`,
);

appJson.expo.version = newAppVersion;
appJson.expo.android = appJson.expo.android || {};
appJson.expo.android.versionCode = newVersionCode;

fs.writeFileSync(appJsonPath, `${JSON.stringify(appJson, null, 2)}\n`);
ok('app.json erfolgreich aktualisiert.');

// ------------------------------------------------------------- 4. Gradle Release Build
log('Starte Gradle Release Build (assembleRelease)...');
const startTime = Date.now();

const isWindows = process.platform === 'win32';
const gradlewCmd = isWindows ? path.join('android', 'gradlew.bat') : './gradlew';
const cwd = isWindows ? projectRoot : path.join(projectRoot, 'android');
const cmdArgs = isWindows
  ? ['-p', 'android', 'assembleRelease', '-x', 'lint', '-x', 'lintVitalRelease', '-x', 'lintVitalAnalyzeRelease']
  : ['assembleRelease', '-x', 'lint', '-x', 'lintVitalRelease', '-x', 'lintVitalAnalyzeRelease'];

const buildResult = spawnSync(gradlewCmd, cmdArgs, {
  cwd,
  stdio: 'inherit',
  env: {
    ...process.env,
    ...env,
  },
});

if (buildResult.status !== 0) {
  die('Gradle assembleRelease fehlgeschlagen!');
}

const durationSec = Math.round((Date.now() - startTime) / 1000);
ok(
  `Gradle Build erfolgreich abgeschlossen in ${Math.floor(durationSec / 60)}m ${durationSec % 60}s`,
);

// ------------------------------------------------------------- 5. APK-Datei lokalisieren & kopieren
const rawApkPath = path.join(
  projectRoot,
  'android',
  'app',
  'build',
  'outputs',
  'apk',
  'release',
  'app-release.apk',
);
if (!fs.existsSync(rawApkPath)) {
  die(`Erwartete APK-Datei wurde nicht gefunden unter: ${rawApkPath}`);
}

const distDir = path.join(projectRoot, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const targetApkName = `fam-v${newAppVersion}-b${newVersionCode}-release.apk`;
const targetApkPath = path.join(distDir, targetApkName);

fs.copyFileSync(rawApkPath, targetApkPath);
const stats = fs.statSync(targetApkPath);
const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

ok(`APK erfolgreich nach dist/ kopiert: ${targetApkName} (${sizeMB} MB)`);

// ------------------------------------------------------------- 6. Optional: adb Install
if (autoInstall) {
  log('Versuche APK auf verbundenem Android-Gerät zu installieren (adb install)...');
  try {
    execSync(`adb install -r "${targetApkPath}"`, { stdio: 'inherit' });
    ok('App erfolgreich auf Gerät installiert!');
  } catch {
    console.warn(
      '\x1b[33mWarnung: adb install fehlgeschlagen. Ist ein Android-Gerät mit aktiviertem USB-Debugging angeschlossen?\x1b[0m',
    );
  }
}

// ------------------------------------------------------------- 7. Zusammenfassung
console.log(
  '\n\x1b[1;32m═══════════════════════════════════════════════════════════════════════\x1b[0m',
);
console.log(
  `\x1b[1;32m  🎉 ANDROID RELEASE BUILD ERFOLGREICH: fam ${newAppVersion} (${newVersionCode})\x1b[0m`,
);
console.log(`  Größe:      ${sizeMB} MB`);
console.log(`  APK-Pfad:   ${targetApkPath}`);
console.log('\n  Installation auf Android-Hardware:');
console.log(`  • Per USB:   adb install -r "${targetApkPath}"`);
console.log('  • Oder:      Datei einfach per USB/Messenger/Drive aufs Handy laden und antippen.');
console.log(
  '\x1b[1;32m═══════════════════════════════════════════════════════════════════════\x1b[0m\n',
);
