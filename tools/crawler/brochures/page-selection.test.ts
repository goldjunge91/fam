import { describe, expect, it } from '@jest/globals';
import { isLegacyPartialSelection, selectBrochurePages } from './page-selection';
import type { CrawlerBrochure } from './types';

const brochure: CrawlerBrochure = {
  id: 'brochure-1',
  storeId: 'store-1',
  title: 'Prospekt',
  validFrom: '2026-09-01T00:00:00Z',
  validUntil: '2026-09-07T00:00:00Z',
  coverImage: 'https://example.test/cover.jpg',
  pages: [
    { number: 3, imageUrl: 'https://example.test/3.jpg', hotspots: [] },
    {
      number: 1,
      imageUrl: 'https://example.test/1.jpg',
      hotspots: [
        { kind: 'discount', id: 'discount-1', x: 0, y: 0, width: 1, height: 1, title: 'Angebot' },
      ],
    },
    { number: 2, imageUrl: 'https://example.test/2.jpg', hotspots: [] },
  ],
};

describe('Prospekt-Seitenauswahl', () => {
  it('nimmt bei all jede gelieferte Seite auch ohne Discount-Hotspot', () => {
    const selection = selectBrochurePages(brochure, 'all');

    expect(selection.mode).toBe('all-pages');
    expect(selection.deliveredPageNumbers).toEqual([1, 2, 3]);
    expect(selection.selectedPageNumbers).toEqual([1, 2, 3]);
  });

  it('kennzeichnet die begrenzte Auswahl und filtert auf Discount-Hotspots', () => {
    const selection = selectBrochurePages(brochure, 3);

    expect(selection.mode).toBe('first-pages-with-discount-hotspots');
    expect(selection.deliveredPageNumbers).toEqual([1, 2, 3]);
    expect(selection.selectedPageNumbers).toEqual([1]);
  });

  it('behandelt den alten all-pages-with-discount-hotspots-Modus als Teilansicht', () => {
    expect(isLegacyPartialSelection('all-pages-with-discount-hotspots')).toBe(true);
    expect(isLegacyPartialSelection('all-pages')).toBe(false);
  });
});
