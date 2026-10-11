import { act, render, screen, userEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { DraxDemoScreen as SharedDraxDemoScreen } from './drax-demo-screen';
import { DraxDemoScreen as AndroidDraxDemoScreen } from './drax-demo-screen.android';

const mockUseDevToolsAccess = jest.fn(() => true);
let mockIsDragging = false;
const mockMeasureRoot = jest.fn((callback: (x: number, y: number) => void) => callback(10, 20));

jest.mock('expo-router', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    Redirect: ({ href }: { href: string }) => React.createElement(Text, null, `Redirect ${href}`),
    router: { back: jest.fn() },
  };
});

jest.mock('react-native-drax', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  const Container = ({ children }: { children?: ReactNode }) =>
    React.createElement(View, null, children);

  return {
    DraxProvider: Container,
    SortableContainer: ({
      children,
      sortable,
    }: {
      children?: ReactNode;
      sortable: {
        data: { id: string }[];
        onReorder: (args: { data: { id: string }[] }) => void;
      };
    }) =>
      React.createElement(
        View,
        null,
        children,
        React.createElement(
          Pressable,
          {
            accessibilityRole: 'button',
            accessibilityLabel: 'Simulate reorder',
            onPress: () => sortable.onReorder({ data: sortable.data }),
          },
          React.createElement(Text, null, 'Simulate reorder'),
        ),
      ),
    SortableItem: Container,
    packGrid: (
      count: number,
      columns: number,
      getItemSpan: (index: number) => { colSpan: number; rowSpan: number },
    ) => {
      const spans = Array.from({ length: count }, (_, index) => getItemSpan(index));
      return {
        totalRows: Math.ceil(count / columns),
        positions: spans.map((_, index) => ({
          col: index % columns,
          row: Math.floor(index / columns),
        })),
      };
    },
    useDraxContext: () => ({
      rootViewRef: { current: { measureInWindow: mockMeasureRoot } },
      rootOffsetSV: { value: { x: 0, y: 0 } },
      hoverPositionSV: { value: { x: 0, y: 0 } },
      draggedIdSV: { value: mockIsDragging ? 'A' : null },
    }),
    useSortableList: ({
      data,
      onReorder,
    }: {
      data: { id: string }[];
      onReorder: (args: { data: { id: string }[] }) => void;
    }) => ({
      data,
      stableKeyExtractor: (item: { id: string }) => item.id,
      onScroll: jest.fn(),
      onContentSizeChange: jest.fn(),
      onReorder,
    }),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 12, right: 0, bottom: 20, left: 0 }),
}));

jest.mock('@/components/layout/screen', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text, View } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    Screen: ({ title, children }: { title: string; children: ReactNode }) =>
      React.createElement(View, null, React.createElement(Text, null, title), children),
  };
});

jest.mock('@/constants/ui', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } =
    jest.requireActual<typeof import('react-native')>('react-native');

  return {
    Button: ({ title, onPress }: { title: string; onPress: () => void }) =>
      React.createElement(
        Pressable,
        { accessibilityRole: 'button', accessibilityLabel: title, onPress },
        React.createElement(Text, null, title),
      ),
    Surface: ({ children }: { children?: ReactNode }) => React.createElement(View, null, children),
    Txt: ({ children }: { children: ReactNode }) => React.createElement(Text, null, children),
  };
});

jest.mock('@/hooks/use-dev-tools-access', () => ({
  useDevToolsAccess: () => mockUseDevToolsAccess(),
}));

jest.mock('@/lib/observability/debug-log', () => ({ debugLog: jest.fn() }));

jest.mock('react-native-unistyles', () => jest.requireActual('react-native-unistyles/mocks'));

const mockRouterBack = jest.requireMock('expo-router').router.back as jest.Mock;

const variants = [
  ['shared', SharedDraxDemoScreen],
  ['Android', AndroidDraxDemoScreen],
] as const;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseDevToolsAccess.mockReturnValue(true);
  mockIsDragging = false;
});

it.each(variants)('%s demo redirects and supports its layout controls', async (_name, Screen) => {
  const user = userEvent.setup();
  mockUseDevToolsAccess.mockReturnValueOnce(false);
  await render(<Screen />);
  expect(screen.getByText('Redirect /settings')).toBeOnTheScreen();

  await render(<Screen />);
  expect(screen.getByText('Drax-Demo: Basis')).toBeOnTheScreen();
  expect(screen.getByText('A')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Simulate reorder' }));

  await user.press(screen.getByRole('button', { name: 'Zurück' }));
  expect(mockRouterBack).toHaveBeenCalledTimes(1);

  await user.press(screen.getByRole('button', { name: 'Mit Screen' }));
  expect(screen.getByText('Drax-Demo')).toBeOnTheScreen();
  await user.press(screen.getByRole('button', { name: 'Reset' }));
  await user.press(screen.getByRole('button', { name: 'Ohne Screen' }));
  expect(screen.getByText('Drax-Demo: Basis')).toBeOnTheScreen();
});

it.each(variants)('%s demo measures the root while a drag is active', async (_name, Screen) => {
  jest.useFakeTimers();
  mockIsDragging = true;

  try {
    await render(<Screen />);
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(mockMeasureRoot).toHaveBeenCalled();
  } finally {
    mockIsDragging = false;
    jest.useRealTimers();
  }
});
