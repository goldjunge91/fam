import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';

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
