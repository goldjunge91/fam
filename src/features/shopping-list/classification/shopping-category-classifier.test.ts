import { CLASSIFIER_VERSION } from './classifier-version';
import { classifyCategory, explainCategory } from './shopping-category-classifier';

describe('classifyCategory', () => {
  it('liefert "Sonstiges" ohne Regelanwendung, wenn kein Signal passt', () => {
    expect(classifyCategory({ name: 'Restposten XY' })).toEqual({
      categoryId: null,
      source: null,
      classifierVersion: CLASSIFIER_VERSION,
    });
  });

  it('erkennt Fleisch anhand des kanonischen OFF-Tags "en:porks"', () => {
    expect(
      classifyCategory({
        name: '2 Schnitzel vom Schwein Spar Fein Küche',
        categoryTags: ['en:porks'],
      }),
    ).toEqual({
      categoryId: 'deli_meat',
      source: 'off_taxonomy',
      classifierVersion: CLASSIFIER_VERSION,
      evidence: { kind: 'off_tag', value: 'en:porks' },
    });
  });

  it('bevorzugt den spezifischeren Tag bei konkurrierenden Kategorien', () => {
    expect(
      classifyCategory({
        name: 'Fruchtsaft mit Gemüseanteil',
        categoryTags: ['en:vegetables', 'en:fruit-juices'],
      }).categoryId,
    ).toBe('beverages');
  });

  it('liefert "Sonstiges", wenn zwei verschiedene Kategorien mit gleich hoher Priorität konkurrieren', () => {
    const result = classifyCategory({
      name: 'Mysteriöses Mischprodukt',
      categoryTags: ['en:porks', 'en:milks'],
    });
    expect(result.categoryId).toBeNull();
    expect(result.source).toBeNull();
  });

  it('fällt bei fehlenden oder unbekannten OFF-Tags auf den Namens-Fallback zurück', () => {
    expect(classifyCategory({ name: 'Vollmilch' })).toEqual({
      categoryId: 'dairy',
      source: 'name_fallback',
      classifierVersion: CLASSIFIER_VERSION,
      evidence: { kind: 'name_rule', value: 'milch' },
    });

    expect(
      classifyCategory({ name: 'Vollmilch', categoryTags: ['en:some-unmapped-tag'] }).categoryId,
    ).toBe('dairy');
  });

  describe('deutsche Komposita ohne Fehlmatches', () => {
    it('"Schwein" als Ganzwort ist Fleisch, nicht faelschlich Getraenke', () => {
      expect(classifyCategory({ name: 'Schwein' }).categoryId).toBe('deli_meat');
    });

    it('"Schwein" als Wortanfang in "Schweinefilet" bleibt Fleisch', () => {
      expect(classifyCategory({ name: 'Schweinefilet' }).categoryId).toBe('deli_meat');
    });

    it('"Wein" als Ganzwort ist Getraenke', () => {
      expect(classifyCategory({ name: 'Wein' }).categoryId).toBe('beverages');
    });

    it('"wein" matcht nicht als Teilstring in "Schwein"', () => {
      expect(classifyCategory({ name: 'Schwein' }).categoryId).not.toBe('beverages');
    });

    it('"Apfelsaft" ist Getraenke (Grundwort "saft" schlaegt Modifier "apfel")', () => {
      expect(classifyCategory({ name: 'Apfelsaft' })).toEqual({
        categoryId: 'beverages',
        source: 'name_fallback',
        classifierVersion: CLASSIFIER_VERSION,
        evidence: { kind: 'name_rule', value: 'saft' },
      });
    });

    it('"Vollkornbrot" ist Backwaren ueber das Grundwort "brot"', () => {
      expect(classifyCategory({ name: 'Vollkornbrot' }).categoryId).toBe('bakery');
    });

    it('"Tiefkühlpizza" ist Tiefkühlkost ueber den expliziten Marker', () => {
      expect(classifyCategory({ name: 'Tiefkühlpizza' }).categoryId).toBe('frozen');
    });

    it('"Hähnchenbrust" ist Fleisch ueber den Wortanfang', () => {
      expect(classifyCategory({ name: 'Hähnchenbrust' }).categoryId).toBe('deli_meat');
    });

    it('"Weinessig" ist Grundnahrungsmittel, nicht Getraenke', () => {
      expect(classifyCategory({ name: 'Weinessig' }).categoryId).toBe('pantry_dry');
    });

    it('"Weinstein-Backpulver" ist Grundnahrungsmittel trotz "Wein"-Praefix im ersten Token', () => {
      expect(classifyCategory({ name: 'Weinstein-Backpulver' }).categoryId).toBe('pantry_dry');
    });
  });
});

