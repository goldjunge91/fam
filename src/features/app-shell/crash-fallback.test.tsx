import { render, screen, userEvent } from '@testing-library/react-native';
import { CrashFallback } from './crash-fallback';

describe('CrashFallback', () => {
  it('shows a retry action and resets the error boundary when pressed', async () => {
    const resetError = jest.fn();
    const user = userEvent.setup();

    await render(<CrashFallback resetError={resetError} />);

    expect(screen.getByText('Etwas ist schiefgelaufen')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Die App ist auf einen unerwarteten Fehler gestossen. Der Fehler wurde erfasst.',
      ),
    ).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Erneut versuchen' }));

    expect(resetError).toHaveBeenCalledTimes(1);
  });
});
