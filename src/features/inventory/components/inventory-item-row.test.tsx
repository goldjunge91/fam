import { render, screen, userEvent } from '@testing-library/react-native';
import type { LocalInventoryItem } from '../use-inventory-items';
import { InventoryItemRow } from './inventory-item-row';

jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  return {
    __esModule: true,
    default: ({ children, renderRightActions }: Record<string, unknown>) => {
      const actions =
        typeof renderRightActions === 'function'
          ? renderRightActions(
              { value: 0 },
              { value: 0 },
              { close: jest.fn(), openLeft: jest.fn(), openRight: jest.fn(), reset: jest.fn() },
            )
          : null;
      return [children, actions];
    },
  };
});

describe('InventoryItemRow', () => {
  const dummyItem: LocalInventoryItem = {
    id: 'f-1',
    household_id: 'hh-1',
    location_id: 'loc-1',
    product_id: null,
    name: 'Vollmilch',
    quantity: 1,
    unit: 'l',
    package_size: null,
    package_size_unit: null,
    expiry_date: null,
    added_by: 'usr-1',
    created_at: new Date().toISOString(),
    location_kind: 'fridge',
    location_name: 'Kühlschrank',
  };

  it('sollte den Artikelnamen und Lagerort rendern', async () => {
    await render(
      <InventoryItemRow
        item={dummyItem}
        onPress={jest.fn()}
        onLongPress={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    expect(screen.getByText('Vollmilch')).toBeTruthy();
    expect(screen.getByText('Kühlschrank')).toBeTruthy();
    expect(screen.getByText('1 L')).toBeTruthy();
  });

  it('zeigt eine kompakte Zeile ohne Mengen-Buttons oder dekorative Kacheln', async () => {
    await render(
      <InventoryItemRow
        item={dummyItem}
        onPress={jest.fn()}
        onLongPress={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Menge erhöhen' })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Menge reduzieren' })).not.toBeOnTheScreen();
    expect(screen.queryByText('V')).not.toBeOnTheScreen();
  });

  it('sollte onPress beim Antippen der Zeile auslösen', async () => {
    const onPressMock = jest.fn();
    const user = userEvent.setup();

    await render(
      <InventoryItemRow
        item={dummyItem}
        onPress={onPressMock}
        onLongPress={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Vollmilch, 1 L' }));
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });

  it('sollte onLongPress für den Schnellzugriff auf Produktinformationen auslösen', async () => {
    const onLongPress = jest.fn();
    const user = userEvent.setup();

    await render(
      <InventoryItemRow
        item={dummyItem}
        onPress={jest.fn()}
        onLongPress={onLongPress}
        onRemove={jest.fn()}
      />,
    );
    await user.longPress(screen.getByRole('button', { name: 'Vollmilch, 1 L' }));

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('stellt nach dem Linkswisch eine Entfernen-Aktion bereit', async () => {
    const onRemove = jest.fn();
    const user = userEvent.setup();

    await render(
      <InventoryItemRow
        item={dummyItem}
        onPress={jest.fn()}
        onLongPress={jest.fn()}
        onRemove={onRemove}
      />,
    );
    await user.press(screen.getByRole('button', { name: 'Vollmilch entfernen' }));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
