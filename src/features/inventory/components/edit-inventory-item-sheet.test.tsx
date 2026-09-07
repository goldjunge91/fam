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
        expiry_date: '2026-12-31',
        expiry_user_set: false,
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
        expiry_date: '2027-01-02',
        expiry_user_set: true,
      }),
    );
  });
});
