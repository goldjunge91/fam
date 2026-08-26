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
  /** MD5-Prüfsumme, nativ berechnet — nie den vollständigen Dateiinhalt in den JS-Heap laden. */
  checksum(path: string): Promise<string>;

  inspectDump(path: string): Promise<DumpInspection | null>;
};
