import {
  discoverLocaleCatalogs,
  type LocaleCatalogSnapshot,
  loadLocaleCatalogs,
  parseLocaleCatalog,
  validateLocaleCatalogs,
} from './i18n-convention-support';

describe('i18n-Konventionen', () => {
  it('entdeckt aktive Sprachen und alle zugehörigen Katalogdateien', () => {
    expect(discoverLocaleCatalogs()).toEqual({
      languages: ['de', 'en'],
      features: ['common', 'dashboard', 'settings', 'shopping-list'],
    });
  });

  it('meldet einen Schlüssel, der in einem Locale fehlt', () => {
    const snapshot: LocaleCatalogSnapshot = {
      languages: ['de', 'en'],
      features: ['common'],
      catalogs: [
        {
          language: 'de',
          feature: 'common',
          path: 'common.de.json',
          values: new Map([['title', 'Titel']]),
          issues: [],
          missing: false,
        },
        {
          language: 'en',
          feature: 'common',
          path: 'common.en.json',
          values: new Map(),
          issues: [],
          missing: false,
        },
      ],
    };

    const errors = validateLocaleCatalogs(snapshot);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual(expect.stringContaining('common.en.json'));
    expect(errors[0]).toEqual(expect.stringContaining('title'));
  });

  it('akzeptiert die aktuellen Kataloge mit ihren Platzhaltern', () => {
    expect(validateLocaleCatalogs(loadLocaleCatalogs())).toEqual([]);
  });

  it('meldet unterschiedliche Platzhalter zwischen Locales', () => {
    const snapshot: LocaleCatalogSnapshot = {
      languages: ['de', 'en'],
      features: ['common'],
      catalogs: [
        {
          language: 'de',
          feature: 'common',
          path: 'common.de.json',
          values: new Map([['greeting', 'Hallo {{name}}']]),
          issues: [],
          missing: false,
        },
        {
          language: 'en',
          feature: 'common',
          path: 'common.en.json',
          values: new Map([['greeting', 'Hello']]),
          issues: [],
          missing: false,
        },
      ],
    };

    const errors = validateLocaleCatalogs(snapshot);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual(expect.stringContaining('Placeholder mismatch'));
    expect(errors[0]).toEqual(expect.stringContaining('greeting'));
  });

  it('meldet eine fehlende Locale-Datei', () => {
    const snapshot: LocaleCatalogSnapshot = {
      languages: ['de', 'en'],
      features: ['common'],
      catalogs: [
        {
          language: 'de',
          feature: 'common',
          path: 'common.de.json',
          values: new Map([['title', 'Titel']]),
          issues: [],
          missing: false,
        },
        {
          language: 'en',
          feature: 'common',
          path: 'common.en.json',
          values: new Map(),
          issues: [],
          missing: true,
        },
      ],
    };

    const errors = validateLocaleCatalogs(snapshot);

    expect(errors).toEqual(['Missing locale catalog for common (locale: en)']);
  });

  it('meldet leere und nicht-stringige Blattwerte', () => {
    const invalidCatalog = parseLocaleCatalog(
      'de',
      'common',
      'common.de.json',
      '{"empty":"", "nested":{"count":3}}',
    );
    const validCatalog = parseLocaleCatalog(
      'en',
      'common',
      'common.en.json',
      '{"empty":"Filled", "nested":{"count":"three"}}',
    );

    const errors = validateLocaleCatalogs({
      languages: ['de', 'en'],
      features: ['common'],
      catalogs: [invalidCatalog, validCatalog],
    });

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Empty translation value "empty"'),
        expect.stringContaining('Invalid translation value "nested.count"'),
      ]),
    );
  });
});
