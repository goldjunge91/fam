import { render, screen, userEvent } from '@testing-library/react-native';
import { MissingEnvError } from '@/lib/config/env';
import { CrashFallback } from './crash-fallback';

const originalDevDescriptor = Object.getOwnPropertyDescriptor(globalThis, '__DEV__');

function setDevelopmentMode(enabled: boolean) {
  Object.defineProperty(globalThis, '__DEV__', {
    configurable: true,
    value: enabled,
  });
}

afterEach(() => {
  if (originalDevDescriptor) {
    Object.defineProperty(globalThis, '__DEV__', originalDevDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, '__DEV__');
  }
});

describe('CrashFallback', () => {
  it('shows a retry action and resets the error boundary when pressed', async () => {
    const resetError = jest.fn();
    const user = userEvent.setup();
    setDevelopmentMode(false);

    await render(<CrashFallback resetError={resetError} error={new Error('internal details')} />);

    expect(screen.getByText('App konnte nicht gestartet werden')).toBeOnTheScreen();
    expect(
      screen.getByText('Beim Starten der App ist ein unerwarteter Fehler aufgetreten.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Bitte versuche es erneut.')).toBeOnTheScreen();
    expect(screen.queryByText('internal details')).not.toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Erneut versuchen' }));

    expect(resetError).toHaveBeenCalledTimes(1);
  });

  it('explains a missing public environment variable in development', async () => {
    setDevelopmentMode(true);

    await render(
      <CrashFallback
        resetError={jest.fn()}
        error={new MissingEnvError('EXPO_PUBLIC_SUPABASE_URL')}
      />,
    );

    expect(
      screen.getByText('Die öffentliche Konfiguration EXPO_PUBLIC_SUPABASE_URL fehlt.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Ergänze die Variable und starte Metro neu.')).toBeOnTheScreen();
  });

  it('recognizes a serialized missing-environment failure without trusting its message', async () => {
    setDevelopmentMode(true);

    await render(
      <CrashFallback
        resetError={jest.fn()}
        error={{
          name: 'MissingEnvError',
          variableName: 'EXPO_PUBLIC_SUPABASE_URL',
          message: 'redacted-sensitive-value',
        }}
      />,
    );

    expect(
      screen.getByText('Die öffentliche Konfiguration EXPO_PUBLIC_SUPABASE_URL fehlt.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('redacted-sensitive-value')).not.toBeOnTheScreen();
  });

  it('keeps configuration details out of the production fallback', async () => {
    setDevelopmentMode(false);
    const rawError =
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=redacted-sensitive-value https://internal.example.test';

    await render(
      <CrashFallback
        resetError={jest.fn()}
        error={{
          name: 'MissingEnvError',
          variableName: 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
          message: rawError,
        }}
      />,
    );

    expect(screen.getByText('Die App-Konfiguration ist unvollständig.')).toBeOnTheScreen();
    expect(
      screen.getByText('Bitte aktualisiere die App oder wende dich an den Support.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY/)).not.toBeOnTheScreen();
    expect(screen.queryByText(/redacted-sensitive-value/)).not.toBeOnTheScreen();
    expect(screen.queryByText(/internal\.example\.test/)).not.toBeOnTheScreen();
    expect(screen.queryByText(rawError)).not.toBeOnTheScreen();
  });

  it('does not render raw details for an unknown error in development', async () => {
    setDevelopmentMode(true);
    const rawError = 'server response: redacted-sensitive-value at https://internal.example.test';

    await render(<CrashFallback resetError={jest.fn()} error={new Error(rawError)} />);

    expect(
      screen.getByText('Beim Starten der App ist ein unerwarteter Fehler aufgetreten.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText(rawError)).not.toBeOnTheScreen();
  });
});
