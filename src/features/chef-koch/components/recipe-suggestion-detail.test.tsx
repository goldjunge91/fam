import { render, screen, userEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { RecipeSuggestionMeal } from '@/features/recipes/domain/recipe-suggestions';

import { RecipeSuggestionDetail } from './recipe-suggestion-detail';

const mockMutateAsync = jest.fn();
const mockResolveCategoryForItem = jest.fn();

jest.mock('@/constants/ui', () => {
  const React = require('react') as typeof import('react');
  const { Pressable, Text } = require('react-native') as typeof import('react-native');

  return {
    Button: ({
      title,
      onPress,
      disabled,
    }: {
      title: string;
      onPress: () => void;
      disabled?: boolean;
    }) =>
      React.createElement(
        Pressable,
        {
          accessibilityRole: 'button',
          accessibilityLabel: title,
          disabled,
          onPress,
        },
        React.createElement(Text, null, title),
      ),
    Press: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) =>
      React.createElement(Pressable, props, children),
    Txt: ({ children, accessibilityRole }: { children: ReactNode; accessibilityRole?: 'alert' }) =>
      React.createElement(Text, { accessibilityRole }, children),
  };
});

jest.mock('@/features/shopping-list/hooks/use-shopping-list-mutations', () => ({
  useAddShoppingItem: () => ({ mutateAsync: mockMutateAsync }),
}));

jest.mock('@/features/shopping-list/preferences/api', () => ({
  resolveCategoryForItem: (...args: unknown[]) => mockResolveCategoryForItem(...args),
}));

const meal: RecipeSuggestionMeal = {
  title: 'Tomatenpfanne',
  source: 'catalog',
  recipe_id: 'recipe-1',
  servings: 2,
  used_items: [
    { inventory_item_id: 'inventory-1', quantity: 2, unit: 'Stk' },
    { inventory_item_id: 'missing', quantity: 1, unit: 'kg' },
  ],
  shopping_needs: [
    { name: 'Öl', quantity: 0.25, unit: 'l' },
    { name: 'Salz', quantity: 1, unit: 'TL' },
  ],
  additional_ingredients: [],
  steps: ['Schneiden.', 'Schneiden.', 'Braten.'],
  notes: [],
};

beforeEach(() => {
  mockMutateAsync.mockReset();
  mockResolveCategoryForItem.mockReset();
  mockMutateAsync.mockResolvedValue(undefined);
  mockResolveCategoryForItem.mockResolvedValue({
    categoryId: 'category-1',
    source: 'rule',
    classifierVersion: 'v1',
  });
});

describe('RecipeSuggestionDetail', () => {
  it('shows ingredients, steps and adds selected shopping needs', async () => {
    const user = userEvent.setup();
    const onBack = jest.fn();

    await render(
      <RecipeSuggestionDetail
        meal={meal}
        inventory={[{ id: 'inventory-1', name: 'Tomate' }]}
        householdId="household-1"
        onBack={onBack}
      />,
    );

    expect(screen.getByText('Zubereitung')).toBeOnTheScreen();
    expect(screen.getByText('Tomatenpfanne')).toBeOnTheScreen();
    expect(screen.getByText('Tomate')).toBeOnTheScreen();
    expect(screen.getByText('Lebensmittel')).toBeOnTheScreen();
    expect(screen.getAllByText('Schneiden.')).toHaveLength(2);

    const oil = screen.getByRole('checkbox', { name: 'Öl, 0,25 l' });
    await user.press(oil);
    expect(oil).not.toBeChecked();
    await user.press(oil);
    expect(oil).toBeChecked();

    await user.press(screen.getByRole('button', { name: 'Auswahl zur Einkaufsliste' }));

    expect(await screen.findByText('Die Einkaufsliste wurde aktualisiert.')).toBeOnTheScreen();
    expect(mockResolveCategoryForItem).toHaveBeenCalledWith({
      householdId: 'household-1',
      name: 'Öl',
      source: 'free_text',
    });
    expect(mockMutateAsync).toHaveBeenCalledWith({
      household_id: 'household-1',
      name: 'Öl',
      quantity: 0.25,
      unit: 'l',
      category_id: 'category-1',
      category_source: 'rule',
      category_classifier_version: 'v1',
      recipe_names: ['Tomatenpfanne'],
    });
    expect(mockMutateAsync).toHaveBeenCalledTimes(2);

    await user.press(screen.getByRole('button', { name: 'Zurück zu Vorschlägen' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows an error when adding a shopping need fails', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('failed'));
    const user = userEvent.setup();

    await render(
      <RecipeSuggestionDetail
        meal={{
          ...meal,
          shopping_needs: [
            meal.shopping_needs?.[0] as NonNullable<RecipeSuggestionMeal['shopping_needs']>[number],
          ],
        }}
        inventory={[]}
        householdId="household-1"
        onBack={jest.fn()}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Auswahl zur Einkaufsliste' }));

    expect(
      await screen.findByRole('alert', {
        name: 'Zutaten konnten nicht zur Einkaufsliste hinzugefügt werden. Versuche es erneut.',
      }),
    ).toBeOnTheScreen();
  });

  it('omits the shopping section when no needs are present', async () => {
    await render(
      <RecipeSuggestionDetail
        meal={{ ...meal, shopping_needs: undefined }}
        inventory={[]}
        householdId="household-1"
        onBack={jest.fn()}
      />,
    );

    expect(screen.queryByText('Fehlende Zutaten')).not.toBeOnTheScreen();
    expect(screen.getByText('Diese Ansicht verändert den Bestand nicht.')).toBeOnTheScreen();
  });
});
