import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, TextInput, View } from 'react-native';
import { HubScreen } from '@/components/layout/hub-screen';
import { useTheme } from '@/components/theme/ThemeProvider';
import { BackButton } from '@/components/ui/buttons';
import { FilterChipBar } from '@/components/ui/filter-chip-bar';
import { Txt } from '@/constants/ui';
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
      safeAreaClassName="flex-1 w-full max-w-[800px] self-center"
      header={{ title: 'Fertig', leading: <BackButton label="Zurück" variant="header" /> }}>
      <KeyboardAvoidingView
        className="flex-1 justify-end"
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}>
        {/* Hintergrund-Header (Erfolgs-Icon & Glückwunsch-Text) */}
        <View className="flex-1 min-h-[150px] items-center pt-[30px] opacity-55">
          <View
            className="w-[82px] h-[82px] rounded-fam-large"
            style={{ backgroundColor: colors.surfaceSoft }}
          />
          <Txt variant="heading" className="pt-[18px]">
            Guten Appetit!
          </Txt>
          <Txt
            variant="caption"
            tone="secondary"
            className="pt-[5px] text-center"
            style={{ fontWeight: '500' }}>
            {isWeighMode
              ? 'Verbessere die Mengen deines Haushaltsrezepts.'
              : 'Trage deine tatsächliche Portion ins Tagebuch ein.'}
          </Txt>
        </View>

        {/* Unteres Eingabe-Sheet für Mengen & Tagebucheintrag / Gewichte */}
        <View className="recipe-log-sheet">
          <View className="modal-handle" />
          <View className="min-h-[65px] pt-[13px] flex-row items-center justify-between gap-three">
            <View>
              <Txt variant="heading">
                {isWeighMode ? 'Zubereitete Gewichte' : 'Ins Tagebuch eintragen'}
              </Txt>
              <Txt
                variant="caption"
                tone="secondary"
                className="pt-[7px]"
                style={{ fontSize: 9, lineHeight: 12, fontWeight: '500' }}>
                {isWeighMode
                  ? 'Diese Werte verbessern die Berechnung in deinem Haushaltsrezept.'
                  : 'Wie viel davon war auf deinem Teller?'}
              </Txt>
            </View>
            <Pressable
              onPress={() => router.back()}
              role="button"
              aria-label="Schließen"
              className="w-8 h-8 rounded-control items-center justify-center"
              style={{ backgroundColor: colors.surfaceSoft }}>
              <Txt
                variant="body"
                tone="secondary"
                style={{ fontSize: 18, lineHeight: 20, fontWeight: '500' }}>
                ×
              </Txt>
            </Pressable>
          </View>

          {isLoading || !data ? (
            /* Ladezustand */
            <Txt variant="body" tone="secondary" className="py-[30px] text-center">
              Rezept wird geladen…
            </Txt>
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
                    <Txt
                      variant="label"
                      weight="700"
                      className="flex-1"
                      style={{ fontSize: 10, lineHeight: 12 }}>
                      {component.name}
                    </Txt>
                    <View className="grams-field">
                      <TextInput
                        value={String(gramsById?.[component.id] ?? component.serving_grams ?? 0)}
                        onChangeText={(value) => updateGrams(component.id, value)}
                        keyboardType="decimal-pad"
                        accessibilityLabel={`Grammmenge für ${component.name}`}
                        className="flex-1 h-full py-0 text-right text-[10px] font-medium"
                        style={{ color: colors.text }}
                        placeholderTextColor={colors.textMuted}
                      />
                      <Txt
                        variant="caption"
                        tone="secondary"
                        className="pl-one"
                        style={{ fontSize: 10, lineHeight: 12, fontWeight: '500' }}>
                        g
                      </Txt>
                    </View>
                  </View>
                ))}
              </View>

              {total && !isWeighMode ? (
                <View
                  className="min-h-[53px] rounded-card items-center justify-center px-[11px]"
                  style={{ backgroundColor: colors.surfaceSoft }}>
                  <Txt variant="body" weight="700" style={{ fontSize: 15, lineHeight: 18 }}>
                    {round(total.kcal)} kcal
                  </Txt>
                  <Txt
                    variant="caption"
                    tone="secondary"
                    className="pt-[3px] text-center"
                    style={{ fontSize: 8, lineHeight: 10, fontWeight: '500' }}>
                    {round(total.protein_g)} g Protein · {round(total.carbs_g)} g Kohlenhydrate ·{' '}
                    {round(total.fat_g)} g Fett
                  </Txt>
                </View>
              ) : null}

              {/* Übernehmen-/Speichern-Aktionsbutton */}
              <Pressable
                onPress={handleSubmit}
                disabled={!total || updateComponent.isPending}
                role="button"
                className="min-h-[48px] rounded-card items-center justify-center px-four active:opacity-75 active:scale-[0.99]"
                style={{
                  backgroundColor: colors.basil,
                  opacity: !total || updateComponent.isPending ? 0.4 : 1,
                }}>
                <Txt variant="caption" tone="onAccent" weight="700">
                  {isWeighMode ? 'Gewichte speichern' : 'Ins Tagebuch übernehmen'}
                </Txt>
              </Pressable>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </HubScreen>
  );
}
