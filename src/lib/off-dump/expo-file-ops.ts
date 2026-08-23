/**
 * Erfüllt den `FileOps`-Port mit `expo-file-system`/`expo-crypto` — die
 * echte App. Gegenstück zu `test/node-file-ops.ts`.
 *
 * `inspectDump()` öffnet KEINE zweite `expo-sqlite`-Verbindung (die Regel
 * "nur client.ts benutzt expo-sqlite" bleibt unangetastet) — stattdessen
 * ein temporäres `ATTACH DATABASE ... AS off_dump_inspect` auf der
 * übergebenen `SqlDatabase`, unter einem eigenen Alias (nicht `off_dump`,
 * damit ein Aufruf während off_dump bereits angehängt ist nicht
 * kollidiert). `PRAGMA <schema>.quick_check` ist gültiges SQLite-Syntax,
 * gegen `node:sqlite` verifiziert.
 *
 * ACHTUNG: Native Module (`expo-file-system`, `expo-crypto`) laufen nicht
 * unter Jest — dieses Modul ist absichtlich ungetestet hier, die
 * Verifikation muss auf einem echten Dev-Build erfolgen. Die Logik, die
 * diese Datei aufruft (repository.ts etc.), ist bereits vollständig gegen
 * die `FileOps`-Schnittstelle getestet.
 */

import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';

import type { SqlDatabase } from '@/lib/db/types';
import type { DumpInspection, FileOps } from './file-ops';

function bufferToHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function escapePathForSql(path: string): string {
  return path.replace(/'/g, "''");
}

export function createExpoFileOps(db: SqlDatabase): FileOps {
  return {
    async exists(path: string): Promise<boolean> {
      return new File(path).exists;
    },

    async size(path: string): Promise<number> {
      return new File(path).size ?? 0;
    },

    async download(url: string, destPath: string): Promise<void> {
      await File.downloadFileAsync(url, new File(destPath), { idempotent: true });
    },

    async move(fromPath: string, toPath: string): Promise<void> {
      new File(fromPath).move(new File(toPath));
    },

    async delete(path: string): Promise<void> {
      const file = new File(path);
      if (file.exists) file.delete();
    },

    async sha256(path: string): Promise<string> {
      const bytes = await new File(path).bytes();
      const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes);
      return bufferToHex(digest);
    },

    async inspectDump(path: string): Promise<DumpInspection | null> {
      if (!new File(path).exists) return null;

      const alias = 'off_dump_inspect';
      try {
        await db.execAsync(`ATTACH DATABASE '${escapePathForSql(path)}' AS ${alias}`);
      } catch {
        return null;
      }

      try {
        const meta = await db.getFirstAsync<{ schema_version: number; data_version: string }>(
          `select schema_version, data_version from ${alias}.dump_meta limit 1`,
        );
        if (!meta) return null;

        const check = await db.getFirstAsync<Record<string, string>>(`PRAGMA ${alias}.quick_check`);
        const integrityOk = check !== null && Object.values(check).some((value) => value === 'ok');

        return { schemaVersion: meta.schema_version, dataVersion: meta.data_version, integrityOk };
      } catch {
        return null;
      } finally {
        await db.execAsync(`DETACH DATABASE ${alias}`);
      }
    },
  };
}
