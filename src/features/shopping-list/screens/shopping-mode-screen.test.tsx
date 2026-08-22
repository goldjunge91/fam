import { render, screen, userEvent } from '@testing-library/react-native';
import type React from 'react';
import type { LocalShoppingItem } from '../hooks/use-shopping-list';
import type { Store } from '../hooks/use-stores';
import { ShoppingModeScreen } from './shopping-mode-screen';

// Der verschachtelte `SafeAreaProvider` in shopping-mode-screen.tsx (noetig
// fuer korrekte Insets innerhalb eines `Modal`) wartet unter Jest auf ein
// `onInsetsChange`-Event der nie existierenden nativen Ansicht und rendert
// sonst keine Kinder. `SafeAreaView` bleibt die echte, von NativeWind
// gewrappte Implementierung — die braucht keinen Provider, um zu rendern.
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

describe('ShoppingModeScreen', () => {
  const store: Store = {
    id: 'store-1',
    household_id: 'hh-1',
    name: 'REWE',
    color: '#B5623F',
    sort_order: 0,
    category_order: null,
  };

  function makeItem(overrides: Partial<LocalShoppingItem>): LocalShoppingItem {
    return {
      id: 'item-1',
      household_id: 'hh-1',
      product_id: null,
      name: 'Bananen',
      quantity: 6,
      unit: 'piece',
      package_size: null,
      package_size_unit: null,
      category_id: 'produce',
      category_source: 'name_fallback',
      category_classifier_version: null,
      category: 'Obst & Gemüse',
      store_id: 'store-1',
      price_estimate: 1.8,
      recipe_names: [],
      checked_at: null,
      checked_by: null,
      sort_index: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };
  }

  it('zeigt Artikel gruppiert nach Kategorie mit Menge und Preis', async () => {
    const items = [
      makeItem({ id: 'item-1', name: 'Bananen' }),
      makeItem({
        id: 'item-2',
        name: 'Milch',
        category_id: 'dairy',
        category: 'Molkerei',
        unit: 'l',
        quantity: 1,
        price_estimate: 1.1,
      }),
    ];

    await render(
      <ShoppingModeScreen
        visible
        store={store}
        items={items}
        onToggle={jest.fn()}
        onClose={jest.fn()}
        onFinish={jest.fn()}
      />,
    );

    expect(screen.getByText('Bananen')).toBeOnTheScreen();
    expect(screen.getByText('Milch')).toBeOnTheScreen();
    expect(screen.getByText('1,80 €')).toBeOnTheScreen();
  });

  it('ruft onToggle beim Antippen eines Artikels auf', async () => {
    const user = userEvent.setup();
    const onToggle = jest.fn();
    const items = [makeItem({})];

    await render(
      <ShoppingModeScreen
        visible
        store={store}
        items={items}
        onToggle={onToggle}
        onClose={jest.fn()}
        onFinish={jest.fn()}
      />,
    );

    await user.press(screen.getByRole('checkbox', { name: 'Bananen' }));
    expect(onToggle).toHaveBeenCalledWith(items[0]);
  });

  it('klappt eine Kategorie beim Antippen des Headers zu', async () => {
    const user = userEvent.setup();
    const items = [makeItem({})];

    await render(
      <ShoppingModeScreen
        visible
        store={store}
        items={items}
        onToggle={jest.fn()}
        onClose={jest.fn()}
        onFinish={jest.fn()}
      />,
    );

    expect(screen.getByText('Bananen')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: /Obst & Gemüse/i }));
    expect(screen.queryByText('Bananen')).not.toBeOnTheScreen();
  });

  it('zeigt den Abschluss-Button sobald mindestens ein Artikel abgehakt ist (nicht erst bei allen)', async () => {
    const noneChecked = [makeItem({ id: 'item-1' }), makeItem({ id: 'item-2', name: 'Milch' })];
    const { rerender } = await render(
      <ShoppingModeScreen
        visible
        store={store}
        items={noneChecked}
        onToggle={jest.fn()}
        onClose={jest.fn()}
        onFinish={jest.fn()}
      />,
    );

    expect(screen.queryByText(/Einkauf abschließen/i)).not.toBeOnTheScreen();

    // Nur EIN Artikel abgehakt, nicht beide — der Button muss trotzdem
    // erscheinen (Feedback: Abschluss darf nicht an "alles abgehakt" hängen,
    // im Laden findet man selten wirklich alles).
    const oneChecked = [
      makeItem({ id: 'item-1', checked_at: new Date().toISOString() }),
      makeItem({ id: 'item-2', name: 'Milch' }),
    ];
    await rerender(
      <ShoppingModeScreen
        visible
        store={store}
        items={oneChecked}
        onToggle={jest.fn()}
        onClose={jest.fn()}
        onFinish={jest.fn()}
      />,
    );

    expect(screen.getByText('🛒 Einkauf abschließen (1)')).toBeOnTheScreen();
  });

  it('ruft onFinish beim Antippen des Abschluss-Buttons auf', async () => {
    const user = userEvent.setup();
    const onFinish = jest.fn();
    const items = [makeItem({ checked_at: new Date().toISOString() })];

    await render(
      <ShoppingModeScreen
        visible
        store={store}
        items={items}
        onToggle={jest.fn()}
        onClose={jest.fn()}
        onFinish={onFinish}
      />,
    );

    await user.press(screen.getByText(/Einkauf abschließen/i));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
