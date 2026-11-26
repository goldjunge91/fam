import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Screen } from '@/components/layout/screen';
import { Button, TextField } from '@/constants/ui';
import { useSession } from '@/features/auth/session-provider';
import { setPendingProductSelection } from '@/features/inventory/pending-product-selection';
import { useAddProductMutation } from '@/features/inventory/use-product-mutations';

const styles = StyleSheet.create((theme) => ({
  form: {
    gap: theme.space.lg,
    marginTop: theme.space.lg,
  },
  nutritionRow: {
    flexDirection: 'row',
    gap: theme.space.xxl,
  },
  flex: {
    flex: 1,
  },
  saveAction: {
    marginTop: theme.space.lg,
  },
}));

function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number.parseFloat(trimmed);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function AddProductScreen() {
  const { t } = useTranslation();
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
      Alert.alert(
        t('inventory.product.error'),
        err instanceof Error ? err.message : t('inventory.product.saveFailed'),
      );
    }
  }

  return (
    <Screen title={t('inventory.product.title')} back={{ label: t('inventory.product.cancel') }}>
      <View style={styles.form}>
        {/* Produkt-Stammdaten: Name und optionale Marke */}
        <TextField
          label={t('inventory.product.name')}
          placeholder={t('inventory.product.namePlaceholder')}
          value={name}
          onChangeText={setName}
        />
        <TextField
          label={t('inventory.product.brandOptional')}
          value={brand}
          onChangeText={setBrand}
        />

        {/* Nährwert-Eingaben bezogen auf 100g (kcal, Kohlenhydrate, Eiweiß, Fett) */}
        <View style={styles.nutritionRow}>
          <View style={styles.flex}>
            <TextField
              label={t('inventory.product.kcalPer100')}
              value={kcalInput}
              onChangeText={setKcalInput}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label={t('inventory.product.carbsPer100')}
              value={carbsInput}
              onChangeText={setCarbsInput}
              keyboardType="numeric"
            />
          </View>
        </View>
        <View style={styles.nutritionRow}>
          <View style={styles.flex}>
            <TextField
              label={t('inventory.product.proteinPer100')}
              value={proteinInput}
              onChangeText={setProteinInput}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label={t('inventory.product.fatPer100')}
              value={fatInput}
              onChangeText={setFatInput}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Optionale Angabe einer Portionsgröße */}
        <TextField
          label={t('inventory.product.servingSizeOptional')}
          placeholder={t('inventory.product.servingSizePlaceholder')}
          value={servingSizeInput}
          onChangeText={setServingSizeInput}
          keyboardType="numeric"
        />

        {/* Aktions-Buttons: Produkt anlegen / Abbrechen */}
        <View style={styles.saveAction}>
          <Button
            title={t('inventory.product.save')}
            onPress={handleSave}
            loading={mutation.isPending}
            disabled={!name.trim()}
          />
        </View>
        <Button
          title={t('inventory.product.cancel')}
          variant="secondary"
          onPress={() => router.back()}
        />
      </View>
    </Screen>
  );
}
