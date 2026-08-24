import { classifyPlacement, explainPlacement } from './placement-classifier';
import { fixtureInput, PLACEMENT_CLASSIFIER_FIXTURES } from './placement-classifier-fixtures';
import {
  normalizePlacementOrder,
  normalizePlacementZoneId,
  normalizePlacementZoneIdNullable,
  PLACEMENT_CLASSIFIER_VERSION,
  PLACEMENT_TAXONOMY_VERSION,
  PLACEMENT_ZONE_DEFINITIONS,
} from './placement-taxonomy';

describe('placement-taxonomy-v2', () => {
  it('enthält exakt die 27 kanonischen Zonen in Rangfolge', () => {
    expect(PLACEMENT_TAXONOMY_VERSION).toBe('placement-taxonomy-v2');
    expect(PLACEMENT_ZONE_DEFINITIONS).toHaveLength(27);
    expect(PLACEMENT_ZONE_DEFINITIONS.map((zone) => zone.rank)).toEqual(
      Array.from({ length: 27 }, (_, index) => (index + 1) * 10),
    );
    expect(PLACEMENT_ZONE_DEFINITIONS.at(-1)?.id).toBe('other');
  });

  it.each([
    ['produce', 'fresh_produce'],
    ['convenience', 'deli'],
    ['hot_beverages', 'hot_drinks'],
    ['pantry_staples', 'rice_world_foods'],
    ['cooking_baking', 'oils_spices'],
    ['checkout', 'other'],
    ['dairy', 'chilled_dairy_eggs'],
  ] as const)('normalisiert Legacy-ID %s nach %s', (legacyId, zoneId) => {
    expect(normalizePlacementZoneId(legacyId)).toBe(zoneId);
  });

  it('ignoriert unbekannte und doppelte IDs in einer Markt-Reihenfolge', () => {
    const normalized = normalizePlacementOrder(['future_zone', 'produce', 'fresh_produce']);

    expect(normalized[0]).toBe('fresh_produce');
    expect(normalized).toHaveLength(27);
    expect(normalizePlacementZoneIdNullable('future_zone')).toBeNull();
  });
});

describe('classifyPlacement', () => {
  it.each(PLACEMENT_CLASSIFIER_FIXTURES)(
    'klassifiziert $name in die erwartete V2-Domäne',
    (fixture) => {
      expect(classifyPlacement(fixtureInput(fixture))).toMatchObject({
        ...fixture.expected,
        classifierVersion: PLACEMENT_CLASSIFIER_VERSION,
      });
      const result = classifyPlacement(fixtureInput(fixture));
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    },
  );

  it('priorisiert spezifische OFF-Familien und liefert trotzdem die V2-Zone', () => {
    expect(
      classifyPlacement({
        name: 'Haferdrink',
        categoryTags: ['en:beverages', 'en:plant-based-foods'],
      }),
    ).toMatchObject({
      productFamilyId: 'plant_drink',
      productFormId: 'ambient',
      placementZoneId: 'ambient_milk_drinks',
    });
  });

  it('verwendet bei unbekanntem Signal die gültige Sonstiges-Zone', () => {
    const result = classifyPlacement({ name: 'Restposten XY' });
    expect(result.placementZoneId).toBe('other');
    expect(result.trace.evidence).toEqual({ kind: 'default', value: 'other' });
  });

  it('behandelt kurze Signale nur als vollständige Wörter', () => {
    expect(classifyPlacement({ name: 'Eis' }).placementZoneId).toBe('frozen');
    expect(classifyPlacement({ name: 'Ei' }).placementZoneId).toBe('chilled_dairy_eggs');
  });

  it('hält den vollständigen Legacy-Trace im V2-Trace fest', () => {
    const trace = explainPlacement({
      name: '2 Schnitzel vom Schwein',
      categoryTags: ['en:porks'],
      source: 'barcode',
    });
    expect(trace.classifierVersion).toBe(PLACEMENT_CLASSIFIER_VERSION);
    expect(trace.categoryTrace.winner.categoryId).toBe('meat_poultry');
    expect(trace.productFamilyId).toBe('meat');
    expect(trace.productFormId).toBe('chilled');
    expect(trace.placementZoneId).toBe('meat_poultry');
    expect(trace.resolutionSource).toBe('off_taxonomy');
  });
});
