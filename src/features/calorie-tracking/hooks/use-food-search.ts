import { useState } from 'react';

import { useProductSearch } from '@/features/product-search/hooks/use-product-search';

const PAGE_SIZE = 20;

/**
 * Die Produktsuche des Food-Search-Screens: haelt die Eingabe und reicht sie
 * an den gemeinsamen Product Catalog weiter. Die Suchlogik selbst (Debounce,
 * Quellenreihenfolge, Pagination) liegt in `useProductSearch` — der Screen
 * soll dieselben Treffer sehen wie Inventar und Einkaufsliste.
 *
 * Verlaufsfilter, Quellen-Umschalter und Scanner-Sichtbarkeit bleiben bewusst
 * draussen: reiner UI-Zustand ohne Sucheinfluss.
 */
export function useFoodSearch(preferredMarket: string | readonly string[] | null | undefined) {
  const [query, setQuery] = useState('');
  const search = useProductSearch(query, { preferredMarket, pageSize: PAGE_SIZE });

  return {
    query,
    setQuery,
    isSearchMode: query.trim().length >= 2,
    results: search.results,
    searching: search.searching,
    searchFailed: search.failed,
    hasMore: search.hasMore,
    loadingMore: search.loadingMore,
    retrySearch: search.retry,
    loadMoreResults: search.loadMore,
  };
}
