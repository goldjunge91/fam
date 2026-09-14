import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

import { CompleteStepForm } from './complete-step';
import { HouseholdStepForm } from './household-step';

const mockCompleteOnboarding = jest.fn();
const mockReplace = jest.fn();
const mockUpdateHouseholdData = jest.fn();
const mockCreateHousehold = jest.fn();
const mockRedeemInvite = jest.fn();

let mockOnboardingState = {
  household: { choice: 'solo' as const },
};
let mockOnboardingLoading = false;
let mockOnboardingError: string | null = null;
let mockHouseholds: Array<{ name: string }> = [];
let mockCreatePending = false;
let mockRedeemPending = false;

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}));

jest.mock('@/features/onboarding/onboarding-store', () => ({
  useOnboarding: () => ({
    state: mockOnboardingState,
    completeOnboarding: mockCompleteOnboarding,
    isLoading: mockOnboardingLoading,
    error: mockOnboardingError,
    updateHouseholdData: mockUpdateHouseholdData,
  }),
}));

jest.mock('@/features/household/api', () => ({
  useHouseholds: () => ({ data: mockHouseholds }),
  useCreateHouseholdMutation: () => ({
    mutateAsync: mockCreateHousehold,
    isPending: mockCreatePending,
  }),
  useRedeemInviteMutation: () => ({
    mutateAsync: mockRedeemInvite,
    isPending: mockRedeemPending,
  }),
}));

describe('CompleteStepForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnboardingState = { household: { choice: 'solo' } };
    mockOnboardingLoading = false;
    mockOnboardingError = null;
    mockHouseholds = [];
    mockCompleteOnboarding.mockResolvedValue(true);
  });

  it('navigiert nach erfolgreichem Abschluss zum Dashboard', async () => {
    await render(<CompleteStepForm />);

    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Zum Dashboard' }));

    await waitFor(() => {
      expect(mockCompleteOnboarding).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });

  it('zeigt einen Abschlussfehler und navigiert nicht weiter', async () => {
    mockOnboardingError = 'Haushalt konnte nicht gespeichert werden.';
    mockCompleteOnboarding.mockResolvedValue(false);

    await render(<CompleteStepForm />);

    expect(screen.getByText('Haushalt konnte nicht gespeichert werden.')).toBeOnTheScreen();

    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Zum Dashboard' }));

    expect(mockCompleteOnboarding).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('zeigt den laufenden Abschluss als busy und deaktiviert die Aktion', async () => {
    mockOnboardingLoading = true;

    await render(<CompleteStepForm />);

    const button = screen.getByRole('button', { name: 'Speichern...' });
    expect(button).toBeDisabled();
    expect(button).toBeBusy();

    const user = userEvent.setup();
    await user.press(button);
    expect(mockCompleteOnboarding).not.toHaveBeenCalled();
  });
});

describe('HouseholdStepForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnboardingState = { household: { choice: 'solo' } };
    mockHouseholds = [];
    mockCreatePending = false;
    mockRedeemPending = false;
    mockCreateHousehold.mockResolvedValue({ id: 'household-1' });
    mockRedeemInvite.mockResolvedValue({ id: 'household-1' });
  });

  it('wählt eine Haushaltsoption und validiert den Einladungscode', async () => {
    await render(<HouseholdStepForm onNext={jest.fn()} onSkip={jest.fn()} />);

    const user = userEvent.setup();
    const joinOption = screen.getByRole('radio', { name: 'Einem Haushalt beitreten' });
    await user.press(joinOption);

    expect(joinOption).toBeSelected();
    expect(screen.getByLabelText('Einladungs-Code')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Weiter' }));
    expect(await screen.findByText('Bitte gib einen Einladungscode ein.')).toBeOnTheScreen();
    expect(mockRedeemInvite).not.toHaveBeenCalled();
  });

  it('löst einen gültigen Einladungscode ein und ruft onNext auf', async () => {
    const onNext = jest.fn();
    await render(<HouseholdStepForm onNext={onNext} onSkip={jest.fn()} />);

    const user = userEvent.setup();
    await user.press(screen.getByRole('radio', { name: 'Einem Haushalt beitreten' }));
    await user.type(
      screen.getByLabelText('Einladungs-Code'),
      '123e4567-e89b-12d3-a456-426614174000',
    );
    await user.press(screen.getByRole('button', { name: 'Weiter' }));

    await waitFor(() => {
      expect(mockUpdateHouseholdData).toHaveBeenCalledWith({
        choice: 'join',
        name: undefined,
        inviteCode: '123e4567-e89b-12d3-a456-426614174000',
      });
      expect(mockRedeemInvite).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
      expect(onNext).toHaveBeenCalledTimes(1);
    });
  });

  it('zeigt einen Mutationsfehler an', async () => {
    mockCreateHousehold.mockRejectedValue(new Error('Haushalt konnte nicht erstellt werden.'));

    await render(<HouseholdStepForm onNext={jest.fn()} onSkip={jest.fn()} />);

    const user = userEvent.setup();
    await user.press(screen.getByRole('radio', { name: 'Neuen Haushalt erstellen' }));
    await user.press(screen.getByRole('button', { name: 'Weiter' }));

    expect(await screen.findByText('Haushalt konnte nicht erstellt werden.')).toBeOnTheScreen();
  });

  it('deaktiviert Überspringen und meldet Weiter als busy während einer Mutation', async () => {
    mockCreatePending = true;

    await render(<HouseholdStepForm onNext={jest.fn()} onSkip={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Weiter' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeBusy();
    expect(screen.getByRole('button', { name: 'Überspringen' })).toBeDisabled();
  });
});
