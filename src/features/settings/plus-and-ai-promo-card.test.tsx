import { render, screen, userEvent } from '@testing-library/react-native';
import { PlusAndAiPromoCard } from './plus-and-ai-promo-card';

let mockPremium = { hasPlus: false, hasAI: false, isForced: false };
const mockRouterPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockRouterPush(...args) },
}));

jest.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors: {
      premiumGradientMid: '#5b465d',
      premiumOnSurface: '#fffaf4',
      premiumActionBackground: '#fffaf4',
      premiumActionText: '#342b35',
    },
  }),
}));

jest.mock('@/constants/ui', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');

  return {
    Card: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
    Press: ({
      children,
      onPress,
      accessibilityRole,
    }: {
      children: React.ReactNode;
      onPress: () => void;
      accessibilityRole: 'button';
    }) => React.createElement(Pressable, { onPress, accessibilityRole }, children),
    Row: ({ children }: { children: React.ReactNode }) => React.createElement(View, null, children),
    Txt: ({ children }: { children: React.ReactNode }) => React.createElement(Text, null, children),
  };
});

jest.mock('@/features/premium/premium-provider', () => ({
  usePremium: () => mockPremium,
}));

describe('PlusAndAiPromoCard', () => {
  beforeEach(() => {
    mockPremium = { hasPlus: false, hasAI: false, isForced: false };
    mockRouterPush.mockClear();
  });

  it.each([
    {
      premium: { hasPlus: false, hasAI: false, isForced: false },
      title: 'Plus & KI für den ganzen Haushalt',
      subtitle: 'Kochmodus, KI-Vorschläge und weitere Automationen.',
      action: 'Plus & KI ansehen',
    },
    {
      premium: { hasPlus: true, hasAI: false, isForced: false },
      title: 'Plus ist aktiv',
      subtitle: 'KI-Rezeptvorschläge sind als Upgrade verfügbar.',
      action: 'Abo verwalten',
    },
    {
      premium: { hasPlus: false, hasAI: true, isForced: true },
      title: 'KI ist aktiv',
      subtitle: 'Plus ergänzt euer KI-Abo um weitere Automationen.',
      action: 'Abo verwalten (erzwungen)',
    },
    {
      premium: { hasPlus: true, hasAI: true, isForced: false },
      title: 'Plus & KI sind aktiv',
      subtitle: 'Alle Mitglieder profitieren von allen Funktionen.',
      action: 'Abo verwalten',
    },
  ])('shows the matching copy for $title', async ({ premium, title, subtitle, action }) => {
    mockPremium = premium;

    await render(<PlusAndAiPromoCard />);

    expect(screen.getByText(title)).toBeOnTheScreen();
    expect(screen.getByText(subtitle)).toBeOnTheScreen();
    expect(screen.getByText(action)).toBeOnTheScreen();
  });

  it('opens the premium settings', async () => {
    const user = userEvent.setup();
    await render(<PlusAndAiPromoCard />);

    await user.press(screen.getByRole('button'));

    expect(mockRouterPush).toHaveBeenCalledWith('/settings/plus-and-ai');
  });
});
