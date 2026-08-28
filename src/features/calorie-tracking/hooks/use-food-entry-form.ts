import { useEffect, useRef, useState } from 'react';

import type { FoodEntryRow } from '@/features/calorie-tracking/api';
import {
  type NutrientLevel,
  type OpenFoodFactsProduct,
  productFromRouteParams,
} from '@/lib/open-food-facts';
import { scaleToQuantity } from '@/lib/units';

export type FoodEntryFormValues = {
  name: string;
  quantity: string;
  unit: string;
  kcal: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
};

export type FoodEntryBadge = { label: string; tone: 'good' | 'warn' };

export type FoodEntryProductMeta = {
  brand: string | undefined;
  imageUrl: string | undefined;
  nutriScore: string | undefined;
  badges: FoodEntryBadge[];
};

export type FoodEntryParsedValues = {
  name: string;
  quantity: number;
  unit: string;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};

const EMPTY_VALUES: FoodEntryFormValues = {
  name: '',
  quantity: '1',
  unit: 'g',
  kcal: '',
  proteinG: '',
  carbsG: '',
  fatG: '',
};

const EMPTY_PRODUCT_META: FoodEntryProductMeta = {
  brand: undefined,
  imageUrl: undefined,
  nutriScore: undefined,
  badges: [],
};

type Per100gReference = {
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};

