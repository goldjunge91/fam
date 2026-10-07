import { describe, expect, it } from '@jest/globals';
import { hashOrderedPageSet } from '../../tools/crawler/brochures/listing-only/full-brochure-signature';

const pageOneHash = 'a'.repeat(64);
const pageTwoHash = 'b'.repeat(64);
const pageThreeHash = 'c'.repeat(64);

describe('full brochure page hash signature', () => {
  it('produces the same signature regardless of input order', () => {
    const pages = [
      { pageNumber: 1, sha256: pageOneHash },
      { pageNumber: 2, sha256: pageTwoHash },
      { pageNumber: 3, sha256: pageThreeHash },
    ];

    expect(hashOrderedPageSet(pages, 3)).toBe(
      hashOrderedPageSet(
        [
          { pageNumber: 3, sha256: pageThreeHash },
          { pageNumber: 1, sha256: pageOneHash },
          { pageNumber: 2, sha256: pageTwoHash },
        ],
        3,
      ),
    );
    expect(pages.map(({ pageNumber }) => pageNumber)).toEqual([1, 2, 3]);
  });

  it('distinguishes brochures when a later page differs but page one matches', () => {
    const firstBrochure = [
      { pageNumber: 1, sha256: pageOneHash },
      { pageNumber: 2, sha256: pageTwoHash },
    ];
    const secondBrochure = [
      { pageNumber: 1, sha256: pageOneHash },
      { pageNumber: 2, sha256: pageThreeHash },
    ];

    expect(hashOrderedPageSet(firstBrochure, 2)).not.toBe(
      hashOrderedPageSet(secondBrochure, 2),
    );
  });

  it('rejects a page set with a missing page number', () => {
    expect(() =>
      hashOrderedPageSet(
        [
          { pageNumber: 1, sha256: pageOneHash },
          { pageNumber: 3, sha256: pageThreeHash },
        ],
        3,
      ),
    ).toThrow();
  });

  it('rejects duplicate page numbers', () => {
    expect(() =>
      hashOrderedPageSet(
        [
          { pageNumber: 1, sha256: pageOneHash },
          { pageNumber: 1, sha256: pageTwoHash },
        ],
        2,
      ),
    ).toThrow();
  });

  it('rejects an invalid SHA-256 value', () => {
    expect(() =>
      hashOrderedPageSet(
        [
          { pageNumber: 1, sha256: pageOneHash },
          { pageNumber: 2, sha256: 'g'.repeat(64) },
        ],
        2,
      ),
    ).toThrow();
  });
});
