import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Screen } from '@/components/layout/screen';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, Press, Surface, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { usePremium } from '@/features/premium/premium-provider';
import { useAddShoppingItem } from '@/features/shopping-list/hooks/use-shopping-list-mutations';
import { resolveCategoryForItem } from '@/features/shopping-list/preferences/api';
import { debugLogEvent } from '@/lib/observability/debug-log';
import { type MissingIngredientView, useMealPlanShoppingNeeds } from './use-shopping-needs';

debugLogEvent('meal-planner.missing-ingredients-screen.module-loaded', { variant: 'android' });

// Stabile Referenz statt Inline-`= []`: `EMPTY_MISSING` bleibt beim naechsten
// Render dieselbe Array-Instanz. Ein Inline-Default legt bei jedem Render
// ein neues Array an — der useEffect unten haengt an `[missing]`, das waere
// dieselbe Endlosschleife wie in recipe-shopping-sheet.tsx (siehe dortigen
// Fix): setSelected -> Re-Render -> neues [] -> Effekt feuert erneut.
const EMPTY_MISSING: MissingIngredientView[] = [];

// Die 24px-Checkbox und die 2px-Zeilenluft sind bestehende lokale Geometrie.
// Semantische Flächen, Farben, Konturen und Abstände kommen aus den Theme-/UI-
// Verantwortlichen; Press-Wrapper erhalten ihre Layoutgröße über containerStyle.
const styles = StyleSheet.create((theme) => ({
  list: {
    gap: theme.space.sm,
  },
  loading: {
    marginTop: theme.space.xxl + theme.space.xs,
  },
  errorState: {
    alignItems: 'center',
    gap: theme.space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
    padding: theme.space.sm,
    borderRadius: theme.radius.sm,
  },
  rowToggleContainer: {
    flex: 1,
  },
  rowToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.sm,
  },
  checkbox: {
    width: theme.space.xl + theme.space.xs,
    height: theme.space.xl + theme.space.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: theme.borderWidth.strong,
    borderColor: theme.accent,
    borderRadius: theme.radius.sm,
  },
  checkboxSelected: {
    backgroundColor: theme.accent,
  },
  checkboxIdle: {
    backgroundColor: 'transparent',
  },
  rowText: {
    flex: 1,
    gap: theme.space.xs / 2,
  },
}));

export function MissingIngredientsScreen() {
  const { colors } = useTheme();
  const { mealPlanId } = useLocalSearchParams<{ mealPlanId: string }>();
  const { session } = useSession();
  const { activeHouseholdId } = useActiveHousehold();
  const householdId = activeHouseholdId ?? undefined;
  const { hasPlus } = usePremium();

  const {
    data: missing,
    isLoading,
    isError,
    refetch,
  } = useMealPlanShoppingNeeds(mealPlanId, householdId, hasPlus);
  const displayedMissing = missing ?? EMPTY_MISSING;
  const hasLoadedMissing = missing !== undefined;
  const errorState = isError ? (
    <View style={styles.errorState}>
      <Txt variant="body" tone="danger" accessibilityRole="alert">
        {hasLoadedMissing
          ? 'Fehlende Zutaten konnten nicht aktualisiert werden.'
          : 'Fehlende Zutaten konnten nicht geladen werden.'}
      </Txt>
      <Button
        title="Erneut versuchen"
        variant="secondary"
        size="sm"
        onPress={() => void refetch()}
      />
    </View>
  ) : null;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const addShoppingItem = useAddShoppingItem();
  const [addedCount, setAddedCount] = useState<number | null>(null);

  useEffect(() => {
    setSelected(
      new Set(displayedMissing.filter((m) => m.missingGrams > 0).map((m) => m.productId)),
    );
  }, [displayedMissing]);

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

    const toAdd = displayedMissing.filter((m) => selected.has(m.productId));
    debugLogEvent('meal-planner.shopping-needs.transfer.started', {
      variant: 'android',
      missingCount: displayedMissing.length,
      selectedCount: toAdd.length,
    });

    for (const item of toAdd) {
      const quantity = item.missingGrams > 0 ? item.missingGrams : item.neededGrams;
      debugLogEvent('meal-planner.shopping-needs.transfer.item.started', {
        variant: 'android',
        productId: item.productId,
        name: item.name,
        quantity,
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
          quantity,
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
        <View style={styles.list}>
          <Txt variant="body" tone="secondary">
            fam vergleicht den Bedarf des ganzen Wochenplans mit eurem Vorrat und übernimmt nur
            Fehlendes in die Einkaufsliste.
          </Txt>
          <Button title="Plus ansehen" onPress={openPlusPaywall} />
        </View>
      ) : isLoading ? (
        /* Ladeindikator beim Berechnen der Vorratsabgleiche */
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : !hasLoadedMissing && isError ? (
        errorState
      ) : displayedMissing.length === 0 ? (
        /* Statusanzeige wenn alle Zutaten im Vorrat vorhanden sind */
        <View style={styles.list}>
          {errorState}
          <Txt variant="body" tone="secondary">
            Für die geplanten Rezepte fehlt nichts – der Vorrat reicht.
          </Txt>
        </View>
      ) : (
        /* Auswahlliste aller fehlenden Zutaten mit Mengenangaben und Übertrags-Button */
        <View style={styles.list}>
          {errorState}
          {displayedMissing.map((item) => (
            <IngredientRow
              key={item.productId}
              item={item}
              selected={selected.has(item.productId)}
              onToggle={() => toggle(item.productId)}
            />
          ))}

          {/* Button zum Hinzufügen der ausgewählten Zutaten auf die Einkaufsliste */}
          <Button
            title={`${selected.size} Artikel zur Einkaufsliste hinzufügen`}
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
  return (
    <Surface tone="surface" style={styles.row}>
      <Press
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={item.name}
        onPress={onToggle}
        haptic="selection"
        containerStyle={styles.rowToggleContainer}
        style={styles.rowToggle}>
        <View style={[styles.checkbox, selected ? styles.checkboxSelected : styles.checkboxIdle]}>
          {selected ? <Txt tone="onAccent">✓</Txt> : null}
        </View>
        <View style={styles.rowText}>
          <Txt variant="body" weight="700">
            {item.name}
          </Txt>
          {item.missingGrams > 0 ? (
            <Txt variant="body" tone="secondary">
              {item.missingGrams} g fehlen
              {item.preferredStoreName ? ` · zuletzt bei ${item.preferredStoreName}` : ''}
            </Txt>
          ) : (
            <Txt variant="body" tone="secondary">
              {item.neededGrams} g benötigt / {item.availableGrams} g im Vorrat
              {item.preferredStoreName ? ` · zuletzt bei ${item.preferredStoreName}` : ''}
            </Txt>
          )}
          {item.recipeNames.length > 0 ? (
            <Txt variant="body" tone="secondary" numberOfLines={1}>
              🍽️ {item.recipeNames.join(', ')}
            </Txt>
          ) : null}
        </View>
      </Press>
    </Surface>
  );
}
