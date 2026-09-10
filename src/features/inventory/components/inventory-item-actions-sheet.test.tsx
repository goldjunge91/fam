import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { LocalInventoryItem } from '../use-inventory-items';
import { InventoryItemActionsSheet } from './inventory-item-actions-sheet';

const ITEM: LocalInventoryItem = {
  id: 'item-1',
  household_id: 'household-1',
  location_id: null,
  product_id: null,
  name: 'Milch',
  quantity: 2,
  unit: 'l',
  package_size: null,
  package_size_unit: null,
  expiry_date: null,
  opened_at: null,
  vacuum_sealed: false,
  expiry_user_set: false,
  added_by: null,
  created_at: '',
  location_kind: null,
  location_name: null,
};

const CALLBACKS = {
  onClose: jest.fn(),
  onQuantityChange: jest.fn(),
  onEdit: jest.fn(),
  onConsume: jest.fn(),
  onOpen: jest.fn(),
  onWaste: jest.fn(),
  onExpiryChange: jest.fn(),
};

it('meldet das Ende der nativen Schließanimation des Los-Aktions-Sheets', async () => {
  const onDismissFinished = jest.fn();
  const { container } = await render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <InventoryItemActionsSheet
        visible
        item={ITEM}
        {...CALLBACKS}
        onDismissFinished={onDismissFinished}
      />
    </SafeAreaProvider>,
  );

  const modal = container.queryAll(
    (instance) => typeof instance.props.onRequestClose === 'function',
  )[0];
  expect(modal).toBeDefined();
  modal?.props.onDismiss();

  expect(onDismissFinished).toHaveBeenCalledTimes(1);
});
