import { useEffect, useRef, useState } from 'react';

import type { FoodEntryRow } from '@/features/calorie-tracking/api';
import { productFromRouteParams } from '@/features/calorie-tracking/product-route-params';
import type { CatalogProduct, NutrientLevel } from '@/features/product-search/types';
import { debugLogEvent } from '@/lib/debug-log';
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
  nutrientLevels: CatalogProduct['nutrientLevels'] | undefined,
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
  const initializedSourceKeyRef = useRef<string | null>(null);
  const routeParamsRef = useRef(routeParams);
  routeParamsRef.current = routeParams;
  // Expo Router kann die Parameter beim Mounten einer Modal-Route in einem
  // spaeteren Render liefern. Der Key sorgt dafuer, dass wir diesen Wechsel
  // erkennen, ohne bei jeder Formularaenderung erneut vorzufuellen.
  const routeParamsKey = JSON.stringify(
    Object.keys(routeParams)
      .sort()
      .map((key) => [key, routeParams[key]]),
  );

  // Vorbefuellung: bestehender Eintrag > Produkt aus der Suche > Verlaufs-
  // Snapshot > leer. Die Quelle wird ueber ihren Key nur einmal uebernommen,
  // reagiert aber korrekt, wenn `existingEntry` oder Router-Parameter erst
  // verzoegert eintreffen.
  useEffect(() => {
    if (existingEntry) {
      const sourceKey = `entry:${existingEntry.id}`;
      if (initializedSourceKeyRef.current === sourceKey) return;
      setValues({
        name: existingEntry.name,
        quantity: String(existingEntry.quantity),
        unit: existingEntry.unit,
        kcal: existingEntry.kcal !== null ? String(existingEntry.kcal) : '',
        proteinG: existingEntry.protein_g !== null ? String(existingEntry.protein_g) : '',
        carbsG: existingEntry.carbs_g !== null ? String(existingEntry.carbs_g) : '',
        fatG: existingEntry.fat_g !== null ? String(existingEntry.fat_g) : '',
      });
      initializedSourceKeyRef.current = sourceKey;
      hasInitializedRef.current = true;
      return;
    }

    if (isEditing) return; // Eintrag laedt noch async — Effect feuert erneut, sobald er da ist.

    if (initializedSourceKeyRef.current === routeParamsKey) return;

    const product = productFromRouteParams(routeParamsRef.current);
    if (!product) {
      per100gRef.current = null;
      setProductMeta(EMPTY_PRODUCT_META);
      setUnitNotScalable(false);
      setValues(EMPTY_VALUES);
      initializedSourceKeyRef.current = routeParamsKey;
      hasInitializedRef.current = true;
      return;
    }

    setProductMeta({
      brand: product.brand,
      imageUrl: product.imageUrl,
      nutriScore: product.nutriScore,
      badges: buildNutritionBadges(product.nutrientLevels, product.novaGroup),
    });

    const hasPer100gNutrition = [
      product.caloriesPer100g,
      product.proteinsPer100g,
      product.carbsPer100g,
      product.fatPer100g,
    ].some((value) => value !== undefined);

    const params = routeParamsRef.current;
    if (hasPer100gNutrition) {
      debugLogEvent('calorie-tracking.add-food-entry.product-received', {
        routeParamKeys: Object.keys(params).sort(),
        hasProductData: Boolean(params.productData),
        name: product.name,
        brand: product.brand,
        kcalPer100g: product.caloriesPer100g,
        proteinPer100g: product.proteinsPer100g,
        carbsPer100g: product.carbsPer100g,
        fatPer100g: product.fatPer100g,
      });
    }

    if (hasPer100gNutrition) {
      // Aus Suche/Barcode: 100g/ml-Referenz, Menge startet bei 100. Auch
      // Treffer ohne einzelne Nährwerte behalten die vorhandenen Werte.
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
      debugLogEvent('calorie-tracking.add-food-entry.history-snapshot-received', {
        routeParamKeys: Object.keys(params).sort(),
        name: product.name,
        quantity: params.quantity,
        unit: params.unit,
        kcal: params.kcal,
        proteinG: params.proteinG,
        carbsG: params.carbsG,
        fatG: params.fatG,
      });
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

    initializedSourceKeyRef.current = routeParamsKey;
    hasInitializedRef.current = true;
  }, [existingEntry, isEditing, routeParamsKey]);

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
