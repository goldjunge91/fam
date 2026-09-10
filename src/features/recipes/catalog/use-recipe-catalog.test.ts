import {
  getCatalogImageReference,
  resolveCatalogImageUrl,
  splitIntoChunks,
} from './use-recipe-catalog';

describe('resolveCatalogImageUrl', () => {
  it('returns remote image URLs without treating them as storage paths', () => {
    expect(resolveCatalogImageUrl('https://images.example/recipe.jpg')).toBe(
      'https://images.example/recipe.jpg',
    );
  });

  it('returns null for a storage path', () => {
    expect(resolveCatalogImageUrl('waivy/recipe.jpg')).toBeNull();
  });
});

describe('getCatalogImageReference', () => {
  it('prefers a locally stored image over the remote source', () => {
    expect(
      getCatalogImageReference({
        storage_path: 'waivy/recipe.jpg',
        source_url: 'https://images.example/recipe.jpg',
      }),
    ).toBe('waivy/recipe.jpg');
  });

  it('falls back to the remote source when no local image exists', () => {
    expect(
      getCatalogImageReference({
        storage_path: null,
        source_url: 'https://images.example/recipe.jpg',
      }),
    ).toBe('https://images.example/recipe.jpg');
  });

  it('returns null when neither image source exists', () => {
    expect(getCatalogImageReference({ storage_path: null, source_url: null })).toBeNull();
  });
});

describe('splitIntoChunks', () => {
  it('splits catalog ids into bounded request batches', () => {
    expect(splitIntoChunks(['a', 'b', 'c', 'd', 'e'], 2)).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
  });

  it('returns no batches for an empty catalog', () => {
    expect(splitIntoChunks([], 200)).toEqual([]);
  });
});
