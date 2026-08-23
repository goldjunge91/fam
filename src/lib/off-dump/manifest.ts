export type DumpManifestAsset = { url: string; size: number; sha256: string };

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
    typeof asset.sha256 === 'string'
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

/** Gibt bei Netzwerk- oder Validierungsfehlern `null` zurueck. */
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
