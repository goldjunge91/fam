import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dir, '..');
const packageJsonPath = resolve(projectRoot, 'package.json');

function fail(message: string): never {
  console.error(`Bun version check failed: ${message}`);
  process.exit(1);
}

function readPackageManager(): string {
  let manifest: unknown;

  try {
    manifest = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as unknown;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return fail(`could not read ${packageJsonPath}: ${reason}`);
  }

  if (typeof manifest !== 'object' || manifest === null || !('packageManager' in manifest)) {
    return fail(`${packageJsonPath} does not define packageManager`);
  }

  const packageManager = manifest.packageManager;
  if (typeof packageManager !== 'string') {
    return fail(`${packageJsonPath} has an invalid packageManager value`);
  }

  return packageManager;
}

const packageManager = readPackageManager();
const match = /^bun@(\d+\.\d+\.\d+)$/.exec(packageManager);
const expectedVersion = match?.[1];

if (!expectedVersion) {
  fail(`expected an exact Bun pin such as bun@1.3.14 in ${packageJsonPath}`);
}

const actualVersion = Bun.version;
const executable = process.execPath;

console.log(`Bun ${actualVersion} (${executable})`);
console.log(`Required by ${packageJsonPath}: Bun ${expectedVersion}`);

if (actualVersion === expectedVersion) {
  console.log('Bun version check passed.');
  process.exit(0);
}

console.error(
  `Detected Bun ${actualVersion}, but this repository requires Bun ${expectedVersion}.`,
);
console.error('Run the pinned version without changing the global Bun installation:');
console.error(
  `(cd "${projectRoot}" && BUN_INSTALL="$(mktemp -d)" BUN_TMPDIR="$(mktemp -d)" bunx bun@${expectedVersion} run bun:setup)`,
);
process.exit(1);
