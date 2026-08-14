import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { FontSize, ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

import type { MealPlanEntry, MealSlot } from '../use-meal-plans';
import { MEAL_SLOTS, weekdayLabel } from '../week';

export type DraggableRecipe = { id: string; title: string };

type CellRect = { x: number; y: number; width: number; height: number };

type WeekGridProps = {
  dates: readonly string[];
  entries: readonly MealPlanEntry[];
  recipes: readonly DraggableRecipe[];
  onDropRecipe: (date: string, slot: MealSlot, recipe: DraggableRecipe) => void;
  onTapEntry: (entry: MealPlanEntry) => void;
  onTapEmptyCell: (date: string, slot: MealSlot) => void;
};

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittag',
  dinner: 'Abendessen',
};

const MONTH_LABELS = [
  'Jan.',
  'Feb.',
  'März',
  'Apr.',
  'Mai',
  'Juni',
  'Juli',
  'Aug.',
  'Sep.',
  'Okt.',
  'Nov.',
  'Dez.',
];

function dateLabel(date: string) {
  const [, month, day] = date.split('-').map(Number);
  return `${day}. ${MONTH_LABELS[month - 1]}`;
}

function portionLabel(portions: number) {
  return `${portions} ${portions === 1 ? 'Portion' : 'Portionen'}`;
}

/**
 * Responsive Tageskarten des Essensplans. Tippen bleibt der primaere Weg;
 * die vorhandene Drag-Ablage sitzt weiter unter den sichtbaren Tagen.
 */
