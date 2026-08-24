import type {
  PlacementZoneId,
  ProductFamilyId,
  ProductFormId,
  StoredPlacementZoneId,
} from './placement-taxonomy';

/**
 * Herkunft einer Kategorieentscheidung. `'user'` wird ausschließlich außerhalb
 * der reinen Klassifikationspipeline vergeben (siehe `preferences/`) — die
 * hier exportierten Klassifikationsfunktionen liefern ihn nie selbst.
 */
export type CategorySource =
  | 'user'
  | 'store_preference'
  | 'household_preference'
  | 'off_taxonomy'
  | 'name_fallback';

/** Kompakte Produktionsausgabe von {@link classifyCategory}. */
export type CategoryClassification = {
  categoryId: PlacementZoneId | null;
  source: Exclude<CategorySource, 'user'> | null;
  classifierVersion: string;
  evidence?: {
    kind: 'off_tag' | 'name_rule';
    value: string;
  };
};

/** Kanonischer V2-Snapshot fuer Klassifikation und spaetere Resolver. */
export type PlacementClassification = {
  productFamilyId: ProductFamilyId;
  productFormId: ProductFormId;
  placementZoneId: PlacementZoneId;
  classifierVersion: string;
  confidence: number;
  trace: PlacementTrace;
};

export type PlacementEvidence = {
  kind: 'off_tag' | 'name_rule' | 'legacy_mapping' | 'default';
  value: string;
};

export type PlacementTrace = {
  classifierVersion: string;
  input: CategoryTrace['input'];
  categoryTrace: CategoryTrace;
  legacyCategoryId: StoredPlacementZoneId | null;
  resolutionSource: 'off_taxonomy' | 'name_fallback' | 'legacy_mapping';
  productFamilyId: ProductFamilyId;
  productFormId: ProductFormId;
  placementZoneId: PlacementZoneId;
  confidence: number;
  evidence: PlacementEvidence;
};

/** Eingaben fuer den reinen Produktfamilie-/Form-Resolver. */
export type PlacementClassificationInput = CategoryClassifierInput & {
  productFamilyId?: ProductFamilyId;
  productFormId?: ProductFormId;
};

/** Herkunft der klassifizierten Rohdaten — nur für den Trace relevant. */
export type CategoryClassifierInputSource =
  | 'live'
  | 'barcode'
  | 'dump'
  | 'local_mirror'
  | 'free_text';

export type CategoryClassifierInput = {
  /** Roher, unnormalisierter Artikel-/Produktname. */
  name: string;
  /** Kanonische Open-Food-Facts-`categories_tags`, sofern vorhanden. */
  categoryTags?: readonly string[];
  source?: CategoryClassifierInputSource;
  /** OFF- bzw. Dump-Datenversion, nur zur Nachvollziehbarkeit im Trace. */
  dataVersion?: string | null;
};

export type CategoryCandidateKind = 'off_tag' | 'name_rule';

/** Ein gematchter, aber noch nicht zwingend gewonnener Kandidat. */
export type CategoryCandidate = {
  kind: CategoryCandidateKind;
  categoryId: PlacementZoneId;
  /** Der auslösende OFF-Tag bzw. das auslösende Namens-Token. */
  value: string;
  /** OFF-Regel-Priorität bzw. Namens-Regel-Score — höher gewinnt. */
  weight: number;
};

export type RejectedCategoryCandidate = CategoryCandidate & {
  reason: 'lower_priority' | 'lower_score' | 'tie';
};

export type CategoryTrace = {
  classifierVersion: string;
  input: {
    source: CategoryClassifierInputSource | null;
    dataVersion: string | null;
    categoryTags: readonly string[];
    normalizedName: string | null;
  };
  candidates: readonly CategoryCandidate[];
  rejectedCandidates: readonly RejectedCategoryCandidate[];
  winner: CategoryClassification;
  conflictReason: string | null;
};

/** Read-side boundary type for SQLite/Supabase rows during the V2 cutover. */
export type StoredCategoryId = StoredPlacementZoneId;
