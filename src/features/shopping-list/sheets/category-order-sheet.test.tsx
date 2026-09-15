import { fireEvent, render, screen } from '@testing-library/react-native';
import type React from 'react';
import type { Store } from '@/features/shopping-list/hooks/use-stores';
import { CategoryOrderSheet } from '@/features/shopping-list/sheets/category-order-sheet';
import { i18n } from '@/i18n';

const mockMutateAsync = jest.fn().mockResolvedValue({});

jest.mock('@/features/shopping-list/hooks/use-stores', () => ({
  useSetStoreCategoryOrderMutation: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
}));

jest.mock('@expo/ui/swift-ui', () => {
  const { View } = require('react-native');
  const Wrapper = ({ children }: { children: React.ReactNode }) => <View>{children}</View>;
  const BottomSheet = ({ children }: { children: React.ReactNode }) => (
    <View testID="category-order-bottom-sheet">{children}</View>
  );
  return {
    __esModule: true,
    BottomSheet,
    Group: Wrapper,
    Host: Wrapper,
    RNHostView: Wrapper,
  };
});

jest.mock('@expo/ui/swift-ui/modifiers', () => ({
  presentationDetents: jest.fn(),
  presentationDragIndicator: jest.fn(),
}));

describe('CategoryOrderSheet', () => {
  const mockClose = jest.fn();

  const mockStore: Store = {
    id: 'store-1',
    household_id: 'hh-1',
    name: 'Rewe',
    color: '#E53E3E',
    sort_order: 0,
    category_order: null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    await i18n.changeLanguage('de');
  });

  it('rendert Kategorienliste für den ausgewählten Markt', async () => {
    await render(<CategoryOrderSheet isOpen={true} store={mockStore} onClose={mockClose} />);

    expect(screen.getByText('Reihenfolge bearbeiten')).toBeTruthy();
    expect(screen.getByText('Obst & Gemüse')).toBeTruthy();
  });

  it('speichert die Reihenfolge beim Klick auf Speichern', async () => {
    await render(<CategoryOrderSheet isOpen={true} store={mockStore} onClose={mockClose} />);

    const saveBtn = screen.getByRole('button', { name: 'Speichern' });
    await fireEvent.press(saveBtn);

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'store-1',
        household_id: 'hh-1',
      }),
    );
  });
});
