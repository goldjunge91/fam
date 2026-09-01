import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PlusAndAiScreen } from '@/features/premium/plus-and-ai-screen';

let mockHasPlus = false;
let mockHasAI = false;

jest.mock('@/features/premium/premium-provider', () => ({
  usePremium: () => ({
    hasPlus: mockHasPlus,
    hasAI: mockHasAI,
    isForced: false,
    customerInfo: null,
    loading: false,
    refresh: jest.fn(),
  }),
}));

jest.mock('@/features/premium/paywall', () => ({
  presentCustomerCenter: jest.fn(),
}));

jest.mock('@/lib/purchases', () => ({
  ENTITLEMENT_IDS: { PLUS: 'Plus', AI: 'AI' },
  restorePurchases: jest.fn(),
  packagesForEntitlement: jest.fn().mockResolvedValue([]),
  isPurchasesConfigured: () => false,
  buyPackage: jest.fn(),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
}));

function renderScreen(initialTier: 'plus' | 'ai' = 'plus') {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <PlusAndAiScreen initialTier={initialTier} />
    </SafeAreaProvider>,
  );
}

describe('PlusAndAiScreen', () => {
  beforeEach(() => {
    mockHasPlus = false;
    mockHasAI = false;
  });

  it('zeigt ohne Abo den Plus-Kauf-Einstieg samt KI-Cross-Sell', async () => {
    await renderScreen('plus');

    expect(screen.getByText('Mehr für euren Haushalt')).toBeOnTheScreen();
    expect(screen.getByText('Geführter Kochmodus')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Jahresabo für 49,99 € starten' })).toBeOnTheScreen();
    expect(screen.getByText('Auf KI upgraden')).toBeOnTheScreen();
  });

  it('zeigt mit aktivem Plus die Verwalten-Variante und weiterhin den KI-Cross-Sell', async () => {
    mockHasPlus = true;
    await renderScreen('plus');

    expect(screen.getByText('Plus ist aktiv')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Abo verwalten' })).toBeOnTheScreen();
    expect(screen.queryByText('Jahresabo')).not.toBeOnTheScreen();
    expect(screen.getByText('Auf KI upgraden')).toBeOnTheScreen();
  });

  it('blendet den Cross-Sell aus, sobald beide Tiers aktiv sind', async () => {
    mockHasPlus = true;
    mockHasAI = true;
    await renderScreen('plus');

    expect(screen.getByText('Plus ist aktiv')).toBeOnTheScreen();
    expect(screen.queryByText('Auf KI upgraden')).not.toBeOnTheScreen();
  });

  it('startet mit dem KI-Tier, wenn ueber tier=ai geoeffnet', async () => {
    await renderScreen('ai');

    expect(screen.getByText('Kochen mit KI')).toBeOnTheScreen();
    expect(screen.getByText('KI-Rezeptvorschläge')).toBeOnTheScreen();
    expect(screen.getByText('Mit Plus kombinieren')).toBeOnTheScreen();
  });

  it('wechselt per Cross-Sell-Banner das fokussierte Tier', async () => {
    const user = userEvent.setup();
    await renderScreen('plus');

    await user.press(screen.getByText('Auf KI upgraden'));

    expect(screen.getByText('Kochen mit KI')).toBeOnTheScreen();
    expect(screen.queryByText('Geführter Kochmodus')).not.toBeOnTheScreen();
  });
});
