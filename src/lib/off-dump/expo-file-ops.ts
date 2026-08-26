/**
 * Erfüllt den `FileOps`-Port mit `expo-file-system` — die echte App.
 * Gegenstück zu `test/node-file-ops.ts`.
 *
 * `checksum()` nutzt `expo-file-system`s natives `File.info({ md5: true })`
 * statt `expo-crypto`s `Crypto.digest()` — Letzteres laedt den gesamten
 * Dateiinhalt als Bytes in den JS-Heap, was bei einer ~90 MB grossen
 * Baseline-Datei zu spuerbarem UI-Einfrieren oder OOM fuehren kann (#242).
 * Die native `File.info()`-Berechnung laeuft ausserhalb des JS-Heaps.
 *
 * `inspectDump()` öffnet KEINE zweite `expo-sqlite`-Verbindung (die Regel
 * "nur client.ts benutzt expo-sqlite" bleibt unangetastet) — stattdessen
 * ein temporäres `ATTACH DATABASE ... AS off_dump_inspect` auf der
 * übergebenen `SqlDatabase`, unter einem eigenen Alias (nicht `off_dump`,
 * damit ein Aufruf während off_dump bereits angehängt ist nicht
 * kollidiert). `PRAGMA <schema>.quick_check` ist gültiges SQLite-Syntax,
 * gegen `node:sqlite` verifiziert.
 *
 * ACHTUNG: Native Module (`expo-file-system`) laufen nicht unter Jest —
 * dieses Modul ist absichtlich ungetestet hier, die Verifikation muss auf
 * einem echten Dev-Build erfolgen. Die Logik, die diese Datei aufruft
 * (repository.ts etc.), ist bereits vollständig gegen die
 * `FileOps`-Schnittstelle getestet.
 */

import { File } from 'expo-file-system';

import type { SqlDatabase } from '@/lib/db/types';
import type { DumpInspection, FileOps } from './file-ops';
import { attachPlaintextDatabase } from './plaintext-attachment';

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

    async checksum(path: string): Promise<string> {
      const { md5 } = new File(path).info({ md5: true });
      if (!md5) throw new Error(`Konnte MD5-Prüfsumme für ${path} nicht berechnen.`);
      return md5;
    },

    async inspectDump(path: string): Promise<DumpInspection | null> {
      if (!new File(path).exists) return null;

      // Eindeutiger Alias pro Aufruf statt eines festen Namens: `serialize.ts`
      // sperrt jeden execAsync/getFirstAsync-Call einzeln, nicht die ganze
      // ATTACH-...-DETACH-Folge als Einheit (ATTACH/DETACH sind in SQLite
      // ausserhalb einer Transaktion nicht atomar buendelbar). Ueberlappen
      // sich zwei inspectDump()-Aufrufe (z. B. Status-Refresh im Entwickler-
      // Bereich waehrend eines Hintergrund-Update-Checks), wuerde ein fester
      // Alias-Name im zweiten Aufruf mit "already in use" scheitern — und der
      // Fehler wird hier als false-negatives "Dump ist beschaedigt" sichtbar,
      // obwohl die Datei intakt ist.
      const alias = `off_dump_inspect_${Math.random().toString(36).slice(2)}`;
      try {
        await attachPlaintextDatabase(db, path, alias, 'sqlcipher');
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
