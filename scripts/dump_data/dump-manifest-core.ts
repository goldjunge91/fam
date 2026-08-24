/**
 * Reine Aufbaulogik für das Release-Manifest der CI-Delta-Pipeline (#223
 * Paket 5, Abschnitt 13 "Release-Manifest"/"Rhythmus"). Getrennt von
 * `dump-patch-core.ts` (Produkt-Diff) und von der eigentlichen
 * Datei-/GitHub-Release-Ein-/Ausgabe (`build-canonical-update.ts`).
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

/**
 * Ob dieser Lauf eine neue Baseline schneiden soll (Abschnitt 13 "Rhythmus":
 * monatlich). Vergleicht nur den Kalendermonat (`YYYY-MM`-Präfix der
 * ISO-Version) — robust gegen unterschiedliche Tageszeiten des CI-Laufs,
 * ohne eine willkürliche Tagesanzahl zu zählen.
 */
export function isNewBaselineDue(
  previousBaselineVersion: string | null,
  currentDataVersion: string,
): boolean {
  if (!previousBaselineVersion) return true;
  return previousBaselineVersion.slice(0, 7) !== currentDataVersion.slice(0, 7);
}

/**
 * Baut das nächste Manifest aus dem vorherigen (falls vorhanden) und dem
 * Ergebnis des aktuellen CI-Laufs.
 *
 * - Neue Baseline (monatlich, Abschnitt 13 "Rhythmus"): Patchkette wird
 *   verworfen, `baseline` zeigt auf die neue Baseline-Datei.
 * - Regulärer Patch: Baseline bleibt unverändert, `patchEntry` wird ans Ende
 *   der bestehenden Kette angehängt.
 */
export function buildNextManifest(params: {
  previous: DumpManifest | null;
  isNewBaseline: boolean;
  schemaVersion: number;
  /** Erzeugte `data_version` dieses Laufs (siehe `dump_meta` in Paket 4). */
  dataVersion: string;
  baselineAsset: DumpManifestAsset;
  /** `null` bei einem neuen Baseline-Lauf — es gibt noch nichts zu patchen. */
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
