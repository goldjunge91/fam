import { useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BackButton } from '@/components/layout/back-button';
import { HubScreen } from '@/components/layout/hub-screen';
import { rs, withAlpha } from '@/components/theme/index';
import { Button, SegmentedControl, Txt } from '@/constants/ui';
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

const styles = StyleSheet.create((theme) => ({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.space.md,
    paddingBottom: theme.space.xxl,
    gap: theme.space.md,
  },
  hero: {
    alignItems: 'center',
    paddingTop: theme.space.xs,
    gap: theme.space.xs,
  },
  heroSubtitle: {
    maxWidth: rs(320),
    marginTop: theme.space.xs,
  },
  activeBox: {
    padding: theme.space.lg,
    borderRadius: theme.radius.famLarge,
    backgroundColor: withAlpha(theme.success, 0.12),
  },
  upgradeBanner: {
    marginTop: theme.space.md,
    padding: theme.space.md,
    borderRadius: theme.radius.famLarge,
    backgroundColor: theme.backgroundSoft,
    gap: theme.space.xs,
  },
}));

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
    isLoadingPackages,
  } = usePaywall(tier);

  useEffect(() => {
    trackAnalyticsEvent('paywall.view.completed', { source: 'plus_and_ai_screen', tier });
  }, [tier]);

  async function handleBuy() {
    const outcome = await buySelectedPlan();
    if (outcome.kind === 'purchased') {
      Alert.alert(
        'Erfolgreich',
        tier === 'plus'
          ? 'Fam Plus ist jetzt für deinen Haushalt aktiv!'
          : 'Fam KI ist jetzt für deinen Haushalt aktiv!',
      );
    } else if (outcome.kind === 'failed') {
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
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <SegmentedControl
          label="Tier auswählen"
          options={TIER_OPTIONS}
          selected={tier}
          onSelect={setTier}
          selectionRole="tab"
          appearance="surface"
        />

        {/* Hero-Banner (Ueberschrift und Haushalts-Erklaerung fuer das aktive Tab-Tier) */}
        <View style={styles.hero}>
          <Txt variant="heading" center>
            {owned ? content.heroTitleActive : content.heroTitleInactive}
          </Txt>
          <Txt variant="body" tone="secondary" center style={styles.heroSubtitle}>
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
            <View style={styles.activeBox}>
              <Txt variant="body" tone="success" weight="700">
                ✓ {content.activeLabel}
              </Txt>
              <Txt variant="body" tone="secondary">
                {isForced && tier === 'plus'
                  ? 'Für diesen Build erzwungen (Entwicklermodus).'
                  : 'Gilt für alle aktuellen Haushaltsmitglieder.'}
              </Txt>
            </View>
            <Button title="Abo verwalten" onPress={handleManage} loading={managing} />

            {/* Upgrade-Hinweis zum jeweils anderen Tab, solange dieser noch nicht aktiv ist */}
            {!otherOwned ? (
              <>
                <View style={styles.upgradeBanner}>
                  <Txt variant="body" weight="700">
                    {otherContent.crossSellTitle}
                  </Txt>
                  <Txt variant="body" tone="secondary">
                    {otherContent.crossSellHint}
                  </Txt>
                </View>
                <Button
                  title={`Zum ${otherContent.tabLabel}-Tab wechseln`}
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
              title={ctaLabel}
              onPress={handleBuy}
              loading={isPurchasing || isLoadingPackages}
              disabled={isRestoring || isLoadingPackages}
            />

            <Button
              title="Käufe wiederherstellen"
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
