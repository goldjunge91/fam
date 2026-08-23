import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PremiumScreen } from '@/features/premium/premium-screen';

let mockIsPremium = false;

jest.mock('@/features/premium/premium-provider', () => ({
  usePremium: () => ({
    isPremium: mockIsPremium,
    isForced: false,
    customerInfo: null,
    loading: false,
    refresh: jest.fn(),
  }),
}));

jest.mock('@/features/premium/paywall', () => ({
  presentPaywall: jest.fn(),
  presentPaywallIfNeeded: jest.fn(),
  presentCustomerCenter: jest.fn(),
}));

jest.mock('@/lib/purchases', () => ({
  restorePurchases: jest.fn(),
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
}));

function renderScreen() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 34 },
      }}>
      <PremiumScreen />
    </SafeAreaProvider>,
  );
}

describe('PremiumScreen', () => {
  beforeEach(() => {
    mockIsPremium = false;
  });

  it('zeigt ohne Premium den Kauf-Einstieg samt Plan-Hinweis', async () => {
    await renderScreen();

    expect(screen.getByText('Mehr für euren Haushalt')).toBeOnTheScreen();
    expect(screen.getByText('Jahresabo')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Premium freischalten' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Käufe wiederherstellen' })).toBeOnTheScreen();
  });

  it('zeigt mit Premium die Verwalten-Variante statt des Kauf-Einstiegs', async () => {
    mockIsPremium = true;
    await renderScreen();

    expect(screen.getByText('Premium ist aktiv')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Abo verwalten' })).toBeOnTheScreen();
    expect(screen.queryByText('Jahresabo')).not.toBeOnTheScreen();
  });

  it('listet die drei Premium-Vorteile auf', async () => {
    await renderScreen();

    expect(screen.getByText('Geführter Kochmodus')).toBeOnTheScreen();
    expect(screen.getByText('Fehlendes direkt einkaufen')).toBeOnTheScreen();
    expect(screen.getByText('Bestände automatisch ergänzen')).toBeOnTheScreen();
  });
});
