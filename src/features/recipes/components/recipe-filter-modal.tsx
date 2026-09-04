import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientBackground } from '@/components/layout/gradient-background';
import { PageHeader } from '@/components/layout/page-header';
import { SectionHeading } from '@/components/layout/section-heading';
import { useTheme } from '@/components/theme/ThemeProvider';
import { BackButton, Button } from '@/components/ui/buttons';
import { Txt } from '@/constants/ui';
import { CalorieCarousel } from '@/features/recipes/components/calorie-carousel';
import { CategoryCarousel } from '@/features/recipes/components/category-carousel';
import { useHubGradient } from '@/hooks/use-hub-gradient';

export type RecipeFilters = {
  categoryKey: string | null;
  calorieIndex: number | null;
  mealKey: string | null;
  tags: string[];
};

export const EMPTY_RECIPE_FILTERS: RecipeFilters = {
  categoryKey: null,
  calorieIndex: null,
  mealKey: null,
  tags: [],
};

export const MEAL_FILTERS = [
  { key: 'breakfast', label: 'Frühstück', emoji: '☕' },
  { key: 'lunch', label: 'Mittagessen', emoji: '🍜' },
  { key: 'dinner', label: 'Abendessen', emoji: '🍗' },
  { key: 'snackDessert', label: 'Snacks & Dessert', emoji: '🥪' },
] as const;

type RecipeFilterModalProps = {
  visible: boolean;
  filters: RecipeFilters;
  tags: string[];
  getResultCount: (filters: RecipeFilters) => number;
  onApply: (filters: RecipeFilters) => void;
  onClose: () => void;
};

function toggleTag(tags: string[], tag: string) {
  return tags.includes(tag) ? tags.filter((candidate) => candidate !== tag) : [...tags, tag];
}

export function recipeFilterCount(filters: RecipeFilters) {
  return (
    Number(filters.categoryKey !== null) +
    Number(filters.calorieIndex !== null) +
    Number(filters.mealKey !== null) +
    filters.tags.length
  );
}

/**
 * Vollbildfilter fuer Rezepte. Allergene folgen bewusst erst, wenn Produkte
 * strukturierte Allergen-Daten statt fehleranfaelliger Zutaten-Textsuche liefern.
 */
export function RecipeFilterModal({
  visible,
  filters,
  tags,
  getResultCount,
  onApply,
  onClose,
}: RecipeFilterModalProps) {
  const { colors } = useTheme();
  const hubGradient = useHubGradient();
  const [draft, setDraft] = useState(filters);

  useEffect(() => {
    if (visible) setDraft(filters);
  }, [filters, visible]);

  const filterCount = recipeFilterCount(draft);
  const resultCount = getResultCount(draft);
  const resultLabel = `${resultCount} ${resultCount === 1 ? 'Rezept' : 'Rezepte'} anzeigen`;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}>
      <View className="flex-1">
        <GradientBackground {...hubGradient} />
        <SafeAreaView
          accessibilityViewIsModal
          className="flex-1 w-full max-w-[800px] self-center"
          edges={['top', 'bottom', 'left', 'right']}>
          <PageHeader
            title="Rezepte filtern"
            align="center"
            leading={<BackButton label="Filter schließen" variant="header" onPress={onClose} />}
            trailing={
              <Button
                label="Zurücksetzen"
                variant="link"
                onPress={() => setDraft(EMPTY_RECIPE_FILTERS)}
                disabled={filterCount === 0}
              />
            }
          />

          <ScrollView
            aria-label="Filterauswahl"
            className="flex-1"
            contentContainerClassName="px-[15px] pt-one pb-four"
            showsVerticalScrollIndicator={false}>
            <View className="pb-[22px]">
              <SectionHeading title="Kategorien" />
              <CategoryCarousel
                selectedKey={draft.categoryKey}
                onSelect={(categoryKey) => setDraft((current) => ({ ...current, categoryKey }))}
              />
            </View>

            <View className="pb-[22px]">
              <SectionHeading title="Rezepte nach Kalorien" />
              <CalorieCarousel
                selectedIndex={draft.calorieIndex}
                onSelect={(calorieIndex) => setDraft((current) => ({ ...current, calorieIndex }))}
              />
            </View>

            <View className="pb-[22px]">
              <SectionHeading title="Nach Mahlzeiten" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-two">
                {MEAL_FILTERS.map((meal) => {
                  const selected = meal.key === draft.mealKey;
                  return (
                    <Pressable
                      key={meal.key}
                      role="button"
                      aria-label={meal.label}
                      aria-selected={selected}
                      onPress={() =>
                        setDraft((current) => ({
                          ...current,
                          mealKey: selected ? null : meal.key,
                        }))
                      }
                      className="meal-tile"
                      style={{
                        backgroundColor: selected ? colors.basil : colors.surface,
                        borderColor: selected ? colors.basil : colors.border,
                        borderWidth: 1,
                      }}>
                      <Txt variant="body" center style={{ fontSize: 22, lineHeight: 26 }}>
                        {meal.emoji}
                      </Txt>
                      <Txt
                        variant="micro"
                        tone={selected ? 'onAccent' : 'primary'}
                        center
                        weight="600"
                        numberOfLines={1}>
                        {meal.label}
                      </Txt>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {tags.length > 0 ? (
              <View className="pb-[22px]">
                <SectionHeading title="Tags aus deinen Rezepten" />
                <View className="row-wrap gap-two">
                  {tags.map((tag) => {
                    const selected = draft.tags.includes(tag);
                    return (
                      <Pressable
                        key={tag}
                        role="button"
                        aria-label={`Tag ${tag}`}
                        aria-selected={selected}
                        onPress={() =>
                          setDraft((current) => ({
                            ...current,
                            tags: toggleTag(current.tags, tag),
                          }))
                        }
                        className="tag-pill"
                        style={{
                          backgroundColor: selected ? colors.surfaceSoft : colors.surface,
                          borderColor: selected ? colors.basil : colors.border,
                          borderWidth: 1,
                        }}>
                        <Txt variant="caption" tone="primary" weight="700">
                          #{tag}
                        </Txt>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </ScrollView>

          <View className="recipe-modal-footer">
            <Button
              label={resultLabel}
              size="large"
              onPress={() => onApply(draft)}
              accessibilityLabel={resultLabel}
            />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
