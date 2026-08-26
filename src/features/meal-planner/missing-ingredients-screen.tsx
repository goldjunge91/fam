import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { presentPaywallIfNeeded } from '@/features/premium/paywall';
import { usePremium } from '@/features/premium/premium-provider';
import { useAddShoppingItem } from '@/features/shopping-list/hooks/use-shopping-list-mutations';
import { resolveCategoryForItem } from '@/features/shopping-list/preferences/api';
import { type MissingIngredientView, useMealPlanShoppingNeeds } from './use-shopping-needs';

// Stabile Referenz statt Inline-`= []`: `EMPTY_MISSING` bleibt beim naechsten
// Render dieselbe Array-Instanz. Ein Inline-Default legt bei jedem Render
// ein neues Array an — der useEffect unten haengt an `[missing]`, das waere
// dieselbe Endlosschleife wie in recipe-shopping-sheet.tsx (siehe dortigen
// Fix): setSelected -> Re-Render -> neues [] -> Effekt feuert erneut.
const EMPTY_MISSING: MissingIngredientView[] = [];

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
      // Alle Erzeugungswege nutzen den Resolver (#223 Abschnitt 10) — hier
      // ohne `categoryTags`, da diese Zutaten nur als Produkt-Id/Name
      // bekannt sind, nicht als vollstaendiges OFF-Produkt.
      const classification = await resolveCategoryForItem({
        householdId,
        productId: item.productId,
        name: item.name,
      });
      await addShoppingItem.mutateAsync({
        household_id: householdId,
        name: item.name,
        quantity: item.missingGrams,
        unit: 'g',
        product_id: item.productId,
        category_id: classification.categoryId,
        category_source: classification.source,
        category_classifier_version: classification.classifierVersion,
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
      {/* Paywall-Hinweis falls kein aktives Premium-Abo vorhanden ist */}
      {!isPremium ? (
        <View className="mis-list">
          <ThemedText themeColor="textSecondary">
            fam vergleicht den Bedarf des ganzen Wochenplans mit eurem Vorrat und übernimmt nur
            Fehlendes in die Einkaufsliste.
          </ThemedText>
          <Button label="Premium ansehen" onPress={unlockPremium} loading={unlocking} />
        </View>
      ) : isLoading ? (
        /* Ladeindikator beim Berechnen der Vorratsabgleiche */
        <ActivityIndicator className="mis-loading" />
      ) : missing.length === 0 ? (
        /* Statusanzeige wenn alle Zutaten im Vorrat vorhanden sind */
        <ThemedText themeColor="textSecondary">
          Für die geplanten Rezepte fehlt nichts – der Vorrat reicht.
        </ThemedText>
      ) : (
        /* Auswahlliste aller fehlenden Zutaten mit Mengenangaben und Übertrags-Button */
        <View className="mis-list">
          {missing.map((item) => (
            <IngredientRow
              key={item.productId}
              item={item}
              selected={selected.has(item.productId)}
              onToggle={() => toggle(item.productId)}
            />
          ))}

          {/* Button zum Hinzufügen der ausgewählten Zutaten auf die Einkaufsliste */}
          <Button
            label={`${selected.size} Artikel zur Einkaufsliste hinzufügen`}
            onPress={handleAddSelected}
            disabled={selected.size === 0 || addShoppingItem.isPending || !session}
            loading={addShoppingItem.isPending}
          />

          {/* Erfolgs-Bestätigung nach Übertrag */}
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
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={item.name}
      onPress={onToggle}
      className="mis-row">
      <View className={`mis-checkbox ${selected ? 'bg-accent' : 'bg-transparent'}`}>
        {selected ? <ThemedText themeColor="onAccent">✓</ThemedText> : null}
      </View>
      <View className="mis-row-text">
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
