import type { PurchasesPackage } from 'react-native-purchases';
import {
  calculateMonthlyEquivalent,
  calculateSavingsPercent,
  extractPaywallPlans,
} from './paywall-plans';

describe('paywall-plans', () => {
  describe('calculateSavingsPercent', () => {
    it('berechnet 17% Ersparnis bei 49.99 € / Jahr vs 4.99 € / Monat', () => {
      // 4.99 * 12 = 59.88. (59.88 - 49.99) / 59.88 = 0.1651... -> 17%
      const savings = calculateSavingsPercent(49.99, 4.99);
      expect(savings).toBe(17);
    });

    it('berechnet 33% Ersparnis bei 79.99 € / Jahr vs 9.99 € / Monat', () => {
      // 9.99 * 12 = 119.88. (119.88 - 79.99) / 119.88 = 33.27% -> 33%
      const savings = calculateSavingsPercent(79.99, 9.99);
      expect(savings).toBe(33);
    });

    it('liefert null wenn der Jahrespreis teurer oder gleich ist', () => {
      expect(calculateSavingsPercent(120, 10)).toBeNull();
      expect(calculateSavingsPercent(130, 10)).toBeNull();
    });

    it('liefert null bei ungültigen Preisen (<= 0)', () => {
      expect(calculateSavingsPercent(0, 4.99)).toBeNull();
      expect(calculateSavingsPercent(49.99, 0)).toBeNull();
    });
  });

  describe('calculateMonthlyEquivalent', () => {
    it('formatiert den Monatsäquivalent-Preis korrekt', () => {
      const formatted = calculateMonthlyEquivalent(49.99, 'EUR');
      expect(formatted).toMatch(/4,1[67]/);
    });
  });

  describe('extractPaywallPlans', () => {
    it('nutzt Fallbacks wenn keine Packages übergeben werden', () => {
      const result = extractPaywallPlans([]);
      expect(result.yearly.title).toBe('Jahresabo');
      expect(result.yearly.priceString).toBe('49,99 €');
      expect(result.yearly.savingsBadge).toBe('17 % Ersparnis');
      expect(result.monthly.title).toBe('Monatsabo');
      expect(result.monthly.priceString).toBe('4,99 €');
      expect(result.monthly.savingsBadge).toBeNull();
    });

    it('extrahiert echte Store-Packages und berechnet variable Ersparnis', () => {
      const mockPackages = [
        {
          identifier: '$rc_annual',
          packageType: 'ANNUAL',
          product: {
            identifier: 'fam_premium_yearly',
            price: 39.99,
            priceString: '39,99 €',
            currencyCode: 'EUR',
            title: 'fam Premium (Jährlich)',
            description: '1 Jahr unbegrenzter Zugriff',
          },
        },
        {
          identifier: '$rc_monthly',
          packageType: 'MONTHLY',
          product: {
            identifier: 'fam_premium_monthly',
            price: 4.99,
            priceString: '4,99 €',
            currencyCode: 'EUR',
            title: 'fam Premium (Monatlich)',
            description: '1 Monat unbegrenzter Zugriff',
          },
        },
      ] as unknown as PurchasesPackage[];

      const result = extractPaywallPlans(mockPackages);
      // 4.99 * 12 = 59.88. (59.88 - 39.99) / 59.88 = ~33%
      expect(result.yearly.priceString).toBe('39,99 €');
      expect(result.yearly.savingsBadge).toBe('33 % Ersparnis');
      expect(result.monthly.priceString).toBe('4,99 €');
    });
  });
});
