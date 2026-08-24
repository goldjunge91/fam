import type { CategoryTrace } from '../../../../src/features/shopping-list/classification/types';
import type { PlacementZoneId, ProductFamilyId, ProductFormId } from './taxonomy';

export const CANONICAL_CATEGORY_IDS = [
  'produce',
  'bakery',
  'convenience',
  'breakfast',
  'hot_beverages',
  'pantry_staples',
  'cooking_baking',
  'canned_sauces',
  'snacks',
  'beverages',
  'drugstore',
  'baby_kids',
  'household',
  'pet_supplies',
  'meat_poultry',
  'fish_seafood',
  'deli_cold_cuts',
  'plant_based',
  'dairy_eggs',
  'frozen',
  'checkout',
] as const;

export const BASELINE_IDS = ['linear_ngram', 'robotoff', 'fasttext', 'setfit', 'siglip'] as const;
export type BaselineId = (typeof BASELINE_IDS)[number];

export type CanonicalCategoryId = (typeof CANONICAL_CATEGORY_IDS)[number];
export type EvaluationClass = CanonicalCategoryId | 'other';
export type EvaluationLabelStatus = 'labeled' | 'ambiguous' | 'invalid';
export type EvaluationSplit = 'calibration' | 'holdout';
export type EvaluationQueue = 'disagreement' | 'tie' | 'no_signal' | 'stratified' | 'version_changes';

export type EvaluationProduct = {
  productKey: string;
  snapshotHash: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  quantity: string | null;
  categoryTags: string[];
  split: EvaluationSplit;
};

