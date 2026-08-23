import type { ShoppingCategoryId } from './shopping-category-id';

/** `'user'` wird nur außerhalb der reinen Klassifikationspipeline vergeben. */
export type CategorySource = 'user' | 'household_preference' | 'off_taxonomy' | 'name_fallback';

export type CategoryClassification = {
  categoryId: ShoppingCategoryId | null;
  source: Exclude<CategorySource, 'user'> | null;
  classifierVersion: string;
  evidence?: {
    kind: 'off_tag' | 'name_rule';
    value: string;
  };
};

export type CategoryClassifierInputSource =
  | 'live'
  | 'barcode'
  | 'dump'
  | 'local_mirror'
  | 'free_text';

export type CategoryClassifierInput = {
  name: string;
  categoryTags?: readonly string[];
  source?: CategoryClassifierInputSource;
  dataVersion?: string | null;
};

export type CategoryCandidateKind = 'off_tag' | 'name_rule';

export type CategoryCandidate = {
  kind: CategoryCandidateKind;
  categoryId: ShoppingCategoryId;
  value: string;
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
