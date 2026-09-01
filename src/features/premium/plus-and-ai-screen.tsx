import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { GradientBackground } from '@/components/layout/gradient-background';
import { HubScreen } from '@/components/layout/hub-screen';
import { ThemedText } from '@/components/theme/themed-text';
import { BackButton, Button } from '@/components/ui/buttons';
import { presentCustomerCenter } from '@/features/premium/paywall';
import { PaywallPlanCard } from '@/features/premium/paywall-plan-card';
import { usePremium } from '@/features/premium/premium-provider';
import { usePaywall } from '@/features/premium/use-paywall';
import { SettingsGroup, SettingsRow } from '@/features/settings/settings-menu';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { TIER_CONTENT } from './tier-content';
import type { PaywallTier } from './types';

interface PlusAndAiScreenProps {
  /** Tier, mit dem der Screen geoeffnet wurde — entscheidet der jeweilige Einstiegspunkt. */
  initialTier: PaywallTier;
}

/**
 * Eigene Plus-/AI-Paywall unter `/settings/plus-and-ai` (kein RevenueCatUI-Paywall).
 * Zeigt kontextuell genau ein Tier; das jeweils andere, noch nicht aktive Tier steht
 * als kompaktes Cross-Sell-Banner darunter (Plus und AI sind unabhaengige Entitlements,
 * keines enthaelt das andere).
 */
export function PlusAndAiScreen({ initialTier }: PlusAndAiScreenProps) {
  const { hasPlus, hasAI, isForced, refresh } = usePremium();
  const [tier, setTier] = useState<PaywallTier>(initialTier);
  const [managing, setManaging] = useState(false);

  const owned = tier === 'plus' ? hasPlus : hasAI;
  const otherTier: PaywallTier = tier === 'plus' ? 'ai' : 'plus';
  const otherOwned = otherTier === 'plus' ? hasPlus : hasAI;
  const content = TIER_CONTENT[tier];
  const otherContent = TIER_CONTENT[otherTier];

  const {
    plans,
    selectedPeriod,
    setSelectedPeriod,
    buySelectedPlan,
    restore,
    isPurchasing,
    isRestoring,
  } = usePaywall(tier);

  useEffect(() => {
    trackAnalyticsEvent('paywall.view.completed', { source: 'plus_and_ai_screen', tier });
  }, [tier]);

  async function handleBuy() {
    const outcome = await buySelectedPlan();
    if (outcome.kind === 'failed') {
      Alert.alert('Kauf fehlgeschlagen', outcome.error.message);
    } else if (outcome.kind === 'unavailable') {
      Alert.alert(
        'Nicht verfügbar',
        'Käufe sind in dieser Umgebung nicht verfügbar oder noch nicht im Store eingerichtet.',
      );
    }
  }

  async function handleManage() {
    if (managing) return;
    setManaging(true);
    try {
      await presentCustomerCenter();
    } finally {
      setManaging(false);
      await refresh();
    }
  }

  async function handleRestore() {
    const result = await restore();
    if (!result.ok) {
      Alert.alert(
        'Wiederherstellen fehlgeschlagen',
        result.error instanceof Error ? result.error.message : 'Keine aktiven Käufe gefunden.',
      );
      return;
    }
    Alert.alert('Erfolgreich', 'Deine Käufe wurden wiederhergestellt.');
  }

  const ctaLabel =
    selectedPeriod === 'yearly'
      ? `Jahresabo für ${plans.yearly.priceString} starten`
      : `Monatsabo für ${plans.monthly.priceString} starten`;

  return (
    <HubScreen
      header={{
        title: 'Plus & KI',
        align: 'center',
        leading: <BackButton label="Einstellungen" href="/settings" variant="arrow" />,
      }}>
      <ScrollView contentContainerClassName="premium-scroll" showsVerticalScrollIndicator={false}>
        {/* Hero-Banner (Krone-Icon, Ueberschrift, Haushalts-Erklaerung fuer das fokussierte Tier) */}
        <View className="premium-hero">
          <View className="premium-crown">
            <GradientBackground colors={['#705573', '#c38b75']} />
            <ThemedText className="premium-crown-glyph">✦</ThemedText>
          </View>
          <ThemedText className="premium-hero-title">
            {owned ? content.heroTitleActive : content.heroTitleInactive}
          </ThemedText>
          <ThemedText themeColor="textSecondary" className="premium-hero-subtitle">
            {owned ? content.heroSubtitleActive : content.heroSubtitleInactive}
          </ThemedText>
        </View>

        <SettingsGroup>
          {content.benefits.map((benefit, index) => (
            <SettingsRow
              key={benefit.title}
              icon={benefit.icon}
              label={benefit.title}
              hint={benefit.hint}
              last={index === content.benefits.length - 1}
            />
          ))}
        </SettingsGroup>

        {owned ? (
          /* Aktiver Status & Abo-Verwaltungs-Button fuer das fokussierte Tier */
          <>
            <View className="premium-active-box">
              <ThemedText themeColor="success" className="premium-active-title">
                ✓ {content.activeLabel}
              </ThemedText>
              <ThemedText themeColor="textSecondary" className="premium-active-hint">
                {isForced && tier === 'plus'
                  ? 'Für diesen Build erzwungen (Entwicklermodus).'
                  : 'Gilt für alle aktuellen Haushaltsmitglieder.'}
              </ThemedText>
            </View>
            <Button label="Abo verwalten" onPress={handleManage} loading={managing} />
          </>
        ) : (
          /* Plan-Karten mit dynamischer %-Ersparnis & Kaufbuttons fuer das fokussierte Tier */
          <>
            <PaywallPlanCard
              plans={plans}
              selectedPeriod={selectedPeriod}
              onSelectPeriod={setSelectedPeriod}
              disabled={isPurchasing || isRestoring}
            />

            <Button
              label={ctaLabel}
              onPress={handleBuy}
              loading={isPurchasing}
              disabled={isRestoring}
            />

            <Button
              label="Käufe wiederherstellen"
              variant="secondary"
              onPress={handleRestore}
              loading={isRestoring}
              disabled={isPurchasing}
            />
          </>
        )}

        {/* Cross-Sell zum jeweils anderen Tier, solange dieses noch nicht aktiv ist */}
        {!otherOwned ? (
          <Pressable
            onPress={() => setTier(otherTier)}
            accessibilityRole="button"
            className="premium-crosssell">
            <ThemedText className="premium-crosssell-title">
              {otherContent.crossSellTitle}
            </ThemedText>
            <ThemedText themeColor="textSecondary" className="premium-crosssell-hint">
              {otherContent.crossSellHint}
            </ThemedText>
          </Pressable>
        ) : null}
      </ScrollView>
    </HubScreen>
  );
}
