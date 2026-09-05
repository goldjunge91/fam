import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ChildProfilesScreen } from '@/features/household/child-profiles-screen';

const mockAddMutateAsync = jest.fn().mockResolvedValue({});

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => false },
  useNavigation: () => ({ canGoBack: () => false, addListener: () => () => {} }),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHousehold: { id: 'hh-1', name: 'Zuhause' } }),
}));

jest.mock('@/features/household/api', () => ({
  useChildProfiles: () => ({ data: [], isLoading: false }),
  useAddChildProfileMutation: () => ({ mutateAsync: mockAddMutateAsync, isPending: false }),
  useUpdateChildProfileMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDeleteChildProfileMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => require('@/components/theme/index').Colors.light,
}));

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <ChildProfilesScreen />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockAddMutateAsync.mockClear();
});

it('sendet managedBy beim Anlegen eines Kinder-Profils (RLS verlangt managed_by = auth.uid())', async () => {
  await renderScreen();
  await fireEvent.press(screen.getByText('+ Kinder-Profil anlegen'));
  await fireEvent.changeText(screen.getByPlaceholderText('z. B. Paul'), 'Paul');
  await fireEvent.press(screen.getByText('Speichern'));

  expect(mockAddMutateAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      householdId: 'hh-1',
      displayName: 'Paul',
      managedBy: 'user-1',
    }),
  );
});
