import { describeCategorySource } from './category-source-copy';

describe('describeCategorySource', () => {
  it('beschreibt eine manuell gewaehlte Kategorie', () => {
    expect(describeCategorySource('user', 'dairy')).toBe('manuell gewählt');
  });

  it('beschreibt bewusstes "Sonstiges" getrennt von einer manuellen Kategorie', () => {
    expect(describeCategorySource('user', null)).toBe('bewusst „Sonstiges“');
  });

  it('beschreibt eine gespeicherte Haushaltspraeferenz', () => {
    expect(describeCategorySource('household_preference', 'beverages')).toBe(
      'gespeicherte Präferenz',
    );
  });

  it('beschreibt einen automatischen OFF-Treffer', () => {
    expect(describeCategorySource('off_taxonomy', 'beverages')).toBe('automatisch · Produktdaten');
  });

  it('beschreibt einen automatischen Namens-Fallback', () => {
    expect(describeCategorySource('name_fallback', 'deli_meat')).toBe('automatisch · Name');
  });

  it('beschreibt den Fall ohne jeden automatischen Vorschlag', () => {
    expect(describeCategorySource(null, null)).toBe('kein Vorschlag');
  });
});
