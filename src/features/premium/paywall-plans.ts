import type { TFunction } from 'i18next';
import type { PurchasesPackage } from 'react-native-purchases';

export type PlanPeriod = 'yearly' | 'monthly';

export interface PaywallPlanDetails {
  period: PlanPeriod;
  package: PurchasesPackage | null;
  title: string;
  priceString: string;
  periodLabel: string;
  subtext: string;
  savingsBadge: string | null;
}

export interface ExtractedPaywallPlans {
  yearly: PaywallPlanDetails;
  monthly: PaywallPlanDetails;
  savingsPercent: number | null;
}

/**
 * Ermittelt die variable Ersparnis des Jahresabos gegenüber 12 einzelnen Monaten.
 * Liefert `null` oder 0, wenn kein valider Vergleich möglich ist.
 */
export function calculateSavingsPercent(annualPrice: number, monthlyPrice: number): number | null {
  if (annualPrice <= 0 || monthlyPrice <= 0) return null;
  const fullYearMonthlyCost = monthlyPrice * 12;
  if (annualPrice >= fullYearMonthlyCost) return null;

  const rawSavings = ((fullYearMonthlyCost - annualPrice) / fullYearMonthlyCost) * 100;
  const rounded = Math.round(rawSavings);
  return rounded > 0 ? rounded : null;
}

/**
 * Berechnet das monatliche Preis-Äquivalent für ein Jahresabo.
 */
export function calculateMonthlyEquivalent(
  annualPrice: number,
  currencyCode = 'EUR',
  locale = 'de-DE',
): string {
  if (annualPrice <= 0) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(0);
  }
  const monthlyVal = annualPrice / 12;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(monthlyVal);
  } catch {
    return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(monthlyVal)} ${currencyCode}`;
  }
}

function findAnnualPackage(packages: PurchasesPackage[] = []): PurchasesPackage | null {
  return (
    packages?.find?.(
      (p) =>
        p.identifier === '$rc_annual' ||
        p.packageType === 'ANNUAL' ||
        p.identifier.toLowerCase().includes('annual') ||
        p.identifier.toLowerCase().includes('year'),
    ) ?? null
  );
}

function findMonthlyPackage(packages: PurchasesPackage[] = []): PurchasesPackage | null {
  return (
    packages?.find?.(
      (p) =>
        p.identifier === '$rc_monthly' ||
        p.packageType === 'MONTHLY' ||
        p.identifier.toLowerCase().includes('month'),
    ) ?? null
  );
}

/**
 * Extrahiert und formatiert die kaufbaren Pläne aus den RevenueCat-Packages.
 * Stellt saubere Standardwerte bereit, falls noch keine Packages geladen sind.
 */
export function extractPaywallPlans(
  packages: PurchasesPackage[] = [],
  t: TFunction,
  locale = 'de-DE',
): ExtractedPaywallPlans {
  const annualPkg = findAnnualPackage(packages);
  const monthlyPkg = findMonthlyPackage(packages);

  const annualPrice = annualPkg?.product.price ?? 49.99;
  const monthlyPrice = monthlyPkg?.product.price ?? 4.99;
  const currencyCode = annualPkg?.product.currencyCode ?? monthlyPkg?.product.currencyCode ?? 'EUR';

  const savingsPercent = calculateSavingsPercent(annualPrice, monthlyPrice);
  const monthlyEquivalentStr = calculateMonthlyEquivalent(annualPrice, currencyCode, locale);
  const formatFallbackPrice = (price: number) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);

  const yearlyDetails: PaywallPlanDetails = {
    period: 'yearly',
    package: annualPkg,
    title: t('premium.plans.yearly.title'),
    priceString: annualPkg?.product.priceString ?? formatFallbackPrice(annualPrice),
    periodLabel: t('premium.plans.yearly.period'),
    subtext: t('premium.plans.yearly.subtext', { price: monthlyEquivalentStr }),
    savingsBadge: t('premium.plans.yearly.savings', { percent: savingsPercent ?? 17 }),
  };

  const monthlyDetails: PaywallPlanDetails = {
    period: 'monthly',
    package: monthlyPkg,
    title: t('premium.plans.monthly.title'),
    priceString: monthlyPkg?.product.priceString ?? formatFallbackPrice(monthlyPrice),
    periodLabel: t('premium.plans.monthly.period'),
    subtext: t('premium.plans.monthly.subtext'),
    savingsBadge: null,
  };

  return {
    yearly: yearlyDetails,
    monthly: monthlyDetails,
    savingsPercent: savingsPercent ?? 17,
  };
}