describe('classifyCategory über alle zwölf Kategorien', () => {
  it.each([
    ['Apfel', 'produce'],
    ['Brötchen', 'bakery'],
    ['Hackfleisch', 'deli_meat'],
    ['Ketchup', 'pantry_canned'],
    ['Nudeln', 'pantry_dry'],
    ['Müsli', 'breakfast'],
    ['Schokolade', 'snacks'],
    ['Mineralwasser', 'beverages'],
    ['Joghurt', 'dairy'],
    ['Eiscreme', 'frozen'],
    ['Duschgel', 'drugstore'],
    ['Kaugummi', 'checkout'],
  ] as const)('erkennt "%s" als %s', (name, expectedCategoryId) => {
    expect(classifyCategory({ name }).categoryId).toBe(expectedCategoryId);
  });
});

describe('Mengen- und Einheitentokens', () => {
  it('ignoriert Zahl und Einheit vor dem eigentlichen Artikelnamen', () => {
    expect(classifyCategory({ name: '6 Eier' }).categoryId).toBe('dairy');
    expect(classifyCategory({ name: '500g Nudeln' }).categoryId).toBe('pantry_dry');
  });
});

describe('explainCategory', () => {
  it('liefert einen vollständigen Trace mit Eingabe, Kandidat und Gewinner', () => {
    const trace = explainCategory({
      name: '2 Schnitzel vom Schwein Spar Fein Küche',
      categoryTags: ['en:porks'],
      source: 'barcode',
      dataVersion: '2026-08-01',
    });

    expect(trace.classifierVersion).toBe(CLASSIFIER_VERSION);
    expect(trace.input).toEqual({
      source: 'barcode',
      dataVersion: '2026-08-01',
      categoryTags: ['en:porks'],
      normalizedName: 'schnitzel vom schwein spar fein küche',
    });
    expect(trace.winner).toEqual(
      classifyCategory({
        name: '2 Schnitzel vom Schwein Spar Fein Küche',
        categoryTags: ['en:porks'],
      }),
    );
    expect(trace.candidates).toContainEqual({
      kind: 'off_tag',
      categoryId: 'deli_meat',
      value: 'en:porks',
      weight: 100,
    });
    expect(trace.conflictReason).toBeNull();
  });

  it('markiert einen echten Gleichstand mit Konfliktgrund und verworfenen Kandidaten', () => {
    const trace = explainCategory({
      name: 'Mysteriöses Mischprodukt',
      categoryTags: ['en:porks', 'en:milks'],
    });

    expect(trace.winner.categoryId).toBeNull();
    expect(trace.winner.source).toBeNull();
    expect(trace.conflictReason).not.toBeNull();
    expect(trace.rejectedCandidates).toContainEqual({
      kind: 'off_tag',
      categoryId: 'deli_meat',
      value: 'en:porks',
      weight: 100,
      reason: 'tie',
    });
    expect(trace.rejectedCandidates).toContainEqual({
      kind: 'off_tag',
      categoryId: 'dairy',
      value: 'en:milks',
      weight: 100,
      reason: 'tie',
    });
  });

  it('input.normalizedName ist null, wenn nach Normalisierung kein Token uebrig bleibt', () => {
    expect(explainCategory({ name: '   ' }).input.normalizedName).toBeNull();
  });
});
