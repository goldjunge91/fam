import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FilterChipBar } from '@/components/filter-chip-bar';
import { GradientBackground } from '@/components/gradient-background';
import { PageHeader } from '@/components/page-header';
import { FontSize, ThemedText } from '@/components/themed-text';
import { HeaderIconButton } from '@/components/ui/buttons';
import { Radius } from '@/constants/theme';
import type { MealType } from '@/features/calorie-tracking/api';
import { useHubGradient } from '@/hooks/use-hub-gradient';
import { useTheme } from '@/hooks/use-theme';
import { calculateAdjustedServingNutrition } from './nutrition';
import { useRecipeDetail, useUpdateComponentMutation } from './use-recipes';

const MEAL_OPTIONS: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Frühstück' },
  { value: 'lunch', label: 'Mittag' },
  { value: 'dinner', label: 'Abend' },
  { value: 'snack', label: 'Snacks' },
];

function round(value: number): number {
  return Math.round(value);
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function BackGlyph() {
  return <ThemedText style={styles.backGlyph}>‹</ThemedText>;
}

export function RecipeLogScreen() {
  const theme = useTheme();
  const hubGradient = useHubGradient();
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: Initialwerte nur einmal aus den geladenen Rezeptdaten übernehmen.
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
    <View style={styles.root}>
      <GradientBackground {...hubGradient} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <PageHeader
          title="Fertig"
          leading={
            <HeaderIconButton label="Zurück" onPress={() => router.back()}>
              <BackGlyph />
            </HeaderIconButton>
          }
        />

        <KeyboardAvoidingView
          style={styles.keyboardAvoider}
          behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.finishBackdrop}>
            <View style={[styles.finishArtwork, { backgroundColor: theme.backgroundSelected }]} />
            <ThemedText style={styles.finishTitle}>Guten Appetit!</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.finishSubtitle}>
              {isWeighMode
                ? 'Verbessere die Mengen deines Haushaltsrezepts.'
                : 'Trage deine tatsächliche Portion ins Tagebuch ein.'}
            </ThemedText>
          </View>

          <View style={[styles.sheet, { backgroundColor: theme.backgroundElement }]}>
            <View style={[styles.sheetHandle, { backgroundColor: theme.border }]} />
            <View style={styles.sheetHeader}>
              <View>
                <ThemedText style={styles.sheetTitle}>
                  {isWeighMode ? 'Zubereitete Gewichte' : 'Ins Tagebuch eintragen'}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.sheetSubtitle}>
                  {isWeighMode
                    ? 'Diese Werte verbessern die Berechnung in deinem Haushaltsrezept.'
                    : 'Wie viel davon war auf deinem Teller?'}
                </ThemedText>
              </View>
              <Pressable
                onPress={() => router.back()}
                role="button"
                aria-label="Schließen"
                style={[styles.closeButton, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText themeColor="accent" style={styles.closeGlyph}>
                  ×
                </ThemedText>
              </Pressable>
            </View>

            {isLoading || !data ? (
              <ThemedText themeColor="textSecondary" style={styles.loadingText}>
                Rezept wird geladen…
              </ThemedText>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.sheetContent}>
                {!isWeighMode ? (
                  <FilterChipBar
                    label="Mahlzeit"
                    options={MEAL_OPTIONS}
                    selected={mealType}
                    onSelect={setMealType}
                  />
                ) : null}

                <View style={styles.componentList}>
                  {topLevelComponents.map((component) => (
                    <View key={component.id} style={styles.componentRow}>
                      <ThemedText style={styles.componentName}>{component.name}</ThemedText>
                      <View style={[styles.gramsField, { borderColor: theme.border }]}>
                        <TextInput
                          value={String(gramsById?.[component.id] ?? component.serving_grams ?? 0)}
                          onChangeText={(value) => updateGrams(component.id, value)}
                          keyboardType="decimal-pad"
                          accessibilityLabel={`Grammmenge für ${component.name}`}
                          style={[styles.gramsInput, { color: theme.text }]}
                        />
                        <ThemedText themeColor="textSecondary" style={styles.gramsUnit}>
                          g
                        </ThemedText>
                      </View>
                    </View>
                  ))}
                </View>

                {total && !isWeighMode ? (
                  <View style={[styles.totalCard, { backgroundColor: theme.backgroundSelected }]}>
                    <ThemedText style={styles.totalKcal}>{round(total.kcal)} kcal</ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.totalMacros}>
                      {round(total.protein_g)} g Protein · {round(total.carbs_g)} g Kohlenhydrate ·{' '}
                      {round(total.fat_g)} g Fett
                    </ThemedText>
                  </View>
                ) : null}

                <Pressable
                  onPress={handleSubmit}
                  disabled={!total || updateComponent.isPending}
                  role="button"
                  style={({ pressed }) => [
                    styles.submitButton,
                    { backgroundColor: theme.accent },
                    (!total || updateComponent.isPending) && styles.disabled,
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="captionCompact" style={styles.submitText}>
                    {isWeighMode ? 'Gewichte speichern' : 'Ins Tagebuch übernehmen'}
                  </ThemedText>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1, width: '100%', maxWidth: 800, alignSelf: 'center' },
  keyboardAvoider: { flex: 1, justifyContent: 'flex-end' },
  backGlyph: { ...FontSize[27], lineHeight: 29, fontWeight: 400 },
  finishBackdrop: { flex: 1, minHeight: 150, alignItems: 'center', paddingTop: 30, opacity: 0.55 },
  finishArtwork: { width: 82, height: 82, borderRadius: Radius.large, borderCurve: 'continuous' },
  finishTitle: { paddingTop: 18, ...FontSize[23], lineHeight: 28, fontWeight: 700 },
  finishSubtitle: {
    paddingTop: 5,
    ...FontSize[10],
    lineHeight: 13,
    fontWeight: 500,
    textAlign: 'center',
  },
  sheet: {
    maxHeight: '72%',
    minHeight: 360,
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 19,
  },
  sheetHandle: { width: 38, height: 4, borderRadius: Radius.hairline, alignSelf: 'center' },
  sheetHeader: {
    minHeight: 65,
    paddingTop: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sheetTitle: { ...FontSize[18], lineHeight: 22, fontWeight: 700, letterSpacing: -0.4 },
  sheetSubtitle: { paddingTop: 7, ...FontSize[9], lineHeight: 12, fontWeight: 500 },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: { ...FontSize[18], lineHeight: 20, fontWeight: 500 },
  loadingText: { paddingVertical: 30, textAlign: 'center', ...FontSize[10] },
  sheetContent: { gap: 12, paddingTop: 4, paddingBottom: 4 },
  componentList: { gap: 10 },
  componentRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 9 },
  componentName: { flex: 1, ...FontSize[10], lineHeight: 12, fontWeight: 700 },
  gramsField: {
    width: 90,
    height: 40,
    borderWidth: 1,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  gramsInput: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    textAlign: 'right',
    ...FontSize[10],
    fontWeight: 500,
  },
  gramsUnit: { paddingLeft: 4, ...FontSize[10], lineHeight: 12, fontWeight: 500 },
  totalCard: {
    minHeight: 53,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 11,
  },
  totalKcal: { ...FontSize[15], lineHeight: 18, fontWeight: 700 },
  totalMacros: {
    paddingTop: 3,
    ...FontSize[8],
    lineHeight: 10,
    fontWeight: 500,
    textAlign: 'center',
  },
  submitButton: {
    minHeight: 48,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  submitText: { color: '#FFFFFF', ...FontSize[11], lineHeight: 14, fontWeight: 700 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.99 }] },
});
