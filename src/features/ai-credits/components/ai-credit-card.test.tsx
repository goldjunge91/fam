import { render, screen, userEvent } from '@testing-library/react-native';

import { AiCreditCard } from './ai-credit-card';

const HOUSEHOLD_ID = '11111111-1111-4111-8111-111111111111';

const status = {
  householdId: HOUSEHOLD_ID,
  creditsUsed: 30,
  creditsRemaining: 70,
  creditLimit: 100 as const,
  warningReached: false,
  blocked: false,
};

describe('AiCreditCard', () => {
  it('zeigt den Haushaltsstand als Text und zugänglichen Fortschritt', async () => {
    await render(<AiCreditCard householdId={HOUSEHOLD_ID} status={status} />);

    expect(screen.getByText('70 von 100 Credits verfügbar')).toBeOnTheScreen();
    expect(
      screen.getByRole('progressbar', { name: '70 von 100 Credits verfügbar' }),
    ).toHaveAccessibilityValue({ min: 0, max: 1, now: 0.7 });
  });

  it('trennt den Ladezustand vom Datenzustand', async () => {
    await render(<AiCreditCard householdId={HOUSEHOLD_ID} isLoading />);

    expect(screen.getByRole('progressbar', { name: 'KI-Credits werden geladen' })).toBeBusy();
    expect(screen.queryByText('70 von 100 Credits verfügbar')).not.toBeOnTheScreen();
  });

  it('zeigt einen Lesefehler mit gezieltem Retry', async () => {
    const onRetry = jest.fn();
    const user = userEvent.setup();
    await render(<AiCreditCard householdId={HOUSEHOLD_ID} isError onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toHaveTextContent(/Credits konnten nicht geladen werden\./);
    await user.press(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('zeigt den fehlenden Haushalt als eigenen Leerzustand', async () => {
    await render(<AiCreditCard householdId={null} />);

    expect(screen.getByText('Kein aktiver Haushalt verfügbar.')).toBeOnTheScreen();
    expect(screen.queryByRole('progressbar')).not.toBeOnTheScreen();
  });

  it('zeigt bei null Credits die Sperre und den nächsten UTC-Monatsanfang', async () => {
    await render(
      <AiCreditCard
        householdId={HOUSEHOLD_ID}
        status={{ ...status, creditsUsed: 100, creditsRemaining: 0, blocked: true }}
        now={new Date('2026-11-30T23:59:59.999Z')}
      />,
    );

    expect(screen.getByText('Keine Credits mehr verfügbar')).toBeOnTheScreen();
    expect(screen.getByText('Neue Credits ab 1. Dezember 2026 (UTC)')).toBeOnTheScreen();
    expect(
      screen.getByRole('progressbar', { name: '0 von 100 Credits verfügbar' }),
    ).toHaveAccessibilityValue({ min: 0, max: 1, now: 0 });
  });
});
