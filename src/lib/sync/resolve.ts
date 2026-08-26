export type SyncSide = {
  /** Primaerschluessel. Bei local und remote derselben Zeile identisch. */
  id: string;
  /** epoch ms, bereits normalisiert (siehe `toEpochMs` in cursor.ts). */
  updatedAt: number;
  /** epoch ms oder null. `null` heisst lebendig, eine Zahl heisst Tombstone. */
  deletedAt: number | null;
};

export type ResolveOptions = {
  clockCeiling: number;
};

export type Resolution = 'local' | 'remote';

export function resolve(local: SyncSide, remote: SyncSide, options: ResolveOptions): Resolution {
  const localDeleted = local.deletedAt !== null;
  const remoteDeleted = remote.deletedAt !== null;

  if (localDeleted !== remoteDeleted) {
    return localDeleted ? 'local' : 'remote';
  }

  const effectiveLocal = Math.min(local.updatedAt, options.clockCeiling);

  if (effectiveLocal > remote.updatedAt) return 'local';
  if (effectiveLocal < remote.updatedAt) return 'remote';

  return remote.id >= local.id ? 'remote' : 'local';
}
