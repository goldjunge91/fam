import { fireEvent, render, screen } from '@testing-library/react-native';

import type { LocalShoppingItem } from '../hooks/use-shopping-list';
import type { Store } from '../hooks/use-stores';
import { MoveItemsModal } from './move-items-modal';

const item: LocalShoppingItem = {
  id: 'item-1',
  household_id: 'hh-1',
  product_id: null,
  name: 'Bananen',
  quantity: 1,
  unit: 'piece',
  package_size: null,
  package_size_unit: null,
  category_id: 'produce',
  category_source: 'name_fallback',
  category_classifier_version: null,
  category: 'Obst & Gemüse',
  store_id: 'store-1',
  price_estimate: null,
  recipe_names: [],
  checked_at: null,
  checked_by: null,
  sort_index: 0,
  created_at: '2026-08-29T10:00:00Z',
  updated_at: '2026-08-29T10:00:00Z',
};

const stores: Store[] = [
  {
    id: 'store-1',
    household_id: 'hh-1',
    name: 'Supermarkt',
    color: '#ff5500',
    sort_order: 0,
    category_order: null,
  },
  {
    id: 'store-2',
    household_id: 'hh-1',
    name: 'Discounter',
    color: '#0055ff',
    sort_order: 1,
    category_order: null,
  },
];

describe('MoveItemsModal', () => {
  it('sperrt die aktuelle Liste und meldet das gewaehlte Ziel', async () => {
    const onSelect = jest.fn();
    await render(
      <MoveItemsModal
        visible
        selectedItems={[item]}
        stores={stores}
        onSelect={onSelect}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Auf Supermarkt verschieben' })).toBeDisabled();
    const target = screen.getByRole('button', { name: 'Auf Discounter verschieben' });
    expect(target).toBeEnabled();

    await fireEvent.press(target);
    expect(onSelect).toHaveBeenCalledWith('store-2');
  });
});
