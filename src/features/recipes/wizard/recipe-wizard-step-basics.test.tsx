import { render, screen, userEvent } from '@testing-library/react-native';
import { type ComponentProps, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { CatalogProduct } from '@/features/product-search/types';
import { RECIPE_FORM_DEFAULTS, type RecipeFormValues } from '@/lib/db/zod/recipe-form-schema.zod';
import { RecipeWizardStepBasics } from './recipe-wizard-step-basics';
import type { IngredientComponentGroup } from './types';

jest.mock('expo-image', () => ({
  Image: require('react-native').Image,
}));

jest.mock('@/components/forms/wheel-picker-field', () => {
  const React = require('react') as typeof import('react');
  const { Pressable, Text } = require('react-native') as typeof import('react-native');
  return {
    WheelPickerField: ({ value, onChange }: { value: string; onChange: (value: string) => void }) =>
      React.createElement(
        Pressable,
        {
          accessibilityRole: 'button',
          accessibilityLabel: 'Einheit ändern',
          onPress: () => onChange('kg'),
        },
        React.createElement(Text, null, value),
      ),
  };
});

jest.mock('@/features/inventory/product-search-dropdown', () => {
  const React = require('react') as typeof import('react');
  const { Pressable, Text, TextInput } = require('react-native') as typeof import('react-native');
  return {
    ProductSearchDropdown: ({
      label,
      value,
      onChangeText,
      onSelectProduct,
    }: {
      label: string;
      value: string;
      onChangeText: (value: string) => void;
      onSelectProduct: (product: CatalogProduct) => void;
    }) =>
      React.createElement(
        React.Fragment,
        null,
        React.createElement(TextInput, {
          accessibilityLabel: label,
          value,
          onChangeText,
        }),
        React.createElement(
          Pressable,
          {
            accessibilityRole: 'button',
            accessibilityLabel: 'Produkt auswählen',
            onPress: () => onSelectProduct({ barcode: '400123', name: 'Tomate', categoryTags: [] }),
          },
          React.createElement(Text, null, 'Tomate wählen'),
        ),
      ),
  };
});

const defaultGroup: IngredientComponentGroup = {
  id: 'group-1',
  title: 'Zutaten',
  existingComponentId: null,
  items: [
    {
      id: 'ingredient-1',
      product: null,
      productQuery: 'Tomate',
      quantity: '100',
      unit: 'g',
      notConvertible: true,
      existingItemId: null,
      existingProductId: null,
    },
  ],
};

type BasicsProps = Omit<ComponentProps<typeof RecipeWizardStepBasics>, 'control'>;

function renderBasics(overrides: Partial<BasicsProps> = {}) {
  const props: BasicsProps = {
    mode: 'details',
    coverPreviewUri: null,
    onPickCover: jest.fn(),
    components: [defaultGroup],
    onAddIngredient: jest.fn(),
    onRemoveIngredient: jest.fn(),
    onSelectProduct: jest.fn(),
    onUpdateIngredientQuery: jest.fn(),
    onUpdateQuantity: jest.fn(),
    onUpdateUnit: jest.fn(),
    onAddComponentGroup: jest.fn(),
    onUpdateComponentTitle: jest.fn(),
    onRemoveComponentGroup: jest.fn(),
    saving: false,
    onCancel: jest.fn(),
    onNext: jest.fn(),
    ...overrides,
  };

  function BasicsHarness() {
    const { control } = useForm<RecipeFormValues>({
      defaultValues: { ...RECIPE_FORM_DEFAULTS, title: 'Pasta' },
    });
    const [components, setComponents] = useState(props.components);

    return (
      <RecipeWizardStepBasics
        {...props}
        components={components}
        control={control}
        onUpdateComponentTitle={(componentId, title) => {
          props.onUpdateComponentTitle(componentId, title);
          setComponents((previous) =>
            previous.map((component) =>
              component.id === componentId ? { ...component, title } : component,
            ),
          );
        }}
        onUpdateIngredientQuery={(componentId, itemId, query) => {
          props.onUpdateIngredientQuery(componentId, itemId, query);
          setComponents((previous) =>
            previous.map((component) =>
              component.id === componentId
                ? {
                    ...component,
                    items: component.items.map((item) =>
                      item.id === itemId ? { ...item, productQuery: query } : item,
                    ),
                  }
                : component,
            ),
          );
        }}
        onUpdateQuantity={(componentId, itemId, quantity) => {
          props.onUpdateQuantity(componentId, itemId, quantity);
          setComponents((previous) =>
            previous.map((component) =>
              component.id === componentId
                ? {
                    ...component,
                    items: component.items.map((item) =>
                      item.id === itemId ? { ...item, quantity } : item,
                    ),
                  }
                : component,
            ),
          );
        }}
        onUpdateUnit={(componentId, itemId, unit) => {
          props.onUpdateUnit(componentId, itemId, unit);
          setComponents((previous) =>
            previous.map((component) =>
              component.id === componentId
                ? {
                    ...component,
                    items: component.items.map((item) =>
                      item.id === itemId ? { ...item, unit } : item,
                    ),
                  }
                : component,
            ),
          );
        }}
      />
    );
  }

  return render(<BasicsHarness />);
}

describe('RecipeWizardStepBasics', () => {
  it('edits details, toggles tags, bounds servings, and calls its actions', async () => {
    const user = userEvent.setup();
    const onPickCover = jest.fn();
    const onCancel = jest.fn();
    const onNext = jest.fn();
    await renderBasics({ onPickCover, onCancel, onNext });

    await user.press(screen.getByText('Titelbild hinzufügen'));
    await user.press(screen.getByRole('button', { name: 'Mittel' }));
    expect(screen.getByRole('button', { name: 'Mittel' })).toBeSelected();
    await user.press(screen.getByRole('button', { name: 'Mittel' }));
    expect(screen.getByRole('button', { name: 'Mittel' })).not.toBeSelected();
    await user.press(screen.getByRole('button', { name: 'Snack' }));
    await user.press(screen.getByRole('button', { name: 'Vegan' }));
    await user.press(screen.getByRole('button', { name: 'Eine Portion weniger' }));
    await user.press(screen.getByRole('button', { name: 'Eine Portion weniger' }));
    await user.press(screen.getByRole('button', { name: 'Eine Portion weniger' }));
    expect(screen.getByText('1', { exact: true })).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Eine Portion mehr' }));
    await user.press(screen.getByText('Abbrechen'));
    await user.press(screen.getByRole('button', { name: 'Weiter zu den Zutaten' }));

    expect(onPickCover).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('disables the next action while saving', async () => {
    await renderBasics({ saving: true });

    expect(screen.getByRole('button', { name: 'Speichert…' })).toBeDisabled();
  });

  it('edits ingredient groups and forwards add, remove, and selection actions', async () => {
    const user = userEvent.setup();
    const onAddIngredient = jest.fn();
    const onRemoveIngredient = jest.fn();
    const onSelectProduct = jest.fn();
    const onUpdateIngredientQuery = jest.fn();
    const onUpdateQuantity = jest.fn();
    const onUpdateUnit = jest.fn();
    const onAddComponentGroup = jest.fn();
    const onUpdateComponentTitle = jest.fn();
    const onRemoveComponentGroup = jest.fn();
    const onNext = jest.fn();
    await renderBasics({
      mode: 'ingredients',
      components: [defaultGroup, { ...defaultGroup, id: 'group-2', title: 'Soße' }],
      onAddIngredient,
      onRemoveIngredient,
      onSelectProduct,
      onUpdateIngredientQuery,
      onUpdateQuantity,
      onUpdateUnit,
      onAddComponentGroup,
      onUpdateComponentTitle,
      onRemoveComponentGroup,
      onNext,
    });

    expect(screen.getAllByText(/Automatische Umrechnung/)).toHaveLength(2);
    const groupName = screen.getAllByLabelText('Gruppenname')[0];
    await user.clear(groupName);
    await user.type(groupName, 'Teig');
    const productQuery = screen.getAllByLabelText('Zutat')[0];
    await user.clear(productQuery);
    await user.type(productQuery, 'Basilikum');
    await user.type(screen.getAllByLabelText('Menge')[0], '25');
    await user.press(screen.getAllByRole('button', { name: 'Einheit ändern' })[0]);
    await user.press(screen.getAllByRole('button', { name: 'Produkt auswählen' })[0]);
    await user.press(screen.getAllByText('+ Zutat hinzufügen')[0]);
    await user.press(screen.getAllByRole('button', { name: 'Delete ingredient' })[0]);
    await user.press(screen.getAllByRole('button', { name: 'Zutaten-Gruppe entfernen' })[0]);
    await user.press(screen.getByRole('button', { name: 'Add Componente' }));
    await user.press(screen.getByText('Weiter zu den Schritten'));

    expect(onUpdateComponentTitle).toHaveBeenCalledWith('group-1', 'Teig');
    expect(onUpdateIngredientQuery).toHaveBeenCalledWith('group-1', 'ingredient-1', 'Basilikum');
    expect(onUpdateQuantity).toHaveBeenCalledWith('group-1', 'ingredient-1', '10025');
    expect(onUpdateUnit).toHaveBeenCalledWith('group-1', 'ingredient-1', 'kg');
    expect(onSelectProduct).toHaveBeenCalledWith('group-1', 'ingredient-1', {
      barcode: '400123',
      name: 'Tomate',
      categoryTags: [],
    });
    expect(onAddIngredient).toHaveBeenCalledWith('group-1');
    expect(onRemoveIngredient).toHaveBeenCalledWith('group-1', 'ingredient-1');
    expect(onRemoveComponentGroup).toHaveBeenCalledWith('group-1');
    expect(onAddComponentGroup).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
