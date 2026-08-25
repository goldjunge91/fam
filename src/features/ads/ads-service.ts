import mobileAds, { type PaidEvent, RevenuePrecisions } from 'react-native-google-mobile-ads';
import Purchases, { AdFormat, AdMediatorName, AdRevenuePrecision } from 'react-native-purchases';

import { isPurchasesConfigured } from '@/lib/purchases';

let initialized = false;

/**
 * Initialisiert das Google Mobile Ads SDK einmalig beim App-Start.
 */
export async function initMobileAds(): Promise<void> {
  if (initialized) return;

  try {
    const status = await mobileAds().initialize();
    initialized = true;
    if (__DEV__) {
      console.log('[AdMob] SDK erfolgreich initialisiert:', status);
    }
  } catch (error) {
    console.warn('[AdMob] Initialisierung fehlgeschlagen:', error);
  }
}

/**
 * Wandelt die AdMob Precision-Werte in das RevenueCat Format um.
 */
function mapPrecision(precision: RevenuePrecisions): string {
  switch (precision) {
    case RevenuePrecisions.PRECISE:
      return AdRevenuePrecision.exact;
    case RevenuePrecisions.ESTIMATED:
      return AdRevenuePrecision.estimated;
    case RevenuePrecisions.PUBLISHER_PROVIDED:
      return AdRevenuePrecision.publisherDefined;
    default:
      return AdRevenuePrecision.unknown;
  }
}

/**
 * Uebermittelt Impression-Level Ad Revenue (ILRD) an RevenueCat (Purchases.adTracker).
 */
export async function trackAdRevenueToRevenueCat(params: {
  adUnitId: string;
  adFormat?: string;
  paidEvent: PaidEvent;
  placement?: string;
}): Promise<void> {
  if (!isPurchasesConfigured()) return;

  try {
    const revenueMicros = Math.round(params.paidEvent.value * 1_000_000);
    const impressionId = `${params.adUnitId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    await Purchases.adTracker?.trackAdRevenue({
      mediatorName: AdMediatorName.adMob,
      adFormat: params.adFormat ?? AdFormat.banner,
      adUnitId: params.adUnitId,
      impressionId,
      revenueMicros,
      currency: params.paidEvent.currency,
      precision: mapPrecision(params.paidEvent.precision),
      placement: params.placement,
    });
  } catch (error) {
    if (__DEV__) {
      console.warn('[AdMob] Fehler beim Weiterleiten des Ad-Revenue an RevenueCat:', error);
    }
  }
}
