import { Database as SqliteDatabase } from 'bun:sqlite';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { CLASSIFIER_VERSION } from '../../../src/features/shopping-list/classification/classifier-version';
import { explainCategory } from '../../../src/features/shopping-list/classification/shopping-category-classifier';
import type { CategoryTrace } from '../../../src/features/shopping-list/classification/types';
import type { Database, Json, Tables } from './database.types';
import { computeEvaluationMetrics } from './evaluation/metrics';
import { BASELINE_IDS, baselineDefinitions, runBaseline, type BaselineId } from './evaluation/baseline-models';
import { parseCrowdSignalImport, parseCrowdSignalReview } from './evaluation/crowd-signals';
import { createEvaluationExport, parseEvaluationExport } from './evaluation/import-export';
import {
  labelProductWithOpenAi,
  LLM_PROMPT_FINGERPRINT,
  LLM_PROMPT_VERSION,
} from './evaluation/llm-labeler';
import { mineRuleProposals } from './evaluation/rule-miner';
import {
  CANONICAL_CATEGORY_IDS,
  type CanonicalCategoryId,
  type CrowdSignal,
  type CrowdSignalInput,
  type CrowdSignalReview,
  type EvaluationLabel,
  type EvaluationMetrics,
  type EvaluationPrediction,
  type EvaluationRun,
  type EvaluationRunDetail,
  type EvaluationSilverLabel,
  type EvaluationProduct,
  type SaveEvaluationLabel,
} from './evaluation/types';
import {
  PLACEMENT_ZONE_IDS,
  PRODUCT_FAMILY_IDS,
  PRODUCT_FORM_IDS,
  type PlacementZoneId,
  type ProductFamilyId,
  type ProductFormId,
} from './evaluation/taxonomy';

const TOOL_ROOT = path.resolve(import.meta.dirname, '..');
const DIST_ROOT = path.join(TOOL_ROOT, 'dist');
const DUMP_PATH = path.join(TOOL_ROOT, 'public', 'off-dump.db');
const IMAGE_DATA_DIR = process.env.OFF_IMAGE_DATA_DIR ?? process.env.DUMP_DATA_DIR ?? '/Volumes/Programme/off-dump-data';
const IMAGE_DB_PATH = process.env.OFF_IMAGE_DB ?? path.join(IMAGE_DATA_DIR, 'product_images_de.db');
const IMAGE_ROOT = process.env.OFF_IMAGE_ROOT ?? path.join(IMAGE_DATA_DIR, 'product-images-de');
const CLASSIFIER_FILES = [
  '../../../src/features/shopping-list/classification/classifier-version.ts',
  '../../../src/features/shopping-list/classification/name-category-rules.ts',
  '../../../src/features/shopping-list/classification/normalize-shopping-name.ts',
  '../../../src/features/shopping-list/classification/off-category-rules.ts',
  '../../../src/features/shopping-list/classification/shopping-category-classifier.ts',
].map((file) => path.resolve(import.meta.dirname, file));

const supabaseUrl = requireEnv('SUPABASE_URL');
const supabaseSecretKey = requireEnv('SUPABASE_SECRET_KEY');
const reviewerSlug = process.env.EVALUATION_REVIEWER_SLUG ?? 'local-reviewer';
const reviewerName = process.env.EVALUATION_REVIEWER_NAME ?? 'Local reviewer';
const port = Number.parseInt(process.env.EVALUATION_API_PORT ?? '4174', 10);

