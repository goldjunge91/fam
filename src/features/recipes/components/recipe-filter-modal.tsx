import { useEffect, useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';
import { GradientBackground } from '@/components/layout/gradient-background';
import { PageHeader } from '@/components/layout/page-header';
import { rs } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { BackButton } from '@/components/ui/buttons';
import { Button, Press, SectionHeading, Txt } from '@/constants/ui';
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

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: rs(15),
    paddingTop: theme.space.xs,
    paddingBottom: theme.space.lg,
  },
  filterSection: {
    paddingBottom: rs(22),
  },
  mealScrollContent: {
    gap: theme.space.sm,
  },
  mealTile: {
    width: rs(104),
    minHeight: rs(68),
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.xs,
    padding: theme.space.sm,
    borderWidth: 1,
  },
  mealEmoji: {
    fontSize: rs(22),
    lineHeight: rs(26),
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.sm,
  },
  tagPill: {
    minHeight: rs(36),
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.sm,
  },
  footer: {
    borderTopWidth: 0.5,
    paddingHorizontal: rs(15),
    paddingTop: theme.space.lg,
    paddingBottom: theme.space.sm,
  },
}));

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
      <View style={styles.root}>
        <GradientBackground {...hubGradient} />
        <SafeAreaView
          accessibilityViewIsModal
          style={styles.safeArea}
          edges={['top', 'bottom', 'left', 'right']}>
          <PageHeader
            title="Rezepte filtern"
            align="center"
            leading={<BackButton label="Filter schließen" variant="header" onPress={onClose} />}
            trailing={
              <Button
                title="Zurücksetzen"
                variant="link"
                onPress={() => setDraft(EMPTY_RECIPE_FILTERS)}
                disabled={filterCount === 0}
              />
            }
          />

          <ScrollView
            aria-label="Filterauswahl"
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            <View style={styles.filterSection}>
              <SectionHeading title="Kategorien" titleVariant="body" />
              <CategoryCarousel
                selectedKey={draft.categoryKey}
                onSelect={(categoryKey) => setDraft((current) => ({ ...current, categoryKey }))}
              />
            </View>

            <View style={styles.filterSection}>
              <SectionHeading title="Rezepte nach Kalorien" titleVariant="body" />
              <CalorieCarousel
                selectedIndex={draft.calorieIndex}
                onSelect={(calorieIndex) => setDraft((current) => ({ ...current, calorieIndex }))}
              />
            </View>

            <View style={styles.filterSection}>
              <SectionHeading title="Nach Mahlzeiten" titleVariant="body" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.mealScrollContent}>
                {MEAL_FILTERS.map((meal) => {
                  const selected = meal.key === draft.mealKey;
                  return (
                    <Press
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
                      style={[
                        styles.mealTile,
                        {
                          backgroundColor: selected ? colors.basil : colors.surface,
                          borderColor: selected ? colors.basil : colors.border,
                        },
                      ]}>
                      <Txt variant="body" center style={styles.mealEmoji}>
                        {meal.emoji}
                      </Txt>
                      <Txt
                        variant="caption"
                        tone={selected ? 'onAccent' : 'primary'}
                        center
                        weight="600"
                        numberOfLines={1}>
                        {meal.label}
                      </Txt>
                    </Press>
                  );
                })}
              </ScrollView>
            </View>

            {tags.length > 0 ? (
              <View style={styles.filterSection}>
                <SectionHeading title="Tags aus deinen Rezepten" titleVariant="body" />
                <View style={styles.tagRow}>
                  {tags.map((tag) => {
                    const selected = draft.tags.includes(tag);
                    return (
                      <Press
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
                        style={[
                          styles.tagPill,
                          {
                            backgroundColor: selected ? colors.backgroundSoft : colors.surface,
                            borderColor: selected ? colors.basil : colors.border,
                          },
                        ]}>
                        <Txt variant="caption" tone="primary" weight="700">
                          #{tag}
                        </Txt>
                      </Press>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </ScrollView>

          <View
            style={[
              styles.footer,
              { borderTopColor: colors.border, backgroundColor: colors.background },
            ]}>
            <Button
              title={resultLabel}
              size="lg"
              onPress={() => onApply(draft)}
              accessibilityLabel={resultLabel}
            />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
