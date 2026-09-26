import { render, screen, userEvent } from '@testing-library/react-native';

import { MIN_TOUCH_SIZE } from '@/constants/ui';
import type { LocalBrochurePage } from '../types';
import BrochureViewerScreen from './brochure-viewer-screen';

const mockRouterBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockRouterBack }),
}));

jest.mock('@expo/ui/community/pager-view', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) =>
      React.createElement(View, props, props.children as React.ReactNode),
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
  useBrochurePages: () => ({ data: [PAGE], isLoading: false }),
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

describe('BrochureViewerScreen', () => {
  it('schliesst den Prospekt ueber den Close-Knopf', async () => {
    const user = userEvent.setup();
    mockRouterBack.mockClear();
    await render(<BrochureViewerScreen brochureId="bro-1" />);

    await user.press(screen.getByRole('button', { name: 'Prospekt schließen' }));

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });

  // fam-7ndw: Close-Knopf und Hotspot-Toggle sind eigenstaendige Aktionen.
  // Geprueft wird am antippbaren Pressable, nicht am umgebenden Wrapper.
  it('haelt Close-Knopf und Hotspot-Toggle auf mindestens 44 Punkten', async () => {
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
