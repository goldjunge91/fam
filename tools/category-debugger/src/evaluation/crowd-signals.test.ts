import { describe, expect, it } from 'vitest';
import { parseCrowdSignalImport, parseCrowdSignalReview } from './crowd-signals';

const event = {
  eventId: 'evt_01',
  schemaVersion: 1,
  source: 'alpha_app',
  eventType: 'product_moved',
  occurredAt: '2026-08-24T12:00:00.000Z',
  actorKey: 'actor_hash',
  householdKey: 'household_hash',
  storeKey: 'store_hash',
  productKey: 'barcode:400000000001',
  barcode: '400000000001',
  productName: 'Haferdrink Natur',
  fromZoneId: 'plant_based',
  toZoneId: 'ambient_milk_drinks',
  classifierVersion: 'category-v2',
  payload: { gesture: 'drag', listPosition: 4 },
} as const;

describe('Crowd-Signale', () => {
  it('akzeptiert ein versioniertes Rohsignalformat und behält das Payload', () => {
    const parsed = parseCrowdSignalImport({
      schema: 'nutritrack-crowd-signals',
      version: 1,
      events: [event],
    });
    expect(parsed.events[0]?.payload).toEqual({ gesture: 'drag', listPosition: 4 });
  });

  it('verweigert eine Trainingsfreigabe ohne bestätigtes Human-Review', () => {
    expect(() => parseCrowdSignalReview({
      signalId: 1,
      decision: 'rejected',
      productFamilyId: null,
      productFormId: null,
      placementZoneId: null,
      trainingApproved: true,
      note: null,
    })).toThrow(/Trainingsfreigabe/);
  });

  it('erlaubt die ausdrückliche Freigabe eines vollständig bestätigten Signals', () => {
    expect(parseCrowdSignalReview({
      signalId: 1,
      decision: 'confirmed',
      productFamilyId: 'plant_drink',
      productFormId: 'ambient',
      placementZoneId: 'ambient_milk_drinks',
      trainingApproved: true,
      note: 'Produkt und Marktzuordnung geprüft.',
    }).trainingApproved).toBe(true);
  });
});
