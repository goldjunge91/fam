import type { DumpManifest, DumpManifestPatchEntry } from './manifest';

export type LocalDumpState = {
  schemaVersion: number | null;
  dataVersion: string | null;
  integrityOk: boolean;
};

export type BaselineReason =
  | 'no_local_dump'
  | 'schema_mismatch'
  | 'corrupted'
  | 'local_version_too_old'
  | 'incomplete_patch_chain'
  | 'patch_size_exceeds_threshold';

export type UpdatePlan =
  | { kind: 'up-to-date' }
  | { kind: 'baseline'; reason: BaselineReason }
  | { kind: 'patch'; patches: DumpManifestPatchEntry[] };

const DEFAULT_PATCH_SIZE_THRESHOLD = 0.7;

/** Gibt bei einer lueckenhaften Patchkette `null` zurueck. */
function findPatchChain(
  fromVersion: string,
  manifest: DumpManifest,
): DumpManifestPatchEntry[] | null {
  const chain: DumpManifestPatchEntry[] = [];
  const remaining = [...manifest.patches];
  let current = fromVersion;

  while (current !== manifest.latestVersion) {
    const index = remaining.findIndex((patch) => patch.from === current);
    if (index === -1) return null;
    const [patch] = remaining.splice(index, 1);
    chain.push(patch);
    current = patch.to;
  }

  return chain;
}

export function planUpdate(
  local: LocalDumpState,
  manifest: DumpManifest,
  options: { patchSizeThreshold?: number } = {},
): UpdatePlan {
  const threshold = options.patchSizeThreshold ?? DEFAULT_PATCH_SIZE_THRESHOLD;

  if (local.schemaVersion === null || local.dataVersion === null) {
    return { kind: 'baseline', reason: 'no_local_dump' };
  }
  if (local.schemaVersion !== manifest.schemaVersion) {
    return { kind: 'baseline', reason: 'schema_mismatch' };
  }
  if (!local.integrityOk) {
    return { kind: 'baseline', reason: 'corrupted' };
  }
  if (local.dataVersion === manifest.latestVersion) {
    return { kind: 'up-to-date' };
  }
  // ISO-8601-Versionen sortieren lexikografisch korrekt chronologisch.
  if (local.dataVersion < manifest.baseline.version) {
    return { kind: 'baseline', reason: 'local_version_too_old' };
  }

  const chain = findPatchChain(local.dataVersion, manifest);
  if (!chain) {
    return { kind: 'baseline', reason: 'incomplete_patch_chain' };
  }

  const totalPatchSize = chain.reduce((sum, patch) => sum + patch.size, 0);
  if (totalPatchSize > manifest.baseline.size * threshold) {
    return { kind: 'baseline', reason: 'patch_size_exceeds_threshold' };
  }

  return { kind: 'patch', patches: chain };
}
