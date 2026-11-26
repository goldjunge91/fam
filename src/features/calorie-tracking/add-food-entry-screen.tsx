import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Image, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { WheelPickerField } from '@/components/forms/wheel-picker-field';
import { Screen } from '@/components/layout/screen';
import { radius, withAlpha } from '@/components/theme/index';
import { useTheme } from '@/components/theme/ThemeProvider';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { useSnackbar } from '@/components/ui/snackbar';
import { Button, CloseButton, TextField, Txt } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import {
  type MealType,
  useAddFoodEntryMutation,
  useDeleteFoodEntryMutation,
  useFoodEntries,
  useRestoreFoodEntryMutation,
  useUpdateFoodEntryMutation,
} from '@/features/calorie-tracking/api';
import { getMealLabel } from '@/features/calorie-tracking/diary-screen';
import type { FoodHistoryEntry } from '@/features/calorie-tracking/food-history';
import { FoodSearchDropdown } from '@/features/calorie-tracking/food-search-dropdown';
import { useFoodEntryForm } from '@/features/calorie-tracking/hooks/use-food-entry-form';
import { productToRouteParams } from '@/features/calorie-tracking/product-route-params';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import type { CatalogProduct } from '@/features/product-search/types';
import { getDatabase } from '@/lib/db/local-client';
import { recordProductUsage } from '@/lib/db/product-usage';
import { debugError } from '@/lib/observability/debug-log';
import { getUnitOptions } from '@/lib/units';

const styles = StyleSheet.create((theme) => ({
  form: {
    gap: theme.space.lg,
    marginTop: theme.space.sm,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.lg,
  },
  heroImage: {
    width: theme.space.xxxxl,
    height: theme.space.xxxxl,
    borderRadius: theme.radius.md,
  },
  heroImagePlaceholder: {
    width: theme.space.xxxxl,
    height: theme.space.xxxxl,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.backgroundElement,
  },
  heroText: {
    flex: 1,
    minWidth: 0,
    gap: theme.space.md,
  },
  nutriBadge: {
    width: theme.space.xxxxl,
    height: theme.space.xxxxl,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.xs,
  },
  badge: {
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.xs,
    borderRadius: theme.radius.sm,
  },
  nutritionRow: {
    flexDirection: 'row',
    gap: theme.space.xxl,
  },
  field: {
    flex: 1,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.space.md,
    zIndex: 10,
  },
  quantityControl: {
    flex: 1,
    minWidth: 0,
    gap: theme.space.xs,
  },
  unitControl: {
    width: 124,
    gap: theme.space.xs,
    zIndex: 2,
  },
  saveAction: {
    marginTop: theme.space.sm,
  },
}));

