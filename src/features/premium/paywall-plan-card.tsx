import { Pressable, View } from 'react-native';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
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
  const { colors } = useTheme();

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
          borderColor: isYearlySelected ? colors.basil : colors.border,
          backgroundColor: colors.surface,
        }}
        className="relative border-[1.5px] rounded-[18px] px-four py-[14px] flex-row items-center justify-between">
        {/* Dynamisches Spar-Badge */}
        {plans.yearly.savingsBadge ? (
          <View
            style={{ backgroundColor: colors.basil }}
            className="absolute -top-[10px] right-four px-two py-[2px] rounded-full shadow-sm">
            <Txt variant="caption" tone="inverse" weight="700" className="tracking-wider">
              {plans.yearly.savingsBadge}
            </Txt>
          </View>
        ) : null}

        {/* Linke Seite: Radio + Titel/Subtext */}
        <View className="flex-row items-center gap-three flex-1 pr-two">
          <View
            style={{ borderColor: isYearlySelected ? colors.basil : colors.border }}
            className="w-5 h-5 rounded-full border-2 items-center justify-center">
            {isYearlySelected ? (
              <View
                style={{ backgroundColor: colors.basil }}
                className="w-2.5 h-2.5 rounded-full"
              />
            ) : null}
          </View>

          <View className="gap-[2px] flex-1">
            <Txt variant="body" weight="700">
              {plans.yearly.title}
            </Txt>
            <Txt variant="body" tone="secondary">
              {plans.yearly.subtext}
            </Txt>
          </View>
        </View>

        {/* Rechte Seite: Preis + Periode */}
        <View className="items-end">
          <Txt variant="body" weight="700">
            {plans.yearly.priceString}
          </Txt>
          <Txt variant="caption" tone="secondary">
            {plans.yearly.periodLabel}
          </Txt>
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
          borderColor: isMonthlySelected ? colors.basil : colors.border,
          backgroundColor: colors.surface,
        }}
        className="border-[1.5px] rounded-[18px] px-four py-[14px] flex-row items-center justify-between">
        {/* Linke Seite: Radio + Titel/Subtext */}
        <View className="flex-row items-center gap-three flex-1 pr-two">
          <View
            style={{ borderColor: isMonthlySelected ? colors.basil : colors.border }}
            className="w-5 h-5 rounded-full border-2 items-center justify-center">
            {isMonthlySelected ? (
              <View
                style={{ backgroundColor: colors.basil }}
                className="w-2.5 h-2.5 rounded-full"
              />
            ) : null}
          </View>

          <View className="gap-[2px] flex-1">
            <Txt variant="body" weight="700">
              {plans.monthly.title}
            </Txt>
            <Txt variant="body" tone="secondary">
              {plans.monthly.subtext}
            </Txt>
          </View>
        </View>

        {/* Rechte Seite: Preis + Periode */}
        <View className="items-end">
          <Txt variant="body" weight="700">
            {plans.monthly.priceString}
          </Txt>
          <Txt variant="caption" tone="secondary">
            {plans.monthly.periodLabel}
          </Txt>
        </View>
      </Pressable>
    </View>
  );
}
