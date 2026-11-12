export const OFF_DUMP_ABORT_MESSAGE = 'OFF-Dump-Vorgang wurde angehalten.';

export function createOffDumpAbortError(): Error {
  const error = new Error(OFF_DUMP_ABORT_MESSAGE);
  error.name = 'AbortError';
  return error;
}

export function throwIfOffDumpAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw createOffDumpAbortError();
}

export function isOffDumpAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export type DumpInspection = {
  schemaVersion: number;
  dataVersion: string;
  /** Ergebnis von `PRAGMA quick_check` auf dieser Datei, unabhängig geöffnet. */
  integrityOk: boolean;
};

export type FileOps = {
  exists(path: string): Promise<boolean>;
  size(path: string): Promise<number>;
  download(url: string, destPath: string, signal?: AbortSignal): Promise<void>;
  /** Atomare Umbenennung innerhalb desselben Dateisystems. */
  move(fromPath: string, toPath: string): Promise<void>;
  delete(path: string): Promise<void>;
  /** MD5-Prüfsumme, nativ berechnet — nie den vollständigen Dateiinhalt in den JS-Heap laden. */
  checksum(path: string): Promise<string>;

  inspectDump(path: string): Promise<DumpInspection | null>;
};