function buildNutritionBadges(
  nutrientLevels: OpenFoodFactsProduct['nutrientLevels'] | undefined,
  novaGroup: number | undefined,
): FoodEntryBadge[] {
  const badges: FoodEntryBadge[] = [];
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

type UseFoodEntryFormArgs = {
  /** true, solange die Route eine `entryId` traegt (Editier-Modus). */
  isEditing: boolean;
  /** Der per Query geladene Eintrag — `undefined` waehrend er noch laedt. */
  existingEntry: FoodEntryRow | undefined;
  /** Rohe Route-Params, aus denen bei Neuanlage ein Produkt/Verlaufs-Snapshot gelesen wird. */
  routeParams: Record<string, string | string[] | undefined>;
};

/**
 * Besitzt die editierbaren Werte des Erfassungsformulars, deren Vorbefuellung
 * (bestehender Eintrag > Produkt aus Suche/Barcode > Verlaufs-Snapshot) und
 * die Live-Skalierung der Naehrwerte bei Mengen-/Einheitenaenderung, wenn eine
 * 100g-Referenz vorliegt. Profilwahl, Queries, Mutationen, Navigation,
 * Snackbar und Nutzungshistorie bleiben bewusst im Screen — das hier ist
 * ausschliesslich Formular-Zustand.
 */
export function useFoodEntryForm({ isEditing, existingEntry, routeParams }: UseFoodEntryFormArgs) {
  const [values, setValues] = useState<FoodEntryFormValues>(EMPTY_VALUES);
  const [productMeta, setProductMeta] = useState<FoodEntryProductMeta>(EMPTY_PRODUCT_META);
  const [unitNotScalable, setUnitNotScalable] = useState(false);

  // Interne Details, die der Screen nie braucht: die 100g-Referenz fuer die
  // Live-Skalierung und ob die Vorbefuellung bereits gelaufen ist.
  const per100gRef = useRef<Per100gReference | null>(null);
  const hasInitializedRef = useRef(false);
  const routeParamsRef = useRef(routeParams);
  routeParamsRef.current = routeParams;

  // Vorbefuellung: bestehender Eintrag > Produkt aus der Suche > Verlaufs-
  // Snapshot > leer. `existingEntry` und `isEditing` sind vollstaendige Deps
  // (kein Lint-Suppress noetig) — laeuft dank `hasInitializedRef` trotzdem
  // nur einmal, reagiert aber korrekt, wenn `existingEntry` erst verzoegert
  // aus der Query eintrifft (Editier-Modus wartet dann einfach weiter).
  useEffect(() => {
    if (hasInitializedRef.current) return;

    if (existingEntry) {
      setValues({
        name: existingEntry.name,
        quantity: String(existingEntry.quantity),
        unit: existingEntry.unit,
        kcal: existingEntry.kcal !== null ? String(existingEntry.kcal) : '',
        proteinG: existingEntry.protein_g !== null ? String(existingEntry.protein_g) : '',
        carbsG: existingEntry.carbs_g !== null ? String(existingEntry.carbs_g) : '',
        fatG: existingEntry.fat_g !== null ? String(existingEntry.fat_g) : '',
      });
      hasInitializedRef.current = true;
      return;
    }

    if (isEditing) return; // Eintrag laedt noch async — Effect feuert erneut, sobald er da ist.

    const product = productFromRouteParams(routeParamsRef.current);
    if (!product) {
      hasInitializedRef.current = true;
      return;
    }

    setProductMeta({
      brand: product.brand,
      imageUrl: product.imageUrl,
      nutriScore: product.nutriScore,
      badges: buildNutritionBadges(product.nutrientLevels, product.novaGroup),
    });

    if (product.caloriesPer100g !== undefined) {
      // Aus Suche/Barcode: 100g/ml-Referenz, Menge startet bei 100.
      const ref: Per100gReference = {
        kcal: product.caloriesPer100g,
        protein: product.proteinsPer100g,
        carbs: product.carbsPer100g,
        fat: product.fatPer100g,
      };
      per100gRef.current = ref;
      setValues({
        name: product.name ?? '',
        quantity: '100',
        unit: 'g',
        kcal: ref.kcal !== undefined ? String(ref.kcal) : '',
        proteinG: ref.protein !== undefined ? String(ref.protein) : '',
        carbsG: ref.carbs !== undefined ? String(ref.carbs) : '',
        fatG: ref.fat !== undefined ? String(ref.fat) : '',
      });
    } else {
      // Aus "Zuletzt"/"Haeufig": bereits fertige Snapshot-Werte, keine
      // Live-Skalierung (wie bei manueller Erfassung).
      const params = routeParamsRef.current;
      setValues({
        name: product.name ?? '',
        quantity: params.quantity ? String(params.quantity) : '1',
        unit: params.unit ? String(params.unit) : 'g',
        kcal: params.kcal ? String(params.kcal) : '',
        proteinG: params.proteinG ? String(params.proteinG) : '',
        carbsG: params.carbsG ? String(params.carbsG) : '',
        fatG: params.fatG ? String(params.fatG) : '',
      });
    }

    hasInitializedRef.current = true;
  }, [existingEntry, isEditing]);

  // Live-Neuberechnung, wenn Menge/Einheit geaendert werden UND eine
  // 100g-Referenz vorliegt (Produkt aus Suche/Barcode). Reagiert bewusst nur
  // auf Menge/Einheit, nicht auf manuell editierte Naehrwerte — sonst wuerde
  // eine Handaenderung sofort wieder von der Referenz ueberschrieben.
  useEffect(() => {
    const per100g = per100gRef.current;
    if (!per100g || !hasInitializedRef.current) return;
    const qty = parseFloat(values.quantity);
    if (Number.isNaN(qty)) return;

    const scaled = {
      kcal:
        per100g.kcal !== undefined ? scaleToQuantity(per100g.kcal, qty, values.unit) : undefined,
      protein:
        per100g.protein !== undefined
          ? scaleToQuantity(per100g.protein, qty, values.unit)
          : undefined,
      carbs:
        per100g.carbs !== undefined ? scaleToQuantity(per100g.carbs, qty, values.unit) : undefined,
      fat: per100g.fat !== undefined ? scaleToQuantity(per100g.fat, qty, values.unit) : undefined,
    };

    const anyNotConvertible = Object.values(scaled).some(
      (result) => result !== undefined && !result.convertible,
    );
    setUnitNotScalable(anyNotConvertible);
    if (anyNotConvertible) return; // Werte bleiben stehen, kein stilles Einfrieren auf falschen Rohwert.

    setValues((prev) => ({
      ...prev,
      kcal: scaled.kcal?.convertible ? String(scaled.kcal.value) : prev.kcal,
      proteinG: scaled.protein?.convertible ? String(scaled.protein.value) : prev.proteinG,
      carbsG: scaled.carbs?.convertible ? String(scaled.carbs.value) : prev.carbsG,
      fatG: scaled.fat?.convertible ? String(scaled.fat.value) : prev.fatG,
    }));
  }, [values.quantity, values.unit]);

  function getParsedValues(): FoodEntryParsedValues {
    return {
      name: values.name.trim(),
      quantity: parseFloat(values.quantity) || 1,
      unit: values.unit,
      kcal: values.kcal.trim() ? parseFloat(values.kcal) : null,
      proteinG: values.proteinG.trim() ? parseFloat(values.proteinG) : null,
      carbsG: values.carbsG.trim() ? parseFloat(values.carbsG) : null,
      fatG: values.fatG.trim() ? parseFloat(values.fatG) : null,
    };
  }

  return {
    values,
    setName: (name: string) => setValues((prev) => ({ ...prev, name })),
    setQuantity: (quantity: string) => setValues((prev) => ({ ...prev, quantity })),
    setUnit: (unit: string) => setValues((prev) => ({ ...prev, unit })),
    setKcal: (kcal: string) => setValues((prev) => ({ ...prev, kcal })),
    setProteinG: (proteinG: string) => setValues((prev) => ({ ...prev, proteinG })),
    setCarbsG: (carbsG: string) => setValues((prev) => ({ ...prev, carbsG })),
    setFatG: (fatG: string) => setValues((prev) => ({ ...prev, fatG })),
    productMeta,
    unitNotScalable,
    getParsedValues,
  };
}
