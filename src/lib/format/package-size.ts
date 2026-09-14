function formatNumber(value: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 3 });
}

export function formatAmount(quantity: number, unit: string): string {
  const labels: Record<string, string> = {
    g: 'g',
    kg: 'kg',
    ml: 'ml',
    l: 'L',
    piece: 'Stück',
    portion: quantity === 1 ? 'Portion' : 'Portionen',
    package: quantity === 1 ? 'Packung' : 'Packungen',
  };
  return `${formatNumber(quantity)} ${labels[unit] ?? unit}`;
}

export function formatPackageSize(
  packageSize: number | null | undefined,
  packageSizeUnit: string | null | undefined,
): string | null {
  if (packageSize == null || !packageSizeUnit) return null;
  return formatAmount(packageSize, packageSizeUnit);
}

export function formatPackageHint(
  packageSize: number | null | undefined,
  packageSizeUnit: string | null | undefined,
): string | null {
  const size = formatPackageSize(packageSize, packageSizeUnit);
  return size ? `${size} je Packung` : null;
}
