import type { PlacementZoneId, StoredPlacementZoneId } from '../classification/placement-taxonomy';
import type { CategorySource } from '../classification/types';
import { LegacyCategoryField } from './placement-zone-field';

export interface CategoryFieldProps {
  label?: string;
  categoryOrder?: string | null;
  categoryId: StoredPlacementZoneId | null;
  source: CategorySource | null;
  onSelectCategory: (categoryId: PlacementZoneId) => void;
  onReset: () => void;
}

/**
 * Kompatibilitätsadapter für ältere Aufrufer. Die fachliche Implementierung
 * lebt ausschließlich in `PlacementZoneField`, damit Auswahl, Reihenfolge und
 * „Automatisch“ dieselben Semantiken verwenden.
 */
export function CategoryField({
  label,
  categoryOrder,
  categoryId,
  source,
  onSelectCategory,
  onReset,
}: CategoryFieldProps) {
  return (
    <LegacyCategoryField
      label={label}
      categoryId={categoryId}
      source={source}
      categoryOrder={categoryOrder ? categoryOrder.split(',') : null}
      onSelectCategory={onSelectCategory}
      onReset={onReset}
    />
  );
}
