/**
 * Technischer Read-Side-Typ für `category_id` während des V2-Cutovers.
 * Neue Klassifikations- und Schreib-APIs verwenden explizit `PlacementZoneId`;
 * bestehende Dumps, UI-Fixtures und Snapshots dürfen Legacy-IDs weiter lesen.
 */
export type {
  LegacyPlacementZoneId,
  PlacementZoneId,
  StoredPlacementZoneId as ShoppingCategoryId,
  StoredPlacementZoneId,
} from './placement-taxonomy';
