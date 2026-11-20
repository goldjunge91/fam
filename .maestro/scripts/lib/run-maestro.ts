import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { parse } from 'dotenv';

const MAILOSAUR_RUNTIME_KEYS = [
  'MAILOSAUR_API_KEY',
  'MAILOSAUR_SERVER_ID',
  'MAILOSAUR_SERVER_DOMAIN',
  'MAILOSAUR_SENDER',
] as const;

function isMissingRuntimeValue(value: string | undefined): boolean {
  if (!value || value.trim() === '') return true;
  const normalized = value.trim().toLowerCase();
  return normalized === 'undefined' || normalized === 'null';
}

export function loadRemoteMailosaurEnvironment(): void {
  const envFile = process.env.MAESTRO_ENV_FILE ?? join(process.cwd(), '.env.development.local');
  if (!existsSync(envFile)) return;

  const fileEnvironment = parse(readFileSync(envFile));
  for (const key of MAILOSAUR_RUNTIME_KEYS) {
    if (!isMissingRuntimeValue(process.env[key])) continue;
    const value = fileEnvironment[key];
    if (!isMissingRuntimeValue(value)) process.env[key] = value.trim();
  }

  const apiKey = process.env.MAILOSAUR_API_KEY;
  if (!isMissingRuntimeValue(apiKey)) {
    process.env.MAESTRO_MAILOSAUR_API_KEY = apiKey.trim();
  }
}

/** Findet Maestro auch dann, wenn Buns Script-Shell ~/.maestro/bin nicht im PATH hat. */
export function runMaestro(args: readonly string[]): number {
  const userDirectory = process.env.HOME;
  const standardInstall = userDirectory ? join(userDirectory, '.maestro', 'bin', 'maestro') : null;
  const pathCandidates = (process.env.PATH ?? '')
    .split(delimiter)
    .filter(Boolean)
    .map((directory) => join(directory, 'maestro'));
  const candidates = [process.env.MAESTRO_BIN, ...pathCandidates, standardInstall];
  const executable = candidates.find((candidate) => candidate && existsSync(candidate));

  if (!executable) {
    console.error(
      'Maestro wurde nicht gefunden. Installiere es unter ~/.maestro/bin oder setze MAESTRO_BIN.',
    );
    return 127;
  }

  // Maestro schreibt Testartefakte und das Sitzungslog sonst nach ~/.maestro/tests.
  // Beide CLI-Optionen sind nötig, damit sämtliche Ausgaben im Repository bleiben.
  // Source: https://docs.maestro.dev/maestro-flows/workspace-management/test-reports-and-artifacts
  const outputDirectory = join(process.cwd(), '.agents', 'maestro');
  const maestroArgs =
    args[0] === 'test'
      ? [
          args[0],
          `--test-output-dir=${outputDirectory}`,
          `--debug-output=${outputDirectory}`,
          ...args.slice(1),
        ]
      : args;
  const result = spawnSync(executable, [...maestroArgs], { stdio: 'inherit' });
  if (result.error) {
    console.error(`Maestro konnte nicht gestartet werden: ${result.error.message}`);
    return 1;
  }

  return result.status ?? 1;
}
