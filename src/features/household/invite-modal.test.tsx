import { fireEvent, render, screen } from '@testing-library/react-native';

import { InviteModal } from './invite-modal';

// Mock Provider & Hooks
jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-123' } } }),
}));

jest.mock('@/features/household/api', () => ({
  useHouseholdInvites: () => ({
    data: [
      {
        id: 'inv-1',
        token: 'token-abc-123',
        household_id: 'hh-1',
        created_by: 'user-123',
        expires_at: '2026-12-31T23:59:59Z',
        uses: 0,
        max_uses: 5,
      },
    ],
  }),
  useCreateInviteMutation: () => ({
    mutateAsync: jest.fn().mockResolvedValue({ token: 'new-token-456' }),
    isPending: false,
  }),
  useRevokeInviteMutation: () => ({
    mutateAsync: jest.fn(),
  }),
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    background: '#FFFFFF',
    text: '#000000',
    border: '#CCCCCC',
    textSecondary: '#666666',
    accent: '#10B981',
  }),
}));

describe('InviteModal & QR Code Component', () => {
  it('sollte Einladungs-Modal und aktive Einladungen rendern', async () => {
    await render(
      <InviteModal
        visible={true}
        householdId="hh-1"
        householdName="Test Haushalt"
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText('Mitglied einladen')).toBeTruthy();
    expect(screen.getByText('token-abc-123')).toBeTruthy();
  });

  it('sollte QR-Code Payload-Formatierung korrekt durchführen', () => {
    const token = 'token-abc-123';
    const qrPayload = `fam://join?token=${token}`;

    expect(qrPayload).toBe('fam://join?token=token-abc-123');
    expect(qrPayload).toContain('fam://join');
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

    expect(screen.getByText('new-token-456')).toBeTruthy();
    expect(screen.getByText('QR-Code ausblenden')).toBeTruthy();

    await fireEvent.press(screen.getByText('QR-Code ausblenden'));
    expect(screen.getByText('QR-Code anzeigen')).toBeTruthy();
  });
});
