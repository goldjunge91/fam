import {
  canUndoTransaction,
  inverseTransactionType,
  planOpenInventoryItem,
  planUndoOpenTransaction,
} from './inventory-lifecycle';

const ITEM = {
  id: 'sealed-lot',
  householdId: 'household-1',
  locationId: 'fridge',
  productId: 'mustard',
  name: 'Senf',
  quantity: 3,
  unit: 'glas',
  expiryDate: '2026-12-31',
  openedAt: null,
  vacuumSealed: false,
  expiryUserSet: false,
  packageSize: null,
  packageSizeUnit: null,
  addedBy: 'alice',
  category: 'Saucen',
  locationKind: 'fridge',
} as const;

describe('planOpenInventoryItem', () => {
  it('öffnet ein einzelnes Gebinde in-place und protokolliert die vorherige MHD', () => {
    const plan = planOpenInventoryItem(
      { ...ITEM, quantity: 1 },
      1,
      new Date(2026, 7, 5, 14, 30),
      'opened-lot',
    );

    expect(plan.originalPatch).toEqual({
      openedAt: new Date(2026, 7, 5, 14, 30).toISOString(),
      expiryDate: '2026-08-10',
      expiryUserSet: false,
      vacuumSealed: false,
    });
    expect(plan.openedItem).toBeNull();
    expect(plan.transaction).toMatchObject({
      fridgeItemId: 'sealed-lot',
      productId: 'mustard',
      type: 'open',
      quantity: 1,
      previousExpiryDate: '2026-12-31',
    });
  });

  it('teilt mehrere Gebinde in einen versiegelten und einen geöffneten Lot', () => {
    const plan = planOpenInventoryItem(ITEM, 1, new Date('2026-08-05T14:30:00.000Z'), 'opened-lot');

    expect(plan.originalPatch).toEqual({ quantity: 2 });
    expect(plan.openedItem).toMatchObject({
      id: 'opened-lot',
      quantity: 1,
      openedAt: '2026-08-05T14:30:00.000Z',
      expiryDate: '2026-08-10',
      expiryUserSet: false,
      vacuumSealed: false,
    });
  });

  it('verweigert das erneute Öffnen eines bereits geöffneten Lots', () => {
    expect(() =>
      planOpenInventoryItem(
        { ...ITEM, quantity: 1, openedAt: '2026-08-05T14:30:00.000Z' },
        1,
        new Date('2026-08-05T15:00:00.000Z'),
        'opened-again',
      ),
    ).toThrow('bereits geöffnet');
  });

  it('erkennt eine Öffnung nach 24 Stunden als nicht mehr rückgängig machbar', () => {
    const createdAt = new Date('2026-08-05T14:30:00.000Z');
    expect(canUndoTransaction(createdAt, new Date('2026-08-06T14:29:59.999Z'))).toBe(true);
    expect(canUndoTransaction(createdAt, new Date('2026-08-06T14:30:00.001Z'))).toBe(false);
  });
});

describe('planUndoOpenTransaction', () => {
  it('stellt eine in-place Öffnung samt ursprünglichem MHD wieder her', () => {
    const plan = planUndoOpenTransaction(
      {
        id: 'transaction-1',
        householdId: 'household-1',
        fridgeItemId: 'sealed-lot',
        productId: 'mustard',
        locationId: 'fridge',
        type: 'open',
        quantity: 1,
        previousExpiryDate: '2026-12-31',
        createdAt: '2026-08-05T14:30:00.000Z',
      },
      { ...ITEM, openedAt: '2026-08-05T14:30:00.000Z', expiryDate: '2026-08-10' },
      null,
      new Date('2026-08-05T15:00:00.000Z'),
    );

    expect(plan.mode).toBe('restore-in-place');
    expect(plan.openedPatch).toEqual({
      openedAt: null,
      expiryDate: '2026-12-31',
      expiryUserSet: false,
      vacuumSealed: false,
    });
    expect(plan.deleteOpenedItem).toBe(false);
  });

  it('merged einen unveränderten Split-Lot zurück', () => {
    const sealed = { ...ITEM, quantity: 2 };
    const opened = {
      ...ITEM,
      id: 'opened-lot',
      quantity: 1,
      openedAt: '2026-08-05T14:30:00.000Z',
      expiryDate: '2026-08-10',
    };
    const plan = planUndoOpenTransaction(
      {
        id: 'transaction-1',
        householdId: 'household-1',
        fridgeItemId: 'opened-lot',
        productId: 'mustard',
        locationId: 'fridge',
        type: 'open',
        quantity: 1,
        previousExpiryDate: '2026-12-31',
        notes: '[Split]',
        createdAt: '2026-08-05T14:30:00.000Z',
      },
      opened,
      sealed,
      new Date('2026-08-05T15:00:00.000Z'),
    );

    expect(plan.mode).toBe('merge-split');
    expect(plan.sealedPatch).toEqual({ quantity: 3 });
    expect(plan.deleteOpenedItem).toBe(true);
  });

  it('fällt bei verändertem geöffnetem Lot auf einen sicheren Restore zurück', () => {
    const sealed = { ...ITEM, quantity: 2 };
    const opened = {
      ...ITEM,
      id: 'opened-lot',
      quantity: 0.5,
      openedAt: '2026-08-05T14:30:00.000Z',
      expiryDate: '2026-08-10',
    };
    const plan = planUndoOpenTransaction(
      {
        id: 'transaction-1',
        householdId: 'household-1',
        fridgeItemId: 'opened-lot',
        productId: 'mustard',
        locationId: 'fridge',
        type: 'open',
        quantity: 1,
        previousExpiryDate: '2026-12-31',
        createdAt: '2026-08-05T14:30:00.000Z',
      },
      opened,
      sealed,
      new Date('2026-08-05T15:00:00.000Z'),
    );

    expect(plan.mode).toBe('fallback');
    expect(plan.deleteOpenedItem).toBe(false);
    expect(plan.sealedPatch).toBeNull();
  });
});

describe('inverseTransactionType', () => {
  it.each([
    ['in', 'out'],
    ['out', 'in'],
    ['waste', 'in'],
    ['open', 'open'],
  ] as const)('%s -> %s', (type, expected) => {
    expect(inverseTransactionType(type)).toBe(expected);
  });
});
