import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { type CardSize, type DashboardCardDef, getCards } from './registry';

const STORAGE_KEY_SIZES = 'dashboard_card_sizes';
const STORAGE_KEY_HIDDEN = 'dashboard_hidden_cards';
const STORAGE_KEY_ORDER = 'dashboard_card_order';

type SizeMap = Record<string, CardSize>;

type DashboardCardsContextValue = {
  getSize: (card: DashboardCardDef) => CardSize;
  setSize: (cardId: string, size: CardSize) => void;
  hideCard: (cardId: string) => void;
  showCard: (cardId: string) => void;
  isCardHidden: (cardId: string) => boolean;
  hiddenCards: string[];
  cardOrder: string[];
  reorderCards: (newOrder: string[]) => void;
  moveCard: (fromCardId: string, toCardId: string) => void;
  moveCardByIndex: (fromIndex: number, toIndex: number, visibleCardIds: string[]) => void;
  getOrderedCards: (cards: DashboardCardDef[]) => DashboardCardDef[];
  loaded: boolean;
};

const DashboardCardsContext = createContext<DashboardCardsContextValue | null>(null);

/** Persistiert Groessen, Sichtbarkeit und Reihenfolge der Dashboard-Cards. */
export function DashboardCardsProvider({ children }: { children: ReactNode }) {
  const [sizeMap, setSizeMap] = useState<SizeMap>({});
  const [hiddenCards, setHiddenCards] = useState<string[]>([]);
  const [cardOrder, setCardOrder] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY_SIZES),
      AsyncStorage.getItem(STORAGE_KEY_HIDDEN),
      AsyncStorage.getItem(STORAGE_KEY_ORDER),
    ]).then(([rawSizes, rawHidden, rawOrder]) => {
      if (rawSizes) {
        try {
          setSizeMap(JSON.parse(rawSizes) as SizeMap);
        } catch {}
      }
      if (rawHidden) {
        try {
          setHiddenCards(JSON.parse(rawHidden) as string[]);
        } catch {}
      }
      if (rawOrder) {
        try {
          setCardOrder(JSON.parse(rawOrder) as string[]);
        } catch {}
      }
      setLoaded(true);
    });
  }, []);

  const getSize = useCallback(
    (card: DashboardCardDef): CardSize => {
      return sizeMap[card.id] ?? card.defaultSize;
    },
    [sizeMap],
  );

  const setSize = useCallback((cardId: string, size: CardSize) => {
    setSizeMap((prev) => {
      const next = { ...prev, [cardId]: size };
      AsyncStorage.setItem(STORAGE_KEY_SIZES, JSON.stringify(next));
      return next;
    });
  }, []);

  const hideCard = useCallback((cardId: string) => {
    setHiddenCards((prev) => {
      if (prev.includes(cardId)) return prev;
      const next = [...prev, cardId];
      AsyncStorage.setItem(STORAGE_KEY_HIDDEN, JSON.stringify(next));
      return next;
    });
  }, []);

  const showCard = useCallback((cardId: string) => {
    setHiddenCards((prev) => {
      const next = prev.filter((id) => id !== cardId);
      AsyncStorage.setItem(STORAGE_KEY_HIDDEN, JSON.stringify(next));
      return next;
    });
  }, []);

  const isCardHidden = useCallback(
    (cardId: string) => {
      return hiddenCards.includes(cardId);
    },
    [hiddenCards],
  );

  const reorderCards = useCallback((newOrder: string[]) => {
    setCardOrder(newOrder);
    AsyncStorage.setItem(STORAGE_KEY_ORDER, JSON.stringify(newOrder));
  }, []);

  const moveCard = useCallback((fromCardId: string, toCardId: string) => {
    if (fromCardId === toCardId) return;
    setCardOrder((prev) => {
      const allCardIds = [...getCards()].sort((a, b) => a.order - b.order).map((c) => c.id);
      const order = prev.length > 0 ? [...prev] : [...allCardIds];
      const fromIdx = order.indexOf(fromCardId);
      const toIdx = order.indexOf(toCardId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [removed] = order.splice(fromIdx, 1);
      order.splice(toIdx, 0, removed);
      AsyncStorage.setItem(STORAGE_KEY_ORDER, JSON.stringify(order));
      return order;
    });
  }, []);

  const moveCardByIndex = useCallback(
    (fromIndex: number, toIndex: number, visibleCardIds: string[]) => {
      if (fromIndex === toIndex) return;
      if (fromIndex < 0 || fromIndex >= visibleCardIds.length) return;
      if (toIndex < 0 || toIndex >= visibleCardIds.length) return;
      const fromId = visibleCardIds[fromIndex];
      const toId = visibleCardIds[toIndex];
      moveCard(fromId, toId);
    },
    [moveCard],
  );

  const getOrderedCards = useCallback(
    (cards: DashboardCardDef[]): DashboardCardDef[] => {
      if (cardOrder.length === 0) {
        return [...cards].sort((a, b) => a.order - b.order);
      }
      return [...cards].sort((a, b) => {
        const indexA = cardOrder.indexOf(a.id);
        const indexB = cardOrder.indexOf(b.id);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.order - b.order;
      });
    },
    [cardOrder],
  );

  const value: DashboardCardsContextValue = {
    getSize,
    setSize,
    hideCard,
    showCard,
    isCardHidden,
    hiddenCards,
    cardOrder,
    reorderCards,
    moveCard,
    moveCardByIndex,
    getOrderedCards,
    loaded,
  };

  return <DashboardCardsContext.Provider value={value}>{children}</DashboardCardsContext.Provider>;
}

export function useCardSizes(): DashboardCardsContextValue {
  const context = useContext(DashboardCardsContext);
  if (context) return context;

  return {
    getSize: (card: DashboardCardDef) => card.defaultSize,
    setSize: () => {},
    hideCard: () => {},
    showCard: () => {},
    isCardHidden: () => false,
    hiddenCards: [],
    cardOrder: [],
    reorderCards: () => {},
    moveCard: () => {},
    moveCardByIndex: () => {},
    getOrderedCards: (cards: DashboardCardDef[]) => [...cards].sort((a, b) => a.order - b.order),
    loaded: true,
  };
}
