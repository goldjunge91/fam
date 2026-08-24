import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { GradientBackground } from '@/components/layout/gradient-background';
import { HubScreen } from '@/components/layout/hub-screen';
import { ThemedText } from '@/components/theme/themed-text';
import { BackButton, Button } from '@/components/ui/buttons';
import { presentCustomerCenter } from '@/features/premium/paywall';
import { PaywallPlanCard } from '@/features/premium/paywall-plan-card';
import { usePremium } from '@/features/premium/premium-provider';
import { usePaywall } from '@/features/premium/use-paywall';
import { SettingsGroup, SettingsRow } from '@/features/settings/settings-menu';

const BENEFITS: { icon: string; title: string; hint: string }[] = [
  { icon: '👨‍🍳', title: 'Geführter Kochmodus', hint: 'Schritte, automatische Timer und Medien' },
  {
    icon: '➕',
    title: 'Fehlendes direkt einkaufen',
    hint: 'Aus Rezepten und dem Essensplan übernehmen',
  },
  {
    icon: '🔄',
    title: 'Bestände automatisch ergänzen',
    hint: 'Niedrige Vorräte auf die Einkaufsliste setzen',
  },
];

/**
 * Eigener In-App-Premium-Screen (Figma "00.06 · Premium"), erreichbar über
 * die Premium-Karte in `settings-screen.tsx`.
 *
 * Präsentiert die native fam-Paywall (Variante 1 · Card Stack) mit dynamischer
 * Preisanzeige und %-Ersparnis sowie direktem Kaufabschluss via RevenueCat.
 */
export function PremiumScreen() {
  const { isPremium, isForced, refresh } = usePremium();
  const {
    plans,
    selectedPeriod,
    setSelectedPeriod,
    buySelectedPlan,
    restore,
    isPurchasing,
    isRestoring,
  } = usePaywall();
  const [managing, setManaging] = useState(false);

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
        title: 'fam Premium',
        align: 'center',
        leading: <BackButton label="Einstellungen" href="/settings" variant="arrow" />,
      }}>
      <ScrollView contentContainerClassName="premium-scroll" showsVerticalScrollIndicator={false}>
        {/* Premium-Hero-Banner (Krone-Icon, Überschrift, Haushalts-Erklärung) */}
        <View className="premium-hero">
          <View className="premium-crown">
            <GradientBackground colors={['#705573', '#c38b75']} />
            <ThemedText className="premium-crown-glyph">✦</ThemedText>
          </View>
          <ThemedText className="premium-hero-title">
            {isPremium ? 'Premium ist aktiv' : 'Mehr für euren Haushalt'}
          </ThemedText>
          <ThemedText themeColor="textSecondary" className="premium-hero-subtitle">
            {isPremium
              ? 'Euer Haushalt nutzt alle Premium-Funktionen.'
              : 'Ein Abo schaltet Premium für alle Mitglieder des aktuellen Haushalts frei.'}
          </ThemedText>
        </View>

        {/* Feature-Vorteile (Geführter Kochmodus, Fehlendes direkt einkaufen, Auto-Bestände) */}
        <SettingsGroup>
          {BENEFITS.map((benefit, index) => (
            <SettingsRow
              key={benefit.title}
              icon={benefit.icon}
              label={benefit.title}
              hint={benefit.hint}
              last={index === BENEFITS.length - 1}
            />
          ))}
        </SettingsGroup>

        {isPremium ? (
          /* Aktiver Premium-Status & Abo-Verwaltungs-Button */
          <>
            <View className="premium-active-box">
              <ThemedText themeColor="success" className="premium-active-title">
                ✓ Premium aktiv
              </ThemedText>
              <ThemedText themeColor="textSecondary" className="premium-active-hint">
                {isForced
                  ? 'Für diesen Build erzwungen (Entwicklermodus).'
                  : 'Gilt für alle aktuellen Haushaltsmitglieder.'}
              </ThemedText>
            </View>
            <Button label="Abo verwalten" onPress={handleManage} loading={managing} />
          </>
        ) : (
          /* Native Plan-Karten mit dynamischer %-Ersparnis & Kaufbuttons */
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
