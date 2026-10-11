import { fireEvent, render, screen } from '@testing-library/react-native';
import type React from 'react';
import type { ShoppingCategory } from '@/features/shopping-list/domain-logik/shopping-categories';
import type { Store } from '@/features/shopping-list/hooks/use-stores';
import { i18n } from '@/i18n';

const { CategoryOrderSheet } = jest.requireActual<typeof import('./category-order-sheet.android')>(
  './category-order-sheet.android',
);

const mockMutateAsync = jest.fn().mockResolvedValue(undefined);
const mockIsActive = { current: false };

jest.mock('@/features/shopping-list/hooks/use-stores', () => ({
  useSetStoreCategoryOrderMutation: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
}));

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
        <View testID="android-category-order-sheet">
          <Pressable testID="android-category-order-dismiss" onPress={onClose} />
          {children}
        </View>
      );
    },
  );

  return { __esModule: true, default: BottomSheet, BottomSheetView: View };
});

jest.mock('react-native-reorderable-list', () => {
  const React = require('react') as typeof import('react');
  const { Pressable, Text, View } = require('react-native') as typeof import('react-native');
  const ReorderableList = ({
    data,
    keyExtractor,
    renderItem,
    onReorder,
    ListHeaderComponent,
    ListFooterComponent,
  }: {
    data: ShoppingCategory[];
    keyExtractor: (item: ShoppingCategory) => string;
    renderItem: (props: { item: ShoppingCategory }) => React.ReactNode;
    onReorder: (event: { from: number; to: number }) => void;
    ListHeaderComponent: React.ReactNode;
    ListFooterComponent: React.ReactNode;
  }) => (
    <View>
      {ListHeaderComponent}
      {data.map((item) => (
        <React.Fragment key={keyExtractor(item)}>{renderItem({ item })}</React.Fragment>
      ))}
      <Pressable
        testID="android-category-order-reorder"
        onPress={() => onReorder({ from: 0, to: 1 })}>
        <Text>Reorder</Text>
      </Pressable>
      {ListFooterComponent}
    </View>
  );

  return {
    __esModule: true,
    default: ReorderableList,
    reorderItems: <T,>(items: T[], from: number, to: number) => {
      const next = [...items];
      const [item] = next.splice(from, 1);
      if (item) next.splice(to, 0, item);
      return next;
    },
    useIsActive: () => mockIsActive.current,
    useReorderableDrag: () => jest.fn(),
  };
});

describe('CategoryOrderSheet Android', () => {
  const onClose = jest.fn();
  const store: Store = {
    id: 'store-1',
    household_id: 'hh-1',
    name: 'Rewe',
    color: '#E53E3E',
    sort_order: 0,
    category_order: 'cold_drinks,unknown-category',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockIsActive.current = false;
    await i18n.changeLanguage('de');
  });

  it('loads the saved order, reorders categories, then saves and closes', async () => {
    mockIsActive.current = true;
    await render(<CategoryOrderSheet isOpen store={store} onClose={onClose} />);

    expect(screen.getByText('Reihenfolge bearbeiten')).toBeTruthy();
    expect(screen.getByTestId('category-order-store-color')).toHaveStyle({
      backgroundColor: store.color,
    });

    await fireEvent.press(screen.getByTestId('android-category-order-reorder'));
    await fireEvent.press(screen.getByRole('button', { name: 'Speichern' }));

    expect(mockMutateAsync).toHaveBeenCalledWith({
      id: 'store-1',
      household_id: 'hh-1',
      categoryOrder: expect.arrayContaining(['bakery', 'cold_drinks']),
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('resets to the built-in order and closes from the sheet callback', async () => {
    await render(<CategoryOrderSheet isOpen store={store} onClose={onClose} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Auf Standard zurücksetzen' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Speichern' }));

    const savedOrder = mockMutateAsync.mock.calls[0]?.[0].categoryOrder;
    expect(savedOrder?.[0]).toBe('fresh_produce');
    await fireEvent.press(screen.getByTestId('android-category-order-dismiss'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('allows opening without a store but does not save or show a market color', async () => {
    await render(<CategoryOrderSheet isOpen={false} store={null} onClose={onClose} />);

    expect(screen.queryByTestId('category-order-store-color')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Speichern' }));
    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
