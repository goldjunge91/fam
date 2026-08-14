import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { FontSize, ThemedText } from '@/components/themed-text';
import { RecipeArtwork } from '@/features/recipes/components/recipe-preview-card';
import { useRecipeCoverUrl } from '@/features/recipes/recipe-cover';
import { useTheme } from '@/hooks/use-theme';

import type { MealPlanEntry, MealSlot } from '../use-meal-plans';
import { MEAL_SLOTS, weekdayLabel } from '../week';

export type DraggableRecipe = {
  id: string;
  title: string;
  coverImagePath?: string | null;
};

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

// Feste Groessen fuer die Mahlzeiten-Slots (#195-Mockup "06.02 · Essensplan
// — Tag"): alle drei Ansichten (Tag/3 Tage/Woche) sehen gleich aus — die
// Mahlzeiten stehen untereinander, in derselben Groesse wie in der
// Tagesansicht. Nur die Anzahl der sichtbaren Tages-Karten unterscheidet
// sich; deshalb ist SLOT_SIZES nicht von `mode` abhaengig.
const SLOT_SIZES = {
  slotMinHeight: 116,
  slotGap: 8,
  slotPaddingHorizontal: 12,
  slotPaddingVertical: 12,
  labelFontSize: 11,
  labelLineHeight: 14,
  chipMinHeight: 46,
  chipBorderRadius: 13,
  chipPaddingHorizontal: 12,
  chipPaddingVertical: 9,
  titleFontSize: 15,
  titleLineHeight: 19,
  metaFontSize: 12,
  metaLineHeight: 15,
  addMinHeight: 40,
  addBorderRadius: 12,
  addPaddingHorizontal: 8,
  addFontSize: 13,
  addLineHeight: 16,
} as const;

