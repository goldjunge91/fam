import {
  type DynamicTranslationReference,
  discoverLocaleCatalogs,
  extractHardcodedUiTextReferences,
  extractLiteralTranslationReferences,
  findProductionDynamicTranslationReferences,
  findProductionHardcodedUiTextReferences,
  findProductionTranslationReferences,
  formatHardcodedUiTextReport,
  type LocaleCatalogSnapshot,
  loadLocaleCatalogs,
  parseLocaleCatalog,
  type TranslationReference,
  validateDynamicTranslationReferences,
  validateLocaleCatalogs,
  validateTranslationReferences,
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

  it('erkennt literale t- und i18n.t-Referenzen per TypeScript-AST', () => {
    const dynamicExpression = '${' + 'group}';
    const references = extractLiteralTranslationReferences(
      [
        '',
        "const title = t('settings.title');",
        'const item = i18n.t("shoppingList.addItem");',
        `const dynamic = t(\`settings.groups.${dynamicExpression}.label\`);`,
      ].join('\n'),
      'fixture.ts',
    );

    expect(references).toEqual([
      { key: 'settings.title', line: 2, path: 'fixture.ts' },
      { key: 'shoppingList.addItem', line: 3, path: 'fixture.ts' },
    ]);
  });

  it('akzeptiert alle aktuellen literalen Produktionsreferenzen', () => {
    expect(
      validateTranslationReferences(findProductionTranslationReferences(), loadLocaleCatalogs()),
    ).toEqual([]);
  });

  it('meldet unbekannte literale Keys mit Quelle und Locale', () => {
    const reference: TranslationReference = {
      key: 'settings.doesNotExist',
      line: 12,
      path: 'src/features/settings/example.tsx',
    };

    const errors = validateTranslationReferences([reference], loadLocaleCatalogs());

    expect(errors).toHaveLength(2);
    expect(errors[0]).toEqual(expect.stringContaining('src/features/settings/example.tsx:12'));
    expect(errors[0]).toEqual(expect.stringContaining('settings.doesNotExist'));
    expect(errors.join('\n')).toEqual(expect.stringContaining('locale: de'));
    expect(errors.join('\n')).toEqual(expect.stringContaining('locale: en'));
  });

  it('prüft alle aktuellen dynamischen Referenzen über ihre endlichen Typwerte', () => {
    const references = findProductionDynamicTranslationReferences();

    expect(references).toHaveLength(8);
    expect(references.every((reference) => reference.keys?.length)).toBe(true);
    expect(validateDynamicTranslationReferences(references, loadLocaleCatalogs())).toEqual([]);
  });

  it('meldet einen fehlenden konkret expandierten dynamischen Key', () => {
    const reference: DynamicTranslationReference = {
      expression: 'group',
      keys: ['settings.groups.data.privacy.missing'],
      line: 42,
      path: 'src/features/settings/example.tsx',
    };

    const errors = validateDynamicTranslationReferences([reference], loadLocaleCatalogs());

    expect(errors).toHaveLength(2);
    expect(errors.join('\n')).toEqual(
      expect.stringContaining('settings.groups.data.privacy.missing'),
    );
    expect(errors.join('\n')).toEqual(
      expect.stringContaining('src/features/settings/example.tsx:42'),
    );
  });

  it('meldet einen dynamischen Key ohne endliche Wertemenge', () => {
    const reference: DynamicTranslationReference = {
      expression: 'serverValue',
      keys: null,
      line: 7,
      path: 'src/features/example.tsx',
    };

    expect(validateDynamicTranslationReferences([reference], loadLocaleCatalogs())).toEqual([
      'Untestable dynamic translation key at src/features/example.tsx:7: serverValue',
    ]);
  });

  it('erkennt sichtbare hartcodierte JSX- und Alert-Texte mit Position', () => {
    const references = extractHardcodedUiTextReferences(
      [
        '<Text>Anmelden</Text>',
        '<Button title="Speichern" />',
        "<TextInput placeholder={'Suchen'} />",
        "Alert.alert('Fehler', 'Nicht gespeichert');",
        '<Button testID="technical-id" title={buttonTitle} />',
      ].join('\n'),
      'fixture.tsx',
    );

    expect(references).toEqual([
      { text: 'Anmelden', line: 1, path: 'fixture.tsx', position: 'jsx-text' },
      { text: 'Speichern', line: 2, path: 'fixture.tsx', position: 'attribute:title' },
      { text: 'Suchen', line: 3, path: 'fixture.tsx', position: 'attribute:placeholder' },
      { text: 'Fehler', line: 4, path: 'fixture.tsx', position: 'alert-title' },
      { text: 'Nicht gespeichert', line: 4, path: 'fixture.tsx', position: 'alert-message' },
    ]);
  });

  it('gibt bestehende Hardcode-Funde report-only aus', () => {
    const references = findProductionHardcodedUiTextReferences();

    expect(Array.isArray(references)).toBe(true);
    if (references.length > 0) console.info(formatHardcodedUiTextReport(references));
  });
});
