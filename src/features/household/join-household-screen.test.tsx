import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { JoinHouseholdScreen } from '@/features/household/join-household-screen';

let mockCanGoBack = false;
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockMutateAsync = jest.fn().mockResolvedValue({});
const mockClearPendingInviteToken = jest.fn().mockResolvedValue(undefined);
const mockPeekPendingInviteToken = jest.fn().mockResolvedValue(null);

jest.mock('expo-router', () => ({
  router: {
    canGoBack: () => mockCanGoBack,
    back: () => mockBack(),
    replace: (href: string) => mockReplace(href),
    push: jest.fn(),
  },
  useLocalSearchParams: () => ({ token: undefined }),
  useNavigation: () => ({
    canGoBack: () => mockCanGoBack,
    addListener: (_event: string, _cb: () => void) => {
      return () => {};
    },
  }),
}));

jest.mock('@/features/household/api', () => ({
  useRedeemInviteMutation: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

jest.mock('@/lib/pending-invite', () => ({
  clearPendingInviteToken: () => mockClearPendingInviteToken(),
  peekPendingInviteToken: () => mockPeekPendingInviteToken(),
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => require('@/constants/theme').Colors.light,
}));

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <JoinHouseholdScreen />
    </SafeAreaProvider>,
  );
}

describe('JoinHouseholdScreen', () => {
  beforeEach(() => {
    mockCanGoBack = false;
    mockBack.mockClear();
    mockReplace.mockClear();
    mockMutateAsync.mockClear();
    mockClearPendingInviteToken.mockClear();
    mockPeekPendingInviteToken.mockClear();
  });

  it('zeigt ohne Navigationshistorie keinen Zurueck- oder Abbrechen-Knopf', async () => {
    mockCanGoBack = false;
    await renderScreen();

    expect(screen.getAllByText('Haushalt beitreten')).toHaveLength(2);
    expect(screen.getByText('Mit Einladungs-Code oder Link')).toBeTruthy();
    expect(screen.queryByText(/^‹/)).toBeNull();
    expect(screen.queryByText('Abbrechen')).toBeNull();
  });

  it('zeigt bei vorhandener Historie den Haushalte-Zurueck-Knopf und den Abbrechen-Knopf', async () => {
    mockCanGoBack = true;
    await renderScreen();

    const backButton = screen.getByLabelText('Zurück zu Haushalte');
    expect(backButton).toBeTruthy();
    expect(screen.getByText('Abbrechen')).toBeTruthy();

    await fireEvent.press(backButton);
    expect(mockBack).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByText('Abbrechen'));
    expect(mockBack).toHaveBeenCalledTimes(2);
  });

  it('loest Einladung ein und leitet zur Startseite weiter', async () => {
    await renderScreen();

    const input = screen.getByPlaceholderText('z. B. 123e4567-e89b-12d3-a456-426614174000');
    await fireEvent.changeText(input, '123e4567-e89b-12d3-a456-426614174000');

    await fireEvent.press(screen.getByRole('button', { name: 'Haushalt beitreten' }));

    expect(mockMutateAsync).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
    expect(mockClearPendingInviteToken).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
