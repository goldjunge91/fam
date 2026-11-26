import type { TFunction } from 'i18next';

function formatNumber(value: number, locale: string): string {
  return value.toLocaleString(locale, { maximumFractionDigits: 3 });
}

function formatUnitLabel(quantity: number, unit: string, t?: TFunction): string {
  switch (unit) {
    case 'g':
      return 'g';
    case 'kg':
      return 'kg';
    case 'ml':
      return 'ml';
    case 'l':
      return 'L';
    case 'piece':
      return quantity === 1
        ? (t?.('common.units.piece') ?? 'Stück')
        : (t?.('common.units.piecePlural') ?? 'Stück');
    case 'portion':
      return quantity === 1
        ? (t?.('common.units.portion') ?? 'Portion')
        : (t?.('common.units.portionPlural') ?? 'Portionen');
    case 'package':
      return quantity === 1
        ? (t?.('common.units.package') ?? 'Packung')
        : (t?.('common.units.packagePlural') ?? 'Packungen');
    default:
      return unit;
  }
}

export function formatAmount(
  quantity: number,
  unit: string,
  t?: TFunction,
  locale = 'de-DE',
): string {
  return `${formatNumber(quantity, locale)} ${formatUnitLabel(quantity, unit, t)}`;
}

export function formatPackageSize(
  packageSize: number | null | undefined,
  packageSizeUnit: string | null | undefined,
  t?: TFunction,
  locale = 'de-DE',
): string | null {
  if (packageSize == null || !packageSizeUnit) return null;
  return formatAmount(packageSize, packageSizeUnit, t, locale);
}

export function formatPackageHint(
  packageSize: number | null | undefined,
  packageSizeUnit: string | null | undefined,
  t?: TFunction,
  locale = 'de-DE',
): string | null {
  const size = formatPackageSize(packageSize, packageSizeUnit, t, locale);
  if (!size) return null;
  return `${size} ${t?.('common.units.perPackage') ?? 'je Packung'}`;
}
