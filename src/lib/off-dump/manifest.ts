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
 * Uebergangs-Kompatibilitaet zu Commit 106c18a: Das Manifest-Asset-Feld hiess
 * dort bis heute `sha256`, wurde dann auf `checksum` umbenannt. Bereits
 * veroeffentlichte Releases (der `update_dump.yml`-Workflow laeuft nur
 * taeglich/on demand) tragen bis zum naechsten Lauf noch den alten Namen —
 * ohne diesen Fallback lehnt `isDumpManifestAsset()` sie komplett ab.
 * TODO entfernen, sobald ein frisches Manifest mit `checksum` veroeffentlicht
 * ist (naechster `update_dump.yml`-Lauf oder `gh workflow run update_dump.yml`).
 */
function withChecksumFallback(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const asset = value as Record<string, unknown>;
  if (typeof asset.checksum === 'string') return asset;
  if (typeof asset.sha256 === 'string') return { ...asset, checksum: asset.sha256 };
  return asset;
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

  const baseline = withChecksumFallback(value.baseline);
  if (
    !isDumpManifestAsset(baseline) ||
    typeof (baseline as { version?: unknown }).version !== 'string'
  ) {
    return null;
  }

  if (!Array.isArray(value.patches)) return null;
  const patches = value.patches.map(withChecksumFallback);
  if (!patches.every(isDumpManifestPatchEntry)) return null;

  return { ...value, baseline, patches } as unknown as DumpManifest;
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
