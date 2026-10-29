import { render, screen, userEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { MIN_TOUCH_SIZE } from '@/constants/ui';
import type { LocalBrochurePage } from '../types';
import BrochureViewerScreen from './brochure-viewer-screen';

const mockRouterBack = jest.fn();

type MockPagerPageProps = {
  isCurrent?: boolean;
  onZoomStateChange?: (zoomed: boolean) => void;
};

type MockPagerProps = {
  children?: ReactNode;
  onPageSelected?: (event: { nativeEvent: { position: number } }) => void;
  scrollEnabled?: boolean;
};

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockRouterBack }),
}));
jest.mock('@expo/ui/community/pager-view', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');
  return {
    __esModule: true,
    default: (props: MockPagerProps) => {
      const pages = React.Children.toArray(props.children);
      const selectedPageIndex = Math.max(
        pages.findIndex(
          (page: unknown) => React.isValidElement<MockPagerPageProps>(page) && page.props.isCurrent,
        ),
        0,
      );
      const selectedPage = pages[selectedPageIndex];
      const onZoomStateChange = React.isValidElement<MockPagerPageProps>(selectedPage)
        ? selectedPage.props.onZoomStateChange
        : undefined;

      return React.createElement(
        View,
        null,
        React.createElement(
          Text,
          {
            accessibilityRole: 'text',
            accessibilityLabel: `Seite ${selectedPageIndex + 1} ausgewählt`,
          },
          `Seite ${selectedPageIndex + 1}`,
        ),
        React.createElement(
          Text,
          {
            accessibilityRole: 'text',
            accessibilityLabel: `Seitenscrollen ${props.scrollEnabled === false ? 'deaktiviert' : 'aktiviert'}`,
          },
          props.scrollEnabled === false ? 'Seitenscrollen deaktiviert' : 'Seitenscrollen aktiviert',
        ),
        React.createElement(
          Pressable,
          {
            accessibilityRole: 'button',
            accessibilityLabel: 'Zoomansicht simulieren',
            onPress: () => onZoomStateChange?.(true),
          },
          React.createElement(Text, null, 'Zoomansicht'),
        ),
        React.createElement(
          Pressable,
          {
            accessibilityRole: 'button',
            accessibilityLabel: 'Seite 2 auswählen',
            onPress: () => props.onPageSelected?.({ nativeEvent: { position: 1 } }),
          },
          React.createElement(Text, null, 'Seite 2'),
        ),
        ...pages,
      );
    },
  };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      accent: '#ff0000',
      background: '#ffffff',
      backgroundElement: '#f5f5f5',
      backgroundSoft: '#eeeeee',
      border: '#dddddd',
      onAccent: '#ffffff',
      scrim: '#00000088',
      text: '#111111',
      textSecondary: '#555555',
      viewerBackground: '#222222',
    },
  }),
}));
jest.mock('../hooks/use-brochures', () => ({
  useBrochurePages: () => mockBrochurePagesState,
}));
jest.mock('@/features/shopping-list/hooks/use-stores', () => ({
  useStores: () => ({ data: [] }),
  findStoreByName: () => undefined,
}));
jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: 'hh-1' }),
}));
jest.mock('@/features/shopping-list/hooks/use-shopping-list-mutations', () => ({
  useAddShoppingItem: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('@/features/shopping-list/preferences/api', () => ({
  resolveCategoryForItem: jest.fn(),
}));

const PAGE: LocalBrochurePage = {
  id: 'page-1',
  brochureId: 'bro-1',
  storeName: 'Supermarkt',
  pageNumber: 1,
  imageUrl: 'https://example.test/page.jpg',
  hotspots: [],
};
const SECOND_PAGE: LocalBrochurePage = {
  ...PAGE,
  id: 'page-2',
  pageNumber: 2,
  imageUrl: 'https://example.test/page-2.jpg',
};
const PAGES = [PAGE, SECOND_PAGE];
let mockBrochurePagesState: { data: LocalBrochurePage[] | undefined; isLoading: boolean } = {
  data: PAGES,
  isLoading: false,
};

describe('BrochureViewerScreen', () => {
  beforeEach(() => {
    mockBrochurePagesState = { data: PAGES, isLoading: false };
    mockRouterBack.mockClear();
  });

  it.each([
    ['während des Ladens', true],
    ['ohne verfügbare Seiten', false],
  ] as const)('zeigt den Ladezustand %s', async (_state, isLoading) => {
    mockBrochurePagesState = { data: undefined, isLoading };
    await render(<BrochureViewerScreen brochureId="bro-1" />);

    expect(screen.getByText('Prospekt wird geladen...')).toBeOnTheScreen();
  });

  it('schließt den Prospekt über die zugängliche Aktion', async () => {
    const user = userEvent.setup();
    await render(<BrochureViewerScreen brochureId="bro-1" />);

    await user.press(screen.getByRole('button', { name: 'Prospekt schließen' }));

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });

  it('schaltet Artikel-Hotspots über einen echten Press zwischen an und aus', async () => {
    const user = userEvent.setup();
    await render(<BrochureViewerScreen brochureId="bro-1" />);

    expect(screen.getByRole('switch', { name: 'Artikel-Hotspots' })).toBeChecked();
    await user.press(screen.getByRole('switch', { name: 'Artikel-Hotspots' }));
    expect(screen.getByRole('switch', { name: 'Artikel-Hotspots' })).not.toBeChecked();
    await user.press(screen.getByRole('switch', { name: 'Artikel-Hotspots' }));
    expect(screen.getByRole('switch', { name: 'Artikel-Hotspots' })).toBeChecked();
  });

  it('übernimmt die Pager-Seite und gibt den Seitenscroll nach dem Wechsel wieder frei', async () => {
    const user = userEvent.setup();
    await render(<BrochureViewerScreen brochureId="bro-1" />);

    expect(screen.getByRole('text', { name: 'Seite 1 ausgewählt' })).toBeOnTheScreen();
    expect(screen.getByRole('text', { name: 'Seitenscrollen aktiviert' })).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Zoomansicht simulieren' }));
    expect(screen.getByRole('text', { name: 'Seitenscrollen deaktiviert' })).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Seite 2 auswählen' }));
    expect(screen.getByRole('text', { name: 'Seite 2 ausgewählt' })).toBeOnTheScreen();
    expect(screen.getByRole('text', { name: 'Seitenscrollen aktiviert' })).toBeOnTheScreen();
  });

  it('hält Close-Knopf und Hotspot-Toggle auf mindestens 44 Punkten', async () => {
    await render(<BrochureViewerScreen brochureId="bro-1" />);
    expect(screen.getByRole('button', { name: 'Prospekt schließen' })).toHaveStyle({
      width: MIN_TOUCH_SIZE,
      height: MIN_TOUCH_SIZE,
    });
    expect(screen.getByRole('switch', { name: 'Artikel-Hotspots' })).toHaveStyle({
      minHeight: MIN_TOUCH_SIZE,
    });
    expect(MIN_TOUCH_SIZE).toBeGreaterThanOrEqual(44);
  });
});
