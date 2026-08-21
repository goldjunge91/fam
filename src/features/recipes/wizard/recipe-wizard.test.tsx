import { fireEvent, render, screen } from '@testing-library/react-native';
import type React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RecipeWizardStepBasics } from '@/features/recipes/wizard/recipe-wizard-step-basics';
import { RecipeWizardStepPreview } from '@/features/recipes/wizard/recipe-wizard-step-preview';
import { RecipeWizardStepSteps } from '@/features/recipes/wizard/recipe-wizard-step-steps';
import type { IngredientComponentGroup, WizardStepItem } from '@/features/recipes/wizard/types';

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
      const onNext = jest.fn();
      const onCancel = jest.fn();

      await renderWithProviders(
        <RecipeWizardStepBasics
          mode="details"
          title="Linsensuppe"
          onTitleChange={jest.fn()}
          description="Klassische Linsensuppe"
          onDescriptionChange={jest.fn()}
          cookTimeMinutes="30"
          onCookTimeMinutesChange={jest.fn()}
          defaultServings={4}
          onDefaultServingsChange={jest.fn()}
          difficulty="easy"
          onDifficultyChange={jest.fn()}
          dishTypes={['dinner']}
          onDishTypesChange={jest.fn()}
          dietaryTags={['vegan']}
          onDietaryTagsChange={jest.fn()}
          hashtagsInput="#suppe #vegan"
          onHashtagsInputChange={jest.fn()}
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
        />,
      );

      expect(screen.getByDisplayValue('Linsensuppe')).toBeTruthy();
      expect(screen.getByDisplayValue('30')).toBeTruthy();

      const nextBtn = screen.getByText('Weiter zu den Zutaten');
      await fireEvent.press(nextBtn);

      expect(onNext).toHaveBeenCalled();
    });
  });

  describe('RecipeWizardStepSteps', () => {
    it('erlaubt Hinzufügen von Arbeitsschritten', async () => {
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
      await fireEvent.press(nextBtn);

      expect(onNext).toHaveBeenCalled();
    });
  });

  describe('RecipeWizardStepPreview', () => {
    it('zeigt Zusammenfassung und Speichern-Button', async () => {
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
      await fireEvent.press(saveBtn);

      expect(onSave).toHaveBeenCalled();
    });
  });
});
