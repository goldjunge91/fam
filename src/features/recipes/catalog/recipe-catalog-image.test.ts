import { isCatalogStoragePath } from './recipe-catalog-image';

describe('isCatalogStoragePath', () => {
  it('does not treat an external image URL as a Storage object path', () => {
    expect(isCatalogStoragePath('https://images.example/banana-quesadilla.jpg')).toBe(false);
  });

  it('recognizes a catalog Storage path', () => {
    expect(isCatalogStoragePath('waivy/banana-quesadilla.jpg')).toBe(true);
  });
});
