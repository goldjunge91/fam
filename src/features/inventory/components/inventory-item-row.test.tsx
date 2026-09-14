import { render, screen, userEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { InventoryItemGroup } from '../grouped-items';
import type { LocalInventoryItem } from '../use-inventory-items';
import { InventoryItemRow } from './inventory-item-row';
import { InventoryItemRow as InventoryItemRowIOS } from './inventory-item-row.ios';

const mockSwipeableClose = jest.fn();

jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  return {
    __esModule: true,
    default: ({ children, renderRightActions }: Record<string, unknown>) => {
      const actions =
        typeof renderRightActions === 'function'
          ? renderRightActions(
              { value: 0 },
              { value: 0 },
              {
                close: mockSwipeableClose,
                openLeft: jest.fn(),
                openRight: jest.fn(),
                reset: jest.fn(),
              },
            )
          : null;
      return (
        <>
          {children as ReactNode}
          {actions as ReactNode}
        </>
      );
    },
  };
});

describe('InventoryItemRow', () => {
  beforeEach(() => {
    mockSwipeableClose.mockClear();
  });

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

  it('sollte den Artikelnamen rendern, aber nicht den Lagerort', async () => {
    await render(
      <InventoryItemRow
        item={dummyItem}
        onPress={jest.fn()}
        onLongPress={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    expect(screen.getByText('Vollmilch')).toBeTruthy();
    expect(screen.queryByText('Kühlschrank')).not.toBeOnTheScreen();
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

  it('legt die Zeilen-Geometrie über native Styles fest', async () => {
    await render(
      <InventoryItemRow
        item={dummyItem}
        onPress={jest.fn()}
        onLongPress={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Vollmilch, 1 L' })).toHaveStyle({
      minHeight: 92,
      flexDirection: 'row',
      alignItems: 'center',
      paddingRight: 4,
      paddingVertical: 17,
    });
  });

  it('verwendet dieselbe native Geometrie in der iOS-Plattformvariante', async () => {
    await render(
      <InventoryItemRowIOS
        item={dummyItem}
        onPress={jest.fn()}
        onLongPress={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Vollmilch, 1 L' })).toHaveStyle({
      minHeight: 92,
      flexDirection: 'row',
      alignItems: 'center',
      paddingRight: 4,
      paddingVertical: 17,
    });
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
    expect(mockSwipeableClose).toHaveBeenCalledTimes(1);
    expect(mockSwipeableClose.mock.invocationCallOrder[0]).toBeLessThan(
      onRemove.mock.invocationCallOrder[0],
    );
  });

  it('zeigt bei mehreren MHD-Losen die Detailaktion statt Entfernen', async () => {
    const groupedItem: InventoryItemGroup = {
      id: 'name:vollmilch|l||',
      name: 'Vollmilch',
      product_id: null,
      quantity: 3,
      unit: 'l',
      package_size: null,
      package_size_unit: null,
      expiry_date: '2026-09-16',
      expiry: {
        bucket: 'soon',
        daysLeft: 2,
        label: 'noch 2 Tage',
        themeColor: 'warning',
      },
      lots: [
        { ...dummyItem, expiry_date: '2026-09-16' },
        { ...dummyItem, id: 'f-2', quantity: 2, expiry_date: '2026-09-18' },
      ],
    };
    const onRemove = jest.fn();
    const user = userEvent.setup();

    await render(
      <InventoryItemRow
        item={groupedItem}
        onPress={jest.fn()}
        onLongPress={jest.fn()}
        onRemove={onRemove}
      />,
    );

    expect(screen.getByText('in 2 Tagen · 2 MHD-Einträge')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Vollmilch mhds anzeigen' })).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Vollmilch mhds anzeigen' }));

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(mockSwipeableClose).toHaveBeenCalledTimes(1);
  });
});
