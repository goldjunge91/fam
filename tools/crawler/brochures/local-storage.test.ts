import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  ensureLocalStorageBudget,
  listLocalStorageAssets,
  loadLocalStorageConfig,
  mirrorBrochureImagesToLocal,
} from './local-storage';
import { imageKeyFor, legacyImageKeyFor } from './r2-storage';
import { StorageBudgetExceededError } from './storage-policy';
import type { CrawlerBrochure } from './types';

function testResponse(body: Uint8Array | null, status = 200): Response {
  const bytes = body ? new Uint8Array(body) : new Uint8Array();
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    arrayBuffer: async () => bytes.slice().buffer,
    text: async () => new TextDecoder().decode(bytes),
  } as unknown as Response;
}

describe('lokale Crawler-Bildablage', () => {
  const temporaryDirectories: string[] = [];

  beforeEach(() => {
    if (!AbortSignal.timeout) {
      Object.defineProperty(AbortSignal, 'timeout', {
        configurable: true,
        value: () => new AbortController().signal,
      });
    }
    Object.defineProperty(global, 'fetch', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map((directory) => rm(directory, { recursive: true, force: true })),
    );
  });

  it('speichert optimierte Assets und behält ohne Public-URL die Original-URLs', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fam-crawler-local-'));
    temporaryDirectories.push(directory);
    const sourceUrl = 'https://cdn.example.com/cover.jpg';
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(testResponse(new Uint8Array([1, 2, 3])));
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
    jest.spyOn(global, 'fetch').mockResolvedValue(testResponse(new Uint8Array([4, 5, 6])));
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

    expect(result.pages[0].imageUrl).toBe(`http://192.168.1.10:8765/${imageKeyFor(sourceUrl)}`);
  });

  it('ermittelt den rekursiven Bestand unabhängig von einem Manifest', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fam-crawler-local-'));
    temporaryDirectories.push(directory);
    await writeFile(join(directory, 'unreferenced.bin'), Buffer.alloc(2));
    await mkdir(join(directory, 'nested'));
    await writeFile(join(directory, 'nested', 'asset.bin'), Buffer.alloc(3));

    const assets = await listLocalStorageAssets(directory);

    expect(assets).toEqual(
      expect.arrayContaining([
        { key: 'unreferenced.bin', bytes: 2 },
        { key: 'nested/asset.bin', bytes: 3 },
      ]),
    );
    expect(assets).toHaveLength(2);
  });

  it('zählt vorhandene Ziel-Assets nur einmal und lädt sie auch bei kleinem Budget nicht erneut', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fam-crawler-local-'));
    temporaryDirectories.push(directory);
    const sourceUrl = 'https://cdn.example.com/existing.jpg';
    const targetPath = join(directory, imageKeyFor(sourceUrl));
    await mkdir(join(directory, 'brochures', 'dumps', 'assets'), { recursive: true });
    await writeFile(targetPath, Buffer.from([7, 8, 9]));
    const fetchMock = jest.spyOn(global, 'fetch');
    const config = loadLocalStorageConfig(directory, undefined, { storageBudgetBytes: 1 });
    const budget = await ensureLocalStorageBudget(config);

    const brochure: CrawlerBrochure = {
      id: 'brochure-existing',
      storeId: 'store',
      title: 'Prospekt',
      validFrom: '2026-08-25T00:00:00Z',
      validUntil: '2026-09-01T00:00:00Z',
      coverImage: sourceUrl,
      pages: [{ number: 1, imageUrl: sourceUrl, hotspots: [] }],
    };

    const result = await mirrorBrochureImagesToLocal(brochure, config, new Map());

    expect(result.coverImage).toBe(sourceUrl);
    expect(result.pages[0].imageUrl).toBe(sourceUrl);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(budget?.snapshot()).toMatchObject({
      occupiedBytes: 3,
      reservedBytes: 0,
      remainingBudgetBytes: -2,
    });
  });

  it('reicht eine Budgetüberschreitung unverändert nach außen weiter', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fam-crawler-local-'));
    temporaryDirectories.push(directory);
    const sourceUrl = 'https://cdn.example.com/too-large.jpg';
    jest.spyOn(global, 'fetch').mockResolvedValue(testResponse(new Uint8Array([1, 2, 3])));
    const config = loadLocalStorageConfig(directory, undefined, { storageBudgetBytes: 2 });

    const brochure: CrawlerBrochure = {
      id: 'brochure-budget',
      storeId: 'store',
      title: 'Prospekt',
      validFrom: '2026-08-25T00:00:00Z',
      validUntil: '2026-09-01T00:00:00Z',
      coverImage: sourceUrl,
      pages: [],
    };

    await expect(mirrorBrochureImagesToLocal(brochure, config, new Map())).rejects.toBeInstanceOf(
      StorageBudgetExceededError,
    );
    expect(brochure.coverImage).toBe(sourceUrl);
  });

  it('reserviert parallele lokale Writes gemeinsam und erlaubt nur den Bestand im Budget', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fam-crawler-local-'));
    temporaryDirectories.push(directory);
    jest
      .spyOn(global, 'fetch')
      .mockImplementation(async () => testResponse(new Uint8Array([1, 2, 3])));
    const config = loadLocalStorageConfig(directory, undefined, { storageBudgetBytes: 5 });
    const brochure: CrawlerBrochure = {
      id: 'brochure-parallel',
      storeId: 'store',
      title: 'Prospekt',
      validFrom: '2026-08-25T00:00:00Z',
      validUntil: '2026-09-01T00:00:00Z',
      coverImage: 'https://cdn.example.com/parallel-cover.jpg',
      pages: [{ number: 1, imageUrl: 'https://cdn.example.com/parallel-page.jpg', hotspots: [] }],
    };

    await expect(mirrorBrochureImagesToLocal(brochure, config, new Map())).rejects.toBeInstanceOf(
      StorageBudgetExceededError,
    );

    const assets = await listLocalStorageAssets(directory);
    expect(assets.filter((asset) => asset.key.includes('/assets/'))).toHaveLength(1);
    expect((await ensureLocalStorageBudget(config))?.snapshot()).toMatchObject({
      occupiedBytes: 3,
      reservedBytes: 0,
    });
  });

  it('behält eine Reservation bei einem unklaren lokalen Write-Ergebnis', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fam-crawler-local-'));
    temporaryDirectories.push(directory);
    await writeFile(join(directory, 'brochures'), Buffer.from([0]));
    const sourceUrl = 'https://cdn.example.com/uncertain.jpg';
    jest.spyOn(global, 'fetch').mockResolvedValue(testResponse(new Uint8Array([1, 2, 3])));
    const config = loadLocalStorageConfig(directory, undefined, { storageBudgetBytes: 4 });
    const budget = await ensureLocalStorageBudget(config);
    const brochure: CrawlerBrochure = {
      id: 'brochure-uncertain',
      storeId: 'store',
      title: 'Prospekt',
      validFrom: '2026-08-25T00:00:00Z',
      validUntil: '2026-09-01T00:00:00Z',
      coverImage: sourceUrl,
      pages: [],
    };

    await expect(mirrorBrochureImagesToLocal(brochure, config, new Map())).rejects.toThrow();
    expect(budget?.snapshot()).toMatchObject({
      occupiedBytes: 1,
      reservedBytes: 3,
      requiredBytes: 4,
    });
  });

  it('verwendet vorhandene Legacy-Dateien weiter', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fam-crawler-local-'));
    temporaryDirectories.push(directory);
    const sourceUrl = 'https://cdn.example.com/legacy.jpg';
    const brochure: CrawlerBrochure = {
      id: 'brochure-legacy',
      storeId: 'store',
      title: 'Prospekt',
      validFrom: '2026-08-25T00:00:00Z',
      validUntil: '2026-09-01T00:00:00Z',
      coverImage: sourceUrl,
      pages: [],
    };
    const legacyPath = join(directory, legacyImageKeyFor(sourceUrl, brochure.id, 'cover'));
    await mkdir(join(directory, 'brochures', 'dumps', brochure.id), { recursive: true });
    await writeFile(legacyPath, Buffer.from([4, 5, 6]));
    const fetchMock = jest.spyOn(global, 'fetch');
    const config = loadLocalStorageConfig(directory, undefined, { storageBudgetBytes: 0 });

    const result = await mirrorBrochureImagesToLocal(brochure, config, new Map());

    expect(result.coverImage).toBe(sourceUrl);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
