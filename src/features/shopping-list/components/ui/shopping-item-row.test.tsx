import { fireEvent, render, screen } from '@testing-library/react-native';
import type { LocalShoppingItem } from '../../hooks/use-shopping-list';
import { ShoppingItemRow } from './shopping-item-row';

describe('ShoppingItemRow', () => {
  const dummyItem: LocalShoppingItem = {
    id: 'item-1',
    household_id: 'hh-1',
    product_id: null,
    name: 'Hafermilch',
    quantity: 2,
    unit: 'l',
    package_size: null,
    package_size_unit: null,
    category_id: 'beverages',
    category_source: 'name_fallback',
    category_classifier_version: null,
    category: 'Getränke',
    sort_index: 0,
    store_id: null,
    price_estimate: null,
    recipe_names: [],
    checked_at: null,
    checked_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it('sollte den Namen und die Menge rendern', async () => {
    await render(<ShoppingItemRow item={dummyItem} onDelete={jest.fn()} onEdit={jest.fn()} />);

    expect(screen.getByText('Hafermilch')).toBeTruthy();
    expect(screen.getByText('2 L')).toBeTruthy();
  });

  it('sollte den geschätzten Preis anzeigen, wenn einer hinterlegt ist', async () => {
    await render(
      <ShoppingItemRow
        item={{ ...dummyItem, price_estimate: 2.4 }}
        onDelete={jest.fn()}
        onEdit={jest.fn()}
      />,
    );

    expect(screen.getByText('2,40 €')).toBeTruthy();
  });

  it('sollte keinen Preis anzeigen, wenn keiner hinterlegt ist', async () => {
    await render(<ShoppingItemRow item={dummyItem} onDelete={jest.fn()} onEdit={jest.fn()} />);

    expect(screen.queryByText(/€/)).not.toBeOnTheScreen();
  });

  it('sollte die Ursprungsgerichte anzeigen, wenn der Artikel aus einem Rezept stammt', async () => {
    await render(
      <ShoppingItemRow
        item={{ ...dummyItem, recipe_names: ['Spaghetti Bolognese', 'Pfannkuchen'] }}
        onDelete={jest.fn()}
        onEdit={jest.fn()}
      />,
    );

    expect(screen.getByText(/Spaghetti Bolognese, Pfannkuchen/)).toBeTruthy();
  });

  it('sollte kein Gericht-Badge anzeigen, wenn der Artikel manuell hinzugefuegt wurde', async () => {
    await render(<ShoppingItemRow item={dummyItem} onDelete={jest.fn()} onEdit={jest.fn()} />);

    expect(screen.queryByText(/🍽️/)).not.toBeOnTheScreen();
  });

  it('sollte onEdit beim Antippen der Zeile aufrufen (Abhaken passiert nur im Einkaufsmodus)', async () => {
    const onEditMock = jest.fn();
    await render(<ShoppingItemRow item={dummyItem} onDelete={jest.fn()} onEdit={onEditMock} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Hafermilch bearbeiten' }));
    expect(onEditMock).toHaveBeenCalledTimes(1);
  });

  it('sollte onDelete beim langen Drücken aufrufen', async () => {
    const onDeleteMock = jest.fn();
    await render(<ShoppingItemRow item={dummyItem} onDelete={onDeleteMock} onEdit={jest.fn()} />);

    await fireEvent(screen.getByRole('button', { name: 'Hafermilch bearbeiten' }), 'longPress');
    expect(onDeleteMock).toHaveBeenCalledTimes(1);
  });
});
