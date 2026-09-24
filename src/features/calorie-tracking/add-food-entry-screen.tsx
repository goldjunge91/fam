import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { WheelPickerField } from '@/components/forms/wheel-picker-field';
import { Screen } from '@/components/layout/screen';
import { font, withAlpha } from '@/components/theme/index';
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
import { MEAL_LABELS } from '@/features/calorie-tracking/diary-screen';
import type { FoodHistoryEntry } from '@/features/calorie-tracking/food-history';
import { FoodSearchDropdown } from '@/features/calorie-tracking/food-search-dropdown';
import { useFoodEntryForm } from '@/features/calorie-tracking/hooks/use-food-entry-form';
import { productToRouteParams } from '@/features/calorie-tracking/product-route-params';
import { useActiveHousehold } from '@/features/household/active-household-provider';
import type { CatalogProduct } from '@/features/product-search/types';
import { getDatabase } from '@/lib/db/local-client';
import { recordProductUsage } from '@/lib/db/product-usage';
import { debugError } from '@/lib/observability/debug-log';

const UNIT_LABELS: Record<string, string> = {
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'l',
  piece: 'Stück',
  package: 'Packung',
  portion: 'Portion',
};
const UNITS = Object.keys(UNIT_LABELS);

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
    width: 56,
    height: 56,
    borderRadius: 16,
  },
  heroImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.backgroundElement,
  },
  heroText: {
    flex: 1,
    gap: 2,
  },
  nutriBadge: {
    width: 34,
    height: 34,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.accent,
  },
  nutriBadgeText: {
    fontSize: font.sizes.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.space.xs,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: theme.space.xs,
    borderRadius: theme.radius.sm,
  },
  nutritionRow: {
    flexDirection: 'row',
    gap: theme.space.xl + theme.space.xs,
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
      Alert.alert('Fehler', err instanceof Error ? err.message : 'Fehler beim Speichern');
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
        message: `"${entryName}" gelöscht`,
        onUndo: () => {
          restoreMutation.mutate({ id: entryId, userId, loggedOn });
        },
      });
    } catch (err) {
      Alert.alert('Fehler', err instanceof Error ? err.message : 'Fehler beim Löschen');
    }
  }

  const title = isEditing
    ? 'Eintrag bearbeiten'
    : `${MEAL_LABELS[params.mealType] ?? 'Mahlzeit'} hinzufügen`;

  return (
    <Screen
      title={title}
      action={<CloseButton onPress={() => router.back()} accessibilityLabel="Schließen" />}>
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
              <Txt variant="body" style={{ fontSize: font.sizes.xxl }}>
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
              <Txt variant="label" tone="onAccent" weight="800" style={styles.nutriBadgeText}>
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
              label="kcal"
              value={values.kcal}
              onChangeText={setKcal}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.field}>
            <TextField
              label="Kohlenhydrate (g)"
              value={values.carbsG}
              onChangeText={setCarbsG}
              keyboardType="numeric"
            />
          </View>
        </View>
        <View style={styles.nutritionRow}>
          <View style={styles.field}>
            <TextField
              label="Eiweiß (g)"
              value={values.proteinG}
              onChangeText={setProteinG}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.field}>
            <TextField
              label="Fett (g)"
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
              Menge
            </Txt>
            <QuantityStepper
              value={Number.parseInt(values.quantity, 10) || 1}
              onChange={(value) => setQuantity(String(value))}
              max={9999}
              label="Menge"
            />
          </View>
          <View style={styles.unitControl}>
            <WheelPickerField
              label="Einheit"
              value={values.unit}
              options={UNITS.map((unit) => ({ value: unit, label: UNIT_LABELS[unit] }))}
              onChange={setUnit}
              accessibilityLabel="Einheit auswählen"
            />
          </View>
        </View>
        {unitNotScalable ? (
          <Txt variant="body" tone="warning">
            Automatische Umrechnung für diese Einheit nicht möglich — Nährwerte bitte manuell
            anpassen.
          </Txt>
        ) : null}

        {/* Aktions-Buttons (Speichern, Löschen) */}
        <View style={styles.saveAction}>
          <Button
            title="Speichern"
            onPress={handleSave}
            loading={addMutation.isPending || updateMutation.isPending}
            disabled={!values.name.trim()}
          />
        </View>
        {isEditing ? (
          <Button
            title="Löschen"
            variant="danger"
            onPress={handleDelete}
            loading={deleteMutation.isPending}
          />
        ) : null}
      </View>
    </Screen>
  );
}
