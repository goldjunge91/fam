import { useCallback, useEffect, useRef, useState } from 'react';

import {
  LOCAL_RESULT_THRESHOLD,
  type ProductCatalog,
  type ProductCatalogSearchResult,
} from '@/features/product-search/product-catalog';
import { productCatalog } from '@/features/product-search/product-catalog-instance';
import type { CatalogProduct } from '@/features/product-search/types';

/** Kuerzere Eingaben sind fuer eine Produktsuche wertlos. */
const MIN_QUERY_LENGTH = 2;

/** Rein lokale Antwort: darf schnell kommen, kostet kein OFF-Kontingent. */
const LOCAL_DEBOUNCE_MS = 300;

/**
 * Open Food Facts limitiert Suchen auf 10/min/IP und untersagt
 * Search-as-you-type ausdruecklich ("you would be blocked very quickly") — ein
 * kurzes Debounce waere hier ein Verstoss gegen die dokumentierten
 * Nutzungsregeln, kein Feinschliff.
 */
const API_DEBOUNCE_MS = 800;

export type UseProductSearchOptions = {
  /** Eigenmarken dieses Markts stehen im Ranking weiter oben. */
  preferredMarket?: string | readonly string[] | null;
  /** Test-Seam: ein anderer Katalog (z. B. ein Fake) statt der App-Instanz. */
  catalog?: ProductCatalog;
  localDebounceMs?: number;
  apiDebounceMs?: number;
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
  retry: () => Promise<void>;
};

const EMPTY: CatalogProduct[] = [];

/**
 * Die Produktsuche der App: Debounce, Abbruch veralteter Anfragen,
 * Cursor-Pagination und Ladezustaende — ueber dem Product Catalog, ohne
 * eigenes Wissen ueber Quellen, SQL oder HTTP.
 *
 * Gesucht wird in zwei Stufen: erst lokal (schnell, unbegrenzt), dann mit
 * Online-Ebene (langsam, kontingentiert). Ist die lokale Antwort schon
 * ergiebig, entfaellt die zweite Stufe.
 */
export function useProductSearch(
  query: string,
  options: UseProductSearchOptions = {},
): UseProductSearchResult {
  const {
    preferredMarket,
    catalog = productCatalog,
    localDebounceMs = LOCAL_DEBOUNCE_MS,
    apiDebounceMs = API_DEBOUNCE_MS,
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
    const searchStartedAt = Date.now();
    let apiTimer: ReturnType<typeof setTimeout> | undefined;

    const localTimer = setTimeout(async () => {
      if (requestId !== requestIdRef.current) return;
      const page = await catalog.search(trimmedQuery, {
        limit: pageSize,
        preferredMarket,
        allowApi: false,
        signal: controller.signal,
      });
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      const skipApiPhase = page.products.length >= LOCAL_RESULT_THRESHOLD;
      // Treffer sofort zeigen, aber `searching` erst am Ende loesen: sonst
      // blitzt zwischen lokaler und Online-Stufe der Leerzustand ("manuell
      // anlegen") auf, obwohl noch gesucht wird.
      if (!applyResult(requestId, page)) return;
      if (skipApiPhase) {
        setSearching(false);
        return;
      }

      // Die vollstaendige Suche darf nie vor der lokalen Stufe abschliessen:
      // sonst koennte deren spaete Antwort bereits sichtbare API-Treffer wieder
      // ueberschreiben. Das Debounce bleibt relativ zum Beginn der Eingabe.
      const remainingApiDelay = Math.max(0, apiDebounceMs - (Date.now() - searchStartedAt));
      apiTimer = setTimeout(async () => {
        if (controller.signal.aborted || requestId !== requestIdRef.current) return;
        await runSearch(trimmedQuery, requestId, controller.signal);
        if (!controller.signal.aborted && requestId === requestIdRef.current) setSearching(false);
      }, remainingApiDelay);
    }, localDebounceMs);

    return () => {
      clearTimeout(localTimer);
      if (apiTimer !== undefined) clearTimeout(apiTimer);
      controller.abort();
    };
  }, [
    query,
    preferredMarket,
    catalog,
    pageSize,
    localDebounceMs,
    apiDebounceMs,
    applyResult,
    runSearch,
  ]);

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

  const retry = useCallback(async () => {
    const trimmedQuery = queryRef.current.trim();
    if (trimmedQuery.length < MIN_QUERY_LENGTH) return;
    const requestId = ++requestIdRef.current;
    cursorRef.current = undefined;
    setSearching(true);
    try {
      await runSearch(trimmedQuery, requestId, new AbortController().signal);
    } finally {
      setSearching(false);
    }
  }, [runSearch]);

  return { results, searching, loadingMore, failed, hasMore, searched, loadMore, retry };
}
