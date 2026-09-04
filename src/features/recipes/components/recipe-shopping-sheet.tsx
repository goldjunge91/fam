import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';

import { useTheme } from '@/components/theme/ThemeProvider';
import { Txt } from '@/constants/ui';
import { usePremium } from '@/features/premium/premium-provider';
import { RowStorePicker } from '@/features/shopping-list/components/ui/row-store-picker';
import { useAddShoppingItem } from '@/features/shopping-list/hooks/use-shopping-list-mutations';
import { resolveCategoryForItem } from '@/features/shopping-list/preferences/api';
import { type RecipeShoppingNeed, useRecipeShoppingNeeds } from '../data/use-recipe-shopping-needs';
import type { RecipeDetail } from '../hooks/use-recipes';
import { RecipeBottomSheet } from './recipe-bottom-sheet';

type Props = {
  visible: boolean;
  detail: RecipeDetail;
  servings: number;
  onClose: () => void;
};

// Stabile Referenz statt Inline-`= []`: `data` ist `undefined`, solange die
// Query deaktiviert ist (kein Premium-Zugriff) — ein Inline-Default legt bei
// jedem Render ein neues Array an, das `useEffect`-Dependency unten wuerde
// das als Aenderung sehen und in eine Endlosschleife aus setState laufen.
const EMPTY_MISSING: RecipeShoppingNeed[] = [];

