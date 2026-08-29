import { access, mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  downloadOptimizedImage,
  imageKeyFor,
  legacyImageKeyFor,
} from './r2-storage';
import type { CrawlerBrochure } from './types';

export type LocalStorageConfig = {
  directory: string;
  publicUrl?: string;
};

export function loadLocalStorageConfig(
  directory: string,
  publicUrl?: string,
): LocalStorageConfig {
  return {
    directory,
    publicUrl: publicUrl?.replace(/\/+$/, '') || undefined,
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

async function writeAssetIfMissing(path: string, body: ArrayBuffer): Promise<void> {
  if (await localFileExists(path)) return;

  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, Buffer.from(body));
  await rename(temporaryPath, path);
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
    await writeAssetIfMissing(targetPath, storedImage);
    return publicUrl;
  };

  const CONCURRENCY = 2;
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const chunk = tasks.slice(i, i + CONCURRENCY);
    await Promise.all(
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
          console.warn(`⚠️ Lokales Speichern für ${task.originalUrl} fehlgeschlagen:`, error);
        }
      }),
    );
  }

  return updatedBrochure;
}
