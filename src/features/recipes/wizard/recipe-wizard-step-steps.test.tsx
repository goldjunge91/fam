import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import { pickRecipeImage } from '@/features/recipes/data/household-recipe-images';
import { RecipeWizardStepSteps } from './recipe-wizard-step-steps';
import type { IngredientComponentGroup, WizardStepItem } from './types';

jest.mock('expo-image', () => ({
  Image: require('react-native').Image,
}));

jest.mock('react-native-reorderable-list', () => {
  const React = require('react') as typeof import('react');
  const { Pressable, View } = require('react-native') as typeof import('react-native');

  function MockReorderableList({
    data,
    renderItem,
    ListFooterComponent,
    onReorder,
  }: {
    data: WizardStepItem[];
    renderItem: (info: { item: WizardStepItem; index: number }) => React.ReactNode;
    ListFooterComponent: React.ReactNode;
    onReorder: (event: { from: number; to: number }) => void;
  }) {
    return React.createElement(
      View,
      null,
      ...data.map((item, index) => renderItem({ item, index })),
      React.createElement(Pressable, {
        testID: 'simulate-reorder',
        onPress: () => onReorder({ from: 0, to: data.length - 1 }),
      }),
      ListFooterComponent,
    );
  }

  return {
    __esModule: true,
    default: MockReorderableList,
    reorderItems: (items: WizardStepItem[], from: number, to: number) => {
      const reordered = [...items];
      const [item] = reordered.splice(from, 1);
      reordered.splice(to, 0, item);
      return reordered;
    },
    useReorderableDrag: () => () => undefined,
  };
});

jest.mock('@/features/recipes/data/household-recipe-images', () => ({
  pickRecipeImage: jest.fn(),
  useRecipeStepImageUrl: (path: string | null) => ({
    data: path ? `https://example.com/${path}` : null,
  }),
}));

const mockPickRecipeImage = jest.mocked(pickRecipeImage);
const mockOnStepsChange = jest.fn();
const mockOnBack = jest.fn();
const mockOnNext = jest.fn();

const defaultStep: WizardStepItem = {
  id: 'step-1',
  serverId: null,
  text: 'Zwiebeln schneiden',
  localImageUris: [],
  existingImages: [],
  timerMinutes: null,
  ingredientIds: [],
};

