import { getCatalogCoverPath, isCatalogStoragePath } from './recipe-catalog-image';

describe('isCatalogStoragePath', () => {
  it('does not treat an external image URL as a Storage object path', () => {
    expect(isCatalogStoragePath('https://images.example/banana-quesadilla.jpg')).toBe(false);
  });

  it('recognizes a catalog Storage path', () => {
    expect(isCatalogStoragePath('waivy/banana-quesadilla.jpg')).toBe(true);
  });

  it.each([null, undefined, '', '   '])('rejects an empty path: %s', (path) => {
    expect(isCatalogStoragePath(path)).toBe(false);
  });

  it('recognizes HTTP image URLs regardless of scheme casing or surrounding spaces', () => {
    expect(isCatalogStoragePath('  HtTp://images.example/cover.jpg  ')).toBe(false);
  });
});

describe('getCatalogCoverPath', () => {
  it('resolves a template cover from its trimmed template id', () => {
    expect(
      getCatalogCoverPath({ external_id: 'template:  soup-42  ', cover_image_path: null }),
    ).toBe('templates/soup-42.jpg');
  });

  it('falls back when a template id is empty', () => {
    expect(
      getCatalogCoverPath(
        { external_id: 'template:   ', cover_image_path: 'catalog/soup.jpg' },
        'stored/soup.jpg',
      ),
    ).toBe('stored/soup.jpg');
  });

  it('uses the recipe cover when no stored path is provided', () => {
    expect(
      getCatalogCoverPath({
        external_id: 'provider:soup-42',
        cover_image_path: 'catalog/soup.jpg',
      }),
    ).toBe('catalog/soup.jpg');
  });

  it('returns null when neither stored nor recipe cover exists', () => {
    expect(
      getCatalogCoverPath({ external_id: 'provider:soup-42', cover_image_path: null }),
    ).toBeNull();
  });
});
