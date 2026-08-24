import { classifyPlacement } from './placement-classifier';
import { resolvePlacement } from './placement-resolver';

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
});
