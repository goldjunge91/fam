import { fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert, Linking } from 'react-native';
import { MIN_TOUCH_SIZE } from '@/constants/ui';
import type { Store } from '@/features/shopping-list/hooks/use-stores';
import type { Hotspot, LocalBrochurePage } from '../types';
import BrochureViewerScreen from './brochure-viewer-screen';

const mockRouterBack = jest.fn();
const mockAddShoppingItem = jest.fn();
const mockFindStoreByName = jest.fn();
const mockResolveCategoryForItem = jest.fn();
let mockIsAddShoppingItemPending = false;
let mockActiveHouseholdId: string | null = 'hh-1';
const mockHouseholdStores: Store[] = [];

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
  useStores: () => ({ data: mockHouseholdStores }),
  findStoreByName: (...args: Parameters<typeof mockFindStoreByName>) =>
    mockFindStoreByName(...args),
}));
jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: mockActiveHouseholdId }),
}));
jest.mock('@/features/shopping-list/hooks/use-shopping-list-mutations', () => ({
  useAddShoppingItem: () => ({
    mutateAsync: mockAddShoppingItem,
    isPending: mockIsAddShoppingItemPending,
  }),
}));
jest.mock('@/features/shopping-list/preferences/api', () => ({
  resolveCategoryForItem: (...args: Parameters<typeof mockResolveCategoryForItem>) =>
    mockResolveCategoryForItem(...args),
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
const PRODUCT_DESCRIPTION = 'Bio Haferdrink';
const HOUSEHOLD_STORE: Store = {
  id: 'store-1',
  household_id: 'hh-1',
  name: PAGE.storeName,
  color: '#000000',
  sort_order: 0,
  category_order: null,
};
const CLASSIFICATION = {
  categoryId: 'cold_drinks',
  source: 'name_fallback',
  classifierVersion: 'placement-v2.0.0',
};
const PRODUCT_HOTSPOT: Hotspot = {
  id: 'product-1',
  kind: 'discount',
  x: 10,
  y: 20,
  width: 25,
  height: 15,
  title: 'Hafermilch',
  description: PRODUCT_DESCRIPTION,
};
const LINK_HOTSPOT: Hotspot = {
  id: 'link-1',
  kind: 'linkout',
  x: 45,
  y: 20,
  width: 15,
  height: 10,
  title: 'Mehr erfahren',
  linkoutUrl: 'https://example.test/mehr-erfahren',
};
let mockBrochurePagesState: { data: LocalBrochurePage[] | undefined; isLoading: boolean } = {
  data: PAGES,
  isLoading: false,
};

function hasImageSource(source: unknown, imageUrl: string): boolean {
  if (Array.isArray(source)) {
    return source.some(
      (item) => typeof item === 'object' && item !== null && 'uri' in item && item.uri === imageUrl,
    );
  }

  return (
    source === imageUrl ||
    (typeof source === 'object' && source !== null && 'uri' in source && source.uri === imageUrl)
  );
}

async function renderViewerWithHotspots(
  hotspots: Hotspot[],
  options: { loadCurrentImage?: boolean } = {},
) {
  mockBrochurePagesState = {
    data: [{ ...PAGE, hotspots }, SECOND_PAGE],
    isLoading: false,
  };
  await render(<BrochureViewerScreen brochureId="bro-1" />);

  const pageContainer = screen.root.queryAll(
    (instance) => instance.type === 'View' && typeof instance.props.onLayout === 'function',
  )[0];
  if (!pageContainer) throw new Error('Viewer page must receive its native layout event');
  await fireEvent(pageContainer, 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 600 } },
  });

  const pageImage = screen.root.queryAll(
    (instance) =>
      hasImageSource(instance.props.source, PAGE.imageUrl) &&
      typeof instance.props.onLoad === 'function',
  )[0];
  if (!pageImage) throw new Error('Viewer page image must receive its native load event');
  if (options.loadCurrentImage !== false) {
    await fireEvent(pageImage, 'load', {
      nativeEvent: { source: { width: 1200, height: 1800 } },
    });
  }
}

