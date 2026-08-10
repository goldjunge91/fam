import { fireEvent, render, screen } from '@testing-library/react-native';
import type { LocalShoppingItem } from '../use-shopping-list';
import { ShoppingItemRow } from './shopping-item-row';

describe('ShoppingItemRow', () => {
  const dummyItem: LocalShoppingItem = {
    id: 'item-1',
    household_id: 'hh-1',
    product_id: null,
    name: 'Hafermilch',
    quantity: 2,
    unit: 'l',
    category: 'Getränke',
    sort_index: 0,
    store_id: null,
    price_estimate: null,
    checked_at: null,
    checked_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it('sollte den Namen und die Menge rendern', async () => {
    await render(
      <ShoppingItemRow
        item={dummyItem}
        onToggle={jest.fn()}
        onDelete={jest.fn()}
        onEdit={jest.fn()}
      />,
    );

    expect(screen.getByText('Hafermilch')).toBeTruthy();
    expect(screen.getByText('2 l')).toBeTruthy();
  });

  it('sollte onToggle beim Antippen aufrufen', async () => {
    const onToggleMock = jest.fn();
    await render(
      <ShoppingItemRow
        item={dummyItem}
        onToggle={onToggleMock}
        onDelete={jest.fn()}
        onEdit={jest.fn()}
      />,
    );

    await fireEvent.press(screen.getByRole('checkbox'));
    expect(onToggleMock).toHaveBeenCalledTimes(1);
  });

  it('sollte onDelete beim langen Drücken aufrufen', async () => {
    const onDeleteMock = jest.fn();
    await render(
      <ShoppingItemRow
        item={dummyItem}
        onToggle={jest.fn()}
        onDelete={onDeleteMock}
        onEdit={jest.fn()}
      />,
    );

    await fireEvent(screen.getByRole('checkbox'), 'longPress');
    expect(onDeleteMock).toHaveBeenCalledTimes(1);
  });

  it('sollte onEdit beim Antippen des Bearbeiten-Buttons aufrufen', async () => {
    // Regression: Artikel ohne Markt liessen sich vorher gar nicht mehr
    // aendern — es gab keinen Weg, das Bearbeiten-Modal zu oeffnen.
    const onEditMock = jest.fn();
    await render(
      <ShoppingItemRow
        item={dummyItem}
        onToggle={jest.fn()}
        onDelete={jest.fn()}
        onEdit={onEditMock}
      />,
    );

    await fireEvent.press(screen.getByLabelText('Hafermilch bearbeiten'));
    expect(onEditMock).toHaveBeenCalledTimes(1);
  });
});
