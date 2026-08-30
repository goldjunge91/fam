import { resolveInjectionReminder } from './injection-reminder';

const IDENTIFIER = 'fam.glp1.injection-due.v1.user-1';
const PLAN = {
  anchorAt: '2099-09-01T08:00:00.000Z',
  cadenceDays: 7,
  reminderEnabled: true,
};
const NOW = new Date('2099-08-30T12:00:00.000Z');

describe('resolveInjectionReminder', () => {
  it('liefert keine Planung für einen fehlenden Plan', () => {
    expect(
      resolveInjectionReminder({
        identifier: IDENTIFIER,
        plan: null,
        latestInjectionAt: null,
        now: NOW,
      }),
    ).toEqual({ kind: 'cancel', identifier: IDENTIFIER });
  });

  it('entfernt die Erinnerung bei abgeschaltetem Plan', () => {
    expect(
      resolveInjectionReminder({
        identifier: IDENTIFIER,
        plan: { ...PLAN, reminderEnabled: false },
        latestInjectionAt: null,
        now: NOW,
      }),
    ).toEqual({ kind: 'cancel', identifier: IDENTIFIER });
  });

  it('plant den nächsten zukünftigen Termin', () => {
    expect(
      resolveInjectionReminder({
        identifier: IDENTIFIER,
        plan: PLAN,
        latestInjectionAt: null,
        now: NOW,
      }),
    ).toEqual({
      kind: 'schedule',
      identifier: IDENTIFIER,
      date: new Date('2099-09-01T08:00:00.000Z'),
      title: 'Injektion fällig',
      body: 'Deine Injektion ist fällig.',
    });
  });

  it('entfernt eine Erinnerung für einen bereits fälligen Termin', () => {
    expect(
      resolveInjectionReminder({
        identifier: IDENTIFIER,
        plan: PLAN,
        latestInjectionAt: '2099-08-20T08:00:00.000Z',
        now: NOW,
      }),
    ).toEqual({ kind: 'cancel', identifier: IDENTIFIER });
  });
});
