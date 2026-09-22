#!/usr/bin/env bun

// Phase 0 von docs/native-fingerprint-fastpath-plan.html: eine Hülle um einen
// beliebigen Build-Befehl, die Dauer + Kontext nach .build-metrics/builds.jsonl
// schreibt. scripts/native-build/native-build.ts verwendet denselben Timer direkt, damit
// Wrapper- und Native-Builds dieselbe Messung liefern.
//
// Nutzung:
//   bun scripts/native-build/build-timer.ts --class C --target ios-development-simulator -- \
//     bun run native:rebuild -- --target ios-development-simulator --approve-rebuild
//
// Optionale Flags:
//   --cache-hit          markiert den Lauf als Cache-Hit (Klasse B)
//   --fingerprint <hash> Fingerprint-Hash zum Zeitpunkt des Laufs (sonst aus native-build-lock.json gelesen)

import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type BuildClass = 'A' | 'B' | "B'" | 'C';

export type BuildTimerOptions = {
  buildClass: BuildClass;
  target: string;
  cacheHit?: boolean;
  fingerprint?: string;
};

export type BuildTimer = {
  phase<T>(name: string, work: () => T | Promise<T>): Promise<T>;
  finish(exitCode: number | null): void;
};

export function formatBuildDuration(totalMs: number): string {
  if (totalMs < 1000) return `${totalMs}ms`;

  const totalSeconds = Math.round(totalMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

const SCRIPT_DIRECTORY = import.meta.url
  ? dirname(fileURLToPath(import.meta.url))
  : join(process.cwd(), 'scripts/native-build');
const PROJECT_ROOT = resolve(SCRIPT_DIRECTORY, '../..');
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
  try {
    const result = spawnSync('ccache', ['-s', '--verbose'], { encoding: 'utf8' });
    if (result.status !== 0) return undefined;
    const output = result.stdout ?? '';
    const hits = output.match(/Hits:\s+(\d+)/)?.[1];
    const misses = output.match(/Misses:\s+(\d+)/)?.[1];
    if (!hits || !misses) return undefined;
    return { hits: Number(hits), misses: Number(misses) };
  } catch {
    return undefined;
  }
}

export function createBuildTimer({
  buildClass,
  target,
  cacheHit,
  fingerprint,
}: BuildTimerOptions): BuildTimer {
  const ccacheBefore = ccacheStats();
  const startedAt = new Date();
  const startMs = performance.now();
  const phases: Record<string, number> = {};
  let finished = false;

  return {
    async phase<T>(name: string, work: () => T | Promise<T>): Promise<T> {
      const phaseStartMs = performance.now();
      try {
        return await work();
      } finally {
        const duration = Math.round(performance.now() - phaseStartMs);
        phases[name] = (phases[name] ?? 0) + duration;
      }
    },

    finish(exitCode) {
      if (finished) return;
      finished = true;

      const totalMs = Math.round(performance.now() - startMs);
      const ccacheAfter = ccacheStats();
      const ccacheDelta =
        ccacheBefore && ccacheAfter
          ? {
              hits: ccacheAfter.hits - ccacheBefore.hits,
              misses: ccacheAfter.misses - ccacheBefore.misses,
            }
          : undefined;

      const row = {
        ts: startedAt.toISOString(),
        target,
        class: buildClass,
        fingerprint: currentFingerprint(target, fingerprint) ?? null,
        cacheHit: cacheHit ?? null,
        phases,
        totalMs,
        ccache: ccacheDelta ?? null,
        gitSha: gitSha(),
        machine: process.env.HOSTNAME ?? process.platform,
        exitCode,
      };

      let metricsWritten = false;
      try {
        mkdirSync(METRICS_DIR, { recursive: true });
        appendFileSync(METRICS_PATH, `${JSON.stringify(row)}\n`);
        metricsWritten = true;
      } catch (error) {
        console.error(
          `build-timer: Metrik konnte nicht geschrieben werden: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      const metricsPath = METRICS_PATH.replace(`${PROJECT_ROOT}/`, '');
      console.log(
        `build-timer: ${target} ${formatBuildDuration(totalMs)} (${totalMs}ms)${metricsWritten ? ` → ${metricsPath}` : ''}`,
      );
    },
  };
}

async function main(): Promise<void> {
  const { buildClass, target, cacheHit, fingerprint, command } = parseArgs(process.argv.slice(2));
  const timer = createBuildTimer({ buildClass, target, cacheHit, fingerprint });

  const [program, ...programArgs] = command;
  let result: ReturnType<typeof spawnSync>;
  try {
    result = spawnSync(program, programArgs, {
      cwd: PROJECT_ROOT,
      stdio: 'inherit',
      env: process.env,
    });
  } catch (error) {
    console.error(`build-timer: Befehl konnte nicht gestartet werden: ${String(error)}`);
    timer.finish(1);
    process.exitCode = 1;
    return;
  }

  const exitCode = result.status ?? 1;
  timer.finish(exitCode);
  if (exitCode !== 0) process.exitCode = exitCode;
}

if (import.meta.main) void main();
