import { rename, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';

const targetPath = resolve('src/lib/database.types.ts');
const temporaryPath = `${targetPath}.tmp-${process.pid}`;

const processResult = Bun.spawn(['supabase', 'gen', 'types', 'typescript', '--local'], {
  cwd: process.cwd(),
  stdout: 'pipe',
  stderr: 'pipe',
});

const [stdout, stderr, exitCode] = await Promise.all([
  new Response(processResult.stdout).text(),
  new Response(processResult.stderr).text(),
  processResult.exited,
]);

if (exitCode !== 0) {
  if (stderr.trim()) process.stderr.write(stderr);
  process.exit(exitCode);
}

if (!stdout.includes('export type Database')) {
  throw new Error('Supabase hat keine gültige Database-Typdefinition zurückgegeben.');
}

try {
  await Bun.write(temporaryPath, stdout);
  await rename(temporaryPath, targetPath);
} finally {
  await unlink(temporaryPath).catch(() => undefined);
}

if (stderr.trim()) process.stderr.write(stderr);
