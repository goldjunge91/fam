/**
 * Manifest-Vertrag des rollierenden `off-dump-current`-Release (#223 Paket
 * 6, Abschnitt 13/14 in docs/issue#223_V2.md). Spiegelt bewusst
 * `DumpManifest` aus `scripts/dump_data/dump-manifest-core.ts` — dieselbe
 * Grenze wie zwischen den Deno-Edge-Functions und dem App-Client: kein
 * Import über die Laufzeitgrenze (Bun-CLI-Skript vs. React-Native-App),
 * stattdessen ein kleiner, eigenständig gepflegter Typ für den reinen
 * Wire-Format-Vertrag.
 */

export type DumpManifestAsset = { url: string; size: number; checksum: string };

export type DumpManifestPatchEntry = DumpManifestAsset & {
  from: string;
  to: string;
  upserts: number;
  deletes: number;
};

export type DumpManifest = {
  schemaVersion: number;
  latestVersion: string;
  baseline: DumpManifestAsset & { version: string };
  patches: DumpManifestPatchEntry[];
};

function isDumpManifestAsset(value: unknown): value is DumpManifestAsset {
  if (!value || typeof value !== 'object') return false;
  const asset = value as Record<string, unknown>;
  return (
    typeof asset.url === 'string' &&
    typeof asset.size === 'number' &&
    typeof asset.checksum === 'string'
  );
}

function isDumpManifestPatchEntry(value: unknown): value is DumpManifestPatchEntry {
  if (!isDumpManifestAsset(value)) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.from === 'string' &&
    typeof entry.to === 'string' &&
    typeof entry.upserts === 'number' &&
    typeof entry.deletes === 'number'
  );
}

/**
 * Validiert die grobe Form eines rohen JSON-Werts als `DumpManifest`. Reine
 * Funktion, unabhängig von `fetch()` testbar — dasselbe Muster wie
 * `parseOffResponse()` in der Edge Function.
 */
export function parseManifest(raw: unknown): DumpManifest | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;

  if (typeof value.schemaVersion !== 'number') return null;
  if (typeof value.latestVersion !== 'string') return null;
  if (
    !isDumpManifestAsset(value.baseline) ||
    typeof (value.baseline as { version?: unknown }).version !== 'string'
  ) {
    return null;
  }
  if (!Array.isArray(value.patches) || !value.patches.every(isDumpManifestPatchEntry)) return null;

  return value as unknown as DumpManifest;
}

/** Lädt und validiert das Manifest. `null` bei jedem Fehler — kein Wurf. */
export async function fetchManifest(
  url: string,
  signal?: AbortSignal,
): Promise<DumpManifest | null> {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    return parseManifest(await res.json());
  } catch {
    return null;
  }
}
