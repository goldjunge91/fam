import { Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import type { ExtractedPaywallPlans, PlanPeriod } from './paywall-plans';

const styles = StyleSheet.create((theme) => ({
  container: {
    width: '100%',
    gap: theme.space.md,
  },
  card: {
    position: 'relative',
    borderWidth: theme.borderWidth.base,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 76,
    borderCurve: 'continuous',
  },
  savingsBadge: {
    position: 'absolute',
    top: -theme.space.sm,
    right: theme.space.lg,
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.xs / 2,
    borderRadius: theme.radius.pill,
    zIndex: 1,
  },
  planLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    flex: 1,
    paddingRight: theme.space.sm,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: theme.radius.pill,
    borderWidth: theme.borderWidth.strong,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: theme.radius.pill,
  },
  planInfo: {
    flex: 1,
    minWidth: 0,
    gap: theme.space.xs / 2,
  },
  priceBlock: {
    alignItems: 'flex-end',
    marginLeft: theme.space.sm,
    flexShrink: 0,
  },
}));

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
    <View style={styles.container}>
      {/* Jahresabo Karte (Empfohlen mit Spar-Badge) */}
      <Pressable
        onPress={() => onSelectPeriod('yearly')}
        disabled={disabled}
        accessibilityRole="radio"
        accessibilityState={{ selected: isYearlySelected }}
        accessibilityLabel={`${plans.yearly.title}, ${plans.yearly.priceString} pro Jahr, ${plans.yearly.savingsBadge ?? ''}`}
        style={[
          styles.card,
          {
            borderColor: isYearlySelected ? colors.basil : colors.border,
            backgroundColor: colors.surface,
          },
        ]}>
        {/* Dynamisches Spar-Badge */}
        {plans.yearly.savingsBadge ? (
          <View style={[styles.savingsBadge, { backgroundColor: colors.basil }]}>
            <Txt variant="caption" tone="inverse" weight="700">
              {plans.yearly.savingsBadge}
            </Txt>
          </View>
        ) : null}

        {/* Linke Seite: Radio + Titel/Subtext */}
        <View style={styles.planLeft}>
          <View
            style={[
              styles.radio,
              { borderColor: isYearlySelected ? colors.basil : colors.border },
            ]}>
            {isYearlySelected ? (
              <View style={[styles.radioDot, { backgroundColor: colors.basil }]} />
            ) : null}
          </View>

          <View style={styles.planInfo}>
            <Txt variant="body" weight="700">
              {plans.yearly.title}
            </Txt>
            <Txt variant="body" tone="secondary">
              {plans.yearly.subtext}
            </Txt>
          </View>
        </View>

        {/* Rechte Seite: Preis + Periode */}
        <View style={styles.priceBlock}>
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
        style={[
          styles.card,
          {
            borderColor: isMonthlySelected ? colors.basil : colors.border,
            backgroundColor: colors.surface,
          },
        ]}>
        {/* Linke Seite: Radio + Titel/Subtext */}
        <View style={styles.planLeft}>
          <View
            style={[
              styles.radio,
              { borderColor: isMonthlySelected ? colors.basil : colors.border },
            ]}>
            {isMonthlySelected ? (
              <View style={[styles.radioDot, { backgroundColor: colors.basil }]} />
            ) : null}
          </View>

          <View style={styles.planInfo}>
            <Txt variant="body" weight="700">
              {plans.monthly.title}
            </Txt>
            <Txt variant="body" tone="secondary">
              {plans.monthly.subtext}
            </Txt>
          </View>
        </View>

        {/* Rechte Seite: Preis + Periode */}
        <View style={styles.priceBlock}>
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
