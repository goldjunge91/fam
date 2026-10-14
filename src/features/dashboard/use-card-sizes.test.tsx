import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { DashboardCardsProvider, useCardSizes } from '@/features/dashboard/use-card-sizes';
import { clearCards, type DashboardCardDef, getCards, registerCard } from './registry';

const storageValues = new Map<string, string>();
const mockGetItem = jest.fn<Promise<string | null>, [string]>();
const mockSetItem = jest.fn<Promise<void>, [string, string]>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => mockGetItem(key),
    setItem: (key: string, value: string) => mockSetItem(key, value),
  },
}));

const dashboardCards: DashboardCardDef[] = [
  { id: 'alpha', order: 1, defaultSize: 'large', component: () => null },
  { id: 'beta', order: 2, defaultSize: 'small', component: () => null },
  { id: 'gamma', order: 3, defaultSize: 'small', component: () => null },
];

function wrapper({ children }: { children: ReactNode }) {
  return <DashboardCardsProvider>{children}</DashboardCardsProvider>;
}

beforeEach(() => {
  storageValues.clear();
  jest.clearAllMocks();
  mockGetItem.mockImplementation(async (key) => storageValues.get(key) ?? null);
  mockSetItem.mockImplementation(async (key, value) => {
    storageValues.set(key, value);
  });
  clearCards();
  dashboardCards.forEach(registerCard);
});

afterEach(() => clearCards());

it('liefert Defaults fuer den Einsatz ausserhalb eines Providers', async () => {
  const { result } = await renderHook(() => useCardSizes());
  const cards = [...dashboardCards].reverse();

  expect(result.current.loaded).toBe(true);
  expect(result.current.getSize(dashboardCards[0])).toBe('large');
  expect(result.current.isCardHidden('alpha')).toBe(false);
  expect(result.current.getOrderedCards(cards).map((card) => card.id)).toEqual([
    'alpha',
    'beta',
    'gamma',
  ]);
});

it('stellt Groessen, verborgene Karten und Reihenfolge aus AsyncStorage wieder her', async () => {
  storageValues.set('dashboard_card_sizes', JSON.stringify({ alpha: 'small' }));
  storageValues.set('dashboard_hidden_cards', JSON.stringify(['beta']));
  storageValues.set('dashboard_card_order', JSON.stringify(['gamma', 'alpha']));

  const { result } = await renderHook(() => useCardSizes(), { wrapper });
  await waitFor(() => expect(result.current.loaded).toBe(true));

  expect(result.current.getSize(dashboardCards[0])).toBe('small');
  expect(result.current.isCardHidden('beta')).toBe(true);
  expect(result.current.getOrderedCards(dashboardCards).map((card) => card.id)).toEqual([
    'gamma',
    'alpha',
    'beta',
  ]);
});

it('faellt bei unlesbaren gespeicherten Werten auf die Standardwerte zurueck', async () => {
  storageValues.set('dashboard_card_sizes', '{bad');
  storageValues.set('dashboard_hidden_cards', '{bad');
  storageValues.set('dashboard_card_order', '{bad');

  const { result } = await renderHook(() => useCardSizes(), { wrapper });
  await waitFor(() => expect(result.current.loaded).toBe(true));

  expect(result.current.getSize(dashboardCards[0])).toBe('large');
  expect(result.current.hiddenCards).toEqual([]);
  expect(result.current.cardOrder).toEqual([]);
});

it('speichert Groessen und Sichtbarkeit ohne doppelte verborgene Karten', async () => {
  const { result } = await renderHook(() => useCardSizes(), { wrapper });
  await waitFor(() => expect(result.current.loaded).toBe(true));

  await act(async () => {
    result.current.setSize('alpha', 'small');
    result.current.hideCard('alpha');
    result.current.hideCard('alpha');
    result.current.showCard('alpha');
    result.current.showCard('missing');
  });

  expect(result.current.getSize(dashboardCards[0])).toBe('small');
  expect(result.current.isCardHidden('alpha')).toBe(false);
  expect(result.current.hiddenCards).toEqual([]);
  expect(storageValues.get('dashboard_card_sizes')).toBe('{"alpha":"small"}');
  expect(mockSetItem).toHaveBeenCalledWith('dashboard_hidden_cards', '["alpha"]');
  expect(mockSetItem).toHaveBeenLastCalledWith('dashboard_hidden_cards', '[]');
});

it('sortiert manuell und verschiebt Karten anhand von IDs und sichtbaren Indizes', async () => {
  const { result } = await renderHook(() => useCardSizes(), { wrapper });
  await waitFor(() => expect(result.current.loaded).toBe(true));
  const visibleIds = ['alpha', 'beta', 'gamma'];
  expect(
    result.current.getOrderedCards([...dashboardCards].reverse()).map((card) => card.id),
  ).toEqual(['alpha', 'beta', 'gamma']);

  await act(async () => {
    result.current.moveCard('alpha', 'alpha');
    result.current.moveCard('missing', 'beta');
    result.current.moveCardByIndex(0, 0, visibleIds);
    result.current.moveCardByIndex(-1, 1, visibleIds);
    result.current.moveCardByIndex(1, 3, visibleIds);
  });
  expect(storageValues.has('dashboard_card_order')).toBe(false);

  await act(async () => {
    result.current.moveCard('alpha', 'beta');
    result.current.moveCard('gamma', 'beta');
    result.current.moveCardByIndex(0, 2, visibleIds);
  });

  expect(result.current.cardOrder).toEqual(['alpha', 'gamma', 'beta']);
  expect(storageValues.get('dashboard_card_order')).toBe('["alpha","gamma","beta"]');

  await act(async () => {
    result.current.reorderCards(['beta']);
  });
  expect(
    result.current.getOrderedCards([...dashboardCards].reverse()).map((card) => card.id),
  ).toEqual(['beta', 'alpha', 'gamma']);

  await act(async () => {
    result.current.reorderCards(['gamma', 'alpha']);
  });
  expect(result.current.getOrderedCards(dashboardCards).map((card) => card.id)).toEqual([
    'gamma',
    'alpha',
    'beta',
  ]);
  expect(getCards().map((card) => card.id)).toEqual(['alpha', 'beta', 'gamma']);
});
