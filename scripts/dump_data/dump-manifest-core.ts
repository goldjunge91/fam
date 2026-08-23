/** Reine Aufbaulogik fuer das Release-Manifest der Dump-Delta-Pipeline. */

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

/** Schneidet beim ersten Lauf und beim Monatswechsel eine neue Baseline. */
export function isNewBaselineDue(
  previousBaselineVersion: string | null,
  currentDataVersion: string,
): boolean {
  if (!previousBaselineVersion) return true;
  return previousBaselineVersion.slice(0, 7) !== currentDataVersion.slice(0, 7);
}

/** Beginnt bei einer neuen Baseline eine frische Patchkette. */
export function buildNextManifest(params: {
  previous: DumpManifest | null;
  isNewBaseline: boolean;
  schemaVersion: number;
  dataVersion: string;
  baselineAsset: DumpManifestAsset;
  patchEntry: DumpManifestPatchEntry | null;
}): DumpManifest {
  const { previous, isNewBaseline, schemaVersion, dataVersion, baselineAsset, patchEntry } = params;

  if (isNewBaseline) {
    return {
      schemaVersion,
      latestVersion: dataVersion,
      baseline: { version: dataVersion, ...baselineAsset },
      patches: [],
    };
  }

  if (!previous || !patchEntry) {
    throw new Error(
      'buildNextManifest: ein regulärer Patch-Lauf braucht sowohl ein vorheriges Manifest ' +
        '(als Basis für Baseline + bestehende Kette) als auch einen patchEntry.',
    );
  }

  return {
    schemaVersion,
    latestVersion: patchEntry.to,
    baseline: previous.baseline,
    patches: [...previous.patches, patchEntry],
  };
}
