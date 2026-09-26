import { ScrollView, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { withAlpha } from '@/components/theme/index';
import { Press, Txt } from '@/constants/ui';
import type { MealPlanEntry, MealSlot } from '../use-meal-plans';
import { dateLabel, MEAL_SLOTS, weekdayLabel } from '../week';

type WeekGridProps = {
  dates: readonly string[];
  entries: readonly MealPlanEntry[];
  canAddRecipes?: boolean;
  onTapEntry: (entry: MealPlanEntry) => void;
  onTapEmptyCell: (date: string, slot: MealSlot) => void;
};

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittag',
  dinner: 'Abendessen',
};

// Die Kalendergeometrie bleibt lokal; große untere Insets verwenden den
// gemeinsamen xxxxl-Spacing-Token.
const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: theme.space.md,
    paddingTop: theme.space.md,
    paddingBottom: theme.space.xxxxl,
  },
  dayCard: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.backgroundElement,
    borderCurve: 'continuous',
  },
  dayHeader: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.space.lg,
  },
  slotColumn: {
    flexDirection: 'column',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: withAlpha(theme.text, 0.07),
  },
  slot: {
    minWidth: 0,
    minHeight: 116,
    gap: theme.space.sm,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.lg,
  },
  slotDivider: {
    borderTopColor: withAlpha(theme.text, 0.07),
  },
  slotLabel: {
    textTransform: 'uppercase',
  },
  entryChip: {
    justifyContent: 'center',
    minHeight: 46,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    backgroundColor: theme.backgroundSoft,
    borderCurve: 'continuous',
  },
  addButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.space.sm,
    borderWidth: theme.borderWidth.base,
    borderStyle: 'dashed',
    borderColor: theme.border,
    borderCurve: 'continuous',
  },
}));

function portionLabel(portions: number) {
  return `${portions} ${portions === 1 ? 'Portion' : 'Portionen'}`;
}

export function WeekGrid({
  dates,
  entries,
  canAddRecipes = true,
  onTapEntry,
  onTapEmptyCell,
}: WeekGridProps) {
  const entriesByCell = new Map<string, MealPlanEntry[]>();
  for (const entry of entries) {
    const key = `${entry.entry_date}|${entry.meal_slot}`;
    const list = entriesByCell.get(key) ?? [];
    list.push(entry);
    entriesByCell.set(key, list);
  }

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {dates.map((date) => (
          <View key={date} style={styles.dayCard}>
            <View style={styles.dayHeader}>
              <Txt variant="heading">{weekdayLabel(date)}</Txt>
              <Txt variant="caption" tone="secondary">
                {dateLabel(date)}
              </Txt>
            </View>

            <View style={styles.slotColumn}>
              {MEAL_SLOTS.map((slot, slotIndex) => {
                const key = `${date}|${slot}`;
                const cellEntries = entriesByCell.get(key) ?? [];
                return (
                  <View key={slot} style={[styles.slot, slotIndex > 0 && styles.slotDivider]}>
                    <Txt variant="eyebrow" tone="secondary" weight="700" style={styles.slotLabel}>
                      {SLOT_LABELS[slot]}
                    </Txt>

                    {cellEntries.map((entry) => (
                      <Press
                        key={entry.id}
                        role="button"
                        aria-label={`${entry.recipe_title}, ${portionLabel(entry.portions)}`}
                        onPress={() => onTapEntry(entry)}
                        style={styles.entryChip}>
                        <Txt variant="label" weight="700" numberOfLines={1}>
                          {entry.recipe_title}
                        </Txt>
                        <Txt variant="caption" tone="secondary">
                          {portionLabel(entry.portions)}
                        </Txt>
                      </Press>
                    ))}

                    <Press
                      role="button"
                      aria-label={`${SLOT_LABELS[slot]} am ${weekdayLabel(date)}, Gericht hinzufügen`}
                      disabled={!canAddRecipes}
                      onPress={() => onTapEmptyCell(date, slot)}
                      style={styles.addButton}>
                      <Txt variant="label" tone="primary" weight="700">
                        {cellEntries.length > 0 ? '+ Weiteres' : '+ Gericht'}
                      </Txt>
                    </Press>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
