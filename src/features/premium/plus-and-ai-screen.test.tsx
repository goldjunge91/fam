import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { rs } from '@/components/theme/index';
import { presentCustomerCenter } from '@/features/premium/paywall';
import { PlusAndAiScreen } from '@/features/premium/plus-and-ai-screen';
import { buyPackage, packagesForEntitlement, restorePurchases } from '@/lib/backend/revenuecat';

let mockHasPlus = false;
let mockHasAI = false;
let mockActiveHouseholdId: string | null = 'household-1';
const mockUseAiCreditStatus = jest.fn();
const mockAiCreditQuery = {
  data: {
    householdId: 'household-1',
    creditsUsed: 30,
    creditsRemaining: 70,
    creditLimit: 100,
    warningReached: false,
    blocked: false,
  },
  isPending: false,
  isError: false,
  refetch: jest.fn(),
};

jest.mock('@/features/ai-credits/api', () => ({
  useAiCreditStatus: (...args: unknown[]) => mockUseAiCreditStatus(...args),
}));

jest.mock('@/features/household/active-household-provider', () => ({
  useActiveHousehold: () => ({ activeHouseholdId: mockActiveHouseholdId }),
  useOptionalActiveHousehold: () => ({ activeHouseholdId: mockActiveHouseholdId }),
}));

jest.mock('@/features/navigation/navigation-chrome-provider', () => ({
  useNavigationChrome: () => ({ openProfile: jest.fn() }),
}));

jest.mock('@/features/navigation/use-profile-initials', () => ({
  useProfileAvatar: () => ({ initials: 'MM', avatarUrl: null }),
}));

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

