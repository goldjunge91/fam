import { render, screen, userEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { CorrelationMenuItem } from './correlation-menu-item';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

describe('CorrelationMenuItem', () => {
  beforeEach(() => {
    jest.mocked(router.push).mockClear();
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
