import { fireEvent, render, screen } from '@testing-library/react-native';
import type React from 'react';
import type { LocalShoppingItem } from '@/features/shopping-list/hooks/use-shopping-list';
import { CompleteRunSheet } from '@/features/shopping-list/sheets/complete-run-sheet';

jest.mock('@expo/ui/community/bottom-sheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  const BottomSheet = React.forwardRef(
    ({ children }: { children: React.ReactNode }, ref: unknown) => {
      React.useImperativeHandle(ref, () => ({
        expand: jest.fn(),
        close: jest.fn(),
      }));
      return <View testID="complete-run-bottom-sheet">{children}</View>;
    },
  );
  return {
    __esModule: true,
    default: BottomSheet,
    BottomSheetView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

describe('CompleteRunSheet', () => {
  const mockOnConfirm = jest.fn();
  const mockOnClose = jest.fn();

  const mockCheckedItems: LocalShoppingItem[] = [
    {
      id: 'item-1',
      household_id: 'hh-1',
      product_id: null,
      name: 'Hafermilch',
      quantity: 2,
      unit: 'l',
      package_size: null,
      package_size_unit: null,
      category: 'drinks',
      store_id: null,
      price_estimate: null,
      recipe_names: [],
      sort_index: 0,
      checked_at: '2026-08-20T10:00:00Z',
      checked_by: 'user-1',
      created_at: '2026-08-20T08:00:00Z',
      updated_at: '2026-08-20T10:00:00Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rendert abgehakte Artikel im Transfer-Dialog', async () => {
    await render(
      <CompleteRunSheet
        isOpen={true}
        checkedItems={mockCheckedItems}
        onConfirm={mockOnConfirm}
        onClose={mockOnClose}
      />,
    );

    expect(screen.getByText('In Vorrat übernehmen')).toBeTruthy();
    expect(screen.getByText('Hafermilch')).toBeTruthy();
  });

  it('erlaubt das Wechseln des Lagerorts und Bestätigen', async () => {
    await render(
      <CompleteRunSheet
        isOpen={true}
        checkedItems={mockCheckedItems}
        onConfirm={mockOnConfirm}
        onClose={mockOnClose}
      />,
    );

    const frostBtn = screen.getByRole('radio', { name: 'Frost' });
    await fireEvent.press(frostBtn);

    const confirmBtn = screen.getByRole('button', { name: /in Vorrat übernehmen/i });
    await fireEvent.press(confirmBtn);

    expect(mockOnConfirm).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Hafermilch',
          locationKind: 'freezer',
        }),
      ]),
    );
  });

  it('erlaubt das Korrigieren der Menge per Zifferneingabe', async () => {
    await render(
      <CompleteRunSheet
        isOpen={true}
        checkedItems={mockCheckedItems}
        onConfirm={mockOnConfirm}
        onClose={mockOnClose}
      />,
    );

    const qtyBadge = screen.getByRole('button', { name: /Menge für Hafermilch/i });
    await fireEvent.press(qtyBadge);

    const input = screen.getByLabelText('Menge für Hafermilch eingeben');
    await fireEvent.changeText(input, '1,5');
    await fireEvent(input, 'submitEditing');

    const confirmBtn = screen.getByRole('button', { name: /in Vorrat übernehmen/i });
    await fireEvent.press(confirmBtn);

    expect(mockOnConfirm).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: 'Hafermilch', quantity: 1.5 })]),
    );
  });
});
