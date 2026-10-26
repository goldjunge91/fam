export const MAX_BROCHURE_PREFETCH_IMAGES = 48;
export const BROCHURE_PREFETCH_CONCURRENCY = 4;

export type BrochureImagePrefetchReference = {
  uri: string;
  validUntil: string;
};

export type BrochureImagePrefetchItem = BrochureImagePrefetchReference;

export async function prefetchBrochureImages(options: {
  items: readonly BrochureImagePrefetchItem[];
  canContinue: () => boolean;
  prefetch: (item: BrochureImagePrefetchItem) => Promise<boolean>;
  completed: Set<string>;
  inFlight: Map<string, Promise<boolean>>;
  now?: () => number;
}): Promise<void> {
  const now = options.now ?? Date.now;
  const uniqueItems = new Map<string, BrochureImagePrefetchItem>();
  for (const item of options.items) {
    if (!uniqueItems.has(item.uri)) uniqueItems.set(item.uri, item);
    if (uniqueItems.size === MAX_BROCHURE_PREFETCH_IMAGES) break;
  }

  const items = [...uniqueItems.values()];
  for (let index = 0; index < items.length; index += BROCHURE_PREFETCH_CONCURRENCY) {
    if (!options.canContinue()) return;

    const batch = items.slice(index, index + BROCHURE_PREFETCH_CONCURRENCY);
    await Promise.all(
      batch.map(async (item) => {
        if (
          !options.canContinue() ||
          !Number.isFinite(Date.parse(item.validUntil)) ||
          Date.parse(item.validUntil) <= now() ||
          options.completed.has(item.uri)
        ) {
          return;
        }

        let request = options.inFlight.get(item.uri);
        if (!request) {
          request = Promise.resolve()
            .then(() => options.prefetch(item))
            .catch(() => false);
          options.inFlight.set(item.uri, request);
        }

        try {
          if ((await request) && options.canContinue()) options.completed.add(item.uri);
        } finally {
          if (options.inFlight.get(item.uri) === request) options.inFlight.delete(item.uri);
        }
      }),
    );
  }
}
