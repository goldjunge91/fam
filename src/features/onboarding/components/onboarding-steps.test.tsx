import { fireEvent, render, screen } from '@testing-library/react-native';

import { ModuleSelectorForm } from '@/features/onboarding/components/module-selector';
import { WelcomeCarousel } from '@/features/onboarding/components/welcome-carousel';

const mockFeatureFlags: Record<string, boolean> = {
  'module-recipes': true,
  'module-meal-planner': true,
  'module-calories': true,
};

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => require('@/constants/theme').Colors.light,
}));

jest.mock('@/features/onboarding/context/onboarding-context', () => ({
  useOnboarding: () => ({
    state: {
      modules: {
        fridge: true,
        shoppingList: true,
        recipes: true,
        mealPlanner: true,
        calories: true,
      },
    },
    updateModulesData: jest.fn(),
  }),
}));

jest.mock('@/features/auth/session-provider', () => ({
  useSession: () => ({ session: { user: { id: 'user-1' } } }),
}));

jest.mock('@/features/settings/module-preferences', () => ({
  DEFAULT_MODULE_PREFERENCES: {
    fridge: true,
    shoppingList: true,
    recipes: true,
    mealPlanner: true,
    calories: true,
  },
  useModulePreferences: () => ({
    data: {
      fridge: true,
      shoppingList: true,
      recipes: true,
      mealPlanner: true,
      calories: true,
    },
    isLoading: false,
  }),
}));

// Diese Komponententests pruefen die Onboarding-Schritte, nicht die
// PostHog-Anbindung. Alle optionalen Module sind hier bewusst freigeschaltet.
jest.mock('@/lib/posthog', () => ({
  useFeatureFlags: () => mockFeatureFlags,
  useFeatureFlag: (key: string | undefined, defaultValue: boolean) =>
    key ? (mockFeatureFlags[key] ?? defaultValue) : defaultValue,
}));

describe('Onboarding Components', () => {
  describe('WelcomeCarousel', () => {
    it('rendert Willkommens-Folien und wechselt Folien beim Klick auf Weiter', async () => {
      const onStart = jest.fn();
      await render(<WelcomeCarousel onStart={onStart} />);

      expect(screen.getByText('Haushalt & Vorrat an einem Ort')).toBeTruthy();

      const nextBtn = screen.getByRole('button', { name: 'Weiter' });
      await fireEvent.press(nextBtn);

      expect(await screen.findByText('Geteilte Einkaufsliste')).toBeTruthy();
    });
  });

  describe('ModuleSelectorForm', () => {
    it('rendert Modulauswahl-Toggles', async () => {
      const onNext = jest.fn();
      const onSkip = jest.fn();
      await render(<ModuleSelectorForm onNext={onNext} onSkip={onSkip} />);

      expect(screen.getByText('Welche Module möchtest du nutzen?')).toBeTruthy();
      expect(screen.getByText(/Kühlschrank & Vorrat/)).toBeTruthy();
      expect(screen.getByText(/Geteilte Einkaufsliste/)).toBeTruthy();
      expect(screen.getByText(/Rezepte/)).toBeTruthy();
      expect(screen.getByText(/Essensplan/)).toBeTruthy();
      expect(screen.getByText(/Kalorienzähler & Tagebuch/)).toBeTruthy();
    });
  });
});
