import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, ScrollView, TextInput, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BackButton } from '@/components/layout/back-button';
import { HubScreen } from '@/components/layout/hub-screen';
import { radius, rs } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { FilterChipBar } from '@/components/ui/filter-chip-bar';
import { Button, inputTextStyles, MIN_TOUCH_SIZE, Press, Txt } from '@/constants/ui';
import type { MealType } from '@/features/calorie-tracking/api';
import { toIsoDate } from '@/lib/format/format-date';
import { calculateAdjustedServingNutrition } from '../domain/nutrition';
import { useUpdateComponentMutation } from '../hooks/use-recipe-components';
import { useRecipeDetail } from '../hooks/use-recipes';

type RecipeLogMealLabelKey =
  | 'recipes.log.mealBreakfast'
  | 'recipes.log.mealLunch'
  | 'recipes.log.mealDinner'
  | 'recipes.log.mealSnack';

const MEAL_OPTIONS = [
  { value: 'breakfast', labelKey: 'recipes.log.mealBreakfast' },
  { value: 'lunch', labelKey: 'recipes.log.mealLunch' },
  { value: 'dinner', labelKey: 'recipes.log.mealDinner' },
  { value: 'snack', labelKey: 'recipes.log.mealSnack' },
] as const satisfies readonly { value: MealType; labelKey: RecipeLogMealLabelKey }[];

const styles = StyleSheet.create((theme) => ({
  keyboard: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  hero: {
    flex: 1,
    minHeight: rs(150),
    alignItems: 'center',
    paddingTop: theme.space.xxl,
    opacity: 0.55,
  },
  heroIcon: {
    width: rs(82),
    height: rs(82),
    borderRadius: theme.radius.famLarge,
  },
  heroTitle: {
    paddingTop: theme.space.xl,
  },
  heroSubtitle: {
    paddingTop: theme.space.md,
    textAlign: 'center',
  },
  sheet: {
    maxHeight: '72%',
    minHeight: rs(360),
    borderTopLeftRadius: theme.radius.famLarge,
    borderTopRightRadius: theme.radius.famLarge,
    paddingHorizontal: theme.space.lg,
    paddingTop: theme.space.md,
    paddingBottom: theme.space.xl,
  },
  handle: {
    width: rs(36),
    height: rs(4),
    alignSelf: 'center',
    borderRadius: radius.s,
    marginTop: theme.space.md,
  },
  sheetHeader: {
    minHeight: rs(65),
    paddingTop: theme.space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.sm,
  },
  sheetHeaderCopy: {
    flex: 1,
  },
  sheetSubtitle: {
    paddingTop: theme.space.md,
  },
  // Wie im Rezept-Bottom-Sheet: sichtbare Flaeche klein, Trefferbereich 44.
  closeFace: {
    width: rs(32),
    height: rs(32),
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: {
    width: MIN_TOUCH_SIZE,
    height: MIN_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    paddingVertical: theme.space.xxl,
    textAlign: 'center',
  },
  scrollContent: {
    gap: theme.space.sm,
    paddingVertical: theme.space.xs,
  },
  componentList: {
    gap: theme.space.md,
  },
  componentRow: {
    minHeight: rs(40),
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
  },
  componentName: {
    flex: 1,
  },
  gramsField: {
    width: rs(90),
    height: rs(40),
    borderWidth: theme.borderWidth.base,
    borderRadius: theme.radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.space.md,
  },
  gramsInput: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    textAlign: 'right',
  },
  gramsUnit: {
    paddingLeft: theme.space.xs,
  },
  total: {
    minHeight: rs(53),
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.space.md,
  },
  totalDetails: {
    paddingTop: theme.space.md,
    textAlign: 'center',
  },
}));

function round(value: number): number {
  return Math.round(value);
}

