import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, TextInput, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BackButton } from '@/components/layout/back-button';
import { HubScreen } from '@/components/layout/hub-screen';
import { radius, rs } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { FilterChipBar } from '@/components/ui/filter-chip-bar';
import { Button, inputTextStyles, Press, Txt } from '@/constants/ui';
import type { MealType } from '@/features/calorie-tracking/api';
import { calculateAdjustedServingNutrition } from '../domain/nutrition';
import { useUpdateComponentMutation } from '../hooks/use-recipe-components';
import { useRecipeDetail } from '../hooks/use-recipes';

const MEAL_OPTIONS: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Frühstück' },
  { value: 'lunch', label: 'Mittag' },
  { value: 'dinner', label: 'Abend' },
  { value: 'snack', label: 'Snacks' },
];

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
  close: {
    width: rs(32),
    height: rs(32),
    borderRadius: theme.radius.sm,
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

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function RecipeLogScreen() {
  const { colors } = useTheme();
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
          'Gewichte konnten nicht gespeichert werden',
          error instanceof Error ? error.message : 'Bitte versuche es erneut.',
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
      header={{ title: 'Fertig', leading: <BackButton label="Zurück" variant="header" /> }}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}>
        {/* Hintergrund-Header (Erfolgs-Icon & Glückwunsch-Text) */}
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: colors.backgroundSoft }]} />
          <Txt variant="heading" style={styles.heroTitle}>
            Guten Appetit!
          </Txt>
          <Txt variant="caption" tone="secondary" style={styles.heroSubtitle} weight="500">
            {isWeighMode
              ? 'Verbessere die Mengen deines Haushaltsrezepts.'
              : 'Trage deine tatsächliche Portion ins Tagebuch ein.'}
          </Txt>
        </View>

        {/* Unteres Eingabe-Sheet für Mengen & Tagebucheintrag / Gewichte */}
        <View style={[styles.sheet, { backgroundColor: colors.backgroundElement }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderCopy}>
              <Txt variant="heading">
                {isWeighMode ? 'Zubereitete Gewichte' : 'Ins Tagebuch eintragen'}
              </Txt>
              <Txt variant="caption" tone="secondary" style={styles.sheetSubtitle} weight="500">
                {isWeighMode
                  ? 'Diese Werte verbessern die Berechnung in deinem Haushaltsrezept.'
                  : 'Wie viel davon war auf deinem Teller?'}
              </Txt>
            </View>
            <Press
              onPress={() => router.back()}
              role="button"
              aria-label="Schließen"
              style={[styles.close, { backgroundColor: colors.backgroundSoft }]}>
              <Txt variant="body" tone="secondary" weight="500">
                ×
              </Txt>
            </Press>
          </View>

          {isLoading || !data ? (
            /* Ladezustand */
            <Txt variant="body" tone="secondary" style={styles.loading}>
              Rezept wird geladen…
            </Txt>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}>
              {/* Mahlzeitenfilter (Frühstück, Mittag, Abend, Snacks) im Tagebuch-Modus */}
              {!isWeighMode ? (
                <FilterChipBar
                  label="Mahlzeit"
                  options={MEAL_OPTIONS}
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
                        accessibilityLabel={`Grammmenge für ${component.name}`}
                        style={[styles.gramsInput, inputTextStyles.grams, { color: colors.text }]}
                        placeholderTextColor={colors.textSecondary}
                      />
                      <Txt variant="caption" tone="secondary" style={styles.gramsUnit}>
                        g
                      </Txt>
                    </View>
                  </View>
                ))}
              </View>

              {total && !isWeighMode ? (
                <View style={[styles.total, { backgroundColor: colors.backgroundSoft }]}>
                  <Txt variant="body" weight="700">
                    {round(total.kcal)} kcal
                  </Txt>
                  <Txt variant="caption" tone="secondary" style={styles.totalDetails} weight="500">
                    {round(total.protein_g)} g Protein · {round(total.carbs_g)} g Kohlenhydrate ·{' '}
                    {round(total.fat_g)} g Fett
                  </Txt>
                </View>
              ) : null}

              {/* Übernehmen-/Speichern-Aktionsbutton */}
              <Button
                title={isWeighMode ? 'Gewichte speichern' : 'Ins Tagebuch übernehmen'}
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
