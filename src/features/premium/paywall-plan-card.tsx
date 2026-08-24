import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/theme/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { ExtractedPaywallPlans, PlanPeriod } from './paywall-plans';

interface PaywallPlanCardProps {
  plans: ExtractedPaywallPlans;
  selectedPeriod: PlanPeriod;
  onSelectPeriod: (period: PlanPeriod) => void;
  disabled?: boolean;
}

/**
 * Interaktive Plan-Karten (Variante 1 · Card Stack) zur Auswahl von Monats- oder Jahresabo
 * mit dynamischer %-Ersparnis und Monatsäquivalent.
 */
export function PaywallPlanCard({
  plans,
  selectedPeriod,
  onSelectPeriod,
  disabled = false,
}: PaywallPlanCardProps) {
  const theme = useTheme();

  const isYearlySelected = selectedPeriod === 'yearly';
  const isMonthlySelected = selectedPeriod === 'monthly';

  return (
    <View className="gap-three w-full">
      {/* Jahresabo Karte (Empfohlen mit Spar-Badge) */}
      <Pressable
        onPress={() => onSelectPeriod('yearly')}
        disabled={disabled}
        accessibilityRole="radio"
        accessibilityState={{ selected: isYearlySelected }}
        accessibilityLabel={`${plans.yearly.title}, ${plans.yearly.priceString} pro Jahr, ${plans.yearly.savingsBadge ?? ''}`}
        style={{
          borderColor: isYearlySelected ? theme.accent : theme.border,
          backgroundColor: theme.backgroundElement,
        }}
        className="relative border-[1.5px] rounded-[18px] px-four py-[14px] flex-row items-center justify-between">
        {/* Dynamisches Spar-Badge */}
        {plans.yearly.savingsBadge ? (
          <View
            style={{ backgroundColor: theme.accent }}
            className="absolute -top-[10px] right-four px-two py-[2px] rounded-full shadow-sm">
            <ThemedText className="text-[11px] font-bold text-white tracking-wider">
              {plans.yearly.savingsBadge}
            </ThemedText>
          </View>
        ) : null}

        {/* Linke Seite: Radio + Titel/Subtext */}
        <View className="flex-row items-center gap-three flex-1 pr-two">
          <View
            style={{ borderColor: isYearlySelected ? theme.accent : theme.border }}
            className="w-5 h-5 rounded-full border-2 items-center justify-center">
            {isYearlySelected ? (
              <View
                style={{ backgroundColor: theme.accent }}
                className="w-2.5 h-2.5 rounded-full"
              />
            ) : null}
          </View>

          <View className="gap-[2px] flex-1">
            <ThemedText className="font-bold text-body-relaxed">{plans.yearly.title}</ThemedText>
            <ThemedText themeColor="textSecondary" className="text-small">
              {plans.yearly.subtext}
            </ThemedText>
          </View>
        </View>

        {/* Rechte Seite: Preis + Periode */}
        <View className="items-end">
          <ThemedText className="font-bold text-body-relaxed">
            {plans.yearly.priceString}
          </ThemedText>
          <ThemedText themeColor="textSecondary" className="text-caption">
            {plans.yearly.periodLabel}
          </ThemedText>
        </View>
      </Pressable>

      {/* Monatsabo Karte */}
      <Pressable
        onPress={() => onSelectPeriod('monthly')}
        disabled={disabled}
        accessibilityRole="radio"
        accessibilityState={{ selected: isMonthlySelected }}
        accessibilityLabel={`${plans.monthly.title}, ${plans.monthly.priceString} pro Monat`}
        style={{
          borderColor: isMonthlySelected ? theme.accent : theme.border,
          backgroundColor: theme.backgroundElement,
        }}
        className="border-[1.5px] rounded-[18px] px-four py-[14px] flex-row items-center justify-between">
        {/* Linke Seite: Radio + Titel/Subtext */}
        <View className="flex-row items-center gap-three flex-1 pr-two">
          <View
            style={{ borderColor: isMonthlySelected ? theme.accent : theme.border }}
            className="w-5 h-5 rounded-full border-2 items-center justify-center">
            {isMonthlySelected ? (
              <View
                style={{ backgroundColor: theme.accent }}
                className="w-2.5 h-2.5 rounded-full"
              />
            ) : null}
          </View>

          <View className="gap-[2px] flex-1">
            <ThemedText className="font-bold text-body-relaxed">{plans.monthly.title}</ThemedText>
            <ThemedText themeColor="textSecondary" className="text-small">
              {plans.monthly.subtext}
            </ThemedText>
          </View>
        </View>

        {/* Rechte Seite: Preis + Periode */}
        <View className="items-end">
          <ThemedText className="font-bold text-body-relaxed">
            {plans.monthly.priceString}
          </ThemedText>
          <ThemedText themeColor="textSecondary" className="text-caption">
            {plans.monthly.periodLabel}
          </ThemedText>
        </View>
      </Pressable>
    </View>
  );
}
