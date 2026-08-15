import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/buttons';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { presentPaywallIfNeeded } from '@/features/premium/paywall';
import { usePremium } from '@/features/premium/premium-provider';
import { useAddShoppingItem } from '@/features/shopping-list/use-shopping-list-mutations';
import { useTheme } from '@/hooks/use-theme';
import { type MissingIngredientView, useMealPlanShoppingNeeds } from './use-shopping-needs';

// Stabile Referenz statt Inline-`= []`: `EMPTY_MISSING` bleibt beim naechsten
// Render dieselbe Array-Instanz. Ein Inline-Default legt bei jedem Render
// ein neues Array an — der useEffect unten haengt an `[missing]`, das waere
// dieselbe Endlosschleife wie in recipe-shopping-sheet.tsx (siehe dortigen
// Fix): setSelected -> Re-Render -> neues [] -> Effekt feuert erneut.
const EMPTY_MISSING: MissingIngredientView[] = [];

/**
 * Kuratierte Uebernahme fehlender Zutaten in die Einkaufsliste (#131),
 * Premium-Feature — dieselbe Funktion wie "Fehlendes direkt einkaufen" aus
 * `recipe-shopping-sheet.tsx`, hier fuer den ganzen Wochenplan statt ein
 * einzelnes Rezept. Ohne Zugriff zeigt der Screen einen Hinweis samt Button
 * zur echten RevenueCat-Paywall statt der Liste.
 *
 * Standard-Fluss (mit Zugriff): alle berechneten fehlenden Zutaten sind
 * vorausgewaehlt, der Nutzer kann einzelne abwaehlen, bevor er uebernimmt —
 * kein Ein-Klick-ohne-Rueckfrage-Automatismus (das ist #132, ausserhalb des
 * Scopes hier). Artikel mit Kaufhistorie zeigen den zuletzt verwendeten
 * Markt als Badge; Artikel ohne Historie zeigen keinen Badge und brauchen
 * keine gesonderte Auswahl, weil es nichts zum Auswaehlen gibt.
 */
export function MissingIngredientsScreen() {
  const { mealPlanId } = useLocalSearchParams<{ mealPlanId: string }>();
  const { session } = useSession();
  const { activeHouseholdId } = useActiveHousehold();
  const householdId = activeHouseholdId ?? undefined;
  const { isPremium } = usePremium();
  const [unlocking, setUnlocking] = useState(false);

  const { data: missing = EMPTY_MISSING, isLoading } = useMealPlanShoppingNeeds(
    mealPlanId,
    householdId,
    isPremium,
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const addShoppingItem = useAddShoppingItem();
  const [addedCount, setAddedCount] = useState<number | null>(null);

  useEffect(() => {
    setSelected(new Set(missing.map((m) => m.productId)));
  }, [missing]);

  function toggle(productId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  async function handleAddSelected() {
    if (!householdId) return;
    const toAdd = missing.filter((m) => selected.has(m.productId));
    for (const item of toAdd) {
      await addShoppingItem.mutateAsync({
        household_id: householdId,
        name: item.name,
        quantity: item.missingGrams,
        unit: 'g',
        product_id: item.productId,
        store_id: item.preferredStoreId,
        recipe_names: item.recipeNames,
      });
    }
    setAddedCount(toAdd.length);
  }

  async function unlockPremium() {
    setUnlocking(true);
    try {
      const outcome = await presentPaywallIfNeeded();
      if (outcome === 'unavailable') {
        Alert.alert(
          'Premium nicht verfügbar',
          'Die Premium-Paywall ist auf diesem Gerät nicht konfiguriert.',
        );
      }
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <Screen
      title="Fehlende Zutaten"
      subtitle="Bedarf dieser Woche minus Vorrat"
      back={{ label: 'Wochenplan' }}>
      {!isPremium ? (
        <View style={styles.list}>
          <ThemedText themeColor="textSecondary">
            fam vergleicht den Bedarf des ganzen Wochenplans mit eurem Vorrat und übernimmt nur
            Fehlendes in die Einkaufsliste.
          </ThemedText>
          <Button label="Premium ansehen" onPress={unlockPremium} loading={unlocking} />
        </View>
      ) : isLoading ? (
        <ActivityIndicator style={styles.loading} />
      ) : missing.length === 0 ? (
        <ThemedText themeColor="textSecondary">
          Für die geplanten Rezepte fehlt nichts – der Vorrat reicht.
        </ThemedText>
      ) : (
        <View style={styles.list}>
          {missing.map((item) => (
            <IngredientRow
              key={item.productId}
              item={item}
              selected={selected.has(item.productId)}
              onToggle={() => toggle(item.productId)}
            />
          ))}

          <Button
            label={`${selected.size} Artikel zur Einkaufsliste hinzufügen`}
            onPress={handleAddSelected}
            disabled={selected.size === 0 || addShoppingItem.isPending || !session}
            loading={addShoppingItem.isPending}
          />

          {addedCount !== null ? (
            <ThemedText type="small" themeColor="accent">
              {addedCount} Artikel zur Einkaufsliste hinzugefügt.
            </ThemedText>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

function IngredientRow({
  item,
  selected,
  onToggle,
}: {
  item: MissingIngredientView;
  selected: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={item.name}
      onPress={onToggle}
      style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <View
        style={[
          styles.checkbox,
          { borderColor: theme.accent, backgroundColor: selected ? theme.accent : 'transparent' },
        ]}>
        {selected ? <ThemedText style={{ color: '#ffffff' }}>✓</ThemedText> : null}
      </View>
      <View style={styles.rowText}>
        <ThemedText type="smallBold">{item.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {item.missingGrams} g fehlen
          {item.preferredStoreName ? ` · zuletzt bei ${item.preferredStoreName}` : ''}
        </ThemedText>
        {item.recipeNames.length > 0 ? (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            🍽️ {item.recipeNames.join(', ')}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: Spacing.five },
  list: { gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
});
