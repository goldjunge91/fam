import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, TextInput, View } from 'react-native';
import { HubScreen } from '@/components/layout/hub-screen';
import { ThemedText } from '@/components/theme/themed-text';
import { BackButton } from '@/components/ui/buttons';
import { FilterChipBar } from '@/components/ui/filter-chip-bar';
import type { MealType } from '@/features/calorie-tracking/api';
import { useTheme } from '@/hooks/use-theme';
import { calculateAdjustedServingNutrition } from '../domain/nutrition';
import { useUpdateComponentMutation } from '../hooks/use-recipe-components';
import { useRecipeDetail } from '../hooks/use-recipes';

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

export function RecipeLogScreen() {
  const theme = useTheme();
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
      safeAreaClassName="flex-1 w-full max-w-[800px] self-center"
      header={{ title: 'Fertig', leading: <BackButton label="Zurück" variant="header" /> }}>
      <KeyboardAvoidingView
        className="flex-1 justify-end"
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}>
        {/* Hintergrund-Header (Erfolgs-Icon & Glückwunsch-Text) */}
        <View className="flex-1 min-h-[150px] items-center pt-[30px] opacity-55">
          <View className="w-[82px] h-[82px] rounded-fam-large bg-background-selected" />
          <ThemedText type="headingSmall" className="pt-[18px]">
            Guten Appetit!
          </ThemedText>
          <ThemedText
            type="detail"
            themeColor="textSecondary"
            className="pt-[5px] font-medium text-center">
            {isWeighMode
              ? 'Verbessere die Mengen deines Haushaltsrezepts.'
              : 'Trage deine tatsächliche Portion ins Tagebuch ein.'}
          </ThemedText>
        </View>

        {/* Unteres Eingabe-Sheet für Mengen & Tagebucheintrag / Gewichte */}
        <View className="recipe-log-sheet">
          <View className="modal-handle" />
          <View className="min-h-[65px] pt-[13px] flex-row items-center justify-between gap-three">
            <View>
              <ThemedText type="headingSmall">
                {isWeighMode ? 'Zubereitete Gewichte' : 'Ins Tagebuch eintragen'}
              </ThemedText>
              <ThemedText
                type="detail"
                themeColor="textSecondary"
                className="pt-[7px] text-[9px] leading-[12px] font-medium">
                {isWeighMode
                  ? 'Diese Werte verbessern die Berechnung in deinem Haushaltsrezept.'
                  : 'Wie viel davon war auf deinem Teller?'}
              </ThemedText>
            </View>
            <Pressable
              onPress={() => router.back()}
              role="button"
              aria-label="Schließen"
              className="w-8 h-8 rounded-control items-center justify-center bg-background-selected">
              <ThemedText themeColor="accent" className="text-[18px] leading-[20px] font-medium">
                ×
              </ThemedText>
            </Pressable>
          </View>

          {isLoading || !data ? (
            /* Ladezustand */
            <ThemedText type="detail" themeColor="textSecondary" className="py-[30px] text-center">
              Rezept wird geladen…
            </ThemedText>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerClassName="gap-three py-one">
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
              <View className="gap-[10px]">
                {topLevelComponents.map((component) => (
                  <View key={component.id} className="min-h-[40px] flex-row items-center gap-[9px]">
                    <ThemedText
                      type="detail"
                      className="flex-1 text-[10px] leading-[12px] font-bold">
                      {component.name}
                    </ThemedText>
                    <View className="grams-field">
                      <TextInput
                        value={String(gramsById?.[component.id] ?? component.serving_grams ?? 0)}
                        onChangeText={(value) => updateGrams(component.id, value)}
                        keyboardType="decimal-pad"
                        accessibilityLabel={`Grammmenge für ${component.name}`}
                        className="flex-1 h-full py-0 text-right text-[10px] font-medium text-text"
                        placeholderTextColor={theme.textSecondary}
                      />
                      <ThemedText
                        type="detail"
                        themeColor="textSecondary"
                        className="pl-one text-[10px] leading-[12px] font-medium">
                        g
                      </ThemedText>
                    </View>
                  </View>
                ))}
              </View>

              {total && !isWeighMode ? (
                <View className="min-h-[53px] rounded-card items-center justify-center px-[11px] bg-background-selected">
                  <ThemedText className="text-[15px] leading-[18px] font-bold">
                    {round(total.kcal)} kcal
                  </ThemedText>
                  <ThemedText
                    type="detail"
                    themeColor="textSecondary"
                    className="pt-[3px] text-[8px] leading-[10px] font-medium text-center">
                    {round(total.protein_g)} g Protein · {round(total.carbs_g)} g Kohlenhydrate ·{' '}
                    {round(total.fat_g)} g Fett
                  </ThemedText>
                </View>
              ) : null}

              {/* Übernehmen-/Speichern-Aktionsbutton */}
              <Pressable
                onPress={handleSubmit}
                disabled={!total || updateComponent.isPending}
                role="button"
                className={`min-h-[48px] rounded-card items-center justify-center px-four bg-accent active:opacity-75 active:scale-[0.99] ${
                  !total || updateComponent.isPending ? 'opacity-40' : ''
                }`}>
                <ThemedText type="captionCompact" className="text-white font-bold">
                  {isWeighMode ? 'Gewichte speichern' : 'Ins Tagebuch übernehmen'}
                </ThemedText>
              </Pressable>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </HubScreen>
  );
}
