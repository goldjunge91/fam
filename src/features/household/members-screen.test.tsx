import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MembersScreen } from '@/features/household/members-screen';

const mockUpdateRoleMutateAsync = jest.fn().mockResolvedValue({});
const mockRemoveMemberMutateAsync = jest.fn().mockResolvedValue({});
const mockLeaveMutateAsync = jest.fn().mockResolvedValue({});

let mockMembers: Array<{
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  role: 'admin' | 'member';
  joined_at: string;
}> = [];

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1', email: 'admin@test.fam' } } }),
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({
    activeHouseholdId: 'hh-1',
    activeHousehold: { id: 'hh-1', name: 'Familie Schmidt' },
    households: [{ id: 'hh-1', name: 'Familie Schmidt' }],
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
  useDeleteHouseholdMutation: () => ({ mutateAsync: jest.fn() }),
  useGenerateInviteMutation: () => ({ mutateAsync: jest.fn() }),
}));

describe('MembersScreen', () => {
  async function renderScreen() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
    });
    return render(
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
  }

  beforeEach(() => {
    jest.clearAllMocks();
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

  it('öffnet das Einladungsmodal beim Klick auf Mitglied einladen', async () => {
    await renderScreen();

    const inviteBtn = screen.getByRole('button', { name: '+ Mitglied einladen' });
    await fireEvent.press(inviteBtn);

    expect(await screen.findByText('Mitglied einladen')).toBeTruthy();
  });
});
