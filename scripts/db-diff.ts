import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const schemaRoot = 'supabase/schemas';
const migrationRoot = 'supabase/migrations';

function sqlFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? sqlFiles(path)
      : entry.isFile() && path.endsWith('.sql')
        ? [path]
        : [];
  });
}

export function idempotentDeclaredExtensions(
  migration: string,
  declaredExtensions: ReadonlySet<string>,
): string {
  return migration.replace(
    /^(\s*CREATE\s+EXTENSION\s+)(?!IF\s+NOT\s+EXISTS\b)("([^"]+)"|([\w$]+))/gimu,
    (
      statement,
      prefix: string,
      extension: string,
      quotedName: string | undefined,
      bareName: string | undefined,
    ) => {
      const extensionName = quotedName ?? bareName;
      if (!extensionName) return statement;
      const name = extensionName.toLowerCase();
      return declaredExtensions.has(name) ? `${prefix}IF NOT EXISTS ${extension}` : statement;
    },
  );
}

const sourceExtensions = new Set(
  sqlFiles(schemaRoot).flatMap((path) =>
    Array.from(
      readFileSync(path, 'utf8').matchAll(
        /CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+(?:"([^"]+)"|([\w$]+))/gimu,
      ),
      (match) => (match[1] ?? match[2]).toLowerCase(),
    ),
  ),
);

export function runDeclarativeDiff(): void {
  const diff = spawnSync('supabase', ['db', 'schema', 'declarative', 'sync', '--no-apply'], {
    stdio: 'inherit',
  });

  if (diff.error) throw diff.error;
  if (diff.status !== 0) process.exit(diff.status ?? 1);

  for (const path of sqlFiles(migrationRoot)) {
    const original = readFileSync(path, 'utf8');
    const normalized = idempotentDeclaredExtensions(original, sourceExtensions);
    if (normalized !== original) writeFileSync(path, normalized);
  }
}

if (import.meta.main) runDeclarativeDiff();
