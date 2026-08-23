export type SyncSide = {
  id: string;
  updatedAt: number;
  deletedAt: number | null;
};

export type ResolveOptions = {
  /** Begrenzt falsche lokale Zukunfts-Zeitstempel anhand der Serverzeit. */
  clockCeiling: number;
};

export type Resolution = 'local' | 'remote';

/** Tombstone vor Zeit, dann geklemmtes LWW; bei Gleichstand gewinnt Remote. */
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
