import type { TFunction } from 'i18next';

/** Canonical unit values stored in local and remote data. */
export const UNIT_VALUES = ['piece', 'g', 'kg', 'ml', 'l', 'package', 'portion'] as const;
export type UnitValue = (typeof UNIT_VALUES)[number];

export type UnitOption = {
  value: UnitValue;
  label: string;
};

/**
 * Builds display options from the active translation function. Values stay
 * canonical so callers can persist and normalize them without locale data.
 */
export function getUnitOptions(t: TFunction): readonly UnitOption[] {
  return UNIT_VALUES.map((value) => ({
    value,
    label: t(`common.units.${value}`),
  }));
}

function isUnitValue(value: string): value is UnitValue {
  return UNIT_VALUES.includes(value as UnitValue);
}

function resolveKnownUnit(rawUnit: string | undefined | null): UnitValue | null {
  if (!rawUnit) return null;
  const u = rawUnit.toLowerCase().trim();
  if (u === 'l' || u === 'liter' || u === 'litre') return 'l';
  if (u === 'g' || u === 'gramm' || u === 'gram') return 'g';
  if (u === 'kg' || u === 'kilogramm' || u === 'kilo') return 'kg';
  if (u === 'ml' || u === 'milliliter') return 'ml';
  if (u === 'piece' || u === 'stk' || u === 'stk.' || u === 'stück' || u === 'stueck')
    return 'piece';
  if (u === 'package' || u === 'packung' || u === 'pkg') return 'package';
  if (u === 'portion' || u === 'pck') return 'portion';
  return isUnitValue(u) ? u : null;
}

export function getUnitLabel(rawUnit: string, t: TFunction): string {
  const trimmed = rawUnit.trim();
  const normalized = resolveKnownUnit(trimmed);
  return normalized ? t(`common.units.${normalized}`) : trimmed || t('common.units.piece');
}

export function normalizeUnit(rawUnit: string | undefined | null): UnitValue {
  return resolveKnownUnit(rawUnit) ?? 'piece';
}

export type GramsEquivalentOptions = { servingWeightG?: number };

export type GramsEquivalentResult = { convertible: true; grams: number } | { convertible: false };

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
