import type { ShoppingCategoryId } from './shopping-category-id';

/**
 * Herkunft einer Kategorieentscheidung. `'user'` wird ausschließlich außerhalb
 * der reinen Klassifikationspipeline vergeben (siehe `preferences/`) — die
 * hier exportierten Klassifikationsfunktionen liefern ihn nie selbst.
 */
export type CategorySource = 'user' | 'household_preference' | 'off_taxonomy' | 'name_fallback';

/** Kompakte Produktionsausgabe von {@link classifyCategory}. */
export type CategoryClassification = {
  categoryId: ShoppingCategoryId | null;
  source: Exclude<CategorySource, 'user'> | null;
  classifierVersion: string;
  evidence?: {
    kind: 'off_tag' | 'name_rule';
    value: string;
  };
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
  categoryId: ShoppingCategoryId;
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
