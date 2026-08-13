import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useRecipeDetail } from './use-recipes';

/**
 * Kochmodus-Basis-Screen (#133, kostenlose Stufe).
 *
 * Bewusst nur Lesen: Zutatenliste + Basis-Rezepttext/-Anleitung, KEIN
 * interaktiver Schritt-fuer-Schritt-Ablauf und KEIN Timer — beides ist Paid
 * (#134/#135, siehe docs/plans/phase-2-4-brainstorm.md, Abschnitt "#19 —
 * Kochmodus"). Zutaten kommen direkt aus den flachen
 * `recipe_component_items`-Zeilen mit `product_id` — jede Basis-Zutat des
 * Rezepts liegt dort bereits unabhaengig davon, wie tief sie in der
 * Komponenten-Hierarchie steckt, eine Rekursion wie in nutrition.ts ist fuer
 * eine reine Auflistung nicht noetig.
 */
export function CookingModeScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useRecipeDetail(id);

  if (isLoading || !data) {
    return (
      <Screen title="Kochmodus" back={{ label: 'Rezept' }}>
        <ActivityIndicator style={styles.loading} />
      </Screen>
    );
  }

  const { recipe, items, steps, productsById } = data;
  const ingredients = items.filter((item) => item.product_id !== null);

  return (
    <Screen title="Kochmodus" subtitle={recipe.title} back={{ label: 'Rezept' }}>
      <View style={styles.section}>
        <ThemedText type="subtitle">Zutaten</ThemedText>
        {ingredients.length === 0 ? (
          <ThemedText themeColor="textSecondary">Keine Zutaten hinterlegt.</ThemedText>
        ) : (
          <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            {ingredients.map((item) => {
              const product = item.product_id ? productsById.get(item.product_id) : undefined;
              return (
                <View key={item.id} style={styles.ingredientRow}>
                  <ThemedText>{product?.name ?? 'Zutat'}</ThemedText>
                  <ThemedText themeColor="textSecondary">
                    {item.quantity ?? item.grams} {item.quantity ? item.unit : 'g'}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <ThemedText type="subtitle">Zubereitung</ThemedText>
        {recipe.instructions ? (
          <ThemedText style={styles.instructions}>{recipe.instructions}</ThemedText>
        ) : null}
        {steps.length === 0 ? (
          recipe.instructions ? null : (
            <ThemedText themeColor="textSecondary">Keine Anleitung hinterlegt.</ThemedText>
          )
        ) : (
          <View style={styles.stepsList}>
            {steps.map((step) => (
              <View key={step.id} style={styles.stepRow}>
                <ThemedText type="smallBold" themeColor="accent">
                  {step.position + 1}.
                </ThemedText>
                <ThemedText style={styles.stepText}>{step.text}</ThemedText>
              </View>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: Spacing.five },
  section: { gap: Spacing.two },
  card: { borderRadius: 12, padding: Spacing.three, gap: Spacing.two },
  ingredientRow: { flexDirection: 'row', justifyContent: 'space-between' },
  instructions: { lineHeight: 22 },
  stepsList: { gap: Spacing.three },
  stepRow: { flexDirection: 'row', gap: Spacing.two },
  stepText: { flex: 1, lineHeight: 22 },
});
