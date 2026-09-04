import { useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { GradientBackground } from '@/components/layout/gradient-background';
import { HubScreen } from '@/components/layout/hub-screen';
import { BackButton, Button } from '@/components/ui/buttons';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Txt } from '@/constants/ui';
import { presentCustomerCenter } from '@/features/premium/paywall';
import { PaywallPlanCard } from '@/features/premium/paywall-plan-card';
import { usePremium } from '@/features/premium/premium-provider';
import { usePaywall } from '@/features/premium/use-paywall';
import { SettingsGroup, SettingsRow } from '@/features/settings/settings-menu';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { TIER_CONTENT } from './tier-content';
import type { PaywallTier } from './types';

const TIER_OPTIONS = [
  { value: 'plus', label: TIER_CONTENT.plus.tabLabel },
  { value: 'ai', label: TIER_CONTENT.ai.tabLabel },
] as const;

interface PlusAndAiScreenProps {
  /** Tier, mit dem der Screen geoeffnet wurde — entscheidet der jeweilige Einstiegspunkt. */
  initialTier: PaywallTier;
}

/**
 * Eigene Plus-/AI-Paywall unter `/settings/plus-and-ai` (kein RevenueCatUI-Paywall).
 * Segmented Tabs "Plus"/"KI" ueber dem Inhalt halten beide unabhaengigen Angebote
 * jederzeit einen Tap entfernt, statt eines kontextuell zu verstecken. Ist das aktuelle
 * Tab-Tier bereits aktiv und das andere noch nicht, wirbt ein Upgrade-Banner additiv
 * dafuer (Plus und AI sind unabhaengige Entitlements, keines enthaelt das andere).
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
        <SegmentedControl
          label="Tier auswählen"
          options={TIER_OPTIONS}
          selected={tier}
          onSelect={setTier}
          appearance="surface"
        />

        {/* Hero-Banner (Krone-Icon, Ueberschrift, Haushalts-Erklaerung fuer das aktive Tab-Tier) */}
        <View className="premium-hero">
          <View className="premium-crown">
            <GradientBackground colors={['#705573', '#c38b75']} />
            <Txt variant="body" tone="inverse" className="premium-crown-glyph">
              ✦
            </Txt>
          </View>
          <Txt variant="title" className="premium-hero-title">
            {owned ? content.heroTitleActive : content.heroTitleInactive}
          </Txt>
          <Txt variant="body" tone="secondary" className="premium-hero-subtitle">
            {owned ? content.heroSubtitleActive : content.heroSubtitleInactive}
          </Txt>
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
          /* Aktiver Status & Abo-Verwaltungs-Button fuer das aktive Tab-Tier */
          <>
            <View className="premium-active-box">
              <Txt variant="body" tone="success" className="premium-active-title">
                ✓ {content.activeLabel}
              </Txt>
              <Txt variant="body" tone="secondary" className="premium-active-hint">
                {isForced && tier === 'plus'
                  ? 'Für diesen Build erzwungen (Entwicklermodus).'
                  : 'Gilt für alle aktuellen Haushaltsmitglieder.'}
              </Txt>
            </View>
            <Button label="Abo verwalten" onPress={handleManage} loading={managing} />

            {/* Upgrade-Hinweis zum jeweils anderen Tab, solange dieser noch nicht aktiv ist */}
            {!otherOwned ? (
              <>
                <View className="premium-upgrade-banner">
                  <Txt variant="body" weight="700" className="premium-upgrade-title">
                    {otherContent.crossSellTitle}
                  </Txt>
                  <Txt variant="body" tone="secondary" className="premium-upgrade-hint">
                    {otherContent.crossSellHint}
                  </Txt>
                </View>
                <Button
                  label={`Zum ${otherContent.tabLabel}-Tab wechseln`}
                  variant="secondary"
                  onPress={() => setTier(otherTier)}
                />
              </>
            ) : null}
          </>
        ) : (
          /* Plan-Karten mit dynamischer %-Ersparnis & Kaufbuttons fuer das aktive Tab-Tier */
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
      </ScrollView>
    </HubScreen>
  );
}
