import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MembersScreen } from '@/features/household/members-screen';

const mockUpdateRoleMutateAsync = jest.fn().mockResolvedValue({});
const mockRemoveMemberMutateAsync = jest.fn().mockResolvedValue({});
const mockLeaveMutateAsync = jest.fn().mockResolvedValue({});
const mockDeleteHouseholdMutateAsync = jest.fn().mockResolvedValue({});
const mockReplace = jest.fn();

type MockMember = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  role: 'admin' | 'member';
  joined_at: string;
};
let mockMembers: MockMember[] = [];
let mockHouseholds = [{ id: 'hh-1', name: 'Familie Schmidt' }];

function updateMockMember(index: number, changes: Partial<MockMember>) {
  const member = mockMembers[index];
  if (!member) throw new Error(`Mock household member ${index} is missing.`);
  mockMembers[index] = { ...member, ...changes };
}

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: (...args: unknown[]) => mockReplace(...args) },
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1', email: 'admin@test.fam' } } }),
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({
    activeHouseholdId: 'hh-1',
    activeHousehold: { id: 'hh-1', name: 'Familie Schmidt' },
    households: mockHouseholds,
  }),
}));

jest.mock('@/features/household/api', () => ({
  useHouseholdMembers: () => ({ data: mockMembers, isLoading: false }),
  useHouseholdInvites: () => ({ data: [], isLoading: false }),
  useCreateInviteMutation: () => ({ mutateAsync: jest.fn() }),
  useRevokeInviteMutation: () => ({ mutateAsync: jest.fn() }),
  useUpdateMemberRoleMutation: () => ({ mutateAsync: mockUpdateRoleMutateAsync }),
  useRemoveMemberMutation: () => ({ mutateAsync: mockRemoveMemberMutateAsync }),
  useLeaveHouseholdMutation: () => ({ mutateAsync: mockLeaveMutateAsync }),
  useDeleteHouseholdMutation: () => ({ mutateAsync: mockDeleteHouseholdMutateAsync }),
  useGenerateInviteMutation: () => ({ mutateAsync: jest.fn() }),
}));