const supabase = createClient<Database>(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

type ReviewerRow = Tables<'evaluation_reviewers'>;
type LabelRow = Tables<'evaluation_labels'>;
type SilverLabelRow = Tables<'evaluation_silver_labels'>;
type RunRow = Tables<'evaluation_runs'>;
type PredictionRow = Tables<'evaluation_run_predictions'>;
type CrowdSignalRow = Tables<'evaluation_crowd_signals'>;
type CrowdSignalReviewRow = Tables<'evaluation_crowd_signal_reviews'>;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} fehlt. Lege tools/category-debugger/.env.local an.`);
  return value;
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isLocalOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]');
  } catch {
    return false;
  }
}

function isCanonicalCategory(value: unknown): value is CanonicalCategoryId {
  return typeof value === 'string' && (CANONICAL_CATEGORY_IDS as readonly string[]).includes(value);
}

function nullableCategory(value: unknown): CanonicalCategoryId | null | undefined {
  if (value === null) return null;
  return isCanonicalCategory(value) ? value : undefined;
}

function isPredictionSource(value: unknown): value is 'off_taxonomy' | 'name_fallback' {
  return value === 'off_taxonomy' || value === 'name_fallback';
}

function taxonomyId<T extends string>(value: unknown, allowed: readonly string[]): T | null | undefined {
  if (value === null) return null;
  return typeof value === 'string' && allowed.includes(value) ? value as T : undefined;
}

function evaluationSource(source: CategoryTrace['winner']['source']): EvaluationPrediction['predictionSource'] {
  return isPredictionSource(source) ? source : null;
}

function labelFromRow(row: LabelRow): EvaluationLabel {
  return {
    id: row.id,
    reviewerId: row.reviewer_id,
    productKey: row.product_key,
    snapshotHash: row.product_snapshot_hash,
    barcode: row.barcode,
    name: row.product_name,
    brand: row.brand,
    quantity: row.quantity,
    categoryTags: row.category_tags,
    split: row.dataset_split as EvaluationLabel['split'],
    expectedCategoryId: row.expected_category_id as CanonicalCategoryId | null,
    status: row.status as EvaluationLabel['status'],
    note: row.note,
    classifierVersionAtLabel: row.classifier_version_at_label,
    originalPredictionCategoryId: row.original_prediction_category_id as CanonicalCategoryId | null,
    originalPredictionSource: row.original_prediction_source as EvaluationLabel['originalPredictionSource'],
    expectedProductFamilyId: row.expected_product_family_id as ProductFamilyId | null,
    expectedProductFormId: row.expected_product_form_id as ProductFormId | null,
    expectedPlacementZoneId: row.expected_placement_zone_id as PlacementZoneId | null,
    taxonomyVersionAtLabel: row.taxonomy_version_at_label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function crowdSignalReviewFromRow(row: CrowdSignalReviewRow): CrowdSignalReview {
  return {
    id: row.id,
    signalId: row.signal_id,
    reviewerId: row.reviewer_id,
    decision: row.decision as CrowdSignalReview['decision'],
    productFamilyId: row.product_family_id as ProductFamilyId | null,
    productFormId: row.product_form_id as ProductFormId | null,
    placementZoneId: row.placement_zone_id as PlacementZoneId | null,
    trainingApproved: row.training_approved,
    note: row.note,
    createdAt: row.created_at,
  };
}

function crowdSignalFromRow(row: CrowdSignalRow, latestReview: CrowdSignalReview | null): CrowdSignal {
  return {
    id: row.id,
    eventId: row.event_id,
    schemaVersion: 1,
    source: row.source as CrowdSignal['source'],
    eventType: row.event_type as CrowdSignal['eventType'],
    occurredAt: row.occurred_at,
    receivedAt: row.received_at,
    actorKey: row.actor_key,
    householdKey: row.household_key,
    storeKey: row.store_key,
    productKey: row.product_key,
    barcode: row.barcode,
    productName: row.product_name,
    fromZoneId: row.from_zone_id,
    toZoneId: row.to_zone_id,
    classifierVersion: row.classifier_version,
    payload: row.raw_payload as Record<string, unknown>,
    payloadSha256: row.payload_sha256,
    rawPayload: row.raw_payload as Record<string, unknown>,
    latestReview,
  };
}

function silverLabelFromRow(row: SilverLabelRow): EvaluationSilverLabel {
  return {
    id: row.id,
    reviewerId: row.reviewer_id,
    productKey: row.product_key,
    snapshotHash: row.product_snapshot_hash,
    barcode: row.barcode,
    name: row.product_name,
    brand: row.brand,
    quantity: row.quantity,
    categoryTags: row.category_tags,
    split: row.dataset_split as EvaluationSilverLabel['split'],
    proposedCategoryId: row.proposed_category_id as CanonicalCategoryId | null,
    alternativeCategoryId: row.alternative_category_id as CanonicalCategoryId | null,
    annotationStatus: row.annotation_status as EvaluationSilverLabel['annotationStatus'],
    reviewStatus: row.review_status as EvaluationSilverLabel['reviewStatus'],
    modelProvider: row.model_provider,
    modelName: row.model_name,
    promptVersion: row.prompt_version,
    promptFingerprint: row.prompt_fingerprint,
    rationale: row.rationale,
    evidence: row.evidence,
    rawResponse: row.raw_response as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function predictionFromRow(row: PredictionRow): EvaluationPrediction {
  return {
    labelId: row.label_id,
    predictedCategoryId: row.predicted_category_id as CanonicalCategoryId | null,
    predictionSource: row.prediction_source as EvaluationPrediction['predictionSource'],
    conflictReason: row.conflict_reason,
    trace: row.trace as unknown as EvaluationPrediction['trace'],
  };
}

function runFromRow(row: RunRow): EvaluationRun {
  return {
    id: row.id,
    classifierVersion: row.classifier_version,
    classifierFingerprint: row.classifier_fingerprint,
    dumpFingerprint: row.dump_fingerprint,
    dumpProductCount: row.dump_product_count,
    labelCount: row.label_count,
    metrics: row.metrics as unknown as EvaluationMetrics,
    createdAt: row.created_at,
  };
}

function validateLabel(input: unknown): SaveEvaluationLabel {
  if (!input || typeof input !== 'object') throw new Error('Ungültiges Label-Payload.');
  const value = input as Record<string, unknown>;
  const expectedCategoryId = nullableCategory(value.expectedCategoryId);
  const originalPredictionCategoryId = nullableCategory(value.originalPredictionCategoryId);
  const expectedProductFamilyId = taxonomyId<ProductFamilyId>(value.expectedProductFamilyId, PRODUCT_FAMILY_IDS);
  const expectedProductFormId = taxonomyId<ProductFormId>(value.expectedProductFormId, PRODUCT_FORM_IDS);
  const expectedPlacementZoneId = taxonomyId<PlacementZoneId>(value.expectedPlacementZoneId, PLACEMENT_ZONE_IDS);
  const status = value.status;
  const split = value.split;
  if (typeof value.productKey !== 'string' || value.productKey.length < 3) throw new Error('productKey fehlt.');
  if (typeof value.snapshotHash !== 'string' || !/^[a-f0-9]{64}$/.test(value.snapshotHash)) throw new Error('snapshotHash ist ungültig.');
  if (typeof value.name !== 'string' || value.name.trim().length === 0) throw new Error('Produktname fehlt.');
  if (value.barcode !== null && (typeof value.barcode !== 'string' || !/^[0-9]{6,32}$/.test(value.barcode))) throw new Error('Barcode ist ungültig.');
  if (!Array.isArray(value.categoryTags) || value.categoryTags.some((tag) => typeof tag !== 'string')) throw new Error('categoryTags sind ungültig.');
  if (expectedCategoryId === undefined || originalPredictionCategoryId === undefined) throw new Error('Kategorie-ID ist ungültig.');
  if (expectedProductFamilyId === undefined || expectedProductFormId === undefined || expectedPlacementZoneId === undefined) {
    throw new Error('Taxonomie-ID ist ungültig.');
  }
  if (status !== 'labeled' && status !== 'ambiguous' && status !== 'invalid') throw new Error('Label-Status ist ungültig.');
  if (status !== 'labeled' && expectedCategoryId !== null) throw new Error('Nur gelabelte Produkte dürfen eine Kategorie tragen.');
  if (split !== 'calibration' && split !== 'holdout') throw new Error('Dataset-Split ist ungültig.');
  if (typeof value.classifierVersionAtLabel !== 'string' || value.classifierVersionAtLabel.length === 0) throw new Error('Classifier-Version fehlt.');
  if (value.originalPredictionSource !== null && !isPredictionSource(value.originalPredictionSource)) throw new Error('Vorhersagequelle ist ungültig.');
  const taxonomyVersionAtLabel = typeof value.taxonomyVersionAtLabel === 'string' && value.taxonomyVersionAtLabel.trim()
    ? value.taxonomyVersionAtLabel.trim()
    : null;
  const taxonomyFields = [expectedProductFamilyId, expectedProductFormId, expectedPlacementZoneId, taxonomyVersionAtLabel];
  const taxonomyComplete = taxonomyFields.every((field) => field !== null);
  if (!taxonomyComplete && taxonomyFields.some((field) => field !== null)) throw new Error('Taxonomie-Label ist unvollständig.');
  if (taxonomyComplete && status !== 'labeled') throw new Error('Nur gelabelte Produkte dürfen eine Taxonomie tragen.');

  return {
    productKey: value.productKey,
    snapshotHash: value.snapshotHash,
    barcode: value.barcode,
    name: value.name.trim(),
    brand: typeof value.brand === 'string' && value.brand.trim() ? value.brand.trim() : null,
    quantity: typeof value.quantity === 'string' && value.quantity.trim() ? value.quantity.trim() : null,
    categoryTags: value.categoryTags as string[],
    split,
    expectedCategoryId,
    status,
    note: typeof value.note === 'string' && value.note.trim() ? value.note.trim() : null,
    classifierVersionAtLabel: value.classifierVersionAtLabel,
    originalPredictionCategoryId,
    originalPredictionSource: value.originalPredictionSource,
    expectedProductFamilyId,
    expectedProductFormId,
    expectedPlacementZoneId,
    taxonomyVersionAtLabel,
  };
}

async function fetchCrowdSignals(): Promise<CrowdSignal[]> {
  const { data: signalRows, error: signalError } = await supabase
    .from('evaluation_crowd_signals')
    .select('*')
    .order('received_at', { ascending: false })
    .limit(2000);
  if (signalError) throw signalError;
  if (signalRows.length === 0) return [];
  const { data: reviewRows, error: reviewError } = await supabase
    .from('evaluation_crowd_signal_reviews')
    .select('*')
    .in('signal_id', signalRows.map((row) => row.id))
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
  if (reviewError) throw reviewError;
  const latestReviews = new Map<number, CrowdSignalReview>();
  for (const row of reviewRows) {
    if (!latestReviews.has(row.signal_id)) latestReviews.set(row.signal_id, crowdSignalReviewFromRow(row));
  }
  return signalRows.map((row) => crowdSignalFromRow(row, latestReviews.get(row.id) ?? null));
}

function crowdSignalInsertRow(
  event: CrowdSignalInput,
  rawPayload: Record<string, unknown>,
): Database['public']['Tables']['evaluation_crowd_signals']['Insert'] {
  return {
    event_id: event.eventId,
    schema_version: event.schemaVersion,
    source: event.source,
    event_type: event.eventType,
    occurred_at: event.occurredAt,
    actor_key: event.actorKey,
    household_key: event.householdKey,
    store_key: event.storeKey,
    product_key: event.productKey,
    barcode: event.barcode,
    product_name: event.productName,
    from_zone_id: event.fromZoneId,
    to_zone_id: event.toZoneId,
    classifier_version: event.classifierVersion,
    payload_sha256: createHash('sha256').update(JSON.stringify(rawPayload)).digest('hex'),
    raw_payload: rawPayload as Json,
  };
}

async function importCrowdSignals(input: unknown): Promise<{ imported: number; signals: CrowdSignal[] }> {
  const parsed = parseCrowdSignalImport(input);
  const inputRecord = input as Record<string, unknown>;
  const rawEvents = inputRecord.events as Record<string, unknown>[];
  let imported = 0;
  for (let start = 0; start < parsed.events.length; start += 500) {
    const rows = parsed.events.slice(start, start + 500).map((event, index) => (
      crowdSignalInsertRow(event, rawEvents[start + index]!)
    ));
    const { data, error } = await supabase
      .from('evaluation_crowd_signals')
      .upsert(rows, { onConflict: 'event_id', ignoreDuplicates: true })
      .select('id');
    if (error) throw error;
    imported += data.length;
  }
  return { imported, signals: await fetchCrowdSignals() };
}

async function ensureReviewer(): Promise<ReviewerRow> {
  const { data, error } = await supabase
    .from('evaluation_reviewers')
    .upsert({ slug: reviewerSlug, display_name: reviewerName }, { onConflict: 'slug' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

let reviewerPromise: Promise<ReviewerRow> | null = null;
function reviewer(): Promise<ReviewerRow> {
  reviewerPromise ??= ensureReviewer().catch((error) => {
    reviewerPromise = null;
    throw error;
  });
  return reviewerPromise;
}

async function fetchAllLabels(reviewerId: number): Promise<EvaluationLabel[]> {
  const rows: LabelRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('evaluation_labels')
      .select('*')
      .eq('reviewer_id', reviewerId)
      .order('updated_at', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows.map(labelFromRow);
}

async function fetchSilverLabels(reviewerId: number): Promise<EvaluationSilverLabel[]> {
  const { data, error } = await supabase
    .from('evaluation_silver_labels')
    .select('*')
    .eq('reviewer_id', reviewerId)
    .order('updated_at', { ascending: false })
    .limit(1000);
  if (error) throw error;
  return data.map(silverLabelFromRow);
}

function validateEvaluationProduct(input: unknown): EvaluationProduct {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Produkt-Payload ist ungültig.');
  const value = input as Record<string, unknown>;
  if (typeof value.productKey !== 'string' || value.productKey.length < 3) throw new Error('productKey fehlt.');
  if (typeof value.snapshotHash !== 'string' || !/^[a-f0-9]{64}$/.test(value.snapshotHash)) throw new Error('snapshotHash ist ungültig.');
  if (typeof value.name !== 'string' || !value.name.trim()) throw new Error('Produktname fehlt.');
  if (value.barcode !== null && (typeof value.barcode !== 'string' || !/^[0-9]{6,32}$/.test(value.barcode))) throw new Error('Barcode ist ungültig.');
  if (!Array.isArray(value.categoryTags) || value.categoryTags.some((tag) => typeof tag !== 'string')) throw new Error('categoryTags sind ungültig.');
  if (value.split !== 'calibration' && value.split !== 'holdout') throw new Error('Dataset-Split ist ungültig.');
  return {
    productKey: value.productKey,
    snapshotHash: value.snapshotHash,
    barcode: value.barcode as string | null,
    name: value.name.trim(),
    brand: typeof value.brand === 'string' && value.brand.trim() ? value.brand.trim() : null,
    quantity: typeof value.quantity === 'string' && value.quantity.trim() ? value.quantity.trim() : null,
    categoryTags: value.categoryTags as string[],
    split: value.split,
  };
}

async function generateSilverLabels(reviewerId: number, input: unknown): Promise<EvaluationSilverLabel[]> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('LLM-Payload ist ungültig.');
  const productsRaw = (input as Record<string, unknown>).products;
  if (!Array.isArray(productsRaw) || productsRaw.length === 0 || productsRaw.length > 10) {
    throw new Error('Pro LLM-Lauf sind 1 bis 10 Produkte erlaubt.');
  }
  const products = productsRaw.map(validateEvaluationProduct);
  const generated: EvaluationSilverLabel[] = [];
  for (const product of products) {
    const result = await labelProductWithOpenAi(product);
    const { data, error } = await supabase
      .from('evaluation_silver_labels')
      .upsert({
        reviewer_id: reviewerId,
        product_key: product.productKey,
        barcode: product.barcode,
        product_snapshot_hash: product.snapshotHash,
        product_name: product.name,
        brand: product.brand,
        quantity: product.quantity,
        category_tags: product.categoryTags,
        dataset_split: product.split,
        proposed_category_id: result.annotation.category_id,
        alternative_category_id: result.annotation.alternative_category_id,
        annotation_status: result.annotation.status,
        review_status: 'pending',
        model_provider: 'openai',
        model_name: result.model,
        prompt_version: LLM_PROMPT_VERSION,
        prompt_fingerprint: LLM_PROMPT_FINGERPRINT,
        rationale: result.annotation.rationale || null,
        evidence: result.annotation.evidence,
        raw_response: result.rawResponse as Json,
      }, { onConflict: 'reviewer_id,product_key,model_provider,model_name,prompt_version' })
      .select('*')
      .single();
    if (error) throw error;
    generated.push(silverLabelFromRow(data));
  }
  return generated;
}

function labelUpsertRow(reviewerId: number, label: SaveEvaluationLabel): Database['public']['Tables']['evaluation_labels']['Insert'] {
  return {
    reviewer_id: reviewerId,
    product_key: label.productKey,
    barcode: label.barcode,
    product_snapshot_hash: label.snapshotHash,
    product_name: label.name,
    brand: label.brand,
    quantity: label.quantity,
    category_tags: label.categoryTags,
    expected_category_id: label.expectedCategoryId,
    status: label.status,
    dataset_split: label.split,
    note: label.note,
    classifier_version_at_label: label.classifierVersionAtLabel,
    original_prediction_category_id: label.originalPredictionCategoryId,
    original_prediction_source: label.originalPredictionSource,
    expected_product_family_id: label.expectedProductFamilyId,
    expected_product_form_id: label.expectedProductFormId,
    expected_placement_zone_id: label.expectedPlacementZoneId,
    taxonomy_version_at_label: label.taxonomyVersionAtLabel,
  };
}

async function upsertLabels(reviewerId: number, labels: readonly SaveEvaluationLabel[]): Promise<void> {
  for (let start = 0; start < labels.length; start += 500) {
    const rows = labels.slice(start, start + 500).map((label) => labelUpsertRow(reviewerId, label));
    const { error } = await supabase.from('evaluation_labels').upsert(rows, { onConflict: 'reviewer_id,product_key' });
    if (error) throw error;
  }
}

function localFrontImagePath(barcode: string | null): string | null {
  if (!barcode || !/^[0-9]{6,32}$/.test(barcode) || !existsSync(IMAGE_DB_PATH)) return null;
  const db = new SqliteDatabase(IMAGE_DB_PATH, { readonly: true });
  const row = db.query<{ local_path: string }, [string]>(`
    select p.local_path
    from product_images p
    join image_files f on f.local_path = p.local_path
    where p.code = ? and p.kind = 'front' and f.status = 'downloaded'
    limit 1
  `).get(barcode);
  db.close();
  if (!row) return null;
  const candidate = path.resolve(IMAGE_ROOT, row.local_path);
  if (!candidate.startsWith(`${path.resolve(IMAGE_ROOT)}${path.sep}`) || !existsSync(candidate)) {
    return null;
  }
  return candidate;
}

function frontImageResponse(barcode: string): Response {
  const candidate = localFrontImagePath(barcode);
  if (!candidate) return new Response('Not found', { status: 404 });
  return new Response(Bun.file(candidate), {
    headers: { 'Cache-Control': 'private, max-age=86400', 'Content-Type': 'image/jpeg' },
  });
}

async function hashFile(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return hash.digest('hex');
}

function classifierFingerprint(): string {
  const hash = createHash('sha256');
  for (const filePath of CLASSIFIER_FILES) {
    hash.update(path.basename(filePath));
    hash.update(readFileSync(filePath));
  }
  return hash.digest('hex');
}

let dumpMetadataPromise: Promise<{ fingerprint: string; productCount: number }> | null = null;
function dumpMetadata(): Promise<{ fingerprint: string; productCount: number }> {
  dumpMetadataPromise ??= (async () => {
    if (!existsSync(DUMP_PATH)) return { fingerprint: '0'.repeat(64), productCount: 0 };
    const db = new SqliteDatabase(DUMP_PATH, { readonly: true });
    const count = db.query('select count(*) as count from products').get() as { count: number };
    db.close();
    return { fingerprint: await hashFile(DUMP_PATH), productCount: count.count };
  })();
  return dumpMetadataPromise;
}

function predictionsFor(labels: readonly EvaluationLabel[]): EvaluationPrediction[] {
  return labels.map((label) => {
    const trace = explainCategory({ name: label.name, categoryTags: label.categoryTags, source: 'dump' });
    return {
      labelId: label.id,
      predictedCategoryId: trace.winner.categoryId as CanonicalCategoryId | null,
      predictionSource: evaluationSource(trace.winner.source),
      conflictReason: trace.conflictReason,
      trace,
    };
  });
}

async function createRun(reviewerId: number): Promise<EvaluationRunDetail> {
  const labels = await fetchAllLabels(reviewerId);
  const predictions = predictionsFor(labels);
  return persistRun(reviewerId, labels, predictions, CLASSIFIER_VERSION, classifierFingerprint());
}

async function persistRun(
  reviewerId: number,
  labels: readonly EvaluationLabel[],
  predictions: readonly EvaluationPrediction[],
  classifierVersion: string,
  fingerprint: string,
): Promise<EvaluationRunDetail> {
  const metrics = computeEvaluationMetrics(labels, predictions);
  const dump = await dumpMetadata();
  const { data: runRow, error: runError } = await supabase
    .from('evaluation_runs')
    .insert({
      reviewer_id: reviewerId,
      classifier_version: classifierVersion,
      classifier_fingerprint: fingerprint,
      dump_fingerprint: dump.fingerprint,
      dump_product_count: dump.productCount,
      label_count: labels.length,
      metrics: metrics as unknown as Json,
    })
    .select('*')
    .single();
  if (runError) throw runError;

  const rows: Database['public']['Tables']['evaluation_run_predictions']['Insert'][] = predictions.map((prediction) => ({
    run_id: runRow.id,
    label_id: prediction.labelId,
    predicted_category_id: prediction.predictedCategoryId,
    prediction_source: prediction.predictionSource,
    conflict_reason: prediction.conflictReason,
    trace: JSON.parse(JSON.stringify(prediction.trace)) as Json,
  }));

  for (let start = 0; start < rows.length; start += 500) {
    const { error } = await supabase.from('evaluation_run_predictions').insert(rows.slice(start, start + 500));
    if (error) {
      await supabase.from('evaluation_runs').delete().eq('id', runRow.id);
      throw error;
    }
  }

  return { ...runFromRow(runRow), predictions: [...predictions] };
}

async function createBaselineRun(reviewerId: number, baselineId: BaselineId): Promise<EvaluationRunDetail> {
  const [labels, silverLabels] = await Promise.all([fetchAllLabels(reviewerId), fetchSilverLabels(reviewerId)]);
  const result = await runBaseline(baselineId, labels, silverLabels, localFrontImagePath);
  return persistRun(reviewerId, labels, result.predictions, result.version, result.fingerprint);
}

async function runDetail(runId: number, reviewerId: number): Promise<EvaluationRunDetail | null> {
  const { data: runRow, error: runError } = await supabase
    .from('evaluation_runs')
    .select('*')
    .eq('id', runId)
    .eq('reviewer_id', reviewerId)
    .maybeSingle();
  if (runError) throw runError;
  if (!runRow) return null;
  const { data: predictionRows, error: predictionError } = await supabase
    .from('evaluation_run_predictions')
    .select('*')
    .eq('run_id', runId);
  if (predictionError) throw predictionError;
  return { ...runFromRow(runRow), predictions: predictionRows.map(predictionFromRow) };
}

async function handleApi(request: Request, url: URL): Promise<Response> {
  const currentReviewer = await reviewer();
  if (url.pathname === '/api/health' && request.method === 'GET') {
    return json({
      ok: true,
      reviewer: { slug: currentReviewer.slug, displayName: currentReviewer.display_name },
      classifierVersion: CLASSIFIER_VERSION,
      dumpReady: existsSync(DUMP_PATH),
      imageManifestReady: existsSync(IMAGE_DB_PATH),
      llmConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
      llmModel: process.env.OPENAI_MODEL?.trim() || 'gpt-5-nano',
    });
  }
  const imageMatch = url.pathname.match(/^\/api\/images\/([0-9]{6,32})\/front$/);
  if (imageMatch && request.method === 'GET') return frontImageResponse(imageMatch[1]!);
  if (url.pathname === '/api/labels' && request.method === 'GET') {
    return json(await fetchAllLabels(currentReviewer.id));
  }
  if (url.pathname === '/api/labels/export' && request.method === 'GET') {
    return json(createEvaluationExport(await fetchAllLabels(currentReviewer.id)));
  }
  if (url.pathname === '/api/labels/import' && request.method === 'POST') {
    const imported = parseEvaluationExport(await request.json());
    await upsertLabels(currentReviewer.id, imported.labels);
    return json({ imported: imported.labels.length, labels: await fetchAllLabels(currentReviewer.id) });
  }
  if (url.pathname === '/api/labels' && request.method === 'PUT') {
    const label = validateLabel(await request.json());
    const { data, error } = await supabase
      .from('evaluation_labels')
      .upsert(labelUpsertRow(currentReviewer.id, label), { onConflict: 'reviewer_id,product_key' })
      .select('*')
      .single();
    if (error) throw error;
    return json(labelFromRow(data));
  }
  if (url.pathname === '/api/silver-labels' && request.method === 'GET') {
    return json(await fetchSilverLabels(currentReviewer.id));
  }
  if (url.pathname === '/api/crowd-signals' && request.method === 'GET') {
    return json(await fetchCrowdSignals());
  }
  if (url.pathname === '/api/crowd-signals/import' && request.method === 'POST') {
    return json(await importCrowdSignals(await request.json()), 201);
  }
  if (url.pathname === '/api/crowd-signal-reviews' && request.method === 'POST') {
    const review = parseCrowdSignalReview(await request.json());
    const { data, error } = await supabase
      .from('evaluation_crowd_signal_reviews')
      .insert({
        signal_id: review.signalId,
        reviewer_id: currentReviewer.id,
        decision: review.decision,
        product_family_id: review.productFamilyId,
        product_form_id: review.productFormId,
        placement_zone_id: review.placementZoneId,
        training_approved: review.trainingApproved,
        note: review.note,
      })
      .select('*')
      .single();
    if (error) throw error;
    return json(crowdSignalReviewFromRow(data), 201);
  }
  if (url.pathname === '/api/silver-labels/generate' && request.method === 'POST') {
    return json(await generateSilverLabels(currentReviewer.id, await request.json()), 201);
  }
  const silverMatch = url.pathname.match(/^\/api\/silver-labels\/(\d+)$/);
  if (silverMatch && request.method === 'PATCH') {
    const body: unknown = await request.json();
    const reviewStatus = body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>).reviewStatus
      : null;
    if (reviewStatus !== 'accepted' && reviewStatus !== 'rejected') throw new Error('Silver-Reviewstatus ist ungültig.');
    const { data, error } = await supabase
      .from('evaluation_silver_labels')
      .update({ review_status: reviewStatus })
      .eq('id', Number(silverMatch[1]))
      .eq('reviewer_id', currentReviewer.id)
      .select('*')
      .single();
    if (error) throw error;
    if (reviewStatus === 'accepted' && data.annotation_status !== 'labeled') {
      await supabase.from('evaluation_silver_labels').update({ review_status: 'pending' }).eq('id', data.id);
      throw new Error('Nur konkrete LLM-Kategorien können als Silver-Label akzeptiert werden.');
    }
    return json(silverLabelFromRow(data));
  }
  if (url.pathname.startsWith('/api/labels/') && request.method === 'DELETE') {
    const productKey = decodeURIComponent(url.pathname.slice('/api/labels/'.length));
    const { error } = await supabase
      .from('evaluation_labels')
      .delete()
      .eq('reviewer_id', currentReviewer.id)
      .eq('product_key', productKey);
    if (error) throw error;
    return json({ deleted: true });
  }
  if (url.pathname === '/api/runs' && request.method === 'GET') {
    const { data, error } = await supabase
      .from('evaluation_runs')
      .select('*')
      .eq('reviewer_id', currentReviewer.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return json(data.map(runFromRow));
  }
  if (url.pathname === '/api/runs' && request.method === 'POST') {
    return json(await createRun(currentReviewer.id), 201);
  }
  if (url.pathname === '/api/baselines' && request.method === 'GET') {
    return json(baselineDefinitions());
  }
  if (url.pathname === '/api/rule-proposals' && request.method === 'GET') {
    return json(mineRuleProposals(await fetchAllLabels(currentReviewer.id)));
  }
  if (url.pathname === '/api/baselines/run' && request.method === 'POST') {
    const body: unknown = await request.json();
    const baselineId = body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>).baselineId
      : null;
    if (typeof baselineId !== 'string' || !(BASELINE_IDS as readonly string[]).includes(baselineId)) throw new Error('Baseline-ID ist ungültig.');
    return json(await createBaselineRun(currentReviewer.id, baselineId as BaselineId), 201);
  }
  const runMatch = url.pathname.match(/^\/api\/runs\/(\d+)$/);
  if (runMatch && request.method === 'GET') {
    const detail = await runDetail(Number(runMatch[1]), currentReviewer.id);
    return detail ? json(detail) : json({ error: 'Run nicht gefunden.' }, 404);
  }
  return json({ error: 'API-Route nicht gefunden.' }, 404);
}

function staticResponse(url: URL): Response {
  const relativePath = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
  const candidate = path.resolve(DIST_ROOT, relativePath);
  if (!candidate.startsWith(`${DIST_ROOT}${path.sep}`) && candidate !== path.join(DIST_ROOT, 'index.html')) {
    return new Response('Not found', { status: 404 });
  }
  if (existsSync(candidate)) return new Response(Bun.file(candidate));
  const fallback = path.join(DIST_ROOT, 'index.html');
  return existsSync(fallback) ? new Response(Bun.file(fallback)) : new Response('Build fehlt.', { status: 404 });
}

Bun.serve({
  port,
  hostname: '127.0.0.1',
  async fetch(request, server) {
    const remoteAddress = server.requestIP(request)?.address;
    if (remoteAddress && remoteAddress !== '127.0.0.1' && remoteAddress !== '::1') {
      return json({ error: 'Nur lokale Verbindungen sind erlaubt.' }, 403);
    }
    if (!isLocalOrigin(request)) {
      return json({ error: 'Cross-Origin-Anfragen sind nicht erlaubt.' }, 403);
    }
    const url = new URL(request.url);
    try {
      return url.pathname.startsWith('/api/') ? await handleApi(request, url) : staticResponse(url);
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
      return json({ error: error instanceof Error ? error.message : 'Unbekannter Serverfehler.' }, 500);
    }
  },
});

console.log(`Category Evaluation API: http://127.0.0.1:${port}`);
