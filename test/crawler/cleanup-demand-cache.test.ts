import { describe, expect, it } from '@jest/globals';
import {
  cleanupDemandCache,
  expiredDemandCacheAssets,
} from '../../tools/crawler/brochures/cleanup-demand-cache';
import type { R2Config } from '../../tools/crawler/brochures/r2-storage';
import type { StorageAsset } from '../../tools/crawler/brochures/storage-policy';

describe('expired demand-cache cleanup', () => {
  it('selects only dated demand-cache keys older than today', () => {
    const assets = [
      { key: 'brochures/demand/2026-10-23/zip-10115/edition/a.img', bytes: 100 },
      { key: 'brochures/demand/2026-10-25/zip-10115/edition/b.img', bytes: 100 },
      { key: 'brochures/demand/not-a-date/zip-10115/edition/c.img', bytes: 100 },
      { key: 'brochures/dumps/assets/legacy.jpg', bytes: 100 },
    ];

    expect(expiredDemandCacheAssets(assets, '2026-10-25').map(({ key }) => key)).toEqual([
      'brochures/demand/2026-10-23/zip-10115/edition/a.img',
    ]);
  });

  it('deletes only selected expired objects from the new demand prefix', async () => {
    const deletedKeys: string[] = [];
    const listedPrefixes: string[] = [];
    const assets: StorageAsset[] = [
      { key: 'brochures/demand/2026-10-24/logo/a.img', bytes: 100 },
      { key: 'brochures/demand/2026-10-25/logo/b.img', bytes: 100 },
      { key: 'brochures/dumps/assets/legacy.jpg', bytes: 100 },
    ];
    const config: R2Config = { accountId: 'account', accessKeyId: 'key', secretAccessKey: 'secret', bucket: 'images' };
    const list = async (_config: R2Config, prefix?: string) => {
      if (prefix) listedPrefixes.push(prefix);
      return assets;
    };
    const remove = async (_config: R2Config, key: string) => {
      deletedKeys.push(key);
    };

    const count = await cleanupDemandCache({
      config,
      now: new Date('2026-10-25T12:00:00.000Z'),
      list,
      remove,
    });

    expect(count).toBe(1);
    expect(listedPrefixes).toEqual(['brochures/demand/']);
    expect(deletedKeys).toEqual(['brochures/demand/2026-10-24/logo/a.img']);
  });

  it('does nothing when R2 credentials are unavailable', async () => {
    let listCalls = 0;
    const list = async () => {
      listCalls += 1;
      return [];
    };
    await expect(cleanupDemandCache({ config: null, list })).resolves.toBe(0);
    expect(listCalls).toBe(0);
  });
});
