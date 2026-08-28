import { render, screen, userEvent } from '@testing-library/react-native';
import type React from 'react';
import { useForm } from 'react-hook-form';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RecipeWizardStepBasics } from '@/features/recipes/wizard/recipe-wizard-step-basics';
import { RecipeWizardStepPreview } from '@/features/recipes/wizard/recipe-wizard-step-preview';
import { RecipeWizardStepSteps } from '@/features/recipes/wizard/recipe-wizard-step-steps';
import type { IngredientComponentGroup, WizardStepItem } from '@/features/recipes/wizard/types';
import { RECIPE_FORM_DEFAULTS, type RecipeFormValues } from '@/lib/db/zod/recipe-form-schema.zod';

jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => require('@/constants/theme').Colors.light,
}));

describe('Recipe Wizard Steps', () => {
  const dummyComponents: IngredientComponentGroup[] = [
    {
      id: 'comp-1',
      title: 'Hauptzutaten',
      existingComponentId: null,
      items: [
        {
          id: 'ing-1',
          product: null,
          productQuery: 'Linsen',
          quantity: '200',
          unit: 'g',
          notConvertible: false,
          existingItemId: null,
          existingProductId: null,
        },
      ],
    },
  ];

  const dummySteps: WizardStepItem[] = [
    {
      id: 'step-1',
      serverId: null,
      text: 'Zwiebeln schneiden',
      localImageUri: null,
      existingImagePath: null,
      timerMinutes: null,
      ingredientIds: ['ing-1'],
    },
  ];

  async function renderWithProviders(component: React.ReactElement) {
    return render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 47, left: 0, right: 0, bottom: 34 },
        }}>
        {component}
      </SafeAreaProvider>,
    );
  }

  describe('RecipeWizardStepBasics', () => {
    it('rendert Basisfelder und navigiert zu Schritt 2', async () => {
      const user = userEvent.setup();
      const onNext = jest.fn();
      const onCancel = jest.fn();

      function BasicsHarness() {
        const { control } = useForm<RecipeFormValues>({
          defaultValues: {
            ...RECIPE_FORM_DEFAULTS,
            title: 'Linsensuppe',
            description: 'Klassische Linsensuppe',
            cookTimeMinutes: '30',
            difficulty: 'easy',
            dishTypes: ['dinner'],
            dietaryTags: ['vegan'],
            hashtagsInput: '#suppe #vegan',
          },
        });

        return (
          <RecipeWizardStepBasics
            mode="details"
            control={control}
            coverPreviewUri={null}
            onPickCover={jest.fn()}
            components={dummyComponents}
            onAddIngredient={jest.fn()}
            onRemoveIngredient={jest.fn()}
            onSelectProduct={jest.fn()}
            onUpdateIngredientQuery={jest.fn()}
            onUpdateQuantity={jest.fn()}
            onUpdateUnit={jest.fn()}
            onAddComponentGroup={jest.fn()}
            onUpdateComponentTitle={jest.fn()}
            onRemoveComponentGroup={jest.fn()}
            saving={false}
            onNext={onNext}
            onCancel={onCancel}
          />
        );
      }

      await renderWithProviders(<BasicsHarness />);

      expect(screen.getByDisplayValue('Linsensuppe')).toBeTruthy();
      expect(screen.getByDisplayValue('30')).toBeTruthy();

      const nextBtn = screen.getByRole('button', { name: 'Weiter zu den Zutaten' });
      await user.press(nextBtn);

      expect(onNext).toHaveBeenCalled();
    });
  });

  describe('RecipeWizardStepSteps', () => {
    it('erlaubt Hinzufügen von Arbeitsschritten', async () => {
      const user = userEvent.setup();
      const onNext = jest.fn();
      const onBack = jest.fn();

      await renderWithProviders(
        <RecipeWizardStepSteps
          steps={dummySteps}
          onStepsChange={jest.fn()}
          components={dummyComponents}
          onBack={onBack}
          onNext={onNext}
        />,
      );

      expect(screen.getByText('Zubereitungsschritte')).toBeTruthy();
      expect(screen.getByDisplayValue('Zwiebeln schneiden')).toBeTruthy();

      const nextBtn = screen.getByText('Weiter');
      await user.press(nextBtn);

      expect(onNext).toHaveBeenCalled();
    });
  });

  describe('RecipeWizardStepPreview', () => {
    it('zeigt Zusammenfassung und Speichern-Button', async () => {
      const user = userEvent.setup();
      const onSave = jest.fn();
      const onBack = jest.fn();

      await renderWithProviders(
        <RecipeWizardStepPreview
          coverPreviewUri={null}
          title="Linsensuppe"
          description="Klassische Linsensuppe"
          cookTimeMinutes="30"
          defaultServings={4}
          difficulty="easy"
          dishTypes={['dinner']}
          dietaryTags={['vegan']}
          hashtagsInput="#suppe #vegan"
          components={dummyComponents}
          steps={dummySteps}
          saving={false}
          onSave={onSave}
          onBack={onBack}
        />,
      );

      expect(screen.getByText('Linsensuppe')).toBeTruthy();
      expect(screen.getByText('Klassische Linsensuppe')).toBeTruthy();

      const saveBtn = screen.getByText('Speichern');
      await user.press(saveBtn);

      expect(onSave).toHaveBeenCalled();
    });
  });
});
