#!/usr/bin/env bun
/**
 * run-android.ts — Führt `expo run:android` mit Live-Logging in Konsole & Logdatei aus.
 *
 * Verwendung:
 *   bun scripts/run-android.ts --env .env.local
 *   bun scripts/run-android.ts --env .env.development.local
 *   bun scripts/run-android.ts --env .env.preview --variant release
 *   bun scripts/run-android.ts --clean
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(__dirname, '..');
process.chdir(projectRoot);

const isWindows = process.platform === 'win32';

// ------------------------------------------------------------- 1. Argument Parsing
const rawArgs = process.argv.slice(2);
let envFile = '.env.local';
let customLogFile: string | null = null;
let shouldClean = false;
const forwardArgs: string[] = [];

for (let i = 0; i < rawArgs.length; i++) {
  const arg = rawArgs[i];
  if (arg === '--env' || arg === '-e') {
    envFile = rawArgs[++i] || '.env.local';
  } else if (arg === '--log-file') {
    customLogFile = rawArgs[++i];
  } else if (arg === '--clean' || arg === '-c') {
    shouldClean = true;
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Verwendung:
  bun scripts/run-android.ts [Optionen] [-- expo-run:android Optionen]

Optionen:
  --env, -e <datei>      Zu ladende Env-Datei (Standard: .env.local)
  --clean, -c            Bereinigt native Caches (.cxx / build) vor dem Start
  --log-file <pfad>      Pfad für die Log-Datei (Standard: logs/android-run-*.log)
  --help, -h             Diese Hilfe anzeigen

Alle weiteren Argumente (z. B. --variant release, -d, --no-bundler) werden direkt an 'expo run:android' weitergereicht.
`);
    process.exit(0);
  } else {
    forwardArgs.push(arg);
  }
}

// ------------------------------------------------------------- 2. Logger Setup
function formatTimestamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape regex requires escape character
const ANSI_REGEX = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
function stripAnsi(str: string): string {
  return str.replace(ANSI_REGEX, '');
}

const logsDir = path.join(projectRoot, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFilePath = customLogFile
  ? path.resolve(projectRoot, customLogFile)
  : path.join(logsDir, `android-run-${formatTimestamp()}.log`);

const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

const logger = {
  log(msg: string) {
    console.log(msg);
    logStream.write(`${stripAnsi(msg)}\n`);
  },
  info(msg: string) {
    console.log(`\n\x1b[1;34m==>\x1b[0m \x1b[1m${msg}\x1b[0m`);
    logStream.write(`\n==> ${stripAnsi(msg)}\n`);
  },
  ok(msg: string) {
    console.log(`\x1b[1;32m==> OK: ${msg}\x1b[0m`);
    logStream.write(`==> OK: ${stripAnsi(msg)}\n`);
  },
  warn(msg: string) {
    console.warn(`\x1b[1;33m==> WARNUNG: ${msg}\x1b[0m`);
    logStream.write(`==> WARNUNG: ${stripAnsi(msg)}\n`);
  },
  error(msg: string) {
    console.error(`\n\x1b[1;31mFehler:\x1b[0m ${msg}`);
    logStream.write(`\nFehler: ${stripAnsi(msg)}\n`);
  },
  writeRaw(chunk: Buffer | string, isStderr = false) {
    const text = chunk.toString();
    if (isStderr) {
      process.stderr.write(text);
    } else {
      process.stdout.write(text);
    }
    logStream.write(stripAnsi(text));
  },
  die(msg: string): never {
    this.error(msg);
    this.log(
      `\n📄 Detailliertes Logfile gespeichert unter:\n   file:///${logFilePath.replace(/\\/g, '/')}\n`,
    );
    logStream.end();
    process.exit(1);
  },
};

logger.log(
  `\x1b[1;36m═══════════════════════════════════════════════════════════════════════\x1b[0m`,
);
logger.log(`\x1b[1;36m  Expo Android Runner (expo run:android)\x1b[0m`);
logger.log(`  Env-Datei: ${envFile}`);
logger.log(`  Log-Datei: ${logFilePath}`);
logger.log(
  `\x1b[1;36m═══════════════════════════════════════════════════════════════════════\x1b[0m`,
);

// ------------------------------------------------------------- 3. .env laden
const fullEnvPath = path.resolve(projectRoot, envFile);
const envVars: Record<string, string> = {
  EXPO_NO_DOTENV: '1',
};

if (fs.existsSync(fullEnvPath)) {
  const envContent = fs.readFileSync(fullEnvPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      envVars[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
    }
  }
  logger.ok(`Umgebungsvariablen aus ${envFile} geladen.`);
} else {
  logger.warn(`Env-Datei ${envFile} nicht gefunden — verwende System-Umgebungsvariablen.`);
}

// ------------------------------------------------------------- 4. Cache Cleaning (Optional)
if (shouldClean) {
  logger.info('Bereinige native Android- und CMake-Caches (.cxx / build)...');
  const dirsToRemove = [
    path.join(projectRoot, 'android', 'build'),
    path.join(projectRoot, 'android', 'app', 'build'),
    path.join(projectRoot, 'android', 'app', '.cxx'),
  ];

  const nodeModulesDir = path.join(projectRoot, 'node_modules');
  if (fs.existsSync(nodeModulesDir)) {
    const scanDirs = (dir: string, depth = 0) => {
      if (depth > 3) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const fullPath = path.join(dir, entry.name);
            if (entry.name === '.cxx' || (entry.name === 'build' && dir.endsWith('android'))) {
              dirsToRemove.push(fullPath);
            } else if (!entry.name.startsWith('.') && entry.name !== 'src') {
              scanDirs(fullPath, depth + 1);
            }
          }
        }
      } catch {
        // Ignoriere Zugriffsfehler
      }
    };
    scanDirs(nodeModulesDir);
  }

  for (const dir of dirsToRemove) {
    if (fs.existsSync(dir)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
        logger.log(`  🗑️  Gelöscht: ${path.relative(projectRoot, dir)}`);
      } catch (err) {
        logger.warn(
          `  Konnte Verzeichnis nicht löschen: ${path.relative(projectRoot, dir)} (${err})`,
        );
      }
    }
  }
  logger.ok('Cache-Bereinigung abgeschlossen.');
}

// ------------------------------------------------------------- 5. expo run:android ausführen
logger.info(`Starte 'expo run:android ${forwardArgs.join(' ')}'...`);

const expoCmd = isWindows ? 'npx.cmd' : 'npx';
const expoArgs = ['expo', 'run:android', ...forwardArgs];

const child = spawn(expoCmd, expoArgs, {
  cwd: projectRoot,
  env: {
    ...process.env,
    ...envVars,
  },
  shell: isWindows,
  stdio: ['pipe', 'pipe', 'pipe'],
});

// Stdin weiterleiten für interaktive Befehle (z. B. 'r' für Reload)
if (process.stdin.isTTY) {
  process.stdin.pipe(child.stdin);
}

child.stdout?.on('data', (chunk) => {
  logger.writeRaw(chunk, false);
});

child.stderr?.on('data', (chunk) => {
  logger.writeRaw(chunk, true);
});

child.on('error', (err) => {
  logger.die(`Fehler beim Starten von expo run:android: ${err.message}`);
});

child.on('close', (code) => {
  if (code !== 0) {
    logger.die(`'expo run:android' mit Exit-Code ${code} fehlgeschlagen!`);
  } else {
    logger.ok('expo run:android erfolgreich beendet.');
    logger.log(`📄 Log-Datei gespeichert unter:\n   file:///${logFilePath.replace(/\\/g, '/')}\n`);
    logStream.end();
    process.exit(0);
  }
});
