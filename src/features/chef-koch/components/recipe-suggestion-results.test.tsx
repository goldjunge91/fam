import { render, screen, userEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { RecipeSuggestionMeal } from '@/features/recipes/domain/recipe-suggestions';

import { RecipeSuggestionResults } from './recipe-suggestion-results';

jest.mock('@/constants/ui', () => {
  const React = require('react') as typeof import('react');
  const { Pressable, Text: NativeText } = require('react-native') as typeof import('react-native');

  return {
    Button: ({ title, onPress }: { title: string; onPress: () => void }) =>
      React.createElement(
        Pressable,
        { accessibilityRole: 'button', accessibilityLabel: title, onPress },
        React.createElement(NativeText, null, title),
      ),
    Txt: ({ children }: { children: ReactNode }) => React.createElement(NativeText, null, children),
  };
});

const inventory = [{ id: 'inventory-1', name: 'Tomate' }];

const meals: RecipeSuggestionMeal[] = [
  {
    title: 'Tomatenpfanne',
    source: 'catalog',
    recipe_id: 'recipe-1',
    servings: 2,
    used_items: [{ inventory_item_id: 'inventory-1', quantity: 2, unit: 'Stk' }],
    additional_ingredients: ['Pfeffer'],
    shopping_needs: [{ name: 'Öl', quantity: 0.25, unit: 'l' }],
    steps: ['Braten.'],
    notes: [],
  },
  {
    title: 'Kartoffelpfanne',
    source: 'template',
    recipe_id: 'template-1',
    servings: 3,
    used_items: [{ inventory_item_id: 'missing', quantity: 4, unit: 'Stk' }],
    additional_ingredients: [],
    shopping_needs: [],
    steps: ['Kochen.'],
    notes: [],
  },
  {
    title: 'Restepfanne',
    source: 'model_generated',
    recipe_id: null,
    servings: 1,
    used_items: [],
    additional_ingredients: [],
    steps: ['Wenden.'],
    notes: [],
  },
];

describe('RecipeSuggestionResults', () => {
  it('renders source labels, inventory matches and shopping context', async () => {
    const onCook = jest.fn();
    const user = userEvent.setup();

    await render(
      <RecipeSuggestionResults
        meals={meals}
        inventory={inventory}
        selectedInventoryItemIds={['inventory-1', 'missing']}
        onCook={onCook}
      />,
    );

    expect(screen.getByText('Aus dem Katalog')).toBeOnTheScreen();
    expect(screen.getByText('Aus einer Vorlage')).toBeOnTheScreen();
    expect(screen.getByText('Neu formuliert')).toBeOnTheScreen();
    expect(screen.getByText('Tomate')).toBeOnTheScreen();
    expect(screen.getByText('Lebensmittel')).toBeOnTheScreen();
    expect(screen.getByText('Schon auf der Einkaufsliste: Pfeffer')).toBeOnTheScreen();
    expect(screen.getByText('Noch einzukaufen: 0,25 l Öl')).toBeOnTheScreen();
    expect(screen.getAllByText('Verwendet 1 von 2 ausgewählten Lebensmitteln')).toHaveLength(2);

    await user.press(screen.getAllByRole('button', { name: 'Kochen' })[0]);

    expect(onCook).toHaveBeenCalledWith(meals[0]);
  });

  it('renders a generated meal without optional shopping or selection text', async () => {
    await render(<RecipeSuggestionResults meals={[meals[2]]} inventory={[]} onCook={jest.fn()} />);

    expect(screen.getByText('Neu formuliert')).toBeOnTheScreen();
    expect(screen.queryByText(/Verwendet/)).not.toBeOnTheScreen();
    expect(screen.queryByText(/Schon auf der Einkaufsliste/)).not.toBeOnTheScreen();
    expect(screen.queryByText(/Noch einzukaufen/)).not.toBeOnTheScreen();
  });
});
