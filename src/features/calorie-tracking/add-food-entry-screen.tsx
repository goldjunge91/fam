import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { useActiveHousehold } from '@/features/household/active-household-provider';
import { useChildProfiles } from '@/features/household/api';
import { getDatabase } from '@/lib/db/client';
import { recordProductUsage } from '@/lib/db/product-usage';
import {
  type NutrientLevel,
  type OpenFoodFactsProduct,
  productFromRouteParams,
} from '@/lib/open-food-facts';
import { scaleToQuantity } from '@/lib/units';

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

type Per100gReference = {
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};

type Badge = { label: string; tone: 'good' | 'warn' };

/** Leitet Badges nur aus vorhandenen OFF-Signalen ab. */
function buildNutritionBadges(
  nutrientLevels: OpenFoodFactsProduct['nutrientLevels'] | undefined,
  novaGroup: number | undefined,
): Badge[] {
  const badges: Badge[] = [];
  const add = (level: NutrientLevel | undefined, lowLabel: string, highLabel: string) => {
    if (level === 'low') badges.push({ label: lowLabel, tone: 'good' });
    else if (level === 'high') badges.push({ label: highLabel, tone: 'warn' });
  };
  add(nutrientLevels?.fat, 'Fettarm', 'Reich an Fett');
  add(nutrientLevels?.saturatedFat, 'Wenig gesättigte Fettsäuren', 'Viel gesättigte Fettsäuren');
  add(nutrientLevels?.sugars, 'Wenig Zucker', 'Viel Zucker');
  add(nutrientLevels?.salt, 'Wenig Salz', 'Viel Salz');
  if (novaGroup === 4) badges.push({ label: 'Stark verarbeitet', tone: 'warn' });
  return badges;
}

