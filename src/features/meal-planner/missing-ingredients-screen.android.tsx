import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Screen } from '@/components/layout/screen';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button } from '@/components/ui/buttons';
import { Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { usePremium } from '@/features/premium/premium-provider';
import { useAddShoppingItem } from '@/features/shopping-list/hooks/use-shopping-list-mutations';
import { resolveCategoryForItem } from '@/features/shopping-list/preferences/api';
import { debugLogEvent } from '@/lib/debug-log';
import { type MissingIngredientView, useMealPlanShoppingNeeds } from './use-shopping-needs';

debugLogEvent('meal-planner.missing-ingredients-screen.module-loaded', { variant: 'android' });

// Stabile Referenz statt Inline-`= []`: `EMPTY_MISSING` bleibt beim naechsten
// Render dieselbe Array-Instanz. Ein Inline-Default legt bei jedem Render
// ein neues Array an — der useEffect unten haengt an `[missing]`, das waere
// dieselbe Endlosschleife wie in recipe-shopping-sheet.tsx (siehe dortigen
// Fix): setSelected -> Re-Render -> neues [] -> Effekt feuert erneut.
const EMPTY_MISSING: MissingIngredientView[] = [];

export function MissingIngredientsScreen() {
  const { colors } = useTheme();
  const { mealPlanId } = useLocalSearchParams<{ mealPlanId: string }>();
  const { session } = useSession();
  const { activeHouseholdId } = useActiveHousehold();
  const householdId = activeHouseholdId ?? undefined;
  const { hasPlus } = usePremium();

  const { data: missing = EMPTY_MISSING, isLoading } = useMealPlanShoppingNeeds(
    mealPlanId,
    householdId,
    hasPlus,
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
    if (!householdId) {
      debugLogEvent('meal-planner.shopping-needs.transfer.skipped', {
        variant: 'android',
        reason: 'missing-household-id',
      });
      return;
    }

    const toAdd = missing.filter((m) => selected.has(m.productId));
    debugLogEvent('meal-planner.shopping-needs.transfer.started', {
      variant: 'android',
      missingCount: missing.length,
      selectedCount: toAdd.length,
    });

    for (const item of toAdd) {
      debugLogEvent('meal-planner.shopping-needs.transfer.item.started', {
        variant: 'android',
        productId: item.productId,
        name: item.name,
        quantity: item.missingGrams,
      });

      try {
        // Alle Erzeugungswege nutzen den Resolver (#223 Abschnitt 10) — hier
        // ohne `categoryTags`, da diese Zutaten nur als Produkt-Id/Name
        // bekannt sind, nicht als vollstaendiges OFF-Produkt.
        let classification: Awaited<ReturnType<typeof resolveCategoryForItem>> | null = null;
        try {
          classification = await resolveCategoryForItem({
            householdId,
            productId: item.productId,
            name: item.name,
            storeId: item.preferredStoreId,
          });
          debugLogEvent('meal-planner.shopping-needs.transfer.item.classified', {
            variant: 'android',
            productId: item.productId,
            categoryId: classification.categoryId,
            categorySource: classification.source,
          });
        } catch (error) {
          // Die Kategorisierung ist eine Anreicherung. Ein Fehler hier darf
          // den eigentlichen local-first-Transfer nicht verhindern.
          debugLogEvent('meal-planner.shopping-needs.transfer.item.classification-fallback', {
            variant: 'android',
            productId: item.productId,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        const entityId = await addShoppingItem.mutateAsync({
          household_id: householdId,
          name: item.name,
          quantity: item.missingGrams,
          unit: 'g',
          product_id: item.productId,
          category_id: classification?.categoryId ?? null,
          category_source: classification?.source ?? null,
          category_classifier_version: classification?.classifierVersion ?? null,
          store_id: item.preferredStoreId,
          recipe_names: item.recipeNames,
        });
        debugLogEvent('meal-planner.shopping-needs.transfer.item.completed', {
          variant: 'android',
          productId: item.productId,
          entityId,
        });
      } catch (error) {
        debugLogEvent('meal-planner.shopping-needs.transfer.item.failed', {
          variant: 'android',
          productId: item.productId,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    setAddedCount(toAdd.length);
    debugLogEvent('meal-planner.shopping-needs.transfer.completed', {
      variant: 'android',
      addedCount: toAdd.length,
    });
  }

  function openPlusPaywall() {
    router.push({ pathname: '/settings/plus-and-ai', params: { tier: 'plus' } });
  }

  return (
    <Screen
      title="Fehlende Zutaten"
      subtitle="Bedarf dieser Woche minus Vorrat"
      back={{ label: 'Wochenplan' }}>
      {/* Paywall-Hinweis falls kein aktives Plus-Abo vorhanden ist */}
      {!hasPlus ? (
        <View className="mis-list">
          <Txt variant="body" tone="secondary">
            fam vergleicht den Bedarf des ganzen Wochenplans mit eurem Vorrat und übernimmt nur
            Fehlendes in die Einkaufsliste.
          </Txt>
          <Button label="Plus ansehen" onPress={openPlusPaywall} />
        </View>
      ) : isLoading ? (
        /* Ladeindikator beim Berechnen der Vorratsabgleiche */
        <View className="mis-loading">
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : missing.length === 0 ? (
        /* Statusanzeige wenn alle Zutaten im Vorrat vorhanden sind */
        <Txt variant="body" tone="secondary">
          Für die geplanten Rezepte fehlt nichts – der Vorrat reicht.
        </Txt>
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
            <Txt variant="body" tone="success">
              {addedCount} Artikel zur Einkaufsliste hinzugefügt.
            </Txt>
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
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={item.name}
      onPress={onToggle}
      className="mis-row">
      <View
        className="mis-checkbox"
        style={{ backgroundColor: selected ? colors.basil : 'transparent' }}>
        {selected ? <Txt tone="onAccent">✓</Txt> : null}
      </View>
      <View className="mis-row-text">
        <Txt variant="body" weight="700">
          {item.name}
        </Txt>
        <Txt variant="body" tone="secondary">
          {item.missingGrams} g fehlen
          {item.preferredStoreName ? ` · zuletzt bei ${item.preferredStoreName}` : ''}
        </Txt>
        {item.recipeNames.length > 0 ? (
          <Txt variant="body" tone="secondary" numberOfLines={1}>
            🍽️ {item.recipeNames.join(', ')}
          </Txt>
        ) : null}
      </View>
    </Pressable>
  );
}