export function RecipeShoppingSheet({ visible, detail, servings, onClose }: Props) {
  const { colors } = useTheme();
  const { hasPlus } = usePremium();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Marktzuweisung pro Zeile, vom Nutzer manuell ueberschrieben (Fallback:
  // item.preferredStoreId aus der Kaufhistorie) — gespiegelt zu
  // missing-ingredients-screen.tsx (#131-Nachschaerfung).
  const [storeOverrides, setStoreOverrides] = useState<Record<string, string | null>>({});
  // Eigener Sperrzustand statt addShoppingItem.isPending: die Mutation wird
  // im Loop pro Zutat einzeln aufgerufen, isPending flackert dazwischen
  // wieder auf false — der Button muss ueber die gesamte Uebertragsdauer
  // gesperrt bleiben (gespiegelt zu missing-ingredients-screen.tsx).
  const [isSubmitting, setIsSubmitting] = useState(false);
  const addShoppingItem = useAddShoppingItem();
  const { data: missing = EMPTY_MISSING, isLoading } = useRecipeShoppingNeeds(
    detail,
    servings,
    visible && hasPlus,
  );

  useEffect(() => {
    // Nur Zutaten mit echtem Fehlbetrag vorauswaehlen — bereits gedeckte
    // Zutaten (Nachschub-Fall) bleiben sichtbar, aber abgewaehlt.
    setSelected(
      new Set(missing.filter((item) => item.missingGrams > 0).map((item) => item.productId)),
    );
  }, [missing]);

  function storeIdFor(item: RecipeShoppingNeed): string | null {
    return item.productId in storeOverrides
      ? storeOverrides[item.productId]
      : item.preferredStoreId;
  }

  function openPlusPaywall() {
    router.push({ pathname: '/settings/plus-and-ai', params: { tier: 'plus' } });
  }

  function toggle(productId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  async function addSelected() {
    const selectedItems = missing.filter((item) => selected.has(item.productId));
    setIsSubmitting(true);
    try {
      for (const item of selectedItems) {
        // Alle Erzeugungswege nutzen den Resolver (#223 Abschnitt 10) — hier
        // ohne `categoryTags`, da diese Zutaten nur als Produkt-Id/Name
        // bekannt sind, nicht als vollstaendiges OFF-Produkt.
        const classification = await resolveCategoryForItem({
          householdId: detail.recipe.household_id,
          productId: item.productId,
          name: item.name,
        });
        await addShoppingItem.mutateAsync({
          household_id: detail.recipe.household_id,
          product_id: item.productId,
          name: item.name,
          // Bei bereits gedecktem Bedarf (missingGrams <= 0) gibt es kein
          // sinnvolles Delta zu uebertragen — dann zaehlt die volle
          // benoetigte Menge (Nachschub-Fall).
          quantity: item.missingGrams > 0 ? item.missingGrams : item.neededGrams,
          unit: 'g',
          category_id: classification.categoryId,
          category_source: classification.source,
          category_classifier_version: classification.classifierVersion,
          store_id: storeIdFor(item),
          recipe_names: [detail.recipe.title],
        });
      }
      onClose();
      Alert.alert(
        'Einkaufsliste aktualisiert',
        `${selectedItems.length} ${selectedItems.length === 1 ? 'Zutat wurde' : 'Zutaten wurden'} ergänzt.`,
      );
    } catch (error) {
      Alert.alert(
        'Übernahme fehlgeschlagen',
        error instanceof Error ? error.message : 'Die Zutaten konnten nicht übernommen werden.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <RecipeBottomSheet
      visible={visible}
      onClose={onClose}
      title={hasPlus ? 'Fehlende Zutaten' : 'Mit Plus einkaufen'}
      sheetClassName="max-h-[82%]">
      {!hasPlus ? (
        <>
          <Txt variant="caption" tone="secondary" style={{ lineHeight: 15, fontWeight: '500' }}>
            fam vergleicht die Rezeptzutaten mit deinem Vorrat und übernimmt nur Fehlendes in die
            Einkaufsliste.
          </Txt>
          <SheetButton label="Plus ansehen" onPress={openPlusPaywall} />
        </>
      ) : isLoading ? (
        <ActivityIndicator className="h-[76px]" color={colors.basil} />
      ) : missing.length === 0 ? (
        <>
          <Txt variant="caption" tone="secondary" style={{ lineHeight: 15, fontWeight: '500' }}>
            Dein Vorrat deckt alle Zutaten für {servings} {servings === 1 ? 'Portion' : 'Portionen'}{' '}
            ab.
          </Txt>
          <SheetButton label="Schließen" onPress={onClose} />
        </>
      ) : (
        <>
          <Txt variant="caption" tone="secondary" style={{ lineHeight: 15, fontWeight: '500' }}>
            Bereits vorhandene Mengen wurden abgezogen. Wähle aus, was auf die Einkaufsliste soll.
          </Txt>
          {/* Bulk-Aktion: allen Zutaten auf einen Schlag denselben Markt zuweisen (#342) */}
          <View className="mt-[10px] flex-row justify-end">
            <RowStorePicker
              householdId={detail.recipe.household_id}
              storeId={null}
              label="Allen einen Markt zuweisen"
              onChange={(storeId) =>
                setStoreOverrides(
                  Object.fromEntries(missing.map((item) => [item.productId, storeId])),
                )
              }
              testID="recipe-bulk-store-picker"
            />
          </View>
          <View
            className="mt-[14px] rounded-sheet overflow-hidden"
            style={{ backgroundColor: colors.surfaceSoft }}>
            {missing.map((item, index) => {
              const checked = selected.has(item.productId);
              return (
                <View
                  key={item.productId}
                  className="min-h-[45px] px-three flex-row items-center gap-[10px]"
                  style={
                    index < missing.length - 1
                      ? { borderBottomColor: colors.border, borderBottomWidth: 1 }
                      : undefined
                  }>
                  <Pressable
                    onPress={() => toggle(item.productId)}
                    role="checkbox"
                    accessibilityState={{ checked }}
                    accessibilityLabel={item.name}
                    className="flex-1 flex-row items-center gap-[10px]">
                    <View
                      className="w-[22px] h-[22px] rounded-fam-sm items-center justify-center"
                      style={{
                        backgroundColor: checked ? colors.basil : 'transparent',
                        borderColor: colors.basil,
                        borderWidth: 1.5,
                      }}>
                      {checked ? (
                        <Txt
                          variant="caption"
                          tone="onAccent"
                          weight="700"
                          style={{ fontSize: 12, lineHeight: 14 }}>
                          ✓
                        </Txt>
                      ) : null}
                    </View>
                    <Txt
                      variant="body"
                      weight="700"
                      className="flex-1"
                      style={{ fontSize: 13, lineHeight: 18 }}
                      numberOfLines={1}>
                      {item.name}
                    </Txt>
                    <Txt
                      variant="caption"
                      tone="secondary"
                      style={{ fontSize: 9, lineHeight: 11, fontWeight: '500' }}>
                      {item.missingGrams > 0
                        ? `${item.missingGrams} g`
                        : `${item.neededGrams}g / ${item.availableGrams}g`}
                    </Txt>
                  </Pressable>
                  <RowStorePicker
                    householdId={detail.recipe.household_id}
                    storeId={storeIdFor(item)}
                    onChange={(storeId) =>
                      setStoreOverrides((prev) => ({ ...prev, [item.productId]: storeId }))
                    }
                    testID={`recipe-row-store-picker-${item.productId}`}
                  />
                </View>
              );
            })}
          </View>
          <SheetButton
            label={`${selected.size} ${selected.size === 1 ? 'Zutat' : 'Zutaten'} übernehmen`}
            loading={isSubmitting}
            disabled={selected.size === 0 || isSubmitting}
            onPress={addSelected}
          />
        </>
      )}
    </RecipeBottomSheet>
  );
}

function SheetButton({
  label,
  onPress,
  loading = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      role="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      className="h-12 mt-[14px] rounded-card items-center justify-center px-[14px] active:opacity-75"
      style={{
        backgroundColor: colors.basil,
        opacity: disabled || loading ? 0.45 : 1,
      }}>
      {loading ? (
        <ActivityIndicator color={colors.inverse} />
      ) : (
        <Txt variant="caption" tone="onAccent" weight="700">
          {label}
        </Txt>
      )}
    </Pressable>
  );
}