async function openProductDetails(hotspot = PRODUCT_HOTSPOT) {
  const user = userEvent.setup();
  await renderViewerWithHotspots([hotspot]);
  await user.press(
    screen.getByRole('button', {
      name: hotspot.discount ? `${hotspot.title}, ${hotspot.discount}` : hotspot.title,
    }),
  );
  return user;
}

describe('BrochureViewerScreen', () => {
  beforeEach(() => {
    mockBrochurePagesState = { data: PAGES, isLoading: false };
    mockRouterBack.mockClear();
    mockActiveHouseholdId = 'hh-1';
    mockIsAddShoppingItemPending = false;
    mockHouseholdStores.splice(0, mockHouseholdStores.length, HOUSEHOLD_STORE);
    mockAddShoppingItem.mockReset().mockResolvedValue(undefined);
    mockFindStoreByName.mockReset().mockReturnValue(HOUSEHOLD_STORE);
    mockResolveCategoryForItem.mockReset().mockResolvedValue(CLASSIFICATION);
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

  it('öffnet Artikeldetails mit Produkt, Markt und Beschreibung über einen Produkt-Hotspot', async () => {
    const user = userEvent.setup();
    await renderViewerWithHotspots([PRODUCT_HOTSPOT]);

    await user.press(screen.getByRole('button', { name: PRODUCT_HOTSPOT.title }));

    expect(screen.getByText(PRODUCT_HOTSPOT.title)).toBeOnTheScreen();
    expect(screen.getByText(PAGE.storeName)).toBeOnTheScreen();
    expect(screen.getByText(PRODUCT_DESCRIPTION)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Auf die Einkaufsliste' })).toBeOnTheScreen();
  });

  it('öffnet Link-Hotspots außerhalb der Artikeldetails', async () => {
    const user = userEvent.setup();
    const openUrl = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderViewerWithHotspots([LINK_HOTSPOT]);

    await user.press(screen.getByRole('button', { name: LINK_HOTSPOT.title }));

    expect(openUrl).toHaveBeenCalledWith(LINK_HOTSPOT.linkoutUrl);
    expect(screen.queryByRole('button', { name: 'Auf die Einkaufsliste' })).not.toBeOnTheScreen();
  });

  it.each([
    ['priceLabel', { priceLabel: 'Angebot: 2,49 €', priceCents: 199 }, 'Angebot: 2,49 €'],
    ['priceCents', { priceCents: 199 }, '1,99 €'],
    ['discount price text', { discount: '2,49 € statt 3,29 €' }, '2,49 €'],
  ] as const)('zeigt den Produktpreis aus %s', async (_source, price, expectedPrice) => {
    const user = userEvent.setup();
    const hotspot = { ...PRODUCT_HOTSPOT, ...price };
    await renderViewerWithHotspots([hotspot]);

    await user.press(
      screen.getByRole('button', {
        name: hotspot.discount ? `${hotspot.title}, ${hotspot.discount}` : hotspot.title,
      }),
    );

    expect(screen.getByText(expectedPrice)).toBeOnTheScreen();
  });

  it('lässt den Preis im Produktdetail weg, wenn kein Preis vorliegt', async () => {
    const user = userEvent.setup();
    await renderViewerWithHotspots([PRODUCT_HOTSPOT]);

    await user.press(screen.getByRole('button', { name: PRODUCT_HOTSPOT.title }));

    expect(screen.queryByText(/€/)).not.toBeOnTheScreen();
  });

  it('zeigt den Bildausschnitt des Prospekt-Hotspots als Artikeldetail-Vorschau', async () => {
    const user = userEvent.setup();
    await renderViewerWithHotspots([PRODUCT_HOTSPOT]);

    await user.press(screen.getByRole('button', { name: PRODUCT_HOTSPOT.title }));

    const pageImageSources = screen.root.queryAll((instance) =>
      hasImageSource(instance.props.source, PAGE.imageUrl),
    );
    expect(pageImageSources).toHaveLength(2);
  });

  it('zeigt keine Bildvorschau, wenn der Hotspot keinen Bildausschnitt abdeckt', async () => {
    const user = userEvent.setup();
    await renderViewerWithHotspots([{ ...PRODUCT_HOTSPOT, width: 0 }]);

    await user.press(screen.getByRole('button', { name: PRODUCT_HOTSPOT.title }));

    const pageImageSources = screen.root.queryAll((instance) =>
      hasImageSource(instance.props.source, PAGE.imageUrl),
    );
    expect(pageImageSources).toHaveLength(1);
  });

  it('schließt die Artikeldetails über den Backdrop', async () => {
    const user = userEvent.setup();
    await renderViewerWithHotspots([PRODUCT_HOTSPOT]);
    await user.press(screen.getByRole('button', { name: PRODUCT_HOTSPOT.title }));

    await user.press(screen.getAllByRole('button', { name: 'Artikeldetails schließen' })[0]);

    expect(screen.queryByText(PRODUCT_DESCRIPTION)).not.toBeOnTheScreen();
  });

  it('schließt die Artikeldetails über die Schließen-Aktion', async () => {
    const user = userEvent.setup();
    await renderViewerWithHotspots([PRODUCT_HOTSPOT]);
    await user.press(screen.getByRole('button', { name: PRODUCT_HOTSPOT.title }));

    await user.press(screen.getAllByRole('button', { name: 'Artikeldetails schließen' })[1]);

    expect(screen.queryByText(PRODUCT_DESCRIPTION)).not.toBeOnTheScreen();
  });

  it('verhindert eine Menge unter eins und kann eine Erhöhung wieder verringern', async () => {
    const user = await openProductDetails();

    expect(screen.getByText('1×')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Menge verringern' })).toBeDisabled();

    await user.press(screen.getByRole('button', { name: 'Menge erhöhen' }));
    await user.press(screen.getByRole('button', { name: 'Menge erhöhen' }));
    expect(screen.getByText('3×')).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'Menge verringern' }));
    expect(screen.getByText('2×')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Menge verringern' }));
    expect(screen.getByText('1×')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Menge verringern' })).toBeDisabled();
  });

  it('verarbeitet Layout und Bildladen einer nicht ausgewählten Seite getrennt', async () => {
    await renderViewerWithHotspots([]);

    const pageContainers = screen.root.queryAll(
      (instance) => instance.type === 'View' && typeof instance.props.onLayout === 'function',
    );
    const secondPageContainer = pageContainers[1];
    if (!secondPageContainer) throw new Error('Pager should render its second page');
    await fireEvent(secondPageContainer, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 600 } },
    });

    const secondPageImage = screen.root.queryAll(
      (instance) =>
        hasImageSource(instance.props.source, SECOND_PAGE.imageUrl) &&
        typeof instance.props.onLoad === 'function',
    )[0];
    if (!secondPageImage) throw new Error('Second page image must receive its native load event');
    await fireEvent(secondPageImage, 'load', {
      nativeEvent: { source: { width: 1200, height: 1800 } },
    });

    expect(screen.getByRole('text', { name: 'Seite 1 ausgewählt' })).toBeOnTheScreen();
  });

  it('behält den aktiven Viewer beim Fehler des Prospektbildes benutzbar', async () => {
    const user = userEvent.setup();
    await renderViewerWithHotspots([PRODUCT_HOTSPOT], { loadCurrentImage: false });

    const currentPageImage = screen.root.queryAll(
      (instance) =>
        hasImageSource(instance.props.source, PAGE.imageUrl) &&
        typeof instance.props.onError === 'function',
    )[0];
    if (!currentPageImage) throw new Error('Viewer image must receive its native error event');
    await fireEvent(currentPageImage, 'error', {
      nativeEvent: { error: 'image unavailable' },
    });

    expect(screen.getByRole('button', { name: 'Prospekt schließen' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: PRODUCT_HOTSPOT.title })).not.toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Prospekt schließen' }));
    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });

  it('fügt den Artikel mit Haushalt, Markt, Kategorie, Menge und Preisschätzung hinzu', async () => {
    const user = await openProductDetails({ ...PRODUCT_HOTSPOT, priceCents: 249 });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    await user.press(screen.getByRole('button', { name: 'Menge erhöhen' }));
    await user.press(screen.getByRole('button', { name: 'Auf die Einkaufsliste' }));

    await waitFor(() => {
      expect(mockAddShoppingItem).toHaveBeenCalledWith({
        household_id: 'hh-1',
        name: PRODUCT_HOTSPOT.title,
        quantity: 2,
        unit: 'piece',
        category_id: CLASSIFICATION.categoryId,
        category_source: CLASSIFICATION.source,
        category_classifier_version: CLASSIFICATION.classifierVersion,
        store_id: HOUSEHOLD_STORE.id,
        price_estimate: 4.98,
      });
    });
    expect(mockResolveCategoryForItem).toHaveBeenCalledWith({
      householdId: 'hh-1',
      name: PRODUCT_HOTSPOT.title,
    });
    expect(mockFindStoreByName).toHaveBeenCalledWith(mockHouseholdStores, PAGE.storeName);
    expect(alert).toHaveBeenCalledWith('Zur Einkaufsliste hinzugefügt', '2 × Hafermilch');
    expect(screen.queryByText(PRODUCT_DESCRIPTION)).not.toBeOnTheScreen();
  });

  it('zeigt ohne aktiven Haushalt einen Hinweis und schreibt nichts', async () => {
    mockActiveHouseholdId = null;
    const user = await openProductDetails();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    await user.press(screen.getByRole('button', { name: 'Auf die Einkaufsliste' }));

    expect(alert).toHaveBeenCalledWith(
      'Kein Haushalt ausgewählt',
      'Wähle zuerst einen Haushalt aus.',
    );
    expect(mockResolveCategoryForItem).not.toHaveBeenCalled();
    expect(mockAddShoppingItem).not.toHaveBeenCalled();
    expect(screen.getByText(PRODUCT_DESCRIPTION)).toBeOnTheScreen();
  });

  it('deaktiviert das Hinzufügen während die Mutation läuft', async () => {
    mockIsAddShoppingItemPending = true;
    const user = await openProductDetails();
    const addButton = screen.getByRole('button', { name: 'Auf die Einkaufsliste' });

    expect(addButton).toBeDisabled();
    await user.press(addButton);

    expect(mockAddShoppingItem).not.toHaveBeenCalled();
  });

  it('hält Artikeldetails offen, wenn die Kategorie nicht bestimmt werden kann', async () => {
    mockResolveCategoryForItem.mockRejectedValue(new Error('Kategorisierung fehlgeschlagen'));
    const user = await openProductDetails();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    await user.press(screen.getByRole('button', { name: 'Auf die Einkaufsliste' }));

    await waitFor(() => {
      expect(alert).toHaveBeenCalledWith(
        'Hinzufügen fehlgeschlagen',
        'Kategorisierung fehlgeschlagen',
      );
    });
    expect(mockAddShoppingItem).not.toHaveBeenCalled();
    expect(screen.getByText(PRODUCT_DESCRIPTION)).toBeOnTheScreen();
  });

  it('hält Artikeldetails offen, wenn das Schreiben in die Einkaufsliste fehlschlägt', async () => {
    mockAddShoppingItem.mockRejectedValue(new Error('Speichern fehlgeschlagen'));
    const user = await openProductDetails();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    await user.press(screen.getByRole('button', { name: 'Auf die Einkaufsliste' }));

    await waitFor(() => {
      expect(alert).toHaveBeenCalledWith('Hinzufügen fehlgeschlagen', 'Speichern fehlgeschlagen');
    });
    expect(mockAddShoppingItem).toHaveBeenCalledTimes(1);
    expect(screen.getByText(PRODUCT_DESCRIPTION)).toBeOnTheScreen();
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