describe('MembersScreen', () => {
  async function renderScreen() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
    });
    const result = await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        <QueryClientProvider client={queryClient}>
          <MembersScreen />
        </QueryClientProvider>
      </SafeAreaProvider>,
    );

    // FlashList schedules its initial layout callback with a timer. Flush it
    // while the act scope from the render is still under our control.
    await act(() => {
      jest.advanceTimersByTime(60);
    });

    return result;
  }

  afterEach(async () => {
    await act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockReplace.mockClear();
    mockUpdateRoleMutateAsync.mockReset().mockResolvedValue({});
    mockRemoveMemberMutateAsync.mockReset().mockResolvedValue({});
    mockLeaveMutateAsync.mockReset().mockResolvedValue({});
    mockDeleteHouseholdMutateAsync.mockReset().mockResolvedValue({});
    mockHouseholds = [{ id: 'hh-1', name: 'Familie Schmidt' }];
    mockMembers = [
      {
        user_id: 'user-1',
        role: 'admin',
        display_name: 'Max Admin',
        avatar_url: null,
        joined_at: '2026-01-01',
      },
      {
        user_id: 'user-2',
        role: 'member',
        display_name: 'Erika Mitglied',
        avatar_url: null,
        joined_at: '2026-01-02',
      },
    ];
  });

  it('rendert Haushaltsnamen und Mitgliederliste', async () => {
    await renderScreen();

    expect(screen.getByText('Mitglieder')).toBeTruthy();
    expect(screen.getByText(/Max Admin/)).toBeTruthy();
    expect(screen.getByText(/Erika Mitglied/)).toBeTruthy();
  });

  it('gibt Profilbildern von Mitgliedern eine explizite Groesse', async () => {
    mockMembers[0].avatar_url = 'https://example.com/avatar.jpg';
    await renderScreen();

    expect(screen.getByLabelText('Profilbild von Max Admin')).toHaveStyle({
      width: '100%',
      height: '100%',
    });
  });

  it('öffnet das Einladungsmodal beim Klick auf Mitglied einladen', async () => {
    await renderScreen();

    const inviteBtn = screen.getByRole('button', { name: '+ Mitglied einladen' });
    await fireEvent.press(inviteBtn);

    expect(await screen.findByText('Mitglied einladen')).toBeTruthy();
  });

  it('ändert eine Mitgliedsrolle erst nach Bestätigung', async () => {
    let confirm: (() => void) | undefined;
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      confirm = buttons?.find((button) => button.text === 'Bestätigen')?.onPress;
    });
    await renderScreen();

    await fireEvent.press(screen.getByLabelText('Mitglied-Rolle ändern'));

    expect(alert).toHaveBeenCalledWith('Rolle ändern', expect.any(String), expect.any(Array));
    expect(mockUpdateRoleMutateAsync).not.toHaveBeenCalled();
    await act(async () => {
      await confirm?.();
    });
    expect(mockUpdateRoleMutateAsync).toHaveBeenCalledWith({
      householdId: 'hh-1',
      userId: 'user-2',
      role: 'admin',
    });
    alert.mockRestore();
  });

  it('verhindert das Verlassen durch den einzigen Admin', async () => {
    await renderScreen();

    const leaveButton = screen.getByText('Haushalt verlassen');

    expect(leaveButton).toBeDisabled();
    expect(
      screen.getByText('Ernenne zuerst einen weiteren Admin, um den Haushalt zu verlassen.'),
    ).toBeOnTheScreen();
    expect(mockLeaveMutateAsync).not.toHaveBeenCalled();
  });

  it('entfernt ein anderes Mitglied nach Bestätigung', async () => {
    let confirm: (() => void) | undefined;
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      confirm = buttons?.find((button) => button.style === 'destructive')?.onPress;
    });
    await renderScreen();

    await fireEvent.press(screen.getByLabelText('Erika Mitglied entfernen'));

    expect(alert).toHaveBeenCalledWith('Mitglied entfernen', expect.any(String), expect.any(Array));
    expect(mockRemoveMemberMutateAsync).not.toHaveBeenCalled();
    await act(async () => {
      await confirm?.();
    });
    expect(mockRemoveMemberMutateAsync).toHaveBeenCalledWith({
      householdId: 'hh-1',
      userId: 'user-2',
    });
    alert.mockRestore();
  });

  it('verlässt den Haushalt nach Bestätigung und navigiert zurück zum Dashboard', async () => {
    updateMockMember(0, { role: 'member' });
    let confirm: (() => void) | undefined;
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      confirm = buttons?.find((button) => button.style === 'destructive')?.onPress;
    });
    await renderScreen();

    await fireEvent.press(screen.getByText('Haushalt verlassen'));

    expect(alert).toHaveBeenCalledWith('Haushalt verlassen', expect.any(String), expect.any(Array));
    expect(mockLeaveMutateAsync).not.toHaveBeenCalled();
    await act(async () => {
      await confirm?.();
    });
    expect(mockLeaveMutateAsync).toHaveBeenCalledWith('hh-1');
    expect(mockReplace).toHaveBeenCalledWith('/');
    alert.mockRestore();
  });

  it('meldet einen Fehler beim Ändern der Rolle', async () => {
    mockUpdateRoleMutateAsync.mockRejectedValueOnce(
      new Error('Rolle konnte nicht geändert werden'),
    );
    let confirm: (() => void) | undefined;
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      confirm = buttons?.find((button) => button.text === 'Bestätigen')?.onPress;
    });
    await renderScreen();

    await fireEvent.press(screen.getByLabelText('Mitglied-Rolle ändern'));
    expect(mockUpdateRoleMutateAsync).not.toHaveBeenCalled();
    await act(async () => {
      await confirm?.();
    });

    expect(alert).toHaveBeenCalledWith('Fehler', 'Rolle konnte nicht geändert werden');
    alert.mockRestore();
  });

  it('löscht den Haushalt erst nach Bestätigung', async () => {
    let confirm: (() => void) | undefined;
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      confirm = buttons?.find((button) => button.style === 'destructive')?.onPress;
    });
    await renderScreen();

    await fireEvent.press(screen.getByText('Haushalt löschen'));

    expect(alert).toHaveBeenCalledWith('Haushalt löschen', expect.any(String), expect.any(Array));
    expect(mockDeleteHouseholdMutateAsync).not.toHaveBeenCalled();
    await act(async () => {
      await confirm?.();
    });
    expect(mockDeleteHouseholdMutateAsync).toHaveBeenCalledWith('hh-1');
    expect(mockReplace).toHaveBeenCalledWith('/');
    alert.mockRestore();
  });

  it('meldet einen Fehler beim Entfernen und lässt die Liste sichtbar', async () => {
    mockRemoveMemberMutateAsync.mockRejectedValueOnce(
      new Error('Mitglied konnte nicht entfernt werden'),
    );
    let confirm: (() => void) | undefined;
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      confirm = buttons?.find((button) => button.style === 'destructive')?.onPress;
    });
    await renderScreen();

    await fireEvent.press(screen.getByLabelText('Erika Mitglied entfernen'));
    expect(mockRemoveMemberMutateAsync).not.toHaveBeenCalled();
    await act(async () => {
      await confirm?.();
    });

    expect(alert).toHaveBeenCalledWith('Fehler', 'Mitglied konnte nicht entfernt werden');
    expect(screen.getByText(/Erika Mitglied/)).toBeOnTheScreen();
    alert.mockRestore();
  });

  it('setzt den Haushalt-Löschfehler zurück und hält die Ansicht offen', async () => {
    mockDeleteHouseholdMutateAsync.mockRejectedValueOnce(new Error('Löschen fehlgeschlagen'));
    let confirm: (() => void) | undefined;
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      confirm = buttons?.find((button) => button.style === 'destructive')?.onPress;
    });
    await renderScreen();

    await fireEvent.press(screen.getByText('Haushalt löschen'));
    expect(mockDeleteHouseholdMutateAsync).not.toHaveBeenCalled();
    await act(async () => {
      await confirm?.();
    });

    expect(alert).toHaveBeenCalledWith('Fehler', 'Löschen fehlgeschlagen');
    expect(screen.getByText('Haushalt löschen')).toBeOnTheScreen();
    alert.mockRestore();
  });

  it('meldet einen Fehler beim Verlassen und reaktiviert die Aktion', async () => {
    updateMockMember(0, { role: 'member' });
    mockLeaveMutateAsync.mockRejectedValueOnce(new Error('Verlassen fehlgeschlagen'));
    let confirm: (() => void) | undefined;
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      confirm = buttons?.find((button) => button.style === 'destructive')?.onPress;
    });
    await renderScreen();

    await fireEvent.press(screen.getByText('Haushalt verlassen'));
    await act(async () => {
      await confirm?.();
    });

    expect(alert).toHaveBeenCalledWith('Fehler', 'Verlassen fehlgeschlagen');
    expect(screen.getByText('Haushalt verlassen')).toBeEnabled();
    alert.mockRestore();
  });

  it('zeigt unbekannte Mitglieder an und nennt mehrere Haushalte im Wechsler', async () => {
    updateMockMember(1, { display_name: '' });
    mockHouseholds = [
      { id: 'hh-1', name: 'Familie Schmidt' },
      { id: 'hh-2', name: 'Ferienhaus' },
    ];
    await renderScreen();

    expect(screen.getByText(/Unbekanntes Mitglied/)).toBeOnTheScreen();
    expect(screen.getByText('🏠 Haushalt wechseln (Familie Schmidt)')).toBeOnTheScreen();
  });

  it('lässt einen Haushalt, wenn ein weiterer Admin bleibt', async () => {
    updateMockMember(1, { role: 'admin' });
    let confirm: (() => void) | undefined;
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      confirm = buttons?.find((button) => button.style === 'destructive')?.onPress;
    });
    await renderScreen();

    await fireEvent.press(screen.getByText('Haushalt verlassen'));

    expect(screen.getByText('Haushalt verlassen')).toBeEnabled();
    expect(mockLeaveMutateAsync).not.toHaveBeenCalled();
    await act(async () => {
      await confirm?.();
    });
    expect(mockLeaveMutateAsync).toHaveBeenCalledWith('hh-1');
    alert.mockRestore();
  });
});
