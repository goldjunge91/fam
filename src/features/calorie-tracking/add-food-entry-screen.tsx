import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session-provider';
import {
  type MealType,
  useAddFoodEntryMutation,
  useDeleteFoodEntryMutation,
  useFoodEntries,
  useUpdateFoodEntryMutation,
} from '@/features/calorie-tracking/api';
import { MEAL_LABELS } from '@/features/calorie-tracking/diary-screen';
import { ProductSearchDropdown } from '@/features/inventory/product-search-dropdown';
import type { OpenFoodFactsProduct } from '@/lib/open-food-facts';

/**
 * Skaliert einen Naehrwert "pro 100g/100ml" auf die eingegebene Menge.
 *
 * `kg`/`l` werden auf Gramm/Milliliter umgerechnet. Bei stueckbasierten
 * Einheiten (`piece`/`package`/`portion`) fehlt der Mengenbezug fuer eine
 * korrekte Skalierung — dort bleibt der Rohwert stehen, als Ausgangspunkt fuer
 * eine manuelle Korrektur statt eines falschen Automatik-Werts.
 */
function scaleToQuantity(per100: number, quantity: number, unit: string): number {
  const gramsOrMlEquivalent =
    unit === 'kg' || unit === 'l'
      ? quantity * 1000
      : unit === 'g' || unit === 'ml'
        ? quantity
        : null;
  if (gramsOrMlEquivalent === null) return per100;
  return Math.round(((per100 * gramsOrMlEquivalent) / 100) * 10) / 10;
}

/** Eintrag hinzufuegen/bearbeiten/loeschen (#86), als Modal-Route erreicht. */
export function AddFoodEntryScreen() {
  const params = useLocalSearchParams<{ date: string; mealType: MealType; entryId?: string }>();
  const { session } = useSession();
  const userId = session?.user.id;
  const isEditing = !!params.entryId;

  const { data: entries = [] } = useFoodEntries(userId, params.date);
  const existingEntry = params.entryId ? entries.find((e) => e.id === params.entryId) : undefined;

  const addMutation = useAddFoodEntryMutation();
  const updateMutation = useUpdateFoodEntryMutation();
  const deleteMutation = useDeleteFoodEntryMutation();

  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('g');
  const [kcalInput, setKcalInput] = useState('');
  const [proteinInput, setProteinInput] = useState('');
  const [carbsInput, setCarbsInput] = useState('');
  const [fatInput, setFatInput] = useState('');
  const [initializedFromEntry, setInitializedFromEntry] = useState(false);

  useEffect(() => {
    if (!existingEntry || initializedFromEntry) return;
    setName(existingEntry.name);
    setQuantity(String(existingEntry.quantity));
    setUnit(existingEntry.unit);
    setKcalInput(existingEntry.kcal !== null ? String(existingEntry.kcal) : '');
    setProteinInput(existingEntry.protein_g !== null ? String(existingEntry.protein_g) : '');
    setCarbsInput(existingEntry.carbs_g !== null ? String(existingEntry.carbs_g) : '');
    setFatInput(existingEntry.fat_g !== null ? String(existingEntry.fat_g) : '');
    setInitializedFromEntry(true);
  }, [existingEntry, initializedFromEntry]);

  function handleSelectProduct(product: OpenFoodFactsProduct) {
    setName(product.name);
    const qty = parseFloat(quantity) || 1;
    if (product.caloriesPer100g !== undefined) {
      setKcalInput(String(scaleToQuantity(product.caloriesPer100g, qty, unit)));
    }
    if (product.proteinsPer100g !== undefined) {
      setProteinInput(String(scaleToQuantity(product.proteinsPer100g, qty, unit)));
    }
    if (product.carbsPer100g !== undefined) {
      setCarbsInput(String(scaleToQuantity(product.carbsPer100g, qty, unit)));
    }
    if (product.fatPer100g !== undefined) {
      setFatInput(String(scaleToQuantity(product.fatPer100g, qty, unit)));
    }
  }

  async function handleSave() {
    if (!userId || !name.trim() || !params.date || !params.mealType) return;

    const payload = {
      userId,
      loggedOn: params.date,
      mealType: params.mealType,
      name: name.trim(),
      quantity: parseFloat(quantity) || 1,
      unit,
      kcal: kcalInput.trim() ? parseFloat(kcalInput) : null,
      proteinG: proteinInput.trim() ? parseFloat(proteinInput) : null,
      carbsG: carbsInput.trim() ? parseFloat(carbsInput) : null,
      fatG: fatInput.trim() ? parseFloat(fatInput) : null,
    };

    try {
      if (isEditing && params.entryId) {
        await updateMutation.mutateAsync({ id: params.entryId, ...payload });
      } else {
        await addMutation.mutateAsync(payload);
      }
      router.back();
    } catch (err) {
      Alert.alert('Fehler', err instanceof Error ? err.message : 'Fehler beim Speichern');
    }
  }

  function handleDelete() {
    if (!userId || !params.entryId || !params.date) return;
    Alert.alert('Eintrag löschen', `"${name}" wirklich löschen?`, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMutation.mutateAsync({
              id: params.entryId as string,
              userId: userId as string,
              loggedOn: params.date,
            });
            router.back();
          } catch (err) {
            Alert.alert('Fehler', err instanceof Error ? err.message : 'Fehler beim Löschen');
          }
        },
      },
    ]);
  }

  const title = isEditing
    ? 'Eintrag bearbeiten'
    : `${MEAL_LABELS[params.mealType] ?? 'Mahlzeit'} hinzufügen`;

  return (
    <Screen title={title} back={{ label: 'Abbrechen' }}>
      <View style={styles.form}>
        <ProductSearchDropdown
          label="Name"
          placeholder="z. B. Haferflocken"
          value={name}
          onChangeText={setName}
          onSelectProduct={handleSelectProduct}
        />

        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField
              label="Menge"
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label="Einheit"
              placeholder="g, ml, piece..."
              value={unit}
              onChangeText={setUnit}
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField
              label="kcal"
              value={kcalInput}
              onChangeText={setKcalInput}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label="Eiweiß (g)"
              value={proteinInput}
              onChangeText={setProteinInput}
              keyboardType="numeric"
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField
              label="Kohlenhydrate (g)"
              value={carbsInput}
              onChangeText={setCarbsInput}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label="Fett (g)"
              value={fatInput}
              onChangeText={setFatInput}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.saveButton}>
          <Button
            label="Speichern"
            onPress={handleSave}
            loading={addMutation.isPending || updateMutation.isPending}
            disabled={!name.trim()}
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

const styles = StyleSheet.create({
  form: {
    gap: Spacing.four,
    marginTop: Spacing.four,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
  flex: {
    flex: 1,
  },
  saveButton: {
    marginTop: Spacing.two,
  },
});
