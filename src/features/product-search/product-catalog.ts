import { onlineManager } from '@tanstack/react-query';

import { isLikelyBarcode } from '@/features/product-search/product-parsing';
import { rankProductSearchResults } from '@/features/product-search/search-ranking';
import type {
  CatalogProduct,
  CatalogSource,
  ProductSearchResult,
} from '@/features/product-search/types';
import { debugLogEvent } from '@/lib/debug-log';

/** Unter dieser Zahl lokaler Treffer lohnt sich der zusaetzliche OFF-Request noch. */
export const LOCAL_RESULT_THRESHOLD = 5;

export const DEFAULT_CATALOG_PAGE_SIZE = 20;

/** Kuerzere Eingaben liefern nur Rauschen und kosten ein OFF-Kontingent. */
const MIN_QUERY_LENGTH = 2;

export type ProductCatalogSearchOptions = {
  cursor?: string;
  limit?: number;
  signal?: AbortSignal;
  /** Eigenmarken dieses Markts werden im Ranking bevorzugt. */
  preferredMarket?: string | readonly string[] | null;
  /**
   * Sperrt die Online-Ebene fuer diesen Aufruf. Die UI nutzt das fuer die
   * schnelle erste Antwort waehrend des Tippens: Open Food Facts untersagt
   * Search-as-you-type ausdruecklich, lokale Quellen duerfen sofort liefern.
   */
  allowApi?: boolean;
};

export type ProductCatalogSearchResult = ProductSearchResult & { nextCursor?: string };

export interface ProductCatalog {
  search(query: string, options?: ProductCatalogSearchOptions): Promise<ProductCatalogSearchResult>;
  findByBarcode(barcode: string, signal?: AbortSignal): Promise<CatalogProduct | null>;
}

type CatalogCursor = { localOffset: number; dumpOffset: number; apiPage: number };

const INITIAL_CURSOR: CatalogCursor = { localOffset: 0, dumpOffset: 0, apiPage: 1 };

function encodeCursor(cursor: CatalogCursor): string {
  return btoa(JSON.stringify(cursor));
}

/** Ein nicht dekodierbarer Cursor zaehlt wie keiner — die UI soll daran nie scheitern. */
function decodeCursor(cursor: string | undefined): CatalogCursor {
  if (!cursor) return INITIAL_CURSOR;
  try {
    const parsed = JSON.parse(atob(cursor)) as Partial<CatalogCursor>;
    if (
      typeof parsed.localOffset !== 'number' ||
      typeof parsed.dumpOffset !== 'number' ||
      typeof parsed.apiPage !== 'number'
    ) {
      return INITIAL_CURSOR;
    }
    return {
      localOffset: parsed.localOffset,
      dumpOffset: parsed.dumpOffset,
      apiPage: parsed.apiPage,
    };
  } catch {
    return INITIAL_CURSOR;
  }
}

const EMPTY_RESULT: ProductSearchResult = { products: [], hasMore: false, failed: false };

/**
 * Haengt Treffer einer tieferen Quelle an, ohne bereits gesehene Barcodes zu
 * wiederholen. Treffer ohne Barcode werden nie zusammengelegt — ein fehlender
 * Barcode ist keine Identitaet.
 */
function appendWithoutDuplicates(
  collected: CatalogProduct[],
  seenBarcodes: Set<string>,
  incoming: readonly CatalogProduct[],
): void {
  for (const candidate of incoming) {
    if (candidate.barcode && seenBarcodes.has(candidate.barcode)) continue;
    if (candidate.barcode) seenBarcodes.add(candidate.barcode);
    collected.push(candidate);
  }
}

/**
 * Der local-first Product Catalog: die einzige Art, wie die App Produkte
 * findet. Quellen werden in fester Prioritaet befragt (eigener Spiegel, dann
 * OFF-Dump, dann OFF-API), der erste Treffer eines Barcodes gewinnt
 * vollstaendig — es wird nie ein Feld aus einer tieferen Quelle nachgereicht.
 *
 * Die Quellen werden injiziert: das ist der Test-Seam des Features.
 */
