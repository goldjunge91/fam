import type {
  CrowdSignalImportFile,
  CrowdSignalInput,
  CrowdSignalReviewDecision,
  SaveCrowdSignalReview,
} from './types';
import {
  PLACEMENT_ZONE_IDS,
  PRODUCT_FAMILY_IDS,
  PRODUCT_FORM_IDS,
  type PlacementZoneId,
  type ProductFamilyId,
  type ProductFormId,
} from './taxonomy';

export const CROWD_SIGNAL_SCHEMA = 'nutritrack-crowd-signals' as const;
export const CROWD_SIGNAL_VERSION = 1 as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requiredText(value: unknown, field: string, maximum = 1000): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} fehlt.`);
  const result = value.trim();
  if (result.length > maximum) throw new Error(`${field} ist zu lang.`);
  return result;
}

function nullableText(value: unknown, field: string, maximum = 1000): string | null {
  if (value === null || value === undefined || value === '') return null;
  return requiredText(value, field, maximum);
}

function isoTimestamp(value: unknown, field: string): string {
  const text = requiredText(value, field, 100);
  const timestamp = new Date(text);
  if (Number.isNaN(timestamp.getTime())) throw new Error(`${field} ist kein gültiger Zeitpunkt.`);
  return timestamp.toISOString();
}

export function parseCrowdSignalInput(input: unknown): CrowdSignalInput {
  if (!isRecord(input)) throw new Error('Crowd-Signal muss ein JSON-Objekt sein.');
  if (input.schemaVersion !== 1) throw new Error('schemaVersion muss 1 sein.');
  if (input.source !== 'alpha_app' && input.source !== 'manual_import') throw new Error('source ist ungültig.');
  if (input.eventType !== 'product_moved') throw new Error('eventType ist ungültig.');
  if (!isRecord(input.payload)) throw new Error('payload muss ein JSON-Objekt sein.');
  const barcode = nullableText(input.barcode, 'barcode', 32);
  if (barcode !== null && !/^[0-9]{6,32}$/.test(barcode)) throw new Error('barcode ist ungültig.');

  return {
    eventId: requiredText(input.eventId, 'eventId', 200),
    schemaVersion: 1,
    source: input.source,
    eventType: input.eventType,
    occurredAt: isoTimestamp(input.occurredAt, 'occurredAt'),
    actorKey: requiredText(input.actorKey, 'actorKey', 200),
    householdKey: requiredText(input.householdKey, 'householdKey', 200),
    storeKey: nullableText(input.storeKey, 'storeKey', 200),
    productKey: requiredText(input.productKey, 'productKey', 512),
    barcode,
    productName: requiredText(input.productName, 'productName', 1000),
    fromZoneId: nullableText(input.fromZoneId, 'fromZoneId', 100),
    toZoneId: requiredText(input.toZoneId, 'toZoneId', 100),
    classifierVersion: requiredText(input.classifierVersion, 'classifierVersion', 100),
    payload: input.payload,
  };
}

export function parseCrowdSignalImport(input: unknown): CrowdSignalImportFile {
  if (!isRecord(input)) throw new Error('Crowd-Import muss ein JSON-Objekt sein.');
  if (input.schema !== CROWD_SIGNAL_SCHEMA || input.version !== CROWD_SIGNAL_VERSION) {
    throw new Error('Unbekanntes Crowd-Signal-Format.');
  }
  if (!Array.isArray(input.events) || input.events.length === 0 || input.events.length > 5000) {
    throw new Error('Der Import muss 1 bis 5.000 Ereignisse enthalten.');
  }
  return {
    schema: CROWD_SIGNAL_SCHEMA,
    version: CROWD_SIGNAL_VERSION,
    exportedAt: typeof input.exportedAt === 'string' ? isoTimestamp(input.exportedAt, 'exportedAt') : undefined,
    events: input.events.map((event, index) => {
      try {
        return parseCrowdSignalInput(event);
      } catch (error) {
        throw new Error(`Ereignis ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }),
  };
}

function optionalId<T extends string>(value: unknown, allowed: readonly string[], field: string): T | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !allowed.includes(value)) throw new Error(`${field} ist ungültig.`);
  return value as T;
}

export function parseCrowdSignalReview(input: unknown): SaveCrowdSignalReview {
  if (!isRecord(input)) throw new Error('Review muss ein JSON-Objekt sein.');
  if (!Number.isSafeInteger(input.signalId) || Number(input.signalId) <= 0) throw new Error('signalId ist ungültig.');
  const decisions: CrowdSignalReviewDecision[] = ['confirmed', 'rejected', 'duplicate', 'insufficient_context'];
  if (typeof input.decision !== 'string' || !decisions.includes(input.decision as CrowdSignalReviewDecision)) {
    throw new Error('decision ist ungültig.');
  }
  const productFamilyId = optionalId<ProductFamilyId>(input.productFamilyId, PRODUCT_FAMILY_IDS, 'productFamilyId');
  const productFormId = optionalId<ProductFormId>(input.productFormId, PRODUCT_FORM_IDS, 'productFormId');
  const placementZoneId = optionalId<PlacementZoneId>(input.placementZoneId, PLACEMENT_ZONE_IDS, 'placementZoneId');
  const trainingApproved = input.trainingApproved === true;
  const completeTaxonomy = productFamilyId !== null && productFormId !== null && placementZoneId !== null;
  if (input.decision === 'confirmed' && !completeTaxonomy) throw new Error('Bestätigte Signale benötigen Familie, Form und Zone.');
  if (input.decision !== 'confirmed' && completeTaxonomy) throw new Error('Nur bestätigte Signale dürfen ein Taxonomie-Label tragen.');
  if (trainingApproved && (input.decision !== 'confirmed' || !completeTaxonomy)) {
    throw new Error('Trainingsfreigabe ist nur nach vollständiger Bestätigung erlaubt.');
  }

  return {
    signalId: Number(input.signalId),
    decision: input.decision as CrowdSignalReviewDecision,
    productFamilyId,
    productFormId,
    placementZoneId,
    trainingApproved,
    note: nullableText(input.note, 'note', 2000),
  };
}

