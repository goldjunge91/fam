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
      categoryId: 'meat_poultry',
      source: 'off_taxonomy',
      classifierVersion: CLASSIFIER_VERSION,
      evidence: { kind: 'off_tag', value: 'en:porks' },
    });
  });

  it('bevorzugt den spezifischeren Tag bei konkurrierenden Kategorien', () => {
    // en:fruit-juices (beverages, spezifisch) vs. en:vegetables (produce, mittel)
    expect(
      classifyCategory({
        name: 'Fruchtsaft mit Gemüseanteil',
        categoryTags: ['en:vegetables', 'en:fruit-juices'],
      }).categoryId,
    ).toBe('beverages');
  });

  it('liefert "Sonstiges", wenn zwei verschiedene Kategorien mit gleich hoher Priorität konkurrieren', () => {
    // en:porks (meat_poultry) und en:milks (dairy_eggs) sind beide "spezifisch"
    // gewichtet, aber unterschiedliche Kategorien — echter Gleichstand.
    const result = classifyCategory({
      name: 'Mysteriöses Mischprodukt',
      categoryTags: ['en:porks', 'en:milks'],
    });
    expect(result.categoryId).toBeNull();
    expect(result.source).toBeNull();
  });

  it('fällt bei fehlenden oder unbekannten OFF-Tags auf den Namens-Fallback zurück', () => {
    expect(classifyCategory({ name: 'Vollmilch' })).toEqual({
      categoryId: 'dairy_eggs',
      source: 'name_fallback',
      classifierVersion: CLASSIFIER_VERSION,
      evidence: { kind: 'name_rule', value: 'milch' },
    });

    expect(
      classifyCategory({ name: 'Vollmilch', categoryTags: ['en:some-unmapped-tag'] }).categoryId,
    ).toBe('dairy_eggs');
  });

  describe('deutsche Komposita ohne Fehlmatches', () => {
    it('"Schwein" als Ganzwort ist Fleisch, nicht faelschlich Getraenke', () => {
      expect(classifyCategory({ name: 'Schwein' }).categoryId).toBe('meat_poultry');
    });

    it('"Schwein" als Wortanfang in "Schweinefilet" bleibt Fleisch', () => {
      expect(classifyCategory({ name: 'Schweinefilet' }).categoryId).toBe('meat_poultry');
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

    it('"Edeka Brombeeren Tiefgefroren" mit botanischen Frucht-Tags wird als frozen erkannt', () => {
      expect(
        classifyCategory({
          name: 'Edeka Brombeeren Tiefgefroren',
          categoryTags: [
            'en:plant-based-foods-and-beverages',
            'en:plant-based-foods',
            'en:fruits-and-vegetables-based-foods',
            'en:fruits-based-foods',
            'en:fruits',
            'en:berries',
            'en:blackberries',
          ],
        }).categoryId,
      ).toBe('frozen');
    });

    it('"Hähnchenbrust" ist Fleisch ueber den Wortanfang', () => {
      expect(classifyCategory({ name: 'Hähnchenbrust' }).categoryId).toBe('meat_poultry');
    });

    it('"Weinessig" ist Öle, Essig & Gewürze, nicht Getraenke', () => {
      expect(classifyCategory({ name: 'Weinessig' }).categoryId).toBe('cooking_baking');
    });

    it('"Weinstein-Backpulver" ist Kochzutat trotz "Wein"-Praefix im ersten Token', () => {
      expect(classifyCategory({ name: 'Weinstein-Backpulver' }).categoryId).toBe('cooking_baking');
    });
  });
});

describe('classifyCategory über alle 21 Kategorien', () => {
  it.each([
    ['Apfel', 'produce'],
    ['Brötchen', 'bakery'],
    ['Fertigsalat', 'convenience'],
    ['Müsli', 'breakfast'],
    ['Kaffee', 'hot_beverages'],
    ['Nudeln', 'pantry_staples'],
    ['Olivenöl', 'cooking_baking'],
    ['Ketchup', 'canned_sauces'],
    ['Schokolade', 'snacks'],
    ['Mineralwasser', 'beverages'],
    ['Duschgel', 'drugstore'],
    ['Windeln', 'baby_kids'],
    ['Spülmittel', 'household'],
    ['Katzenfutter', 'pet_supplies'],
    ['Hackfleisch', 'meat_poultry'],
    ['Lachs', 'fish_seafood'],
    ['Salami', 'deli_cold_cuts'],
    ['Tofu', 'plant_based'],
    ['Joghurt', 'dairy_eggs'],
    ['Eiscreme', 'frozen'],
    ['Kaugummi', 'checkout'],
  ] as const)('erkennt "%s" als %s', (name, expectedCategoryId) => {
    expect(classifyCategory({ name }).categoryId).toBe(expectedCategoryId);
  });
});

describe('Mengen- und Einheitentokens', () => {
  it('ignoriert Zahl und Einheit vor dem eigentlichen Artikelnamen', () => {
    expect(classifyCategory({ name: '6 Eier' }).categoryId).toBe('dairy_eggs');
    expect(classifyCategory({ name: '500g Nudeln' }).categoryId).toBe('pantry_staples');
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
      categoryId: 'meat_poultry',
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
      categoryId: 'meat_poultry',
      value: 'en:porks',
      weight: 100,
      reason: 'tie',
    });
    expect(trace.rejectedCandidates).toContainEqual({
      kind: 'off_tag',
      categoryId: 'dairy_eggs',
      value: 'en:milks',
      weight: 100,
      reason: 'tie',
    });
  });

  it('input.normalizedName ist null, wenn nach Normalisierung kein Token uebrig bleibt', () => {
    expect(explainCategory({ name: '   ' }).input.normalizedName).toBeNull();
  });
});
