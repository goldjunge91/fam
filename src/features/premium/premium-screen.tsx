import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { GradientBackground } from '@/components/layout/gradient-background';
import { HubScreen } from '@/components/layout/hub-screen';
import { ThemedText } from '@/components/theme/themed-text';
import { BackButton, Button } from '@/components/ui/buttons';
import { presentCustomerCenter, presentPaywall } from '@/features/premium/paywall';
import { usePremium } from '@/features/premium/premium-provider';
import { SettingsGroup, SettingsRow } from '@/features/settings/settings-menu';
import { restorePurchases } from '@/lib/purchases';

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

/** Einstieg in RevenueCats gehostete Kauf- und Verwaltungsoberflaechen. */
export function PremiumScreen() {
  const { isPremium, isForced, refresh } = usePremium();
  const [busy, setBusy] = useState(false);

  async function handleActivate() {
    if (busy) return;
    setBusy(true);
    try {
      const outcome = await presentPaywall();
      if (outcome === 'unavailable') {
        Alert.alert(
          'Nicht verfügbar',
          'Käufe sind in diesem Build nicht verfügbar (Web oder ohne RevenueCat-Konfiguration).',
        );
      }
    } catch (err) {
      Alert.alert('Fehlgeschlagen', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      await refresh();
    }
  }

  async function handleManage() {
    if (busy) return;
    setBusy(true);
    try {
      await presentCustomerCenter();
    } finally {
      setBusy(false);
      await refresh();
    }
  }

  async function handleRestore() {
    if (busy) return;
    setBusy(true);
    const result = await restorePurchases();
    setBusy(false);
    if (!result.ok) {
      Alert.alert(
        'Wiederherstellen fehlgeschlagen',
        result.error instanceof Error ? result.error.message : String(result.error),
      );
      return;
    }
    await refresh();
  }

  return (
    <HubScreen
      header={{
        title: 'fam Premium',
        align: 'center',
        leading: <BackButton label="Einstellungen" href="/settings" variant="arrow" />,
      }}>
      <ScrollView contentContainerClassName="premium-scroll" showsVerticalScrollIndicator={false}>
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
            <Button label="Abo verwalten" onPress={handleManage} loading={busy} />
          </>
        ) : (
          <>
            <View className="premium-plan-box">
              <ThemedText className="premium-plan-title">Jahresabo</ThemedText>
              <ThemedText themeColor="textSecondary" className="premium-plan-hint">
                Der genaue Preis wird vor dem Kauf im App Store angezeigt.
              </ThemedText>
            </View>
            <Button label="Premium freischalten" onPress={handleActivate} loading={busy} />
            <Button
              label="Käufe wiederherstellen"
              variant="secondary"
              onPress={handleRestore}
              loading={busy}
            />
          </>
        )}
      </ScrollView>
    </HubScreen>
  );
}
