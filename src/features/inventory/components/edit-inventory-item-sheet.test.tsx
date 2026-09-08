import { render, screen, userEvent } from '@testing-library/react-native';

import type { LocalInventoryItem } from '../use-inventory-items';
import { EditInventoryItemSheet } from './edit-inventory-item-sheet';

const mockMutateAsync = jest.fn().mockResolvedValue(undefined);

jest.mock('@/components/forms/date-wheel-field', () => {
  const { Pressable, Text } = require('react-native');

  return {
    DateWheelField: ({
      label,
      value,
      onChange,
    }: {
      label?: string;
      value: string;
      onChange: (value: string) => void;
    }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={value ? `${label} ${value} ändern` : `${label} auswählen`}
        onPress={() => onChange('2027-01-02')}>
        <Text>{value}</Text>
      </Pressable>
    ),
  };
});

jest.mock('@/components/forms/wheel-picker-field', () => {
  const { Text } = require('react-native');

  return {
    WheelPickerField: ({ label }: { label?: string }) => <Text>{label}</Text>,
  };
});

jest.mock('@/features/inventory/use-inventory-mutations', () => ({
  useUpdateFridgeItemMutation: () => ({
    isPending: false,
    mutateAsync: mockMutateAsync,
  }),
}));

jest.mock('@/hooks/use-sheet-shadow-style', () => ({
  useSheetShadowStyle: () => ({}),
}));

const AUTO_MHD_ITEM: LocalInventoryItem = {
  id: 'item-1',
  household_id: 'household-1',
  location_id: null,
  product_id: 'product-1',
  name: 'Senf',
  quantity: 1,
  unit: 'piece',
  package_size: null,
  package_size_unit: null,
  expiry_date: '2026-12-31',
  opened_at: null,
  vacuum_sealed: false,
  expiry_user_set: false,
  added_by: 'user-1',
  created_at: '2026-09-07T08:00:00.000Z',
  location_kind: 'fridge',
  location_name: 'Kühlschrank',
};

function renderSheet(item: LocalInventoryItem = AUTO_MHD_ITEM) {
  return render(<EditInventoryItemSheet visible item={item} locations={[]} onClose={jest.fn()} />);
}

function saveButton() {
  return screen.getByRole('button', { name: 'Änderungen speichern' });
}

describe('EditInventoryItemSheet MHD-Schutzvertrag', () => {
  beforeEach(() => {
    mockMutateAsync.mockClear();
  });

  it('bewahrt ein automatisches MHD beim Speichern ohne manuelle Änderung', async () => {
    const user = userEvent.setup();

    await renderSheet();
    await user.press(saveButton());

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: {},
      }),
    );
  });

  it('setzt expiry_user_set bei einer manuellen MHD-Auswahl auf true', async () => {
    const user = userEvent.setup();

    await renderSheet();
    await user.press(screen.getByRole('button', { name: 'Weitere Angaben öffnen' }));
    await user.press(
      screen.getByRole('button', { name: 'Mindesthaltbarkeitsdatum 2026-12-31 ändern' }),
    );
    await user.press(saveButton());

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: { expiry_date: '2027-01-02', expiry_user_set: true },
      }),
    );
  });
});

describe('EditInventoryItemSheet Mengenkorrektur-Vertrag (fam-87p)', () => {
  beforeEach(() => {
    mockMutateAsync.mockClear();
  });

  it('schickt bei einer reinen Namensänderung keine quantityCorrection, auch wenn der Bestand zwischenzeitlich verbraucht wurde', async () => {
    const user = userEvent.setup();

    await renderSheet();
    await user.type(screen.getByLabelText('Artikelname'), 'x');
    await user.press(saveButton());

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    const payload = mockMutateAsync.mock.calls[0]?.[0];
    expect(payload).not.toHaveProperty('quantityCorrection');
  });

  it('schickt bei einer bewussten Mengenänderung eine quantityCorrection mit der beim Öffnen geladenen Menge als expectedQuantity', async () => {
    const user = userEvent.setup();

    await renderSheet();
    await user.press(screen.getByRole('button', { name: 'Menge erhöhen' }));
    await user.press(saveButton());

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        quantityCorrection: { expectedQuantity: 1, newQuantity: 2 },
      }),
    );
  });
});


describe('EditInventoryItemSheet explizite Metadaten-Patches', () => {
  beforeEach(() => {
    mockMutateAsync.mockClear();
  });

  it('sendet nach fremden Metadatenänderungen nur den bearbeiteten Namen und bewahrt den Entwurf', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    await render(
      <EditInventoryItemSheet visible item={AUTO_MHD_ITEM} locations={[]} onClose={onClose} />,
    );
    await user.clear(screen.getByLabelText('Artikelname'));
    await user.type(screen.getByLabelText('Artikelname'), 'Dijon-Senf');

    await screen.rerender(
      <EditInventoryItemSheet
        visible
        item={{ ...AUTO_MHD_ITEM, quantity: 0.5, expiry_date: '2027-03-01', vacuum_sealed: true }}
        locations={[]}
        onClose={onClose}
      />,
    );
    await user.press(saveButton());

    expect(mockMutateAsync).toHaveBeenCalledWith({
      id: AUTO_MHD_ITEM.id,
      household_id: AUTO_MHD_ITEM.household_id,
      patch: { name: 'Dijon-Senf' },
    });
  });

  it('sendet beim bewussten Wieder-Versiegeln opened_at als null', async () => {
    const user = userEvent.setup();
    await renderSheet({ ...AUTO_MHD_ITEM, opened_at: '2026-09-07T09:00:00.000Z' });
    await user.press(screen.getByRole('button', { name: 'Weitere Angaben öffnen' }));
    await user.press(screen.getByRole('button', { name: 'Wieder versiegeln' }));
    await user.press(saveButton());

    expect(mockMutateAsync).toHaveBeenCalledWith({
      id: AUTO_MHD_ITEM.id,
      household_id: AUTO_MHD_ITEM.household_id,
      patch: { opened_at: null, expiry_user_set: true },
    });
  });
});
