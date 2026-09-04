import BottomSheet, { BottomSheetView } from '@expo/ui/community/bottom-sheet';
import { useEffect, useRef } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { GradientBackground } from '@/components/layout/gradient-background';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button } from '@/components/ui/buttons';
import { Txt } from '@/constants/ui';
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
      onPurchased?.();
      onClose();
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
      backgroundStyle={{ backgroundColor: colors.bg }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}>
      <BottomSheetView style={{ flex: 1 }}>
        <View className="flex-1">
          {/* Header mit Schließen-Button */}
          <View className="row-between items-center px-four pt-two pb-two">
            <Txt variant="title" weight="700">
              fam Premium
            </Txt>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Schließen"
              className="modal-close-btn">
              <Txt variant="body" tone="secondary">
                ✕
              </Txt>
            </Pressable>
          </View>

          <ScrollView
            className="flex-1"
            contentContainerClassName="px-four pb-four gap-four"
            showsVerticalScrollIndicator={false}>
            {/* Hero-Bereich */}
            <View className="items-center text-center gap-two pt-two">
              <View className="w-12 h-12 rounded-[16px] overflow-hidden items-center justify-center shadow-md">
                <GradientBackground colors={[colors.basil, colors.carrot]} />
                <Txt variant="body" tone="onAccent" style={{ fontSize: 22 }}>
                  ✦
                </Txt>
              </View>
              <Txt variant="title" weight="700" center>
                Mehr für euren Haushalt
              </Txt>
              <Txt variant="body" tone="secondary" center className="px-two">
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
            <View className="gap-two pt-two items-center w-full">
              <Button
                label={ctaLabel}
                onPress={handleBuy}
                loading={isPurchasing || isLoadingPackages}
                disabled={isRestoring || isLoadingPackages}
                className="w-full"
              />

              <Txt variant="detail" tone="secondary" center>
                Jederzeit im App Store kündbar.
              </Txt>

              <View className="flex-row items-center justify-center gap-three pt-one">
                <Pressable
                  onPress={handleRestore}
                  disabled={isPurchasing || isRestoring}
                  accessibilityRole="button">
                  <Txt variant="caption" tone="secondary" className="underline">
                    Käufe wiederherstellen
                  </Txt>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
}
