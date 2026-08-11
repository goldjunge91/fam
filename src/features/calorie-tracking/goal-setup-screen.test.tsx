import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { GoalSetupScreen } from '@/features/calorie-tracking/goal-setup-screen';

const mockSetGoal = jest.fn().mockResolvedValue({});
const mockAddWeight = jest.fn().mockResolvedValue({});

let mockProfile: {
  sex: string | null;
  birth_date: string | null;
  height_cm: number | null;
  activity_level: string | null;
} = {
  sex: 'male',
  birth_date: '1990-01-01',
  height_cm: 180,
  activity_level: 'moderate',
};
let mockLatestWeight: { weight_kg: number } | null = { weight_kg: 80 };
let mockCurrentGoal: {
  daily_kcal: number;
  goal_type: string;
  valid_from: string;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
} | null = null;

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), canGoBack: () => false },
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/auth/api', () => ({
  useProfile: () => ({ data: mockProfile }),
}));

jest.mock('@/features/calorie-tracking/api', () => ({
  useCurrentGoal: () => ({ data: mockCurrentGoal, isLoading: false }),
  useLatestWeightEntry: () => ({ data: mockLatestWeight }),
  useAddWeightEntryMutation: () => ({ mutateAsync: mockAddWeight, isPending: false }),
  useSetGoalMutation: () => ({ mutateAsync: mockSetGoal, isPending: false }),
}));

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    background: '#FFFFFF',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    text: '#000000',
    textSecondary: '#60646C',
    border: '#DDDDE3',
    accent: '#208AEF',
    success: '#1A7F4B',
    warning: '#B26A00',
    danger: '#C62828',
  }),
}));

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <GoalSetupScreen />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockProfile = {
    sex: 'male',
    birth_date: '1990-01-01',
    height_cm: 180,
    activity_level: 'moderate',
  };
  mockLatestWeight = { weight_kg: 80 };
  mockCurrentGoal = null;
  mockSetGoal.mockClear();
  mockAddWeight.mockClear();
});

describe('GoalSetupScreen', () => {
  it('zeigt einen Hinweis statt Formular, wenn Profildaten fehlen', async () => {
    mockProfile = { sex: null, birth_date: null, height_cm: null, activity_level: null };
    await renderScreen();
    expect(screen.getByText('Profil vervollständigen')).toBeTruthy();
    expect(screen.queryByText('Ziel speichern')).toBeNull();
  });

  it('zeigt eine Kalorien-Vorschau, sobald Profil und Gewicht vorhanden sind', async () => {
    await renderScreen();
    expect(screen.getByLabelText('Ziel-Kalorien (kcal/Tag)')).toBeTruthy();
  });

  it('speichert das Ziel mit den berechneten Werten', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByText('Ziel speichern'));

    expect(mockSetGoal).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        goalType: 'lose',
        rateKgPerWeek: 0.5,
        dailyKcal: expect.any(Number),
        proteinG: expect.any(Number),
        carbsG: expect.any(Number),
        fatG: expect.any(Number),
      }),
    );
  });

  it('zeigt das aktuelle Ziel und blendet das Formular zunaechst aus', async () => {
    mockCurrentGoal = {
      daily_kcal: 1900,
      goal_type: 'lose',
      valid_from: '2026-01-01',
      protein_g: 140,
      carbs_g: 190,
      fat_g: 63,
    };
    await renderScreen();

    expect(screen.getByText('1900 kcal / Tag')).toBeTruthy();
    expect(screen.getByText('Ziel anpassen')).toBeTruthy();
    expect(screen.queryByText('Ziel speichern')).toBeNull();

    await fireEvent.press(screen.getByText('Ziel anpassen'));
    expect(screen.getByText('Ziel speichern')).toBeTruthy();
  });
});

describe('GoalSetupScreen — benutzerdefinierte Makro-Verteilung (#83)', () => {
  it('zeigt einen Fehlertext und blockiert Speichern, wenn die Summe nicht 100% ergibt', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByText('Benutzerdefiniert'));
    await fireEvent.changeText(screen.getByLabelText('Eiweiß %'), '50');
    await fireEvent.changeText(screen.getByLabelText('Kohlenhydrate %'), '50');
    await fireEvent.changeText(screen.getByLabelText('Fett %'), '50');

    expect(screen.getByText(/Die Summe muss 100 % ergeben/)).toBeTruthy();
    expect(screen.getByText('Ziel speichern').parent).toBeDisabled();
  });

  it('speichert mit der benutzerdefinierten Verteilung, wenn die Summe 100% ergibt', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByText('Benutzerdefiniert'));
    await fireEvent.changeText(screen.getByLabelText('Eiweiß %'), '25');
    await fireEvent.changeText(screen.getByLabelText('Kohlenhydrate %'), '50');
    await fireEvent.changeText(screen.getByLabelText('Fett %'), '25');

    expect(screen.queryByText(/Die Summe muss 100 % ergeben/)).toBeNull();

    await fireEvent.press(screen.getByText('Ziel speichern'));
    expect(mockSetGoal).toHaveBeenCalled();
  });
});

describe('GoalSetupScreen — manueller kcal-Override (#84)', () => {
  it('blockiert Speichern und zeigt einen Fehler, wenn der Override unter den Grundumsatz faellt', async () => {
    await renderScreen();
    await fireEvent.changeText(screen.getByLabelText('Ziel-Kalorien (kcal/Tag)'), '100');

    expect(screen.getByText(/Muss zwischen deinem Grundumsatz/)).toBeTruthy();
    expect(screen.getByText('Ziel speichern').parent).toBeDisabled();
  });

  it('speichert mit dem manuell ueberschriebenen kcal-Wert und neu berechneten Makros', async () => {
    await renderScreen();
    await fireEvent.changeText(screen.getByLabelText('Ziel-Kalorien (kcal/Tag)'), '2200');
    await fireEvent.press(screen.getByText('Ziel speichern'));

    expect(mockSetGoal).toHaveBeenCalledWith(
      expect.objectContaining({
        dailyKcal: 2200,
        proteinG: expect.any(Number),
        carbsG: expect.any(Number),
        fatG: expect.any(Number),
      }),
    );
  });
});
