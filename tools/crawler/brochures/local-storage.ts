import { access, mkdir, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { downloadOptimizedImage, imageKeyFor, legacyImageKeyFor } from './r2-storage';
import { createStorageBudget, type StorageAsset, type StorageBudget } from './storage-policy';
import type { CrawlerBrochure } from './types';

export type LocalStorageConfig = {
  directory: string;
  publicUrl?: string;
  storageBudgetBytes?: number;
  storageBudget?: StorageBudget;
};

export type LocalStorageBudgetOptions = {
  storageBudgetBytes?: number;
  storageBudget?: StorageBudget;
};

export function loadLocalStorageConfig(
  directory: string,
  publicUrl?: string,
  options?: LocalStorageBudgetOptions,
): LocalStorageConfig {
  return {
    directory,
    publicUrl: publicUrl?.replace(/\/+$/, '') || undefined,
    ...(options?.storageBudgetBytes === undefined
      ? {}
      : { storageBudgetBytes: options.storageBudgetBytes }),
    ...(options?.storageBudget ? { storageBudget: options.storageBudget } : {}),
  };
}

export async function ensureLocalStorageDirectory(config: LocalStorageConfig): Promise<void> {
  try {
    await mkdir(config.directory, { recursive: true });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Lokales Zielverzeichnis ist nicht beschreibbar: ${config.directory}. Ist das Laufwerk eingehängt und für diesen Prozess freigegeben? (${reason})`,
    );
  }
}

function buildPublicUrl(config: LocalStorageConfig, key: string, originalUrl: string): string {
  return config.publicUrl ? `${config.publicUrl.replace(/\/+$/, '')}/${key}` : originalUrl;
}

async function localFileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function writeAssetIfMissing(path: string, body: ArrayBuffer): Promise<boolean> {
  if (await localFileExists(path)) return false;

  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, Buffer.from(body));
  await rename(temporaryPath, path);
  return true;
}

async function listLocalAssetsInDirectory(
  directory: string,
  rootDirectory: string,
): Promise<StorageAsset[]> {
  const assets: StorageAsset[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      assets.push(...(await listLocalAssetsInDirectory(path, rootDirectory)));
      continue;
    }
    if (!entry.isFile()) continue;
    const file = await stat(path);
    assets.push({
      key: relative(rootDirectory, path).split(sep).join('/'),
      bytes: file.size,
    });
  }
  return assets;
}

/** Erfasst den tatsächlichen lokalen Dateibestand unabhängig von Manifesten. */
export async function listLocalStorageAssets(directory: string): Promise<StorageAsset[]> {
  try {
    await stat(directory);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
    throw error;
  }
  return listLocalAssetsInDirectory(directory, directory);
}

const localBudgetPromises = new WeakMap<LocalStorageConfig, Promise<StorageBudget | undefined>>();

/** Baut den Budgetzustand einmalig aus allen vorhandenen lokalen Dateien auf. */
export async function ensureLocalStorageBudget(
  config: LocalStorageConfig,
): Promise<StorageBudget | undefined> {
  if (config.storageBudget) {
    if (
      config.storageBudgetBytes !== undefined &&
      config.storageBudget.budgetBytes !== config.storageBudgetBytes
    ) {
      throw new Error('Die lokale Budgetkonfiguration enthält widersprüchliche Bytebudgets.');
    }
    return config.storageBudget;
  }
  if (config.storageBudgetBytes === undefined) return undefined;

  const pending = localBudgetPromises.get(config);
  if (pending) return pending;

  const promise = (async () => {
    const existingAssets = await listLocalStorageAssets(config.directory);
    const budget = createStorageBudget({
      budgetBytes: config.storageBudgetBytes,
      existingAssets,
    });
    config.storageBudget = budget;
    return budget;
  })();
  localBudgetPromises.set(config, promise);
  try {
    return await promise;
  } catch (error) {
    localBudgetPromises.delete(config);
    throw error;
  }
}

/**
 * Spiegelt Prospektbilder auf ein lokales Laufwerk. Ohne publicUrl bleiben die
 * Original-URLs im Payload erhalten, sodass ein lokaler Testlauf nichts
 * Unbrauchbares in Supabase veröffentlicht.
 */
export async function mirrorBrochureImagesToLocal(
  brochure: CrawlerBrochure,
  config: LocalStorageConfig,
  downloadedUrlCache: Map<string, string | Promise<string>>,
): Promise<CrawlerBrochure> {
  const storageBudget = await ensureLocalStorageBudget(config);
  const updatedBrochure: CrawlerBrochure = {
    ...brochure,
    pages: [...(brochure.pages || [])],
  };

  const tasks: Array<{
    originalUrl: string;
    context: string;
    apply: (url: string) => void;
  }> = [];

  if (brochure.coverImage) {
    tasks.push({
      originalUrl: brochure.coverImage,
      context: 'cover',
      apply: (url) => {
        updatedBrochure.coverImage = url;
      },
    });
  }

  updatedBrochure.pages = updatedBrochure.pages.map((page, index) => {
    const updatedPage = { ...page };
    if (page.imageUrl) {
      tasks.push({
        originalUrl: page.imageUrl,
        context: `page-${String(page.number ?? index + 1).padStart(3, '0')}`,
        apply: (url) => {
          updatedPage.imageUrl = url;
        },
      });
    }
    return updatedPage;
  });

  const resolveAsset = async (task: (typeof tasks)[number]): Promise<string> => {
    const key = imageKeyFor(task.originalUrl);
    const targetPath = join(config.directory, key);
    const publicUrl = buildPublicUrl(config, key, task.originalUrl);

    if (await localFileExists(targetPath)) return publicUrl;

    const legacyKey = legacyImageKeyFor(task.originalUrl, brochure.id, task.context);
    const legacyPath = join(config.directory, legacyKey);
    if (await localFileExists(legacyPath)) {
      return buildPublicUrl(config, legacyKey, task.originalUrl);
    }

    const storedImage = await downloadOptimizedImage(task.originalUrl);
    const reservation = storageBudget?.reserve(key, storedImage.byteLength);
    const wrote = await writeAssetIfMissing(targetPath, storedImage);
    if (wrote) {
      reservation?.commit(storedImage.byteLength);
    } else {
      storageBudget?.markExisting(key, storedImage.byteLength);
    }
    return publicUrl;
  };

  const CONCURRENCY = 2;
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const chunk = tasks.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map(async (task) => {
        const cached = downloadedUrlCache.get(task.originalUrl);
        if (cached) {
          task.apply(await cached);
          return;
        }

        const assetPromise = resolveAsset(task);
        downloadedUrlCache.set(task.originalUrl, assetPromise);
        try {
          const url = await assetPromise;
          downloadedUrlCache.set(task.originalUrl, url);
          task.apply(url);
        } catch (error) {
          downloadedUrlCache.delete(task.originalUrl);
          throw error;
        }
      }),
    );
    const failed = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (failed) throw failed.reason;
  }

  return updatedBrochure;
}
