import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { light as hapticLight } from '@/lib/haptics';
import { CorrelationMenuItem } from './correlation-menu-item';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/lib/haptics', () => ({
  heavy: jest.fn(),
  light: jest.fn(),
  medium: jest.fn(),
  selection: jest.fn(),
  success: jest.fn(),
}));

describe('CorrelationMenuItem', () => {
  beforeEach(() => {
    jest.mocked(router.push).mockClear();
    jest.mocked(hapticLight).mockClear();
  });

  it('öffnet die Korrelationsanalyse als eigene Ansicht', async () => {
    const user = userEvent.setup();
    await render(
      <CorrelationMenuItem
        logicalDate="2026-08-24"
        dayStartTime="06:00"
        childProfileId="child-1"
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Korrelationsanalyse öffnen' }));

    expect(hapticLight).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/glp1/correlation',
      params: {
        logicalDate: '2026-08-24',
        dayStartTime: '06:00',
        childProfileId: 'child-1',
      },
    });
  });
});
