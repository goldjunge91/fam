import { useCallback, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { scheduleOnRN } from 'react-native-worklets';

import { withAlpha } from '@/components/theme/index';
import { Press, Txt } from '@/constants/ui';
import { RecipeArtwork } from '@/features/recipes/components/recipe-preview-card';
import { useRecipeCoverUrl } from '@/features/recipes/data/household-recipe-images';
import type { MealPlanEntry, MealSlot } from '../use-meal-plans';
import { dateLabel, MEAL_SLOTS, weekdayLabel } from '../week';

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
  canAddRecipes?: boolean;
  onDropRecipe: (date: string, slot: MealSlot, recipe: DraggableRecipe) => void;
  onTapEntry: (entry: MealPlanEntry) => void;
  onTapEmptyCell: (date: string, slot: MealSlot) => void;
};

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittag',
  dinner: 'Abendessen',
};

// Diese festen Werte sind bestehende Kalender-/Drag-Geometrie bzw. native
// Integrationsgrenzen (Zellenhoehe, Artwork-Groesse und Drop-Overlay), keine
// semantischen Farb-, Typografie- oder Spacing-Tokens.
const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: 10,
    paddingTop: 10,
    paddingBottom: 126,
  },
  dayCard: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.surface,
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
    letterSpacing: 0.55,
  },
  entryChip: {
    justifyContent: 'center',
    minHeight: 46,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.space.lg,
    paddingVertical: 9,
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
  tray: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.space.lg,
    backgroundColor: theme.surface,
    borderCurve: 'continuous',
  },
  trayTitle: {
    paddingHorizontal: theme.space.lg,
  },
  trayLabel: {
    paddingHorizontal: theme.space.lg,
    paddingTop: 1,
    paddingBottom: theme.space.sm,
  },
  trayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: theme.space.lg,
  },
  recipeCard: {
    width: '47%',
    borderRadius: theme.radius.md,
    padding: theme.space.sm,
    gap: 6,
    backgroundColor: theme.backgroundSoft,
    borderCurve: 'continuous',
  },
  recipeArtwork: {
    height: 118,
    overflow: 'hidden',
    borderRadius: theme.radius.sm,
    borderCurve: 'continuous',
  },
  dragOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  dragPreviewCard: {
    width: 112,
    borderRadius: theme.radius.md,
    borderWidth: theme.borderWidth.strong,
    borderColor: theme.accent,
    padding: 6,
    gap: 4,
    opacity: 0.94,
    backgroundColor: theme.backgroundSoft,
    shadowColor: theme.text,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    borderCurve: 'continuous',
  },
  dragPreviewArtwork: {
    height: 68,
    overflow: 'hidden',
    borderRadius: theme.radius.sm,
    borderCurve: 'continuous',
  },
}));

function portionLabel(portions: number) {
  return `${portions} ${portions === 1 ? 'Portion' : 'Portionen'}`;
}

export function WeekGrid({
  dates,
  entries,
  recipes,
  canAddRecipes = true,
  onDropRecipe,
  onTapEntry,
  onTapEmptyCell,
}: WeekGridProps) {
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
                  <View
                    key={slot}
                    ref={(node) => registerCell(key, node)}
                    style={[styles.slot, slotIndex > 0 && styles.slotDivider]}>
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

        {recipes.length > 0 ? (
          <View style={styles.tray}>
            <Txt variant="eyebrow" style={styles.trayTitle} weight="700">
              Rezepte zum Ziehen
            </Txt>
            <Txt variant="caption" tone="secondary" style={styles.trayLabel}>
              Karte halten und auf eine Mahlzeit ziehen
            </Txt>
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
      scheduleOnRN(onDragStart, recipe);
    })
    .onUpdate((event) => {
      'worklet';
      translateX.value = event.absoluteX;
      translateY.value = event.absoluteY;
    })
    .onEnd((event) => {
      'worklet';
      scheduleOnRN(onDragEnd, event.absoluteX, event.absoluteY, recipe);
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.recipeCard}>
        <View style={styles.recipeArtwork}>
          <RecipeArtwork title={recipe.title} coverUrl={coverUrl} paletteIndex={recipe.id.length} />
        </View>
        <Txt variant="caption" weight="700" numberOfLines={2}>
          {recipe.title}
        </Txt>
      </View>
    </GestureDetector>
  );
}

/** Schwebende Vorschau waehrend des Ziehens — dieselbe Bildkachel, etwas kleiner. */
function DragPreviewCard({ recipe }: { recipe: DraggableRecipe }) {
  const { data: coverUrl } = useRecipeCoverUrl(recipe.coverImagePath);

  return (
    <View style={styles.dragPreviewCard}>
      <View style={styles.dragPreviewArtwork}>
        <RecipeArtwork title={recipe.title} coverUrl={coverUrl} paletteIndex={recipe.id.length} />
      </View>
      <Txt variant="caption" weight="700" numberOfLines={1}>
        {recipe.title}
      </Txt>
    </View>
  );
}
