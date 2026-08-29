import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { imageKeyFor } from './r2-storage';
import {
  loadLocalStorageConfig,
  mirrorBrochureImagesToLocal,
} from './local-storage';
import type { CrawlerBrochure } from './types';

describe('lokale Crawler-Bildablage', () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    jest.restoreAllMocks();
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) =>
        rm(directory, { recursive: true, force: true }),
      ),
    );
  });

  it('speichert optimierte Assets und behält ohne Public-URL die Original-URLs', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fam-crawler-local-'));
    temporaryDirectories.push(directory);
    const sourceUrl = 'https://cdn.example.com/cover.jpg';
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
    const brochure: CrawlerBrochure = {
      id: 'brochure-1',
      storeId: 'store',
      title: 'Prospekt',
      validFrom: '2026-08-25T00:00:00Z',
      validUntil: '2026-09-01T00:00:00Z',
      coverImage: sourceUrl,
      pages: [],
    };

    const result = await mirrorBrochureImagesToLocal(
      brochure,
      loadLocalStorageConfig(directory),
      new Map(),
    );

    const storedPath = join(directory, imageKeyFor(sourceUrl));
    await expect(readFile(storedPath)).resolves.toEqual(Buffer.from([1, 2, 3]));
    expect(result.coverImage).toBe(sourceUrl);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ersetzt URLs, wenn ein lokaler HTTP-Public-URL konfiguriert ist', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fam-crawler-local-'));
    temporaryDirectories.push(directory);
    const sourceUrl = 'https://cdn.example.com/page.jpg';
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(new Uint8Array([4, 5, 6])));
    const brochure: CrawlerBrochure = {
      id: 'brochure-2',
      storeId: 'store',
      title: 'Prospekt',
      validFrom: '2026-08-25T00:00:00Z',
      validUntil: '2026-09-01T00:00:00Z',
      coverImage: '',
      pages: [{ number: 1, imageUrl: sourceUrl, hotspots: [] }],
    };

    const result = await mirrorBrochureImagesToLocal(
      brochure,
      loadLocalStorageConfig(directory, 'http://192.168.1.10:8765/'),
      new Map(),
    );

    expect(result.pages[0].imageUrl).toBe(
      `http://192.168.1.10:8765/${imageKeyFor(sourceUrl)}`,
    );
  });
});
