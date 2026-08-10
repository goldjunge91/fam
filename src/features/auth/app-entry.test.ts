import { resolveAppEntry } from '@/features/auth/app-entry';

/**
 * Die Reihenfolge der Regeln ist hier die eigentliche Aussage — deshalb
 * prueft jeder Test genau eine davon, mit sonst unauffaelligen Werten.
 */
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
    // Der urspruenglich gemeldete Fehler: Ohne diese Regel landete eine
    // Erstinstallation im Haushalt-anlegen-Formular und scheiterte beim
    // Absenden mit `permission denied for function create_household`.
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
    // Regression: Das Flag setzt nur `persistOnboardingCompleted()` am Ende
    // des Flows. Wessen Konto anders entstanden ist, hat es nie bekommen —
    // eine Regel "nie gesehen also durchs Onboarding" schickte genau diese
    // Nutzer bei jedem Start dorthin, obwohl sie angemeldet sind und einen
    // Haushalt haben.
    expect(
      resolveAppEntry({
        ...angemeldetUndEingerichtet,
        hasSeenOnboarding: false,
        householdCount: 1,
      }),
    ).toEqual({ kind: 'weiter' });
  });

  it('schickt einen angemeldeten Nutzer mit unvollstaendigem Konto trotzdem ins Onboarding', () => {
    // Diese Entscheidung haengt am Konto (`profiles.onboarding_completed_at`),
    // nicht am Geraet — deshalb ueber `shouldPromptOnboarding`.
    expect(
      resolveAppEntry({
        ...angemeldetUndEingerichtet,
        hasSeenOnboarding: false,
        shouldPromptOnboarding: true,
      }),
    ).toEqual({ kind: 'umleiten', to: '/onboarding' });
  });

  it('wartet ohne Session nicht auf Ladevorgaenge', () => {
    // Ein Ladezustand waere hier eine Sackgasse: Ohne Session laedt nichts,
    // worauf zu warten sich lohnte.
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
    // Genau hier ist das Formular richtig — und der RPC dahinter darf laufen.
    expect(resolveAppEntry({ ...angemeldetUndEingerichtet, householdCount: 0 })).toEqual({
      kind: 'umleiten',
      to: '/household/create',
    });
  });

  it('leitet bei fehlgeschlagenem Haushalts-Request NICHT zum Anlegen um', () => {
    // Regression: Ein Kaltstart-Netzwerkfehler kollabierte households auf []
    // und schickte Nutzer mit echtem Haushalt faelschlich ins Anlegen-Formular.
    expect(
      resolveAppEntry({
        ...angemeldetUndEingerichtet,
        householdCount: 0,
        householdsError: true,
      }),
    ).toEqual({ kind: 'warten' });
  });

  it('bevorzugt das Onboarding gegenueber der Haushalts-Weiche', () => {
    // Beides trifft zu; ohne die Reihenfolge landete der Nutzer im Formular.
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
