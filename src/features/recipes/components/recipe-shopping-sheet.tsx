import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { rs } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Button, Press, Txt } from '@/constants/ui';
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

const styles = StyleSheet.create((theme) => ({
  sheet: {
    maxHeight: '82%',
  },
  bulkRow: {
    marginTop: theme.space.md,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  missingList: {
    marginTop: theme.space.lg,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
  },
  itemRow: {
    minHeight: rs(45),
    paddingHorizontal: theme.space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
  },
  itemMainContainer: {
    flex: 1,
  },
  itemMain: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
  },
  checkbox: {
    width: rs(22),
    height: rs(22),
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: theme.borderWidth.base,
  },
  itemName: {
    flex: 1,
  },
  divider: {
    borderBottomWidth: 1,
  },
  sheetButton: {
    alignSelf: 'stretch',
    marginTop: theme.space.lg,
  },
}));

export function RecipeShoppingSheet({ visible, detail, servings, onClose }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
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
        t('recipes.shopping.updatedTitle'),
        t(
          selectedItems.length === 1
            ? 'recipes.shopping.updated_one'
            : 'recipes.shopping.updated_other',
          { count: selectedItems.length },
        ),
      );
    } catch (error) {
      Alert.alert(
        t('recipes.shopping.failedTitle'),
        error instanceof Error ? error.message : t('recipes.shopping.failedMessage'),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <RecipeBottomSheet
      visible={visible}
      onClose={onClose}
      title={hasPlus ? t('recipes.shopping.missingTitle') : t('recipes.shopping.plusTitle')}
      sheetStyle={styles.sheet}>
      {!hasPlus ? (
        <>
          <Txt variant="caption" tone="secondary">
            {t('recipes.shopping.plusHint')}
          </Txt>
          <SheetButton label={t('recipes.shopping.plusAction')} onPress={openPlusPaywall} />
        </>
      ) : isLoading ? (
        <ActivityIndicator style={{ height: 76 }} color={colors.accent} />
      ) : missing.length === 0 ? (
        <>
          <Txt variant="caption" tone="secondary">
            {t(
              servings === 1 ? 'recipes.shopping.allCovered' : 'recipes.shopping.allCovered_other',
              { count: servings },
            )}
          </Txt>
          <SheetButton label={t('recipes.shopping.close')} onPress={onClose} />
        </>
      ) : (
        <>
          <Txt variant="caption" tone="secondary">
            {t('recipes.shopping.selectHint')}
          </Txt>
          {/* Bulk-Aktion: allen Zutaten auf einen Schlag denselben Markt zuweisen (#342) */}
          <View style={styles.bulkRow}>
            <RowStorePicker
              householdId={detail.recipe.household_id}
              storeId={null}
              label={t('recipes.shopping.assignStore')}
              onChange={(storeId) =>
                setStoreOverrides(
                  Object.fromEntries(missing.map((item) => [item.productId, storeId])),
                )
              }
              testID="recipe-bulk-store-picker"
            />
          </View>
          <View style={[styles.missingList, { backgroundColor: colors.backgroundSoft }]}>
            {missing.map((item, index) => {
              const checked = selected.has(item.productId);
              return (
                <View
                  key={item.productId}
                  style={[
                    styles.itemRow,
                    index < missing.length - 1
                      ? [styles.divider, { borderBottomColor: colors.border }]
                      : undefined,
                  ]}>
                  <Press
                    onPress={() => toggle(item.productId)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    accessibilityLabel={item.name}
                    containerStyle={styles.itemMainContainer}
                    style={styles.itemMain}>
                    <View
                      style={[
                        styles.checkbox,
                        {
                          backgroundColor: checked ? colors.accent : 'transparent',
                          borderColor: colors.accent,
                        },
                      ]}>
                      {checked ? (
                        <Txt variant="caption" tone="onAccent" weight="700">
                          ✓
                        </Txt>
                      ) : null}
                    </View>
                    <Txt variant="label" weight="700" style={styles.itemName} numberOfLines={1}>
                      {item.name}
                    </Txt>
                    <Txt variant="caption" tone="secondary">
                      {item.missingGrams > 0
                        ? `${item.missingGrams} ${t('recipes.shopping.unitGram')}`
                        : `${item.neededGrams} ${t('recipes.shopping.unitGram')} / ${item.availableGrams} ${t('recipes.shopping.unitGram')}`}
                    </Txt>
                  </Press>
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
            label={t(
              selected.size === 1
                ? 'recipes.shopping.selected_one'
                : 'recipes.shopping.selected_other',
              { count: selected.size },
            )}
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
  return (
    <Button
      title={label}
      onPress={onPress}
      loading={loading}
      disabled={disabled}
      size="lg"
      style={styles.sheetButton}
    />
  );
}
