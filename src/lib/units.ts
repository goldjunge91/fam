/** Die vom Schema zugelassenen Einheiten mit deutscher Anzeige-Beschriftung. */
export const UNIT_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'piece', label: 'Stück' },
  { value: 'g', label: 'Gramm (g)' },
  { value: 'kg', label: 'Kilogramm (kg)' },
  { value: 'ml', label: 'Milliliter (ml)' },
  { value: 'l', label: 'Liter (l)' },
  { value: 'package', label: 'Packung' },
  { value: 'portion', label: 'Portion' },
];

export function normalizeUnit(rawUnit: string | undefined | null): string {
  if (!rawUnit) return 'piece';
  const u = rawUnit.toLowerCase().trim();
  if (u === 'l' || u === 'liter' || u === 'litre') return 'l';
  if (u === 'g' || u === 'gramm' || u === 'gram') return 'g';
  if (u === 'kg' || u === 'kilogramm' || u === 'kilo') return 'kg';
  if (u === 'ml' || u === 'milliliter') return 'ml';
  if (u === 'piece' || u === 'stk' || u === 'stk.' || u === 'stück' || u === 'stueck')
    return 'piece';
  if (u === 'package' || u === 'packung' || u === 'pkg') return 'package';
  if (u === 'portion' || u === 'pck') return 'portion';
  if (['g', 'kg', 'ml', 'l', 'piece', 'package', 'portion'].includes(u)) return u;
  return 'piece';
}

export type GramsEquivalentOptions = { servingWeightG?: number };

export type GramsEquivalentResult = { convertible: true; grams: number } | { convertible: false };

/**
 * Rechnet eine Menge+Einheit in ein Gramm/Milliliter-Aequivalent um, als
 * Grundlage fuer eine Naehrwert-Skalierung "pro 100g/100ml".
 *
 * `g`/`ml` sind bereits das Aequivalent, `kg`/`l` werden mit 1000
 * multipliziert. Stueckbasierte Einheiten (`piece`/`package`/`portion`)
 * brauchen ein bekanntes Stueckgewicht (`servingWeightG`) — ohne das ist die
 * Umrechnung nicht moeglich und wird explizit als `convertible: false`
 * signalisiert statt eines stillen Fallbacks.
 */
export function toGramsEquivalent(
  quantity: number,
  unit: string,
  options?: GramsEquivalentOptions,
): GramsEquivalentResult {
  if (unit === 'g' || unit === 'ml') return { convertible: true, grams: quantity };
  if (unit === 'kg' || unit === 'l') return { convertible: true, grams: quantity * 1000 };
  if (unit === 'piece' || unit === 'package' || unit === 'portion') {
    if (options?.servingWeightG !== undefined) {
      return { convertible: true, grams: quantity * options.servingWeightG };
    }
    return { convertible: false };
  }
  return { convertible: false };
}

/**
 * Skaliert einen Naehrwert "pro 100g/100ml" auf die eingegebene Menge.
 *
 * Baut auf {@link toGramsEquivalent} auf. Ist die Einheit nicht umrechenbar
 * (stueckbasiert ohne `servingWeightG`), wird das explizit signalisiert statt
 * eines falschen Automatik-Werts.
 */
export type ScaleToQuantityResult = { convertible: true; value: number } | { convertible: false };

export function scaleToQuantity(
  per100: number,
  quantity: number,
  unit: string,
  options?: GramsEquivalentOptions,
): ScaleToQuantityResult {
  const equivalent = toGramsEquivalent(quantity, unit, options);
  if (!equivalent.convertible) return { convertible: false };
  return {
    convertible: true,
    value: Math.round(((per100 * equivalent.grams) / 100) * 10) / 10,
  };
}
