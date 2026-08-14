import { fireEvent, render, screen } from '@testing-library/react-native';
import { PendingAuthBanner } from './pending-auth-banner';

jest.mock('@/features/auth/api', () => ({
  authErrorMessage: jest.fn((err) => err?.message || 'Fehler'),
  resendConfirmationEmail: jest.fn().mockResolvedValue({ error: null }),
  signIn: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
  signOut: jest.fn().mockResolvedValue({ error: null }),
  confirmSignUpWithCode: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
}));

jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
    },
  }),
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => require('@/constants/theme').Colors.light,
}));

describe('PendingAuthBanner (Apple Liquid UI)', () => {
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('sollte E-Mail-Adresse und Bestätigungs-Hinweis rendern', async () => {
    await render(
      <PendingAuthBanner
        email="test@example.com"
        onConfirmed={jest.fn()}
        onChangeEmail={jest.fn()}
      />,
    );

    expect(screen.getByText('Bestätigung ausstehend')).toBeTruthy();
    expect(screen.getByText('test@example.com')).toBeTruthy();
    expect(screen.getByText('Bestätigungs-E-Mail erneut senden')).toBeTruthy();
    expect(screen.getByText('Andere E-Mail-Adresse verwenden')).toBeTruthy();
  });

  it('sollte Re-Send E-Mail auslösen bei Klick auf den Button', async () => {
    const { resendConfirmationEmail } = require('@/features/auth/api');

    await render(<PendingAuthBanner email="test@example.com" onConfirmed={jest.fn()} />);

    const resendBtn = screen.getByText('Bestätigungs-E-Mail erneut senden');
    await fireEvent.press(resendBtn);

    expect(resendConfirmationEmail).toHaveBeenCalledWith('test@example.com');
  });

  it('sollte onChangeEmail auslösen wenn angeklickt', async () => {
    const onChangeEmailMock = jest.fn();

    await render(
      <PendingAuthBanner
        email="test@example.com"
        onConfirmed={jest.fn()}
        onChangeEmail={onChangeEmailMock}
      />,
    );

    const changeBtn = screen.getByText('Andere E-Mail-Adresse verwenden');
    await fireEvent.press(changeBtn);

    expect(onChangeEmailMock).toHaveBeenCalled();
  });

  it('sollte ohne Passwort gar nicht beim Server nachfragen', async () => {
    const { signIn } = require('@/features/auth/api');
    const onConfirmedMock = jest.fn();

    jest.useFakeTimers();

    await render(<PendingAuthBanner email="test@example.com" onConfirmed={onConfirmedMock} />);
    await jest.advanceTimersByTimeAsync(30_000);

    expect(signIn).not.toHaveBeenCalled();
    expect(onConfirmedMock).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  describe('Bestätigung von einem beliebigen Gerät', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('sollte weiterlaufen, sobald der Server die Adresse als bestätigt meldet', async () => {
      // Der Kern des Bug-Reports: Der Link wurde woanders geklickt (Rechner,
      // zweites Telefon). Die App bekommt davon keinen Deep Link — sie muss
      // selbst nachfragen, sonst haengt sie fuer immer im Wartezustand.
      const { signIn } = require('@/features/auth/api');
      signIn.mockResolvedValue({
        data: { session: { user: { email_confirmed_at: '2026-08-09T06:07:57Z' } } },
        error: null,
      });
      const onConfirmedMock = jest.fn();

      jest.useFakeTimers();

      await render(
        <PendingAuthBanner
          email="test@example.com"
          password="geheim-genug"
          onConfirmed={onConfirmedMock}
        />,
      );
      await jest.advanceTimersByTimeAsync(15_000);

      expect(signIn).toHaveBeenCalledWith('test@example.com', 'geheim-genug');
      expect(onConfirmedMock).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('sollte onConfirmed genau einmal auslösen, auch wenn mehrere Quellen melden', async () => {
      // Der Poll meldet die Bestaetigung, und weil signIn eine Session anlegt,
      // feuert zusaetzlich onAuthStateChange — dazu laeuft alle 3s der
      // getSession-Poll. In account-step.tsx ist onConfirmed das `onNext` des
      // Wizards: Jeder Aufruf zu viel ueberspringt einen Schritt.
      const { signIn } = require('@/features/auth/api');
      signIn.mockResolvedValue({
        data: { session: { user: { email_confirmed_at: '2026-08-09T06:07:57Z' } } },
        error: null,
      });
      const onConfirmedMock = jest.fn();

      jest.useFakeTimers();

      await render(
        <PendingAuthBanner
          email="test@example.com"
          password="geheim-genug"
          onConfirmed={onConfirmedMock}
        />,
      );
      // Lange genug fuer mehrere Durchlaeufe beider Poll-Intervalle.
      await jest.advanceTimersByTimeAsync(90_000);

      expect(onConfirmedMock).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });

    it('sollte warten, solange der Server die Bestätigung verweigert', async () => {
      const { signIn } = require('@/features/auth/api');
      signIn.mockResolvedValue({
        data: { session: null },
        error: new Error('Email not confirmed'),
      });
      const onConfirmedMock = jest.fn();

      jest.useFakeTimers();

      await render(
        <PendingAuthBanner
          email="test@example.com"
          password="geheim-genug"
          onConfirmed={onConfirmedMock}
        />,
      );
      await jest.advanceTimersByTimeAsync(30_000);

      expect(signIn).toHaveBeenCalled();
      expect(onConfirmedMock).not.toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('sollte eine Session ohne email_confirmed_at verwerfen und wieder abmelden (#128)', async () => {
      // Die Zusicherung, die frueher dadurch gehalten wurde, dass hier gar kein
      // signIn stattfand: Ein Server mit abgeschaltetem "Confirm email" darf
      // niemanden mit ungepruefter Adresse durchlassen. Jetzt wird die
      // Eigenschaft direkt geprueft statt das Verfahren.
      const { signIn, signOut } = require('@/features/auth/api');
      signIn.mockResolvedValue({
        data: { session: { user: { email_confirmed_at: null } } },
        error: null,
      });
      const onConfirmedMock = jest.fn();

      jest.useFakeTimers();

      await render(
        <PendingAuthBanner
          email="test@example.com"
          password="geheim-genug"
          onConfirmed={onConfirmedMock}
        />,
      );
      await jest.advanceTimersByTimeAsync(15_000);

      expect(signOut).toHaveBeenCalled();
      expect(onConfirmedMock).not.toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('sollte den Server nicht öfter als das Rate-Limit erlaubt befragen', async () => {
      // sign_in_sign_ups = 30 pro 5 Minuten und IP (supabase/config.toml).
      // Schnelleres Pollen wuerde das Kontingent aufbrauchen und echte
      // Anmeldeversuche mit blockieren.
      //
      // Simuliert werden 4 Intervall-Ticks (60s) statt der vollen 5 Minuten:
      // Der Poll laeuft ueber ein festes setInterval ohne Backoff, die Kadenz
      // ist in dieser Zeitspanne also bereits vollstaendig geprueft — und
      // schaerfer als vorher (exakte Kadenz statt nur einer Obergrenze).
      // Die vollen 300s zu simulieren hiesse zusaetzlich ~100 Ticks des
      // unabhaengigen Session-Polls (alle 3s, #166) und die Ring-/Punkt-
      // Animation durchlaufen zu lassen — das trieb den Test unter Last
      // ueber den 15s-testTimeout, ohne die Aussage zu verstaerken.
      const { signIn } = require('@/features/auth/api');
      signIn.mockResolvedValue({
        data: { session: null },
        error: new Error('Email not confirmed'),
      });

      jest.useFakeTimers();

      await render(
        <PendingAuthBanner
          email="test@example.com"
          password="geheim-genug"
          onConfirmed={jest.fn()}
        />,
      );
      await jest.advanceTimersByTimeAsync(4 * 15_000);

      // Bei 15s-Kadenz sind das in 5 Minuten 20 Anfragen, ein Drittel unter
      // dem Kontingent von 30 (siehe Intervall-Kommentar in
      // pending-auth-banner.tsx).
      expect(signIn.mock.calls.length).toBe(4);

      jest.useRealTimers();
    });
  });

  describe('Bestätigung per 6-stelligem Code', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('sollte einen gültigen Code einlösen und den Flow fortsetzen', async () => {
      const { confirmSignUpWithCode } = require('@/features/auth/api');
      confirmSignUpWithCode.mockResolvedValueOnce({
        data: { session: { user: { email_confirmed_at: '2026-08-09T06:07:57Z' } } },
        error: null,
      });
      const onConfirmedMock = jest.fn();

      await render(<PendingAuthBanner email="test@example.com" onConfirmed={onConfirmedMock} />);

      await fireEvent.changeText(screen.getByTestId('pending-auth-code'), '472913');
      await fireEvent.press(screen.getByText('Bestätigen'));

      expect(confirmSignUpWithCode).toHaveBeenCalledWith('test@example.com', '472913');
      expect(onConfirmedMock).toHaveBeenCalled();
    });

    it('sollte einen zu kurzen Code abweisen, ohne das Netz zu bemühen', async () => {
      const { confirmSignUpWithCode } = require('@/features/auth/api');

      await render(<PendingAuthBanner email="test@example.com" onConfirmed={jest.fn()} />);

      const input = screen.getByTestId('pending-auth-code');
      await fireEvent.changeText(input, '4729');
      // Der Button ist bei weniger als 6 Ziffern gesperrt; ueber die Tastatur
      // laesst sich trotzdem absenden — genau dafuer ist das Schema da.
      await fireEvent(input, 'submitEditing');

      expect(confirmSignUpWithCode).not.toHaveBeenCalled();
      expect(screen.getByText('Bitte die 6 Ziffern aus der E-Mail eingeben.')).toBeTruthy();
    });

    it('sollte Nicht-Ziffern aus der Eingabe entfernen (Copy-Paste aus dem Mailclient)', async () => {
      const { confirmSignUpWithCode } = require('@/features/auth/api');
      confirmSignUpWithCode.mockResolvedValueOnce({
        data: { session: { user: { email_confirmed_at: '2026-08-09T06:07:57Z' } } },
        error: null,
      });

      await render(<PendingAuthBanner email="test@example.com" onConfirmed={jest.fn()} />);

      await fireEvent.changeText(screen.getByTestId('pending-auth-code'), ' 472 913 ');
      await fireEvent.press(screen.getByText('Bestätigen'));

      expect(confirmSignUpWithCode).toHaveBeenCalledWith('test@example.com', '472913');
    });

    it('sollte einen bereits benutzten Code als solchen melden', async () => {
      const { confirmSignUpWithCode } = require('@/features/auth/api');
      confirmSignUpWithCode.mockResolvedValueOnce({
        data: { session: null },
        error: new Error('Token has expired or is invalid'),
      });
      const onConfirmedMock = jest.fn();

      await render(<PendingAuthBanner email="test@example.com" onConfirmed={onConfirmedMock} />);

      await fireEvent.changeText(screen.getByTestId('pending-auth-code'), '472913');
      await fireEvent.press(screen.getByText('Bestätigen'));

      expect(onConfirmedMock).not.toHaveBeenCalled();
      expect(screen.getByText('Token has expired or is invalid')).toBeTruthy();
    });
  });

  describe('Manueller "Jetzt prüfen"-Knopf', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('sollte den Button ohne Passwort gar nicht anbieten', async () => {
      await render(<PendingAuthBanner email="test@example.com" onConfirmed={jest.fn()} />);

      expect(screen.queryByText('Jetzt prüfen')).toBeNull();
    });

    it('sollte einen serverseitig bestätigten Account aus dem Wartezustand befreien', async () => {
      // Der Fall aus dem Bug-Report: /verify war erfolgreich, die Session kam
      // aber nie in der App an. Vorher gab es hier keinen Ausgang mehr.
      const { signIn } = require('@/features/auth/api');
      signIn.mockResolvedValueOnce({
        data: { session: { user: { email_confirmed_at: '2026-08-09T06:07:57Z' } } },
        error: null,
      });
      const onConfirmedMock = jest.fn();

      await render(
        <PendingAuthBanner
          email="test@example.com"
          password="geheim-genug"
          onConfirmed={onConfirmedMock}
        />,
      );

      await fireEvent.press(screen.getByText('Jetzt prüfen'));

      expect(signIn).toHaveBeenCalledWith('test@example.com', 'geheim-genug');
      expect(onConfirmedMock).toHaveBeenCalled();
    });

    it('sollte eine Session für eine unbestätigte Adresse verwerfen und wieder abmelden', async () => {
      // Schutz gegen einen Server, der "Confirm email" ausgeschaltet hat: eine
      // Session allein ist kein Beleg fuer eine gepruefte Adresse.
      const { signIn, signOut } = require('@/features/auth/api');
      signIn.mockResolvedValueOnce({
        data: { session: { user: { email_confirmed_at: null } } },
        error: null,
      });
      const onConfirmedMock = jest.fn();

      await render(
        <PendingAuthBanner
          email="test@example.com"
          password="geheim-genug"
          onConfirmed={onConfirmedMock}
        />,
      );

      await fireEvent.press(screen.getByText('Jetzt prüfen'));

      expect(signOut).toHaveBeenCalled();
      expect(onConfirmedMock).not.toHaveBeenCalled();
      expect(screen.getByText('Deine E-Mail-Adresse ist noch nicht bestätigt.')).toBeTruthy();
    });
  });

  it('sollte nach dem Erneut-Senden nicht behaupten, eine Mail sei verschickt worden', async () => {
    // Supabase antwortet auch dann mit 200, wenn gar keine Mail rausgeht — etwa
    // weil der Account laengst bestaetigt ist. Die alte Erfolgsmeldung
    // ("Bestätigungs-E-Mail erneut gesendet!") war damit nachweislich falsch.
    jest.clearAllMocks();

    await render(<PendingAuthBanner email="test@example.com" onConfirmed={jest.fn()} />);

    await fireEvent.press(screen.getByText('Bestätigungs-E-Mail erneut senden'));

    expect(screen.queryByText('Bestätigungs-E-Mail erneut gesendet!')).toBeNull();
    expect(screen.getByText(/Falls dein Konto noch nicht bestätigt ist/)).toBeTruthy();
  });
});
