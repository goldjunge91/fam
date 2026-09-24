import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  ProductCatalog,
  ProductCatalogSearchResult,
} from '@/features/product-search/product-catalog';
import { productCatalog } from '@/features/product-search/product-catalog-instance';
import type { CatalogProduct } from '@/features/product-search/types';

/** Kuerzere Eingaben sind fuer eine Produktsuche wertlos. */
const MIN_QUERY_LENGTH = 2;

/** Rein lokale Antwort: darf schnell kommen, kostet kein OFF-Kontingent. */
const LOCAL_DEBOUNCE_MS = 300;

export type UseProductSearchOptions = {
  /** Eigenmarken dieses Markts stehen im Ranking weiter oben. */
  preferredMarket?: string | readonly string[] | null;
  /** Test-Seam: ein anderer Katalog (z. B. ein Fake) statt der App-Instanz. */
  catalog?: ProductCatalog;
  localDebounceMs?: number;
  pageSize?: number;
};

export type UseProductSearchResult = {
  results: CatalogProduct[];
  searching: boolean;
  loadingMore: boolean;
  /** true, wenn die Online-Quelle fehlschlug und keine Treffer uebrig sind. */
  failed: boolean;
  hasMore: boolean;
  /** true, sobald eine Suche zu dieser Eingabe abgeschlossen ist. */
  searched: boolean;
  loadMore: () => Promise<void>;
  /** Startet die kostenpflichtige Online-Suche erst nach einer Nutzeraktion. */
  searchOnline: () => Promise<void>;
  retry: () => Promise<void>;
};

const EMPTY: CatalogProduct[] = [];

/**
 * Die Produktsuche der App: Debounce, Abbruch veralteter Anfragen,
 * Cursor-Pagination und Ladezustaende — ueber dem Product Catalog, ohne
 * eigenes Wissen ueber Quellen, SQL oder HTTP.
 *
 * Beim Tippen wird ausschliesslich lokal gesucht (eigener Spiegel und Dump).
 * Die kontingentierte OFF-Suche wird nur ueber `searchOnline` beziehungsweise
 * die daraus abgeleitete Retry-Aktion gestartet — nie automatisch durch einen
 * Debounce oder beim Scrollen.
 */
export function useProductSearch(
  query: string,
  options: UseProductSearchOptions = {},
): UseProductSearchResult {
  const {
    preferredMarket,
    catalog = productCatalog,
    localDebounceMs = LOCAL_DEBOUNCE_MS,
    pageSize,
  } = options;

  const [results, setResults] = useState<CatalogProduct[]>(EMPTY);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [searched, setSearched] = useState(false);

  const cursorRef = useRef<string | undefined>(undefined);
  // Zaehlt jede neue Eingabe hoch. Antworten einer inzwischen ueberholten
  // Suche werden verworfen, statt die Liste zu ueberschreiben.
  const requestIdRef = useRef(0);
  const queryRef = useRef(query);
  queryRef.current = query;
  const onlineSearchEnabledRef = useRef(false);

  const applyResult = useCallback((requestId: number, page: ProductCatalogSearchResult) => {
    if (requestId !== requestIdRef.current) return false;
    cursorRef.current = page.nextCursor;
    setResults(page.products);
    setHasMore(page.hasMore);
    setFailed(page.failed && page.products.length === 0);
    setSearched(true);
    return true;
  }, []);

  const runSearch = useCallback(
    async (trimmedQuery: string, requestId: number, signal: AbortSignal) => {
      const page = await catalog.search(trimmedQuery, {
        limit: pageSize,
        preferredMarket,
        allowApi: true,
        signal,
      });
      if (signal.aborted) return;
      applyResult(requestId, page);
    },
    [catalog, pageSize, preferredMarket, applyResult],
  );

  useEffect(() => {
    const trimmedQuery = query.trim();
    const requestId = ++requestIdRef.current;
    cursorRef.current = undefined;
    onlineSearchEnabledRef.current = false;

    if (trimmedQuery.length < MIN_QUERY_LENGTH) {
      setResults(EMPTY);
      setSearching(false);
      setFailed(false);
      setHasMore(false);
      setSearched(false);
      return;
    }

    setSearching(true);
    const controller = new AbortController();

    const localTimer = setTimeout(async () => {
      if (requestId !== requestIdRef.current) return;
      const page = await catalog.search(trimmedQuery, {
        limit: pageSize,
        preferredMarket,
        allowApi: false,
        signal: controller.signal,
      });
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      if (!applyResult(requestId, page)) return;
      setSearching(false);
    }, localDebounceMs);

    return () => {
      clearTimeout(localTimer);
      controller.abort();
    };
  }, [query, preferredMarket, catalog, pageSize, localDebounceMs, applyResult]);

  const loadMore = useCallback(async () => {
    const cursor = cursorRef.current;
    if (!cursor || loadingMore || searching) return;
    const currentQuery = queryRef.current.trim();
    const requestId = requestIdRef.current;
    setLoadingMore(true);

    try {
      const page = await catalog.search(currentQuery, {
        cursor,
        limit: pageSize,
        preferredMarket,
        allowApi: onlineSearchEnabledRef.current,
      });

      if (requestId !== requestIdRef.current) return;
      cursorRef.current = page.nextCursor;
      // Anhaengen statt ersetzen: der Scroll-Kontext des Nutzers bleibt
      // erhalten. Barcodes, die schon in der Liste stehen, fallen raus.
      setResults((previous) => {
        const seen = new Set(previous.map((item) => item.barcode).filter(Boolean));
        return [
          ...previous,
          ...page.products.filter((item) => !item.barcode || !seen.has(item.barcode)),
        ];
      });
      setHasMore(page.hasMore);
    } finally {
      // Ohne das bliebe die Liste nach einem unerwarteten Fehler dauerhaft im
      // Ladezustand haengen.
      setLoadingMore(false);
    }
  }, [catalog, loadingMore, searching, pageSize, preferredMarket]);

  const searchOnline = useCallback(async () => {
    const trimmedQuery = queryRef.current.trim();
    if (trimmedQuery.length < MIN_QUERY_LENGTH) return;
    const requestId = ++requestIdRef.current;
    cursorRef.current = undefined;
    onlineSearchEnabledRef.current = true;
    setSearching(true);
    setFailed(false);
    const controller = new AbortController();
    try {
      await runSearch(trimmedQuery, requestId, controller.signal);
    } finally {
      if (requestId === requestIdRef.current) setSearching(false);
    }
  }, [runSearch]);

  return {
    results,
    searching,
    loadingMore,
    failed,
    hasMore,
    searched,
    loadMore,
    searchOnline,
    retry: searchOnline,
  };
}
