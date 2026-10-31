import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { DashboardCardDef } from '@/features/dashboard/registry';
import { clearCards, registerCard } from '@/features/dashboard/registry';
import { useCardSizes } from '@/features/dashboard/use-card-sizes';
import { CardGallerySheet } from './card-gallery-sheet';

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  impactAsync: jest.fn(),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      accent: '#76566C',
      background: '#fff',
      backgroundElement: '#eee',
      backgroundSoft: '#ddd',
      border: '#ccc',
      danger: '#b00',
      scrim: '#0006',
    },
  }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 4 }) }));
jest.mock('@/constants/ui', () => {
  const { createElement } = require('react');
  const { Text } = require('react-native');
  return { Txt: ({ children }: { children: ReactNode }) => createElement(Text, null, children) };
});
jest.mock('@/features/dashboard/use-card-sizes', () => ({
  useCardSizes: jest.fn(),
}));

const mockCardSizes = {
  getSize: jest.fn((_card: DashboardCardDef) => 'large' as const),
  setSize: jest.fn(),
  showCard: jest.fn(),
  hideCard: jest.fn(),
  isCardHidden: jest.fn((id: string) => id === 'hidden-card'),
  hiddenCards: ['hidden-card'],
  cardOrder: ['shoppingList', 'hidden-card'],
  reorderCards: jest.fn(),
  moveCard: jest.fn(),
  moveCardByIndex: jest.fn(),
  getOrderedCards: jest.fn((cards: DashboardCardDef[]) => cards),
  loaded: true,
};

const card = (id: string): DashboardCardDef => ({
  id,
  order: 0,
  defaultSize: 'large',
  component: () => null,
});

describe('CardGallerySheet', () => {
  beforeEach(() => {
    clearCards();
    registerCard(card('shoppingList'));
    registerCard(card('hidden-card'));
    jest.mocked(useCardSizes).mockReturnValue(mockCardSizes);
    jest.clearAllMocks();
  });

  it('renders nothing while closed', async () => {
    await render(<CardGallerySheet visible={false} onClose={jest.fn()} />);

    expect(screen.queryByText('dashboard.gallery.title')).not.toBeOnTheScreen();
  });

  it('removes an active card, changes its size, and closes from Done', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    await render(<CardGallerySheet visible onClose={onClose} />);

    expect(screen.getByText(/dashboard\.gallery\.cards\.shoppingList\.title/)).toBeOnTheScreen();
    await user.press(screen.getByLabelText('dashboard.gallery.removeAccessibility'));
    await user.press(screen.getByText('dashboard.gallery.small'));
    await user.press(screen.getByLabelText('dashboard.gallery.done'));

    expect(mockCardSizes.hideCard).toHaveBeenCalledWith('shoppingList');
    expect(mockCardSizes.setSize).toHaveBeenCalledWith('shoppingList', 'small');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('adds a hidden fallback card and closes when the backdrop is pressed', async () => {
    const onClose = jest.fn();
    await render(<CardGallerySheet visible onClose={onClose} />);

    expect(screen.getByText('dashboard.gallery.fallbackDescription')).toBeOnTheScreen();
    expect(screen.queryByText('dashboard.gallery.small')).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('dashboard.gallery.addAccessibility'));
    expect(mockCardSizes.showCard).toHaveBeenCalledWith('hidden-card');
    await fireEvent.press(screen.getByLabelText('dashboard.gallery.close'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
