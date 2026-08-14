import { useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, View } from 'react-native';
import { Screen } from '@/components/screen';
import { useSnackbar } from '@/components/snackbar';
import { TextField } from '@/components/text-field';
import { FontSize, ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/buttons';
import { Spacing } from '@/constants/theme';
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
import { useTheme } from '@/hooks/use-theme';
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

/**
 * Leitet Bewertungs-Badges aus echten Open-Food-Facts-Signalen ab
 * (`nutrient_levels`, `nova_group`). Bewusst keine erfundenen Badges wie
 * "Kalorienarm" — dafuer liefert OFF kein Standardfeld.
 */
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

/**
 * Eintrag hinzufuegen/bearbeiten/loeschen (#86), als Modal-Route erreicht.
 *
 * Drei Ausgangslagen:
 * - Bearbeiten eines bestehenden Eintrags (`entryId`-Param) — laedt aus
 *   `useFoodEntries`, keine 100g-Referenz, Felder bleiben direkt editierbar.
 * - Aus der Lebensmittelsuche/Barcode-Scan (`kcalPer100g`-Param u.a.) — Menge
 *   startet bei 100g/ml, Makros werden bei Mengen-/Einheitenaenderung live
 *   aus den 100g-Werten neu berechnet.
 * - "Schneller Eintrag" (keine Produkt-Params) — leeres Formular, alles
 *   manuell.
 */
export function AddFoodEntryScreen() {
  const theme = useTheme();
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

  // Vorbefuellung: bestehender Eintrag > Produkt aus der Suche > leer. Laeuft
  // bewusst nur einmal (Guard ueber `initialized`) statt bei jeder
  // Param-/Query-Aenderung neu zu greifen.
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

    if (isEditing) return; // Editier-Modus wartet auf existingEntry aus der Query.

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
      // Aus Suche/Barcode: 100g/ml-Referenz, Menge startet bei 100.
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
      // Aus "Zuletzt"/"Haeufig": bereits fertige Snapshot-Werte, keine
      // Live-Skalierung (wie bei manueller Erfassung).
      setQuantity(params.quantity ? String(params.quantity) : '1');
      setUnit(params.unit ? String(params.unit) : 'g');
      setKcalInput(params.kcal ? String(params.kcal) : '');
      setProteinInput(params.proteinG ? String(params.proteinG) : '');
      setCarbsInput(params.carbsG ? String(params.carbsG) : '');
      setFatInput(params.fatG ? String(params.fatG) : '');
    }

    setInitialized(true);
  }, [existingEntry, isEditing, initialized]);

  // Live-Neuberechnung, wenn Menge/Einheit geaendert werden UND eine
  // 100g-Referenz vorliegt (Produkt aus Suche/Barcode). `per100g` bewusst
  // nicht in den Deps: es aendert sich nur einmal bei der Vorbefuellung oben,
  // ein Re-Trigger darueber waere redundant zur Initialisierung.
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
    if (anyNotConvertible) return; // Werte bleiben stehen, kein stilles Einfrieren auf falschen Rohwert.

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
      router.back();
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
      <View style={styles.form}>
        {!isEditing && childProfiles.length > 0 ? (
          <View>
            <ThemedText type="smallBold">Für wen?</ThemedText>
            <View style={styles.unitRow}>
              <ThemedText
                onPress={() => userId && setProfile({ type: 'adult', userId })}
                style={[
                  styles.unitPill,
                  {
                    backgroundColor: !childProfileId ? theme.accent : theme.backgroundElement,
                    color: !childProfileId ? '#fff' : theme.text,
                  },
                ]}>
                Ich
              </ThemedText>
              {childProfiles.map((child) => (
                <ThemedText
                  key={child.id}
                  onPress={() =>
                    activeHousehold &&
                    setProfile({
                      type: 'child',
                      childProfileId: child.id,
                      householdId: activeHousehold.id,
                    })
                  }
                  style={[
                    styles.unitPill,
                    {
                      backgroundColor:
                        childProfileId === child.id ? theme.accent : theme.backgroundElement,
                      color: childProfileId === child.id ? '#fff' : theme.text,
                    },
                  ]}>
                  {child.display_name}
                </ThemedText>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.hero}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.heroImage} />
          ) : (
            <View
              style={[styles.heroImagePlaceholder, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText style={{ ...FontSize[28] }}>🍽️</ThemedText>
            </View>
          )}
          <View style={styles.heroText}>
            <TextField placeholder="Name des Lebensmittels" value={name} onChangeText={setName} />
            {brand ? (
              <ThemedText type="small" themeColor="textSecondary">
                {brand}
              </ThemedText>
            ) : null}
          </View>
          {nutriScore ? (
            <View style={[styles.nutriBadge, { backgroundColor: theme.accent }]}>
              <ThemedText style={styles.nutriBadgeText}>{nutriScore.toUpperCase()}</ThemedText>
            </View>
          ) : null}
        </View>

        {badges.length > 0 ? (
          <View style={styles.badgeRow}>
            {badges.map((badge) => (
              <View
                key={badge.label}
                style={[
                  styles.badge,
                  { backgroundColor: `${theme[badge.tone === 'good' ? 'success' : 'warning']}22` },
                ]}>
                <ThemedText
                  type="small"
                  style={{ color: theme[badge.tone === 'good' ? 'success' : 'warning'] }}>
                  {badge.tone === 'good' ? '🟢' : '⚠️'} {badge.label}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}

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
              label="Kohlenhydrate (g)"
              value={carbsInput}
              onChangeText={setCarbsInput}
              keyboardType="numeric"
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField
              label="Eiweiß (g)"
              value={proteinInput}
              onChangeText={setProteinInput}
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

        <ThemedText type="smallBold" style={{ marginTop: Spacing.one }}>
          Menge
        </ThemedText>
        <TextField value={quantity} onChangeText={setQuantity} keyboardType="numeric" />
        <View style={styles.unitRow}>
          {UNITS.map((u) => (
            <ThemedText
              key={u}
              onPress={() => setUnit(u)}
              style={[
                styles.unitPill,
                {
                  backgroundColor: unit === u ? theme.accent : theme.backgroundElement,
                  color: unit === u ? '#fff' : theme.text,
                },
              ]}>
              {UNIT_LABELS[u]}
            </ThemedText>
          ))}
        </View>
        {unitNotScalable ? (
          <ThemedText type="small" themeColor="warning">
            Automatische Umrechnung für diese Einheit nicht möglich — Nährwerte bitte manuell
            anpassen.
          </ThemedText>
        ) : null}

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
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  heroImage: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  heroImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flex: 1,
    gap: 2,
  },
  nutriBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nutriBadgeText: {
    color: '#fff',
    fontWeight: '900',
    ...FontSize[15],
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
  flex: {
    flex: 1,
  },
  unitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  unitPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    overflow: 'hidden',
  },
  saveButton: {
    marginTop: Spacing.two,
  },
});