export function createProductCatalog(sources: {
  local: CatalogSource;
  dump: CatalogSource;
  api: CatalogSource;
}): ProductCatalog {
  async function search(
    rawQuery: string,
    options: ProductCatalogSearchOptions = {},
  ): Promise<ProductCatalogSearchResult> {
    const query = rawQuery.trim();
    if (query.length < MIN_QUERY_LENGTH) return EMPTY_RESULT;

    const limit = options.limit ?? DEFAULT_CATALOG_PAGE_SIZE;
    const { signal } = options;
    const cursor = decodeCursor(options.cursor);

    // Eine abgetippte EAN ist ein Barcode, keine Textsuche. Ranking entfaellt
    // hier bewusst: eine Ziffernfolge trifft keinen Produktnamen und wuerde
    // vom Ranking wieder herausgefiltert.
    const allowApi = options.allowApi ?? true;

    if (!options.cursor && isLikelyBarcode(query)) {
      const found = await findByBarcode(query, signal, allowApi);
      return { products: found ? [found] : [], hasMore: false, failed: false };
    }

    const collected: CatalogProduct[] = [];
    const seenBarcodes = new Set<string>();

    // Der Schwellwert zaehlt nur, was der Nutzer am Ende auch sieht: das
    // Ranking wirft Treffer mit Score 0 weg. Wuerden hier die rohen
    // LIKE-Treffer zaehlen, koennten fuenf Zufallstreffer die tieferen
    // Quellen sperren und die Liste bliebe leer.
    const rankedCount = () =>
      rankProductSearchResults(collected, query, options.preferredMarket).length;

    const localResult = await sources.local.search(query, {
      offset: cursor.localOffset,
      limit,
      signal,
    });
    appendWithoutDuplicates(collected, seenBarcodes, localResult.products);

    // Eine noch nicht befragte Ebene kann Treffer haben — das zaehlt als
    // `hasMore`, damit die Liste nicht bei fuenf eigenen Produkten endet.
    let dumpResult: ProductSearchResult | null = null;
    let dumpUnexplored = true;
    if (rankedCount() < LOCAL_RESULT_THRESHOLD) {
      dumpUnexplored = false;
      dumpResult = await sources.dump.search(query, { offset: cursor.dumpOffset, limit, signal });
      appendWithoutDuplicates(collected, seenBarcodes, dumpResult.products);
    }

    let apiResult: ProductSearchResult | null = null;
    // Nur "aufgeschoben, weil lokal genug da war" zaehlt als weitere Seite.
    // Eine fuer diesen Aufruf gesperrte Online-Ebene (`allowApi: false`) darf
    // kein `hasMore` erzeugen: der Cursor waere unveraendert und die UI wuerde
    // dieselbe Seite erneut anfordern.
    let apiDeferred = false;
    const online = onlineManager.isOnline();
    if (rankedCount() < LOCAL_RESULT_THRESHOLD && online && allowApi) {
      apiResult = await sources.api.search(query, {
        offset: (cursor.apiPage - 1) * limit,
        limit,
        signal,
      });
      appendWithoutDuplicates(collected, seenBarcodes, apiResult.products);
    } else if (online && allowApi) {
      apiDeferred = true;
    }

    const hasMore =
      localResult.hasMore ||
      (dumpUnexplored ? true : (dumpResult?.hasMore ?? false)) ||
      (apiDeferred ? true : (apiResult?.hasMore ?? false));

    const nextCursor: CatalogCursor = {
      localOffset: cursor.localOffset + localResult.products.length,
      dumpOffset: cursor.dumpOffset + (dumpResult?.products.length ?? 0),
      apiPage: cursor.apiPage + (apiResult ? 1 : 0),
    };

    debugLogEvent('product-catalog.search', {
      localCount: localResult.products.length,
      dumpCount: dumpResult?.products.length ?? null,
      apiCount: apiResult?.products.length ?? null,
      online,
      hasMore,
    });

    return {
      products: rankProductSearchResults(collected, query, options.preferredMarket),
      hasMore,
      failed: apiResult?.failed ?? false,
      nextCursor: hasMore ? encodeCursor(nextCursor) : undefined,
    };
  }

  async function findByBarcode(
    rawBarcode: string,
    signal?: AbortSignal,
    allowApi = true,
  ): Promise<CatalogProduct | null> {
    const barcode = rawBarcode.trim();
    if (!barcode) return null;

    const local = await sources.local.findByBarcode(barcode, signal);
    if (local) {
      debugLogEvent('product-catalog.barcode', { source: 'local', found: true });
      return local;
    }

    const dump = await sources.dump.findByBarcode(barcode, signal);
    if (dump) {
      debugLogEvent('product-catalog.barcode', { source: 'dump', found: true });
      return dump;
    }

    // Offline endet der Lookup hier mit `null` statt mit einem Netzfehler.
    // Dasselbe gilt fuer eine gesperrte Online-Ebene: eine noch unfertig
    // getippte EAN darf keinen OFF-Request pro Tastendruck ausloesen.
    if (!allowApi || !onlineManager.isOnline()) {
      debugLogEvent('product-catalog.barcode', { source: 'offline', found: false });
      return null;
    }

    const api = await sources.api.findByBarcode(barcode, signal);
    debugLogEvent('product-catalog.barcode', { source: 'api', found: api !== null });
    return api;
  }

  return { search, findByBarcode };
}
