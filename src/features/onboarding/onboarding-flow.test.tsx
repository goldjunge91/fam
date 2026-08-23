import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OnboardingFlow } from './onboarding-flow';

const initialMetrics = {
  frame: { x: 0, y: 0, width: 320, height: 640 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const mockSignUp = jest.fn();
const mockSignIn = jest.fn();

// Der Test loest den registrierten Auth-Callback gezielt aus.
let capturedAuthStateCallback: ((event: string, session: unknown) => void) | undefined;
const mockGetSession = jest.fn().mockResolvedValue({ data: { session: null } });

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false) },
}));

// Spaetere Formulare liegen ausserhalb dieses Schrittzustand-Tests.
jest.mock('./components/profile-step-form', () => ({ ProfileStepForm: () => null }));
jest.mock('./components/household-step', () => ({ HouseholdStepForm: () => null }));
jest.mock('./components/module-selector', () => ({ ModuleSelectorForm: () => null }));
jest.mock('./components/permissions-step', () => ({ PermissionsStepForm: () => null }));
jest.mock('./components/complete-step', () => ({ CompleteStepForm: () => null }));

// Nur die gesteuerten Netzwerkfunktionen werden ersetzt.
jest.mock('@/features/auth/api', () => ({
  ...jest.requireActual('@/features/auth/api'),
  signIn: (...args: unknown[]) => mockSignIn(...args),
  signUp: (...args: unknown[]) => mockSignUp(...args),
  signOut: jest.fn().mockResolvedValue({ error: null }),
  resendConfirmationEmail: jest.fn().mockResolvedValue({ error: null }),
  confirmSignUpWithCode: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
}));

jest.mock('@/features/auth/onboarding-session', () => ({
  persistOnboardingCompleted: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: null }),
}));

jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
        capturedAuthStateCallback = callback;
        return { data: { subscription: { unsubscribe: jest.fn() } } };
      },
    },
  }),
}));

async function renderFlow() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <QueryClientProvider client={queryClient}>
        <OnboardingFlow />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

async function advanceToPendingConfirmation() {
  await renderFlow();

  await fireEvent.press(screen.getByRole('button', { name: 'Weiter' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Weiter' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Jetzt starten' }));

  await fireEvent.changeText(screen.getByLabelText('E-Mail Adresse'), 'family@example.com');
  await fireEvent.changeText(screen.getByLabelText('Passwort'), 'supersecret');
  await fireEvent.press(screen.getByRole('button', { name: 'Konto erstellen & weiter' }));

  expect(await screen.findByText('Bestätigung ausstehend')).toBeTruthy();
}

describe('OnboardingFlow — Bestaetigung waehrend Schritt 2 (#Bruchteil-Sekunde-Bug)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedAuthStateCallback = undefined;
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockSignUp.mockResolvedValue({ data: { session: null }, error: null });
  });

  it('landet bei Schritt 3 (ProfileStepForm), wenn onAuthStateChange zweimal quasi gleichzeitig feuert', async () => {
    await advanceToPendingConfirmation();

    // Zwei Bestaetigungswege melden denselben Zustand im selben Tick.
    expect(capturedAuthStateCallback).toBeDefined();
    const confirmedSession = { user: { id: 'u1', email: 'family@example.com' } };
    await act(async () => {
      capturedAuthStateCallback?.('SIGNED_IN', confirmedSession);
      capturedAuthStateCallback?.('SIGNED_IN', confirmedSession);
    });

    expect(await screen.findByText('Schritt 3 von 7')).toBeTruthy();
    expect(screen.queryByText('Schritt 4 von 7')).toBeNull();
    expect(screen.queryByText('Schritt 5 von 7')).toBeNull();
  });
});
