import type { PlacementZoneId } from './placement-taxonomy';
import { normalizePlacementZoneIdNullable } from './placement-taxonomy';
import type { CategoryClassification, CategorySource, PlacementClassification } from './types';

export type PlacementSnapshot = {
  placementZoneId?: string | null;
  /** Read-side alias for the current technical column name. */
  categoryId?: string | null;
  source?: Exclude<CategorySource, 'user'> | null;
  classifierVersion?: string | null;
};

export type PlacementResolutionInput = {
  globalClassification: PlacementClassification;
  householdPreference?: string | null;
  storePreference?: string | null;
  snapshot?: PlacementSnapshot | null;
};

export function resolvePlacement(input: PlacementResolutionInput): PlacementClassification {
  const { globalClassification } = input;
  let zone = globalClassification.placementZoneId;
  let classifierVersion = globalClassification.classifierVersion;

  const householdZone = normalizePlacementZoneIdNullable(input.householdPreference);
  if (householdZone) {
    zone = householdZone;
  }

  const storeZone = normalizePlacementZoneIdNullable(input.storePreference);
  if (storeZone) {
    zone = storeZone;
  }

  if (input.snapshot) {
    const snapshotZone = normalizePlacementZoneIdNullable(
      input.snapshot.placementZoneId ?? input.snapshot.categoryId,
    );
    if (snapshotZone) {
      zone = snapshotZone;
      classifierVersion = input.snapshot.classifierVersion ?? classifierVersion;
    }
  }

  return {
    ...globalClassification,
    placementZoneId: zone,
    classifierVersion,
    confidence: globalClassification.confidence,
  };
}

/**
 * Adapter fuer die bestehende Kategorie-Pipeline. Er normalisiert Legacy-
 * Preferences ohne daraus ein Feedback-Event oder eine neue Klassifikation
 * abzuleiten.
 */
export function normalizeCategoryClassification(
  classification: CategoryClassification,
): CategoryClassification {
  return {
    ...classification,
    categoryId: normalizePlacementZoneIdNullable(classification.categoryId),
  };
}

export type { PlacementZoneId };
