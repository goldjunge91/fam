import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { MealPlanEntry, MealSlot } from '../use-meal-plans';
import { MEAL_SLOT_LABELS, MEAL_SLOTS, weekdayLabel } from '../week';

export type DraggableRecipe = { id: string; title: string };

type CellRect = { x: number; y: number; width: number; height: number };

type WeekGridProps = {
  /** Sichtbare Tage, in Reihenfolge — 1 (Tag), 3 (3 Tage) oder 7 (Woche). */
  dates: readonly string[];
  entries: readonly MealPlanEntry[];
  recipes: readonly DraggableRecipe[];
  onDropRecipe: (date: string, slot: MealSlot, recipe: DraggableRecipe) => void;
  onTapEntry: (entry: MealPlanEntry) => void;
  /**
   * Tippen auf eine leere Zelle (#129-Nachtrag): oeffnet einen Rezept-Picker
   * statt sich auf Drag & Drop zu verlassen. Drag & Drop bleibt als
   * zusaetzlicher Weg bestehen, ist aber auf echten Geraeten fehleranfaellig
   * (Zell-Koordinaten werden nur einmal gemessen, siehe Kommentar unten) —
   * Tippen ist der verlaessliche Hauptweg, um ein Gericht einzutragen.
   */
  onTapEmptyCell: (date: string, slot: MealSlot) => void;
};

/**
 * Tages-/3-Tage-/Wochenraster (#129, Nachtrag fuer mehrere Ansichten): so
 * viele Tage (Zeilen) wie `dates` lang ist, x 3 Mahlzeiten-Slots (Spalten).
 * Ein Gericht kommt entweder per Tippen auf eine leere Zelle (Rezept-Picker)
 * oder per Drag & Drop aus der Ablage unten in eine Zelle.
 *
 * Bekannte Grenze beim Drag & Drop: Zell-Koordinaten werden bei jedem Layout
 * gemessen (`measure()`), aber nicht bei jedem Scroll-Event neu — waehrend
 * eines Drags scrollen aendert deshalb die Trefferflaeche nicht mit. Deshalb
 * ist Tippen (`onTapEmptyCell`) der primaere, verlaessliche Weg.
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
  const days = dates;
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
      <ScrollView style={styles.grid} showsVerticalScrollIndicator={false}>
        <View style={[styles.headerRow, { borderColor: theme.border }]}>
          <View style={styles.dayColumnHeader} />
          {MEAL_SLOTS.map((slot) => (
            <View key={slot} style={styles.slotHeaderCell}>
              <ThemedText type="small" themeColor="textSecondary">
                {MEAL_SLOT_LABELS[slot]}
              </ThemedText>
            </View>
          ))}
        </View>

        {days.map((date) => (
          <View key={date} style={[styles.dayRow, { borderColor: theme.border }]}>
            <View style={styles.dayColumnHeader}>
              <ThemedText type="smallBold">{weekdayLabel(date).slice(0, 2)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {date.slice(8, 10)}.{date.slice(5, 7)}.
              </ThemedText>
            </View>

            {MEAL_SLOTS.map((slot) => {
              const key = `${date}|${slot}`;
              const cellEntries = entriesByCell.get(key) ?? [];
              return (
                <View
                  key={slot}
                  ref={(node) => registerCell(key, node)}
                  onLayout={() => {}}
                  style={[styles.cell, { borderColor: theme.border }]}>
                  {cellEntries.length === 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${MEAL_SLOT_LABELS[slot]} am ${weekdayLabel(date)}, Gericht hinzufügen`}
                      onPress={() => onTapEmptyCell(date, slot)}
                      style={styles.emptyCell}>
                      <ThemedText type="small" themeColor="textSecondary">
                        +
                      </ThemedText>
                    </Pressable>
                  ) : (
                    cellEntries.map((entry) => (
                      <Pressable
                        key={entry.id}
                        accessibilityRole="button"
                        accessibilityLabel={`${entry.recipe_title}, ${entry.portions} Portionen`}
                        onPress={() => onTapEntry(entry)}
                        style={[styles.entryChip, { backgroundColor: theme.accent }]}>
                        <ThemedText type="small" style={{ color: '#ffffff' }} numberOfLines={2}>
                          {entry.recipe_title}
                        </ThemedText>
                        <ThemedText type="small" style={{ color: '#ffffff' }}>
                          {entry.portions}×
                        </ThemedText>
                      </Pressable>
                    ))
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.tray, { borderColor: theme.border, backgroundColor: theme.background }]}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.trayLabel}>
          Rezepte auf einen Tag/eine Mahlzeit ziehen
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
              onDragStart={(title) => setDraggingTitle(title)}
              onDragEnd={handleDrop}
            />
          ))}
        </ScrollView>
      </View>

      {draggingTitle ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.dragOverlay, overlayStyle, { backgroundColor: theme.accent }]}>
          <ThemedText type="small" style={{ color: '#ffffff' }} numberOfLines={1}>
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
      <View style={[styles.recipeChip, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="small" numberOfLines={1} style={styles.recipeChipText}>
          {recipe.title}
        </ThemedText>
      </View>
    </GestureDetector>
  );
}

const CELL_MIN_HEIGHT = 56;

const styles = StyleSheet.create({
  root: { flex: 1 },
  grid: { flex: 1 },
  headerRow: { flexDirection: 'row', borderBottomWidth: 1, paddingBottom: Spacing.one },
  dayColumnHeader: { width: 40, justifyContent: 'center', paddingLeft: Spacing.one },
  slotHeaderCell: { flex: 1, alignItems: 'center' },
  dayRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: CELL_MIN_HEIGHT,
  },
  cell: {
    flex: 1,
    borderLeftWidth: StyleSheet.hairlineWidth,
    padding: Spacing.half,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  emptyCell: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: CELL_MIN_HEIGHT - Spacing.half * 2,
  },
  entryChip: {
    borderRadius: 8,
    paddingHorizontal: Spacing.one,
    paddingVertical: 2,
    alignItems: 'center',
    width: '100%',
  },
  tray: { borderTopWidth: 1, paddingVertical: Spacing.two },
  trayLabel: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.one },
  trayContent: { paddingHorizontal: Spacing.three, gap: Spacing.two },
  recipeChip: {
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    maxWidth: 160,
  },
  recipeChipText: {},
  dragOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    maxWidth: 160,
  },
});
