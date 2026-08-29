import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, View } from 'react-native';
import { TextField } from '@/components/forms/text-field';
import { Screen } from '@/components/layout/screen';
import { ThemedText } from '@/components/theme/themed-text';
import { Button } from '@/components/ui/buttons';
import { FilterChipBar } from '@/components/ui/filter-chip-bar';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { useSnackbar } from '@/components/ui/snackbar';
import { useSession } from '@/features/auth/session-provider';
import { useActiveProfile } from '@/features/calorie-tracking/active-profile-store';
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
import { useChildProfiles } from '@/features/household/api';
import type { CatalogProduct } from '@/features/product-search/types';
import { getDatabase } from '@/lib/db/client';
import { recordProductUsage } from '@/lib/db/product-usage';

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
  const userId = session?.user.id;
  const isEditing = !!params.entryId;
  const [selectedFoodParams, setSelectedFoodParams] = useState<Record<string, string> | null>(null);
  const queryClient = useQueryClient();

  const { activeHousehold } = useActiveHousehold();
  const { data: childProfiles = [] } = useChildProfiles(activeHousehold?.id ?? '');
  const { profile, setProfile } = useActiveProfile(activeHousehold?.id);
  const childProfileId = profile?.type === 'child' ? profile.childProfileId : null;

  const { data: entries = [] } = useFoodEntries(userId, params.date, childProfileId);
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
      childProfileId,
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
          console.error('Fehler beim Protokollieren der Nutzung:', err);
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
    <Screen title={title} back={{ label: 'Abbrechen' }}>
      <View className="afe-form">
        {!isEditing ? (
          <FoodSearchDropdown
            mealType={params.mealType}
            value={values.name}
            onChangeText={setName}
            onProductSelect={selectProduct}
            onHistorySelect={selectHistoryEntry}
          />
        ) : null}

        {/* Profil-Auswahl (Erwachsener / Kind-Profil) */}
        {!isEditing && childProfiles.length > 0 ? (
          <View>
            <ThemedText type="smallBold">Für wen?</ThemedText>
            <FilterChipBar
              label="Für wen?"
              options={[
                { value: 'adult', label: 'Ich' },
                ...childProfiles.map((child) => ({ value: child.id, label: child.display_name })),
              ]}
              selected={childProfileId ?? 'adult'}
              onSelect={(value) => {
                if (value === 'adult') {
                  if (userId) setProfile({ type: 'adult', userId });
                  return;
                }
                if (activeHousehold) {
                  setProfile({
                    type: 'child',
                    childProfileId: value,
                    householdId: activeHousehold.id,
                  });
                }
              }}
            />
          </View>
        ) : null}

        {/* Lebensmittel-Header mit Bild, Name, Marke und Nutri-Score */}
        <View className="afe-hero">
          {productMeta.imageUrl ? (
            <Image source={{ uri: productMeta.imageUrl }} className="afe-hero-image" />
          ) : (
            <View className="afe-hero-image-placeholder">
              <ThemedText className="text-[28px]">🍽️</ThemedText>
            </View>
          )}
          <View className="afe-hero-text">
            {isEditing ? <ThemedText type="smallBold">{values.name}</ThemedText> : null}
            {productMeta.brand ? (
              <ThemedText type="small" themeColor="textSecondary">
                {productMeta.brand}
              </ThemedText>
            ) : null}
          </View>
          {productMeta.nutriScore ? (
            <View className="afe-nutri-badge">
              <ThemedText className="afe-nutri-badge-text">
                {productMeta.nutriScore.toUpperCase()}
              </ThemedText>
            </View>
          ) : null}
        </View>

        {/* Nährwert- & Verarbeitungs-Badges (z. B. Fettarm, Nova 4) */}
        {productMeta.badges.length > 0 ? (
          <View className="afe-badge-row">
            {productMeta.badges.map((badge) => (
              <View
                key={badge.label}
                className={`afe-badge ${badge.tone === 'good' ? 'bg-success/[13%]' : 'bg-warning/[13%]'}`}>
                <ThemedText type="small" themeColor={badge.tone === 'good' ? 'success' : 'warning'}>
                  {badge.tone === 'good' ? '🟢' : '⚠️'} {badge.label}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}

        {/* Nährwert-Eingabefelder (Kalorien, Kohlenhydrate, Eiweiß, Fett) */}
        <View className="flex-row gap-four">
          <View className="flex-1">
            <TextField
              label="kcal"
              value={values.kcal}
              onChangeText={setKcal}
              keyboardType="numeric"
            />
          </View>
          <View className="flex-1">
            <TextField
              label="Kohlenhydrate (g)"
              value={values.carbsG}
              onChangeText={setCarbsG}
              keyboardType="numeric"
            />
          </View>
        </View>
        <View className="flex-row gap-four">
          <View className="flex-1">
            <TextField
              label="Eiweiß (g)"
              value={values.proteinG}
              onChangeText={setProteinG}
              keyboardType="numeric"
            />
          </View>
          <View className="flex-1">
            <TextField
              label="Fett (g)"
              value={values.fatG}
              onChangeText={setFatG}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Mengen- und Einheitenauswahl */}
        <ThemedText type="smallBold" className="mt-one">
          Menge
        </ThemedText>
        <QuantityStepper
          value={Number.parseInt(values.quantity, 10) || 1}
          onChange={(value) => setQuantity(String(value))}
          max={9999}
          label="Menge"
        />
        <FilterChipBar
          label="Einheit"
          options={UNITS.map((u) => ({ value: u, label: UNIT_LABELS[u] }))}
          selected={values.unit}
          onSelect={setUnit}
        />
        {unitNotScalable ? (
          <ThemedText type="small" themeColor="warning">
            Automatische Umrechnung für diese Einheit nicht möglich — Nährwerte bitte manuell
            anpassen.
          </ThemedText>
        ) : null}

        {/* Aktions-Buttons (Speichern, Löschen, Abbrechen) */}
        <View className="mt-two">
          <Button
            label="Speichern"
            onPress={handleSave}
            loading={addMutation.isPending || updateMutation.isPending}
            disabled={!values.name.trim()}
          />
        </View>
        {isEditing ? (
          <Button
            label="Löschen"
            variant="danger"
            onPress={handleDelete}
            loading={deleteMutation.isPending}
          />
        ) : null}
        <Button label="Abbrechen" variant="secondary" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
