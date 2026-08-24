import { CANONICAL_CATEGORY_IDS, type EvaluationLabel, type SaveEvaluationLabel } from './types';
import {
  PLACEMENT_ZONE_IDS,
  PRODUCT_FAMILY_IDS,
  PRODUCT_FORM_IDS,
  type PlacementZoneId,
  type ProductFamilyId,
  type ProductFormId,
} from './taxonomy';

export const EVALUATION_EXPORT_SCHEMA = 'nutritrack-category-evaluation' as const;
export const EVALUATION_EXPORT_VERSION = 2 as const;

export type EvaluationExportFile = {
  schema: typeof EVALUATION_EXPORT_SCHEMA;
  version: typeof EVALUATION_EXPORT_VERSION;
  exportedAt: string;
  labels: SaveEvaluationLabel[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nullableText(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new Error(`${field} muss Text oder null sein.`);
  return value.trim() || null;
}

function category(value: unknown, field: string): SaveEvaluationLabel['expectedCategoryId'] {
  if (value === null) return null;
  if (typeof value !== 'string' || !(CANONICAL_CATEGORY_IDS as readonly string[]).includes(value)) {
    throw new Error(`${field} enthält keine bekannte Kategorie.`);
  }
  return value as SaveEvaluationLabel['expectedCategoryId'];
}

function taxonomyId<T extends string>(value: unknown, allowed: readonly string[], field: string): T | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !allowed.includes(value)) throw new Error(`${field} ist ungültig.`);
  return value as T;
}

export function portableLabel(label: EvaluationLabel): SaveEvaluationLabel {
  const { id: _id, reviewerId: _reviewerId, createdAt: _createdAt, updatedAt: _updatedAt, ...portable } = label;
  return portable;
}

export function createEvaluationExport(labels: readonly EvaluationLabel[]): EvaluationExportFile {
  return {
    schema: EVALUATION_EXPORT_SCHEMA,
    version: EVALUATION_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    labels: labels.map(portableLabel),
  };
}

export function parseEvaluationExport(input: unknown): EvaluationExportFile {
  if (!isRecord(input)) throw new Error('Importdatei muss ein JSON-Objekt sein.');
  if (input.schema !== EVALUATION_EXPORT_SCHEMA || (input.version !== 1 && input.version !== EVALUATION_EXPORT_VERSION)) {
    throw new Error('Unbekanntes Evaluation-Exportformat.');
  }
  if (!Array.isArray(input.labels)) throw new Error('Importdatei enthält keine Labels.');

  const labels = input.labels.map((raw, index): SaveEvaluationLabel => {
    if (!isRecord(raw)) throw new Error(`Label ${index + 1} ist ungültig.`);
    const expectedCategoryId = category(raw.expectedCategoryId, `Label ${index + 1}: expectedCategoryId`);
    const originalPredictionCategoryId = category(raw.originalPredictionCategoryId, `Label ${index + 1}: originalPredictionCategoryId`);
    const expectedProductFamilyId = taxonomyId<ProductFamilyId>(raw.expectedProductFamilyId, PRODUCT_FAMILY_IDS, `Label ${index + 1}: expectedProductFamilyId`);
    const expectedProductFormId = taxonomyId<ProductFormId>(raw.expectedProductFormId, PRODUCT_FORM_IDS, `Label ${index + 1}: expectedProductFormId`);
    const expectedPlacementZoneId = taxonomyId<PlacementZoneId>(raw.expectedPlacementZoneId, PLACEMENT_ZONE_IDS, `Label ${index + 1}: expectedPlacementZoneId`);
    const taxonomyVersionAtLabel = nullableText(raw.taxonomyVersionAtLabel, `Label ${index + 1}: taxonomyVersionAtLabel`);
    if (typeof raw.productKey !== 'string' || raw.productKey.length < 3) throw new Error(`Label ${index + 1}: productKey fehlt.`);
    if (typeof raw.snapshotHash !== 'string' || !/^[a-f0-9]{64}$/.test(raw.snapshotHash)) throw new Error(`Label ${index + 1}: snapshotHash ist ungültig.`);
    if (typeof raw.name !== 'string' || !raw.name.trim()) throw new Error(`Label ${index + 1}: Produktname fehlt.`);
    if (raw.barcode !== null && (typeof raw.barcode !== 'string' || !/^[0-9]{6,32}$/.test(raw.barcode))) throw new Error(`Label ${index + 1}: Barcode ist ungültig.`);
    if (!Array.isArray(raw.categoryTags) || raw.categoryTags.some((tag) => typeof tag !== 'string')) throw new Error(`Label ${index + 1}: categoryTags sind ungültig.`);
    if (raw.split !== 'calibration' && raw.split !== 'holdout') throw new Error(`Label ${index + 1}: Split ist ungültig.`);
    if (raw.status !== 'labeled' && raw.status !== 'ambiguous' && raw.status !== 'invalid') throw new Error(`Label ${index + 1}: Status ist ungültig.`);
    if (raw.status !== 'labeled' && expectedCategoryId !== null) throw new Error(`Label ${index + 1}: Nur gelabelte Produkte dürfen eine Kategorie tragen.`);
    if (typeof raw.classifierVersionAtLabel !== 'string' || !raw.classifierVersionAtLabel) throw new Error(`Label ${index + 1}: Classifier-Version fehlt.`);
    if (raw.originalPredictionSource !== null && raw.originalPredictionSource !== 'off_taxonomy' && raw.originalPredictionSource !== 'name_fallback') {
      throw new Error(`Label ${index + 1}: Vorhersagequelle ist ungültig.`);
    }
    const taxonomyFields = [expectedProductFamilyId, expectedProductFormId, expectedPlacementZoneId, taxonomyVersionAtLabel];
    const taxonomyComplete = taxonomyFields.every((value) => value !== null);
    if (!taxonomyComplete && taxonomyFields.some((value) => value !== null)) {
      throw new Error(`Label ${index + 1}: Taxonomie-Label ist unvollständig.`);
    }
    if (taxonomyComplete && raw.status !== 'labeled') {
      throw new Error(`Label ${index + 1}: Nur gelabelte Produkte dürfen Taxonomie-Felder tragen.`);
    }
    return {
      productKey: raw.productKey,
      snapshotHash: raw.snapshotHash,
      barcode: raw.barcode as string | null,
      name: raw.name.trim(),
      brand: nullableText(raw.brand, `Label ${index + 1}: brand`),
      quantity: nullableText(raw.quantity, `Label ${index + 1}: quantity`),
      categoryTags: raw.categoryTags as string[],
      split: raw.split,
      expectedCategoryId,
      status: raw.status,
      note: nullableText(raw.note, `Label ${index + 1}: note`),
      classifierVersionAtLabel: raw.classifierVersionAtLabel,
      originalPredictionCategoryId,
      originalPredictionSource: raw.originalPredictionSource,
      expectedProductFamilyId,
      expectedProductFormId,
      expectedPlacementZoneId,
      taxonomyVersionAtLabel,
    };
  });

  return {
    schema: EVALUATION_EXPORT_SCHEMA,
    version: EVALUATION_EXPORT_VERSION,
    exportedAt: typeof input.exportedAt === 'string' ? input.exportedAt : new Date(0).toISOString(),
    labels,
  };
}
