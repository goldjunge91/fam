import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientBackground } from '@/components/gradient-background';
import { PageHeader } from '@/components/page-header';
import { FontSize, ThemedText } from '@/components/themed-text';
import { BackButton, Button } from '@/components/ui/buttons';
import { Radius, Spacing } from '@/constants/theme';
import { presentCustomerCenter, presentPaywall } from '@/features/premium/paywall';
import { usePremium } from '@/features/premium/premium-provider';
import { SettingsGroup, SettingsRow } from '@/features/settings/settings-menu';
import { useHubGradient } from '@/hooks/use-hub-gradient';
import { useTheme } from '@/hooks/use-theme';
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

/**
 * Eigener In-App-Premium-Screen (Figma "00.06 · Premium"), erreichbar ueber
 * die Premium-Karte in `settings-screen.tsx`.
 *
 * Zeigt nur die Optik des Redesigns — die Kauflogik bleibt exakt wie vorher:
 * `presentPaywall()`/`presentCustomerCenter()` praesentieren weiterhin
 * RevenueCats im Dashboard konfiguriertes, gehostetes UI. Preis und
 * Produktname kommen von dort, nicht aus diesem Screen.
 */
export function PremiumScreen() {
  const theme = useTheme();
  const hubGradient = useHubGradient();
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
    <View style={styles.root}>
      <GradientBackground {...hubGradient} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <PageHeader
          title="fam Premium"
          align="center"
          leading={<BackButton label="Einstellungen" href="/settings" variant="arrow" />}
        />

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.crown}>
              <GradientBackground colors={['#705573', '#c38b75']} />
              <ThemedText style={styles.crownGlyph}>✦</ThemedText>
            </View>
            <ThemedText style={styles.heroTitle}>
              {isPremium ? 'Premium ist aktiv' : 'Mehr für euren Haushalt'}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.heroSubtitle}>
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
              <View style={[styles.activeBox, { backgroundColor: `${theme.success}1F` }]}>
                <ThemedText themeColor="success" style={styles.activeTitle}>
                  ✓ Premium aktiv
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.activeHint}>
                  {isForced
                    ? 'Für diesen Build erzwungen (Entwicklermodus).'
                    : 'Gilt für alle aktuellen Haushaltsmitglieder.'}
                </ThemedText>
              </View>
              <Button label="Abo verwalten" onPress={handleManage} loading={busy} />
            </>
          ) : (
            <>
              <View
                style={[
                  styles.planBox,
                  { borderColor: theme.accent, backgroundColor: theme.background },
                ]}>
                <ThemedText style={styles.planTitle}>Jahresabo</ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.planHint}>
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
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  // Masse 1:1 aus dem fam-settings-premium-flow-Mockup (.fsp-crown,
  // .fsp-paywall, .fsp-plan, .fsp-active) uebernommen.
  hero: {
    alignItems: 'center',
    paddingTop: 4,
    gap: 4,
  },
  crown: {
    width: 66,
    height: 66,
    marginBottom: 11,
    borderRadius: Radius.sheet,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crownGlyph: {
    color: '#fff',
    ...FontSize[28],
  },
  heroTitle: {
    ...FontSize[21],
    fontWeight: '600',
    letterSpacing: -0.45,
  },
  heroSubtitle: {
    ...FontSize[9],
    maxWidth: 270,
    textAlign: 'center',
    lineHeight: 13,
    marginTop: 6,
  },
  activeBox: {
    padding: 13,
    borderRadius: Radius.sheet,
  },
  activeTitle: {
    ...FontSize[10],
    fontWeight: '600',
  },
  activeHint: {
    ...FontSize[8],
    marginTop: 3,
  },
  planBox: {
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderRadius: Radius.sheet,
  },
  planTitle: {
    ...FontSize[10],
    fontWeight: '600',
  },
  planHint: {
    ...FontSize[7],
    marginTop: 3,
  },
});
