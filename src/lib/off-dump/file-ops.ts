/**
 * Dateisystem-Port für den Baseline-Installer (#223 Paket 6) — dasselbe
 * Prinzip wie `SqlDatabase` in `@/lib/db/types`: `expo-file-system` ist ein
 * natives Modul und läuft weder unter `jest-expo` noch im Node-Setup der
 * Integrationstests. In der App erfüllt `expo-file-system` den Port, im
 * Test `node:fs` — echte Dateioperationen, kein Mock.
 */
export type DumpInspection = {
  schemaVersion: number;
  dataVersion: string;
  /** Ergebnis von `PRAGMA quick_check` auf dieser Datei, unabhängig geöffnet. */
  integrityOk: boolean;
};

export type FileOps = {
  exists(path: string): Promise<boolean>;
  size(path: string): Promise<number>;
  download(url: string, destPath: string): Promise<void>;
  /** Atomare Umbenennung innerhalb desselben Dateisystems. */
  move(fromPath: string, toPath: string): Promise<void>;
  delete(path: string): Promise<void>;
  sha256(path: string): Promise<string>;
  /**
   * Öffnet die Datei GETRENNT von der App-Hauptverbindung (kein ATTACH),
   * liest `dump_meta` und führt `PRAGMA quick_check` aus. `null`, wenn die
   * Datei nicht existiert oder gar keine gültige SQLite-Datenbank ist.
   */
  inspectDump(path: string): Promise<DumpInspection | null>;
};
