import { fireEvent, render, screen } from '@testing-library/react-native';
import type React from 'react';
import { colorsLight } from '@/components/theme';
import { categorySurfaceColors } from '@/features/shopping-list/components/category-surface-colors';
import type { Store } from '@/features/shopping-list/hooks/use-stores';
import { CategoryOrderSheet } from '@/features/shopping-list/sheets/category-order-sheet';
import { i18n } from '@/i18n';

const mockMutateAsync = jest.fn().mockResolvedValue({});

jest.mock('@/features/shopping-list/hooks/use-stores', () => ({
  useSetStoreCategoryOrderMutation: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
}));

jest.mock('@expo/ui', () => {
  const { View } = require('react-native');
  const Host = ({ children, ...props }: { children: React.ReactNode }) => (
    <View {...props}>{children}</View>
  );
  return { __esModule: true, Host };
});

jest.mock('@expo/ui/swift-ui', () => {
  const { Pressable, View } = require('react-native');
  const Wrapper = ({ children }: { children: React.ReactNode }) => <View>{children}</View>;
  const Host = ({ children, ...props }: { children: React.ReactNode }) => (
    <View {...props}>{children}</View>
  );
  const BottomSheet = ({
    children,
    onIsPresentedChange,
  }: {
    children: React.ReactNode;
    onIsPresentedChange: (presented: boolean) => void;
  }) => (
    <View testID="category-order-bottom-sheet">
      <Pressable testID="category-order-dismiss" onPress={() => onIsPresentedChange(false)} />
      {children}
    </View>
  );
  return {
    __esModule: true,
    BottomSheet,
    Group: Wrapper,
    Host,
    RNHostView: Wrapper,
  };
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
    data: import('@/features/shopping-list/domain-logik/shopping-categories').ShoppingCategory[];
    keyExtractor: (
      item: import('@/features/shopping-list/domain-logik/shopping-categories').ShoppingCategory,
    ) => string;
    renderItem: (props: {
      item: import('@/features/shopping-list/domain-logik/shopping-categories').ShoppingCategory;
    }) => React.ReactNode;
    onReorder: (event: { from: number; to: number }) => void;
    ListHeaderComponent: React.ReactNode;
    ListFooterComponent: React.ReactNode;
  }) => (
    <View>
      {ListHeaderComponent}
      {data.map((item) => (
        <React.Fragment key={keyExtractor(item)}>{renderItem({ item })}</React.Fragment>
      ))}
      <Pressable testID="category-order-reorder" onPress={() => onReorder({ from: 0, to: 1 })}>
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
    useIsActive: () => false,
    useReorderableDrag: () => jest.fn(),
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
    expect(screen.getByTestId('category-order-store-color')).toHaveStyle({
      backgroundColor: mockStore.color,
    });
    expect(screen.getByTestId('shopping-category-color-fresh_produce')).toHaveStyle({
      backgroundColor: categorySurfaceColors('#748C5B', colorsLight).background,
    });
  });

  it('rendert den nativen Host bei geschlossenem Sheet nicht', async () => {
    await render(<CategoryOrderSheet isOpen={false} store={mockStore} onClose={mockClose} />);

    expect(screen.queryByTestId('category-order-host')).toBeNull();
  });

  it('speichert die Reihenfolge beim Klick auf Speichern', async () => {
    await render(<CategoryOrderSheet isOpen={true} store={mockStore} onClose={mockClose} />);

    const saveBtn = screen.getByRole('button', { name: 'Speichern' });
    await fireEvent.press(saveBtn);

    expect(saveBtn).toHaveStyle({ backgroundColor: colorsLight.accent });

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'store-1',
        household_id: 'hh-1',
      }),
    );
  });

  it('speichert eine geänderte Reihenfolge ohne ungültige IDs', async () => {
    const store = { ...mockStore, category_order: 'cold_drinks,unknown-category' };
    await render(<CategoryOrderSheet isOpen store={store} onClose={mockClose} />);

    expect(screen.getByText('Wasser, Saft & Softdrinks')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('category-order-reorder'));
    await fireEvent.press(screen.getByRole('button', { name: 'Speichern' }));

    const savedOrder = mockMutateAsync.mock.calls[0]?.[0].categoryOrder;
    expect(savedOrder?.slice(0, 2)).toEqual(['fresh_produce', 'cold_drinks']);
    expect(savedOrder).not.toContain('unknown-category');
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('lässt sich ohne Markt öffnen, aber nicht speichern', async () => {
    await render(<CategoryOrderSheet isOpen store={null} onClose={mockClose} />);

    expect(screen.queryByTestId('category-order-store-color')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Speichern' }));

    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(mockClose).not.toHaveBeenCalled();
  });

  it('schließt sich über die native Sheet-Dismiss-Transition', async () => {
    await render(<CategoryOrderSheet isOpen store={mockStore} onClose={mockClose} />);

    await fireEvent.press(screen.getByTestId('category-order-dismiss'));

    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
