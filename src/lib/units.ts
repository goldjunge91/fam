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