jest.mock('@/features/premium/household-entitlement-sync', () => ({
  pollHouseholdUntilEntitlementActive: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/lib/backend/revenuecat', () => ({
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
    mockActiveHouseholdId = 'household-1';
    mockUseAiCreditStatus.mockReset();
    mockUseAiCreditStatus.mockReturnValue(mockAiCreditQuery);
    mockAiCreditQuery.refetch.mockReset();
    (presentCustomerCenter as jest.Mock).mockReset();
    (packagesForEntitlement as jest.Mock).mockReset();
    (packagesForEntitlement as jest.Mock).mockResolvedValue([]);
    (buyPackage as jest.Mock).mockReset();
    (restorePurchases as jest.Mock).mockReset();
  });

  it('zeigt die Segmented Tabs Plus/KI', async () => {
    await renderScreen('plus');

    expect(screen.getByRole('tab', { name: 'Plus' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'KI' })).toBeOnTheScreen();
  });

  it('zeigt ohne Abo im Plus-Tab den Kauf-Einstieg ohne Upgrade-Banner', async () => {
    await renderScreen('plus');

    expect(screen.getByText('Mehr für euren Haushalt')).toBeOnTheScreen();
    expect(screen.getByText(/Ein Abo schaltet Plus/)).toHaveStyle({ maxWidth: rs(320) });
    expect(screen.queryByText('✦')).not.toBeOnTheScreen();
    expect(screen.getByText('Geführter Kochmodus')).toBeOnTheScreen();
    expect(screen.getByText('Fehlendes direkt einkaufen')).toBeOnTheScreen();
    expect(screen.getByText('Bestände automatisch ergänzen')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: /Jahresabo/ })).toHaveStyle({
      flexDirection: 'row',
      minHeight: 76,
    });
    expect(screen.getByRole('button', { name: 'Jahresabo für 49,99 € starten' })).toBeOnTheScreen();
    expect(screen.queryByText('Auf KI upgraden')).not.toBeOnTheScreen();
  });

  it('wechselt zwischen Jahres- und Monatsabo', async () => {
    const user = userEvent.setup();
    await renderScreen('plus');

    await user.press(screen.getByRole('radio', { name: /Monatsabo/ }));

    expect(screen.getByRole('button', { name: 'Monatsabo für 4,99 € starten' })).toBeOnTheScreen();
  });

  it('zeigt mit aktivem Plus die Verwalten-Variante und einen KI-Upgrade-Hinweis', async () => {
    mockHasPlus = true;
    await renderScreen('plus');

    expect(screen.getByText('Plus ist aktiv')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Abo verwalten' })).toBeOnTheScreen();
    expect(screen.queryByText('Jahresabo')).not.toBeOnTheScreen();
    expect(screen.getByText('Auf KI upgraden')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Zum KI-Tab wechseln' })).toBeOnTheScreen();
  });

  it('blendet den Upgrade-Hinweis aus, sobald beide Tiers aktiv sind', async () => {
    mockHasPlus = true;
    mockHasAI = true;
    await renderScreen('plus');

    expect(screen.getByText('Plus ist aktiv')).toBeOnTheScreen();
    expect(screen.queryByText('Auf KI upgraden')).not.toBeOnTheScreen();
  });

  it('startet im KI-Tab, wenn ueber tier=ai geoeffnet', async () => {
    await renderScreen('ai');

    expect(screen.getByRole('tab', { name: 'KI', selected: true })).toBeOnTheScreen();
    expect(screen.getByText('Kochen mit KI')).toBeOnTheScreen();
    expect(screen.getByText('KI-Rezeptvorschläge')).toBeOnTheScreen();
  });

  it('zeigt die Credit-Karte im aktiven KI-Tab und lässt Abo verwalten erreichbar', async () => {
    mockHasAI = true;
    const user = userEvent.setup();
    await renderScreen('ai');

    expect(screen.getByText('70 von 100 Credits verfügbar')).toBeOnTheScreen();
    expect(mockUseAiCreditStatus).toHaveBeenCalledWith('household-1');
    expect(screen.getByRole('button', { name: 'Abo verwalten' })).toBeEnabled();

    await user.press(screen.getByRole('button', { name: 'Abo verwalten' }));
    expect(presentCustomerCenter).toHaveBeenCalledTimes(1);
  });

  it('zeigt den fehlenden aktiven Haushalt in der Credit-Karte', async () => {
    mockHasAI = true;
    mockActiveHouseholdId = null;
    await renderScreen('ai');

    expect(screen.getByText('Kein aktiver Haushalt verfügbar.')).toBeOnTheScreen();
    expect(mockUseAiCreditStatus).toHaveBeenCalledWith(null);
  });

  it('wechselt per Segmented Tab das aktive Tier', async () => {
    const user = userEvent.setup();
    await renderScreen('plus');

    await user.press(screen.getByRole('tab', { name: 'KI' }));

    expect(screen.getByText('Kochen mit KI')).toBeOnTheScreen();
    expect(screen.queryByText('Geführter Kochmodus')).not.toBeOnTheScreen();
  });

  it('wechselt per Upgrade-Button das aktive Tier', async () => {
    mockHasPlus = true;
    const user = userEvent.setup();
    await renderScreen('plus');

    await user.press(screen.getByRole('button', { name: 'Zum KI-Tab wechseln' }));

    expect(screen.getByRole('tab', { name: 'KI', selected: true })).toBeOnTheScreen();
    expect(screen.getByText('Kochen mit KI')).toBeOnTheScreen();
  });

  it('zeigt nach erfolgreichem Plus-Kauf eine Erfolgsmeldung per Alert', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const mockPkg = {
      identifier: '$rc_annual',
      product: { price: 44.99, priceString: '44,99 €', currencyCode: 'EUR' },
    };
    (packagesForEntitlement as jest.Mock).mockResolvedValue([mockPkg]);
    (buyPackage as jest.Mock).mockResolvedValue({
      kind: 'purchased',
      customerInfo: {},
    });

    const user = userEvent.setup();
    await renderScreen('plus');

    const buyButton = await screen.findByRole('button', {
      name: 'Jahresabo für 44,99 € starten',
    });
    await user.press(buyButton);

    expect(alertSpy).toHaveBeenCalledWith(
      'Erfolgreich',
      'Fam Plus ist jetzt für deinen Haushalt aktiv!',
    );
  });

  it('zeigt nach erfolgreichem KI-Kauf eine Erfolgsmeldung per Alert', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const mockPkg = {
      identifier: '$rc_annual',
      product: { price: 74.99, priceString: '74,99 €', currencyCode: 'EUR' },
    };
    (packagesForEntitlement as jest.Mock).mockResolvedValue([mockPkg]);
    (buyPackage as jest.Mock).mockResolvedValue({
      kind: 'purchased',
      customerInfo: {},
    });

    const user = userEvent.setup();
    await renderScreen('ai');

    const buyButton = await screen.findByRole('button', {
      name: 'Jahresabo für 74,99 € starten',
    });
    await user.press(buyButton);

    expect(alertSpy).toHaveBeenCalledWith(
      'Erfolgreich',
      'Fam KI ist jetzt für deinen Haushalt aktiv!',
    );
  });

  it('meldet Laden als busy und blockiert den Kauf-CTA', async () => {
    (packagesForEntitlement as jest.Mock).mockImplementationOnce(
      () => new Promise(() => undefined),
    );

    await renderScreen('plus');

    const buyButton = screen.getByRole('button', { name: 'Jahresabo für 49,99 € starten' });
    expect(buyButton).toBeDisabled();
    expect(buyButton).toBeBusy();
  });

  it('meldet Wiederherstellen als busy und blockiert Auswahl und Kauf', async () => {
    (restorePurchases as jest.Mock).mockImplementationOnce(() => new Promise(() => undefined));
    const user = userEvent.setup();
    await renderScreen('plus');

    await user.press(screen.getByRole('button', { name: 'Käufe wiederherstellen' }));

    expect(screen.getByRole('button', { name: 'Käufe wiederherstellen' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Käufe wiederherstellen' })).toBeBusy();
    expect(screen.getByRole('button', { name: 'Jahresabo für 49,99 € starten' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Jahresabo/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Monatsabo/ })).toBeDisabled();
  });

  it('zeigt einen Kauf-Fehler als Alert an', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const mockPkg = {
      identifier: '$rc_annual',
      product: { price: 44.99, priceString: '44,99 €', currencyCode: 'EUR' },
    };
    (packagesForEntitlement as jest.Mock).mockResolvedValueOnce([mockPkg]);
    (buyPackage as jest.Mock).mockResolvedValueOnce({
      kind: 'failed',
      error: { code: 'STORE_ERROR', message: 'Storefehler' },
    });
    const user = userEvent.setup();
    await renderScreen('plus');

    await user.press(await screen.findByRole('button', { name: 'Jahresabo für 44,99 € starten' }));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Kauf fehlgeschlagen', 'Storefehler');
    });
  });

  it('zeigt einen Fehler beim Wiederherstellen als Alert an', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    (restorePurchases as jest.Mock).mockResolvedValueOnce({
      ok: false,
      error: new Error('Restorefehler'),
    });
    const user = userEvent.setup();
    await renderScreen('plus');

    await user.press(screen.getByRole('button', { name: 'Käufe wiederherstellen' }));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Wiederherstellen fehlgeschlagen', 'Restorefehler');
    });
  });
});
