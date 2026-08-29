import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { TextField } from '@/components/forms/text-field';
import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/buttons';
import { useSession } from '@/features/auth/session-provider';
import { setPendingProductSelection } from '@/features/inventory/pending-product-selection';
import { useAddProductMutation } from '@/features/inventory/use-product-mutations';

function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number.parseFloat(trimmed);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function AddProductScreen() {
  const params = useLocalSearchParams<{ prefillName?: string }>();
  const { session } = useSession();
  const userId = session?.user.id;
  const mutation = useAddProductMutation();

  const [name, setName] = useState(params.prefillName ?? '');
  const [brand, setBrand] = useState('');
  const [kcalInput, setKcalInput] = useState('');
  const [proteinInput, setProteinInput] = useState('');
  const [carbsInput, setCarbsInput] = useState('');
  const [fatInput, setFatInput] = useState('');
  const [servingSizeInput, setServingSizeInput] = useState('');

  async function handleSave() {
    if (!userId || !name.trim()) return;

    try {
      const created = await mutation.mutateAsync({
        name: name.trim(),
        brand: brand.trim() || undefined,
        kcal_per_100: parseOptionalNumber(kcalInput),
        protein_g_per_100: parseOptionalNumber(proteinInput),
        carbs_g_per_100: parseOptionalNumber(carbsInput),
        fat_g_per_100: parseOptionalNumber(fatInput),
        serving_size_g: parseOptionalNumber(servingSizeInput),
        source: 'manual',
        created_by: userId,
      });

      setPendingProductSelection({
        productId: created.id,
        barcode: created.barcode ?? '',
        name: created.name,
        brand: created.brand ?? undefined,
        caloriesPer100g: created.kcal_per_100 ?? undefined,
        proteinsPer100g: created.protein_g_per_100 ?? undefined,
        carbsPer100g: created.carbs_g_per_100 ?? undefined,
        fatPer100g: created.fat_g_per_100 ?? undefined,
        categoryTags: [],
      });

      router.back();
    } catch (err) {
      Alert.alert('Fehler', err instanceof Error ? err.message : 'Fehler beim Speichern');
    }
  }

  return (
    <Screen title="Produkt anlegen" back={{ label: 'Abbrechen' }}>
      <View className="gap-three mt-three">
        {/* Produkt-Stammdaten: Name und optionale Marke */}
        <TextField
          label="Name"
          placeholder="z. B. Tomaten (lose)"
          value={name}
          onChangeText={setName}
        />
        <TextField label="Marke (optional)" value={brand} onChangeText={setBrand} />

        {/* Nährwert-Eingaben bezogen auf 100g (kcal, Kohlenhydrate, Eiweiß, Fett) */}
        <View className="flex-row gap-four">
          <View className="flex-1">
            <TextField
              label="kcal pro 100g"
              value={kcalInput}
              onChangeText={setKcalInput}
              keyboardType="numeric"
            />
          </View>
          <View className="flex-1">
            <TextField
              label="Kohlenhydrate pro 100g"
              value={carbsInput}
              onChangeText={setCarbsInput}
              keyboardType="numeric"
            />
          </View>
        </View>
        <View className="flex-row gap-four">
          <View className="flex-1">
            <TextField
              label="Eiweiß pro 100g"
              value={proteinInput}
              onChangeText={setProteinInput}
              keyboardType="numeric"
            />
          </View>
          <View className="flex-1">
            <TextField
              label="Fett pro 100g"
              value={fatInput}
              onChangeText={setFatInput}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Optionale Angabe einer Portionsgröße */}
        <TextField
          label="Portionsgröße in Gramm (optional)"
          placeholder="z. B. 45"
          value={servingSizeInput}
          onChangeText={setServingSizeInput}
          keyboardType="numeric"
        />

        {/* Aktions-Buttons: Produkt anlegen / Abbrechen */}
        <View className="mt-three">
          <Button
            label="Speichern"
            onPress={handleSave}
            loading={mutation.isPending}
            disabled={!name.trim()}
          />
        </View>
        <Button label="Abbrechen" variant="secondary" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
