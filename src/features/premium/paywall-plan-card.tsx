import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Press, Txt } from '@/constants/ui';
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
    backgroundColor: theme.backgroundElement,
  },
  cardSelected: {
    borderColor: theme.accent,
  },
  cardIdle: {
    borderColor: theme.border,
  },
  cardDisabled: {
    opacity: 0.55,
  },
  savingsBadge: {
    position: 'absolute',
    top: -theme.space.sm,
    right: theme.space.lg,
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.xs,
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
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioSelected: {
    borderColor: theme.accent,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.accent,
  },
  planInfo: {
    flex: 1,
    minWidth: 0,
    gap: theme.space.xs,
  },
  priceBlock: {
    alignItems: 'flex-end',
    marginLeft: theme.space.sm,
    flexShrink: 0,
  },
  savingsBadgeBackground: {
    backgroundColor: theme.accent,
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
  const isYearlySelected = selectedPeriod === 'yearly';
  const isMonthlySelected = selectedPeriod === 'monthly';

  return (
    <View style={styles.container} accessibilityRole="radiogroup" accessibilityLabel="Abozeitraum">
      {/* Jahresabo Karte (Empfohlen mit Spar-Badge) */}
      <Press
        onPress={() => onSelectPeriod('yearly')}
        disabled={disabled}
        accessibilityRole="radio"
        accessibilityState={{ selected: isYearlySelected, disabled }}
        accessibilityLabel={`${plans.yearly.title}, ${plans.yearly.priceString} pro Jahr, ${plans.yearly.savingsBadge ?? ''}`}
        haptic="selection"
        scaleTo={0.98}
        style={[
          styles.card,
          isYearlySelected ? styles.cardSelected : styles.cardIdle,
          disabled && styles.cardDisabled,
        ]}>
        {/* Dynamisches Spar-Badge */}
        {plans.yearly.savingsBadge ? (
          <View style={[styles.savingsBadge, styles.savingsBadgeBackground]}>
            <Txt variant="caption" tone="onAccent" weight="700">
              {plans.yearly.savingsBadge}
            </Txt>
          </View>
        ) : null}

        {/* Linke Seite: Radio + Titel/Subtext */}
        <View style={styles.planLeft}>
          <View style={[styles.radio, isYearlySelected && styles.radioSelected]}>
            {isYearlySelected ? <View style={styles.radioDot} /> : null}
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
      </Press>

      {/* Monatsabo Karte */}
      <Press
        onPress={() => onSelectPeriod('monthly')}
        disabled={disabled}
        accessibilityRole="radio"
        accessibilityState={{ selected: isMonthlySelected, disabled }}
        accessibilityLabel={`${plans.monthly.title}, ${plans.monthly.priceString} pro Monat`}
        haptic="selection"
        scaleTo={0.98}
        style={[
          styles.card,
          isMonthlySelected ? styles.cardSelected : styles.cardIdle,
          disabled && styles.cardDisabled,
        ]}>
        {/* Linke Seite: Radio + Titel/Subtext */}
        <View style={styles.planLeft}>
          <View style={[styles.radio, isMonthlySelected && styles.radioSelected]}>
            {isMonthlySelected ? <View style={styles.radioDot} /> : null}
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
      </Press>
    </View>
  );
}
