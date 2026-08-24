/**
 * Kompatibilitätsmodul für den Category-Debugger.
 * Die Taxonomie selbst lebt ausschließlich in der App-Domäne.
 */
export {
  LEGACY_CATEGORY_ALIASES,
  LEGACY_CATEGORY_TO_ZONE,
  PLACEMENT_CLASSIFIER_VERSION,
  PLACEMENT_TAXONOMY_VERSION,
  PLACEMENT_ZONE_DEFINITIONS,
  PLACEMENT_ZONE_IDS,
  PRODUCT_FAMILY_GROUPS,
  PRODUCT_FAMILY_IDS,
  PRODUCT_FORM_DEFINITIONS,
  PRODUCT_FORM_IDS,
  isPlacementZoneId,
  normalizePlacementZoneId,
  placementZoneDefinition,
  placementZoneLabel,
  productFamilyLabel,
  productFormLabel,
  resolvePlacementZone,
} from '../../../../src/features/shopping-list/classification/placement-taxonomy';

export { PLACEMENT_TAXONOMY_VERSION as TAXONOMY_VERSION } from '../../../../src/features/shopping-list/classification/placement-taxonomy';

export type {
  LegacyPlacementZoneId,
  PlacementZoneDefinition,
  PlacementZoneId,
  ProductFamilyId,
  ProductFormId,
  StorageKind,
  StoredPlacementZoneId,
} from '../../../../src/features/shopping-list/classification/placement-taxonomy';
