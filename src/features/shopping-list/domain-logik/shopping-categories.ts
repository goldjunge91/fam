import {
  normalizePlacementOrder,
  normalizePlacementZoneIdNullable,
  PLACEMENT_ZONES,
  type PlacementZone,
  type PlacementZoneId,
  placementZoneForId,
  placementZoneForLabel,
  type StorageKind,
} from '../classification/placement-taxonomy';

export type ShoppingCategory = PlacementZone;
export type {
  PlacementZoneId as ShoppingCategoryId,
  StorageKind,
} from '../classification/placement-taxonomy';

export const UNCATEGORIZED_LABEL = 'Sonstiges';
export const UNCATEGORIZED_SORT_ORDER = 999;

/** Anzeige-/Sortieradapter auf die kanonische Placement-Taxonomie. */
export const SHOPPING_CATEGORIES: readonly ShoppingCategory[] = PLACEMENT_ZONES;

export function categoryIdForLabel(label: string | null): PlacementZoneId | null {
  return placementZoneForLabel(label)?.id ?? null;
}

/** Legacy-IDs werden ausschliesslich beim Lesen auf V2 normalisiert. */
export function categoryLabelForId(categoryId: string | null): string | null {
  return placementZoneForId(categoryId)?.label ?? null;
}

export function sortOrderForCategory(label: string | null): number {
  return placementZoneForLabel(label)?.sortOrder ?? UNCATEGORIZED_SORT_ORDER;
}

export function storageKindForCategory(label: string | null): StorageKind {
  return placementZoneForLabel(label)?.storageKind ?? 'pantry';
}

export function colorForCategory(label: string | null): string | null {
  return placementZoneForLabel(label)?.color ?? null;
}

export function distinctCategoryColors(labels: readonly (string | null)[]): string[] {
  const orderedColors = labels
    .map((label) => placementZoneForLabel(label))
    .filter((zone): zone is PlacementZone => zone !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((zone) => zone.color);

  return [...new Set(orderedColors)];
}

export function parseCategoryOrder(raw: string | null | undefined): PlacementZoneId[] {
  if (!raw) return [];
  return normalizePlacementOrder(raw.split(','));
}

export function serializeCategoryOrder(ids: readonly string[]): string {
  return normalizePlacementOrder(ids).join(',');
}

export function effectiveSortOrder(
  label: string | null,
  customOrderIds: readonly string[] | null | undefined,
): number {
  const zone = placementZoneForLabel(label);
  if (!zone) return UNCATEGORIZED_SORT_ORDER;
  if (customOrderIds && customOrderIds.length > 0) {
    const normalizedOrder = normalizePlacementOrder(customOrderIds);
    const index = normalizedOrder.indexOf(zone.id);
    return index === -1 ? UNCATEGORIZED_SORT_ORDER : index;
  }
  return zone.sortOrder;
}

/** Reine ID-Normalisierung fuer Gruppierungs- und Snapshot-Integrationspunkte. */
export function normalizeCategoryId(value: string | null | undefined): PlacementZoneId | null {
  return normalizePlacementZoneIdNullable(value);
}
