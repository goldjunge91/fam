import { calculateInjectionDue } from './injection-due';

const WEEKLY_PLAN = {
  anchorAt: '2026-08-31T08:00:00.000Z',
  cadenceDays: 7,
};

describe('calculateInjectionDue', () => {
  it('meldet einen Termin am selben Kalendertag als heute faellig', () => {
    expect(calculateInjectionDue(WEEKLY_PLAN, null, new Date('2026-08-31T18:00:00.000Z'))).toEqual({
      nextDueAt: '2026-08-31T08:00:00.000Z',
      status: 'due_today',
    });
  });

  it('berechnet den naechsten puenktlichen Termin aus der letzten Injektion', () => {
    expect(
      calculateInjectionDue(
        WEEKLY_PLAN,
        { administeredAt: '2026-08-24T08:00:00.000Z' },
        new Date('2026-08-30T12:00:00.000Z'),
      ),
    ).toEqual({
      nextDueAt: '2026-08-31T08:00:00.000Z',
      status: 'upcoming',
    });
  });

  it('meldet einen vergangenen Kalendertag als ueberfaellig', () => {
    expect(
      calculateInjectionDue(
        WEEKLY_PLAN,
        { administeredAt: '2026-08-20T08:00:00.000Z' },
        new Date('2026-08-30T12:00:00.000Z'),
      ),
    ).toEqual({
      nextDueAt: '2026-08-27T08:00:00.000Z',
      status: 'overdue',
    });
  });

  it('ueberspringt eine ausgelassene Dosis nicht automatisch', () => {
    expect(
      calculateInjectionDue(
        WEEKLY_PLAN,
        { administeredAt: '2026-08-01T08:00:00.000Z' },
        new Date('2026-08-30T12:00:00.000Z'),
      ),
    ).toEqual({
      nextDueAt: '2026-08-08T08:00:00.000Z',
      status: 'overdue',
    });
  });

  it('wendet eine geaenderte Kadenz auf die letzte Injektion an', () => {
    expect(
      calculateInjectionDue(
        { ...WEEKLY_PLAN, cadenceDays: 14 },
        { administeredAt: '2026-08-20T08:00:00.000Z' },
        new Date('2026-08-30T12:00:00.000Z'),
      ),
    ).toEqual({
      nextDueAt: '2026-09-03T08:00:00.000Z',
      status: 'upcoming',
    });
  });

  it('nutzt ohne bisherigen Eintrag den Ankerzeitpunkt', () => {
    expect(calculateInjectionDue(WEEKLY_PLAN, null, new Date('2026-08-20T12:00:00.000Z'))).toEqual({
      nextDueAt: '2026-08-31T08:00:00.000Z',
      status: 'upcoming',
    });
  });
});
