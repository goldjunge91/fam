import { useEffect, useRef, useState } from 'react';

import { rankProductSearchResults } from '@/features/product-search/search-ranking';
import {
  dedupeProductsByBarcode,
  fetchProductByBarcodeFromDump,
  searchOffDump,
} from '@/lib/off-dump/off-dump';
import {
  fetchProductByBarcode,
  isLikelyBarcode,
  type OpenFoodFactsProduct,
  searchOpenFoodFacts,
} from '@/lib/open-food-facts';

const PAGE_SIZE = 20;

/**
 * Orchestriert die Live-Produktsuche im Food-Search-Screen: Debounce,
 * Abbruch veralteter Anfragen, Zusammenfuehren von lokalem OFF-Dump und
 * Online-API, Pagination und Retry bei Fehlern. Bewusst ohne Verlaufsfilter,
 * Quellen-Umschalter oder Scanner-Sichtbarkeit — das ist reiner UI-Zustand
 * ohne Sucheinfluss und bleibt im Screen.
 */
export function useFoodSearch(preferredMarket: string | null | undefined) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OpenFoodFactsProduct[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Schuetzt vor veralteten "naechste Seite"-Antworten, wenn die Suche sich
  // waehrend des Nachladens schon geaendert hat.
  const queryRef = useRef(query);
  queryRef.current = query;

  async function runSearch(trimmedQuery: string, signal: AbortSignal) {
    setSearching(true);
    setSearchFailed(false);

    if (isLikelyBarcode(trimmedQuery)) {
      const localProduct = await fetchProductByBarcodeFromDump(trimmedQuery);
      if (localProduct && !signal.aborted) {
        setResults([localProduct]);
        setHasMore(false);
        setPage(1);
        setSearching(false);
        return;
      }

      const product = await fetchProductByBarcode(trimmedQuery, signal);
      if (!signal.aborted) {
        setResults(product ? [product] : []);
        setHasMore(false);
        setPage(1);
        setSearching(false);
      }
      return;
    }

    const localResult = await searchOffDump(trimmedQuery, { limit: PAGE_SIZE });
    if (!signal.aborted && localResult.products.length > 0) {
      setResults(localResult.products);
      setHasMore(localResult.hasMore);
    }

    const result = await searchOpenFoodFacts(trimmedQuery, {
      page: 1,
      pageSize: PAGE_SIZE,
      signal,
    });
    if (!signal.aborted) {
      const merged = dedupeProductsByBarcode([...localResult.products, ...result.products]);
      setResults(rankProductSearchResults(merged, trimmedQuery, preferredMarket));
      setHasMore(localResult.hasMore || result.hasMore);
      setSearchFailed(result.failed && merged.length === 0);
      setPage(1);
      setSearching(false);
    }
  }

  // `runSearch` bewusst nicht in den Deps: es liest ausschliesslich Setter
  // (stabil) und seine eigenen Parameter, kein sich aenderndes Closure-State.
  // biome-ignore lint/correctness/useExhaustiveDependencies: siehe oben.
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      setSearchFailed(false);
      setHasMore(false);
      setPage(1);
      return;
    }

    // Bricht eine noch laufende Anfrage ab, sobald eine neue Eingabe
    // ueberholt hat — ohne das wartet die UI teils auf eine Antwort, die
    // gleich verworfen wird, statt sofort die neue Suche zu zeigen.
    //
    // 800ms statt der ueblichen 300ms: Open Food Facts limitiert Suchen auf
    // 10/min/IP und untersagt Search-as-you-type ausdruecklich ("you would
    // be blocked very quickly") — ein kurzes Debounce waere hier ein
    // Verstoss gegen die dokumentierten Nutzungsregeln, kein Feinschliff.
    // `searchOpenFoodFacts` haelt zusaetzlich ein eigenes Anfragelimit ein.
    const controller = new AbortController();
    const trimmedQuery = query.trim();
    const timer = setTimeout(() => runSearch(trimmedQuery, controller.signal), 800);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function retrySearch() {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) return;
    runSearch(trimmedQuery, new AbortController().signal);
  }

  async function loadMoreResults() {
    if (!hasMore || loadingMore || searching) return;
    const currentQuery = query;
    const nextPage = page + 1;
    const offset = page * PAGE_SIZE;
    setLoadingMore(true);

    const [localResult, remoteResult] = await Promise.all([
      searchOffDump(currentQuery, { offset, limit: PAGE_SIZE }),
      searchOpenFoodFacts(currentQuery, { page: nextPage, pageSize: PAGE_SIZE }),
    ]);

    if (queryRef.current === currentQuery) {
      const newItems = dedupeProductsByBarcode([...localResult.products, ...remoteResult.products]);
      setResults((prev) =>
        rankProductSearchResults(
          dedupeProductsByBarcode([...prev, ...newItems]),
          currentQuery,
          preferredMarket,
        ),
      );
      setHasMore(localResult.hasMore || remoteResult.hasMore);
      setPage(nextPage);
    }
    setLoadingMore(false);
  }

  return {
    query,
    setQuery,
    isSearchMode: query.trim().length >= 2,
    results,
    searching,
    searchFailed,
    hasMore,
    loadingMore,
    retrySearch,
    loadMoreResults,
  };
}
