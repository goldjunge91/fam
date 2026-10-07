import type { CrawlerBrochure, CrawlerPage } from './types';

/**
 * `all-pages-with-discount-hotspots` is kept only for reading old manifests.
 * New crawls use `all-pages`, because a page without a hotspot is still part
 * of the delivered brochure.
 */
export type PageSelectionMode =
  | 'first-pages-with-discount-hotspots'
  | 'all-pages'
  | 'all-pages-with-discount-hotspots';

export type PageSelection = {
  mode: PageSelectionMode;
  deliveredPageNumbers: number[];
  selectedPageNumbers: number[];
  selectedPages: CrawlerPage[];
};

function orderedPages(pages: CrawlerPage[]): CrawlerPage[] {
  return pages
    .map((page, index) => ({ page, index }))
    .toSorted((left, right) => left.page.number - right.page.number || left.index - right.index)
    .map(({ page }) => page);
}

/** Selects pages without mutating the source response. */
export function selectBrochurePages(
  brochure: CrawlerBrochure,
  count: number | 'all',
): PageSelection {
  const deliveredPages = orderedPages(brochure.pages ?? []);
  const mode: PageSelectionMode =
    count === 'all' ? 'all-pages' : 'first-pages-with-discount-hotspots';
  const selectedPages =
    count === 'all'
      ? deliveredPages
      : deliveredPages
          .filter((page) => page.hotspots.some((hotspot) => hotspot.kind === 'discount'))
          .slice(0, count);

  return {
    mode,
    deliveredPageNumbers: deliveredPages.map((page) => page.number),
    selectedPageNumbers: selectedPages.map((page) => page.number),
    selectedPages,
  };
}

export function isLegacyPartialSelection(mode: PageSelectionMode | undefined): boolean {
  return mode === 'all-pages-with-discount-hotspots';
}
