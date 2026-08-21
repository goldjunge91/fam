import { fireEvent, render, screen } from '@testing-library/react-native';

import { ModuleSelectorForm } from '@/features/onboarding/components/module-selector';
import { WelcomeCarousel } from '@/features/onboarding/components/welcome-carousel';

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
      expect(screen.getByText(/Rezept-Manager/)).toBeTruthy();
      expect(screen.getByText(/Meal-Planner/)).toBeTruthy();
      expect(screen.getByText(/Kalorienzähler & Tagebuch/)).toBeTruthy();
    });
  });
});
