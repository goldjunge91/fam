import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { ThemedText } from '@/components/theme/themed-text';
import { RecipeArtwork } from '@/features/recipes/components/recipe-preview-card';
import { useRecipeCoverUrl } from '@/features/recipes/data/household-recipe-images';
import { useTheme } from '@/hooks/use-theme';
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
    <View className="wg-root">
      <ScrollView
        className="wg-scroll"
        contentContainerClassName="wg-content"
        showsVerticalScrollIndicator={false}>
        {dates.map((date) => (
          <View
            key={date}
            className="wg-day-card"
            // borderCurve ist ein echter Laufzeitwert ohne Tailwind-Aequivalent.
            style={{ borderCurve: 'continuous' }}>
            <View className="wg-day-header">
              <ThemedText type="headingSmall" className="wg-day-name">
                {weekdayLabel(date)}
              </ThemedText>
              <ThemedText themeColor="textSecondary" className="wg-day-date">
                {dateLabel(date)}
              </ThemedText>
            </View>

            <View className="wg-slot-column">
              {MEAL_SLOTS.map((slot, slotIndex) => {
                const key = `${date}|${slot}`;
                const cellEntries = entriesByCell.get(key) ?? [];
                return (
                  <View
                    key={slot}
                    ref={(node) => registerCell(key, node)}
                    className={`wg-slot ${slotIndex > 0 ? 'wg-slot-divider' : ''}`}>
                    <ThemedText themeColor="textSecondary" className="wg-slot-label">
                      {SLOT_LABELS[slot]}
                    </ThemedText>

                    {cellEntries.map((entry) => (
                      <Pressable
                        key={entry.id}
                        role="button"
                        aria-label={`${entry.recipe_title}, ${portionLabel(entry.portions)}`}
                        onPress={() => onTapEntry(entry)}
                        className="wg-entry-chip"
                        // borderCurve ist ein echter Laufzeitwert ohne Tailwind-Aequivalent.
                        style={{ borderCurve: 'continuous' }}>
                        <ThemedText className="wg-entry-title" numberOfLines={1}>
                          {entry.recipe_title}
                        </ThemedText>
                        <ThemedText themeColor="textSecondary" className="wg-entry-meta">
                          {portionLabel(entry.portions)}
                        </ThemedText>
                      </Pressable>
                    ))}

                    <Pressable
                      role="button"
                      aria-label={`${SLOT_LABELS[slot]} am ${weekdayLabel(date)}, Gericht hinzufügen`}
                      disabled={!canAddRecipes}
                      onPress={() => onTapEmptyCell(date, slot)}
                      className="wg-add-button"
                      // borderCurve ist ein echter Laufzeitwert ohne Tailwind-Aequivalent.
                      style={{ borderCurve: 'continuous' }}>
                      <ThemedText themeColor="accent" className="wg-add-text">
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
            className="wg-tray"
            // borderCurve ist ein echter Laufzeitwert ohne Tailwind-Aequivalent.
            style={{ borderCurve: 'continuous' }}>
            <ThemedText type="captionCompact" className="wg-tray-title">
              Rezepte zum Ziehen
            </ThemedText>
            <ThemedText themeColor="textSecondary" className="wg-tray-label">
              Karte halten und auf eine Mahlzeit ziehen
            </ThemedText>
            <View className="wg-tray-grid">
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
        <Animated.View pointerEvents="none" className="wg-drag-overlay" style={overlayStyle}>
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
      <View className="wg-recipe-card" style={{ borderCurve: 'continuous' }}>
        <View className="wg-recipe-card-artwork" style={{ borderCurve: 'continuous' }}>
          <RecipeArtwork title={recipe.title} coverUrl={coverUrl} paletteIndex={recipe.id.length} />
        </View>
        <ThemedText className="wg-recipe-card-text" numberOfLines={2}>
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
      className="wg-drag-preview-card"
      // borderCurve und der Schatten (individuelle Opazitaet/Radius/Offset,
      // keine passende boxShadow-Preset-Klasse) sind echte Laufzeitwerte
      // ohne Tailwind-Aequivalent.
      style={{
        borderCurve: 'continuous',
        shadowColor: theme.shadowCard,
        shadowOpacity: 0.22,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      }}>
      <View className="wg-drag-preview-artwork" style={{ borderCurve: 'continuous' }}>
        <RecipeArtwork title={recipe.title} coverUrl={coverUrl} paletteIndex={recipe.id.length} />
      </View>
      <ThemedText className="wg-drag-preview-text" numberOfLines={1}>
        {recipe.title}
      </ThemedText>
    </View>
  );
}
