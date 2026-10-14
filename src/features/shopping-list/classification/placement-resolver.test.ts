import { classifyPlacement } from './placement-classifier';
import { normalizeCategoryClassification, resolvePlacement } from './placement-resolver';
import { classifyCategory } from './shopping-category-classifier';

describe('resolvePlacement', () => {
  const globalClassification = classifyPlacement({ name: 'Haferdrink' });

  it('wendet Haushalt, Markt und Snapshot in der fachlichen Reihenfolge an', () => {
    expect(
      resolvePlacement({
        globalClassification,
        householdPreference: 'cold_drinks',
        storePreference: 'chilled_plant_based',
        snapshot: { placementZoneId: 'frozen', classifierVersion: 'snapshot-v1' },
      }),
    ).toMatchObject({ placementZoneId: 'frozen', classifierVersion: 'snapshot-v1' });
  });

  it('normalisiert bekannte Legacy-Werte und ignoriert unbekannte Werte', () => {
    expect(
      resolvePlacement({
        globalClassification,
        householdPreference: 'dairy',
        storePreference: 'future_zone',
      }).placementZoneId,
    ).toBe('chilled_dairy_eggs');
  });

  it('keeps the global placement when there are no applicable overrides', () => {
    expect(resolvePlacement({ globalClassification }).placementZoneId).toBe(
      globalClassification.placementZoneId,
    );
    expect(
      resolvePlacement({
        globalClassification,
        householdPreference: 'future_zone',
        storePreference: '',
      }).placementZoneId,
    ).toBe(globalClassification.placementZoneId);
  });

  it('uses a legacy category snapshot and keeps the global version when absent', () => {
    expect(
      resolvePlacement({
        globalClassification,
        snapshot: { placementZoneId: null, categoryId: 'dairy', classifierVersion: null },
      }),
    ).toMatchObject({
      placementZoneId: 'chilled_dairy_eggs',
      classifierVersion: globalClassification.classifierVersion,
    });
  });

  it('ignores an unknown snapshot zone', () => {
    expect(
      resolvePlacement({
        globalClassification,
        snapshot: { placementZoneId: 'future_zone' },
      }).placementZoneId,
    ).toBe(globalClassification.placementZoneId);
  });

  it('normalizes the legacy category adapter output', () => {
    const classification = classifyCategory({ name: 'Haferdrink' });

    expect(normalizeCategoryClassification(classification)).toEqual(classification);
  });
});
