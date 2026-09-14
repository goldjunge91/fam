import BottomSheet, { BottomSheetView } from '@expo/ui/community/bottom-sheet';
import { useEffect, useRef } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { GradientBackground } from '@/components/layout/gradient-background';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, CloseButton, Press, Txt } from '@/constants/ui';
import { SettingsGroup, SettingsRow } from '@/features/settings/settings-menu';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { PaywallPlanCard } from './paywall-plan-card';
import { usePaywall } from './use-paywall';

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

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
  },
  sheetBackground: {
    backgroundColor: theme.background,
  },
  sheetIndicator: {
    backgroundColor: theme.border,
  },
  bottomSheet: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space.lg,
    paddingTop: theme.space.sm,
    paddingBottom: theme.space.sm,
  },
  closeButton: {
    // Keep the sheet header hit target at the established 44pt contract.
    minWidth: 44,
    minHeight: 44,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.space.lg,
    paddingBottom: theme.space.lg,
    gap: theme.space.lg,
  },
  hero: {
    alignItems: 'center',
    gap: theme.space.sm,
    paddingTop: theme.space.sm,
  },
  heroBadge: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
  heroSubtitle: {
    paddingHorizontal: theme.space.sm,
  },
  cta: {
    width: '100%',
    alignItems: 'center',
    gap: theme.space.sm,
    paddingTop: theme.space.sm,
  },
  restoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.md,
    paddingTop: theme.space.xs,
  },
  restoreButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restoreButtonDisabled: {
    opacity: 0.55,
  },
  restoreText: {
    textDecorationLine: 'underline',
  },
}));

interface PaywallSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchased?: () => void;
}

/**
 * Natives Bottom-Sheet (Variante 1 · Card Stack) zur Präsentation der fam-Paywall
 * bei Feature-Sperren (z. B. Kochmodus, Rezept-Übernahme in Einkaufsliste).
 */
export function PaywallSheet({ isOpen, onClose, onPurchased }: PaywallSheetProps) {
  const { colors } = useTheme();
  const sheetRef = useRef<BottomSheet>(null);
  const {
    plans,
    selectedPeriod,
    setSelectedPeriod,
    buySelectedPlan,
    restore,
    isPurchasing,
    isRestoring,
    isLoadingPackages,
  } = usePaywall('plus');

  useEffect(() => {
    if (isOpen) {
      trackAnalyticsEvent('paywall.view.completed', { source: 'paywall_sheet' });
      sheetRef.current?.expand();
    } else {
      sheetRef.current?.close();
    }
  }, [isOpen]);

  async function handleBuy() {
    const outcome = await buySelectedPlan();
    if (outcome.kind === 'purchased') {
      Alert.alert('Erfolgreich', 'Fam Plus ist jetzt für deinen Haushalt aktiv!', [
        {
          text: 'OK',
          onPress: () => {
            onPurchased?.();
            onClose();
          },
        },
      ]);
    } else if (outcome.kind === 'failed') {
      Alert.alert('Kauf fehlgeschlagen', outcome.error.message);
    } else if (outcome.kind === 'unavailable') {
      Alert.alert(
        'Nicht verfügbar',
        'Käufe sind in dieser Umgebung nicht verfügbar oder noch nicht im Store eingerichtet.',
      );
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
    onPurchased?.();
    onClose();
  }

  const ctaLabel =
    selectedPeriod === 'yearly'
      ? `Jahresabo für ${plans.yearly.priceString} starten`
      : `Monatsabo für ${plans.monthly.priceString} starten`;

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={['75%', '92%']}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.sheetIndicator}>
      <BottomSheetView style={styles.bottomSheet}>
        <View style={styles.root}>
          {/* Header mit Schließen-Button */}
          <View style={styles.header}>
            <Txt variant="title" weight="700">
              fam Premium
            </Txt>
            <CloseButton
              onPress={onClose}
              accessibilityLabel="Schließen"
              style={styles.closeButton}
            />
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {/* Hero-Bereich */}
            <View style={styles.hero}>
              <View style={styles.heroBadge}>
                <GradientBackground
                  colors={[colors.premiumGradientStart, colors.premiumGradientEnd]}
                />
                <Txt variant="glyph" tone="onAccent">
                  ✦
                </Txt>
              </View>
              <Txt variant="heading" weight="700" center>
                Mehr für euren Haushalt
              </Txt>
              <Txt variant="body" tone="secondary" center style={styles.heroSubtitle}>
                Ein Abo schaltet alle Funktionen für alle Mitglieder im aktuellen Haushalt frei.
              </Txt>
            </View>

            {/* Feature-Vorteile */}
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

            {/* Plan-Auswahl-Karten mit dynamischer %-Ersparnis */}
            <PaywallPlanCard
              plans={plans}
              selectedPeriod={selectedPeriod}
              onSelectPeriod={setSelectedPeriod}
              disabled={isPurchasing || isRestoring}
            />

            {/* CTA & Aktionen */}
            <View style={styles.cta}>
              <Button
                title={ctaLabel}
                onPress={handleBuy}
                loading={isPurchasing || isLoadingPackages}
                disabled={isRestoring || isLoadingPackages}
                full
              />

              <Txt variant="caption" tone="secondary" center>
                Jederzeit im App Store kündbar.
              </Txt>

              <View style={styles.restoreRow}>
                <Press
                  onPress={() => void handleRestore()}
                  disabled={isPurchasing || isRestoring}
                  accessibilityRole="button"
                  accessibilityLabel="Käufe wiederherstellen"
                  accessibilityState={{
                    disabled: isPurchasing || isRestoring,
                    busy: isRestoring,
                  }}
                  haptic="selection"
                  style={[
                    styles.restoreButton,
                    (isPurchasing || isRestoring) && styles.restoreButtonDisabled,
                  ]}>
                  <Txt variant="label" tone="secondary" style={styles.restoreText}>
                    Käufe wiederherstellen
                  </Txt>
                </Press>
              </View>
            </View>
          </ScrollView>
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
}
