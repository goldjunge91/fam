import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type React from 'react';
import { Alert } from 'react-native';

import { PaywallSheet } from './paywall-sheet';

const mockBuySelectedPlan = jest.fn();
const mockRestore = jest.fn();
const mockSetSelectedPeriod = jest.fn();
let mockIsLoadingPackages = false;
let mockIsPurchasing = false;
let mockIsRestoring = false;

jest.mock('./use-paywall', () => ({
  usePaywall: () => ({
    plans: {
      yearly: {
        period: 'yearly',
        package: null,
        title: 'Jahresabo',
        priceString: '49,99 €',
        periodLabel: 'pro Jahr',
        subtext: 'Entspricht 4,16 € / Monat',
        savingsBadge: '17 % Ersparnis',
      },
      monthly: {
        period: 'monthly',
        package: null,
        title: 'Monatsabo',
        priceString: '4,99 €',
        periodLabel: 'pro Monat',
        subtext: 'Monatlich flexibel',
        savingsBadge: null,
      },
      savingsPercent: 17,
    },
    selectedPeriod: 'yearly',
    setSelectedPeriod: mockSetSelectedPeriod,
    selectedPackage: null,
    isLoadingPackages: mockIsLoadingPackages,
    isPurchasing: mockIsPurchasing,
    isRestoring: mockIsRestoring,
    buySelectedPlan: mockBuySelectedPlan,
    restore: mockRestore,
  }),
}));

jest.mock('@/components/layout/gradient-background', () => ({
  GradientBackground: () => null,
}));

jest.mock('@expo/ui/community/bottom-sheet', () => {
  const React = require('react');
  const { View } = require('react-native');
  const BottomSheet = React.forwardRef(
    ({ children }: { children: React.ReactNode }, _ref: unknown) => (
      <View testID="bottom-sheet">{children}</View>
    ),
  );
  BottomSheet.displayName = 'BottomSheet';
  return {
    __esModule: true,
    default: BottomSheet,
    BottomSheetView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

describe('PaywallSheet', () => {
  beforeEach(() => {
    mockIsLoadingPackages = false;
    mockIsPurchasing = false;
    mockIsRestoring = false;
    mockBuySelectedPlan.mockReset();
    mockRestore.mockReset();
    mockSetSelectedPeriod.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rendert alle Pläne und Features', async () => {
    await render(<PaywallSheet isOpen={true} onClose={jest.fn()} />);

    expect(screen.getByText('fam Premium')).toBeOnTheScreen();
    expect(screen.getByText('Mehr für euren Haushalt')).toBeOnTheScreen();
    expect(screen.getByText('Geführter Kochmodus')).toBeOnTheScreen();
    expect(screen.getByText('Jahresabo')).toBeOnTheScreen();
    expect(screen.getByText('17 % Ersparnis')).toBeOnTheScreen();
    expect(screen.getByText('Monatsabo')).toBeOnTheScreen();
    expect(screen.getByText('Jahresabo für 49,99 € starten')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Schließen' })).toHaveStyle({
      minHeight: 44,
      minWidth: 44,
    });
    expect(screen.getByRole('radio', { name: /Jahresabo/ })).toHaveStyle({
      flexDirection: 'row',
      minHeight: 76,
    });
    expect(screen.getByRole('radio', { name: /Jahresabo/ })).toBeSelected();
    expect(screen.getByRole('radio', { name: /Monatsabo/ })).not.toBeSelected();
    expect(screen.getByRole('button', { name: 'Käufe wiederherstellen' })).toHaveStyle({
      minHeight: 44,
      minWidth: 44,
    });
  });

  it('erlaubt Plan-Umschaltung per Klick', async () => {
    const user = userEvent.setup();
    await render(<PaywallSheet isOpen={true} onClose={jest.fn()} />);

    await user.press(screen.getByRole('radio', { name: /Monatsabo/ }));
    expect(mockSetSelectedPeriod).toHaveBeenCalledWith('monthly');
  });

  it('führt Kauf aus beim Klick auf den CTA-Button und zeigt Erfolgs-Alert', async () => {
    const { Alert } = require('react-native');
    const alertSpy = jest.spyOn(Alert, 'alert');
    mockBuySelectedPlan.mockResolvedValue({ kind: 'purchased' });
    const onPurchased = jest.fn();
    const onClose = jest.fn();

    await render(<PaywallSheet isOpen={true} onClose={onClose} onPurchased={onPurchased} />);

    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Jahresabo für 49,99 € starten' }));
    expect(mockBuySelectedPlan).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Erfolgreich',
        'Fam Plus ist jetzt für deinen Haushalt aktiv!',
        expect.arrayContaining([
          expect.objectContaining({ text: 'OK', onPress: expect.any(Function) }),
        ]),
      );
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Erfolgreich',
      'Fam Plus ist jetzt für deinen Haushalt aktiv!',
      expect.arrayContaining([
        expect.objectContaining({ text: 'OK', onPress: expect.any(Function) }),
      ]),
    );

    // Rufe den OK-Callback auf
    const calls = alertSpy.mock.calls as unknown as Array<
      [unknown, unknown, Array<{ text?: string; onPress?: () => void }>]
    >;
    const buttons = calls[0]?.[2];
    buttons?.[0]?.onPress?.();
    expect(onPurchased).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('meldet Laden als busy und blockiert den Kauf-CTA', async () => {
    mockIsLoadingPackages = true;

    await render(<PaywallSheet isOpen={true} onClose={jest.fn()} />);

    const buyButton = screen.getByRole('button', { name: 'Jahresabo für 49,99 € starten' });
    expect(buyButton).toBeDisabled();
    expect(buyButton).toBeBusy();
  });

  it('meldet Wiederherstellen als busy und blockiert Auswahl und Kauf', async () => {
    mockIsRestoring = true;

    await render(<PaywallSheet isOpen={true} onClose={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Käufe wiederherstellen' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Käufe wiederherstellen' })).toBeBusy();
    expect(screen.getByRole('button', { name: 'Jahresabo für 49,99 € starten' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Jahresabo/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Monatsabo/ })).toBeDisabled();
  });

  it('zeigt einen Kauf-Fehler als Alert an', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    mockBuySelectedPlan.mockResolvedValue({ kind: 'failed', error: new Error('Storefehler') });
    const user = userEvent.setup();

    await render(<PaywallSheet isOpen={true} onClose={jest.fn()} />);
    await user.press(screen.getByRole('button', { name: 'Jahresabo für 49,99 € starten' }));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Kauf fehlgeschlagen', 'Storefehler');
    });
  });

  it('zeigt einen Fehler beim Wiederherstellen als Alert an', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    mockRestore.mockResolvedValue({ ok: false, error: new Error('Restorefehler') });
    const user = userEvent.setup();

    await render(<PaywallSheet isOpen={true} onClose={jest.fn()} />);
    await user.press(screen.getByRole('button', { name: 'Käufe wiederherstellen' }));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Wiederherstellen fehlgeschlagen', 'Restorefehler');
    });
  });
});
