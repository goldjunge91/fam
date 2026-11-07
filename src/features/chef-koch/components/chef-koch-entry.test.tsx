import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ChefKochEntry } from './chef-koch-entry';

let mockHasAI = true;
let mockHouseholdId: string | null = 'household-1';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/components/icons/fam-icon', () => ({ FamIcon: () => null }));
jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({ colors: { premiumGradientStart: '#715574', premiumOnSurface: '#fff' } }),
}));
jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: mockHouseholdId }),
}));
jest.mock('@/features/premium/premium-provider', () => ({
  usePremium: () => ({ hasAI: mockHasAI }),
}));

describe('ChefKochEntry', () => {
  beforeEach(() => {
    mockHasAI = true;
    mockHouseholdId = 'household-1';
    jest.mocked(router.push).mockClear();
  });

  it('opens the same Chef-Koch route from the recipe area', async () => {
    const user = userEvent.setup();
    await render(<ChefKochEntry />);

    await user.press(screen.getByRole('button', { name: 'Aus Vorrat kochen' }));
    expect(router.push).toHaveBeenCalledWith('/chef-koch');
  });

  it('keeps the entry visible and opens Chef-Koch History when AI is locked', async () => {
    mockHasAI = false;
    const user = userEvent.setup();
    await render(<ChefKochEntry />);

    expect(screen.getByText('Fam KI erforderlich')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Aus Vorrat kochen' }));
    expect(router.push).toHaveBeenCalledWith('/chef-koch');
  });

  it('is disabled until an active household is available', async () => {
    mockHouseholdId = null;
    await render(<ChefKochEntry />);

    expect(screen.getByRole('button', { name: 'Aus Vorrat kochen' })).toBeDisabled();
  });
});
