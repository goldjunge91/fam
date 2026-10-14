import { fireEvent, render, screen } from '@testing-library/react-native';
import type React from 'react';
import { colorsLight } from '@/components/theme';
import type { LocalShoppingItem } from '@/features/shopping-list/hooks/use-shopping-list';
import { i18n } from '@/i18n';

const { CompleteRunSheet } = jest.requireActual<typeof import('./complete-run-sheet.android')>(
  './complete-run-sheet.android',
);

jest.mock('@expo/ui/community/bottom-sheet', () => {
  const React = require('react') as typeof import('react');
  const { Pressable, View } = require('react-native') as typeof import('react-native');
  const BottomSheet = React.forwardRef(
    (
      { children, onClose }: { children: React.ReactNode; onClose: () => void },
      ref: React.ForwardedRef<{ expand: () => void; close: () => void }>,
    ) => {
      React.useImperativeHandle(ref, () => ({ expand: jest.fn(), close: jest.fn() }));
      return (
        <View testID="android-complete-run-sheet">
          <Pressable testID="android-complete-run-dismiss" onPress={onClose} />
          {children}
        </View>
      );
    },
  );

  return { __esModule: true, default: BottomSheet, BottomSheetView: View };
});

jest.mock('@/components/forms/date-wheel-field', () => {
  const { Pressable, Text } = require('react-native') as typeof import('react-native');
  const DateWheelField = ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (date: string | null) => void;
  }) => (
    <Pressable testID="android-complete-run-date" onPress={() => onChange('2026-09-15')}>
      <Text>{value || 'MHD wählen'}</Text>
    </Pressable>
  );
  return { DateWheelField };
});

describe('CompleteRunSheet Android', () => {
  const onConfirm = jest.fn();
  const onClose = jest.fn();
  const item: LocalShoppingItem = {
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
    category: 'drinks',
    store_id: null,
    price_estimate: null,
    recipe_names: [],
    sort_index: 0,
    checked_at: '2026-08-20T10:00:00Z',
    checked_by: 'user-1',
    created_at: '2026-08-20T08:00:00Z',
    updated_at: '2026-08-20T10:00:00Z',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    await i18n.changeLanguage('de');
  });

  it('renders checked items, manages the native sheet state, and closes on cancel', async () => {
    await render(
      <CompleteRunSheet isOpen checkedItems={[item]} onConfirm={onConfirm} onClose={onClose} />,
    );

    expect(screen.getByText('Hafermilch')).toBeTruthy();
    expect(screen.getByText('In Vorrat übernehmen')).toBeTruthy();
    expect(screen.getByText('MHD wählen')).toBeTruthy();

    await fireEvent.press(screen.getByRole('radio', { name: 'Kühl' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('updates storage kind and expiry date before confirming the transfer', async () => {
    await render(
      <CompleteRunSheet isOpen checkedItems={[item]} onConfirm={onConfirm} onClose={onClose} />,
    );

    await fireEvent.press(screen.getByRole('radio', { name: 'Frost' }));
    await fireEvent.press(screen.getByTestId('android-complete-run-date'));
    await fireEvent.press(screen.getByRole('button', { name: /in Vorrat übernehmen/i }));

    expect(onConfirm).toHaveBeenCalledWith([
      expect.objectContaining({
        name: 'Hafermilch',
        locationKind: 'freezer',
        expiryDate: '2026-09-15',
      }),
    ]);
  });

  it('accepts a valid comma decimal and ignores invalid or non-positive quantities', async () => {
    await render(
      <CompleteRunSheet isOpen checkedItems={[item]} onConfirm={onConfirm} onClose={onClose} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: /Menge für Hafermilch/i }));
    const quantityInput = screen.getByLabelText('Menge für Hafermilch eingeben');
    await fireEvent.changeText(quantityInput, '1,5');
    await fireEvent(quantityInput, 'submitEditing');
    await fireEvent.press(screen.getByRole('button', { name: /Menge für Hafermilch/i }));
    await fireEvent.changeText(quantityInput, '0');
    await fireEvent(quantityInput, 'blur');
    await fireEvent.press(screen.getByRole('button', { name: /in Vorrat übernehmen/i }));

    expect(onConfirm).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'Hafermilch', quantity: 1.5 }),
    ]);
  });

  it('disables confirmation for an empty list and closes from the sheet callback', async () => {
    await render(
      <CompleteRunSheet isOpen={false} checkedItems={[]} onConfirm={onConfirm} onClose={onClose} />,
    );

    expect(screen.getByRole('button', { name: /in Vorrat übernehmen/i })).toBeDisabled();
    await fireEvent.press(screen.getByTestId('android-complete-run-dismiss'));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows a package hint when the checked item has a package size', async () => {
    const packagedItem = { ...item, package_size: 1, package_size_unit: 'l' };
    await render(
      <CompleteRunSheet
        isOpen
        checkedItems={[packagedItem]}
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );

    expect(screen.getByText(/\b1 l\b/i)).toBeTruthy();
  });

  it('skips a newly checked item until its transfer state is synchronized', async () => {
    const { rerender } = await render(
      <CompleteRunSheet isOpen checkedItems={[]} onConfirm={onConfirm} onClose={onClose} />,
    );

    await rerender(
      <CompleteRunSheet isOpen checkedItems={[item]} onConfirm={onConfirm} onClose={onClose} />,
    );

    expect(screen.getByText('Hafermilch')).toBeTruthy();
  });

  it('uses the shared full-width success action styling', async () => {
    await render(
      <CompleteRunSheet isOpen checkedItems={[item]} onConfirm={onConfirm} onClose={onClose} />,
    );

    expect(screen.getByRole('button', { name: /in Vorrat übernehmen/i })).toHaveStyle({
      backgroundColor: colorsLight.accent,
      minHeight: 44,
    });
  });
});
