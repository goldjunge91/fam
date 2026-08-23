import { resolveAppEntry } from '@/features/auth/app-entry';

const angemeldetUndEingerichtet = {
  hasSession: true,
  hasSeenOnboarding: true,
  isLoading: false,
  shouldPromptOnboarding: false,
  householdCount: 1,
};

describe('resolveAppEntry', () => {
  it('laesst einen eingerichteten, angemeldeten Nutzer durch', () => {
    expect(resolveAppEntry(angemeldetUndEingerichtet)).toEqual({ kind: 'weiter' });
  });

  it('schickt eine Erstinstallation ohne Session ins Onboarding', () => {
    expect(
      resolveAppEntry({
        ...angemeldetUndEingerichtet,
        hasSession: false,
        hasSeenOnboarding: false,
      }),
    ).toEqual({ kind: 'umleiten', to: '/onboarding' });
  });

  it('schickt ein bekanntes Geraet ohne Session zum Anmelden, nicht ins Onboarding', () => {
    expect(
      resolveAppEntry({
        ...angemeldetUndEingerichtet,
        hasSession: false,
        hasSeenOnboarding: true,
      }),
    ).toEqual({ kind: 'umleiten', to: '/sign-in' });
  });

  it('laesst einen eingerichteten Nutzer OHNE Geraete-Flag durch', () => {
    expect(
      resolveAppEntry({
        ...angemeldetUndEingerichtet,
        hasSeenOnboarding: false,
        householdCount: 1,
      }),
    ).toEqual({ kind: 'weiter' });
  });

  it('schickt einen angemeldeten Nutzer mit unvollstaendigem Konto trotzdem ins Onboarding', () => {
    expect(
      resolveAppEntry({
        ...angemeldetUndEingerichtet,
        hasSeenOnboarding: false,
        shouldPromptOnboarding: true,
      }),
    ).toEqual({ kind: 'umleiten', to: '/onboarding' });
  });

  it('wartet ohne Session nicht auf Ladevorgaenge', () => {
    expect(
      resolveAppEntry({ ...angemeldetUndEingerichtet, hasSession: false, isLoading: true }),
    ).toEqual({ kind: 'umleiten', to: '/sign-in' });
  });

  it('wartet mit Session, solange Profil oder Haushalte laden', () => {
    expect(resolveAppEntry({ ...angemeldetUndEingerichtet, isLoading: true })).toEqual({
      kind: 'warten',
    });
  });

  it('folgt dem Onboarding-Guard fuer unvollstaendige Konten', () => {
    expect(resolveAppEntry({ ...angemeldetUndEingerichtet, shouldPromptOnboarding: true })).toEqual(
      { kind: 'umleiten', to: '/onboarding' },
    );
  });

  it('schickt erst den angemeldeten Nutzer ohne Haushalt zum Anlegen', () => {
    expect(resolveAppEntry({ ...angemeldetUndEingerichtet, householdCount: 0 })).toEqual({
      kind: 'umleiten',
      to: '/household/create',
    });
  });

  it('leitet bei fehlgeschlagenem Haushalts-Request NICHT zum Anlegen um', () => {
    expect(
      resolveAppEntry({
        ...angemeldetUndEingerichtet,
        householdCount: 0,
        householdsError: true,
      }),
    ).toEqual({ kind: 'warten' });
  });

  it('bevorzugt das Onboarding gegenueber der Haushalts-Weiche', () => {
    expect(
      resolveAppEntry({
        ...angemeldetUndEingerichtet,
        hasSession: false,
        hasSeenOnboarding: false,
        householdCount: 0,
      }),
    ).toEqual({ kind: 'umleiten', to: '/onboarding' });
  });
});