const defaultIngredients: IngredientComponentGroup[] = [
  {
    id: 'component-1',
    title: 'Zutaten',
    existingComponentId: null,
    items: [
      {
        id: 'ingredient-1',
        product: { barcode: '1', name: 'Linsen', categoryTags: [] },
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

async function renderSteps(
  initialSteps: WizardStepItem[] = [defaultStep],
  components: IngredientComponentGroup[] = [],
) {
  function Harness() {
    const [steps, setSteps] = useState(initialSteps);
    return (
      <RecipeWizardStepSteps
        steps={steps}
        onStepsChange={(nextSteps) => {
          mockOnStepsChange(nextSteps);
          setSteps(nextSteps);
        }}
        components={components}
        onBack={mockOnBack}
        onNext={mockOnNext}
      />
    );
  }

  return render(<Harness />);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RecipeWizardStepSteps', () => {
  it('fügt Schritte hinzu, entfernt sie und navigiert zurück oder weiter', async () => {
    const user = userEvent.setup();
    await renderSteps();

    await user.press(screen.getByText('+ Schritt hinzufügen'));
    expect(screen.getAllByPlaceholderText(/Was ist in Schritt/)).toHaveLength(2);
    expect(mockOnStepsChange).toHaveBeenLastCalledWith(
      expect.arrayContaining([expect.objectContaining({ text: '' })]),
    );

    await user.press(screen.getAllByRole('button', { name: 'Delete step' })[1]);
    expect(screen.getAllByPlaceholderText(/Was ist in Schritt/)).toHaveLength(1);
    await user.press(screen.getByText('Zurück'));
    await user.press(screen.getByText('Weiter'));

    expect(mockOnBack).toHaveBeenCalledTimes(1);
    expect(mockOnNext).toHaveBeenCalledTimes(1);
  });

  it('ordnet Schritte neu und startet das Ziehen über den Schrittgriff', async () => {
    const user = userEvent.setup();
    const steps = [defaultStep, { ...defaultStep, id: 'step-2', text: 'Servieren' }];
    await renderSteps(steps);

    await user.longPress(screen.getAllByLabelText('Schritt verschieben')[0]);
    await fireEvent.press(screen.getByTestId('simulate-reorder'));

    expect(mockOnStepsChange).toHaveBeenLastCalledWith([steps[1], steps[0]]);
  });

  it('schlägt passende Zutaten vor, aktualisiert Erwähnungen und zeigt den Verbrauch', async () => {
    const user = userEvent.setup();
    await renderSteps([{ ...defaultStep, text: '@Linsen50 kochen' }], defaultIngredients);

    expect(screen.getByText('150g übrig')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Zutatenliste einklappen' }));
    expect(screen.getByText('0/1 aufgebraucht')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Zutatenliste ausklappen' }));

    const editor = screen.getByPlaceholderText(
      'Was ist in Schritt 1 zu tun? Zutat mit @ einfügen, z. B. @Wurst50',
    );
    await fireEvent.changeText(editor, '@Linsen');
    expect(screen.queryByText(/Danach direkt eine Zahl tippen/)).not.toBeOnTheScreen();

    await fireEvent.changeText(editor, '@Lin');
    await fireEvent.press(screen.getByText(/Linsen.*200g/));
    expect(screen.getByDisplayValue('@Linsen')).toBeOnTheScreen();
    expect(mockOnStepsChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ text: '@Linsen', ingredientIds: ['ingredient-1'] }),
    ]);

    await fireEvent.changeText(editor, '@Linsen250 kochen');
    expect(screen.getByText('aufgebraucht')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Zutatenliste einklappen' }));
    expect(screen.getByText('1/1 aufgebraucht')).toBeOnTheScreen();
  });

  it('ignoriert nicht passende Zutaten und lässt gespeicherte Zutaten ohne Produktnamen aus', async () => {
    const ingredients: IngredientComponentGroup[] = [
      ...defaultIngredients,
      {
        id: 'component-2',
        title: 'Weitere Zutaten',
        existingComponentId: null,
        items: [
          {
            id: 'ingredient-2',
            product: null,
            productQuery: '  ',
            quantity: 'ungültig',
            unit: 'g',
            notConvertible: false,
            existingItemId: null,
            existingProductId: null,
          },
        ],
      },
    ];
    await renderSteps([{ ...defaultStep, text: '@Unbekannt' }], ingredients);

    expect(screen.queryByText(/Danach direkt eine Zahl tippen/)).not.toBeOnTheScreen();
    expect(screen.getByText('200g übrig')).toBeOnTheScreen();
  });

  it('fügt lokal ausgewählte Bilder ein, markiert eine Textauswahl und entfernt das Bild', async () => {
    const user = userEvent.setup();
    mockPickRecipeImage.mockResolvedValueOnce('file:///picked.jpg');
    await renderSteps([{ ...defaultStep, text: 'Zwiebeln schneiden' }]);

    const editor = screen.getByPlaceholderText(
      'Was ist in Schritt 1 zu tun? Zutat mit @ einfügen, z. B. @Wurst50',
    );
    await fireEvent(editor, 'selectionChange', {
      nativeEvent: { selection: { start: 8, end: 9 } },
    });
    await user.press(screen.getByText('+ Bild hinzufügen'));
    await waitFor(() => expect(screen.getByTestId('recipe-step-image-step-1')).toBeOnTheScreen());
    await user.press(screen.getByText('Bild 1 im Text einfügen'));

    expect(screen.getByDisplayValue('Zwiebeln[[Bild 1]]schneiden')).toBeOnTheScreen();
    await user.press(screen.getByText('Bild entfernen'));
    expect(screen.getByDisplayValue('Zwiebelnschneiden')).toBeOnTheScreen();
    expect(screen.queryByTestId('recipe-step-image-step-1')).not.toBeOnTheScreen();
  });

  it('entfernt ein gespeichertes Bild, ohne lokale Bilder zu löschen', async () => {
    const user = userEvent.setup();
    const step: WizardStepItem = {
      ...defaultStep,
      text: 'Schneiden [[Bild 1]]',
      localImageUris: ['file:///local.jpg'],
      existingImages: [{ id: 'image-1', storagePath: 'hh/step.jpg', position: 0 }],
    };
    await renderSteps([step]);

    await user.press(screen.getAllByText('Bild entfernen')[0]);

    expect(mockOnStepsChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        existingImages: [],
        localImageUris: ['file:///local.jpg'],
        text: 'Schneiden ',
      }),
    ]);
  });

  it('nimmt positive Timer an, verwirft ungültige Eingaben und unterstützt Abbrechen und Entfernen', async () => {
    const user = userEvent.setup();
    await renderSteps();

    await user.press(screen.getByText('+ Timer hinzufügen'));
    await user.type(screen.getByPlaceholderText('Min.'), '0');
    await user.press(screen.getByText('Übernehmen'));
    expect(screen.getByText('+ Timer hinzufügen')).toBeOnTheScreen();

    await user.press(screen.getByText('+ Timer hinzufügen'));
    await user.type(screen.getByPlaceholderText('Min.'), '12');
    await fireEvent(screen.getByPlaceholderText('Min.'), 'submitEditing');
    expect(screen.getByText('⏱ 12 Min. Timer')).toBeOnTheScreen();

    await user.press(screen.getByText('Entfernen'));
    await user.press(screen.getByText('+ Timer hinzufügen'));
    await user.type(screen.getByPlaceholderText('Min.'), '30');
    await user.press(screen.getByText('Abbrechen'));
    expect(screen.getByText('+ Timer hinzufügen')).toBeOnTheScreen();
  });
});
