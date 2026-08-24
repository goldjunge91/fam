import { fireEvent, render, screen } from '@testing-library/react-native';
import type React from 'react';

import { PaywallSheet } from './paywall-sheet';

const mockBuySelectedPlan = jest.fn();
const mockRestore = jest.fn();
const mockSetSelectedPeriod = jest.fn();

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
    isLoadingPackages: false,
    isPurchasing: false,
    isRestoring: false,
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
  const BottomSheet = React.forwardRef(({ children }: { children: React.ReactNode }, _ref: unknown) => (
    <View testID="bottom-sheet">{children}</View>
  ));
  BottomSheet.displayName = 'BottomSheet';
  return {
    __esModule: true,
    default: BottomSheet,
    BottomSheetView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

describe('PaywallSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
  });

  it('erlaubt Plan-Umschaltung per Klick', async () => {
    await render(<PaywallSheet isOpen={true} onClose={jest.fn()} />);

    fireEvent.press(screen.getByText('Monatsabo'));
    expect(mockSetSelectedPeriod).toHaveBeenCalledWith('monthly');
  });

  it('führt Kauf aus beim Klick auf den CTA-Button', async () => {
    mockBuySelectedPlan.mockResolvedValue({ kind: 'purchased' });
    const onPurchased = jest.fn();
    const onClose = jest.fn();

    await render(<PaywallSheet isOpen={true} onClose={onClose} onPurchased={onPurchased} />);

    fireEvent.press(screen.getByText('Jahresabo für 49,99 € starten'));
    expect(mockBuySelectedPlan).toHaveBeenCalledTimes(1);
  });
});
