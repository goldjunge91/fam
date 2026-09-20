import { render, screen, userEvent } from '@testing-library/react-native';

import { i18n } from '@/i18n';
import { AutoAssignSetting } from './auto-assign-setting';

const mockGetAutoAssign = jest.fn();
const mockSetAutoAssign = jest.fn();

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('./auto-assign', () => ({
  autoAssignPort: {
    get: (...args: unknown[]) => mockGetAutoAssign(...args),
    set: (...args: unknown[]) => mockSetAutoAssign(...args),
  },
}));

describe('AutoAssignSetting', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
    mockGetAutoAssign.mockReset();
    mockSetAutoAssign.mockReset();
    mockSetAutoAssign.mockResolvedValue(undefined);
  });

  it('schaltet die intelligente Zuordnung aus der Settings-Zeile aus', async () => {
    mockGetAutoAssign.mockResolvedValue('on');

    await render(<AutoAssignSetting />);
    const user = userEvent.setup();

    await user.press(
      await screen.findByRole('button', {
        name: 'Intelligente Zuordnung: Ein',
      }),
    );

    expect(mockSetAutoAssign).toHaveBeenCalledWith('user-1', 'off');
    expect(
      await screen.findByRole('button', {
        name: 'Intelligente Zuordnung: Aus',
      }),
    ).toBeOnTheScreen();
  });

  it('schaltet die intelligente Zuordnung wieder ein', async () => {
    mockGetAutoAssign.mockResolvedValue('off');

    await render(<AutoAssignSetting />);
    const user = userEvent.setup();

    await user.press(
      await screen.findByRole('button', {
        name: 'Intelligente Zuordnung: Aus',
      }),
    );

    expect(mockSetAutoAssign).toHaveBeenCalledWith('user-1', 'on');
    expect(
      await screen.findByRole('button', {
        name: 'Intelligente Zuordnung: Ein',
      }),
    ).toBeOnTheScreen();
  });
});
