import { fireEvent, render, screen } from '@testing-library/react-native';
import type { LocalFridgeItem } from '../use-fridge-items';
import { FridgeItemRow } from './fridge-item-row';

describe('FridgeItemRow', () => {
  const dummyItem: LocalFridgeItem = {
    id: 'f-1',
    household_id: 'hh-1',
    location_id: 'loc-1',
    product_id: null,
    name: 'Vollmilch',
    quantity: 1,
    unit: 'l',
    expiry_date: null,
    added_by: 'usr-1',
    created_at: new Date().toISOString(),
    location_kind: 'fridge',
    location_name: 'Kühlschrank',
  };

  it('sollte den Artikelnamen und Lagerort rendern', async () => {
    await render(
      <FridgeItemRow
        item={dummyItem}
        onPress={jest.fn()}
        onDecrement={jest.fn()}
        onIncrement={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByText('Vollmilch')).toBeTruthy();
    expect(screen.getByText('Kühlschrank')).toBeTruthy();
    expect(screen.getByText('1 l')).toBeTruthy();
  });

  it('sollte onIncrement und onDecrement beim Klick auf die Stepper-Knöpfe auslösen', async () => {
    const onIncMock = jest.fn();
    const onDecMock = jest.fn();

    await render(
      <FridgeItemRow
        item={dummyItem}
        onPress={jest.fn()}
        onDecrement={onDecMock}
        onIncrement={onIncMock}
        onDelete={jest.fn()}
      />,
    );

    await fireEvent.press(screen.getByLabelText('Menge erhöhen'));
    expect(onIncMock).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByLabelText('Menge reduzieren'));
    expect(onDecMock).toHaveBeenCalledTimes(1);
  });

  it('sollte onPress beim Antippen der Zeile auslösen', async () => {
    const onPressMock = jest.fn();

    await render(
      <FridgeItemRow
        item={dummyItem}
        onPress={onPressMock}
        onDecrement={jest.fn()}
        onIncrement={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    await fireEvent.press(screen.getByLabelText('Vollmilch, 1 l'));
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });
});