/**
 * Responsive Tageskarten des Essensplans. Tippen bleibt der primaere Weg;
 * die vorhandene Drag-Ablage sitzt weiter unter den sichtbaren Tagen.
 *
 * Die drei Mahlzeiten stehen in jeder Ansicht (Tag/3 Tage/Woche) untereinander
 * und in identischer Groesse (`SLOT_SIZES`) — die Ansichten unterscheiden sich
 * nur durch die Anzahl der sichtbaren Tages-Karten (`dates`), nicht durch
 * deren Aussehen.
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
  const sizes = SLOT_SIZES;
  // Knoten statt vormessener Rechtecke: die Woche-/3-Tage-Liste ist vertikal
  // scrollbar, ein einmal beim Mount gemessenes Rechteck waere nach dem
  // Scrollen falsch und der Drop wuerde ins Leere treffen. Stattdessen wird
  // beim Loslassen live neu gemessen (measureInWindow).
  const cellNodes = useRef(new Map<string, View>());
  const [draggingRecipe, setDraggingRecipe] = useState<DraggableRecipe | null>(null);
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
    if (node) cellNodes.current.set(key, node);
    else cellNodes.current.delete(key);
  }, []);

  const measureCell = useCallback((node: View): Promise<CellRect> => {
    return new Promise((resolve) => {
      node.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
    });
  }, []);

  const handleDrop = useCallback(
    async (absoluteX: number, absoluteY: number, recipe: DraggableRecipe) => {
      setDraggingRecipe(null);
      const cells = Array.from(cellNodes.current.entries());
      const rects = await Promise.all(cells.map(([, node]) => measureCell(node)));
      for (let i = 0; i < cells.length; i++) {
        const [key] = cells[i];
        const rect = rects[i];
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
    [measureCell, onDropRecipe],
  );

  // Karte mittig ueber dem Finger, nach oben versetzt: der Finger verdeckt
  // sonst genau die Zelle, ueber der losgelassen werden soll.
  const overlayStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value - 56 }, { translateY: translateY.value - 130 }],
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

            <View style={[styles.slotColumn, { borderTopColor: `${theme.text}12` }]}>
              {MEAL_SLOTS.map((slot, slotIndex) => {
                const key = `${date}|${slot}`;
                const cellEntries = entriesByCell.get(key) ?? [];
                return (
                  <View
                    key={slot}
                    ref={(node) => registerCell(key, node)}
                    style={[
                      styles.slot,
                      {
                        minHeight: sizes.slotMinHeight,
                        gap: sizes.slotGap,
                        paddingHorizontal: sizes.slotPaddingHorizontal,
                        paddingVertical: sizes.slotPaddingVertical,
                      },
                      slotIndex > 0 && {
                        borderTopColor: `${theme.text}12`,
                        borderTopWidth: 1,
                      },
                    ]}>
                    <ThemedText
                      themeColor="textSecondary"
                      style={[
                        styles.slotLabel,
                        {
                          fontSize: sizes.labelFontSize,
                          lineHeight: sizes.labelLineHeight,
                        },
                      ]}>
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
                          {
                            minHeight: sizes.chipMinHeight,
                            borderRadius: sizes.chipBorderRadius,
                            paddingHorizontal: sizes.chipPaddingHorizontal,
                            paddingVertical: sizes.chipPaddingVertical,
                            backgroundColor: theme.backgroundSelected,
                          },
                          pressed && styles.pressed,
                        ]}>
                        <ThemedText
                          style={[
                            styles.entryTitle,
                            {
                              fontSize: sizes.titleFontSize,
                              lineHeight: sizes.titleLineHeight,
                            },
                          ]}
                          numberOfLines={1}>
                          {entry.recipe_title}
                        </ThemedText>
                        <ThemedText
                          themeColor="textSecondary"
                          style={[
                            styles.entryMeta,
                            {
                              fontSize: sizes.metaFontSize,
                              lineHeight: sizes.metaLineHeight,
                            },
                          ]}>
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
                        {
                          minHeight: sizes.addMinHeight,
                          borderRadius: sizes.addBorderRadius,
                          paddingHorizontal: sizes.addPaddingHorizontal,
                          borderColor: theme.border,
                        },
                        pressed && styles.pressed,
                      ]}>
                      <ThemedText
                        themeColor="accent"
                        style={[
                          styles.addText,
                          {
                            fontSize: sizes.addFontSize,
                            lineHeight: sizes.addLineHeight,
                          },
                        ]}>
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
              {
                backgroundColor: `${theme.backgroundElement}C7`,
                borderColor: theme.border,
              },
            ]}>
            <ThemedText style={styles.trayTitle}>Rezepte zum Ziehen</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.trayLabel}>
              Karte halten und auf eine Mahlzeit ziehen
            </ThemedText>
            <View style={styles.trayGrid}>
              {recipes.map((recipe) => (
                <DraggableRecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  translateX={translateX}
                  translateY={translateY}
                  onDragStart={setDraggingRecipe}
                  onDragEnd={handleDrop}
                />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {draggingRecipe ? (
        <Animated.View pointerEvents="none" style={[styles.dragOverlay, overlayStyle]}>
          <DragPreviewCard recipe={draggingRecipe} />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Card im horizontalen Tray — groß genug, um das Rezeptbild erkennbar zu zeigen. */
