import { act, fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { Alert } from 'react-native';
import { selection as hapticSelection } from '@/lib/platform/haptics';

import { InviteModal } from './invite-modal';

const mockCreateInvite = jest.fn().mockResolvedValue({ token: 'new-token-456', code: 'NEWA12' });
const mockRevokeInvite = jest.fn().mockResolvedValue(undefined);
const mockDebugError = jest.fn();

// Mock Provider & Hooks
jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-123' } } }),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/lib/platform/haptics', () => ({
  heavy: jest.fn(),
  light: jest.fn(),
  medium: jest.fn(),
  selection: jest.fn(),
  success: jest.fn(),
}));

jest.mock('@/lib/observability/debug-log', () => ({
  debugError: (...args: unknown[]) => mockDebugError(...args),
}));

jest.mock('@/features/household/api', () => ({
  useHouseholdInvites: () => ({
    data: [
      {
        id: 'inv-1',
        token: 'token-abc-123',
        code: 'AB12CD',
        household_id: 'hh-1',
        created_by: 'user-123',
        expires_at: '2026-12-31T23:59:59Z',
        uses: 0,
        max_uses: 5,
      },
    ],
  }),
  useCreateInviteMutation: () => ({
    mutateAsync: mockCreateInvite,
    isPending: false,
  }),
  useRevokeInviteMutation: () => ({
    mutateAsync: mockRevokeInvite,
  }),
}));

describe('InviteModal & QR Code Component', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockCreateInvite.mockReset().mockResolvedValue({ token: 'new-token-456', code: 'NEWA12' });
    mockRevokeInvite.mockReset().mockResolvedValue(undefined);
    jest.mocked(hapticSelection).mockClear();
  });

  afterEach(async () => {
    // `handleCopyCode` und `handleCopyLink` setzen Feedback-Timer. Wie in der
    // Timer-Referenzdemo werden sie vor dem Wechsel zur echten Uhr abgearbeitet.
    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('sollte Einladungs-Modal und aktive Einladungen rendern', async () => {
    await render(
      <InviteModal
        visible={true}
        householdId="hh-1"
        householdName="Test Haushalt"
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText('Mitglied einladen')).toBeOnTheScreen();
    expect(screen.getAllByText('AB12CD').length).toBeGreaterThan(0);
  });

  it('sollte nach Erstellung eines neuen Tokens den QR-Code anzeigen und Umschalt-Button rendern', async () => {
    await render(
      <InviteModal
        visible={true}
        householdId="hh-1"
        householdName="Test Haushalt"
        onClose={jest.fn()}
      />,
    );

    const createBtn = screen.getByText('+ Einladungs-Link erstellen');
    await fireEvent.press(createBtn);

    expect(screen.getByText('NEWA12')).toBeOnTheScreen();
    expect(screen.getByText('QR-Code ausblenden')).toBeTruthy();

    await fireEvent.press(screen.getByText('QR-Code ausblenden'));
    expect(screen.getByText('QR-Code anzeigen')).toBeTruthy();
  });

  it('sollte QR-Code anzeigen, wenn eine bestehende aktive Einladung ausgewählt wird', async () => {
    await render(
      <InviteModal
        visible={true}
        householdId="hh-1"
        householdName="Test Haushalt"
        onClose={jest.fn()}
      />,
    );

    const qrIconBtn = screen.getByLabelText('QR-Code anzeigen');
    await fireEvent.press(qrIconBtn);

    expect(screen.getByText('Einladungs-Code & QR-Code')).toBeTruthy();
    expect(screen.getByText('Code kopieren')).toBeTruthy();
    expect(screen.getByText('Link kopieren')).toBeTruthy();
  });

  it('verwendet Selection-Feedback bei der Auswahl einer Einladung', async () => {
    const user = userEvent.setup();
    await render(
      <InviteModal
        visible={true}
        householdId="hh-1"
        householdName="Test Haushalt"
        onClose={jest.fn()}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Einladung AB12CD auswählen' }));

    expect(hapticSelection).toHaveBeenCalledTimes(1);
  });

  it('sollte reinen Code und Link separat in die Zwischenablage kopieren', async () => {
    await render(
      <InviteModal
        visible={true}
        householdId="hh-1"
        householdName="Test Haushalt"
        onClose={jest.fn()}
      />,
    );

    // Klick auf eine bestehende Einladung
    await fireEvent.press(screen.getByLabelText('QR-Code anzeigen'));

    // Code kopieren
    const copyCodeBtn = screen.getByText('Code kopieren');
    await fireEvent.press(copyCodeBtn);
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('AB12CD');

    // Link kopieren
    const copyLinkBtn = screen.getByText('Link kopieren');
    await fireEvent.press(copyLinkBtn);
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('fam://join?token=token-abc-123');
  });

  it('meldet einen Fehler beim Erstellen eines Einladungslinks', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockCreateInvite.mockRejectedValueOnce(new Error('Einladungen sind gerade nicht verfügbar'));
    await render(
      <InviteModal
        visible={true}
        householdId="hh-1"
        householdName="Test Haushalt"
        onClose={jest.fn()}
      />,
    );

    await fireEvent.press(screen.getByText('+ Einladungs-Link erstellen'));

    expect(alert).toHaveBeenCalledWith('Fehler', 'Einladungen sind gerade nicht verfügbar');
    expect(screen.queryByText('NEWA12')).toBeNull();
    alert.mockRestore();
  });

  it('zieht eine Einladung erst nach Bestätigung zurück', async () => {
    let confirm: (() => void) | undefined;
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      confirm = buttons?.find((button) => button.style === 'destructive')?.onPress;
    });
    await render(
      <InviteModal
        visible={true}
        householdId="hh-1"
        householdName="Test Haushalt"
        onClose={jest.fn()}
      />,
    );

    await fireEvent.press(screen.getByLabelText('Zurückziehen'));

    expect(alert).toHaveBeenCalledWith(
      'Einladung zurückziehen',
      expect.any(String),
      expect.any(Array),
    );
    expect(mockRevokeInvite).not.toHaveBeenCalled();
    await act(async () => {
      await confirm?.();
    });
    expect(mockRevokeInvite).toHaveBeenCalledWith({ inviteId: 'inv-1', householdId: 'hh-1' });
    alert.mockRestore();
  });

  it('erfasst einen fehlgeschlagenen Clipboard-Aufruf, ohne die Einladung zu verlieren', async () => {
    jest.mocked(Clipboard.setStringAsync).mockRejectedValueOnce(new Error('Clipboard disabled'));
    await render(
      <InviteModal
        visible={true}
        householdId="hh-1"
        householdName="Test Haushalt"
        onClose={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByLabelText('QR-Code anzeigen'));
    await fireEvent.press(screen.getByText('Code kopieren'));

    expect(mockDebugError).toHaveBeenCalledWith(
      'Fehler beim Kopieren des Codes:',
      expect.any(Error),
    );
    expect(screen.getAllByText('AB12CD').length).toBeGreaterThan(0);
  });
});
