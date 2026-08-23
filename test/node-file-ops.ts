import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import type { DumpInspection, FileOps } from '@/lib/off-dump/file-ops';

/**
 * Erfüllt den `FileOps`-Port mit `node:fs`/`node:sqlite` — für Tests. Echte
 * Dateioperationen, kein Mock, dasselbe Verhältnis wie `node-sqlite-adapter.ts`
 * zu `expo-sqlite`.
 *
 * `download()` liest hier bewusst von einer lokalen Quelldatei statt einen
 * echten HTTP-Request zu machen — der Baseline-Installer selbst kennt keine
 * URLs, nur Pfade/`FileOps`; welche URL zu welcher lokalen Testdatei "lädt",
 * legt der jeweilige Test über `registerDownloadSource()` fest.
 */
export function createNodeFileOps(): FileOps & {
  registerDownloadSource(url: string, localPath: string): void;
} {
  const downloadSources = new Map<string, string>();

  return {
    registerDownloadSource(url: string, localPath: string) {
      downloadSources.set(url, localPath);
    },

    async exists(path: string): Promise<boolean> {
      return existsSync(path);
    },

    async size(path: string): Promise<number> {
      return statSync(path).size;
    },

    async download(url: string, destPath: string): Promise<void> {
      const source = downloadSources.get(url);
      if (!source) throw new Error(`Keine registrierte Download-Quelle für ${url}`);
      copyFileSync(source, destPath);
    },

    async move(fromPath: string, toPath: string): Promise<void> {
      renameSync(fromPath, toPath);
    },

    async delete(path: string): Promise<void> {
      if (existsSync(path)) unlinkSync(path);
    },

    async sha256(path: string): Promise<string> {
      return createHash('sha256').update(readFileSync(path)).digest('hex');
    },

    async inspectDump(path: string): Promise<DumpInspection | null> {
      if (!existsSync(path)) return null;
      try {
        const db = new DatabaseSync(path, { readOnly: true });
        try {
          const meta = db
            .prepare('select schema_version, data_version from dump_meta limit 1')
            .get() as { schema_version: number; data_version: string } | undefined;
          if (!meta) return null;

          const check = db.prepare('PRAGMA quick_check').get() as Record<string, string> | undefined;
          const integrityOk = check !== undefined && Object.values(check).some((v) => v === 'ok');

          return { schemaVersion: meta.schema_version, dataVersion: meta.data_version, integrityOk };
        } finally {
          db.close();
        }
      } catch {
        return null;
      }
    },
  };
}
