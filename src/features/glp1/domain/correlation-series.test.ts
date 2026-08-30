import { buildCorrelationSeries } from './correlation-series';

describe('buildCorrelationSeries', () => {
  it('ordnet Zeitstempel mit unterschiedlichen Offsets chronologisch', () => {
    const earlier = {
      administeredAt: '2026-08-10T10:00:00+02:00',
      medicationName: 'Mounjaro',
      dose: 2.5,
      unit: 'mg',
    };
    const later = {
      administeredAt: '2026-08-10T09:30:00Z',
      medicationName: 'Mounjaro',
      dose: 5,
      unit: 'mg',
    };

    const [point] = buildCorrelationSeries({
      startDate: '2026-08-10',
      endDate: '2026-08-10',
      injections: [earlier, later],
      calorieEntries: [],
      weightEntries: [],
    });

    expect(point?.injection).toEqual(later);
    expect(point?.doseChanged).toBe(true);
  });

  it('ordnet jedem logischen Tag den Abstand zur letzten Injektion zu', () => {
    const series = buildCorrelationSeries({
      startDate: '2026-08-10',
      endDate: '2026-08-12',
      dayStartTime: '04:00',
      previousInjection: {
        administeredAt: '2026-08-09T05:00:00.000Z',
        medicationName: 'Mounjaro',
        dose: 5,
        unit: 'mg',
      },
      injections: [],
      calorieEntries: [],
      weightEntries: [],
    });

    expect(series.map(({ date, daysSinceInjection }) => ({ date, daysSinceInjection }))).toEqual([
      { date: '2026-08-10', daysSinceInjection: 1 },
      { date: '2026-08-11', daysSinceInjection: 2 },
      { date: '2026-08-12', daysSinceInjection: 3 },
    ]);
  });

  it('bewahrt Lücken bei Kalorien und Gewicht als null', () => {
    const series = buildCorrelationSeries({
      startDate: '2026-08-10',
      endDate: '2026-08-12',
      injections: [],
      calorieEntries: [
        { loggedOn: '2026-08-10', kcal: 800 },
        { loggedOn: '2026-08-10', kcal: 420 },
        { loggedOn: '2026-08-12', kcal: null },
      ],
      weightEntries: [
        { measuredOn: '2026-08-10', weightKg: 94.8 },
        { measuredOn: '2026-08-12', weightKg: 94.2 },
      ],
    });

    expect(series.map(({ date, calories, weightKg }) => ({ date, calories, weightKg }))).toEqual([
      { date: '2026-08-10', calories: 1220, weightKg: 94.8 },
      { date: '2026-08-11', calories: null, weightKg: null },
      { date: '2026-08-12', calories: null, weightKg: 94.2 },
    ]);
  });

  it('markiert Dosiswechsel nur bei verändertem Paar aus Dosis und Einheit', () => {
    const previousInjection = {
      administeredAt: '2026-08-03T10:00:00.000Z',
      medicationName: 'Mounjaro',
      dose: 2.5,
      unit: 'mg',
    };
    const injections = [
      { ...previousInjection, administeredAt: '2026-08-10T10:00:00.000Z' },
      { ...previousInjection, administeredAt: '2026-08-17T10:00:00.000Z', dose: 5 },
      {
        ...previousInjection,
        administeredAt: '2026-08-24T10:00:00.000Z',
        dose: 5,
        unit: 'units',
        injectionSite: 'Bauch rechts',
      },
    ];

    const series = buildCorrelationSeries({
      startDate: '2026-08-10',
      endDate: '2026-08-24',
      previousInjection,
      injections,
      calorieEntries: [],
      weightEntries: [],
    });

    expect(
      series
        .filter((point) => point.injection !== null)
        .map(({ date, injection, doseChanged }) => ({ date, injection, doseChanged })),
    ).toEqual([
      { date: '2026-08-10', injection: injections[0], doseChanged: false },
      { date: '2026-08-17', injection: injections[1], doseChanged: true },
      { date: '2026-08-24', injection: injections[2], doseChanged: true },
    ]);
  });
});
