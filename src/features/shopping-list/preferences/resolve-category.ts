import { classifyPlacement } from '../classification/placement-classifier';
import { resolvePlacement } from '../classification/placement-resolver';
import type { StoredPlacementZoneId } from '../classification/placement-taxonomy';
import type {
  CategorySource,
  PlacementClassification,
  PlacementClassificationInput,
} from '../classification/types';

export type CategoryPreferenceMatch = {
  categoryId: StoredPlacementZoneId | null;
};

export type CategoryPreferenceScope = {
  productPreference?: CategoryPreferenceMatch | null;
  namePreference?: CategoryPreferenceMatch | null;
};

export type ResolveCategoryInput = PlacementClassificationInput & {
  /** Praeferenz fuer die aktuelle `product_id`, sofern eine existiert. */
  productPreference?: CategoryPreferenceMatch | null;
  /** Praeferenz fuer den normalisierten Freitextnamen, sofern eine existiert. */
  namePreference?: CategoryPreferenceMatch | null;
  /** Haushaltspräferenz, explizit benannt für den mehrstufigen Resolver. */
  householdPreference?: CategoryPreferenceScope | null;
  /** Marktpräferenz. Sie ist spezifischer als die Haushaltspräferenz. */
  storePreference?: CategoryPreferenceMatch | null;
};

export type ResolvedPlacementClassification = PlacementClassification & {
  /** Read-side compatibility alias for the technical database column. */
  categoryId: PlacementClassification['placementZoneId'];
  source: Exclude<CategorySource, 'user'>;
  /** Unmodified V2 prediction, before household/store preferences. */
  globalClassification: PlacementClassification;
};

export function resolveCategory(input: ResolveCategoryInput): ResolvedPlacementClassification {
  const globalClassification = classifyPlacement(input);
  const householdPreference = input.householdPreference
    ? (input.householdPreference.productPreference ?? input.householdPreference.namePreference)
    : (input.productPreference ?? input.namePreference);
  const resolvedPlacement = resolvePlacement({
    globalClassification,
    householdPreference: householdPreference
      ? (householdPreference.categoryId ?? 'other')
      : undefined,
    storePreference: input.storePreference
      ? (input.storePreference.categoryId ?? 'other')
      : undefined,
  });
  const preferenceMatch = input.storePreference ?? householdPreference;
  if (preferenceMatch) {
    const placementZoneId = resolvedPlacement.placementZoneId;
    return {
      ...globalClassification,
      placementZoneId,
      categoryId: placementZoneId,
      source: input.storePreference ? 'store_preference' : 'household_preference',
      globalClassification,
    };
  }

  const source =
    globalClassification.trace.categoryTrace.winner.source === 'off_taxonomy'
      ? 'off_taxonomy'
      : 'name_fallback';
  return {
    ...globalClassification,
    categoryId: globalClassification.placementZoneId,
    source,
    globalClassification,
  };
}
