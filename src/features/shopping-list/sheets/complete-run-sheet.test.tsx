import { fireEvent, render, screen } from '@testing-library/react-native';
import type React from 'react';
import { colorsLight } from '@/components/theme';
import type { LocalShoppingItem } from '@/features/shopping-list/hooks/use-shopping-list';
import { CompleteRunSheet } from '@/features/shopping-list/sheets/complete-run-sheet';
import { i18n } from '@/i18n';

jest.mock('@expo/ui', () => {
  const { View } = require('react-native');
  const Host = ({ children, ...props }: { children: React.ReactNode }) => (
    <View {...props}>{children}</View>
  );
  return { __esModule: true, Host };
});

jest.mock('@expo/ui/swift-ui', () => {
  const { Pressable, Text, View } = require('react-native');
  const Wrapper = ({ children }: { children: React.ReactNode }) => <View>{children}</View>;
  const Host = ({ children, ...props }: { children: React.ReactNode }) => (
    <View {...props}>{children}</View>
  );
  const DatePicker = ({
    title,
    onDateChange,
  }: {
    title: string;
    onDateChange: (date: Date) => void;
  }) => (
    <Pressable
      testID="complete-run-date-picker"
      onPress={() => onDateChange(new Date(2026, 8, 15, 12))}>
      <Text>{title}</Text>
    </Pressable>
  );
  const BottomSheet = ({ children }: { children: React.ReactNode }) => (
    <View testID="complete-run-bottom-sheet">{children}</View>
  );
  return {
    __esModule: true,
    BottomSheet,
    DatePicker,
    Group: Wrapper,
    Host,
    RNHostView: Wrapper,
  };
});

jest.mock('@expo/ui/swift-ui/modifiers', () => ({
  datePickerStyle: jest.fn(),
  presentationDetents: jest.fn(),
  presentationDragIndicator: jest.fn(),
}));

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
    },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();
    await i18n.changeLanguage('de');
  });

  it('lässt Taps bei geschlossenem Sheet durch die native Host-Fläche durch', async () => {
    await render(
      <CompleteRunSheet
        isOpen={false}
        checkedItems={mockCheckedItems}
        onConfirm={mockOnConfirm}
        onClose={mockOnClose}
      />,
    );

    expect(screen.getByTestId('complete-run-host')).toHaveProp('pointerEvents', 'none');
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

  it('verwendet den nativen Design-System-DatePicker für das MHD', async () => {
    await render(
      <CompleteRunSheet
        isOpen={true}
        checkedItems={mockCheckedItems}
        onConfirm={mockOnConfirm}
        onClose={mockOnClose}
      />,
    );

    expect(screen.getByTestId('complete-run-date-picker')).toHaveTextContent('MHD');
  });

  it('überträgt die DatePicker-Auswahl als lokales ISO-Datum', async () => {
    await render(
      <CompleteRunSheet
        isOpen={true}
        checkedItems={mockCheckedItems}
        onConfirm={mockOnConfirm}
        onClose={mockOnClose}
      />,
    );

    await fireEvent.press(screen.getByTestId('complete-run-date-picker'));
    await fireEvent.press(screen.getByRole('button', { name: /in Vorrat übernehmen/i }));

    expect(mockOnConfirm).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ expiryDate: '2026-09-15' })]),
    );
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

  it('verwendet für die Vorratsübernahme das zentrale gefüllte CTA-Rezept', async () => {
    await render(
      <CompleteRunSheet
        isOpen={true}
        checkedItems={mockCheckedItems}
        onConfirm={mockOnConfirm}
        onClose={mockOnClose}
      />,
    );

    expect(screen.getByRole('button', { name: /in Vorrat übernehmen/i })).toHaveStyle({
      backgroundColor: colorsLight.accent,
      minHeight: 44,
    });
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
