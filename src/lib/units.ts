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