export function WeekGrid({
  dates,
  entries,
  recipes,
  onDropRecipe,
  onTapEntry,
  onTapEmptyCell,
}: WeekGridProps) {
  const theme = useTheme();
  const cellRects = useRef(new Map<string, CellRect>());
  const [draggingTitle, setDraggingTitle] = useState<string | null>(null);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const entriesByCell = new Map<string, MealPlanEntry[]>();
  for (const entry of entries) {
    const key = `${entry.entry_date}|${entry.meal_slot}`;
    const list = entriesByCell.get(key) ?? [];
    list.push(entry);
    entriesByCell.set(key, list);
  }

  const registerCell = useCallback((key: string, node: View | null) => {
    if (!node) return;
    node.measure((_x, _y, width, height, pageX, pageY) => {
      cellRects.current.set(key, { x: pageX, y: pageY, width, height });
    });
  }, []);

  const handleDrop = useCallback(
    (absoluteX: number, absoluteY: number, recipe: DraggableRecipe) => {
      setDraggingTitle(null);
      for (const [key, rect] of cellRects.current) {
        if (
          absoluteX >= rect.x &&
          absoluteX <= rect.x + rect.width &&
          absoluteY >= rect.y &&
          absoluteY <= rect.y + rect.height
        ) {
          const [date, slot] = key.split('|') as [string, MealSlot];
          onDropRecipe(date, slot, recipe);
          return;
        }
      }
    },
    [onDropRecipe],
  );

  const overlayStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value - 60 }, { translateY: translateY.value - 20 }],
  }));

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        {dates.map((date) => (
          <View
            key={date}
            style={[
              styles.dayCard,
              {
                backgroundColor: `${theme.backgroundElement}E3`,
                borderColor: `${theme.backgroundElement}F5`,
              },
            ]}>
            <View style={styles.dayHeader}>
              <ThemedText style={styles.dayName}>{weekdayLabel(date)}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.dayDate}>
                {dateLabel(date)}
              </ThemedText>
            </View>

            <View style={[styles.slotRow, { borderTopColor: `${theme.text}12` }]}>
              {MEAL_SLOTS.map((slot, slotIndex) => {
                const key = `${date}|${slot}`;
                const cellEntries = entriesByCell.get(key) ?? [];
                return (
                  <View
                    key={slot}
                    ref={(node) => registerCell(key, node)}
                    style={[
                      styles.slot,
                      slotIndex > 0 && { borderLeftColor: `${theme.text}12`, borderLeftWidth: 1 },
                    ]}>
                    <ThemedText themeColor="textSecondary" style={styles.slotLabel}>
                      {SLOT_LABELS[slot]}
                    </ThemedText>

                    {cellEntries.map((entry) => (
                      <Pressable
                        key={entry.id}
                        role="button"
                        aria-label={`${entry.recipe_title}, ${portionLabel(entry.portions)}`}
                        onPress={() => onTapEntry(entry)}
                        style={({ pressed }) => [
                          styles.entryChip,
                          { backgroundColor: theme.backgroundSelected },
                          pressed && styles.pressed,
                        ]}>
                        <ThemedText style={styles.entryTitle} numberOfLines={1}>
                          {entry.recipe_title}
                        </ThemedText>
                        <ThemedText themeColor="textSecondary" style={styles.entryMeta}>
                          {portionLabel(entry.portions)}
                        </ThemedText>
                      </Pressable>
                    ))}

                    <Pressable
                      role="button"
                      aria-label={`${SLOT_LABELS[slot]} am ${weekdayLabel(date)}, Gericht hinzufügen`}
                      onPress={() => onTapEmptyCell(date, slot)}
                      style={({ pressed }) => [
                        styles.addButton,
                        { borderColor: theme.border },
                        pressed && styles.pressed,
                      ]}>
                      <ThemedText themeColor="accent" style={styles.addText}>
                        {cellEntries.length > 0 ? '+ Weiteres' : '+ Gericht'}
                      </ThemedText>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        {recipes.length > 0 ? (
          <View
            style={[
              styles.tray,
              { backgroundColor: `${theme.backgroundElement}C7`, borderColor: theme.border },
            ]}>
            <ThemedText style={styles.trayTitle}>Rezepte zum Ziehen</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.trayLabel}>
              Optional: Rezept halten und auf eine Mahlzeit ziehen
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.trayContent}>
              {recipes.map((recipe) => (
                <DraggableChip
                  key={recipe.id}
                  recipe={recipe}
                  translateX={translateX}
                  translateY={translateY}
                  onDragStart={setDraggingTitle}
                  onDragEnd={handleDrop}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>

      {draggingTitle ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.dragOverlay, overlayStyle, { backgroundColor: theme.accent }]}>
          <ThemedText style={styles.dragText} numberOfLines={1}>
            {draggingTitle}
          </ThemedText>
        </Animated.View>
      ) : null}
    </View>
  );
}

function DraggableChip({
  recipe,
  translateX,
  translateY,
  onDragStart,
  onDragEnd,
}: {
  recipe: DraggableRecipe;
  translateX: import('react-native-reanimated').SharedValue<number>;
  translateY: import('react-native-reanimated').SharedValue<number>;
  onDragStart: (title: string) => void;
  onDragEnd: (absoluteX: number, absoluteY: number, recipe: DraggableRecipe) => void;
}) {
  const theme = useTheme();
  const pan = Gesture.Pan()
    .onBegin((event) => {
      'worklet';
      translateX.value = event.absoluteX;
      translateY.value = event.absoluteY;
      runOnJS(onDragStart)(recipe.title);
    })
    .onUpdate((event) => {
      'worklet';
      translateX.value = event.absoluteX;
      translateY.value = event.absoluteY;
    })
    .onEnd((event) => {
      'worklet';
      runOnJS(onDragEnd)(event.absoluteX, event.absoluteY, recipe);
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.recipeChip, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText style={styles.recipeChipText} numberOfLines={1}>
          {recipe.title}
        </ThemedText>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: 8,
    paddingTop: 10,
    paddingBottom: 126,
  },
  dayCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 20,
    borderCurve: 'continuous',
  },
  dayHeader: {
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  dayName: {
    ...FontSize[12],
    lineHeight: 15,
    fontWeight: 700,
  },
  dayDate: {
    ...FontSize[9],
    lineHeight: 12,
    fontWeight: 500,
  },
  slotRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  slot: {
    flex: 1,
    minWidth: 0,
    minHeight: 88,
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  slotLabel: {
    ...FontSize[7],
    lineHeight: 9,
    fontWeight: 700,
    letterSpacing: 0.55,
    textTransform: 'uppercase',
  },
  entryChip: {
    minHeight: 31,
    justifyContent: 'center',
    borderRadius: 10,
    borderCurve: 'continuous',
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  entryTitle: {
    ...FontSize[9],
    lineHeight: 11,
    fontWeight: 700,
  },
  entryMeta: {
    ...FontSize[7],
    lineHeight: 9,
    fontWeight: 500,
  },
  addButton: {
    minHeight: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 9,
    borderCurve: 'continuous',
    paddingHorizontal: 4,
  },
  addText: {
    ...FontSize[8],
    lineHeight: 10,
    fontWeight: 600,
  },
  pressed: {
    opacity: 0.7,
  },
  tray: {
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 18,
    borderCurve: 'continuous',
    paddingVertical: 12,
  },
  trayTitle: {
    paddingHorizontal: 12,
    ...FontSize[11],
    lineHeight: 14,
    fontWeight: 700,
  },
  trayLabel: {
    paddingHorizontal: 12,
    paddingTop: 1,
    paddingBottom: 8,
    ...FontSize[8],
    lineHeight: 11,
    fontWeight: 500,
  },
  trayContent: {
    gap: 7,
    paddingHorizontal: 12,
  },
  recipeChip: {
    maxWidth: 160,
    borderRadius: 11,
    borderCurve: 'continuous',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  recipeChipText: {
    ...FontSize[10],
    lineHeight: 13,
    fontWeight: 600,
  },
  dragOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    maxWidth: 160,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dragText: {
    color: '#FFFFFF',
    ...FontSize[9],
    lineHeight: 12,
    fontWeight: 700,
  },
});