function DraggableRecipeCard({
  recipe,
  translateX,
  translateY,
  onDragStart,
  onDragEnd,
}: {
  recipe: DraggableRecipe;
  translateX: import('react-native-reanimated').SharedValue<number>;
  translateY: import('react-native-reanimated').SharedValue<number>;
  onDragStart: (recipe: DraggableRecipe) => void;
  onDragEnd: (absoluteX: number, absoluteY: number, recipe: DraggableRecipe) => Promise<void>;
}) {
  const theme = useTheme();
  const { data: coverUrl } = useRecipeCoverUrl(recipe.coverImagePath);

  // `activateAfterLongPress` laesst der umgebenden horizontalen ScrollView
  // kurze Wischgesten zum Scrollen — erst ein kurzes Halten startet den Drag.
  // Ohne das gewinnt mal die ScrollView, mal der Pan, je nach Zufall der
  // ersten Bewegungsrichtung — das war das kaputte Ziehverhalten.
  const pan = Gesture.Pan()
    .activateAfterLongPress(150)
    .onBegin((event) => {
      'worklet';
      translateX.value = event.absoluteX;
      translateY.value = event.absoluteY;
      runOnJS(onDragStart)(recipe);
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
      <View style={[styles.recipeCard, { backgroundColor: theme.backgroundSelected }]}>
        <View style={styles.recipeCardArtwork}>
          <RecipeArtwork title={recipe.title} coverUrl={coverUrl} paletteIndex={recipe.id.length} />
        </View>
        <ThemedText style={styles.recipeCardText} numberOfLines={2}>
          {recipe.title}
        </ThemedText>
      </View>
    </GestureDetector>
  );
}

/** Schwebende Vorschau waehrend des Ziehens — dieselbe Bildkachel, etwas kleiner. */
function DragPreviewCard({ recipe }: { recipe: DraggableRecipe }) {
  const theme = useTheme();
  const { data: coverUrl } = useRecipeCoverUrl(recipe.coverImagePath);

  return (
    <View
      style={[
        styles.dragPreviewCard,
        {
          backgroundColor: theme.backgroundSelected,
          borderColor: theme.accent,
        },
      ]}>
      <View style={styles.dragPreviewArtwork}>
        <RecipeArtwork title={recipe.title} coverUrl={coverUrl} paletteIndex={recipe.id.length} />
      </View>
      <ThemedText style={styles.dragPreviewText} numberOfLines={1}>
        {recipe.title}
      </ThemedText>
    </View>
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
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  dayName: {
    ...FontSize[17],
    lineHeight: 21,
    fontWeight: 700,
  },
  dayDate: {
    ...FontSize[9],
    lineHeight: 12,
    fontWeight: 500,
  },
  // Die Mahlzeiten stehen in jeder Ansicht untereinander (#195-Mockup
  // "06.02"); nur die Groessen aus VIEW_SLOT_SIZES unterscheiden sich.
  slotColumn: {
    flexDirection: 'column',
    borderTopWidth: 1,
  },
  slot: {
    minWidth: 0,
  },
  slotLabel: {
    fontWeight: 700,
    letterSpacing: 0.55,
    textTransform: 'uppercase',
  },
  entryChip: {
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
  entryTitle: {
    fontWeight: 700,
  },
  entryMeta: {
    fontWeight: 500,
  },
  addButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderCurve: 'continuous',
  },
  addText: {
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
  // Zwei-Spalten-Kachelraster statt horizontalem Scrollen: die Karten stehen
  // untereinander, keine Konkurrenz mehr mit einer zweiten (horizontalen)
  // ScrollView um die Ziehgeste.
  trayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 12,
  },
  // Große Rezeptkarte im Zieh-Tray, statt der frueheren winzigen Text-Chips —
  // das Bild macht das Gericht auf den ersten Blick erkennbar.
  recipeCard: {
    width: '47%',
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: 8,
    gap: 6,
  },
  recipeCardArtwork: {
    height: 118,
    overflow: 'hidden',
    borderRadius: 12,
    borderCurve: 'continuous',
  },
  recipeCardText: {
    ...FontSize[12],
    lineHeight: 15,
    fontWeight: 700,
  },
  dragOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  dragPreviewCard: {
    width: 112,
    borderRadius: 15,
    borderCurve: 'continuous',
    borderWidth: 2,
    padding: 6,
    gap: 4,
    opacity: 0.94,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  dragPreviewArtwork: {
    height: 68,
    overflow: 'hidden',
    borderRadius: 10,
    borderCurve: 'continuous',
  },
  dragPreviewText: {
    ...FontSize[10],
    lineHeight: 13,
    fontWeight: 700,
  },
});