export function RecipeLogScreen() {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const { id, mode } = useLocalSearchParams<{ id: string; mode?: string }>();
  const isWeighMode = mode === 'weigh';
  const { data, isLoading } = useRecipeDetail(id);
  const updateComponent = useUpdateComponentMutation();
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [gramsById, setGramsById] = useState<Record<string, number> | null>(null);

  const topLevelComponents = useMemo(
    () => (data ? data.components.filter((component) => component.serving_grams !== null) : []),
    [data],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: Initialwerte nur einmal übernehmen.
  useEffect(() => {
    if (!data || gramsById !== null) return;
    const initial: Record<string, number> = {};
    for (const component of topLevelComponents) {
      initial[component.id] = component.serving_grams ?? 0;
    }
    setGramsById(initial);
  }, [data]);

  const gramsMap = useMemo(() => new Map(Object.entries(gramsById ?? {})), [gramsById]);
  const total = useMemo(
    () =>
      data
        ? calculateAdjustedServingNutrition(
            data.components,
            data.items,
            data.productsById,
            gramsMap,
          )
        : null,
    [data, gramsMap],
  );

  const formatNumber = (value: number) => new Intl.NumberFormat(i18n.language).format(value);

  function updateGrams(componentId: string, raw: string) {
    const value = raw.trim() === '' ? 0 : Number(raw.replace(',', '.'));
    if (Number.isNaN(value) || value < 0) return;
    setGramsById((previous) => ({ ...(previous ?? {}), [componentId]: value }));
  }

  async function handleSubmit() {
    if (!data || !total) return;
    if (isWeighMode) {
      try {
        for (const component of topLevelComponents) {
          await updateComponent.mutateAsync({
            id: component.id,
            recipe_id: data.recipe.id,
            household_id: data.recipe.household_id,
            name: component.name,
            serving_grams: gramsById?.[component.id] ?? component.serving_grams,
          });
        }
        router.back();
      } catch (error) {
        Alert.alert(
          t('recipes.log.saveErrorTitle'),
          error instanceof Error ? error.message : t('recipes.detail.copyError'),
        );
      }
      return;
    }
    router.push({
      pathname: '/add-food-entry',
      params: {
        date: toIsoDate(new Date()),
        mealType,
        closeStackCount: '2',
        name: data.recipe.title,
        quantity: '1',
        unit: 'portion',
        kcal: String(round(total.kcal)),
        proteinG: String(round(total.protein_g)),
        carbsG: String(round(total.carbs_g)),
        fatG: String(round(total.fat_g)),
      },
    });
  }

  return (
    <HubScreen
      header={{
        title: t('recipes.log.title'),
        leading: <BackButton label={t('recipes.log.back')} variant="header" />,
      }}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}>
        {/* Hintergrund-Header (Erfolgs-Icon & Glückwunsch-Text) */}
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: colors.backgroundSoft }]} />
          <Txt variant="heading" style={styles.heroTitle}>
            {t('recipes.log.appetite')}
          </Txt>
          <Txt variant="caption" tone="secondary" style={styles.heroSubtitle} weight="500">
            {isWeighMode ? t('recipes.log.weighHint') : t('recipes.log.diaryHint')}
          </Txt>
        </View>

        {/* Unteres Eingabe-Sheet für Mengen & Tagebucheintrag / Gewichte */}
        <View style={[styles.sheet, { backgroundColor: colors.backgroundElement }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderCopy}>
              <Txt variant="heading">
                {isWeighMode ? t('recipes.log.weighTitle') : t('recipes.log.diaryTitle')}
              </Txt>
              <Txt variant="caption" tone="secondary" style={styles.sheetSubtitle} weight="500">
                {isWeighMode ? t('recipes.log.weighSubtitle') : t('recipes.log.diarySubtitle')}
              </Txt>
            </View>
            <Press
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel={t('recipes.detail.close')}
              style={styles.close}>
              <View style={[styles.closeFace, { backgroundColor: colors.backgroundSoft }]}>
                <Txt variant="body" tone="secondary" weight="500">
                  ×
                </Txt>
              </View>
            </Press>
          </View>

          {isLoading || !data ? (
            /* Ladezustand */
            <Txt variant="body" tone="secondary" style={styles.loading}>
              {t('recipes.detail.loading')}
            </Txt>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}>
              {/* Mahlzeitenfilter (Frühstück, Mittag, Abend, Snacks) im Tagebuch-Modus */}
              {!isWeighMode ? (
                <FilterChipBar
                  label={t('recipes.log.meal')}
                  options={MEAL_OPTIONS.map((option) => ({
                    value: option.value,
                    label: t(option.labelKey),
                  }))}
                  selected={mealType}
                  onSelect={setMealType}
                />
              ) : null}

              {/* Liste aller Rezept-Komponenten mit Gramm-Eingabefeldern */}
              <View style={styles.componentList}>
                {topLevelComponents.map((component) => (
                  <View key={component.id} style={styles.componentRow}>
                    <Txt variant="caption" weight="700" style={styles.componentName}>
                      {component.name}
                    </Txt>
                    <View style={[styles.gramsField, { borderColor: colors.border }]}>
                      <TextInput
                        value={String(gramsById?.[component.id] ?? component.serving_grams ?? 0)}
                        onChangeText={(value) => updateGrams(component.id, value)}
                        keyboardType="decimal-pad"
                        accessibilityLabel={t('recipes.log.gramsFor', { name: component.name })}
                        style={[styles.gramsInput, inputTextStyles.grams, { color: colors.text }]}
                        placeholderTextColor={colors.textSecondary}
                      />
                      <Txt variant="caption" tone="secondary" style={styles.gramsUnit}>
                        {t('recipes.log.grams')}
                      </Txt>
                    </View>
                  </View>
                ))}
              </View>

              {total && !isWeighMode ? (
                <View style={[styles.total, { backgroundColor: colors.backgroundSoft }]}>
                  <Txt variant="body" weight="700">
                    {t('recipes.log.kcal', { value: formatNumber(round(total.kcal)) })}
                  </Txt>
                  <Txt variant="caption" tone="secondary" style={styles.totalDetails} weight="500">
                    {t('recipes.log.nutrition', {
                      protein: formatNumber(round(total.protein_g)),
                      carbs: formatNumber(round(total.carbs_g)),
                      fat: formatNumber(round(total.fat_g)),
                    })}
                  </Txt>
                </View>
              ) : null}

              {/* Übernehmen-/Speichern-Aktionsbutton */}
              <Button
                title={isWeighMode ? t('recipes.log.saveWeights') : t('recipes.log.addToDiary')}
                onPress={handleSubmit}
                disabled={!total || updateComponent.isPending}
                loading={updateComponent.isPending}
                size="lg"
                style={{ alignSelf: 'stretch' }}
              />
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </HubScreen>
  );
}
