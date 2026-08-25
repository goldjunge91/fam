import { useState } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import {
  BannerAd,
  BannerAdSize,
  type PaidEvent,
  type RequestOptions,
  TestIds,
} from 'react-native-google-mobile-ads';
import { AdFormat } from 'react-native-purchases';
import { usePremium } from '@/features/premium/premium-provider';
import { env } from '@/lib/env';
import { trackAdRevenueToRevenueCat } from '../ads-service';

export interface AdBannerProps {
  /**
   * AdMob Unit-ID. Standardmäßig in __DEV__ die Test-Banner-ID und in Produktion die konfigurierte Banner-ID.
   */
  unitId?: string;
  /**
   * Größe des Banner-Ads. Standardmäßig ANCHORED_ADAPTIVE_BANNER.
   */
  size?: BannerAdSize | string;
  /**
   * Optionale Platzierungs-Kennung für RevenueCat ILRD Analytics (z. B. 'shopping_list').
   */
  placement?: string;
  /**
   * Zusätzliche AdMob Request-Optionen (z. B. non-personalized ads).
   */
  requestOptions?: RequestOptions;
  /**
   * Optionale Container-Styles.
   */
  style?: StyleProp<ViewStyle>;
  /**
   * Callback bei erfolgreichem Laden der Anzeige.
   */
  onAdLoaded?: (dimensions: { width: number; height: number }) => void;
  /**
   * Callback bei Fehler beim Laden der Anzeige.
   */
  onAdFailedToLoad?: (error: Error) => void;
}

/**
 * Standard Banner-Werbekomponente.
 *
 * Verhält sich automatisch no-op / unsichtbar, wenn der aktive Haushalt
 * Premium-Status besitzt (`isPremium === true`).
 */
export function AdBanner({
  unitId,
  size = BannerAdSize.ANCHORED_ADAPTIVE_BANNER,
  placement,
  requestOptions,
  style,
  onAdLoaded,
  onAdFailedToLoad,
}: AdBannerProps) {
  const { isPremium } = usePremium();
  const [failedToLoad, setFailedToLoad] = useState(false);

  const defaultUnitId = __DEV__ ? TestIds.BANNER : env.adMobBannerIdIos;
  const resolvedUnitId = unitId ?? defaultUnitId;

  // Premium-Nutzer sehen keinerlei Werbung
  if (isPremium || failedToLoad) {
    return null;
  }

  const handlePaid = (event: PaidEvent) => {
    trackAdRevenueToRevenueCat({
      adUnitId: resolvedUnitId,
      adFormat: AdFormat.banner,
      paidEvent: event,
      placement,
    });
  };

  const handleError = (error: Error) => {
    if (__DEV__) {
      console.warn('[AdBanner] Banner konnte nicht geladen werden:', error);
    }
    setFailedToLoad(true);
    onAdFailedToLoad?.(error);
  };

  return (
    <View style={[styles.container, style]} testID="admob-banner-container">
      <BannerAd
        unitId={resolvedUnitId}
        size={size}
        requestOptions={requestOptions}
        onAdLoaded={onAdLoaded}
        onAdFailedToLoad={handleError}
        onPaid={handlePaid}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    overflow: 'hidden',
  },
});
