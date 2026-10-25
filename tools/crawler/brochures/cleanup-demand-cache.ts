#!/usr/bin/env bun

import {
  deleteR2Object,
  listR2Objects,
  loadR2Config,
  type R2Config,
} from './r2-storage';
import type { StorageAsset } from './storage-policy';

const DEMAND_CACHE_PREFIX = 'brochures/demand/';

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Select only demand-cache objects whose encoded expiry day has passed. */
export function expiredDemandCacheAssets(
  assets: readonly StorageAsset[],
  today: string,
): StorageAsset[] {
  if (!isIsoDate(today)) throw new Error('The cleanup date must be a UTC calendar date.');

  return assets.filter((asset) => {
    if (!asset.key.startsWith(DEMAND_CACHE_PREFIX)) return false;
    const expiresOn = asset.key.slice(DEMAND_CACHE_PREFIX.length, DEMAND_CACHE_PREFIX.length + 10);
    const nextCharacter = asset.key[DEMAND_CACHE_PREFIX.length + 10];
    return isIsoDate(expiresOn) && nextCharacter === '/' && expiresOn < today;
  });
}

export async function cleanupDemandCache(options: {
  config?: R2Config | null;
  now?: Date;
  list?: typeof listR2Objects;
  remove?: typeof deleteR2Object;
} = {}): Promise<number> {
  const config = options.config === undefined ? loadR2Config() : options.config;
  if (!config) {
    console.log('R2 demand-cache cleanup skipped: storage credentials are not configured.');
    return 0;
  }

  const today = (options.now ?? new Date()).toISOString().slice(0, 10);
  const assets = await (options.list ?? listR2Objects)(config, DEMAND_CACHE_PREFIX);
  const expired = expiredDemandCacheAssets(assets, today);
  for (const asset of expired) {
    await (options.remove ?? deleteR2Object)(config, asset.key);
  }
  console.log(`R2 demand-cache cleanup deleted ${expired.length} expired objects.`);
  return expired.length;
}

if (process.argv[1]?.endsWith('cleanup-demand-cache.ts')) {
  cleanupDemandCache().catch((error: unknown) => {
    console.error(`R2 demand-cache cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
