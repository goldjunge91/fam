import type { TFunction } from 'i18next';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BackButton, goBackTo } from '@/components/layout/back-button';
import { HubScreen } from '@/components/layout/hub-screen';
import { rs, withAlpha } from '@/components/theme/index';
import { Button, SegmentedControl, Txt } from '@/constants/ui';
import { presentCustomerCenter } from '@/features/premium/paywall';
import { PaywallPlanCard } from '@/features/premium/paywall-plan-card';
import { usePremium } from '@/features/premium/premium-provider';
import { usePaywall } from '@/features/premium/use-paywall';
import { SettingsGroup, SettingsRow } from '@/features/settings/settings-menu';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { getTierContent } from './tier-content';
import type { PaywallTier } from './types';

function showConfirmedActivation(t: TFunction, tier: PaywallTier) {
  Alert.alert(
    t('premium.screen.successTitle'),
    t(tier === 'plus' ? 'premium.screen.successPlus' : 'premium.screen.successAi'),
    [{ text: t('common.actions.done'), onPress: () => goBackTo('/settings') }],
  );
}

function showPendingActivation(t: TFunction, tier: PaywallTier, onRetry: () => void) {
  const subscription = t(
    tier === 'plus' ? 'premium.screen.pendingPlus' : 'premium.screen.pendingAi',
  );
  Alert.alert(t('premium.screen.pendingTitle'), subscription, [
    { text: t('premium.screen.later'), style: 'cancel' },
    { text: t('premium.screen.retry'), onPress: onRetry },
  ]);
}

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
  const { t } = useTranslation();
  const { hasPlus, hasAI, isForced, refresh } = usePremium();
  const [tier, setTier] = useState<PaywallTier>(initialTier);
  const [managing, setManaging] = useState(false);

  const owned = tier === 'plus' ? hasPlus : hasAI;
  const otherTier: PaywallTier = tier === 'plus' ? 'ai' : 'plus';
  const otherOwned = otherTier === 'plus' ? hasPlus : hasAI;
  const content = getTierContent(t, tier);
  const otherContent = getTierContent(t, otherTier);
  const tierOptions = [
    { value: 'plus', label: getTierContent(t, 'plus').tabLabel },
    { value: 'ai', label: getTierContent(t, 'ai').tabLabel },
  ] as const;

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
      if (outcome.activation.confirmed) {
        showConfirmedActivation(t, tier);
      } else {
        showPendingActivation(t, tier, () => void handleRestore());
      }
    } else if (outcome.kind === 'failed') {
      Alert.alert(t('premium.screen.purchaseFailed'), outcome.error.message);
    } else if (outcome.kind === 'unavailable') {
      Alert.alert(t('premium.screen.unavailableTitle'), t('premium.screen.unavailableMessage'));
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
        t('premium.screen.restoreFailed'),
        result.error instanceof Error ? result.error.message : t('premium.screen.noPurchases'),
      );
      return;
    }
    if (result.activation.confirmed) {
      showConfirmedActivation(t, tier);
    } else {
      showPendingActivation(t, tier, () => void handleRestore());
    }
  }

  const ctaLabel = t(
    selectedPeriod === 'yearly' ? 'premium.screen.yearlyCta' : 'premium.screen.monthlyCta',
    {
      price: selectedPeriod === 'yearly' ? plans.yearly.priceString : plans.monthly.priceString,
    },
  );

  return (
    <HubScreen
      header={{
        title: t('premium.screen.title'),
        align: 'center',
        leading: <BackButton label={t('premium.screen.back')} href="/settings" variant="arrow" />,
      }}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <SegmentedControl
          label={t('premium.screen.tier')}
          options={tierOptions}
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
                  ? t('premium.screen.activeForced')
                  : t('premium.screen.activeHousehold')}
              </Txt>
            </View>
            <Button
              title={t('premium.screen.manage')}
              onPress={handleManage}
              loading={managing}
              disabled={isRestoring}
            />
            <Button
              title={t('premium.screen.restore')}
              variant="secondary"
              onPress={handleRestore}
              loading={isRestoring}
              disabled={managing}
            />

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
                  title={t('premium.screen.switchTo', { tier: otherContent.tabLabel })}
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
              title={t('premium.screen.restore')}
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
