import { buildSeedData, buildWeightRows, createSeedId } from '../../../../scripts/glp1-seed';
import { assertSafeSeedTarget } from '../../../../scripts/glp1-seed-guard';

describe('GLP-1 seed target guard', () => {
  it('allows local Supabase targets', () => {
    expect(() => assertSafeSeedTarget('http://127.0.0.1:54321')).not.toThrow();
    expect(() => assertSafeSeedTarget('http://localhost:54321')).not.toThrow();
  });

  it('rejects non-local targets without an explicit override', () => {
    expect(() => assertSafeSeedTarget('https://project.supabase.co')).toThrow('nicht lokal');
  });

  it('allows a non-local target only with an explicit override', () => {
    expect(() => assertSafeSeedTarget('https://project.supabase.co', true)).not.toThrow();
  });

  it('rejects an invalid target even when the override is set', () => {
    expect(() => assertSafeSeedTarget('not-a-url', true)).toThrow('Ungültige Ziel-URL');
  });

  it('keeps deterministic IDs isolated between target accounts', () => {
    expect(createSeedId('account-a', 'medication', 0)).toBe(
      createSeedId('account-a', 'medication', 0),
    );
    expect(createSeedId('account-a', 'medication', 0)).not.toBe(
      createSeedId('account-b', 'medication', 0),
    );
  });

  it('seeds weekly weights at a deterministic time inside the 06:00 logical day', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 30, 12));

    try {
      const rows = buildWeightRows('account-a');
      const expectedDates = [
        '2026-06-08',
        '2026-06-15',
        '2026-06-22',
        '2026-06-29',
        '2026-07-06',
        '2026-07-13',
        '2026-07-20',
        '2026-07-27',
        '2026-08-03',
        '2026-08-10',
        '2026-08-17',
        '2026-08-24',
      ];

      expect(rows.map((row) => row.measured_on)).toEqual(expectedDates);
      expect(
        rows.map((row) => {
          if (typeof row.measured_at !== 'string') throw new Error('measured_at fehlt');
          const measuredAt = new Date(row.measured_at);
          const localDate = [
            measuredAt.getFullYear(),
            String(measuredAt.getMonth() + 1).padStart(2, '0'),
            String(measuredAt.getDate()).padStart(2, '0'),
          ].join('-');

          return {
            localDate,
            localTime: [
              measuredAt.getHours(),
              measuredAt.getMinutes(),
              measuredAt.getSeconds(),
              measuredAt.getMilliseconds(),
            ],
          };
        }),
      ).toEqual(
        expectedDates.map((localDate) => ({
          localDate,
          localTime: [7, 30, 0, 0],
        })),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('includes all four UI-review edge cases in the generated dataset', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 30, 12));

    try {
      const seed = buildSeedData('account-a');

      expect(seed.medications).toHaveLength(12);
      expect(seed.medications.some((row) => row.unit === 'ml')).toBe(true);
      expect(seed.medications.every((row) => row.injection_site !== null)).toBe(true);

      expect(
        seed.symptoms.some((row) => row.notes === 'Randfall: Symptomtag ohne Medikationseintrag'),
      ).toBe(true);
      expect(
        seed.symptoms.some((row) => {
          if (row.notes !== 'Randfall: vor dem Tagesstart um 06:00 erfasst') return false;
          if (typeof row.logged_at !== 'string') return false;
          const loggedAt = new Date(row.logged_at);
          return loggedAt.getHours() === 5 && loggedAt.getMinutes() === 15;
        }),
      ).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});