export function AddFoodEntryScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    date: string;
    mealType: MealType;
    entryId?: string;
    quantity?: string;
    unit?: string;
    kcal?: string;
    proteinG?: string;
    carbsG?: string;
    fatG?: string;
    productData?: string;
    closeStackCount?: string;
  }>();
  const { session } = useSession();
  const { colors } = useTheme();
  const userId = session?.user.id;
  const isEditing = !!params.entryId;
  const [selectedFoodParams, setSelectedFoodParams] = useState<Record<string, string> | null>(null);
  const queryClient = useQueryClient();

  const { activeHousehold } = useActiveHousehold();

  const { data: entries = [] } = useFoodEntries(userId, params.date);
  const existingEntry = params.entryId ? entries.find((e) => e.id === params.entryId) : undefined;

  const addMutation = useAddFoodEntryMutation();
  const updateMutation = useUpdateFoodEntryMutation();
  const deleteMutation = useDeleteFoodEntryMutation();
  const restoreMutation = useRestoreFoodEntryMutation();
  const { showUndoSnackbar } = useSnackbar();

  const {
    values,
    setName,
    setQuantity,
    setUnit,
    setKcal,
    setProteinG,
    setCarbsG,
    setFatG,
    productMeta,
    unitNotScalable,
    getParsedValues,
  } = useFoodEntryForm({
    isEditing,
    existingEntry,
    routeParams: (selectedFoodParams ?? params) as Record<string, string | string[] | undefined>,
  });

  function selectProduct(product: CatalogProduct) {
    setSelectedFoodParams({ productData: JSON.stringify(productToRouteParams(product)) });
  }

  function selectHistoryEntry(entry: FoodHistoryEntry) {
    setSelectedFoodParams({
      name: entry.name,
      quantity: String(entry.quantity),
      unit: entry.unit,
      kcal: entry.kcal !== null ? String(entry.kcal) : '',
      proteinG: entry.proteinG !== null ? String(entry.proteinG) : '',
      carbsG: entry.carbsG !== null ? String(entry.carbsG) : '',
      fatG: entry.fatG !== null ? String(entry.fatG) : '',
    });
  }

  async function handleSave() {
    if (!userId || !values.name.trim() || !params.date || !params.mealType) return;

    const payload = {
      userId,
      loggedOn: params.date,
      loggedAt: new Date().toISOString(),
      mealType: params.mealType,
      ...getParsedValues(),
    };

    try {
      if (isEditing && params.entryId) {
        await updateMutation.mutateAsync({ id: params.entryId, ...payload });
      } else {
        await addMutation.mutateAsync(payload);

        try {
          const db = await getDatabase();
          await recordProductUsage(db, {
            id: Crypto.randomUUID(),
            userId,
            householdId: activeHousehold?.id ?? null,
            feature: 'diary',
            mealType: payload.mealType,
            name: payload.name,
            unit: payload.unit,
            quantity: payload.quantity,
            kcal: payload.kcal,
            proteinG: payload.proteinG,
            carbsG: payload.carbsG,
            fatG: payload.fatG,
          });
          void queryClient.invalidateQueries({ queryKey: ['product_usage'] });
        } catch (err) {
          // Der Tagebucheintrag ist bereits gespeichert; ein History-Fehler
          // darf den Nutzer nicht von der naechsten Ansicht abhalten.
          debugError('Fehler beim Protokollieren der Nutzung:', err);
        }
      }
      // Kommt der Eintrag aus einem vorgelagerten Sheet (z.B. "Rezept fertig
      // gekocht"), muss dieses beim Speichern mitgeschlossen werden, statt
      // nur zu ihm zurueckzukehren.
      const closeStackCount = Number(params.closeStackCount);
      if (Number.isInteger(closeStackCount) && closeStackCount > 1) {
        router.dismiss(closeStackCount);
      } else {
        router.back();
      }
    } catch (err) {
      Alert.alert(
        t('calorieTracking.foodEntry.errorTitle'),
        err instanceof Error ? err.message : t('calorieTracking.foodEntry.saveError'),
      );
    }
  }

  // Loescht sofort statt eines Bestaetigungs-Dialogs (#86) — die Snackbar mit
  // "Rueckgaengig" ersetzt die Bestaetigung, statt sie zu ergaenzen.
  async function handleDelete() {
    if (!userId || !params.entryId || !params.date) return;
    const entryId = params.entryId;
    const loggedOn = params.date;
    const entryName = values.name;

    try {
      await deleteMutation.mutateAsync({ id: entryId, userId, loggedOn });
      router.back();
      showUndoSnackbar({
        message: t('calorieTracking.foodEntry.deleteSnackbar', { name: entryName }),
        onUndo: () => {
          restoreMutation.mutate({ id: entryId, userId, loggedOn });
        },
      });
    } catch (err) {
      Alert.alert(
        t('calorieTracking.foodEntry.errorTitle'),
        err instanceof Error ? err.message : t('calorieTracking.foodEntry.deleteError'),
      );
    }
  }

  const title = isEditing
    ? t('calorieTracking.foodEntry.titleEdit')
    : t('calorieTracking.foodEntry.titleAdd', {
        meal: getMealLabel(t, params.mealType),
      });

  return (
    <Screen
      title={title}
      action={
        <CloseButton
          onPress={() => router.back()}
          accessibilityLabel={t('calorieTracking.foodEntry.close')}
        />
      }>
      <View style={styles.form}>
        {!isEditing ? (
          <FoodSearchDropdown
            mealType={params.mealType}
            value={values.name}
            onChangeText={setName}
            onProductSelect={selectProduct}
            onHistorySelect={selectHistoryEntry}
          />
        ) : null}

        {/* Lebensmittel-Header mit Bild, Name, Marke und Nutri-Score */}
        <View style={styles.hero}>
          {productMeta.imageUrl ? (
            <Image source={{ uri: productMeta.imageUrl }} style={styles.heroImage} />
          ) : (
            <View style={styles.heroImagePlaceholder}>
              <Txt variant="glyph" tone="primary">
                🍽️
              </Txt>
            </View>
          )}
          <View style={styles.heroText}>
            {isEditing ? (
              <Txt variant="body" weight="700">
                {values.name}
              </Txt>
            ) : null}
            {productMeta.brand ? (
              <Txt variant="body" tone="secondary">
                {productMeta.brand}
              </Txt>
            ) : null}
          </View>
          {productMeta.nutriScore ? (
            <View style={styles.nutriBadge}>
              <Txt variant="label" tone="onAccent" weight="800">
                {productMeta.nutriScore.toUpperCase()}
              </Txt>
            </View>
          ) : null}
        </View>

        {/* Nährwert- & Verarbeitungs-Badges (z. B. Fettarm, Nova 4) */}
        {productMeta.badges.length > 0 ? (
          <View style={styles.badgeRow}>
            {productMeta.badges.map((badge) => (
              <View
                key={badge.label}
                style={[
                  styles.badge,
                  {
                    backgroundColor: withAlpha(
                      badge.tone === 'good' ? colors.accent : colors.warning,
                      0.13,
                    ),
                  },
                ]}>
                <Txt variant="body" tone={badge.tone === 'good' ? 'success' : 'warning'}>
                  {badge.tone === 'good' ? '🟢' : '⚠️'} {badge.label}
                </Txt>
              </View>
            ))}
          </View>
        ) : null}

        {/* Nährwert-Eingabefelder (Kalorien, Kohlenhydrate, Eiweiß, Fett) */}
        <View style={styles.nutritionRow}>
          <View style={styles.field}>
            <TextField
              label={t('calorieTracking.foodEntry.nutrientKcal')}
              value={values.kcal}
              onChangeText={setKcal}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.field}>
            <TextField
              label={t('calorieTracking.foodEntry.nutrientCarbs')}
              value={values.carbsG}
              onChangeText={setCarbsG}
              keyboardType="numeric"
            />
          </View>
        </View>
        <View style={styles.nutritionRow}>
          <View style={styles.field}>
            <TextField
              label={t('calorieTracking.foodEntry.nutrientProtein')}
              value={values.proteinG}
              onChangeText={setProteinG}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.field}>
            <TextField
              label={t('calorieTracking.foodEntry.nutrientFat')}
              value={values.fatG}
              onChangeText={setFatG}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Mengen- und Einheitenauswahl */}
        <View style={styles.quantityRow}>
          <View style={styles.quantityControl}>
            <Txt variant="label" tone="secondary">
              {t('calorieTracking.foodEntry.quantity')}
            </Txt>
            <QuantityStepper
              value={Number.parseInt(values.quantity, 10) || 1}
              onChange={(value) => setQuantity(String(value))}
              max={9999}
              label={t('calorieTracking.foodEntry.quantity')}
            />
          </View>
          <View style={styles.unitControl}>
            <WheelPickerField
              label={t('calorieTracking.foodEntry.unit')}
              value={values.unit}
              options={getUnitOptions(t)}
              onChange={setUnit}
              accessibilityLabel={t('calorieTracking.foodEntry.unitSelect')}
            />
          </View>
        </View>
        {unitNotScalable ? (
          <Txt variant="body" tone="warning">
            {t('calorieTracking.foodEntry.notScalable')}
          </Txt>
        ) : null}

        {/* Aktions-Buttons (Speichern, Löschen) */}
        <View style={styles.saveAction}>
          <Button
            title={t('calorieTracking.foodEntry.save')}
            onPress={handleSave}
            loading={addMutation.isPending || updateMutation.isPending}
            disabled={!values.name.trim()}
          />
        </View>
        {isEditing ? (
          <Button
            title={t('calorieTracking.foodEntry.delete')}
            variant="danger"
            onPress={handleDelete}
            loading={deleteMutation.isPending}
          />
        ) : null}
      </View>
    </Screen>
  );
}
