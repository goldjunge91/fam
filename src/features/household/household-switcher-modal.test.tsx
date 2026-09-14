import { render, screen, userEvent } from '@testing-library/react-native';
import { selection as hapticSelection } from '@/lib/platform/haptics';
import { HouseholdSwitcherModal } from './household-switcher-modal';

const mockSetActiveHouseholdId = jest.fn().mockResolvedValue(undefined);
const mockInvalidateQueries = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({
    activeHouseholdId: 'hh-1',
    households: [
      { id: 'hh-1', name: 'Familie' },
      { id: 'hh-2', name: 'WG' },
    ],
    setActiveHouseholdId: mockSetActiveHouseholdId,
  }),
}));

jest.mock('@/lib/platform/haptics', () => ({
  heavy: jest.fn(),
  light: jest.fn(),
  medium: jest.fn(),
  selection: jest.fn(),
  success: jest.fn(),
}));

describe('HouseholdSwitcherModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(hapticSelection).mockClear();
  });

  it('wechselt Haushalt und meldet den ausgewählten Zustand', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    await render(<HouseholdSwitcherModal visible selectedHouseholdId="hh-1" onClose={onClose} />);

    expect(screen.getByRole('radio', { name: 'Familie' })).toBeSelected();
    await user.press(screen.getByRole('radio', { name: 'WG' }));

    expect(mockSetActiveHouseholdId).toHaveBeenCalledWith('hh-2');
    expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(hapticSelection).toHaveBeenCalledTimes(1);
  });
});
