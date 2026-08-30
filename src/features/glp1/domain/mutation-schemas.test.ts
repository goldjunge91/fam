import {
  deleteInjectionPlanMutationSchema,
  injectionPlanMutationSchema,
  medicationLogMutationSchema,
  symptomLogMutationSchema,
} from '@/features/glp1/domain/mutation-schemas';

describe('GLP-1 persistence validation', () => {
  it('normalisiert valide Injektionsdaten an der Persistenzgrenze', () => {
    expect(
      medicationLogMutationSchema.parse({
        userId: 'user-1',
        medicationName: ' Semaglutid ',
        dose: 0.5,
        unit: 'mg',
        injectionSite: 'abdomen',
        administeredAt: '2026-08-30T08:00:00.000Z',
        notes: ' morgens ',
      }),
    ).toEqual(
      expect.objectContaining({
        medicationName: 'Semaglutid',
        unit: 'mg',
        notes: 'morgens',
      }),
    );
  });

  it.each([
    [{ medicationName: '', dose: 1, unit: 'mg' }, 'Medikament'],
    [{ medicationName: 'Semaglutid', dose: -1, unit: 'mg' }, 'Dosis'],
    [{ medicationName: 'Semaglutid', dose: 1, unit: 'drops' }, 'Einheit'],
    [
      { medicationName: 'Semaglutid', dose: 1, unit: 'mg', injectionSite: 'hand' },
      'Injektionsstelle',
    ],
    [{ medicationName: 'Semaglutid', dose: 1, unit: 'mg', administeredAt: 'morgen' }, 'Zeitpunkt'],
  ])('verwirft ungueltige Injektionsdaten (%s)', (partial, _label) => {
    expect(() => medicationLogMutationSchema.parse({ userId: 'user-1', ...partial })).toThrow();
  });

  it.each([
    ['appetiteLevel', 0],
    ['satietyLevel', 6],
    ['nauseaLevel', -1],
  ] as const)('verwirft einen ungueltigen Symptomwert fuer %s', (field, value) => {
    expect(() =>
      symptomLogMutationSchema.parse({
        userId: 'user-1',
        appetiteLevel: 2,
        satietyLevel: 4,
        nauseaLevel: 0,
        [field]: value,
      }),
    ).toThrow();
  });

  it('verwirft einen ungueltigen Injektionsplan an der API-Grenze', () => {
    expect(() =>
      injectionPlanMutationSchema.parse({
        userId: 'user-1',
        medicationName: 'Semaglutid',
        dose: 0.5,
        unit: 'mg',
        cadenceDays: 0,
        anchorAt: 'kein-zeitpunkt',
        reminderEnabled: true,
      }),
    ).toThrow();
  });

  it('validiert auch das Löschen eines Injektionsplans an der API-Grenze', () => {
    expect(() => deleteInjectionPlanMutationSchema.parse({ id: ' ', userId: 'user-1' })).toThrow();
    expect(deleteInjectionPlanMutationSchema.parse({ id: 'plan-1', userId: ' user-1 ' })).toEqual({
      id: 'plan-1',
      userId: 'user-1',
    });
  });
});