/** Erfasst neue, gesuchte oder bestehende Tagebucheintraege. */
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
    closeStackCount?: string;
  }>();
  const { session } = useSession();
  const userId = session?.user.id;
  const isEditing = !!params.entryId;
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

  const [name, setName] = useState('');
  const [brand, setBrand] = useState<string | undefined>(undefined);
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [nutriScore, setNutriScore] = useState<string | undefined>(undefined);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('g');
  const [kcalInput, setKcalInput] = useState('');
  const [proteinInput, setProteinInput] = useState('');
  const [carbsInput, setCarbsInput] = useState('');
  const [fatInput, setFatInput] = useState('');
  const [per100g, setPer100g] = useState<Per100gReference | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [unitNotScalable, setUnitNotScalable] = useState(false);

  // Einmalige Prioritaet: bestehender Eintrag, Suchprodukt, leeres Formular.
  // biome-ignore lint/correctness/useExhaustiveDependencies: nur beim ersten Mount vorbefuellen.
  useEffect(() => {
    if (initialized) return;

    if (existingEntry) {
      setName(existingEntry.name);
      setQuantity(String(existingEntry.quantity));
      setUnit(existingEntry.unit);
      setKcalInput(existingEntry.kcal !== null ? String(existingEntry.kcal) : '');
      setProteinInput(existingEntry.protein_g !== null ? String(existingEntry.protein_g) : '');
      setCarbsInput(existingEntry.carbs_g !== null ? String(existingEntry.carbs_g) : '');
      setFatInput(existingEntry.fat_g !== null ? String(existingEntry.fat_g) : '');
      setInitialized(true);
      return;
    }

    if (isEditing) return;

    const product = productFromRouteParams(params as Record<string, string | string[] | undefined>);
    if (!product) {
      setInitialized(true);
      return;
    }

    setName(product.name ?? '');
    setBrand(product.brand);
    setImageUrl(product.imageUrl);
    setNutriScore(product.nutriScore);
    setBadges(buildNutritionBadges(product.nutrientLevels, product.novaGroup));

    if (product.caloriesPer100g !== undefined) {
      const ref: Per100gReference = {
        kcal: product.caloriesPer100g,
        protein: product.proteinsPer100g,
        carbs: product.carbsPer100g,
        fat: product.fatPer100g,
      };
      setPer100g(ref);
      setQuantity('100');
      setUnit('g');
      setKcalInput(ref.kcal !== undefined ? String(ref.kcal) : '');
      setProteinInput(ref.protein !== undefined ? String(ref.protein) : '');
      setCarbsInput(ref.carbs !== undefined ? String(ref.carbs) : '');
      setFatInput(ref.fat !== undefined ? String(ref.fat) : '');
    } else {
      // Verlaufswerte sind fertige Snapshots ohne 100-g-Referenz.
      setQuantity(params.quantity ? String(params.quantity) : '1');
      setUnit(params.unit ? String(params.unit) : 'g');
      setKcalInput(params.kcal ? String(params.kcal) : '');
      setProteinInput(params.proteinG ? String(params.proteinG) : '');
      setCarbsInput(params.carbsG ? String(params.carbsG) : '');
      setFatInput(params.fatG ? String(params.fatG) : '');
    }

    setInitialized(true);
  }, [existingEntry, isEditing, initialized]);

  // Skaliert Suchprodukte mit stabiler 100-g-Referenz auf Menge und Einheit.
  // biome-ignore lint/correctness/useExhaustiveDependencies: per100g ist eine stabile Referenz ab der Vorbefuellung.
  useEffect(() => {
    if (!per100g || !initialized) return;
    const qty = parseFloat(quantity);
    if (Number.isNaN(qty)) return;

    const scaled = {
      kcal: per100g.kcal !== undefined ? scaleToQuantity(per100g.kcal, qty, unit) : undefined,
      protein:
        per100g.protein !== undefined ? scaleToQuantity(per100g.protein, qty, unit) : undefined,
      carbs: per100g.carbs !== undefined ? scaleToQuantity(per100g.carbs, qty, unit) : undefined,
      fat: per100g.fat !== undefined ? scaleToQuantity(per100g.fat, qty, unit) : undefined,
    };

    const anyNotConvertible = Object.values(scaled).some(
      (result) => result !== undefined && !result.convertible,
    );
    setUnitNotScalable(anyNotConvertible);
    if (anyNotConvertible) return;

    if (scaled.kcal?.convertible) setKcalInput(String(scaled.kcal.value));
    if (scaled.protein?.convertible) setProteinInput(String(scaled.protein.value));
    if (scaled.carbs?.convertible) setCarbsInput(String(scaled.carbs.value));
    if (scaled.fat?.convertible) setFatInput(String(scaled.fat.value));
  }, [quantity, unit]);

  async function handleSave() {
    if (!userId || !name.trim() || !params.date || !params.mealType) return;

    const payload = {
      userId,
      loggedOn: params.date,
      loggedAt: new Date().toISOString(),
      mealType: params.mealType,
      name: name.trim(),
      quantity: parseFloat(quantity) || 1,
      unit,
      kcal: kcalInput.trim() ? parseFloat(kcalInput) : null,
      proteinG: proteinInput.trim() ? parseFloat(proteinInput) : null,
      carbsG: carbsInput.trim() ? parseFloat(carbsInput) : null,
      fatG: fatInput.trim() ? parseFloat(fatInput) : null,
      childProfileId,
    };

    try {
      if (isEditing && params.entryId) {
        await updateMutation.mutateAsync({ id: params.entryId, ...payload });
      } else {
        await addMutation.mutateAsync(payload);

        void getDatabase()
          .then((db) =>
            recordProductUsage(db, {
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
            }),
          )
          .then(() => queryClient.invalidateQueries({ queryKey: ['product_usage'] }))
          .catch((err) => console.error('Fehler beim Protokollieren der Nutzung:', err));
      }
      // Optional das vorgelagerte Sheet gemeinsam mit der Route schliessen.
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

  // Rueckgaengig ersetzt hier den Bestaetigungsdialog.
  async function handleDelete() {
    if (!userId || !params.entryId || !params.date) return;
    const entryId = params.entryId;
    const loggedOn = params.date;
    const entryName = name;

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

        <View className="afe-hero">
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} className="afe-hero-image" />
          ) : (
            <View className="afe-hero-image-placeholder">
              <ThemedText className="text-[28px]">🍽️</ThemedText>
            </View>
          )}
          <View className="afe-hero-text">
            <TextField placeholder="Name des Lebensmittels" value={name} onChangeText={setName} />
            {brand ? (
              <ThemedText type="small" themeColor="textSecondary">
                {brand}
              </ThemedText>
            ) : null}
          </View>
          {nutriScore ? (
            <View className="afe-nutri-badge">
              <ThemedText className="afe-nutri-badge-text">{nutriScore.toUpperCase()}</ThemedText>
            </View>
          ) : null}
        </View>

        {badges.length > 0 ? (
          <View className="afe-badge-row">
            {badges.map((badge) => (
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

        <View className="flex-row gap-four">
          <View className="flex-1">
            <TextField
              label="kcal"
              value={kcalInput}
              onChangeText={setKcalInput}
              keyboardType="numeric"
            />
          </View>
          <View className="flex-1">
            <TextField
              label="Kohlenhydrate (g)"
              value={carbsInput}
              onChangeText={setCarbsInput}
              keyboardType="numeric"
            />
          </View>
        </View>
        <View className="flex-row gap-four">
          <View className="flex-1">
            <TextField
              label="Eiweiß (g)"
              value={proteinInput}
              onChangeText={setProteinInput}
              keyboardType="numeric"
            />
          </View>
          <View className="flex-1">
            <TextField
              label="Fett (g)"
              value={fatInput}
              onChangeText={setFatInput}
              keyboardType="numeric"
            />
          </View>
        </View>

        <ThemedText type="smallBold" className="mt-one">
          Menge
        </ThemedText>
        <QuantityStepper
          value={Number.parseInt(quantity, 10) || 1}
          onChange={(value) => setQuantity(String(value))}
          max={9999}
          label="Menge"
        />
        <FilterChipBar
          label="Einheit"
          options={UNITS.map((u) => ({ value: u, label: UNIT_LABELS[u] }))}
          selected={unit}
          onSelect={setUnit}
        />
        {unitNotScalable ? (
          <ThemedText type="small" themeColor="warning">
            Automatische Umrechnung für diese Einheit nicht möglich — Nährwerte bitte manuell
            anpassen.
          </ThemedText>
        ) : null}

        <View className="mt-two">
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
