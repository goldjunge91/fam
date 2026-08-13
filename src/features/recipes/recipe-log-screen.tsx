import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import type { MealType } from '@/features/calorie-tracking/api';

import { calculateAdjustedServingNutrition } from './nutrition';
import { useRecipeDetail } from './use-recipes';

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
// Duplikat von `MEAL_LABELS` aus dem Diary-Screen statt Import: der zieht
// transitiv den gesamten Dashboard-Kram (ProgressRing/Reanimated) mit rein,
// nur fuer vier Konstanten unnoetig schwere Kopplung zweier Screens.
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Frühstück',
  lunch: 'Mittagessen',
  dinner: 'Abendessen',
  snack: 'Snacks',
};

function round(n: number): number {
  return Math.round(n);
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Portionsanpassung vor dem Tagebuch-Eintrag (#127): startet mit den
 * Rezept-Grammmengen je oberster Komponente, laesst sie individuell
 * anpassen ("mehr Soße"), ohne das Rezept selbst zu veraendern. Uebergibt
 * das Ergebnis als fertigen kcal/Makro-Snapshot an `/add-food-entry` — genau
 * denselben Pfad, den die App fuer "Zuletzt/Häufig"-Eintraege schon nutzt
 * (siehe dortiger Screen-Kommentar), kein Live-Bezug auf das Rezept.
 */
export function RecipeLogScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useRecipeDetail(id);
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [gramsById, setGramsById] = useState<Record<string, number> | null>(null);

  const topLevelComponents = useMemo(
    () => (data ? data.components.filter((c) => c.serving_grams !== null) : []),
    [data],
  );

  // Ausgangswert = Rezept-Portionsgrammmengen (AC #127), einmal beim Laden
  // uebernommen — danach gehoert der State dem Formular, nicht dem Rezept.
  // biome-ignore lint/correctness/useExhaustiveDependencies: nur beim ersten Laden der Daten vorbefuellen.
  useEffect(() => {
    if (!data || gramsById !== null) return;
    const initial: Record<string, number> = {};
    for (const c of topLevelComponents) initial[c.id] = c.serving_grams ?? 0;
    setGramsById(initial);
  }, [data]);

  const gramsMap = useMemo(() => new Map(Object.entries(gramsById ?? {})), [gramsById]);

  const total = useMemo(() => {
    if (!data) return null;
    return calculateAdjustedServingNutrition(
      data.components,
      data.items,
      data.productsById,
      gramsMap,
    );
  }, [data, gramsMap]);

  function updateGrams(componentId: string, raw: string) {
    const value = raw.trim() === '' ? 0 : Number(raw.replace(',', '.'));
    if (Number.isNaN(value) || value < 0) return;
    setGramsById((prev) => ({ ...(prev ?? {}), [componentId]: value }));
  }

  function handleSubmit() {
    if (!data || !total) return;
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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Zurück">
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M15 18l-6-6 6-6"
              stroke="#FF5262"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Ins Tagebuch loggen
        </Text>
        <View style={styles.headerIconButton} />
      </View>

      {isLoading || !data ? (
        <Text style={styles.loadingText}>Lädt…</Text>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.recipeTitle}>{data.recipe.title}</Text>

          <Text style={styles.sectionLabel}>Mahlzeit</Text>
          <View style={styles.mealRow}>
            {MEAL_ORDER.map((meal) => {
              const isActive = meal === mealType;
              return (
                <Pressable
                  key={meal}
                  style={[
                    styles.mealPill,
                    isActive ? styles.mealPillActive : styles.mealPillInactive,
                  ]}
                  onPress={() => setMealType(meal)}>
                  <Text
                    style={[
                      styles.mealText,
                      isActive ? styles.mealTextActive : styles.mealTextInactive,
                    ]}>
                    {MEAL_LABELS[meal]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Portionsmengen</Text>
          {topLevelComponents.length === 0 ? (
            <Text style={styles.emptyText}>Dieses Rezept hat noch keine Komponenten.</Text>
          ) : (
            <View style={styles.componentList}>
              {topLevelComponents.map((component) => (
                <View key={component.id} style={styles.componentRow}>
                  <Text style={styles.componentName}>{component.name}</Text>
                  <View style={styles.gramsField}>
                    <TextInput
                      style={styles.gramsInput}
                      keyboardType="numeric"
                      value={String(gramsById?.[component.id] ?? component.serving_grams ?? 0)}
                      onChangeText={(v) => updateGrams(component.id, v)}
                      accessibilityLabel={`Grammmenge für ${component.name}`}
                    />
                    <Text style={styles.gramsUnit}>g</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {total ? (
            <View style={styles.totalsCard}>
              <Text style={styles.totalsKcal}>{round(total.kcal)} kcal</Text>
              <Text style={styles.totalsMacros}>
                {round(total.protein_g)} g Protein · {round(total.carbs_g)} g Kohlenhydrate ·{' '}
                {round(total.fat_g)} g Fett
              </Text>
            </View>
          ) : null}

          <Pressable
            style={styles.submitButton}
            onPress={handleSubmit}
            accessibilityRole="button"
            accessibilityLabel="Ins Tagebuch übernehmen">
            <Text style={styles.submitButtonText}>Ins Tagebuch übernehmen</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFDF9',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#665555',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 10,
  },
  headerIconButton: {
    width: 24,
    padding: 6,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: '#FF5262',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 4,
  },
  recipeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#332222',
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF5262',
    marginBottom: 10,
    marginTop: 12,
  },
  emptyText: {
    color: '#665555',
    fontSize: 14,
  },
  mealRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mealPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
  },
  mealPillActive: {
    backgroundColor: '#FF5262',
  },
  mealPillInactive: {
    backgroundColor: '#FFE2E2',
  },
  mealText: {
    fontSize: 14,
    fontWeight: '600',
  },
  mealTextActive: {
    color: '#FFFFFF',
  },
  mealTextInactive: {
    color: '#FF5262',
  },
  componentList: {
    gap: 10,
  },
  componentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  componentName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#332222',
  },
  gramsField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gramsInput: {
    width: 60,
    textAlign: 'right',
    fontSize: 15,
    color: '#332222',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE2E2',
    paddingVertical: 2,
  },
  gramsUnit: {
    fontSize: 14,
    color: '#665555',
  },
  totalsCard: {
    backgroundColor: '#FFE2E2',
    borderRadius: 18,
    padding: 16,
    marginTop: 20,
    gap: 4,
  },
  totalsKcal: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF5262',
  },
  totalsMacros: {
    fontSize: 13,
    color: '#665555',
  },
  submitButton: {
    backgroundColor: '#FF5262',
    borderRadius: 22,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