export type EvaluationLabel = EvaluationProduct & {
  id: number;
  reviewerId: number;
  expectedCategoryId: CanonicalCategoryId | null;
  status: EvaluationLabelStatus;
  note: string | null;
  classifierVersionAtLabel: string;
  originalPredictionCategoryId: CanonicalCategoryId | null;
  originalPredictionSource: 'off_taxonomy' | 'name_fallback' | null;
  expectedProductFamilyId: ProductFamilyId | null;
  expectedProductFormId: ProductFormId | null;
  expectedPlacementZoneId: PlacementZoneId | null;
  taxonomyVersionAtLabel: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SaveEvaluationLabel = Omit<
  EvaluationLabel,
  'id' | 'reviewerId' | 'createdAt' | 'updatedAt'
>;

export type SilverAnnotationStatus = 'labeled' | 'abstained' | 'invalid';
export type SilverReviewStatus = 'pending' | 'accepted' | 'rejected';

export type EvaluationSilverLabel = EvaluationProduct & {
  id: number;
  reviewerId: number;
  proposedCategoryId: CanonicalCategoryId | null;
  alternativeCategoryId: CanonicalCategoryId | null;
  annotationStatus: SilverAnnotationStatus;
  reviewStatus: SilverReviewStatus;
  modelProvider: string;
  modelName: string;
  promptVersion: string;
  promptFingerprint: string;
  rationale: string | null;
  evidence: string[];
  rawResponse: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type GenerateSilverLabels = {
  products: EvaluationProduct[];
};

export type CrowdSignalSource = 'alpha_app' | 'manual_import';
export type CrowdSignalEventType = 'product_moved';
export type CrowdSignalReviewDecision = 'confirmed' | 'rejected' | 'duplicate' | 'insufficient_context';

export type CrowdSignalInput = {
  eventId: string;
  schemaVersion: 1;
  source: CrowdSignalSource;
  eventType: CrowdSignalEventType;
  occurredAt: string;
  actorKey: string;
  householdKey: string;
  storeKey: string | null;
  productKey: string;
  barcode: string | null;
  productName: string;
  fromZoneId: string | null;
  toZoneId: string;
  classifierVersion: string;
  payload: Record<string, unknown>;
};

export type CrowdSignalReview = {
  id: number;
  signalId: number;
  reviewerId: number;
  decision: CrowdSignalReviewDecision;
  productFamilyId: ProductFamilyId | null;
  productFormId: ProductFormId | null;
  placementZoneId: PlacementZoneId | null;
  trainingApproved: boolean;
  note: string | null;
  createdAt: string;
};

export type CrowdSignal = CrowdSignalInput & {
  id: number;
  payloadSha256: string;
  rawPayload: Record<string, unknown>;
  receivedAt: string;
  latestReview: CrowdSignalReview | null;
};

export type SaveCrowdSignalReview = Omit<CrowdSignalReview, 'id' | 'reviewerId' | 'createdAt'>;

export type CrowdSignalImportFile = {
  schema: 'nutritrack-crowd-signals';
  version: 1;
  exportedAt?: string;
  events: CrowdSignalInput[];
};

export type BaselineDefinition = {
  id: BaselineId;
  label: string;
  description: string;
  available: boolean;
  unavailableReason: string | null;
  externalNetwork: boolean;
};

export type RuleSignalType = 'name_token' | 'name_bigram' | 'off_tag';

export type RuleProposal = {
  signalType: RuleSignalType;
  signal: string;
  categoryId: CanonicalCategoryId;
  calibrationMatches: number;
  calibrationPrecision: number;
  calibrationLift: number;
  confidenceLowerBound: number;
  currentClassifierErrors: number;
  holdoutMatches: number;
  holdoutPrecision: number | null;
  examples: string[];
};

export type EvaluationPrediction = {
  labelId: number;
  predictedCategoryId: CanonicalCategoryId | null;
  predictionSource: 'off_taxonomy' | 'name_fallback' | null;
  conflictReason: string | null;
  trace: EvaluationTrace;
};

type LegacyEvaluationCandidate = Omit<CategoryTrace['candidates'][number], 'categoryId'> & {
  categoryId: CanonicalCategoryId;
};

type LegacyEvaluationWinner = Omit<CategoryTrace['winner'], 'categoryId'> & {
  categoryId: CanonicalCategoryId | null;
};

/**
 * Baselines still target the legacy evaluation classes, while live classifier
 * runs carry the app's V2 placement-zone trace. Keep that compatibility
 * boundary explicit instead of assigning legacy IDs to the V2 CategoryTrace.
 */
export type LegacyEvaluationTrace = Omit<
  CategoryTrace,
  'candidates' | 'rejectedCandidates' | 'winner'
> & {
  candidates: readonly LegacyEvaluationCandidate[];
  rejectedCandidates: readonly (LegacyEvaluationCandidate & {
    reason: CategoryTrace['rejectedCandidates'][number]['reason'];
  })[];
  winner: LegacyEvaluationWinner;
};

export type EvaluationTrace = CategoryTrace | LegacyEvaluationTrace;

export type CategoryMetric = {
  categoryId: EvaluationClass;
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  support: number;
  precision: number | null;
  recall: number | null;
  f1: number | null;
};

export type ConfusionEntry = {
  expected: EvaluationClass;
  predicted: EvaluationClass;
  count: number;
};

export type ConfusionMatrixRow = {
  expected: EvaluationClass;
  counts: Record<EvaluationClass, number>;
  total: number;
};

export type SourceMetric = {
  source: 'off_taxonomy' | 'name_fallback' | 'none';
  count: number;
  correct: number;
  accuracy: number | null;
};

export type EvaluationMetrics = {
  totalReviewed: number;
  labeledCount: number;
  ambiguousCount: number;
  invalidCount: number;
  calibrationCount: number;
  holdoutCount: number;
  correctCount: number;
  accuracy: number | null;
  coverage: number | null;
  macroF1: number | null;
  overclassifiedCount: number;
  missedCount: number;
  categoryMetrics: CategoryMetric[];
  confusion: ConfusionEntry[];
  sourceMetrics: SourceMetric[];
};

export type EvaluationRun = {
  id: number;
  classifierVersion: string;
  classifierFingerprint: string;
  dumpFingerprint: string;
  dumpProductCount: number;
  labelCount: number;
  metrics: EvaluationMetrics;
  createdAt: string;
};

export type EvaluationRunDetail = EvaluationRun & {
  predictions: EvaluationPrediction[];
};

export type RunComparison = {
  improved: number;
  regressed: number;
  newlyClassified: number;
  newlyUnclassified: number;
  unchangedCorrect: number;
  unchangedWrong: number;
  changedLabelIds: number[];
};
