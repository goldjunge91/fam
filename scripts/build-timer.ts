#!/usr/bin/env bun

// Phase 0 von docs/native-fingerprint-fastpath-plan.html: eine Hülle um einen
// beliebigen Build-Befehl, die Dauer + Kontext nach .build-metrics/builds.jsonl
// schreibt. Kein Ersatz für scripts/native-build.ts — misst nur, was ohnehin
// läuft. Ohne Baseline-Messdaten ist jede spätere Cache-/Compile-Optimierung
// eine unbelegte Behauptung (siehe Plan, Abschnitt PHASE 0).
//
// Nutzung:
//   bun scripts/build-timer.ts --class C --target ios-development-simulator -- \
//     bun run native:rebuild -- --target ios-development-simulator --approve-rebuild
//
// Optionale Flags:
//   --cache-hit          markiert den Lauf als Cache-Hit (Klasse B)
//   --fingerprint <hash> Fingerprint-Hash zum Zeitpunkt des Laufs (sonst aus native-build-lock.json gelesen)

import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type BuildClass = 'A' | 'B' | "B'" | 'C';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const METRICS_DIR = join(PROJECT_ROOT, '.build-metrics');
const METRICS_PATH = join(METRICS_DIR, 'builds.jsonl');
const LOCK_PATH = join(PROJECT_ROOT, 'native-build-lock.json');

function fail(message: string): never {
  console.error(`\nbuild-timer: ${message}`);
  process.exit(1);
}

function parseArgs(argv: string[]): {
  buildClass: BuildClass;
  target: string;
  cacheHit: boolean;
  fingerprint: string | undefined;
  command: string[];
} {
  const separatorIndex = argv.indexOf('--');
  if (separatorIndex === -1) {
    fail(`Kein Befehl angegeben. Erwartet: build-timer.ts <flags> -- <befehl...>`);
  }
  const flags = argv.slice(0, separatorIndex);
  const command = argv.slice(separatorIndex + 1);
  if (command.length === 0) fail(`Befehl nach '--' ist leer.`);

  const classIndex = flags.indexOf('--class');
  const buildClass = classIndex === -1 ? undefined : (flags[classIndex + 1] as BuildClass);
  if (!buildClass || !['A', 'B', "B'", 'C'].includes(buildClass)) {
    fail(`--class muss A, B, B' oder C sein.`);
  }

  const targetIndex = flags.indexOf('--target');
  const target = targetIndex === -1 ? undefined : flags[targetIndex + 1];
  if (!target) fail(`--target fehlt.`);

  const fingerprintIndex = flags.indexOf('--fingerprint');
  const fingerprint = fingerprintIndex === -1 ? undefined : flags[fingerprintIndex + 1];

  return { buildClass, target, cacheHit: flags.includes('--cache-hit'), fingerprint, command };
}

function currentFingerprint(target: string, explicit: string | undefined): string | undefined {
  if (explicit) return explicit;
  if (!existsSync(LOCK_PATH)) return undefined;
  try {
    const lock = JSON.parse(readFileSync(LOCK_PATH, 'utf8')) as {
      nativeFingerprints?: Record<string, { hash?: string }>;
    };
    const platform = target.startsWith('ios') ? 'ios' : 'android';
    return lock.nativeFingerprints?.[platform]?.hash;
  } catch {
    return undefined;
  }
}

function gitSha(): string {
  const result = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout.trim() : 'unknown';
}

function ccacheStats(): { hits: number; misses: number } | undefined {
  const result = spawnSync('ccache', ['-s', '--verbose'], { encoding: 'utf8' });
  if (result.status !== 0) return undefined;
  const hits = result.stdout.match(/Hits:\s+(\d+)/)?.[1];
  const misses = result.stdout.match(/Misses:\s+(\d+)/)?.[1];
  if (!hits || !misses) return undefined;
  return { hits: Number(hits), misses: Number(misses) };
}

async function main(): Promise<void> {
  const { buildClass, target, cacheHit, fingerprint, command } = parseArgs(process.argv.slice(2));

  const ccacheBefore = ccacheStats();
  const startedAt = new Date();
  const startMs = performance.now();

  const [program, ...programArgs] = command;
  const result = spawnSync(program, programArgs, {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    env: process.env,
  });

  const totalMs = Math.round(performance.now() - startMs);
  const ccacheAfter = ccacheStats();
  const ccacheDelta =
    ccacheBefore && ccacheAfter
      ? {
          hits: ccacheAfter.hits - ccacheBefore.hits,
          misses: ccacheAfter.misses - ccacheBefore.misses,
        }
      : undefined;

  mkdirSync(METRICS_DIR, { recursive: true });
  const row = {
    ts: startedAt.toISOString(),
    target,
    class: buildClass,
    fingerprint: currentFingerprint(target, fingerprint) ?? null,
    cacheHit,
    // Phasenaufteilung (prebuild/podInstall/compile/install) ist noch nicht
    // verdrahtet — dafür müsste native-build.ts selbst Zeitstempel je Schritt
    // schreiben. Bis dahin steht hier nur die Gesamtdauer.
    phases: {},
    totalMs,
    ccache: ccacheDelta ?? null,
    gitSha: gitSha(),
    machine: process.env.HOSTNAME ?? process.platform,
    exitCode: result.status,
  };
  appendFileSync(METRICS_PATH, `${JSON.stringify(row)}\n`);
  console.log(`build-timer: ${totalMs}ms → ${METRICS_PATH.replace(`${PROJECT_ROOT}/`, '')}`);

  if (result.status !== 0) process.exit(result.status ?? 1);
}

await main();
